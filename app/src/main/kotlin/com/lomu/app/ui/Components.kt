package com.lomu.app.ui

import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import com.lomu.app.models.toMediaMetadata
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ChevronLeft
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.Mic
import androidx.compose.material.icons.rounded.MoreHoriz
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.platform.LocalContext
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.HazeTint
import dev.chrisbanes.haze.hazeEffect
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.layout
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.compositionLocalOf
import coil3.SingletonImageLoader
import coil3.compose.AsyncImage
import coil3.request.ImageRequest
import coil3.request.allowHardware
import coil3.toBitmap
import androidx.palette.graphics.Palette
import androidx.compose.ui.input.pointer.pointerInput
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import com.music.innertube.models.AlbumItem
import com.music.innertube.models.ArtistItem
import com.music.innertube.models.PlaylistItem
import com.music.innertube.models.SongItem
import com.music.innertube.models.YTItem

@Composable
fun Ic(icon: Ph, size: Dp = 22.dp, tint: Color = LocalLo.current.ink, modifier: Modifier = Modifier) {
    Icon(icon.vector, contentDescription = null, tint = tint, modifier = modifier.size(size))
}

@Composable
fun IcV(icon: ImageVector, size: Dp = 22.dp, tint: Color = LocalLo.current.ink, modifier: Modifier = Modifier) {
    Icon(icon, contentDescription = null, tint = tint, modifier = modifier.size(size))
}

@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
fun Modifier.blockTouches(): Modifier = pointerInput(Unit) { awaitPointerEventScope { while (true) awaitPointerEvent() } }

fun Modifier.pressable(shape: Shape = RoundedCornerShape(10.dp), enabled: Boolean = true, role: Role = Role.Button, onClickLabel: String? = null, onLongClick: (() -> Unit)? = null, onClick: () -> Unit): Modifier = composed {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed) 0.97f else 1f, spring(dampingRatio = 0.65f, stiffness = 600f), label = "press")
    val fade by animateFloatAsState(if (pressed) 0.72f else 1f, label = "pressFade")
    this
        .graphicsLayer { scaleX = scale; scaleY = scale; alpha = fade }
        .clip(shape)
        .combinedClickable(interactionSource = source, indication = null, enabled = enabled, onClickLabel = onClickLabel, role = role, onLongClick = onLongClick, onClick = onClick)
}

fun Modifier.a11y(label: String, state: String? = null): Modifier = semantics {
    contentDescription = label
    if (state != null) stateDescription = state
}

fun iconLabel(name: String): String = when (val key = name.substringAfterLast('.')) {
    "FastForward" -> "Next"
    "FastRewind" -> "Previous"
    "KeyboardArrowDown" -> "Close"
    "Close" -> "Clear"
    "More", "MoreHoriz", "MoreVert" -> "More options"
    "ChatBubbleOutline" -> "Lyrics"
    "FormatListBulleted" -> "Queue"
    "ArrowBack", "ArrowBackIosNew", "ChevronLeft" -> "Back"
    else -> key.replace(Regex("([a-z0-9])([A-Z])"), "$1 $2").lowercase().replaceFirstChar { it.uppercase() }
}

@Composable
fun Modifier.minTouch(min: Dp = 44.dp): Modifier = layout { measurable, constraints ->
    val p = measurable.measure(constraints)
    val w = maxOf(p.width, min.roundToPx())
    val h = maxOf(p.height, min.roundToPx())
    layout(w, h) { p.place((w - p.width) / 2, (h - p.height) / 2) }
}

@Composable
fun IconBtn(
    icon: Ph, onClick: () -> Unit, size: Dp = 40.dp, iconSize: Dp = 20.dp,
    tint: Color = LocalLo.current.ink, bordered: Boolean = false, filled: Boolean = false, modifier: Modifier = Modifier,
    label: String = iconLabel(icon.name),
) {
    val lo = LocalLo.current
    Box(
        modifier.a11y(label).pressable(CircleShape, onClick = onClick).minTouch().size(size)
            .then(if (filled) Modifier.background(lo.signal, CircleShape) else Modifier)
            .then(if (bordered) Modifier.background(lo.surface2.copy(alpha = 0.85f), CircleShape) else Modifier),
        Alignment.Center,
    ) { Ic(icon, iconSize, if (filled) lo.onSignal else tint) }
}

