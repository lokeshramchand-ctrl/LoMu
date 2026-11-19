package com.lomu.app.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.music.innertube.models.AlbumItem
import com.music.innertube.models.ArtistItem
import com.music.innertube.models.PlaylistItem
import com.music.innertube.models.SongItem
import com.music.innertube.models.YTItem

// ---------- primitives ----------

@Composable
fun Ic(icon: Ph, size: Dp = 22.dp, tint: Color = LocalLo.current.ink, modifier: Modifier = Modifier) {
    Icon(icon.vector, contentDescription = null, tint = tint, modifier = modifier.size(size))
}

/** Clickable with a small spring "press" so every tap has feedback. */
fun Modifier.pressable(shape: Shape = RoundedCornerShape(12.dp), enabled: Boolean = true, onClick: () -> Unit): Modifier = composed {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed) 0.96f else 1f, spring(dampingRatio = 0.6f, stiffness = 500f), label = "press")
    this
        .graphicsLayer { scaleX = scale; scaleY = scale }
        .clip(shape)
        .clickable(interactionSource = source, indication = null, enabled = enabled, onClick = onClick)
}

@Composable
fun IconBtn(
    icon: Ph, onClick: () -> Unit, size: Dp = 40.dp, iconSize: Dp = 20.dp,
    tint: Color = LocalLo.current.ink, bordered: Boolean = false, filled: Boolean = false, modifier: Modifier = Modifier,
) {
    val lo = LocalLo.current
    Box(
        modifier.size(size)
            .then(if (filled) Modifier.background(lo.ink, CircleShape) else Modifier)
            .then(if (bordered) Modifier.border(1.dp, lo.border2, CircleShape) else Modifier)
            .pressable(CircleShape, onClick = onClick),
        Alignment.Center,
    ) { Ic(icon, iconSize, if (filled) lo.bg else tint) }
}

@Composable
fun Cover(url: String?, size: Dp, round: Boolean = false, modifier: Modifier = Modifier, radius: Dp = 12.dp) {
    val lo = LocalLo.current
    val shape = if (round) CircleShape else RoundedCornerShape(radius)
    AsyncImage(
        model = url,
        contentDescription = null,
        contentScale = ContentScale.Crop,
        modifier = modifier.size(size).clip(shape).background(lo.surface2).border(1.dp, lo.line, shape),
    )
}

/** Blurred artwork that fades into the page background; sits behind a detail header or the player. */
@Composable
fun Ambient(url: String?, modifier: Modifier = Modifier, height: Dp = 380.dp) {
    val lo = LocalLo.current
    if (url == null) return
    Box(modifier.fillMaxWidth().height(height)) {
        AsyncImage(
            model = url, contentDescription = null, contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize().blur(70.dp).alpha(if (lo.dark) 0.35f else 0.28f),
        )
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent, lo.bg))))
    }
}

// ---------- text blocks ----------

