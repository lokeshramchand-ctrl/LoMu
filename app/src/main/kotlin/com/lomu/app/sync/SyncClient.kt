package com.lomu.app.sync

import android.content.Context
import com.lomu.app.db.MusicDatabase
import com.lomu.app.db.entities.Event
import com.lomu.app.constants.SongSortType
import com.lomu.app.models.MediaMetadata
import com.lomu.app.models.toMediaMetadata
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import okhttp3.Dns
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.net.InetAddress
import java.net.UnknownHostException
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

data class SyncState(
    val serverUrl: String = "",
    val user: String? = null,
    val status: String = "Not signed in",
    val busy: Boolean = false,
    val error: String? = null,
    val lan: String = "",
)

/**
 * Talks to the LoMu server (the web app): sign-in with rotating tokens and incremental
 * document sync of likes and listening history. The wire format is shared with the web player
 * (see web/src/server/sync.ts).
 */
@Singleton
class SyncClient @Inject constructor(
    @ApplicationContext context: Context,
    private val database: MusicDatabase,
) {
    private val prefs = context.getSharedPreferences("lomu_sync", Context.MODE_PRIVATE)
    /**
     * The server's public name does not work from inside the home network: many routers cannot loop a connection back in,
     * and with Cloudflare WARP on, the connection is tunnelled out and has to come back in from the internet. The server is
     * reachable on private addresses though (a list, e.g. 10.10.10.136 and 192.168.1.17; set by hand in Settings or learned
     * from the server), and its certificate is for the public name. So for the server's own host this resolver offers those
     * addresses too: the ones that answer a quick TCP probe go first, then the public name, then the rest. TLS still uses the
     * public name, so nothing about certificate checking is relaxed. Away from home the probes fail in ~0.5 s (in parallel,
     * and remembered for 30 s) and the public name is used as before.
     */
    val lanAwareDns: Dns = object : Dns {
        override fun lookup(hostname: String): List<InetAddress> {
            val system = runCatching { Dns.SYSTEM.lookup(hostname) }.getOrDefault(emptyList())
            val home = homeAddresses()
            if (home.isEmpty() || !isServerHost(hostname)) {
                if (system.isEmpty()) throw UnknownHostException(hostname)
                return system
            }
            val port = runCatching { java.net.URI(publicBase()).let { if (it.port > 0) it.port else if (it.scheme == "http") 80 else 443 } }.getOrDefault(443)
            val answering = probeAll(home, port)
            val candidates = home.mapNotNull { runCatching { InetAddress.getByName(it) }.getOrNull() }
            val up = candidates.filter { it.hostAddress in answering }
            val down = candidates.filter { it.hostAddress !in answering }
            val all = (up + system + down).distinct()
            if (all.isEmpty()) throw UnknownHostException(hostname)
            return all
        }
    }

    private val probeCache = java.util.concurrent.ConcurrentHashMap<String, Pair<Boolean, Long>>()

    /** Which of [addresses] accept a TCP connection on [port] right now. Parallel, 500 ms each, cached for 30 s. */
    private fun probeAll(addresses: List<String>, port: Int): Set<String> {
        val now = System.currentTimeMillis()
        val result = java.util.concurrent.ConcurrentHashMap.newKeySet<String>()
        val threads = addresses.map { a ->
            val cached = probeCache["$a:$port"]
            if (cached != null && now - cached.second < 30_000) {
                if (cached.first) result.add(a)
                null
            } else Thread {
                val ok = runCatching { java.net.Socket().use { it.connect(java.net.InetSocketAddress(a, port), 500); true } }.getOrDefault(false)
                probeCache["$a:$port"] = ok to System.currentTimeMillis()
                if (ok) result.add(a)
            }.also { it.isDaemon = true; it.start() }
        }
        threads.forEach { it?.join(700) }
        return result
    }

    /** The saved home addresses, validated (private ranges only), at most 4. */
    private fun homeAddresses(): List<String> = parseHomeAddresses(prefs.getString("lan", null))

    private fun parseHomeAddresses(v: String?): List<String> = parseHomeEntries(v).map { it.substringBefore(':') }.distinct()

    /** Valid entries: a private IPv4 address, optionally with ":port" (the server container's own published port). At most 4. */
    private fun parseHomeEntries(v: String?): List<String> =
        (v ?: "").split(Regex("[\\s,;]+")).map { it.trim() }.filter { validEntry(it) }.distinct().take(4)

    private fun validEntry(e: String): Boolean {
        if (e.isEmpty()) return false
        val port = e.substringAfter(':', "")
        if (e.contains(':') && (port.toIntOrNull() ?: 0) !in 1..65535) return false
        return isPrivateIpv4(e.substringBefore(':'))
    }

    /**
     * "http://10.10.10.136:4100" when a home entry has a port and answers a quick TCP probe: the phone then talks to the server
     * directly, with no proxy and no certificate involved (cleartext is allowed only for the home addresses in the network
     * security config). Null otherwise, and the public https address is used.
     */
    private fun directBase(): String? {
        val entries = parseHomeEntries(prefs.getString("lan", null)).filter { it.contains(':') }
        for (e in entries) {
            val ip = e.substringBefore(':')
            val port = e.substringAfter(':').toInt()
            if (ip in probeAll(listOf(ip), port)) return "http://$ip:$port"
        }
        return null
    }

    private val http = OkHttpClient.Builder().dns(lanAwareDns).connectTimeout(7, TimeUnit.SECONDS).callTimeout(30, TimeUnit.SECONDS).build()
    private val json = "application/json".toMediaType()
    private val lock = Mutex()

    private val _state = MutableStateFlow(
        SyncState(
            serverUrl = prefs.getString("url", null) ?: com.lomu.app.BuildConfig.DEFAULT_SERVER_URL,
            user = prefs.getString("user", null),
            status = if (prefs.getString("refresh", null) != null) "Signed in" else "Not signed in",
            lan = (prefs.getString("lan", null) ?: "").split(",").filter { it.isNotBlank() }.joinToString(", "),
        ),
    )
    val state: StateFlow<SyncState> = _state.asStateFlow()

    val signedIn get() = prefs.getString("refresh", null) != null

    /** A queue another device (web, desktop) was playing more recently than this phone; Home offers to continue it. */
    data class RemoteQueue(val device: String, val tracks: List<MediaMetadata>, val index: Int, val positionMs: Long, val at: Long)

    private val _remoteQueue = MutableStateFlow<RemoteQueue?>(null)
    val remoteQueue: StateFlow<RemoteQueue?> = _remoteQueue.asStateFlow()

    init {
        runCatching { prefs.getString("remoteQueue", null)?.let { _remoteQueue.value = parseRemoteQueue(JSONObject(it)) } }
    }

    private fun deviceId(): String =
        prefs.getString("deviceId", null) ?: java.util.UUID.randomUUID().toString().replace("-", "").take(16).also { prefs.edit().putString("deviceId", it).apply() }

    private fun publicBase() = (prefs.getString("url", null) ?: com.lomu.app.BuildConfig.DEFAULT_SERVER_URL).trimEnd('/')

    private fun base() = directBase() ?: publicBase()

    private fun post(path: String, body: JSONObject, auth: Boolean): Pair<Int, JSONObject> {
        val b = Request.Builder().url(base() + path).header("x-lomu-device", "android")
            .post(body.toString().toRequestBody(json))
        if (auth) prefs.getString("access", null)?.let { b.header("Authorization", "Bearer $it") }
        return http.newCall(b.build()).execute().use { r -> r.code to JSONObject(r.body?.string().orEmpty().ifBlank { "{}" }) }
    }

    private fun get(path: String): Pair<Int, JSONObject> {
        val b = Request.Builder().url(base() + path).header("x-lomu-device", "android")
        prefs.getString("access", null)?.let { b.header("Authorization", "Bearer $it") }
        return http.newCall(b.build()).execute().use { r -> r.code to JSONObject(r.body?.string().orEmpty().ifBlank { "{}" }) }
    }

    /** True for the LoMu server's own host name (the only one the LAN address applies to). */
    fun isServerHost(hostname: String): Boolean = runCatching { java.net.URI(publicBase()).host == hostname }.getOrDefault(false)

    private fun isPrivateIpv4(v: String): Boolean {
        val m = Regex("^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$").matchEntire(v.trim()) ?: return false
        val (a, b, c, d) = m.groupValues.drop(1).map { it.toInt() }
        if (listOf(a, b, c, d).any { it > 255 }) return false
        return a == 10 || (a == 172 && b in 16..31) || (a == 192 && b == 168) || (a == 100 && b in 64..127)
    }

    /** Asks the server for its address on the home network (it advertises it to signed-in accounts) and remembers it. */
    private fun learnLan() {
        prefs.edit().putLong("lanTried", System.currentTimeMillis()).apply()
        runCatching {
            val (code, o) = get("/api/auth/status")
            val found = parseHomeEntries(o.optString("lan", ""))
            if (code == 200 && found.isNotEmpty() && prefs.getString("lanManual", null) == null) {
                prefs.edit().putString("lan", found.joinToString(",")).apply()
                _state.value = _state.value.copy(lan = found.joinToString(", "))
            }
        }
    }

    /**
     * Sets the home network addresses by hand (comma separated, e.g. "10.10.10.136, 192.168.1.17"); an empty string clears them
     * and lets the app learn them from the server again. Returns an error message, or null when saved.
     */
    fun setLan(value: String): String? {
        val parts = value.split(Regex("[\\s,;]+")).map { it.trim() }.filter { it.isNotEmpty() }
        val bad = parts.filter { !validEntry(it) }
        if (bad.isNotEmpty()) return "Not a home network address: ${bad.joinToString(", ")}. Use addresses like 10.10.10.136 or 10.10.10.136:4100."
        val ok = parseHomeEntries(value)
        probeCache.clear()
        if (ok.isEmpty()) {
            prefs.edit().remove("lan").remove("lanManual").remove("lanTried").apply()
        } else {
            prefs.edit().putString("lan", ok.joinToString(",")).putString("lanManual", "1").apply()
        }
        _state.value = _state.value.copy(lan = ok.joinToString(", "))
        return null
    }

    private fun saveTokens(o: JSONObject) {
        prefs.edit().putString("access", o.getString("access")).putString("refresh", o.getString("refresh")).apply()
    }

    private fun refresh(): Boolean {
        val rt = prefs.getString("refresh", null) ?: return false
        val (code, o) = post("/api/auth/refresh", JSONObject().put("refresh", rt), auth = false)
        if (code != 200) return false
        saveTokens(o)
        return true
    }

    /** GET/POST with one transparent token refresh on 401. */
    private fun call(block: () -> Pair<Int, JSONObject>): Pair<Int, JSONObject> {
        var r = block()
        if (r.first == 401 && refresh()) r = block()
        return r
    }

    /** Streaming GET for server-sent events (no timeouts, caller closes it). Renews the token once on 401. */
    fun openStream(path: String): okhttp3.Response {
        val c = http.newBuilder().callTimeout(0, TimeUnit.SECONDS).readTimeout(0, TimeUnit.SECONDS).build()
        fun req() = Request.Builder().url(base() + path).header("x-lomu-device", "android").header("Accept", "text/event-stream")
            .apply { prefs.getString("access", null)?.let { header("Authorization", "Bearer $it") } }.build()
        var r = c.newCall(req()).execute()
        if (r.code == 401 && refresh()) { r.close(); r = c.newCall(req()).execute() }
        return r
    }

    /**
     * The server's own stream proxy for [id], with a bearer token that is good for at least a minute.
     * Playback falls back to it when this phone cannot resolve a YouTube stream itself (bot checks, cipher
     * changes, flaky mobile networks): the server does the resolving and the phone only plays the bytes.
     * Blocking; call from an IO thread. Null when not signed in or the token cannot be renewed.
     */
    fun streamFallback(id: String): Pair<String, String>? {
        if (!signedIn) return null
        val exp = runCatching {
            val payload = prefs.getString("access", null)!!.split('.')[1]
            JSONObject(String(android.util.Base64.decode(payload, android.util.Base64.URL_SAFE or android.util.Base64.NO_PADDING))).getLong("exp")
        }.getOrDefault(0L)
        if (exp * 1000 - System.currentTimeMillis() < 60_000 && !runCatching { refresh() }.getOrDefault(false)) return null
        val token = prefs.getString("access", null) ?: return null
        return (base() + "/api/stream/" + id) to token
    }

    /** Authenticated JSON POST that returns the HTTP status. */
    fun postAuthed(path: String, body: JSONObject): Int = call { post(path, body, auth = true) }.first

    /** Quick reachability check for the sign-in screen: asks the server who it is. */
    suspend fun ping(url: String): Pair<Boolean, String> = withContext(Dispatchers.IO) {
        val u = url.trim().trimEnd('/')
        if (!u.startsWith("https://") && !u.startsWith("http://")) return@withContext false to "Start the address with https://"
        try {
            val quick = http.newBuilder().callTimeout(10, TimeUnit.SECONDS).build()
            quick.newCall(Request.Builder().url("$u/api/auth/status").build()).execute().use { r ->
                val body = r.body?.string().orEmpty()
                if (r.code != 200) return@withContext false to "The server answered ${r.code}. Is this the LoMu address?"
                val o = JSONObject(body.ifBlank { "{}" })
                true to if (o.optBoolean("setup")) "Server is up. Sign in with your account." else "Server is up. Create your account (you need the setup code)."
            }
        } catch (e: Exception) {
            false to "Can't reach the server (${e.javaClass.simpleName}). Check the address and that you have internet."
        }
    }

    suspend fun signIn(url: String, user: String, password: String, create: Boolean) = withContext(Dispatchers.IO) {
        _state.value = _state.value.copy(busy = true, error = null, serverUrl = url)
        try {
            prefs.edit().putString("url", url.trim().trimEnd('/')).apply()
            val (code, o) = post(
                if (create) "/api/auth/setup" else "/api/auth/login",
                JSONObject().put("username", user).put("password", password),
                auth = false,
            )
            if (code != 200) {
                _state.value = _state.value.copy(busy = false, error = o.optString("error", "Sign-in failed ($code)"))
                return@withContext
            }
            // Another person's account signing in on this phone: what is stored here belongs to the previous one, and
            // would be uploaded into the new account. That data is safe on the server under its own account.
            val previous = prefs.getString("dataOwner", null)
            if (previous != null && !previous.equals(user.trim(), ignoreCase = true)) {
                database.delegate.clearAllTables()
                prefs.edit().remove("liked").remove("lastEvent").remove("plSnap").remove("savedSnap").remove("queueJson").remove("queueAt")
                    .remove("queuePushedAt").remove("queueSeenAt").remove("queueSig").remove("remoteQueue").apply()
                _remoteQueue.value = null
            }
            saveTokens(o)
            prefs.edit().putString("user", user).putString("dataOwner", user.trim()).putLong("seq", 0).apply()
            learnLan()
            _state.value = _state.value.copy(busy = false, user = user, status = "Signed in")
        } catch (e: Exception) {
            _state.value = _state.value.copy(busy = false, error = friendlyError(e))
        }
    }

    fun signOut() {
        prefs.edit().remove("access").remove("refresh").remove("user").remove("seq").remove("liked").remove("lastEvent").remove("plSnap").remove("savedSnap").remove("queueJson").remove("queueAt").remove("queuePushedAt").remove("queueSeenAt").remove("queueSig").remove("remoteQueue").apply()
        _remoteQueue.value = null
        _state.value = _state.value.copy(user = null, status = "Not signed in", error = null)
    }

    /** Pull what other devices changed, then push our own changes. Safe to call often. */
    suspend fun sync() = lock.withLock {
        if (!signedIn) return@withLock
        withContext(Dispatchers.IO) {
            try {
                _state.value = _state.value.copy(status = "Syncing…")
                if (prefs.getString("dataOwner", null) == null) prefs.getString("user", null)?.let { prefs.edit().putString("dataOwner", it).apply() } // installs from before accounts were separate
                if (prefs.getString("lan", null) == null && System.currentTimeMillis() - prefs.getLong("lanTried", 0) > 6 * 3600_000L) learnLan()
                // One-time repair of plays that earlier versions inserted twice (they inflated this phone's totals).
                if (!prefs.getBoolean("evDedupe1", false)) {
                    database.deleteDuplicateEvents()
                    prefs.edit().putBoolean("evDedupe1", true).apply()
                }
                pull()
                // Drain a large play backlog in batches.
                for (i in 0 until 10) {
                    val before = prefs.getLong("lastEvent", 0)
                    push()
                    if (prefs.getLong("lastEvent", 0) == before) break
                }
                _state.value = _state.value.copy(status = "Up to date · ${java.text.DateFormat.getTimeInstance(java.text.DateFormat.SHORT).format(java.util.Date())}", error = null)
            } catch (e: Exception) {
                _state.value = _state.value.copy(status = "Sync failed", error = friendlyError(e))
            }
        }
    }

    private suspend fun pull() {
        while (true) {
            val since = prefs.getLong("seq", 0)
            val (code, o) = call { get("/api/sync?since=$since") }
            if (code != 200) error("server said $code")
            val docs = o.getJSONArray("docs")
            if (docs.length() == 0) return
            for (i in 0 until docs.length()) apply(docs.getJSONObject(i))
            savedIdsCache = null
            prefs.edit().putLong("seq", o.getLong("seq")).apply()
            if (docs.length() < 2000) return
        }
    }

    private suspend fun apply(d: JSONObject) {
        when (d.getString("kind")) {
            "like" -> {
                val deleted = d.optBoolean("deleted")
                val id = d.getString("key")
                val v = d.optJSONObject("value")
                database.withTransaction {
                    if (!deleted && v != null && song(id).first() == null) trackToMetadata(v.getJSONObject("track"))?.let { insert(it) }
                    val s = song(id).first()?.song ?: return@withTransaction
                    if (!deleted && !s.liked) update(s.copy(liked = true, likedDate = LocalDateTime.now(), inLibrary = s.inLibrary ?: LocalDateTime.now()))
                    if (deleted && s.liked) update(s.copy(liked = false, likedDate = null))
                }
            }
            "playlist" -> applyPlaylist(d)
            "saved" -> applySaved(d)
            "queue" -> applyQueue(d)
            "block" -> applyBlock(d)
            "play" -> {
                if (d.optBoolean("deleted")) return
                val v = d.optJSONObject("value") ?: return
                val track = v.optJSONObject("track") ?: return
                val id = track.getString("id")
                database.withTransaction {
                    if (song(id).first() == null) trackToMetadata(track)?.let { insert(it) }
                    if (song(id).first() != null) {
                        val at = LocalDateTime.ofInstant(Instant.ofEpochMilli(v.getLong("at")), ZoneId.systemDefault())
                        // The play log is append-only and every play has a global id (instant + song), so applying
                        // the same play twice (own writes echoed back, a re-pull after reinstall) must be a no-op.
                        if (eventExists(id, at) == 0) insert(Event(songId = id, timestamp = at, playTime = v.optLong("playedMs")))
                    }
                }
            }
        }
    }

    // ---- Playlists. Only the user's own (local, editable) playlists sync; the phone's database stays the
    // source of truth, so everything works offline and a change made while the server is away is
    // simply pushed on the next successful sync. `plSnap` remembers what the server last agreed on.

    private fun playlistSnapshot() = runCatching { JSONObject(prefs.getString("plSnap", null) ?: "{}") }.getOrDefault(JSONObject())

    private fun playlistSig(p: com.lomu.app.db.entities.PlaylistEntity, songs: List<com.lomu.app.db.entities.Song>) =
        p.name + "|" + songs.joinToString(",") { it.song.id }

    /** id -> (playlist, its songs in order) for every playlist that takes part in sync. */
    private suspend fun syncedPlaylists(): List<Pair<String, Pair<com.lomu.app.db.entities.PlaylistEntity, List<com.lomu.app.db.entities.Song>>>> =
        database.playlists(com.lomu.app.constants.PlaylistSortType.CREATE_DATE, true).first()
            .filter { it.playlist.isLocal && it.playlist.isEditable && it.playlist.bookmarkedAt != null }
            .map { pl -> pl.playlist.id to (pl.playlist to database.playlistSongs(pl.playlist.id).first().map { it.song }) }

    private suspend fun applyPlaylist(d: JSONObject) {
        val id = d.getString("key")
        val snap = playlistSnapshot()
        val local = database.playlist(id).first()?.playlist
        val localSongs = if (local != null) database.playlistSongs(id).first().map { it.song } else emptyList()
        // Edited on this phone since the last sync: keep ours, the push below sends it.
        if (local != null && snap.optString(id) != playlistSig(local, localSongs)) return
        if (d.optBoolean("deleted")) {
            if (local != null) database.withTransaction { delete(local) }
            prefs.edit().putString("plSnap", snap.apply { remove(id) }.toString()).apply()
            return
        }
        val v = d.optJSONObject("value") ?: return
        val tracks = v.optJSONArray("tracks") ?: JSONArray()
        val zone = ZoneId.systemDefault()
        fun at(ms: Long) = LocalDateTime.ofInstant(Instant.ofEpochMilli(ms), zone)
        val name = v.optString("name", "Playlist")
        database.withTransaction {
            val entity = (local ?: com.lomu.app.db.entities.PlaylistEntity(id = id, name = name, isLocal = true, bookmarkedAt = LocalDateTime.now()))
                .copy(name = name, createdAt = at(v.optLong("createdAt", d.optLong("updated"))), lastUpdateTime = at(v.optLong("updatedAt", d.optLong("updated"))))
            if (local == null) insert(entity) else update(entity)
            clearPlaylist(id)
            var pos = 0
            val ids = ArrayList<String>()
            for (i in 0 until tracks.length()) {
                val t = tracks.getJSONObject(i)
                val sid = t.optString("id")
                if (sid.isBlank() || sid in ids) continue
                if (song(sid).first() == null) trackToMetadata(t)?.let { insert(it) }
                if (song(sid).first() == null) continue
                insert(com.lomu.app.db.entities.PlaylistSongMap(playlistId = id, songId = sid, position = pos++))
                ids += sid
            }
            snap.put(id, entity.name + "|" + ids.joinToString(","))
        }
        prefs.edit().putString("plSnap", snap.toString()).apply()
    }

    // ---- Saved albums, artists and YouTube playlists (the web's "Save" button). The phone's database
    // stays the source of truth: a save or un-save made here while the server is away is pushed on the next
    // successful sync, and `savedSnap` remembers what the server last agreed on (id -> kind).

    private class SavedNow(val kind: String, val item: JSONObject, val at: Long)

    private var savedIdsCache: MutableSet<String>? = null

    private fun savedSnapshot() = runCatching { JSONObject(prefs.getString("savedSnap", null) ?: "{}") }.getOrDefault(JSONObject())

    private suspend fun savedNow(): Map<String, SavedNow> {
        val zone = ZoneId.systemDefault()
        fun ms(t: LocalDateTime?) = t?.atZone(zone)?.toInstant()?.toEpochMilli() ?: System.currentTimeMillis()
        val out = LinkedHashMap<String, SavedNow>()
        database.albumsLikedByCreateDateAsc().first().filter { !it.album.isLocal }.forEach { a ->
            val e = a.album
            val artists = JSONArray()
            a.artists.forEach { ar -> artists.put(JSONObject().apply { if (ar.isYouTubeArtist) put("id", ar.id); put("name", ar.name) }) }
            val item = JSONObject().put("kind", "album").put("id", e.id).put("title", e.title).put("artists", artists)
            e.year?.let { item.put("year", it.toString()) }
            e.thumbnailUrl?.let { item.put("thumb", it) }
            out[e.id] = SavedNow("album", item, ms(e.bookmarkedAt))
        }
        database.artistsBookmarkedByCreateDateAsc().first().filter { it.artist.isYouTubeArtist && !it.artist.isLocal }.forEach { a ->
            val e = a.artist
            val item = JSONObject().put("kind", "artist").put("id", e.id).put("title", e.name)
            e.thumbnailUrl?.let { item.put("thumb", it) }
            out[e.id] = SavedNow("artist", item, ms(e.bookmarkedAt))
        }
        database.playlists(com.lomu.app.constants.PlaylistSortType.CREATE_DATE, true).first()
            .filter { !it.playlist.isLocal && it.playlist.bookmarkedAt != null && it.playlist.browseId != null }.forEach { p ->
                val e = p.playlist
                val id = e.browseId!!.removePrefix("VL")
                val item = JSONObject().put("kind", "playlist").put("id", id).put("title", e.name)
                e.thumbnailUrl?.let { item.put("thumb", it) }
                out[id] = SavedNow("playlist", item, ms(e.bookmarkedAt))
            }
        return out
    }

    private suspend fun applySaved(d: JSONObject) {
        val id = d.getString("key")
        val snap = savedSnapshot()
        val ids = savedIdsCache ?: savedNow().keys.toMutableSet().also { savedIdsCache = it }
        // Saved or removed on this phone since the last sync: keep ours, the push below sends it.
        if ((id in ids) != snap.has(id)) return
        if (d.optBoolean("deleted")) {
            database.withTransaction {
                album(id).first()?.album?.let { if (it.bookmarkedAt != null) update(it.copy(bookmarkedAt = null)) }
                artist(id).first()?.artist?.let { if (it.bookmarkedAt != null) update(it.copy(bookmarkedAt = null)) }
                playlist(id).first()?.playlist?.let { if (!it.isLocal && it.bookmarkedAt != null) update(it.copy(bookmarkedAt = null)) }
            }
            ids.remove(id)
            prefs.edit().putString("savedSnap", snap.apply { remove(id) }.toString()).apply()
            return
        }
        val v = d.optJSONObject("value") ?: return
        val item = v.optJSONObject("item") ?: return
        val kind = item.optString("kind")
        val title = item.optString("title").ifBlank { return }
        val thumb = item.optString("thumb").ifBlank { null }
        val at = LocalDateTime.ofInstant(Instant.ofEpochMilli(v.optLong("at", d.optLong("updated"))), ZoneId.systemDefault())
        database.withTransaction {
            when (kind) {
                "album" -> {
                    val e = album(id).first()?.album
                    if (e == null) {
                        insert(com.lomu.app.db.entities.AlbumEntity(id = id, title = title, year = item.optString("year").toIntOrNull(), thumbnailUrl = thumb, songCount = 0, duration = 0, bookmarkedAt = at))
                        val artists = item.optJSONArray("artists") ?: JSONArray()
                        var order = 0
                        for (i in 0 until artists.length()) {
                            val a = artists.getJSONObject(i)
                            val aid = a.optString("id").ifBlank { null } ?: continue
                            insert(com.lomu.app.db.entities.ArtistEntity(id = aid, name = a.optString("name")))
                            insert(com.lomu.app.db.entities.AlbumArtistMap(albumId = id, artistId = aid, order = order++))
                        }
                    } else if (e.bookmarkedAt == null) update(e.copy(bookmarkedAt = at))
                }
                "artist" -> {
                    val e = artist(id).first()?.artist
                    if (e == null) insert(com.lomu.app.db.entities.ArtistEntity(id = id, name = title, thumbnailUrl = thumb, bookmarkedAt = at))
                    else if (e.bookmarkedAt == null) update(e.copy(bookmarkedAt = at))
                }
                "playlist" -> {
                    val e = playlist(id).first()?.playlist
                    if (e == null) insert(com.lomu.app.db.entities.PlaylistEntity(id = id, name = title, browseId = id, isEditable = false, isLocal = false, thumbnailUrl = thumb, bookmarkedAt = at))
                    else if (!e.isLocal && e.bookmarkedAt == null) update(e.copy(bookmarkedAt = at))
                }
            }
        }
        if (kind == "album" || kind == "artist" || kind == "playlist") {
            ids.add(id)
            prefs.edit().putString("savedSnap", snap.put(id, kind).toString()).apply()
        }
    }

    // ---- Queue: one document ("current") holding what the most recent device was playing, so any other
    // device can offer "continue where you left off". It is never applied automatically (that would cut
    // off whatever is playing); Home shows it and the user taps to take it over.

    /** Called by the player service whenever it saves its queue. Cheap; the next sync uploads it. */
    fun noteQueue(items: List<MediaMetadata>, index: Int, positionMs: Long, playing: Boolean) {
        if (!signedIn || items.isEmpty()) return
        val sig = index.toString() + ":" + items.joinToString(",") { it.id }
        // A restored queue at app start has the same content as last time: do not call it fresh activity.
        if (sig == prefs.getString("queueSig", null) && !playing) return
        val from = if (items.size <= 100) 0 else (index - 10).coerceIn(0, items.size - 100)
        val tracks = JSONArray().also { a -> items.subList(from, minOf(items.size, from + 100)).forEach { a.put(metadataToTrack(it)) } }
        val at = System.currentTimeMillis()
        val v = JSONObject().put("tracks", tracks).put("index", index - from).put("positionMs", positionMs)
            .put("at", at).put("dev", deviceId()).put("device", "android")
        prefs.edit().putString("queueJson", v.toString()).putLong("queueAt", at).putString("queueSig", sig).apply()
    }

    private fun parseRemoteQueue(v: JSONObject): RemoteQueue? {
        val arr = v.optJSONArray("tracks") ?: return null
        val tracks = (0 until arr.length()).mapNotNull { trackToMetadata(arr.getJSONObject(it)) }
        if (tracks.isEmpty()) return null
        return RemoteQueue(v.optString("device", "another device"), tracks, v.optInt("index", 0).coerceIn(0, tracks.size - 1), v.optLong("positionMs"), v.optLong("at"))
    }

    private fun applyQueue(d: JSONObject) {
        if (d.getString("key") != "current") return
        if (d.optBoolean("deleted")) {
            prefs.edit().remove("remoteQueue").apply()
            _remoteQueue.value = null
            return
        }
        val v = d.optJSONObject("value") ?: return
        if (v.optString("dev") == deviceId()) return
        val at = v.optLong("at")
        if (at <= maxOf(prefs.getLong("queueAt", 0), prefs.getLong("queueSeenAt", 0))) return // ours, or already handled, is newer
        prefs.edit().putString("remoteQueue", v.toString()).apply()
        _remoteQueue.value = parseRemoteQueue(v)
    }

    /** The user took the other device's queue over (or dismissed it): stop offering it. */
    fun dismissRemoteQueue() {
        val at = _remoteQueue.value?.at ?: return
        prefs.edit().remove("remoteQueue").putLong("queueSeenAt", at).apply()
        _remoteQueue.value = null
    }

    private suspend fun push() {
        val docs = JSONArray()
        val now = System.currentTimeMillis()

        // Likes: diff against what the server last heard from us.
        val liked = database.likedSongs(SongSortType.CREATE_DATE, true).first()
        val likedIds = liked.map { it.song.id }.toSet()
        val before = prefs.getStringSet("liked", null)
        if (before == null || before != likedIds) {
            liked.filter { before == null || it.song.id !in before }.forEach { s ->
                val at = s.song.likedDate?.atZone(ZoneId.systemDefault())?.toInstant()?.toEpochMilli() ?: now
                docs.put(doc("like", s.song.id, JSONObject().put("track", songToTrack(s)).put("at", at), at, false))
            }
            before?.filter { it !in likedIds }?.forEach { docs.put(doc("like", it, null, now, true)) }
        }

        // Plays: events newer than the last one pushed.
        val lastEvent = prefs.getLong("lastEvent", 0)
        // Oldest first, in batches: the cursor only moves past what was sent, so a big backlog drains over a few
        // syncs instead of the older plays being silently skipped (they never reached the web before).
        val events = database.events().first().filter { it.event.id > lastEvent }.sortedBy { it.event.id }.take(2000)
        events.forEach { e ->
            val at = e.event.timestamp.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
            val dur = e.song.song.duration * 1000L
            // Plays imported from a Takeout history carry no song length: two minutes heard counts as finished.
            val completed = if (dur > 0) e.event.playTime >= dur * 0.85 else e.event.playTime >= 100_000
            val v = JSONObject().put("track", songToTrack(e.song)).put("at", at).put("playedMs", e.event.playTime)
                .put("completed", completed).put("skipped", !completed && e.event.playTime < 30_000)
            docs.put(doc("play", "$at:${e.song.song.id}", v, at, false))
        }
        // Blocked artists: diff against what the server last heard from us.
        val blockedNow = JSONObject(prefs.getString("blocked", null) ?: "{}")
        val blockBefore = prefs.getStringSet("blockSnap", null)
        blockedNow.keys().forEach { k ->
            if (blockBefore == null || k !in blockBefore) docs.put(doc("block", k, blockedNow.getJSONObject(k), blockedNow.getJSONObject(k).optLong("at", now), false))
        }
        blockBefore?.filter { !blockedNow.has(it) }?.forEach { docs.put(doc("block", it, null, now, true)) }
        val blockKeys = blockedNow.keys().asSequence().toSet()
        val plSnap = playlistSnapshot()
        val plNow = syncedPlaylists().associate { it.first to it.second }
        val plSigs = JSONObject()
        plNow.forEach { (id, pl) -> plSigs.put(id, playlistSig(pl.first, pl.second)) }
        plNow.forEach { (id, pl) ->
            if (plSnap.optString(id) != plSigs.getString(id)) {
                val tracks = JSONArray().also { a -> pl.second.forEach { a.put(songToTrack(it)) } }
                val created = pl.first.createdAt?.atZone(ZoneId.systemDefault())?.toInstant()?.toEpochMilli() ?: now
                val v = JSONObject().put("id", id).put("name", pl.first.name).put("tracks", tracks).put("createdAt", created).put("updatedAt", now)
                docs.put(doc("playlist", id, v, now, false))
            }
        }
        plSnap.keys().forEach { id -> if (id !in plNow) docs.put(doc("playlist", id, null, now, true)) }

        // Saved albums / artists / playlists: diff against what the server last heard from us.
        val savedSnap = savedSnapshot()
        val savedCur = savedNow()
        savedCur.forEach { (id, sv) ->
            if (!savedSnap.has(id)) docs.put(doc("saved", id, JSONObject().put("item", sv.item).put("at", sv.at), sv.at, false))
        }
        savedSnap.keys().forEach { id -> if (id !in savedCur) docs.put(doc("saved", id, null, now, true)) }
        val savedSigs = JSONObject().also { o -> savedCur.forEach { (id, sv) -> o.put(id, sv.kind) } }

        // The queue this phone is playing (see noteQueue).
        val queueAt = prefs.getLong("queueAt", 0)
        val queueJson = prefs.getString("queueJson", null)
        val queueDue = queueJson != null && queueAt > prefs.getLong("queuePushedAt", 0)
        if (queueDue) docs.put(doc("queue", "current", JSONObject(queueJson!!), queueAt, false))
        if (docs.length() == 0) return

        val (code, o) = call { post("/api/sync", JSONObject().put("docs", docs), auth = true) }
        if (code != 200) error("push failed ($code)")
        prefs.edit().putString("plSnap", plSigs.toString()).putString("savedSnap", savedSigs.toString())
            .apply { if (queueDue) putLong("queuePushedAt", queueAt) }.apply()
        // Our own writes are the next seq numbers; skip them so they are not pulled back.
        val seq = prefs.getLong("seq", 0)
        val edit = prefs.edit().putStringSet("liked", likedIds).putStringSet("blockSnap", blockKeys).putLong("lastEvent", events.lastOrNull()?.event?.id ?: lastEvent)
        if (o.optLong("seq") - seq == o.optLong("applied")) edit.putLong("seq", o.getLong("seq"))
        edit.apply()
    }

    /** [why] maps a track id to its "why this song?" line (mixes only). */
    data class RecShelf(val title: String, val subtitle: String?, val tracks: List<MediaMetadata>, val why: Map<String, String> = emptyMap())

    // ---- Artists the user never wants recommended: lower-case name -> {name, at}, kept in prefs and synced as 'block' docs.

    /** The blocked artists (lower-case names). Home watches this, so blocking takes effect on screen at once. */
    val blocked = kotlinx.coroutines.flow.MutableStateFlow<Set<String>>(blockedArtists().keys)

    fun blockedArtists(): Map<String, String> = runCatching {
        val o = JSONObject(prefs.getString("blocked", null) ?: "{}")
        o.keys().asSequence().associateWith { o.getJSONObject(it).optString("name", it) }
    }.getOrDefault(emptyMap())

    private fun writeBlocked(o: JSONObject) {
        prefs.edit().putString("blocked", o.toString()).apply()
        blocked.value = o.keys().asSequence().toSet()
    }

    fun blockArtist(name: String) {
        val o = JSONObject(prefs.getString("blocked", null) ?: "{}")
        o.put(name.trim().lowercase(), JSONObject().put("name", name.trim()).put("at", System.currentTimeMillis()))
        writeBlocked(o)
    }

    fun unblockArtist(key: String) {
        val o = JSONObject(prefs.getString("blocked", null) ?: "{}")
        o.remove(key)
        writeBlocked(o)
    }

    private fun applyBlock(d: JSONObject) {
        val o = JSONObject(prefs.getString("blocked", null) ?: "{}")
        val key = d.getString("key")
        val v = d.optJSONObject("value")
        if (d.optBoolean("deleted") || v == null) o.remove(key) else o.put(key, v)
        writeBlocked(o)
    }

    /** Short fingerprint of the block list: part of every cache key, so blocking an artist rebuilds the day's mixes. */
    private fun blockSig(b: Set<String>): String {
        var h = 5381
        for (c in b.sorted().joinToString("|")) h = (h shl 5) + h + c.code
        return if (b.isEmpty()) "0" else Integer.toUnsignedString(h, 36)
    }

    /** Nothing by a blocked artist is ever shown, whatever an older cached shelf holds. */
    fun hideBlocked(shelves: List<RecShelf>, blocked: Set<String>): List<RecShelf> =
        if (blocked.isEmpty()) shelves else shelves.map { sh -> sh.copy(tracks = sh.tracks.filter { !blockedTrack(blocked, it) }) }.filter { it.tracks.isNotEmpty() }

    /**
     * Personalised shelves, computed on the phone from its own play log and likes (which sync keeps
     * merged with the web player's). Candidates come from YouTube radio, so nothing here needs the
     * homelab. The last good result is cached, so with no connection at all Home still shows it.
     */
    suspend fun recs(): List<RecShelf> = withContext(Dispatchers.IO) {
        val cached = loadRecsCache()
        val built = runCatching { buildRecs() }.getOrNull()
        when {
            built == null || built.isEmpty() -> cached
            else -> { saveRecsCache(built); built }
        }
    }

    private suspend fun buildRecs(): List<RecShelf> {
        val liked = database.likedSongs(SongSortType.CREATE_DATE, true).first()
        val likes = liked.mapNotNull { s ->
            val m = trackToMetadata(songToTrack(s)) ?: return@mapNotNull null
            LikeDoc(m, s.song.likedDate?.atZone(ZoneId.systemDefault())?.toInstant()?.toEpochMilli() ?: System.currentTimeMillis())
        }
        val plays = database.events().first().take(12000).mapNotNull { e ->
            val m = trackToMetadata(songToTrack(e.song)) ?: return@mapNotNull null
            val dur = e.song.song.duration * 1000L
            // Plays imported from a Takeout history carry no song length: two minutes heard counts as finished.
            val completed = if (dur > 0) e.event.playTime >= dur * 0.85 else e.event.playTime >= 100_000
            PlayDoc(m, e.event.timestamp.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli(), e.event.playTime,
                completed, !completed && e.event.playTime < 30_000)
        }
        if (plays.isEmpty() && likes.isEmpty()) return emptyList()

        val aff = affinity(plays, likes, System.currentTimeMillis(), blockedArtists().keys)
        val seeds = aff.topTracks.take(5)
        var radioOk = false
        val cands = radios(seeds).also { m -> radioOk = m.values.any { it.isNotEmpty() } }
        val shelves = ArrayList<RecShelf>()
        if (radioOk) {
            val ranked = rankCandidates(seeds, cands, aff)
            shelves.addAll(dailyPlaylists(aff))
            discoverWeeklyShelf(aff)?.let { shelves.add(it) }
            shelves.addAll(timeOfDay(aff, plays))
            shelves.addAll(momentsAndRewind(aff))
            if (aff.onRepeat.isNotEmpty()) shelves.add(RecShelf("On Repeat", "Your last 30 days", aff.onRepeat.take(50)))
            for (seed in seeds.take(3)) {
                val list = diversify(cands[seed.id].orEmpty().filter { it.id !in aff.heavilyPlayed && it.id !in aff.skipped && !blockedTrack(aff.blocked, it) }, 2).take(15)
                if (list.size >= 5) shelves.add(RecShelf("Because you played ${seed.title}", null, list))
            }
            val fresh = ranked.filter { t -> t.artists.all { it.name.lowercase() !in aff.knownArtists } }
            val discover = diversify(fresh, 1).take(20)
            if (discover.size >= 5) shelves.add(RecShelf("Discover", "Artists you have not played yet", discover))
        } // else: offline, so return nothing and let recs() fall back to the cached full set
        return hideBlocked(shelves, aff.blocked)
    }

    private suspend fun radios(seeds: List<MediaMetadata>): Map<String, List<MediaMetadata>> = seeds.associate { seed ->
        seed.id to (runCatching {
            com.music.innertube.YouTube.next(com.music.innertube.models.WatchEndpoint(videoId = seed.id, playlistId = "RDAMVM${seed.id}"))
                .getOrThrow().items.map { it.toMediaMetadata() }.filter { it.id != seed.id }.take(30)
        }.getOrNull() ?: emptyList())
    }

    private fun tracksJson(l: List<MediaMetadata>) = JSONArray().also { a -> l.forEach { a.put(metadataToTrack(it)) } }
    private fun tracksFrom(a: JSONArray) = (0 until a.length()).mapNotNull { trackToMetadata(a.getJSONObject(it)) }

    private fun shelfJson(sh: RecShelf) = JSONObject().put("title", sh.title).put("subtitle", sh.subtitle ?: JSONObject.NULL)
        .put("items", tracksJson(sh.tracks)).put("why", JSONObject(sh.why as Map<*, *>))

    private fun shelfFrom(o: JSONObject): RecShelf {
        val w = o.optJSONObject("why")
        return RecShelf(o.getString("title"), o.optString("subtitle").ifBlank { null }, tracksFrom(o.getJSONArray("items")),
            w?.keys()?.asSequence()?.associateWith { w.getString(it) } ?: emptyMap())
    }

    private fun shelvesFrom(json: String?): List<RecShelf> = runCatching {
        val arr = JSONArray(json ?: return emptyList())
        (0 until arr.length()).map { shelfFrom(arr.getJSONObject(it)) }.filter { it.tracks.isNotEmpty() }
    }.getOrDefault(emptyList())

    private fun shelvesJson(l: List<RecShelf>) = JSONArray().also { a -> l.forEach { a.put(shelfJson(it)) } }.toString()

    /** Discover Weekly: one playlist a week of artists never played, kept until Monday (or a big history import, or a new block). */
    private suspend fun discoverWeeklyShelf(aff: Affinity): RecShelf? {
        val week = weekKey(System.currentTimeMillis())
        val key = "$week/${aff.playCount / 1000}/${blockSig(aff.blocked)}"
        if (prefs.getString("dwKey2", null) == key) shelvesFrom(prefs.getString("dwShelf", null)).firstOrNull()?.let { return it }
        val cands = radios(aff.topTracks.take(20))
        if (cands.values.all { it.isEmpty() }) return null
        val picked = discoverWeekly(aff, cands, week)
        if (picked.items.isEmpty()) return null
        val shelf = RecShelf("Discover Weekly", "Artists new to you · changes every Monday", picked.items, picked.why)
        prefs.edit().putString("dwKey2", key).putString("dwShelf", shelvesJson(listOf(shelf))).apply()
        return shelf
    }

    /** Repeat Rewind (history only) and the mood mixes (YouTube radios, built once a day). */
    private suspend fun momentsAndRewind(aff: Affinity): List<RecShelf> {
        val now = System.currentTimeMillis()
        val out = ArrayList<RecShelf>()
        val rw = repeatRewind(aff, weekKey(now))
        if (rw.items.isNotEmpty()) out.add(RecShelf("Repeat Rewind", "Songs you loved, a while ago", rw.items, rw.why))
        val plan = moodPlan(aff)
        if (plan.isNotEmpty()) {
            val key = "${dayKey(now)}/${aff.playCount / 1000}/${blockSig(aff.blocked)}"
            var moods = if (prefs.getString("momKey", null) == key) shelvesFrom(prefs.getString("momShelves", null)) else emptyList()
            if (moods.isEmpty()) {
                val cands = radios(plan.flatMap { it.seeds }.distinctBy { it.id })
                if (cands.values.any { it.isNotEmpty() }) {
                    moods = moodMixes(aff, plan, cands, dayKey(now)).map { RecShelf(it.title, it.subtitle, it.items, it.why) }
                    if (moods.isNotEmpty()) prefs.edit().putString("momKey", key).putString("momShelves", shelvesJson(moods)).apply()
                }
            }
            out.addAll(moods)
        }
        return out
    }

    /** Morning / Afternoon / Evening / Late Night mixes from what is played in each part of the day; built once a day, ordered by "right now" when read. */
    private suspend fun timeOfDay(aff: Affinity, plays: List<PlayDoc>): List<RecShelf> {
        val now = System.currentTimeMillis()
        val key = dayKey(now) + "/" + (aff.playCount / 1000) + "/" + blockSig(aff.blocked)
        var built: List<TimeMix>? = null
        if (prefs.getString("todKey2", null) == key) {
            built = runCatching {
                val arr = JSONArray(prefs.getString("todMixes2", "[]"))
                (0 until arr.length()).map { i ->
                    val o = arr.getJSONObject(i)
                    val sh = shelfFrom(o)
                    TimeMix(SlotId.valueOf(o.getString("slot")), sh.title, sh.subtitle.orEmpty(), sh.tracks, sh.why)
                }
            }.getOrNull()
        }
        if (built == null) {
            val slots = slotAffinities(plays, now, aff.blocked)
            val seeds = slots.flatMap { it.second.topTracks.take(4) }.distinctBy { it.id }
            val cands = radios(seeds)
            if (seeds.isNotEmpty() && cands.values.all { it.isEmpty() }) return emptyList()
            built = timeMixes(aff, slots, cands, dayKey(now))
            if (built.isNotEmpty()) {
                val arr = JSONArray()
                built.forEach { arr.put(shelfJson(RecShelf(it.title, it.subtitle, it.items, it.why)).put("slot", it.slot.name)) }
                prefs.edit().putString("todKey2", key).putString("todMixes2", arr.toString()).apply()
            }
        }
        return orderByNow(built, java.time.LocalTime.now().hour).map { RecShelf(it.title, it.subtitle, it.items, it.why) }
    }

    /** Five themed mixes, built once per calendar day and kept. Each one is a taste cluster of the top tracks. */
    private suspend fun dailyPlaylists(aff: Affinity): List<RecShelf> {
        // The day plus a history-size bucket and the block list: a big import or a new block rebuilds today's mixes.
        val day = dayKey(System.currentTimeMillis()) + "/" + (aff.playCount / 1000) + "/" + blockSig(aff.blocked)
        fun read() = shelvesFrom(prefs.getString("dailyMixes6", "[]"))
        // A full set is kept for the day; a short one (radio failed for some seeds) is retried, at most every 10 minutes.
        val have = read()
        if (prefs.getString("dailyDay6", null) == day && have.size >= 5) return have
        if (have.isNotEmpty() && prefs.getString("dailyTryDay6", null) == day && System.currentTimeMillis() - prefs.getLong("dailyTryAt6", 0) < 600_000) return have
        prefs.edit().putString("dailyTryDay6", day).putLong("dailyTryAt6", System.currentTimeMillis()).apply()
        val cands = radios(aff.topTracks.take(20))
        if (cands.values.all { it.isEmpty() }) return read() // offline: yesterday's set stays
        val shelves = dailyMixes(aff, cands, day).map { RecShelf(it.title, it.subtitle, it.items, it.why) }
        if (shelves.isNotEmpty()) {
            prefs.edit().putString("dailyDay6", if (shelves.size >= 5) day else "").putString("dailyMixes6", shelvesJson(shelves)).apply()
        }
        return shelves
    }

    private fun saveRecsCache(shelves: List<RecShelf>) {
        prefs.edit().putString("recsCache2", shelvesJson(shelves)).apply()
    }

    fun cachedRecs(): List<RecShelf> = loadRecsCache()

    private fun loadRecsCache(): List<RecShelf> = hideBlocked(shelvesFrom(prefs.getString("recsCache2", null)), blocked.value)

    private fun doc(kind: String, key: String, value: JSONObject?, updated: Long, deleted: Boolean) =
        JSONObject().put("kind", kind).put("key", key).put("value", value ?: JSONObject.NULL).put("updated", updated).put("deleted", deleted)

    fun metadataToTrack(m: MediaMetadata): JSONObject {
        val artists = JSONArray()
        m.artists.forEach { artists.put(JSONObject().put("id", it.id ?: JSONObject.NULL).put("name", it.name)) }
        val t = JSONObject().put("kind", "song").put("id", m.id).put("title", m.title).put("artists", artists)
        if (m.duration > 0) t.put("duration", m.duration)
        m.thumbnailUrl?.let { t.put("thumb", it) }
        m.album?.let { t.put("album", JSONObject().put("id", it.id).put("name", it.title)) }
        return t
    }

    private fun songToTrack(s: com.lomu.app.db.entities.Song): JSONObject {
        val artists = JSONArray()
        s.artists.forEach { artists.put(JSONObject().put("id", it.channelId ?: JSONObject.NULL).put("name", it.name)) }
        val t = JSONObject().put("kind", "song").put("id", s.song.id).put("title", s.song.title).put("artists", artists)
        if (s.song.duration > 0) t.put("duration", s.song.duration)
        s.song.thumbnailUrl?.let { t.put("thumb", it) }
        s.album?.let { t.put("album", JSONObject().put("id", it.id).put("name", it.title)) }
        return t
    }

    fun trackToMetadata(t: JSONObject): MediaMetadata? = runCatching {
        val artists = t.optJSONArray("artists") ?: JSONArray()
        val a = (0 until artists.length()).map { artists.getJSONObject(it) }
        MediaMetadata(
            id = t.getString("id"),
            title = t.getString("title"),
            artists = a.map { MediaMetadata.Artist(it.optString("id").ifBlank { null }.takeIf { id -> id != "null" }, it.getString("name")) },
            duration = t.optInt("duration", -1),
            thumbnailUrl = t.optString("thumb").ifBlank { null },
            album = t.optJSONObject("album")?.let { al -> al.optString("id").takeIf { it.isNotBlank() && it != "null" }?.let { MediaMetadata.Album(it, al.getString("name")) } },
        )
    }.getOrNull()
}


/** A message a person can act on, instead of the raw exception text (HTML error pages, TLS internals, stack-style messages). */
fun friendlyError(e: Throwable?): String {
    val raw = e?.message.orEmpty()
    return when {
        e is java.net.UnknownHostException -> "Can't find the server. Check your connection."
        e is java.net.SocketTimeoutException || raw.contains("timeout", ignoreCase = true) -> "The server took too long to answer. Try again in a moment."
        e is javax.net.ssl.SSLException || raw.contains("SSL", ignoreCase = true) -> "Couldn't make a secure connection to the server. Try again in a moment."
        e is java.io.IOException -> "Can't reach the server. Check your connection."
        raw.contains("<html", ignoreCase = true) || raw.contains("JSONObject") || raw.contains("JSONArray") -> "The server isn't answering properly right now. Try again in a moment."
        raw.isBlank() -> "Something went wrong. Try again."
        else -> raw.take(140)
    }
}
