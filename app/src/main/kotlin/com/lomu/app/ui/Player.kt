package com.lomu.app.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.media3.common.Player
import com.lomu.app.lyrics.LyricsEntry
import com.lomu.app.lyrics.LyricsUtils
import com.lomu.app.models.MediaMetadata
import com.lomu.app.playback.PlayerConnection
import kotlinx.coroutines.delay

private fun MediaMetadata.artistLine() = artists.joinToString(", ") { it.name }

@Composable
fun MiniPlayer(onOpen: () -> Unit, modifier: Modifier = Modifier) {
    val lo = LocalLo.current
    val pc = LocalPlayer.current ?: return
    val meta by pc.mediaMetadata.collectAsState()
    val playing by pc.isPlaying.collectAsState()
    val m = meta ?: return
    var frac by remember { mutableStateOf(0f) }
    LaunchedEffect(pc, m.id) {
        while (true) {
            val d = pc.player.duration
            frac = if (d > 0) (pc.player.currentPosition.toFloat() / d).coerceIn(0f, 1f) else 0f
            delay(500)
        }
    }
    val shape = RoundedCornerShape(18.dp)
    Column(
        modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 8.dp)
            .background(lo.card, shape).border(1.dp, lo.line, shape).clip(shape)
            .pressable(shape, onClick = onOpen),
    ) {
        Row(Modifier.padding(start = 8.dp, end = 8.dp, top = 8.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Cover(m.thumbnailUrl, 46.dp, radius = 11.dp)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(m.title, style = LoType.body.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold), color = lo.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(m.artistLine(), style = LoType.small, color = lo.grey, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            IconBtn(if (playing) Ph.Pause else Ph.Play, { pc.togglePlayPause() }, size = 42.dp, iconSize = 18.dp, filled = true)
            IconBtn(Ph.Next, { pc.seekToNext() }, size = 42.dp, iconSize = 20.dp)
        }
        Box(Modifier.fillMaxWidth().height(2.dp).background(lo.line)) {
            Box(Modifier.fillMaxWidth(frac).fillMaxHeight().background(lo.signal))
        }
    }
}

@Composable
fun FullPlayer(onClose: () -> Unit) {
    val lo = LocalLo.current
    val pc = LocalPlayer.current ?: return
    val meta by pc.mediaMetadata.collectAsState()
    val playing by pc.isPlaying.collectAsState()
    val shuffle by pc.shuffleModeEnabled.collectAsState()
    val repeat by pc.repeatMode.collectAsState()
    val song by pc.currentSong.collectAsState(null)
    val m = meta
    var tab by remember { mutableStateOf(0) } // 0 art, 1 lyrics, 2 queue
    val liked = song?.song?.liked == true

    Box(Modifier.fillMaxSize().background(lo.bg)) {
        Ambient(m?.thumbnailUrl, height = 560.dp)
        Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().padding(horizontal = 24.dp)) {
            Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                IconBtn(Ph.Down, onClose, bordered = true)
                Spacer(Modifier.weight(1f))
                Eyebrow("Now playing")
                Spacer(Modifier.weight(1f))
                Spacer(Modifier.size(40.dp))
            }
            Spacer(Modifier.height(12.dp))
            Box(Modifier.fillMaxWidth(), Alignment.Center) {
                Chips(listOf("Artwork", "Lyrics", "Up next"), tab, { tab = it }, center = true)
            }
            Box(Modifier.weight(1f).fillMaxWidth().padding(vertical = 14.dp), Alignment.Center) {
                when (tab) {
                    0 -> Artwork(m?.thumbnailUrl, playing)
                    1 -> LyricsPanel(pc, m)
                    else -> QueuePanel(pc)
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(m?.title ?: "Nothing playing", style = LoType.title.copy(fontSize = 24.sp), color = lo.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(m?.artistLine().orEmpty(), style = LoType.body, color = lo.grey, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                IconBtn(if (liked) Ph.HeartFill else Ph.Heart, { pc.toggleLike() }, size = 48.dp, iconSize = 26.dp, tint = if (liked) lo.signal else lo.ink)
            }
            Spacer(Modifier.height(4.dp))
            SeekBar(pc)
            Row(Modifier.fillMaxWidth().padding(top = 4.dp, bottom = 16.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                IconBtn(Ph.Shuffle, { pc.player.shuffleModeEnabled = !pc.player.shuffleModeEnabled }, size = 48.dp, iconSize = 22.dp, tint = if (shuffle) lo.signal else lo.grey)
                IconBtn(Ph.Prev, { pc.seekToPrevious() }, size = 56.dp, iconSize = 28.dp)
                IconBtn(if (playing) Ph.Pause else Ph.Play, { pc.togglePlayPause() }, size = 76.dp, iconSize = 34.dp, filled = true)
                IconBtn(Ph.Next, { pc.seekToNext() }, size = 56.dp, iconSize = 28.dp)
                IconBtn(
                    if (repeat == Player.REPEAT_MODE_ONE) Ph.RepeatOne else Ph.Repeat,
                    {
                        pc.player.repeatMode = when (pc.player.repeatMode) {
                            Player.REPEAT_MODE_OFF -> Player.REPEAT_MODE_ALL
                            Player.REPEAT_MODE_ALL -> Player.REPEAT_MODE_ONE
                            else -> Player.REPEAT_MODE_OFF
                        }
                    },
                    size = 48.dp, iconSize = 22.dp, tint = if (repeat != Player.REPEAT_MODE_OFF) lo.signal else lo.grey,
                )
            }
        }
    }
}

/** Big square artwork that gently shrinks while paused. */
@Composable
private fun Artwork(url: String?, playing: Boolean) {
    val lo = LocalLo.current
    val scale by animateFloatAsState(if (playing) 1f else 0.88f, spring(dampingRatio = 0.7f, stiffness = 300f), label = "art")
    BoxWithConstraints(Modifier.fillMaxSize(), Alignment.Center) {
        val side = minOf(maxWidth, maxHeight)
        Box(
            Modifier.size(side).graphicsLayer { scaleX = scale; scaleY = scale }
                .shadow(if (lo.dark) 24.dp else 18.dp, RoundedCornerShape(28.dp), ambientColor = lo.ink, spotColor = lo.ink),
        ) { Cover(url, side, radius = 28.dp) }
    }
}

@Composable
private fun SeekBar(pc: PlayerConnection) {
    val lo = LocalLo.current
    var pos by remember { mutableStateOf(0L) }
    var dur by remember { mutableStateOf(0L) }
    var dragging by remember { mutableStateOf(false) }
    var drag by remember { mutableStateOf(0f) }
    LaunchedEffect(pc) {
        while (true) {
            if (!dragging) {
                pos = pc.player.currentPosition
                dur = pc.player.duration.coerceAtLeast(0L)
            }
            delay(300)
        }
    }
    Column {
        Slider(
            value = if (dragging) drag else if (dur > 0) pos.toFloat() / dur else 0f,
            onValueChange = { dragging = true; drag = it },
            onValueChangeFinished = { pc.seekTo((drag * dur).toLong()); dragging = false },
            colors = SliderDefaults.colors(thumbColor = lo.ink, activeTrackColor = lo.ink, inactiveTrackColor = lo.line),
        )
        Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(formatTime(if (dragging) (drag * dur).toLong() else pos), style = LoType.small, color = lo.grey)
            Text(formatTime(dur), style = LoType.small, color = lo.grey)
        }
    }
}

@Composable
private fun LyricsPanel(pc: PlayerConnection, m: MediaMetadata?) {
    val lo = LocalLo.current
    val helper = LocalLyrics.current
    val state by load(m?.id) {
        if (m == null || helper == null) Result.success(emptyList<LyricsEntry>())
        else runCatching { LyricsUtils.parseLyrics(helper.getLyrics(m).lyrics) }
    }
    var pos by remember { mutableStateOf(0L) }
    LaunchedEffect(pc) { while (true) { pos = pc.player.currentPosition; delay(200) } }
    when (val st = state) {
        is Load.Loading -> Loading()
        is Load.Err -> EmptyState(Ph.Lyrics, "No lyrics found")
        is Load.Ok -> {
            val lines = st.value
            if (lines.isEmpty()) EmptyState(Ph.Lyrics, "No lyrics found", "Lyrics appear here when a synced version exists.")
            else {
                val current = lines.indexOfLast { it.time <= pos }.coerceAtLeast(0)
                val listState = rememberLazyListState()
                LaunchedEffect(current) { listState.animateScrollToItem((current - 2).coerceAtLeast(0)) }
                LazyColumn(state = listState, modifier = Modifier.fillMaxSize()) {
                    itemsIndexed(lines) { i, l ->
                        Text(
                            l.text.ifBlank { "♪" },
                            style = LoType.title.copy(fontSize = 26.sp, lineHeight = 32.sp),
                            color = if (i == current) lo.ink else lo.grey.copy(alpha = 0.7f),
                            textAlign = TextAlign.Start,
                            modifier = Modifier.fillMaxWidth().pressable(RoundedCornerShape(10.dp)) { pc.seekTo(l.time) }.padding(vertical = 8.dp),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun QueuePanel(pc: PlayerConnection) {
    val windows by pc.queueWindows.collectAsState()
    val index by pc.currentMediaItemIndex.collectAsState()
    if (windows.isEmpty()) { EmptyState(Ph.Queue, "Queue is empty"); return }
    val listState = rememberLazyListState()
    LaunchedEffect(index) { listState.scrollToItem((index - 1).coerceAtLeast(0)) }
    LazyColumn(Modifier.fillMaxSize(), state = listState) {
        itemsIndexed(windows) { i, w ->
            val md = w.mediaItem.mediaMetadata
            MediaRow(md.title?.toString().orEmpty(), md.artist?.toString().orEmpty(), md.artworkUri?.toString(), active = i == index) { pc.player.seekToDefaultPosition(i) }
        }
    }
}
