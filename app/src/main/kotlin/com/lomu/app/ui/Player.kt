package com.lomu.app.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
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
    Row(
        modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp)
            .clip(CircleShape).background(lo.ink).clickable(onClick = onOpen).padding(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Cover(m.thumbnailUrl, 44.dp, round = true)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(m.title, style = LoType.body, color = lo.bg, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(m.artistLine(), style = LoType.small, color = lo.grey, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        RoundButton(if (playing) "⏸" else "▶", 44, filled = false) { pc.togglePlayPause() }
        RoundButton("⏭", 44, filled = false) { pc.seekToNext() }
    }
}

@Composable
fun RoundButton(glyph: String, size: Int = 56, filled: Boolean = false, tint: androidx.compose.ui.graphics.Color? = null, onClick: () -> Unit) {
    val lo = LocalLo.current
    Box(
        Modifier.size(size.dp).clip(CircleShape).then(if (filled) Modifier.background(lo.ink) else Modifier).clickable(onClick = onClick),
        Alignment.Center,
    ) {
        Text(glyph, fontSize = (size * 0.4f).sp, color = tint ?: if (filled) lo.bg else if (lo.dark) lo.ink else lo.bg.let { lo.ink })
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

    Column(Modifier.fillMaxSize().background(lo.bg).statusBarsPadding().navigationBarsPadding().padding(horizontal = 24.dp)) {
        Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("⌄", style = LoType.title, color = lo.ink, modifier = Modifier.clip(CircleShape).clickable(onClick = onClose).padding(horizontal = 14.dp))
            Spacer(Modifier.weight(1f))
            listOf("Art", "Lyrics", "Queue").forEachIndexed { i, t ->
                Text(
                    t, style = LoType.body, color = if (tab == i) lo.ink else lo.grey,
                    modifier = Modifier.clip(CircleShape).clickable { tab = i }.padding(horizontal = 10.dp, vertical = 6.dp),
                )
            }
        }
        Box(Modifier.weight(1f).fillMaxWidth(), Alignment.Center) {
            when (tab) {
                0 -> Vinyl(m?.thumbnailUrl, playing)
                1 -> LyricsPanel(pc, m)
                else -> QueuePanel(pc)
            }
        }
        Text(m?.title ?: "Nothing playing", style = LoType.title, color = lo.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(m?.artistLine().orEmpty(), style = LoType.body, color = lo.grey, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Spacer(Modifier.height(8.dp))
        SeekBar(pc)
        Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            RoundButton("⇄", 48, tint = if (shuffle) lo.ink else lo.grey) { pc.player.shuffleModeEnabled = !pc.player.shuffleModeEnabled }
            RoundButton("⏮", 56) { pc.seekToPrevious() }
            RoundButton(if (playing) "⏸" else "▶", 72, filled = true) { pc.togglePlayPause() }
            RoundButton("⏭", 56) { pc.seekToNext() }
            RoundButton(if (repeat == Player.REPEAT_MODE_ONE) "🔂" else "⟳", 48, tint = if (repeat != Player.REPEAT_MODE_OFF) lo.ink else lo.grey) {
                pc.player.repeatMode = when (pc.player.repeatMode) {
                    Player.REPEAT_MODE_OFF -> Player.REPEAT_MODE_ALL
                    Player.REPEAT_MODE_ALL -> Player.REPEAT_MODE_ONE
                    else -> Player.REPEAT_MODE_OFF
                }
            }
        }
        Row(Modifier.fillMaxWidth().padding(bottom = 12.dp), horizontalArrangement = Arrangement.Center) {
            val liked = song?.song?.liked == true
            Pill(if (liked) "♥ Liked" else "♡ Like", { pc.toggleLike() }, filled = liked)
        }
    }
}

@Composable
private fun Vinyl(url: String?, playing: Boolean) {
    val lo = LocalLo.current
    var angle by remember { mutableStateOf(0f) }
    LaunchedEffect(playing) {
        while (playing) { delay(16); angle = (angle + 0.6f) % 360f }
    }
    Box(Modifier.size(300.dp).rotate(angle).clip(CircleShape).background(lo.ink), Alignment.Center) {
        Cover(url, 210.dp, round = true)
        Box(Modifier.size(26.dp).clip(CircleShape).background(lo.bg))
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
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
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
        is Load.Err -> ErrorBox("No lyrics found")
        is Load.Ok -> {
            val lines = st.value
            if (lines.isEmpty()) ErrorBox("No lyrics found")
            else {
                val current = lines.indexOfLast { it.time <= pos }.coerceAtLeast(0)
                val listState = rememberLazyListState()
                LaunchedEffect(current) { listState.animateScrollToItem((current - 2).coerceAtLeast(0)) }
                LazyColumn(state = listState, modifier = Modifier.fillMaxSize()) {
                    itemsIndexed(lines) { i, l ->
                        Text(
                            l.text.ifBlank { "♪" },
                            fontSize = 22.sp, style = LoType.title,
                            color = if (i == current) lo.ink else lo.grey,
                            textAlign = TextAlign.Start,
                            modifier = Modifier.fillMaxWidth().clickable { pc.seekTo(l.time) }.padding(vertical = 8.dp),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun QueuePanel(pc: PlayerConnection) {
    val lo = LocalLo.current
    val windows by pc.queueWindows.collectAsState()
    val index by pc.currentMediaItemIndex.collectAsState()
    LazyColumn(Modifier.fillMaxSize()) {
        itemsIndexed(windows) { i, w ->
            val md = w.mediaItem.mediaMetadata
            Row(Modifier.fillMaxWidth().clickable { pc.player.seekToDefaultPosition(i) }.padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Cover(md.artworkUri?.toString(), 44.dp)
                Spacer(Modifier.width(12.dp))
                Column {
                    Text(md.title?.toString().orEmpty(), style = LoType.body, color = if (i == index) lo.ink else lo.grey, maxLines = 1)
                    Text(md.artist?.toString().orEmpty(), style = LoType.small, color = lo.grey, maxLines = 1)
                }
            }
        }
    }
}
