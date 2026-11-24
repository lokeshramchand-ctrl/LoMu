package com.lomu.app.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Devices
import androidx.compose.ui.graphics.Brush
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.room.withTransaction
import com.lomu.app.constants.SongSortType
import com.lomu.app.db.entities.PlaylistEntity
import com.lomu.app.extensions.toMediaItem
import com.lomu.app.models.MediaMetadata
import com.lomu.app.models.toMediaMetadata
import com.music.innertube.YouTube
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.launch
import java.time.LocalDateTime

/* The "Soundwaves" look: a white page, black ink, soft pastel cards, one black feature card, round grey buttons.
   Home, Collections (the library) and Create live here; the player screens are not part of this file. */

/** Pastel fill for the nth card, so neighbouring cards differ. */
@Composable
internal fun tileColor(i: Int): Color = LocalLo.current.tiles[Math.floorMod(i, LocalLo.current.tiles.size)]

/** Round grey icon button (bell, search, close in the reference). */
@Composable
internal fun RoundBtn(icon: ImageVector, label: String, onClick: () -> Unit, size: Dp = 44.dp) {
    val lo = LocalLo.current
    Box(Modifier.size(size).a11y(label).background(lo.surface2, CircleShape).pressable(CircleShape, onClick = onClick), Alignment.Center) { IcV(icon, 20.dp, lo.ink) }
}

/** Page title in bold sans with round controls on the right. */
@Composable
internal fun SoundTitle(title: String, sub: String? = null, trailing: @Composable RowScope.() -> Unit = {}) {
    val lo = LocalLo.current
    Row(Modifier.fillMaxWidth().statusBarsPadding().padding(start = 20.dp, end = 16.dp, top = 14.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, style = LoType.hero, color = lo.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (sub != null) Text(sub, style = LoType.small, color = lo.grey, modifier = Modifier.padding(top = 2.dp))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically, content = trailing)
    }
}

@Composable
private fun SoundSection(text: String, modifier: Modifier = Modifier) {
    Text(text, style = LoType.section, color = LocalLo.current.ink, modifier = modifier.padding(start = 20.dp, end = 20.dp, top = 26.dp, bottom = 12.dp))
}

// ======================================================================================= Home

