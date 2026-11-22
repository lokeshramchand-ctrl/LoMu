package com.lomu.app.ui

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Shuffle
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import com.lomu.app.constants.PlaylistSortType
import com.lomu.app.utils.rememberPreference
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
import kotlinx.coroutines.flow.map
import androidx.room.withTransaction
import com.lomu.app.models.toMediaMetadata
import kotlinx.coroutines.launch

@Composable
internal fun likedSongs(): List<Song> {
    val player = LocalPlayer.current
    val flow = remember(player) { player?.database?.likedSongs(SongSortType.CREATE_DATE, true) ?: flowOf(emptyList()) }
    val songs by flow.collectAsState(emptyList())
    return songs
}

/** Page title row: large bold title on the left, the account avatar on the right (opens Settings). */
@Composable
private fun TitleBar(title: String) {
    val lo = LocalLo.current
    val nav = LocalNav.current
    val sync = LocalSync.current
    val fallback = remember { kotlinx.coroutines.flow.MutableStateFlow(com.lomu.app.sync.SyncState()) }
    val st by (sync?.state ?: fallback).collectAsState()
    Row(Modifier.fillMaxWidth().statusBarsPadding().padding(start = 20.dp, end = 16.dp, top = 14.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(title, style = LoType.hero, color = lo.ink, modifier = Modifier.weight(1f))
        Avatar(st.user?.take(2) ?: "LM", { nav.push(Screen.Settings) })
    }
}

/** Section heading with a grey caption under it, as on "Top Picks for you / Mood for You". */
@Composable
private fun CaptionedTitle(title: String, caption: String?, action: String? = null, onAction: (() -> Unit)? = null) {
    val lo = LocalLo.current
    Row(Modifier.fillMaxWidth().padding(start = 20.dp, end = 12.dp, top = 22.dp, bottom = 10.dp), verticalAlignment = Alignment.Bottom) {
        Column(Modifier.weight(1f)) {
            Text(title, style = LoType.section.copy(fontSize = 20.sp, lineHeight = 25.sp), color = lo.ink)
            if (caption != null) Text(caption, style = LoType.small.copy(fontSize = 14.sp), color = lo.grey)
        }
        if (action != null && onAction != null) {
            Text(action, style = LoType.sub, color = lo.signal, modifier = Modifier.pressable(CircleShape, onClick = onAction).padding(horizontal = 8.dp, vertical = 4.dp))
        }
    }
}

// ======================================================================================= New

@Composable
fun NewScreen() {
    val state by load("home") { YouTube.home() }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = bottomPad())) {
        item { TitleBar("New") }
        when (val st = state) {
            is Load.Loading -> item { SkeletonShelves(3) }
            is Load.Err -> item { ErrorBox(st.message, st.retry) }
            is Load.Ok -> items(st.value.sections) { Shelf(it.title, it.items) }
        }
    }
}

// ===================================================================================== Search