@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier, action: String? = null, onAction: (() -> Unit)? = null) {
    val lo = LocalLo.current
    Row(modifier.fillMaxWidth().padding(start = 20.dp, end = 12.dp, top = 24.dp, bottom = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(text, style = LoType.section, color = lo.ink, modifier = Modifier.weight(1f))
        if (action != null && onAction != null) {
            Text(action, style = LoType.small, color = lo.signal, modifier = Modifier.pressable(CircleShape, onClick = onAction).padding(horizontal = 10.dp, vertical = 6.dp))
        }
    }
}

@Composable
fun Eyebrow(text: String, modifier: Modifier = Modifier) =
    Text(text.uppercase(), style = LoType.eyebrow, color = LocalLo.current.signal, modifier = modifier)

@Composable
fun Loading() = Box(Modifier.fillMaxWidth().padding(48.dp), Alignment.Center) {
    CircularProgressIndicator(color = LocalLo.current.grey, strokeWidth = 2.dp, modifier = Modifier.size(28.dp))
}

@Composable
fun EmptyState(icon: Ph, title: String, hint: String? = null, modifier: Modifier = Modifier) {
    val lo = LocalLo.current
    Column(modifier.fillMaxWidth().padding(horizontal = 32.dp, vertical = 40.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(Modifier.size(52.dp).background(lo.surface2, RoundedCornerShape(16.dp)).border(1.dp, lo.line, RoundedCornerShape(16.dp)), Alignment.Center) { Ic(icon, 24.dp, lo.grey) }
        Spacer(Modifier.height(4.dp))
        Text(title, style = LoType.body.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold), color = lo.ink, textAlign = TextAlign.Center)
        if (hint != null) Text(hint, style = LoType.small, color = lo.grey, textAlign = TextAlign.Center)
    }
}

@Composable
fun ErrorBox(message: String) = EmptyState(Ph.Warn, "Something went wrong", message)

fun artistLine(s: SongItem) = s.artists.joinToString(", ") { it.name }

/** The line under a card: artists, year or author depending on the type. */
fun subtitle(item: YTItem): String = when (item) {
    is SongItem -> artistLine(item)
    is AlbumItem -> listOfNotNull(item.artists?.joinToString(", ") { it.name }, item.year?.toString()).joinToString(" · ")
    is PlaylistItem -> item.author?.name ?: item.songCountText.orEmpty()
    is ArtistItem -> "Artist"
}

// ---------- rows and cards ----------

/** One song line. [active] marks the song that is playing now. */
@Composable
fun MediaRow(title: String, line: String, thumb: String?, trailing: String? = null, index: Int? = null, active: Boolean = false, onClick: () -> Unit) {
    val lo = LocalLo.current
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 8.dp).pressable(RoundedCornerShape(14.dp), onClick = onClick)
            .background(if (active) lo.signalSoft else Color.Transparent)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (index != null) {
            Box(Modifier.width(28.dp)) {
                if (active) Ic(Ph.Waveform, 16.dp, lo.signal) else Text("${index + 1}", style = LoType.small, color = lo.grey)
            }
        } else {
            Box {
                Cover(thumb, 50.dp, radius = 10.dp)
                if (active) Box(Modifier.size(50.dp).background(Color(0x66000000), RoundedCornerShape(10.dp)), Alignment.Center) { Ic(Ph.Waveform, 20.dp, Color.White) }
            }
            Spacer(Modifier.width(14.dp))
        }
        Column(Modifier.weight(1f)) {
            Text(title, style = LoType.body, color = if (active) lo.signal else lo.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(line, style = LoType.small, color = lo.grey, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        if (trailing != null) Text(trailing, style = LoType.small, color = lo.grey, modifier = Modifier.padding(start = 10.dp))
    }
}

@Composable
fun playingId(): String? {
    val pc = LocalPlayer.current ?: return null
    val meta by pc.mediaMetadata.collectAsState()
    return meta?.id
}

@Composable
fun TrackRow(song: SongItem, index: Int? = null, onClick: () -> Unit) {
    MediaRow(song.title, artistLine(song), song.thumbnail, song.duration?.let { formatTime(it * 1000L) }, index, playingId() == song.id, onClick)
}

@Composable
fun ItemCard(item: YTItem, onClick: () -> Unit) {
    val lo = LocalLo.current
    Column(Modifier.width(144.dp).pressable(RoundedCornerShape(14.dp), onClick = onClick), horizontalAlignment = if (item is ArtistItem) Alignment.CenterHorizontally else Alignment.Start) {
        Cover(item.thumbnail, 144.dp, round = item is ArtistItem, radius = 14.dp)
        Spacer(Modifier.height(8.dp))
        Text(item.title, style = LoType.body, color = lo.ink, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = if (item is ArtistItem) TextAlign.Center else TextAlign.Start)
        Text(subtitle(item), style = LoType.small, color = lo.grey, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = if (item is ArtistItem) TextAlign.Center else TextAlign.Start)
    }
}

/** Compact two-up tile: small cover, title. Used for "quick picks". */
@Composable
fun QuickTile(title: String, thumb: String?, active: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val lo = LocalLo.current
    val shape = RoundedCornerShape(14.dp)
    Row(
        modifier.height(56.dp).background(lo.card, shape).border(1.dp, if (active) lo.signal else lo.line, shape).pressable(shape, onClick = onClick),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Cover(thumb, 56.dp, radius = 13.dp, modifier = Modifier.padding(0.dp))
        Text(title, style = LoType.small.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold), color = if (active) lo.signal else lo.ink, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(horizontal = 10.dp))
    }
}

/** Square card used in shelves of plain tracks. */
@Composable
fun MediaCard(thumb: String?, title: String, line: String, active: Boolean = false, onClick: () -> Unit) {
    val lo = LocalLo.current
    Column(Modifier.width(144.dp).pressable(RoundedCornerShape(14.dp), onClick = onClick)) {
        Cover(thumb, 144.dp, radius = 14.dp)
        Spacer(Modifier.height(8.dp))
        Text(title, style = LoType.body, color = if (active) lo.signal else lo.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(line, style = LoType.small, color = lo.grey, maxLines = 1, overflow = TextOverflow.Ellipsis)
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

// ---------- buttons, chips, bars ----------

@Composable
fun Pill(text: String, onClick: () -> Unit, filled: Boolean = true, icon: Ph? = null, modifier: Modifier = Modifier) {
    val lo = LocalLo.current
    Row(
        modifier.height(44.dp)
            .background(if (filled) lo.ink else lo.card, CircleShape)
            .then(if (filled) Modifier else Modifier.border(BorderStroke(1.dp, lo.border2), CircleShape))
            .pressable(CircleShape, onClick = onClick)
            .padding(horizontal = 20.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center,
    ) {
        if (icon != null) { Ic(icon, 16.dp, if (filled) lo.bg else lo.ink); Spacer(Modifier.width(8.dp)) }
        Text(text, style = LoType.body.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold), color = if (filled) lo.bg else lo.ink)
    }
}

/** Segmented control, same look as the web `.chips`. */
@Composable
fun Chips(options: List<String>, selected: Int, onSelect: (Int) -> Unit, modifier: Modifier = Modifier, center: Boolean = false) {
    val lo = LocalLo.current
    LazyRow(
        modifier.padding(horizontal = if (center) 0.dp else 20.dp),
        horizontalArrangement = if (center) Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally) else Arrangement.spacedBy(8.dp),
    ) {
        items(options.size) { i ->
            val on = i == selected
            Text(
                options[i], style = LoType.small.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold),
                color = if (on) lo.bg else lo.ink,
                modifier = Modifier
                    .background(if (on) lo.ink else lo.card, CircleShape)
                    .then(if (on) Modifier else Modifier.border(1.dp, lo.border2, CircleShape))
                    .pressable(CircleShape) { onSelect(i) }
                    .padding(horizontal = 16.dp, vertical = 9.dp),
            )
        }
    }
}

@Composable
fun TopBar(title: String, onBack: (() -> Unit)?, modifier: Modifier = Modifier) {
    val lo = LocalLo.current
    Row(modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        if (onBack != null) IconBtn(Ph.Left, onBack, bordered = true, modifier = Modifier.background(lo.bg.copy(alpha = 0.7f), CircleShape))
        else Spacer(Modifier.width(8.dp))
        if (title.isNotBlank()) Text(title, style = LoType.section, color = lo.ink, modifier = Modifier.padding(start = 12.dp))
    }
}

/** Large page title block used by the four tab screens. */
@Composable
fun PageTitle(eyebrow: String, title: String, sub: String? = null) {
    val lo = LocalLo.current
    Column(Modifier.statusBarsPadding().padding(start = 20.dp, end = 20.dp, top = 20.dp, bottom = 6.dp)) {
        Eyebrow(eyebrow)
        Text(title, style = LoType.hero, color = lo.ink, modifier = Modifier.padding(top = 2.dp))
        if (sub != null) Text(sub, style = LoType.body, color = lo.grey, modifier = Modifier.padding(top = 4.dp))
    }
}

@Composable
fun SearchField(value: String, onChange: (String) -> Unit, hint: String, onSearch: () -> Unit, modifier: Modifier = Modifier) {
    val lo = LocalLo.current
    Row(
        modifier.fillMaxWidth().height(52.dp).background(lo.card, CircleShape).border(1.dp, lo.border2, CircleShape).padding(start = 18.dp, end = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Ic(Ph.Search, 20.dp, lo.grey)
        Spacer(Modifier.width(12.dp))
        androidx.compose.foundation.text.BasicTextField(
            value = value, onValueChange = onChange, singleLine = true,
            textStyle = LoType.body.copy(color = lo.ink, fontSize = 16.sp), cursorBrush = androidx.compose.ui.graphics.SolidColor(lo.signal),
            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(imeAction = androidx.compose.ui.text.input.ImeAction.Search),
            keyboardActions = androidx.compose.foundation.text.KeyboardActions(onSearch = { onSearch() }),
            modifier = Modifier.weight(1f),
            decorationBox = { inner ->
                if (value.isEmpty()) Text(hint, style = LoType.body.copy(fontSize = 16.sp), color = lo.grey)
                inner()
            },
        )
        if (value.isNotEmpty()) IconBtn(Ph.Close, { onChange("") }, size = 36.dp, iconSize = 16.dp, tint = lo.grey)
    }
}