@Composable
fun HomeScreen() {
    val player = LocalPlayer.current
    val nav = LocalNav.current
    val liked = likedSongs()
    val now = playingId()
    val sync = LocalSync.current
    val openDevices = LocalOpenDevices.current
    val fallback = remember { kotlinx.coroutines.flow.MutableStateFlow(com.lomu.app.sync.SyncState()) }
    val syncState by (sync?.state ?: fallback).collectAsState()
    val noQueue = remember { kotlinx.coroutines.flow.MutableStateFlow<com.lomu.app.sync.SyncClient.RemoteQueue?>(null) }
    val remoteQueue by (sync?.remoteQueue ?: noQueue).collectAsState()
    val lo = LocalLo.current
    // Start from the cached shelves so Home does not flash the open feed before the personal picks are built.
    var recsLoaded by remember { mutableStateOf(sync == null) }
    val recsRaw by produceState<List<com.lomu.app.sync.SyncClient.RecShelf>>(
        remember { runCatching { sync?.cachedRecs() }.getOrNull().orEmpty() }, syncState.user, syncState.status.startsWith("Up to date"),
    ) {
        value = runCatching { sync?.recs() }.getOrNull().orEmpty()
        recsLoaded = true
    }
    // Blocking an artist hides them at once, before the next rebuild of the mixes.
    val blockedNow by (sync?.blocked ?: remember { kotlinx.coroutines.flow.MutableStateFlow(emptySet<String>()) }).collectAsState()
    val recs = remember(recsRaw, blockedNow) { sync?.hideBlocked(recsRaw, blockedNow) ?: recsRaw }
    val state by load("home") { YouTube.home() }
    val sleep = lastSleep()

    val likedMeta = remember(liked) { liked.take(50).map { it.toMediaMetadata() } }
    val onRepeat = recs.firstOrNull { it.title == "On Repeat" }?.tracks ?: likedMeta.take(50)
    // Everything that is not "On Repeat", flattened and de-duplicated: the feature card and the pastel tiles come from here.
    val picks = remember(recs, likedMeta) {
        val fromRecs = recs.filter { it.title != "On Repeat" }.flatMap { it.tracks }.distinctBy { it.id }
        if (fromRecs.size >= 3) fromRecs else (fromRecs + likedMeta).distinctBy { it.id }
    }
    val feature = picks.firstOrNull()
    val mixes = remember(recs) { recs.filter { it.title.startsWith("Daily Mix") } }
    // Discover Weekly and the four time-of-day mixes: a second set of tiles under the daily mixes.
    val moodMixes = remember(recs) { recs.filter { Regex("^(Repeat Rewind|Slowed & Reverb|Unplugged & Acoustic|Instrumentals & Themes)$").matches(it.title) } }
    val dayMixes = remember(recs) { recs.filter { it.title == "Discover Weekly" || Regex("^(Morning|Afternoon|Evening|Late Night) Mix$").matches(it.title) } }

    // The page takes the colour of the playing song's cover, as the player does, fading to white lower down.
    val noMeta = remember { kotlinx.coroutines.flow.MutableStateFlow<MediaMetadata?>(null) }
    val cur by (player?.mediaMetadata ?: noMeta).collectAsState()
    Box(Modifier.fillMaxSize().background(lo.bg)) {
    CoverWash(cur?.thumbnailUrl)
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = bottomPad())) {
        item {
            Row(Modifier.fillMaxWidth().statusBarsPadding().padding(start = 20.dp, end = 16.dp, top = 14.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Spacer(Modifier.weight(1f))
                Row(Modifier.background(lo.surface2, CircleShape).padding(3.dp), horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(38.dp).a11y("Devices").pressable(CircleShape) { openDevices() }, Alignment.Center) { IcV(Icons.Rounded.Devices, 22.dp, lo.ink) }
                    Avatar(syncState.user?.take(2) ?: "LM", { nav.push(Screen.Settings) }, size = 38.dp)
                }
            }
        }
        if (sleep != null) item { SleepCard(sleep) }
        val resume = remoteQueue
        if (resume != null) item {
            val first = resume.tracks[resume.index]
            val ctx = LocalContext.current
            Column {
                SoundSection("Continue listening")
                Box(Modifier.padding(horizontal = 20.dp)) {
                    MediaRow(first.title, "From ${resume.device} · " + first.artists.joinToString { it.name }, first.thumbnailUrl, separator = false, pad = 0.dp) {
                        player?.let { pc ->
                            pc.playQueue(com.lomu.app.playback.queues.ListQueue(title = "Continue", items = resume.tracks.map { it.toMediaItem() }, startIndex = resume.index))
                            val at = resume.positionMs
                            sync?.dismissRemoteQueue()
                            if (at > 2_000) pc.player.let { p ->
                                // The queue is handed to the player service asynchronously: seek once it has the song.
                                android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({ if (p.currentMediaItem?.mediaId == first.id) p.seekTo(at) }, 800)
                            }
                        } ?: android.widget.Toast.makeText(ctx, "Player is starting", android.widget.Toast.LENGTH_SHORT).show()
                    }
                }
                Text("Dismiss", style = LoType.small, color = lo.grey, modifier = Modifier.padding(start = 20.dp, bottom = 4.dp).pressable { sync?.dismissRemoteQueue() })
            }
        }
        if (feature != null) item { FeatureCard(feature) }
        if (onRepeat.isNotEmpty()) item {
            Column(Modifier.appear(2)) {
                Row(Modifier.fillMaxWidth().pressable(RoundedCornerShape(0.dp)) { MixStore.title = "On Repeat"; MixStore.why = emptyMap(); MixStore.tracks = onRepeat; nav.push(Screen.Mix) }.padding(start = 20.dp, end = 20.dp, top = 26.dp, bottom = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("On Repeat", style = LoType.section, color = lo.ink)
                    Spacer(Modifier.width(6.dp))
                    Ic(Ph.Right, 18.dp, lo.grey)
                }
                LazyRow(contentPadding = PaddingValues(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    items(onRepeat.take(50), key = { it.id }) { m ->
                        val at = onRepeat.indexOf(m)
                        Column(Modifier.width(92.dp).pressable(RoundedCornerShape(4.dp)) { player?.playMediaItems("On Repeat", onRepeat.map { it.toMediaItem() }, at) }) {
                            Cover(m.thumbnailUrl, 92.dp, radius = 18.dp)
                            Text(m.title, style = LoType.small.copy(fontSize = 13.sp), color = lo.ink, fontWeight = if (now == m.id) FontWeight.Bold else FontWeight.Normal, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 6.dp))
                        }
                    }
                }
            }
        }
        if (mixes.isNotEmpty()) item { MixTiles("Mixes", mixes, 0) }
        if (dayMixes.isNotEmpty()) item { MixTiles("For your day", dayMixes, 1) }
        if (moodMixes.isNotEmpty()) item { MixTiles("Moods and throwbacks", moodMixes, 2) }
        // Until the personal picks arrive (or when signed out) fall back to the open feed.
        if (recs.isEmpty() && liked.isEmpty() && !recsLoaded) item { SkeletonShelves() }
        else if (recs.isEmpty() && liked.isEmpty()) when (val st = state) {
            is Load.Loading -> item { SkeletonShelves() }
            is Load.Err -> item { ErrorBox(st.message, st.retry) }
            is Load.Ok -> items(st.value.sections.take(3)) { Shelf(it.title, it.items) }
        }
    }
    }
}