private val TRY_SEARCHES = listOf("Top hits India", "Lo-fi beats", "Workout", "Arijit Singh", "Anirudh", "Chill vibes", "Punjabi", "90s Bollywood")
private val TILE_COLORS = listOf(
    Color(0xFFB45309) to Color(0xFFD97706), Color(0xFF9F3A2B) to Color(0xFFC2523F), Color(0xFF5B6B2F) to Color(0xFF7A8C45),
    Color(0xFF2F6F73) to Color(0xFF3E8C91), Color(0xFF6B3F69) to Color(0xFF8A5788), Color(0xFF3F4D63) to Color(0xFF576884),
    Color(0xFF8A5A2B) to Color(0xFFA9763F), Color(0xFF4F6B58) to Color(0xFF688A74),
)

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
        TitleBar("Search")
        SearchField(text, { text = it; if (it.isBlank()) submitted = "" }, "Search", { submit(text) }, Modifier.padding(horizontal = 20.dp, vertical = 8.dp))
        val summaries = when (val r0 = result) { is Load.Ok -> r0.value?.summaries.orEmpty(); else -> emptyList() }
        if (submitted.isNotBlank() && suggestions.isEmpty() && summaries.isNotEmpty()) {
            Spacer(Modifier.height(4.dp))
            Chips(listOf("All") + summaries.map { it.title }, filter, { filter = it })
        }
        LazyColumn(contentPadding = PaddingValues(bottom = bottomPad())) {
            if (suggestions.isNotEmpty()) {
                items(suggestions) { q ->
                    Column(Modifier.fillMaxWidth().pressable(RoundedCornerShape(0.dp)) { submit(q) }) {
                        Row(Modifier.padding(horizontal = 20.dp, vertical = 13.dp), verticalAlignment = Alignment.CenterVertically) {
                            Ic(Ph.Search, 18.dp, lo.grey)
                            Spacer(Modifier.width(14.dp))
                            Text(q, style = LoType.body, color = lo.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        Hairline(52.dp)
                    }
                }
            } else if (submitted.isBlank()) {
                item {
                    Column {
                        if (recent.isNotEmpty()) {
                            SectionTitle("Recently Searched", action = "Clear") {
                                recent = emptyList(); prefs.edit().remove("recent").apply()
                            }
                            recent.forEach { r ->
                                Column(Modifier.fillMaxWidth().pressable(RoundedCornerShape(0.dp)) { submit(r) }) {
                                    Row(Modifier.padding(horizontal = 20.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                                        Ic(Ph.History, 18.dp, lo.grey)
                                        Spacer(Modifier.width(14.dp))
                                        Text(r, style = LoType.body, color = lo.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    }
                                    Hairline(52.dp)
                                }
                            }
                        }
                    }
                }
            } else when (val r = result) {
                is Load.Loading -> item { SkeletonRows() }
                is Load.Err -> item { ErrorBox(r.message, r.retry) }
                is Load.Ok -> {
                    val sums = r.value?.summaries.orEmpty().let { all ->
                        // The top result should be a song: if the card is an artist/album, lead with the best song match.
                        val top = all.firstOrNull()
                        if (top == null || top.items.firstOrNull() is SongItem) all else {
                            val song = top.items.firstOrNull { it is SongItem }
                                ?: all.drop(1).firstNotNullOfOrNull { s -> s.items.firstOrNull { it is SongItem && !it.isVideoSong } }
                            if (song == null) all
                            else listOf(top.copy(items = listOf(song) + top.items.filter { it.id != song.id })) + all.drop(1)
                        }
                    }
                    if (sums.isEmpty()) item { EmptyState(Ph.Search, "No Results for “$submitted”", "Check the spelling or try a new search.") }
                    val shown = if (filter == 0) sums.map { it to 5 } else listOfNotNull(sums.getOrNull(filter - 1)?.let { it to 50 })
                    shown.forEach { (sum, limit) ->
                        item { SectionTitle(sum.title, action = if (filter == 0 && sum.items.size > limit) "See All" else null, chevron = false, onAction = { filter = sums.indexOf(sum) + 1 }) }
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
private fun CategoryTile(label: String, colors: Pair<Color, Color>, modifier: Modifier, onClick: () -> Unit) {
    val shape = RoundedCornerShape(10.dp)
    Box(
        modifier.height(96.dp).background(androidx.compose.ui.graphics.lerp(colors.first, Color.Black, 0.35f), shape).pressable(shape, onClick = onClick).padding(12.dp),
    ) {
        Text(label, style = LoType.body.copy(fontWeight = FontWeight.Bold), color = Color.White, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
fun ResultRow(item: YTItem, onClick: () -> Unit) {
    val lo = LocalLo.current
    Column(Modifier.fillMaxWidth().pressable(RoundedCornerShape(0.dp), onClick = onClick)) {
        Row(Modifier.padding(start = 20.dp, end = 16.dp, top = 7.dp, bottom = 7.dp), verticalAlignment = Alignment.CenterVertically) {
            Cover(item.thumbnail, 52.dp, round = item is ArtistItem, radius = 6.dp)
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(item.title, style = LoType.body, color = lo.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(subtitle(item), style = LoType.small, color = lo.grey, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Icon(Icons.Rounded.ChevronRight, null, tint = lo.grey.copy(alpha = 0.7f), modifier = Modifier.size(20.dp))
        }
        Hairline(86.dp)
    }
}

// ==================================================================================== Library

@Composable
internal fun playlistsState(): List<com.lomu.app.db.entities.Playlist> {
    val player = LocalPlayer.current
    val plFlow = remember(player) { player?.database?.playlists(PlaylistSortType.CREATE_DATE, true) ?: flowOf(emptyList()) }
    val playlists by plFlow.collectAsState(emptyList())
    return playlists
}

/** Glass "back" capsule above a large title, for pushed list pages. */
@Composable
internal fun BackTitle(back: String, title: String, onBack: () -> Unit) {
    val lo = LocalLo.current
    Column(Modifier.statusBarsPadding()) {
        Row(
            Modifier.padding(start = 8.dp, top = 6.dp).height(44.dp)
                .pressable(CircleShape, onClick = onBack).padding(start = 8.dp, end = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Ic(Ph.Left, 18.dp, lo.signal)
            Spacer(Modifier.width(4.dp))
            Text(back, style = LoType.body, color = lo.signal)
        }
        Text(title, style = LoType.hero, color = lo.ink, modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 14.dp, bottom = 8.dp))
    }
}

@Composable
fun LikedScreen() {
    val nav = LocalNav.current
    val player = LocalPlayer.current
    val songs = likedSongs()
    val now = playingId()
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = bottomPad())) {
        item { BackTitle("Library", "Liked Songs", nav::pop) }
        if (songs.isNotEmpty()) item {
            Row(Modifier.padding(horizontal = 20.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Pill("Play", { player?.playMediaItems("Liked", songs.map { it.toMediaItem() }) }, filled = false, iconV = Icons.Rounded.PlayArrow, modifier = Modifier.weight(1f))
                Pill("Shuffle", { player?.playMediaItems("Liked", songs.shuffled().map { it.toMediaItem() }) }, filled = false, iconV = Icons.Rounded.Shuffle, modifier = Modifier.weight(1f))
            }
        }
        if (songs.isEmpty()) item { EmptyState(Ph.Heart, "No Liked Songs", "Tap the heart in the player to add songs here.") }
        itemsIndexed(songs) { i, s ->
            MediaRow(s.song.title, s.artists.joinToString { it.name }, s.song.thumbnailUrl, active = now == s.song.id, flat = true, modifier = Modifier.appear(i), menu = MenuTarget(s.toMediaMetadata())) {
                player?.playMediaItems("Liked", songs.map { it.toMediaItem() }, i)
            }
        }
    }
}

@Composable
fun PlaylistsScreen() {
    val nav = LocalNav.current
    val playlists = playlistsState()
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = bottomPad())) {
        item { BackTitle("Library", "Playlists", nav::pop) }
        if (playlists.isEmpty()) item { EmptyState(Ph.Playlist, "No Playlists", "Playlists you import or create show up here.") }
        items(playlists) { p ->
            MediaRow(p.playlist.name, if (p.playlist.isLocal) "${p.songCount} songs" else "Saved playlist", p.playlist.thumbnailUrl ?: p.thumbnails.firstOrNull()) {
                if (p.playlist.isLocal) nav.push(Screen.LocalPlaylist(p.playlist.id)) else nav.push(Screen.Playlist(p.playlist.browseId ?: p.playlist.id))
            }
        }
    }
}

@Composable
fun SavedAlbumsScreen() {
    val nav = LocalNav.current
    val player = LocalPlayer.current
    val flow = remember(player) { player?.database?.albumsLikedByCreateDateAsc() ?: flowOf(emptyList()) }
    val albums by flow.collectAsState(emptyList())
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = bottomPad())) {
        item { BackTitle("Library", "Albums", nav::pop) }
        val shown = albums.filter { !it.album.isLocal }
        if (shown.isEmpty()) item { EmptyState(Ph.Disc, "No Albums", "Tap + on an album to keep it here.") }
        items(shown) { a ->
            MediaRow(a.album.title, a.artists.joinToString { it.name }, a.album.thumbnailUrl) { nav.push(Screen.Album(a.album.id)) }
        }
    }
}

@Composable
fun SavedArtistsScreen() {
    val nav = LocalNav.current
    val player = LocalPlayer.current
    val flow = remember(player) { player?.database?.artistsBookmarkedByCreateDateAsc() ?: flowOf(emptyList()) }
    val artists by flow.collectAsState(emptyList())
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = bottomPad())) {
        item { BackTitle("Library", "Artists", nav::pop) }
        val shown = artists.filter { it.artist.isYouTubeArtist && !it.artist.isLocal }
        if (shown.isEmpty()) item { EmptyState(Ph.User, "No Artists", "Tap + on an artist to keep them here.") }
        items(shown) { a ->
            MediaRow(a.artist.name, "Artist", a.artist.thumbnailUrl) { nav.push(Screen.Artist(a.artist.id)) }
        }
    }
}

// ================================================================================ Detail pages

/** What the header offers: play the list, shuffle it, and a few round extras (save, copy, radio, delete) shown in the top pill. */
class DetailActions(val play: (() -> Unit)?, val shuffle: (() -> Unit)?, vararg val extras: Triple<ImageVector, String, () -> Unit>)

/** "1:45:13" for a total running time in milliseconds (formatTime stops at minutes). */
private fun runTime(ms: Long): String {
    val s = ms / 1000
    return if (s >= 3600) "%d:%02d:%02d".format(s / 3600, s % 3600 / 60, s % 60) else "%d:%02d".format(s / 60, s % 60)
}

/**
 * Album / playlist / artist page after the reference: a row of round controls on top, one big pastel card
 * ("Selected for you", the title, the cover, the track count with the running time and a black shuffle button),
 * then plain song rows with the running time on the right.
 */
@Composable
private fun Detail(
    cover: String?, title: String, accent: String?, count: String, length: String? = null,
    round: Boolean = false,
    actions: DetailActions? = null,
    body: LazyListScope.() -> Unit,
) {
    val lo = LocalLo.current
    val nav = LocalNav.current
    val fill = tileColor(Math.floorMod(title.hashCode(), 4))
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = bottomPad())) {
        item {
            Row(Modifier.fillMaxWidth().statusBarsPadding().padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                val extras = actions?.extras.orEmpty()
                if (extras.isNotEmpty()) Row(Modifier.background(lo.surface2, CircleShape).padding(3.dp), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    extras.forEach { (icon, label, go) -> Box(Modifier.size(40.dp).a11y(label).pressable(CircleShape, onClick = go), Alignment.Center) { IcV(icon, 20.dp, lo.ink) } }
                }
                Spacer(Modifier.weight(1f))
                RoundBtn(Ph.Close.vector, "Close", nav::pop, size = 44.dp)
            }
            Column(Modifier.padding(horizontal = 16.dp).fillMaxWidth().background(fill, RoundedCornerShape(32.dp)).padding(start = 20.dp, end = 20.dp, top = 20.dp, bottom = 18.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(accent?.takeIf { it.isNotBlank() } ?: "Selected for you", style = LoType.small.copy(fontSize = 14.sp), color = lo.grey, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(title, style = LoType.title.copy(fontSize = 26.sp, lineHeight = 31.sp, fontWeight = FontWeight.Bold), color = lo.ink, textAlign = TextAlign.Center, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 2.dp, bottom = 18.dp))
                BoxWithConstraints(Modifier.fillMaxWidth(), Alignment.Center) {
                    val side = minOf(maxWidth * 0.78f, 280.dp)
                    Cover(cover, side, round = round, radius = 28.dp)
                }
                Row(Modifier.fillMaxWidth().padding(top = 18.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(48.dp).background(lo.bg.copy(alpha = 0.55f), RoundedCornerShape(14.dp)), Alignment.Center) { Ic(Ph.Waveform, 22.dp, lo.grey) }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(count, style = LoType.small.copy(fontWeight = FontWeight.SemiBold, fontSize = 14.sp), color = lo.ink)
                        if (length != null) Text(length, style = LoType.small, color = lo.grey)
                    }
                    if (actions?.shuffle != null) Box(Modifier.size(52.dp).a11y("Shuffle").background(lo.signal, CircleShape).pressable(CircleShape, onClick = actions.shuffle), Alignment.Center) { IcV(Ph.Shuffle.vector, 22.dp, lo.onSignal) }
                }
            }
            Spacer(Modifier.height(12.dp))
        }
        body()
    }
}

@Composable
fun AlbumScreen(id: String) {
    val player = LocalPlayer.current
    val state by load(id) { YouTube.album(id) }
    when (val st = state) {
        is Load.Loading -> Box(Modifier.fillMaxSize()) { SkeletonDetail(); TopBar("", LocalNav.current::pop) }
        is Load.Err -> Box(Modifier.fillMaxSize()) { ErrorBox(st.message, st.retry); TopBar("", LocalNav.current::pop) }
        is Load.Ok -> {
            val page = st.value
            val scope = rememberCoroutineScope()
            val ctx = LocalContext.current
            val sync = LocalSync.current
            val db = player?.database
            val saved by remember(db, id) { (db?.album(id) ?: flowOf<com.lomu.app.db.entities.Album?>(null)).map { it?.album?.bookmarkedAt != null } }.collectAsState(false)
            Detail(
                page.album.thumbnail, page.album.title, page.album.artists?.joinToString(", ") { it.name },
                "${page.songs.size} songs", runTime(page.songs.sumOf { (it.duration ?: 0).toLong() } * 1000),
                actions = DetailActions(
                        { player?.playList(page.album.title, page.songs) }, { player?.playList(page.album.title, page.songs.shuffled()) },
                        Triple(if (saved) Ph.HeartFill.vector else Ph.Heart.vector, "Save", {
                            db?.let { d -> scope.launch { setAlbumSaved(d, page, !saved, sync); android.widget.Toast.makeText(ctx, if (saved) "Removed from Library" else "Saved to Library", android.widget.Toast.LENGTH_SHORT).show() } }; Unit
                        }),
                        Triple(Ph.AddList.vector, "Copy to a playlist", {
                            db?.let { d -> scope.launch { saveAsPlaylist(d, page.album.title, page.songs.map { it.toMediaMetadata() }); android.widget.Toast.makeText(ctx, "Copied to Playlists", android.widget.Toast.LENGTH_SHORT).show() } }; Unit
                        }),
                    ),
            ) {
                itemsIndexed(page.songs) { i, s -> TrackRow(s, flat = true, showLine = false, modifier = Modifier.appear(i)) { player?.playList(page.album.title, page.songs, i) } }
            }
        }
    }
}

@Composable
fun PlaylistScreen(id: String) {
    val player = LocalPlayer.current
    val state by load(id) { YouTube.playlist(id) }
    when (val st = state) {
        is Load.Loading -> Box(Modifier.fillMaxSize()) { SkeletonDetail(); TopBar("", LocalNav.current::pop) }
        is Load.Err -> Box(Modifier.fillMaxSize()) { ErrorBox(st.message, st.retry); TopBar("", LocalNav.current::pop) }
        is Load.Ok -> {
            val page = st.value
            val scope = rememberCoroutineScope()
            val ctx = LocalContext.current
            val sync = LocalSync.current
            val db = player?.database
            val pid = id.removePrefix("VL")
            val saved by remember(db, pid) { (db?.playlist(pid) ?: flowOf<com.lomu.app.db.entities.Playlist?>(null)).map { it?.playlist?.let { p -> !p.isLocal && p.bookmarkedAt != null } == true } }.collectAsState(false)
            Detail(
                page.playlist.thumbnail, page.playlist.title, page.playlist.author?.name, page.playlist.songCountText ?: "${page.songs.size} songs", runTime(page.songs.sumOf { (it.duration ?: 0).toLong() } * 1000),
                actions = DetailActions(
                        { player?.playPlaylist(id, page.playlist.title, page.songs, page.songsContinuation) }, { player?.playList(page.playlist.title, page.songs.shuffled()) },
                        Triple(if (saved) Ph.HeartFill.vector else Ph.Heart.vector, "Save", {
                            db?.let { d -> scope.launch { setPlaylistSaved(d, pid, page.playlist.title, page.playlist.thumbnail, !saved, sync); android.widget.Toast.makeText(ctx, if (saved) "Removed from Library" else "Saved to Library", android.widget.Toast.LENGTH_SHORT).show() } }; Unit
                        }),
                        Triple(Ph.AddList.vector, "Copy to a playlist", {
                            db?.let { d -> scope.launch { saveAsPlaylist(d, page.playlist.title, page.songs.map { it.toMediaMetadata() }); android.widget.Toast.makeText(ctx, "Copied to Playlists", android.widget.Toast.LENGTH_SHORT).show() } }; Unit
                        }),
                    ),
            ) {
                itemsIndexed(page.songs) { i, s -> TrackRow(s, flat = true, showLine = false, modifier = Modifier.appear(i)) { player?.playPlaylist(id, page.playlist.title, page.songs, page.songsContinuation, i) } }
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
        is Load.Loading -> Box(Modifier.fillMaxSize()) { SkeletonDetail(); TopBar("", LocalNav.current::pop) }
        is Load.Err -> Box(Modifier.fillMaxSize()) { ErrorBox(st.message, st.retry); TopBar("", LocalNav.current::pop) }
        is Load.Ok -> {
            val page = st.value
            val firstSongs = page.sections.map { it.items.filterIsInstance<SongItem>() }.firstOrNull { it.isNotEmpty() }.orEmpty()
            val scope = rememberCoroutineScope()
            val ctx = LocalContext.current
            val sync = LocalSync.current
            val db = player?.database
            val saved by remember(db, id) { (db?.artist(id) ?: flowOf<com.lomu.app.db.entities.Artist?>(null)).map { it?.artist?.bookmarkedAt != null } }.collectAsState(false)
            val saveButton = Triple(if (saved) Ph.HeartFill.vector else Ph.Heart.vector, "Save", {
                db?.let { d -> scope.launch { setArtistSaved(d, page, !saved, sync); android.widget.Toast.makeText(ctx, if (saved) "Removed from Library" else "Saved to Library", android.widget.Toast.LENGTH_SHORT).show() } }; Unit
            })
            Detail(
                page.artist.thumbnail, page.artist.title, "Artist", page.subscriberCountText.orEmpty(), round = true,
                actions = if (firstSongs.isEmpty()) DetailActions(null, null, saveButton) else DetailActions(
                    { player?.playList(page.artist.title, firstSongs) }, { player?.playList(page.artist.title, firstSongs.shuffled()) },
                    Triple(Ph.Radio.vector, "Start Radio", { player?.playRadio(firstSongs.first()); Unit }),
                    saveButton,
                ),
            ) {
                items(page.sections) { sec ->
                    val songs = sec.items.filterIsInstance<SongItem>()
                    if (songs.isNotEmpty() && songs.size == sec.items.size) {
                        Column {
                            CaptionedTitle(sec.title, null, "See All") { player?.playList(sec.title, songs) }
                            songs.take(5).forEachIndexed { i, s -> TrackRow(s, flat = true, showLine = false, modifier = Modifier.appear(i)) { player?.playList(sec.title, songs, i) } }
                        }
                    } else Shelf(sec.title, sec.items)
                }
                page.description?.takeIf { it.isNotBlank() }?.let { d ->
                    item {
                        Column {
                            SectionTitle("About")
                            Column(Modifier.padding(horizontal = 20.dp).fillMaxWidth()) {
                                Text(d, style = LoType.sub, color = lo.ink, maxLines = if (bioOpen) Int.MAX_VALUE else 4, overflow = TextOverflow.Ellipsis)
                                Text(if (bioOpen) "less" else "more", style = LoType.sub, color = lo.signal, modifier = Modifier.padding(top = 6.dp).pressable { bioOpen = !bioOpen })
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
    val scope = rememberCoroutineScope()
    val playlists = playlistsState()
    val meta = playlists.firstOrNull { it.playlist.id == id }
    val flow = remember(player, id) { player?.database?.playlistSongs(id) ?: flowOf(emptyList()) }
    val rows by flow.collectAsState(emptyList())
    val songs = rows.sortedBy { it.map.position }
    val items = songs.map { it.song.toMediaItem() }
    val now = playingId()
    val nav = LocalNav.current
    val ctx = LocalContext.current
    val sync = LocalSync.current
    var confirmDelete by remember(id) { mutableStateOf(false) }
    Detail(
        meta?.playlist?.thumbnailUrl ?: songs.firstOrNull()?.song?.song?.thumbnailUrl, meta?.playlist?.name ?: "Playlist", null, "${songs.size} songs", runTime(songs.sumOf { it.song.song.duration.toLong() } * 1000),
        actions = DetailActions(
                { player?.playMediaItems("Playlist", items) }, { player?.playMediaItems("Playlist", items.shuffled()) },
                Triple(Ph.Trash.vector, if (confirmDelete) "Tap again to delete this playlist" else "Delete playlist", {
                    val pl = meta?.playlist
                    if (!confirmDelete) { confirmDelete = true; android.widget.Toast.makeText(ctx, "Tap again to delete this playlist", android.widget.Toast.LENGTH_SHORT).show() }
                    else if (pl != null) player?.database?.let { d -> scope.launch(kotlinx.coroutines.Dispatchers.IO) { d.withTransaction { delete(pl) }; runCatching { sync?.sync() } }; nav.pop() }
                    Unit
                }),
            ),
    ) {
        if (songs.isEmpty()) item { EmptyState(Ph.Playlist, "This playlist is empty") }
        itemsIndexed(songs) { i, s ->
            MediaRow(
                s.song.song.title, s.song.artists.joinToString { it.name }, s.song.song.thumbnailUrl, trailing = formatTime(s.song.song.duration * 1000L), active = now == s.song.song.id, flat = true, showLine = false, modifier = Modifier.appear(i),
                menu = MenuTarget(s.song.toMediaMetadata(), "Remove from this Playlist") { player?.database?.let { d -> scope.launch(kotlinx.coroutines.Dispatchers.IO) { d.withTransaction { deletePlaylistSongMap(s.map.id) } } } },
            ) {
                player?.playMediaItems("Playlist", items, i)
            }
        }
    }
}

// =================================================================================== Settings

/** iOS grouped section: small grey header, white rounded cells separated by inset hairlines, grey footer. */
@Composable
private fun Group(header: String?, footer: String? = null, content: @Composable ColumnScope.() -> Unit) {
    val lo = LocalLo.current
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
        if (header != null) Text(header.uppercase(), style = LoType.small, color = lo.grey, modifier = Modifier.padding(start = 16.dp, top = 24.dp, bottom = 7.dp))
        else Spacer(Modifier.height(24.dp))
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(lo.cell), content = content)
        if (footer != null) Text(footer, style = LoType.small, color = lo.grey, modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 7.dp))
    }
}

@Composable
private fun Cell(modifier: Modifier = Modifier, content: @Composable RowScope.() -> Unit) =
    Row(modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp).heightIn(min = 22.dp), verticalAlignment = Alignment.CenterVertically, content = content)

@Composable
private fun CellField(value: String, onChange: (String) -> Unit, hint: String, password: Boolean = false) {
    val lo = LocalLo.current
    Cell {
        BasicTextField(
            value = value, onValueChange = onChange, singleLine = true,
            textStyle = LoType.body.copy(color = lo.ink), cursorBrush = SolidColor(lo.signal),
            visualTransformation = if (password) androidx.compose.ui.text.input.PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
            modifier = Modifier.fillMaxWidth().semantics { contentDescription = hint },
            decorationBox = { inner ->
                if (value.isEmpty()) Text(hint, style = LoType.body, color = lo.grey)
                inner()
            },
        )
    }
}

@Composable
private fun IconTile(icon: Ph, color: Color, size: Dp = 30.dp) {
    Box(Modifier.size(size).background(color, RoundedCornerShape(7.dp)), Alignment.Center) { Ic(icon, size * 0.62f, Color.White) }
}

@Composable
private fun ActionCell(label: String, color: Color, enabled: Boolean = true, onClick: () -> Unit) {
    Cell(Modifier.pressable(RoundedCornerShape(0.dp), enabled, onClick = onClick)) { Text(label, style = LoType.body, color = color) }
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
    Column(Modifier.fillMaxSize().background(lo.grouped).verticalScroll(rememberScrollState()).padding(bottom = bottomPad())) {
        BackTitle("Back", "Settings", nav::pop)
        if (st.user != null) {
            Group("Account", footer = st.error ?: st.status) {
                Cell {
                    IconTile(Ph.User, lo.signal, 36.dp)
                    Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f)) {
                        Text(st.user.orEmpty(), style = LoType.body.copy(fontWeight = FontWeight.SemiBold), color = lo.ink)
                        Text("Your LoMu server", style = LoType.small, color = lo.grey)
                    }
                }
                Hairline(16.dp)
                ActionCell(if (st.busy) "Syncing…" else "Sync Now", lo.signal, enabled = !st.busy) { scope.launch { sync?.sync() } }
                Hairline(16.dp)
                ActionCell("Sign Out", lo.red) { sync?.signOut() }
            }
        } else {
            val note = if (probing) "Checking the server…" else probe?.second ?: "One owner account on your own LoMu server."
            Group("Account", footer = st.error ?: note) {
                CellField(url, { url = it }, "Server, e.g. https://lomu.example.com")
                Hairline(16.dp)
                CellField(user, { user = it }, "Username")
                Hairline(16.dp)
                CellField(pass, { pass = it }, "Password", password = true)
            }
            Group(null) {
                ActionCell(if (st.busy) "Working…" else "Sign In", lo.signal, enabled = !st.busy) { scope.launch { sync?.signIn(url, user, pass, false); sync?.sync() } }
                Hairline(16.dp)
                ActionCell("Create Account", lo.signal) { scope.launch { sync?.signIn(url, user, pass, true); sync?.sync() } }
            }
        }
        run {
            var lanText by remember(st.lan) { mutableStateOf(st.lan) }
            var lanMsg by remember { mutableStateOf<String?>(null) }
            Group("Home network", footer = lanMsg ?: "If the server's name does not work at home (router or WARP), the phone uses these addresses instead. Example: 10.10.10.136 (through the proxy) or 10.10.10.136:4100 (straight to the server, plain HTTP). Leave empty to let the server tell the phone.") {
                CellField(lanText, { lanText = it; lanMsg = null }, "Server address at home (optional)")
                Hairline(16.dp)
                ActionCell("Save", lo.signal) {
                    lanMsg = sync?.setLan(lanText) ?: "Saved. Takes effect on the next request."
                }
            }
        }
        if (st.user != null) {
            val openDevices = LocalOpenDevices.current
            Group("Devices", footer = "See the other devices signed in to this account, move music between them, and control them from here.") {
                Cell(Modifier.pressable(RoundedCornerShape(0.dp)) { openDevices() }) {
                    IconTile(Ph.Headphones, lo.signal)
                    Spacer(Modifier.width(14.dp))
                    Text("Connect to a device", style = LoType.body, color = lo.ink, modifier = Modifier.weight(1f))
                    Icon(Icons.Rounded.ChevronRight, null, tint = lo.grey.copy(alpha = 0.7f), modifier = Modifier.size(20.dp))
                }
            }
        }
        Group("Tabs", footer = "Show the New tab (YouTube Music's open feed) in the bottom bar.") {
            val ctx = LocalContext.current
            Cell {
                IconTile(Ph.Sparkles, Color(0xFFFF9500))
                Spacer(Modifier.width(14.dp))
                Text("New tab", style = LoType.body, color = lo.ink, modifier = Modifier.weight(1f))
                androidx.compose.material3.Switch(UiPrefs.showNew(ctx), { UiPrefs.setShowNew(ctx, it) })
            }
        }
        Group("Library", footer = "Copy your liked songs and playlists once. The Google session is discarded afterwards.") {
            Cell(Modifier.pressable(RoundedCornerShape(0.dp)) { nav.push(Screen.Import) }) {
                IconTile(Ph.Download, Color(0xFF34C759))
                Spacer(Modifier.width(14.dp))
                Text("Import from YouTube Music", style = LoType.body, color = lo.ink, modifier = Modifier.weight(1f))
                Icon(Icons.Rounded.ChevronRight, null, tint = lo.grey.copy(alpha = 0.7f), modifier = Modifier.size(20.dp))
            }
        }
        Group("About") {
            Cell {
                IconTile(Ph.Waveform, lo.signal)
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    Text("LoMu", style = LoType.body, color = lo.ink)
                    Text("Plays anonymously from YouTube Music. No ads, no Google account.", style = LoType.small, color = lo.grey)
                }
            }
        }
    }
}