@Composable
fun IconBtnV(icon: ImageVector, onClick: () -> Unit, size: Dp = 40.dp, iconSize: Dp = 24.dp, tint: Color = LocalLo.current.ink, modifier: Modifier = Modifier, label: String = iconLabel(icon.name)) {
    Box(modifier.a11y(label).pressable(CircleShape, onClick = onClick).minTouch().size(size), Alignment.Center) { IcV(icon, iconSize, tint) }
}

@Composable
fun Cover(url: String?, size: Dp, round: Boolean = false, modifier: Modifier = Modifier, radius: Dp = 12.dp, placeholderUrl: String? = null) {
    val lo = LocalLo.current
    val shape = if (round) CircleShape else RoundedCornerShape(radius)
    AsyncImage(
        model = url,
        placeholder = placeholderUrl?.let { coil3.compose.rememberAsyncImagePainter(it) },
        contentDescription = null,
        contentScale = ContentScale.Crop,
        modifier = modifier.size(size).clip(shape).background(lo.surface2).border(0.5.dp, lo.line.copy(alpha = 0.8f), shape),
    )
}

fun Modifier.coverShadow(radius: Dp, elevation: Dp = 18.dp): Modifier =
    shadow(elevation, RoundedCornerShape(radius), clip = false, ambientColor = Color.Black.copy(alpha = 0.5f), spotColor = Color.Black.copy(alpha = 0.5f))

@Composable
fun Ambient(url: String?, modifier: Modifier = Modifier, height: Dp = 380.dp, strength: Float? = null) {
    val lo = LocalLo.current
    if (url == null) return
    Box(modifier.fillMaxWidth().height(height)) {
        AsyncImage(
            model = url, contentDescription = null, contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize().blur(80.dp).alpha(strength ?: if (lo.dark) 0.42f else 0.30f),
        )
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent, lo.bg))))
    }
}

private val tintCache = java.util.concurrent.ConcurrentHashMap<String, Color>()

@Composable
fun rememberTint(url: String?): Color? {
    val ctx = LocalContext.current
    val tint by produceState<Color?>(url?.let { tintCache[it] }, url) {
        if (url == null) { value = null; return@produceState }
        tintCache[url]?.let { value = it; return@produceState }
        value = withContext(Dispatchers.IO) {
            runCatching {
                val req = ImageRequest.Builder(ctx).data(url).size(96).allowHardware(false).build()
                val bmp = SingletonImageLoader.get(ctx).execute(req).image?.toBitmap() ?: return@runCatching null
                val p = Palette.from(bmp).maximumColorCount(16).generate()
                (p.vibrantSwatch ?: p.mutedSwatch ?: p.dominantSwatch)?.rgb?.let { Color(it) }
            }.getOrNull()
        }?.also { tintCache[url] = it }
    }
    return tint
}

@Composable
fun Hairline(inset: Dp = 0.dp, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().padding(start = inset).height(0.5.dp).background(LocalLo.current.line))
}

@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier, action: String? = null, chevron: Boolean = true, onAction: (() -> Unit)? = null) {
    val lo = LocalLo.current
    Row(modifier.fillMaxWidth().padding(start = 20.dp, end = 12.dp, top = 32.dp, bottom = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        val hasAction = action != null && onAction != null
        Text(text, style = LoType.section, color = lo.ink, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = hasAction))
        if (action != null && onAction != null) {
            Text(action, style = LoType.body.copy(fontWeight = FontWeight.Normal), color = lo.signal, modifier = Modifier.pressable(CircleShape, onClick = onAction).padding(horizontal = 8.dp, vertical = 4.dp))
        } else if (chevron) {
            Icon(Icons.Rounded.ChevronRight, null, tint = lo.grey, modifier = Modifier.padding(start = 2.dp, top = 3.dp).size(22.dp))
        }
    }
}