/** The black card: cover, title, artist, a heart and a round play button. */
@Composable
private fun FeatureCard(m: MediaMetadata) {
    val lo = LocalLo.current
    val player = LocalPlayer.current
    val sync = LocalSync.current
    val scope = rememberCoroutineScope()
    val db = player?.database
    val row by remember(m.id) { db?.song(m.id) ?: flowOf(null) }.collectAsState(null)
    val liked = row?.song?.liked == true
    val shape = RoundedCornerShape(28.dp)
    val onCard = Color.White
    Box(Modifier.padding(horizontal = 20.dp, vertical = 8.dp).fillMaxWidth().background(lo.feature, shape).pressable(shape) { player?.playRadio(m) }) {
        Row(Modifier.padding(14.dp)) {
            Cover(m.thumbnailUrl, 112.dp, radius = 18.dp)
            Spacer(Modifier.width(16.dp))
            Column(Modifier.weight(1f).height(112.dp), verticalArrangement = Arrangement.SpaceBetween) {
                Column {
                    Text(m.title, style = LoType.body.copy(fontWeight = FontWeight.SemiBold), color = onCard, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Text(m.artists.joinToString { it.name }, style = LoType.small, color = onCard.copy(alpha = 0.62f), maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 2.dp))
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(40.dp).a11y(if (liked) "Remove from Liked Songs" else "Like").pressable(CircleShape) {
                        val d = db ?: return@pressable
                        scope.launch(Dispatchers.IO) {
                            d.withTransaction {
                                insert(m)
                                song(m.id).first()?.song?.let { s ->
                                    val n = s.localToggleLike()
                                    update(if (n.liked) n.copy(inLibrary = n.inLibrary ?: LocalDateTime.now()) else n)
                                }
                            }
                            sync?.sync()
                        }
                    }, Alignment.CenterStart) { IcV((if (liked) Ph.HeartFill else Ph.Heart).vector, 22.dp, onCard) }
                    Spacer(Modifier.weight(1f))
                    Box(Modifier.size(44.dp).a11y("Play").background(Color.White, CircleShape), Alignment.Center) { IcV(Ph.Play.vector, 20.dp, Color(0xFF0A0A0A)) }
                }
            }
        }
    }
}

/** Big pastel tile with round art, the title and the artist underneath. */
@Composable
private fun PickTile(title: String, subtitle: String, thumb: String?, fill: Color, modifier: Modifier, onClick: () -> Unit) {
    val lo = LocalLo.current
    val shape = RoundedCornerShape(26.dp)
    Column(modifier.background(fill, shape).pressable(shape, onClick = onClick).padding(horizontal = 12.dp, vertical = 16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        BoxWithConstraints(Modifier.fillMaxWidth(), Alignment.Center) { Cover(thumb, maxWidth * 0.86f, round = true) }
        Text(title, style = LoType.body.copy(fontWeight = FontWeight.Medium, fontSize = 16.sp), color = lo.ink, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 12.dp))
        Text(subtitle, style = LoType.small, color = lo.grey, maxLines = 2, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center)
    }
}

// =================================================================================== Collections

