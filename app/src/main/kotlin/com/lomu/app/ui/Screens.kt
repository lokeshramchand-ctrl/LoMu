package com.lomu.app.ui

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lomu.app.constants.PlaylistSortType
import com.lomu.app.constants.SongSortType
import com.lomu.app.db.entities.Song
import com.lomu.app.extensions.toMediaItem
import com.lomu.app.playback.queues.YouTubeQueue
import com.music.innertube.YouTube
import com.music.innertube.models.ArtistItem
import com.music.innertube.models.SongItem
import com.music.innertube.models.WatchEndpoint
import com.music.innertube.models.YTItem
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private fun greeting(): String {
    val h = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
    return when { h < 5 -> "Late night"; h < 12 -> "Good morning"; h < 18 -> "Good afternoon"; else -> "Good evening" }
}

@Composable
private fun likedSongs(): List<Song> {
    val player = LocalPlayer.current
    val flow = remember(player) { player?.database?.likedSongs(SongSortType.CREATE_DATE, true) ?: flowOf(emptyList()) }
    val songs by flow.collectAsState(emptyList())
    return songs
}

// ======================================================================================= Home

@Composable
fun HomeScreen() {
    val lo = LocalLo.current
    val state by load("home") { YouTube.home() }
    val player = LocalPlayer.current
    val recent = likedSongs().take(8)
    val now = playingId()
    val sync = LocalSync.current
    val fallback = remember { kotlinx.coroutines.flow.MutableStateFlow(com.lomu.app.sync.SyncState()) }
    val syncState by (sync?.state ?: fallback).collectAsState()
    val recs by produceState<List<com.lomu.app.sync.SyncClient.RecShelf>>(emptyList(), syncState.user, syncState.status.startsWith("Up to date")) {
        value = runCatching { sync?.recs() }.getOrNull().orEmpty()
    }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 24.dp)) {
        item {
            Column(Modifier.statusBarsPadding().padding(start = 20.dp, end = 20.dp, top = 20.dp)) {
                Eyebrow(SimpleDateFormat("EEEE, MMMM d", Locale.getDefault()).format(Date()))
                Text(
                    buildAnnotatedString {
                        append(greeting())
                        syncState.user?.let { withStyle(SpanStyle(color = lo.grey)) { append(", $it") } }
                    },
                    style = LoType.hero, color = lo.ink, modifier = Modifier.padding(top = 2.dp),
                )
                Text("Your music, picked from what you play and like.", style = LoType.body, color = lo.grey, modifier = Modifier.padding(top = 4.dp))
            }
        }
        if (recent.isNotEmpty()) item {
            Column {
                SectionTitle("Quick picks", action = "Play all") { player?.playMediaItems("Liked", recent.map { it.toMediaItem() }) }
                Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    recent.withIndex().chunked(2).forEach { pair ->
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            pair.forEach { (i, s) ->
                                QuickTile(s.song.title, s.song.thumbnailUrl, now == s.song.id, Modifier.weight(1f)) {
                                    player?.playMediaItems("Liked", recent.map { it.toMediaItem() }, i)
                                }
                            }
                            if (pair.size == 1) Spacer(Modifier.weight(1f))
                        }
                    }
                }
            }
        }
        items(recs) { shelf ->
            Column {
                SectionTitle(shelf.title)
                LazyRow(contentPadding = PaddingValues(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    items(shelf.tracks) { m ->
                        MediaCard(m.thumbnailUrl, m.title, m.artists.joinToString { it.name }, now == m.id) {
                            player?.playQueue(YouTubeQueue(WatchEndpoint(videoId = m.id), m))
                        }
                    }
                }
            }
        }
        when (val st = state) {
            is Load.Loading -> item { Loading() }
            is Load.Err -> item { ErrorBox(st.message) }
            is Load.Ok -> items(st.value.sections) { Shelf(it.title, it.items) }
        }
    }
}

// ===================================================================================== Search