@Composable
fun Eyebrow(text: String, modifier: Modifier = Modifier, accent: Boolean = false) =
    Text(text.uppercase(), style = LoType.eyebrow, color = if (accent) LocalLo.current.signal else LocalLo.current.grey, modifier = modifier)

@Composable
fun Loading() = Box(Modifier.fillMaxWidth().padding(48.dp), Alignment.Center) {
    CircularProgressIndicator(color = LocalLo.current.grey, strokeWidth = 2.dp, modifier = Modifier.size(26.dp))
}

@Composable
fun SkeletonBox(modifier: Modifier, shape: Shape = RoundedCornerShape(6.dp)) {
    val lo = LocalLo.current
    val a by androidx.compose.animation.core.rememberInfiniteTransition(label = "sk").animateFloat(
        0.45f, 1f,
        androidx.compose.animation.core.infiniteRepeatable(androidx.compose.animation.core.tween(850, easing = androidx.compose.animation.core.FastOutSlowInEasing), androidx.compose.animation.core.RepeatMode.Reverse),
        label = "sk",
    )
    Box(modifier.graphicsLayer { alpha = a }.background(lo.surface2, shape))
}

@Composable
fun SkeletonRows(count: Int = 8, round: Boolean = false) {
    Column {
        repeat(count) { i ->
            Row(Modifier.padding(start = 20.dp, end = 16.dp, top = 7.dp, bottom = 7.dp), verticalAlignment = Alignment.CenterVertically) {
                SkeletonBox(Modifier.size(52.dp), if (round) CircleShape else RoundedCornerShape(6.dp))
                Spacer(Modifier.width(14.dp))
                Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    SkeletonBox(Modifier.fillMaxWidth(if (i % 3 == 0) 0.55f else 0.7f).height(13.dp))
                    SkeletonBox(Modifier.fillMaxWidth(0.4f).height(11.dp))
                }
            }
        }
    }
}

@Composable
fun SkeletonShelves(shelves: Int = 2) {
    Column {
        repeat(shelves) {
            SkeletonBox(Modifier.padding(start = 20.dp, top = 18.dp, bottom = 12.dp).width(150.dp).height(20.dp))
            Row(Modifier.padding(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                repeat(3) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                        SkeletonBox(Modifier.fillMaxWidth().aspectRatio(1f), RoundedCornerShape(10.dp))
                        SkeletonBox(Modifier.fillMaxWidth(0.8f).height(12.dp))
                        SkeletonBox(Modifier.fillMaxWidth(0.5f).height(10.dp))
                    }
                }
            }
        }
    }
}