@Composable
fun LibraryScreen() {
    val lo = LocalLo.current
    val nav = LocalNav.current
    val player = LocalPlayer.current
    val songs = likedSongs()
    val playlists = playlistsState()
    val albumsFlow = remember(player) { player?.database?.albumsLikedByCreateDateAsc() ?: flowOf(emptyList()) }
    val albums = albumsFlow.collectAsState(emptyList()).value.filter { !it.album.isLocal }
    val artistsFlow = remember(player) { player?.database?.artistsBookmarkedByCreateDateAsc() ?: flowOf(emptyList()) }
    val artists = artistsFlow.collectAsState(emptyList()).value.filter { it.artist.isYouTubeArtist && !it.artist.isLocal }
    var filter by remember { mutableStateOf(0) }

    // One card: art, name, a grey line. Round art for artists.
    class Card(val title: String, val line: String, val thumb: String?, val round: Boolean = false, val go: () -> Unit)
    val liked = if (songs.isEmpty()) emptyList() else listOf(Card("Liked Songs", "${songs.size} tracks", songs.first().song.thumbnailUrl) { nav.push(Screen.Liked) })
    val lists = playlists.map { p ->
        Card(p.playlist.name, "${p.songCount} tracks", p.playlist.thumbnailUrl ?: p.thumbnails.firstOrNull()) {
            if (p.playlist.isLocal) nav.push(Screen.LocalPlaylist(p.playlist.id)) else nav.push(Screen.Playlist(p.playlist.browseId ?: p.playlist.id))
        }
    }
    val albumCards = albums.map { a -> Card(a.album.title, a.artists.joinToString { it.name }, a.album.thumbnailUrl) { nav.push(Screen.Album(a.album.id)) } }
    val artistCards = artists.map { a -> Card(a.artist.name, "Artist", a.artist.thumbnailUrl, round = true) { nav.push(Screen.Artist(a.artist.id)) } }
    val shown = when (filter) { 1 -> lists; 2 -> albumCards; 3 -> artistCards; else -> liked + lists }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = bottomPad())) {
        item {
            SoundTitle("Collections", "${playlists.size} ${if (playlists.size == 1) "playlist" else "playlists"}   ${songs.size} liked ${if (songs.size == 1) "song" else "songs"}") {
                RoundBtn(Ph.Search.vector, "Search", { nav.tab(Screen.Search) })
            }
        }
        item { Spacer(Modifier.height(14.dp)); Chips(listOf("All", "Playlists", "Albums", "Artists"), filter, { filter = it }); Spacer(Modifier.height(18.dp)) }
        if (shown.isEmpty()) item {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                EmptyState(Ph.Library, if (filter == 0) "Nothing here yet" else "Nothing saved here", "Like songs from the player, make a playlist on the Create tab, or bring your library over from YouTube Music.")
                Pill("Import from YouTube Music", { nav.push(Screen.Import) }, accent = true, icon = Ph.Download)
            }
        }
        val rows = shown.chunked(2)
        items(rows.size) { r ->
            Row(Modifier.padding(horizontal = 20.dp).padding(bottom = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                rows[r].forEachIndexed { c, card ->
                    val shape = RoundedCornerShape(24.dp)
                    Column(Modifier.weight(1f).background(tileColor(r * 2 + c), shape).pressable(shape, onClick = card.go).padding(horizontal = 12.dp, vertical = 18.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        BoxWithConstraints(Modifier.fillMaxWidth(), Alignment.Center) { Cover(card.thumb, maxWidth * 0.72f, round = card.round, radius = 16.dp) }
                        Text(card.title, style = LoType.body.copy(fontWeight = FontWeight.Medium, fontSize = 16.sp), color = lo.ink, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 12.dp))
                        Text(card.line, style = LoType.small, color = lo.grey, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center)
                    }
                }
                if (rows[r].size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

// ======================================================================================= Create

@Composable
fun CreateScreen() {
    val lo = LocalLo.current
    val nav = LocalNav.current
    val player = LocalPlayer.current
    val sync = LocalSync.current
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf("") }

    fun create() {
        val d = player?.database ?: return
        val n = name.trim().ifBlank { return }
        scope.launch {
            val pl = PlaylistEntity(name = n, bookmarkedAt = LocalDateTime.now(), isLocal = true)
            kotlinx.coroutines.withContext(Dispatchers.IO) { d.withTransaction { insert(pl) } }
            runCatching { sync?.sync() }
            name = ""
            android.widget.Toast.makeText(ctx, "Created $n", android.widget.Toast.LENGTH_SHORT).show()
            nav.push(Screen.LocalPlaylist(pl.id))
        }
    }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = bottomPad())) {
        item { SoundTitle("Create", "Make something new") }
        item {
            val shape = RoundedCornerShape(26.dp)
            Column(Modifier.padding(horizontal = 20.dp, vertical = 14.dp).fillMaxWidth().background(tileColor(0), shape).padding(18.dp)) {
                Text("New playlist", style = LoType.section, color = lo.ink)
                Text("Give it a name, then add songs from any song menu.", style = LoType.small, color = lo.grey, modifier = Modifier.padding(top = 2.dp, bottom = 14.dp))
                Row(Modifier.fillMaxWidth().height(50.dp).background(lo.bg, CircleShape).padding(horizontal = 18.dp), verticalAlignment = Alignment.CenterVertically) {
                    BasicTextField(
                        value = name, onValueChange = { name = it.take(60) }, singleLine = true,
                        textStyle = LoType.body.copy(color = lo.ink), cursorBrush = SolidColor(lo.ink),
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(imeAction = androidx.compose.ui.text.input.ImeAction.Done),
                        keyboardActions = androidx.compose.foundation.text.KeyboardActions(onDone = { create() }),
                        modifier = Modifier.weight(1f),
                        decorationBox = { inner -> if (name.isEmpty()) Text("Playlist name", style = LoType.body, color = lo.grey); inner() },
                    )
                }
                Spacer(Modifier.height(12.dp))
                Pill("Create playlist", { create() }, accent = true, modifier = Modifier.fillMaxWidth())
            }
        }
        item {
            Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                CreateCard(Ph.Download, "Import from YouTube Music", "Bring your playlists and likes over.", tileColor(1)) { nav.push(Screen.Import) }
                CreateCard(Ph.Sparkles, "New releases", "What is new on YouTube Music.", tileColor(2)) { nav.push(Screen.New) }
                CreateCard(Ph.Sparkles, "Wrapped", "Your year in music: top songs, artists and habits.", tileColor(0)) { nav.push(Screen.Wrapped) }
                CreateCard(Ph.Moon, "Sleep", "See when the queue kept going after you dozed off.", tileColor(3)) { nav.push(Screen.Sleep) }
                CreateCard(Ph.Settings, "Settings", "Account, sync and appearance.", lo.surface2) { nav.push(Screen.Settings) }
            }
        }
    }
}