private val TRY_SEARCHES = listOf("Top hits India", "Lo-fi beats", "Workout", "Arijit Singh", "Anirudh", "Chill vibes", "Punjabi", "90s Bollywood")

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SearchScreen() {
    val lo = LocalLo.current
    val ctx = LocalContext.current
    val prefs = remember { ctx.getSharedPreferences("lomu", Context.MODE_PRIVATE) }
    var recent by remember { mutableStateOf(prefs.getString("recent", "").orEmpty().split('\u0001').filter { it.isNotBlank() }) }
    var text by remember { mutableStateOf("") }
    var submitted by remember { mutableStateOf("") }
    var filter by remember { mutableStateOf(0) }
    var suggestions by remember { mutableStateOf<List<String>>(emptyList()) }
    fun submit(q: String) {
        val v = q.trim()
        if (v.isBlank()) return
        text = v; submitted = v; filter = 0; suggestions = emptyList()
        recent = (listOf(v) + recent.filter { !it.equals(v, true) }).take(8)
        prefs.edit().putString("recent", recent.joinToString("\u0001")).apply()
    }
    LaunchedEffect(text) {
        if (text.isBlank()) { suggestions = emptyList(); return@LaunchedEffect }
        delay(250)
        if (text != submitted) suggestions = YouTube.searchSuggestions(text).getOrNull()?.queries.orEmpty().take(6)
    }
    val result by load(submitted) {
        if (submitted.isBlank()) Result.success(null) else YouTube.searchSummary(submitted).map { it }
    }
    val open = rememberOpen()
    Column(Modifier.fillMaxSize()) {
        PageTitle("Discover", "Search")
        SearchField(text, { text = it; if (it.isBlank()) submitted = "" }, "Songs, artists, albums", { submit(text) }, Modifier.padding(horizontal = 20.dp, vertical = 8.dp))
        val summaries = when (val r0 = result) { is Load.Ok -> r0.value?.summaries.orEmpty(); else -> emptyList() }
        if (submitted.isNotBlank() && suggestions.isEmpty() && summaries.isNotEmpty()) {
            Spacer(Modifier.height(4.dp))
            Chips(listOf("All") + summaries.map { it.title }, filter, { filter = it })
        }
        LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
            if (suggestions.isNotEmpty()) {
                items(suggestions) { q ->
                    Row(Modifier.fillMaxWidth().pressable(RoundedCornerShape(0.dp)) { submit(q) }.padding(horizontal = 24.dp, vertical = 13.dp), verticalAlignment = Alignment.CenterVertically) {
                        Ic(Ph.Search, 18.dp, lo.grey)
                        Spacer(Modifier.width(14.dp))
                        Text(q, style = LoType.body, color = lo.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            } else if (submitted.isBlank()) {
                item {
                    Column {
                        if (recent.isNotEmpty()) {
                            SectionTitle("Recent searches", action = "Clear") {
                                recent = emptyList(); prefs.edit().remove("recent").apply()
                            }
                            FlowRow(Modifier.padding(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                recent.forEach { r -> SuggestChip(r, Ph.History) { submit(r) } }
                            }
                        }
                        SectionTitle("Try searching for")
                        FlowRow(Modifier.padding(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            TRY_SEARCHES.forEach { r -> SuggestChip(r, Ph.Search) { submit(r) } }
                        }
                    }
                }
            } else when (val r = result) {
                is Load.Loading -> item { Loading() }
                is Load.Err -> item { ErrorBox(r.message) }
                is Load.Ok -> {
                    val sums = r.value?.summaries.orEmpty()
                    if (sums.isEmpty()) item { EmptyState(Ph.Search, "Nothing found for “$submitted”", "Try a different spelling, or search for the artist.") }
                    val shown = if (filter == 0) sums.map { it to 5 } else listOfNotNull(sums.getOrNull(filter - 1)?.let { it to 50 })
                    shown.forEach { (sum, limit) ->
                        item { SectionTitle(sum.title, action = if (filter == 0 && sum.items.size > limit) "See all" else null) { filter = sums.indexOf(sum) + 1 } }
                        items(sum.items.take(limit)) { it ->
                            if (it is SongItem) TrackRow(it) { open(it) } else ResultRow(it) { open(it) }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SuggestChip(text: String, icon: Ph, onClick: () -> Unit) {
    val lo = LocalLo.current
    Row(
        Modifier.background(lo.card, androidx.compose.foundation.shape.CircleShape).border(1.dp, lo.border2, androidx.compose.foundation.shape.CircleShape)
            .pressable(androidx.compose.foundation.shape.CircleShape, onClick = onClick).padding(horizontal = 14.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Ic(icon, 14.dp, lo.grey); Spacer(Modifier.width(8.dp))
        Text(text, style = LoType.small.copy(fontSize = 13.5.sp), color = lo.ink)
    }
}

@Composable
fun ResultRow(item: YTItem, onClick: () -> Unit) {
    val lo = LocalLo.current
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 8.dp).pressable(RoundedCornerShape(14.dp), onClick = onClick).padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Cover(item.thumbnail, 50.dp, round = item is ArtistItem, radius = 10.dp)
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(item.title, style = LoType.body, color = lo.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(subtitle(item), style = LoType.small, color = lo.grey, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Ic(Ph.Right, 16.dp, lo.grey)
    }
}

// ==================================================================================== Library

@Composable
fun LibraryScreen() {
    val lo = LocalLo.current
    val player = LocalPlayer.current
    val songs = likedSongs()
    val nav = LocalNav.current
    val now = playingId()
    var tab by remember { mutableStateOf(0) }
    val plFlow = remember(player) { player?.database?.playlists(PlaylistSortType.CREATE_DATE, true) ?: flowOf(emptyList()) }
    val playlists by plFlow.collectAsState(emptyList())
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 24.dp)) {
        item {
            PageTitle("Library", "Your library", "${songs.size} liked songs · ${playlists.size} playlists")
            Spacer(Modifier.height(10.dp))
            Chips(listOf("Liked ${songs.size}", "Playlists ${playlists.size}"), tab, { tab = it })
        }
        if (tab == 0) {
            if (songs.isNotEmpty()) item {
                Row(Modifier.padding(horizontal = 20.dp, vertical = 16.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Pill("Play", { player?.playMediaItems("Liked", songs.map { it.toMediaItem() }) }, icon = Ph.Play)
                    Pill("Shuffle", { player?.playMediaItems("Liked", songs.shuffled().map { it.toMediaItem() }) }, filled = false, icon = Ph.Shuffle)
                }
            }
            if (songs.isEmpty()) item {
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                    EmptyState(Ph.Heart, "No liked songs yet", "Tap the heart in the player, or bring your library over from YouTube Music.")
                    Pill("Import from YouTube Music", { nav.push(Screen.Import) }, filled = false, icon = Ph.Download)
                }
            }
            itemsIndexed(songs) { i, s ->
                MediaRow(s.song.title, s.artists.joinToString { it.name }, s.song.thumbnailUrl, active = now == s.song.id) {
                    player?.playMediaItems("Liked", songs.map { it.toMediaItem() }, i)
                }
            }
        } else {
            if (playlists.isEmpty()) item { EmptyState(Ph.Playlist, "No playlists yet", "Playlists you import or create show up here.") }
            item {
                Column(Modifier.padding(horizontal = 20.dp, vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    playlists.chunked(2).forEach { pair ->
                        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                            pair.forEach { p ->
                                Column(Modifier.weight(1f).pressable(RoundedCornerShape(14.dp)) { nav.push(Screen.LocalPlaylist(p.playlist.id)) }) {
                                    BoxWithConstraints { Cover(p.playlist.thumbnailUrl ?: p.thumbnails.firstOrNull(), maxWidth, radius = 14.dp) }
                                    Spacer(Modifier.height(8.dp))
                                    Text(p.playlist.name, style = LoType.body, color = lo.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Text("${p.songCount} songs", style = LoType.small, color = lo.grey)
                                }
                            }
                            if (pair.size == 1) Spacer(Modifier.weight(1f))
                        }
                    }
                }
            }
        }
    }
}

// ================================================================================ Detail pages

/** Shared detail layout: ambient art, big cover, title, actions, then [body] rows. A floating back button sits on top. */
@Composable
private fun Detail(
    eyebrow: String, cover: String?, title: String, line: String,
    round: Boolean = false,
    actions: @Composable RowScope.() -> Unit,
    body: LazyListScope.() -> Unit,
) {
    val lo = LocalLo.current
    val nav = LocalNav.current
    Box(Modifier.fillMaxSize()) {
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 24.dp)) {
            item {
                Box(Modifier.fillMaxWidth()) {
                    Ambient(cover, height = 440.dp)
                    Column(Modifier.fillMaxWidth().statusBarsPadding().padding(top = 64.dp, start = 24.dp, end = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Cover(cover, 220.dp, round = round, radius = 24.dp)
                        Spacer(Modifier.height(20.dp))
                        Eyebrow(eyebrow)
                        Text(title, style = LoType.hero.copy(fontSize = 28.sp, lineHeight = 32.sp), color = lo.ink, textAlign = TextAlign.Center, maxLines = 3, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 4.dp))
                        if (line.isNotBlank()) Text(line, style = LoType.body, color = lo.grey, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 4.dp))
                        Spacer(Modifier.height(18.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), content = actions)
                        Spacer(Modifier.height(12.dp))
                    }
                }
            }
            body()
        }
        TopBar("", nav::pop)
    }
}

@Composable
fun AlbumScreen(id: String) {
    val player = LocalPlayer.current
    val state by load(id) { YouTube.album(id) }
    when (val st = state) {
        is Load.Loading -> Box(Modifier.fillMaxSize()) { Loading(); TopBar("", LocalNav.current::pop) }
        is Load.Err -> Box(Modifier.fillMaxSize()) { ErrorBox(st.message); TopBar("", LocalNav.current::pop) }
        is Load.Ok -> {
            val page = st.value
            Detail("Album", page.album.thumbnail, page.album.title, subtitle(page.album), actions = {
                Pill("Play", { player?.playList(page.album.title, page.songs) }, icon = Ph.Play)
                Pill("Shuffle", { player?.playList(page.album.title, page.songs.shuffled()) }, filled = false, icon = Ph.Shuffle)
            }) {
                itemsIndexed(page.songs) { i, s -> TrackRow(s, index = i) { player?.playList(page.album.title, page.songs, i) } }
            }
        }
    }
}

@Composable
fun PlaylistScreen(id: String) {
    val player = LocalPlayer.current
    val state by load(id) { YouTube.playlist(id) }
    when (val st = state) {
        is Load.Loading -> Box(Modifier.fillMaxSize()) { Loading(); TopBar("", LocalNav.current::pop) }
        is Load.Err -> Box(Modifier.fillMaxSize()) { ErrorBox(st.message); TopBar("", LocalNav.current::pop) }
        is Load.Ok -> {
            val page = st.value
            Detail("Playlist", page.playlist.thumbnail, page.playlist.title, subtitle(page.playlist), actions = {
                Pill("Play", { player?.playPlaylist(id, page.playlist.title, page.songs, page.songsContinuation) }, icon = Ph.Play)
                Pill("Shuffle", { player?.playList(page.playlist.title, page.songs.shuffled()) }, filled = false, icon = Ph.Shuffle)
            }) {
                itemsIndexed(page.songs) { i, s -> TrackRow(s) { player?.playPlaylist(id, page.playlist.title, page.songs, page.songsContinuation, i) } }
            }
        }
    }
}

@Composable
fun ArtistScreen(id: String) {
    val player = LocalPlayer.current
    val lo = LocalLo.current
    val state by load(id) { YouTube.artist(id) }
    var bioOpen by remember { mutableStateOf(false) }
    when (val st = state) {
        is Load.Loading -> Box(Modifier.fillMaxSize()) { Loading(); TopBar("", LocalNav.current::pop) }
        is Load.Err -> Box(Modifier.fillMaxSize()) { ErrorBox(st.message); TopBar("", LocalNav.current::pop) }
        is Load.Ok -> {
            val page = st.value
            val firstSongs = page.sections.map { it.items.filterIsInstance<SongItem>() }.firstOrNull { it.isNotEmpty() }.orEmpty()
            Detail("Artist", page.artist.thumbnail, page.artist.title, page.subscriberCountText.orEmpty(), round = true, actions = {
                if (firstSongs.isNotEmpty()) Pill("Play", { player?.playList(page.artist.title, firstSongs) }, icon = Ph.Play)
                page.artist.radioEndpoint?.let { ep -> Pill("Radio", { player?.playQueue(YouTubeQueue(ep)) }, filled = false, icon = Ph.Radio) }
            }) {
                items(page.sections) { sec ->
                    val songs = sec.items.filterIsInstance<SongItem>()
                    if (songs.isNotEmpty() && songs.size == sec.items.size) {
                        Column {
                            SectionTitle(sec.title)
                            songs.take(5).forEachIndexed { i, s -> TrackRow(s, index = i) { player?.playList(sec.title, songs, i) } }
                        }
                    } else Shelf(sec.title, sec.items)
                }
                page.description?.takeIf { it.isNotBlank() }?.let { d ->
                    item {
                        Column {
                            SectionTitle("About")
                            Column(Modifier.padding(horizontal = 20.dp).fillMaxWidth().background(lo.card, RoundedCornerShape(16.dp)).border(1.dp, lo.line, RoundedCornerShape(16.dp)).padding(16.dp)) {
                                Text(d, style = LoType.body, color = lo.ink, maxLines = if (bioOpen) Int.MAX_VALUE else 4, overflow = TextOverflow.Ellipsis)
                                Text(if (bioOpen) "Show less" else "Read more", style = LoType.small, color = lo.signal, modifier = Modifier.padding(top = 8.dp).pressable { bioOpen = !bioOpen })
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun LocalPlaylistScreen(id: String) {
    val player = LocalPlayer.current
    val plFlow = remember(player) { player?.database?.playlists(PlaylistSortType.CREATE_DATE, true) ?: flowOf(emptyList()) }
    val playlists by plFlow.collectAsState(emptyList())
    val meta = playlists.firstOrNull { it.playlist.id == id }
    val flow = remember(player, id) { player?.database?.playlistSongs(id) ?: flowOf(emptyList()) }
    val rows by flow.collectAsState(emptyList())
    val songs = rows.sortedBy { it.map.position }
    val items = songs.map { it.song.toMediaItem() }
    val now = playingId()
    Detail(
        "Your playlist", meta?.playlist?.thumbnailUrl ?: songs.firstOrNull()?.song?.song?.thumbnailUrl, meta?.playlist?.name ?: "Playlist",
        "${songs.size} songs",
        actions = {
            Pill("Play", { player?.playMediaItems("Playlist", items) }, icon = Ph.Play)
            Pill("Shuffle", { player?.playMediaItems("Playlist", items.shuffled()) }, filled = false, icon = Ph.Shuffle)
        },
    ) {
        if (songs.isEmpty()) item { EmptyState(Ph.Playlist, "This playlist is empty") }
        itemsIndexed(songs) { i, s ->
            MediaRow(s.song.song.title, s.song.artists.joinToString { it.name }, s.song.song.thumbnailUrl, active = now == s.song.song.id) {
                player?.playMediaItems("Playlist", items, i)
            }
        }
    }
}

// =================================================================================== Settings

@Composable
private fun Field(value: String, onChange: (String) -> Unit, hint: String, password: Boolean = false) {
    val lo = LocalLo.current
    val shape = RoundedCornerShape(14.dp)
    Box(Modifier.fillMaxWidth().background(lo.surface2, shape).border(1.dp, lo.line, shape).padding(horizontal = 16.dp, vertical = 14.dp)) {
        BasicTextField(
            value = value, onValueChange = onChange, singleLine = true,
            textStyle = LoType.body.copy(color = lo.ink), cursorBrush = SolidColor(lo.signal),
            visualTransformation = if (password) androidx.compose.ui.text.input.PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
            modifier = Modifier.fillMaxWidth(),
            decorationBox = { inner ->
                if (value.isEmpty()) Text(hint, style = LoType.body, color = lo.grey)
                inner()
            },
        )
    }
}

@Composable
private fun Group(title: String, sub: String? = null, content: @Composable ColumnScope.() -> Unit) {
    val lo = LocalLo.current
    val shape = RoundedCornerShape(18.dp)
    Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp)) {
        Text(title, style = LoType.section, color = lo.ink, modifier = Modifier.padding(top = 22.dp))
        if (sub != null) Text(sub, style = LoType.small, color = lo.grey, modifier = Modifier.padding(top = 2.dp))
        Column(Modifier.padding(top = 10.dp).fillMaxWidth().background(lo.card, shape).border(1.dp, lo.line, shape).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp), content = content)
    }
}

@Composable
private fun InfoRow(icon: Ph, label: String, hint: String? = null, modifier: Modifier = Modifier) {
    val lo = LocalLo.current
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(36.dp).background(lo.surface2, RoundedCornerShape(11.dp)).border(1.dp, lo.line, RoundedCornerShape(11.dp)), Alignment.Center) { Ic(icon, 18.dp) }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(label, style = LoType.body.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold), color = lo.ink)
            if (hint != null) Text(hint, style = LoType.small, color = lo.grey)
        }
    }
}

@Composable
fun SettingsScreen() {
    val lo = LocalLo.current
    val nav = LocalNav.current
    val sync = LocalSync.current
    val scope = rememberCoroutineScope()
    val fallback = remember { kotlinx.coroutines.flow.MutableStateFlow(com.lomu.app.sync.SyncState()) }
    val st by (sync?.state ?: fallback).collectAsState()
    var url by remember(st.serverUrl) { mutableStateOf(st.serverUrl) }
    var user by remember { mutableStateOf("") }
    var pass by remember { mutableStateOf("") }
    var probe by remember { mutableStateOf<Pair<Boolean, String>?>(null) }
    var probing by remember { mutableStateOf(false) }
    LaunchedEffect(url, st.user) {
        if (st.user != null || url.isBlank()) { probe = null; return@LaunchedEffect }
        delay(600)
        probing = true
        probe = sync?.ping(url)
        probing = false
    }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(bottom = 32.dp)) {
        PageTitle("Settings", "Settings", "Account, sync and import.")
        Group("Account & sync", "One owner account on your own LoMu server.") {
            if (st.user != null) {
                InfoRow(Ph.User, "Signed in as ${st.user}", st.status)
                st.error?.let { Text(it, style = LoType.small, color = lo.red) }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Pill("Sync now", { scope.launch { sync?.sync() } }, icon = Ph.Cloud)
                    Pill("Sign out", { sync?.signOut() }, filled = false, icon = Ph.Logout)
                }
            } else {
                Field(url, { url = it }, "Server, e.g. https://lomu.example.com")
                Text(
                    if (probing) "Checking the server…" else probe?.second ?: "",
                    style = LoType.small, color = if (probe?.first == false) lo.red else lo.grey,
                )
                Field(user, { user = it }, "Username")
                Field(pass, { pass = it }, "Password", password = true)
                st.error?.let { Text(it, style = LoType.small, color = lo.red) }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Pill(if (st.busy) "Working…" else "Sign in", { scope.launch { sync?.signIn(url, user, pass, false); sync?.sync() } })
                    Pill("Create account", { scope.launch { sync?.signIn(url, user, pass, true); sync?.sync() } }, filled = false)
                }
            }
        }
        Group("Import") {
            InfoRow(Ph.Download, "From YouTube Music", "Copy your liked songs and playlists once. The Google session is discarded afterwards.")
            Pill("Import from YouTube Music", { nav.push(Screen.Import) }, filled = false)
        }
        Group("About") {
            InfoRow(Ph.Info, "LoMu", "Plays anonymously from YouTube Music. No ads, no Google account.")
        }
    }
}