@Composable
fun SkeletonDetail() {
    Column(Modifier.fillMaxSize().statusBarsPadding().padding(top = 64.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        SkeletonBox(Modifier.size(230.dp), RoundedCornerShape(12.dp))
        Spacer(Modifier.height(18.dp))
        SkeletonBox(Modifier.width(200.dp).height(20.dp))
        Spacer(Modifier.height(8.dp))
        SkeletonBox(Modifier.width(120.dp).height(14.dp))
        Spacer(Modifier.height(20.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            SkeletonBox(Modifier.width(110.dp).height(44.dp), CircleShape)
            SkeletonBox(Modifier.width(110.dp).height(44.dp), CircleShape)
        }
        Spacer(Modifier.height(16.dp))
        SkeletonRows(5)
    }
}

@Composable
fun EmptyState(icon: Ph, title: String, hint: String? = null, modifier: Modifier = Modifier, action: (@Composable () -> Unit)? = null) {
    val lo = LocalLo.current
    Column(modifier.fillMaxWidth().padding(horizontal = 36.dp, vertical = 40.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Ic(icon, 44.dp, lo.grey.copy(alpha = 0.7f))
        Spacer(Modifier.height(6.dp))
        Text(title, style = LoType.body.copy(fontWeight = FontWeight.SemiBold, fontSize = 19.sp, lineHeight = 24.sp), color = lo.ink, textAlign = TextAlign.Center)
        if (hint != null) Text(hint, style = LoType.small.copy(fontSize = 15.sp, lineHeight = 20.sp), color = lo.grey, textAlign = TextAlign.Center)
        if (action != null) { Spacer(Modifier.height(10.dp)); action() }
    }
}

@Composable
fun ErrorBox(message: String, onRetry: (() -> Unit)? = null) =
    EmptyState(Ph.Warn, "Can't load this right now", message, action = onRetry?.let { r -> { Pill("Try again", r, filled = false) } })

fun artistLine(s: SongItem) = s.artists.joinToString(", ") { it.name }

fun subtitle(item: YTItem): String = when (item) {
    is SongItem -> artistLine(item)
    is AlbumItem -> listOfNotNull(item.artists?.joinToString(", ") { it.name }, item.year?.toString()).joinToString(" · ")
    is PlaylistItem -> item.author?.name ?: item.songCountText.orEmpty()
    is ArtistItem -> "Artist"
}

@Composable
private fun NowPlayingBars(tint: Color, modifier: Modifier = Modifier) = Ic(Ph.Waveform, 16.dp, tint, modifier)

@Composable
fun MediaRow(
    title: String, line: String, thumb: String?, trailing: String? = null, index: Int? = null, active: Boolean = false,
    separator: Boolean = true, pad: Dp = 20.dp, menu: MenuTarget? = null, flat: Boolean = false, modifier: Modifier = Modifier, onClick: () -> Unit,
) {
    val lo = LocalLo.current
    val openMenu = LocalTrackMenu.current
    val haptic = rememberHaptic()
    val inset = pad + if (index != null) 36.dp else 66.dp
    Column(modifier.fillMaxWidth().pressable(RoundedCornerShape(0.dp), onLongClick = menu?.let { m -> { haptic(true); openMenu(m) } }, onClick = onClick)) {
        Row(Modifier.fillMaxWidth().padding(start = pad, end = if (pad < 12.dp) 0.dp else 16.dp, top = 7.dp, bottom = 7.dp), verticalAlignment = Alignment.CenterVertically) {
            if (index != null) {
                Box(Modifier.width(36.dp)) {
                    if (active) NowPlayingBars(lo.signal) else Text("${index + 1}", style = LoType.body, color = lo.grey)
                }
            } else {
                Box {
                    Cover(thumb, 52.dp, radius = if (flat) 12.dp else 8.dp)
                    if (active) Box(Modifier.size(if (flat) 46.dp else 52.dp).background(Color(0x73000000), RoundedCornerShape(6.dp)), Alignment.Center) { NowPlayingBars(Color.White) }
                }
                Spacer(Modifier.width(14.dp))
            }
            Column(Modifier.weight(1f)) {
                Text(title, style = LoType.body, color = if (active) lo.signal else lo.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (line.isNotBlank()) Text(line, style = LoType.small, color = lo.grey, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            if (trailing != null) Text(trailing, style = LoType.small.copy(fontSize = 14.sp, lineHeight = 18.sp, fontWeight = FontWeight.Medium, letterSpacing = 0.sp), color = lo.ink, modifier = Modifier.padding(start = 10.dp))
        }
        if (separator && !flat) Hairline(inset)
    }
}

@Composable
fun playingId(): String? {
    val pc = LocalPlayer.current ?: return null
    val meta by pc.mediaMetadata.collectAsState()
    return meta?.id
}

@Composable
fun TrackRow(song: SongItem, index: Int? = null, flat: Boolean = false, modifier: Modifier = Modifier, onClick: () -> Unit) {
    MediaRow(song.title, artistLine(song), song.thumbnail, song.duration?.let { formatTime(it * 1000L) }, index, playingId() == song.id, menu = MenuTarget(song.toMediaMetadata()), flat = flat, modifier = modifier, onClick = onClick)
}

@Composable
fun ItemCard(item: YTItem, onClick: () -> Unit) {
    val lo = LocalLo.current
    val artist = item is ArtistItem
    Column(Modifier.width(160.dp).pressable(RoundedCornerShape(12.dp), onClick = onClick), horizontalAlignment = if (artist) Alignment.CenterHorizontally else Alignment.Start) {
        Cover(item.thumbnail, 160.dp, round = artist, radius = 12.dp)
        Spacer(Modifier.height(8.dp))
        Text(item.title, style = LoType.body.copy(fontSize = 15.sp), color = lo.ink, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = if (artist) TextAlign.Center else TextAlign.Start)
        Text(subtitle(item), style = LoType.small, color = lo.grey, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = if (artist) TextAlign.Center else TextAlign.Start)
    }
}

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
fun Pill(text: String, onClick: () -> Unit, filled: Boolean = true, icon: Ph? = null, modifier: Modifier = Modifier, iconV: ImageVector? = null, accent: Boolean = false) {
    val lo = LocalLo.current
    val bgc = if (accent) lo.signal else if (filled) lo.ink else lo.surface2
    val fg = if (accent) lo.onSignal else if (filled) lo.bg else lo.ink
    Row(
        modifier.height(48.dp)
            .background(bgc, RoundedCornerShape(12.dp))
            .pressable(RoundedCornerShape(12.dp), onClick = onClick)
            .padding(horizontal = 22.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center,
    ) {
        if (icon != null) { Ic(icon, 18.dp, fg); Spacer(Modifier.width(8.dp)) }
        if (iconV != null) { IcV(iconV, 22.dp, fg); Spacer(Modifier.width(6.dp)) }
        Text(text, style = LoType.body.copy(fontWeight = FontWeight.SemiBold), color = fg)
    }
}

@Composable
fun GlassCircle(icon: ImageVector, onClick: () -> Unit, size: Dp = 42.dp, tint: Color = LocalLo.current.ink, modifier: Modifier = Modifier, label: String = iconLabel(icon.name)) {
    val lo = LocalLo.current
    Box(
        modifier.a11y(label).pressable(CircleShape, onClick = onClick).minTouch().size(size).shadow(6.dp, CircleShape, clip = false, ambientColor = Color.Black.copy(alpha = 0.18f), spotColor = Color.Black.copy(alpha = 0.18f))
            .background(lo.card.copy(alpha = 0.92f), CircleShape).border(0.5.dp, lo.line.copy(alpha = 0.7f), CircleShape),
        Alignment.Center,
    ) { IcV(icon, size * 0.5f, tint) }
}

@Composable
fun Avatar(initial: String, onClick: () -> Unit, size: Dp = 36.dp) {
    Box(
        Modifier.a11y("Account and settings").pressable(CircleShape, onClick = onClick).minTouch().size(size).background(LocalLo.current.surface2, CircleShape),
        Alignment.Center,
    ) { Text(initial.take(2).uppercase(), style = LoType.body.copy(fontSize = 14.sp, fontWeight = FontWeight.SemiBold), color = LocalLo.current.ink) }
}

fun Modifier.glass(shape: Shape, lo: Lo): Modifier = composed {
    val haze = LocalHaze.current
    val base = shadow(14.dp, shape, clip = false, ambientColor = Color.Black.copy(alpha = 0.25f), spotColor = Color.Black.copy(alpha = 0.25f))
    (if (haze != null) base.clip(shape).hazeEffect(haze) {
        blurRadius = 28.dp
        backgroundColor = lo.card
        tints = listOf(HazeTint(lo.card.copy(alpha = 0.62f)))
    } else base.background(lo.card, shape))
        .border(0.5.dp, lo.line.copy(alpha = 0.8f), shape)
}

val LocalHaze = staticCompositionLocalOf<HazeState?> { null }

@Composable
fun Chips(options: List<String>, selected: Int, onSelect: (Int) -> Unit, modifier: Modifier = Modifier, center: Boolean = false) {
    val lo = LocalLo.current
    LazyRow(
        modifier.padding(horizontal = if (center) 0.dp else 0.dp),
        contentPadding = PaddingValues(horizontal = if (center) 0.dp else 20.dp),
        horizontalArrangement = if (center) Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally) else Arrangement.spacedBy(8.dp),
    ) {
        items(options.size) { i ->
            val on = i == selected
            Text(
                options[i], style = LoType.small.copy(fontWeight = FontWeight.SemiBold),
                color = if (on) lo.onSignal else lo.ink,
                modifier = Modifier
                    .background(if (on) lo.signal else lo.surface2, CircleShape)
                    .pressable(CircleShape) { onSelect(i) }
                    .padding(horizontal = 16.dp, vertical = 8.dp),
            )
        }
    }
}

@Composable
fun TopBar(title: String, onBack: (() -> Unit)?, modifier: Modifier = Modifier) {
    val lo = LocalLo.current
    Row(modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        if (onBack != null) GlassCircle(androidx.compose.material.icons.Icons.Rounded.ChevronLeft, onBack)
        if (title.isNotBlank()) Text(title, style = LoType.body.copy(fontWeight = FontWeight.SemiBold), color = lo.ink, modifier = Modifier.padding(start = 12.dp))
    }
}

@Composable
fun SearchField(value: String, onChange: (String) -> Unit, hint: String, onSearch: () -> Unit, modifier: Modifier = Modifier) {
    val lo = LocalLo.current
    val shape = CircleShape
    Row(
        modifier.fillMaxWidth().height(46.dp).background(lo.surface2, shape).padding(start = 14.dp, end = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Ic(Ph.Search, 19.dp, lo.grey)
        Spacer(Modifier.width(8.dp))
        androidx.compose.foundation.text.BasicTextField(
            value = value, onValueChange = onChange, singleLine = true,
            textStyle = LoType.body.copy(color = lo.ink, fontSize = 17.sp), cursorBrush = SolidColor(lo.signal),
            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(imeAction = androidx.compose.ui.text.input.ImeAction.Search),
            keyboardActions = androidx.compose.foundation.text.KeyboardActions(onSearch = { onSearch() }),
            modifier = Modifier.weight(1f).semantics { contentDescription = hint },
            decorationBox = { inner ->
                if (value.isEmpty()) Text(hint, style = LoType.body.copy(fontSize = 17.sp), color = lo.grey)
                inner()
            },
        )
        if (value.isNotEmpty()) IconBtn(Ph.Close, { onChange("") }, size = 32.dp, iconSize = 14.dp, tint = lo.grey)
        else IcV(Icons.Rounded.Mic, 20.dp, lo.grey, Modifier.padding(end = 6.dp))
    }
}

val LocalBottomInset = compositionLocalOf { 0.dp }

@Composable
fun bottomPad(): Dp = LocalBottomInset.current + 24.dp

object UiPrefs {
    private var newTab by androidx.compose.runtime.mutableStateOf<Boolean?>(null)

    @Composable
    fun showNew(ctx: android.content.Context): Boolean =
        newTab ?: ctx.getSharedPreferences("lomu", android.content.Context.MODE_PRIVATE).getBoolean("showNewTab", false)

    private var keepOffline by androidx.compose.runtime.mutableStateOf<Boolean?>(null)

    @Composable
    fun keepMixesOffline(ctx: android.content.Context): Boolean =
        keepOffline ?: ctx.getSharedPreferences("lomu", android.content.Context.MODE_PRIVATE).getBoolean("keepMixesOffline", false)

    fun setKeepMixesOffline(ctx: android.content.Context, on: Boolean) {
        keepOffline = on
        ctx.getSharedPreferences("lomu", android.content.Context.MODE_PRIVATE).edit().putBoolean("keepMixesOffline", on).apply()
    }

    fun setShowNew(ctx: android.content.Context, on: Boolean) {
        newTab = on
        ctx.getSharedPreferences("lomu", android.content.Context.MODE_PRIVATE).edit().putBoolean("showNewTab", on).apply()
    }
}
