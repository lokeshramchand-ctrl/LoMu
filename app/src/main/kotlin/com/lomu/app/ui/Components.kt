package com.lomu.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.music.innertube.models.AlbumItem
import com.music.innertube.models.ArtistItem
import com.music.innertube.models.PlaylistItem
import com.music.innertube.models.SongItem
import com.music.innertube.models.YTItem

@Composable
fun Cover(url: String?, size: Dp, round: Boolean = false, modifier: Modifier = Modifier) {
    val lo = LocalLo.current
    AsyncImage(
        model = url,
        contentDescription = null,
        contentScale = ContentScale.Crop,
        modifier = modifier
            .size(size)
            .clip(if (round) CircleShape else RoundedCornerShape(14.dp))
            .background(lo.line),
    )
}

@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier) {
    Text(
        text, style = LoType.section, color = LocalLo.current.ink,
        modifier = modifier.padding(start = 20.dp, end = 20.dp, top = 22.dp, bottom = 10.dp),
    )
}

@Composable
fun Loading() = Box(Modifier.fillMaxWidth().padding(48.dp), Alignment.Center) {
    CircularProgressIndicator(color = LocalLo.current.grey, strokeWidth = 2.dp)
}

@Composable
fun ErrorBox(message: String) = Box(Modifier.fillMaxWidth().padding(32.dp), Alignment.Center) {
    Text(message, style = LoType.body, color = LocalLo.current.grey)
}

fun artistLine(s: SongItem) = s.artists.joinToString(", ") { it.name }

/** The line under a card: artists, year or author depending on the type. */
fun subtitle(item: YTItem): String = when (item) {
    is SongItem -> artistLine(item)
    is AlbumItem -> listOfNotNull(item.artists?.joinToString(", ") { it.name }, item.year?.toString()).joinToString(" · ")
    is PlaylistItem -> item.author?.name ?: item.songCountText.orEmpty()
    is ArtistItem -> "Artist"
}

@Composable
fun TrackRow(song: SongItem, index: Int? = null, onClick: () -> Unit) {
    val lo = LocalLo.current
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 20.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (index != null) {
            Text("${index + 1}", style = LoType.small, color = lo.grey, modifier = Modifier.width(28.dp))
        } else {
            Cover(song.thumbnail, 52.dp)
            Spacer(Modifier.width(14.dp))
        }
        Column(Modifier.weight(1f)) {
            Text(song.title, style = LoType.body, color = lo.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(artistLine(song), style = LoType.small, color = lo.grey, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        song.duration?.let { Text(formatTime(it * 1000L), style = LoType.small, color = lo.grey) }
    }
}

@Composable
fun ItemCard(item: YTItem, onClick: () -> Unit) {
    val lo = LocalLo.current
    Column(Modifier.width(140.dp).clickable(onClick = onClick), horizontalAlignment = Alignment.Start) {
        Cover(item.thumbnail, 140.dp, round = item is ArtistItem)
        Spacer(Modifier.height(8.dp))
        Text(item.title, style = LoType.body, color = lo.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(subtitle(item), style = LoType.small, color = lo.grey, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/** Opens an item: songs play, everything else navigates. */
@Composable
fun rememberOpen(): (YTItem) -> Unit {
    val nav = LocalNav.current
    val player = LocalPlayer.current
    return { item ->
        when (item) {
            is SongItem -> player?.playRadio(item)
            is AlbumItem -> nav.push(Screen.Album(item.browseId))
            is ArtistItem -> nav.push(Screen.Artist(item.id))
            is PlaylistItem -> nav.push(Screen.Playlist(item.id))
        }
    }
}

@Composable
fun Shelf(title: String, items: List<YTItem>) {
    val open = rememberOpen()
    Column {
        SectionTitle(title)
        LazyRow(contentPadding = PaddingValues(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            items(items) { ItemCard(it) { open(it) } }
        }
    }
}

@Composable
fun Pill(text: String, onClick: () -> Unit, filled: Boolean = true) {
    val lo = LocalLo.current
    Box(
        Modifier.clip(CircleShape)
            .background(if (filled) lo.ink else lo.card)
            .clickable(onClick = onClick)
            .padding(horizontal = 22.dp, vertical = 11.dp),
    ) { Text(text, style = LoType.body, color = if (filled) lo.bg else lo.ink) }
}

@Composable
fun TopBar(title: String, onBack: (() -> Unit)?) {
    val lo = LocalLo.current
    Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        if (onBack != null) {
            Text("←", style = LoType.title, color = lo.ink, modifier = Modifier.clip(CircleShape).clickable(onClick = onBack).padding(horizontal = 12.dp, vertical = 2.dp))
        } else Spacer(Modifier.width(8.dp))
        Text(title, style = LoType.title, color = lo.ink)
    }
}
