package com.lomu.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.lomu.app.constants.SongSortType
import com.lomu.app.db.entities.Song
import com.lomu.app.extensions.toMediaItem
import com.lomu.app.playback.queues.YouTubeQueue
import com.music.innertube.YouTube
import com.music.innertube.models.ArtistItem
import com.music.innertube.models.SongItem
import com.music.innertube.models.YTItem
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.flowOf

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

@Composable
fun HomeScreen() {
    val lo = LocalLo.current
    val state by load("home") { YouTube.home() }
    val player = LocalPlayer.current
    val recent = likedSongs().take(12)
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 24.dp)) {
        item {
            Column(Modifier.statusBarsPadding().padding(start = 20.dp, end = 20.dp, top = 28.dp)) {
                Text(greeting(), style = LoType.hero, color = lo.ink)
                Text("What are we playing?", style = LoType.hero, color = lo.grey)
            }
        }
        if (recent.isNotEmpty()) item {
            Column {
                SectionTitle("Jump back in")
                LazyRow(contentPadding = PaddingValues(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    itemsIndexed(recent) { i, s ->
                        Column(Modifier.width(140.dp).clickable { player?.playMediaItems("Liked", recent.map { it.toMediaItem() }, i) }) {
                            Cover(s.song.thumbnailUrl, 140.dp)
                            Spacer(Modifier.height(8.dp))
                            Text(s.song.title, style = LoType.body, color = lo.ink, maxLines = 1)
                            Text(s.artists.joinToString { it.name }, style = LoType.small, color = lo.grey, maxLines = 1)
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

@Composable
fun SearchScreen() {
    val lo = LocalLo.current
    var text by remember { mutableStateOf("") }
    var submitted by remember { mutableStateOf("") }
    var suggestions by remember { mutableStateOf<List<String>>(emptyList()) }
    LaunchedEffect(text) {
        if (text.isBlank()) { suggestions = emptyList(); return@LaunchedEffect }
        delay(250)
        suggestions = YouTube.searchSuggestions(text).getOrNull()?.queries.orEmpty().take(6)
    }
    val result by load(submitted) {
        if (submitted.isBlank()) Result.success(null) else YouTube.searchSummary(submitted).map { it }
    }
    val open = rememberOpen()
    Column(Modifier.fillMaxSize().statusBarsPadding()) {
        Text("Search", style = LoType.hero, color = lo.ink, modifier = Modifier.padding(start = 20.dp, top = 28.dp, bottom = 12.dp))
        Row(Modifier.padding(horizontal = 20.dp).fillMaxWidth().clip(CircleShape).background(lo.card).padding(horizontal = 20.dp, vertical = 14.dp)) {
            BasicTextField(
                value = text, onValueChange = { text = it }, singleLine = true,
                textStyle = LoType.body.copy(color = lo.ink), cursorBrush = SolidColor(lo.ink),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = { submitted = text; suggestions = emptyList() }),
                modifier = Modifier.fillMaxWidth(),
                decorationBox = { inner ->
                    if (text.isEmpty()) Text("Songs, artists, albums", style = LoType.body, color = lo.grey)
                    inner()
                },
            )
        }
        LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
            items(suggestions) { q ->
                Text(
                    q, style = LoType.body, color = lo.ink,
                    modifier = Modifier.fillMaxWidth().clickable { text = q; submitted = q; suggestions = emptyList() }.padding(horizontal = 20.dp, vertical = 12.dp),
                )
            }
            if (suggestions.isEmpty()) when (val r = result) {
                is Load.Loading -> if (submitted.isNotBlank()) item { Loading() }
                is Load.Err -> item { ErrorBox(r.message) }
                is Load.Ok -> r.value?.summaries?.forEach { sum ->
                    item { SectionTitle(sum.title) }
                    items(sum.items.take(6)) { it ->
                        if (it is SongItem) TrackRow(it) { open(it) } else ResultRow(it) { open(it) }
                    }
                }
            }
        }
    }
}

@Composable
fun ResultRow(item: YTItem, onClick: () -> Unit) {
    val lo = LocalLo.current
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 20.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Cover(item.thumbnail, 52.dp, round = item is ArtistItem)
        Spacer(Modifier.width(14.dp))
        Column {
            Text(item.title, style = LoType.body, color = lo.ink, maxLines = 1)
            Text(subtitle(item), style = LoType.small, color = lo.grey, maxLines = 1)
        }
    }
}

@Composable
fun LibraryScreen() {
    val lo = LocalLo.current
    val player = LocalPlayer.current
    val songs = likedSongs()
    LazyColumn(Modifier.fillMaxSize().statusBarsPadding(), contentPadding = PaddingValues(bottom = 24.dp)) {
        item {
            Text("Library", style = LoType.hero, color = lo.ink, modifier = Modifier.padding(start = 20.dp, top = 28.dp))
            Text("${songs.size} liked songs", style = LoType.hero, color = lo.grey, modifier = Modifier.padding(start = 20.dp, bottom = 12.dp))
            if (songs.isNotEmpty()) Row(Modifier.padding(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Pill("Play", { player?.playMediaItems("Liked", songs.map { it.toMediaItem() }) })
                Pill("Shuffle", { player?.playMediaItems("Liked", songs.shuffled().map { it.toMediaItem() }) }, filled = false)
            }
        }
        if (songs.isEmpty()) item { ErrorBox("Songs you like show up here. Tap the heart in the player.") }
        itemsIndexed(songs) { i, s ->
            Row(
                Modifier.fillMaxWidth().clickable { player?.playMediaItems("Liked", songs.map { it.toMediaItem() }, i) }.padding(horizontal = 20.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Cover(s.song.thumbnailUrl, 52.dp)
                Spacer(Modifier.width(14.dp))
                Column {
                    Text(s.song.title, style = LoType.body, color = lo.ink, maxLines = 1)
                    Text(s.artists.joinToString { it.name }, style = LoType.small, color = lo.grey, maxLines = 1)
                }
            }
        }
    }
}

@Composable
private fun DetailHeader(cover: String?, title: String, line: String, round: Boolean = false) {
    val lo = LocalLo.current
    Column(Modifier.fillMaxWidth().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Cover(cover, 220.dp, round = round)
        Spacer(Modifier.height(16.dp))
        Text(title, style = LoType.title, color = lo.ink)
        if (line.isNotBlank()) Text(line, style = LoType.small, color = lo.grey)
    }
}

@Composable
fun AlbumScreen(id: String) {
    val nav = LocalNav.current
    val player = LocalPlayer.current
    val state by load(id) { YouTube.album(id) }
    Column(Modifier.fillMaxSize()) {
        TopBar("", nav::pop)
        when (val st = state) {
            is Load.Loading -> Loading()
            is Load.Err -> ErrorBox(st.message)
            is Load.Ok -> {
                val page = st.value
                LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
                    item {
                        DetailHeader(page.album.thumbnail, page.album.title, subtitle(page.album))
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                            Pill("Play", { player?.playList(page.album.title, page.songs) })
                            Spacer(Modifier.width(10.dp))
                            Pill("Shuffle", { player?.playList(page.album.title, page.songs.shuffled()) }, filled = false)
                        }
                        Spacer(Modifier.height(12.dp))
                    }
                    itemsIndexed(page.songs) { i, s -> TrackRow(s, index = i) { player?.playList(page.album.title, page.songs, i) } }
                }
            }
        }
    }
}

@Composable
fun PlaylistScreen(id: String) {
    val nav = LocalNav.current
    val player = LocalPlayer.current
    val state by load(id) { YouTube.playlist(id) }
    Column(Modifier.fillMaxSize()) {
        TopBar("", nav::pop)
        when (val st = state) {
            is Load.Loading -> Loading()
            is Load.Err -> ErrorBox(st.message)
            is Load.Ok -> {
                val page = st.value
                LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
                    item {
                        DetailHeader(page.playlist.thumbnail, page.playlist.title, subtitle(page.playlist))
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                            Pill("Play", { player?.playPlaylist(id, page.playlist.title, page.songs, page.songsContinuation) })
                            Spacer(Modifier.width(10.dp))
                            Pill("Shuffle", { player?.playList(page.playlist.title, page.songs.shuffled()) }, filled = false)
                        }
                        Spacer(Modifier.height(12.dp))
                    }
                    itemsIndexed(page.songs) { i, s -> TrackRow(s) { player?.playPlaylist(id, page.playlist.title, page.songs, page.songsContinuation, i) } }
                }
            }
        }
    }
}

@Composable
fun ArtistScreen(id: String) {
    val nav = LocalNav.current
    val player = LocalPlayer.current
    val state by load(id) { YouTube.artist(id) }
    Column(Modifier.fillMaxSize()) {
        TopBar("", nav::pop)
        when (val st = state) {
            is Load.Loading -> Loading()
            is Load.Err -> ErrorBox(st.message)
            is Load.Ok -> {
                val page = st.value
                LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
                    item {
                        DetailHeader(page.artist.thumbnail, page.artist.title, page.subscriberCountText.orEmpty(), round = true)
                        page.artist.radioEndpoint?.let { ep ->
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                                Pill("Radio", { player?.playQueue(YouTubeQueue(ep)) })
                            }
                        }
                    }
                    items(page.sections) { sec ->
                        val songs = sec.items.filterIsInstance<SongItem>()
                        if (songs.isNotEmpty() && songs.size == sec.items.size) {
                            Column {
                                SectionTitle(sec.title)
                                songs.take(5).forEachIndexed { i, s -> TrackRow(s) { player?.playList(sec.title, songs, i) } }
                            }
                        } else Shelf(sec.title, sec.items)
                    }
                    page.description?.takeIf { it.isNotBlank() }?.let { d ->
                        item {
                            Column {
                                SectionTitle("About")
                                Text(d, style = LoType.body, color = LocalLo.current.grey, modifier = Modifier.padding(horizontal = 20.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SettingsScreen() {
    val lo = LocalLo.current
    val nav = LocalNav.current
    Column(Modifier.fillMaxSize()) {
        TopBar("Settings", nav::pop)
        Text(
            "LoMu · personal music player\nPlays anonymously from YouTube Music, no ads.",
            style = LoType.body, color = lo.grey, modifier = Modifier.padding(20.dp),
        )
    }
}