@Composable
private fun CreateCard(icon: Ph, title: String, line: String, fill: Color, onClick: () -> Unit) {
    val lo = LocalLo.current
    val shape = RoundedCornerShape(22.dp)
    Row(Modifier.fillMaxWidth().background(fill, shape).pressable(shape, onClick = onClick).padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(44.dp).background(lo.bg, CircleShape), Alignment.Center) { Ic(icon, 22.dp, lo.ink) }
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = LoType.body.copy(fontWeight = FontWeight.SemiBold), color = lo.ink)
            Text(line, style = LoType.small, color = lo.grey)
        }
        Ic(Ph.Right, 18.dp, lo.grey)
    }
}

/** Two-column grid of coloured mix tiles; each opens the mix as an album-style page. */
@Composable
private fun MixTiles(heading: String, shelves: List<com.lomu.app.sync.SyncClient.RecShelf>, appearAt: Int) {
    val nav = LocalNav.current
    Column(Modifier.appear(3 + appearAt)) {
        SoundSection(heading)
        Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            shelves.chunked(2).forEachIndexed { r, row ->
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    row.forEachIndexed { c, mix ->
                        PickTile(mix.title, mix.subtitle.orEmpty(), mix.tracks.firstOrNull()?.thumbnailUrl, tileColor(r * 2 + c), Modifier.weight(1f)) {
                            MixStore.title = mix.title; MixStore.tracks = mix.tracks; MixStore.why = mix.why; nav.push(Screen.Mix)
                        }
                    }
                    if (row.size == 1) Spacer(Modifier.weight(1f))
                }
            }
        }
    }
}
