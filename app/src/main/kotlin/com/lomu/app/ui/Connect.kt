package com.lomu.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lomu.app.sync.ConnectClient
import com.lomu.app.sync.Dev
import com.lomu.app.utils.HiResArt
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import org.json.JSONObject

val LocalConnect = staticCompositionLocalOf<ConnectClient?> { null }

/** Opens the device list (provided by the root so any screen can offer it). */
val LocalOpenDevices = staticCompositionLocalOf<() -> Unit> { {} }

private fun Dev.artistLine() = track?.artists?.joinToString(", ") { it.name }.orEmpty()
private fun deviceIcon(d: Dev) = if (d.kind == "android") Icons.Rounded.PhoneAndroid else Icons.Rounded.Computer

/** The device this phone is steering, or null while music plays here. */
@Composable
fun rememberRemote(): Dev? {
    val c = LocalConnect.current ?: return null
    val d by c.remote.collectAsState()
    return d
}

/** Position of [d] in seconds, advancing on its own while it plays. */
@Composable
private fun rememberRemotePosition(d: Dev): Double {
    var now by remember { mutableStateOf(System.currentTimeMillis()) }
    LaunchedEffect(d.playing) { while (d.playing) { now = System.currentTimeMillis(); delay(250) } }
    val extra = if (d.playing) (now - d.receivedAt).coerceAtLeast(0) / 1000.0 else 0.0
    val dur = d.duration.takeIf { it > 0 } ?: Double.MAX_VALUE
    return (d.position + extra).coerceAtMost(dur)
}

/** Capsule that replaces the mini player while another device plays. */
@Composable
fun RemoteMiniPlayer(d: Dev, onOpen: () -> Unit, modifier: Modifier = Modifier) {
    val lo = LocalLo.current
    val c = LocalConnect.current ?: return
    val shape = RoundedCornerShape(32.dp)
    val m = d.track
    Row(
        modifier.fillMaxWidth().height(52.dp).glass(shape, lo).a11y("Open remote player").pressable(shape, onClick = onOpen).padding(start = 10.dp, end = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Cover(m?.thumbnailUrl, 34.dp, radius = 8.dp)
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(m?.title ?: "Nothing playing", style = LoType.sub.copy(fontSize = 13.sp, lineHeight = 16.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-0.2).sp), color = lo.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Row(verticalAlignment = Alignment.CenterVertically) {
                IcV(deviceIcon(d), 12.dp, lo.signal)
                Spacer(Modifier.width(4.dp))
                Text(d.name, style = LoType.small.copy(fontSize = 12.sp, lineHeight = 14.sp, fontWeight = FontWeight.Medium), color = lo.signal, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        PlayPauseBtn(d.playing, { c.send(d.id, "toggle") }, size = 44.dp, iconSize = 28.dp)
        IconBtnV(Icons.Rounded.FastForward, { c.send(d.id, "next") }, size = 44.dp, iconSize = 28.dp)
    }
}

/** Full-screen controller for another device. Same layout as the phone's own player; the controls steer [d]. */
@Composable
fun RemotePlayer(d: Dev, onClose: () -> Unit) = CompositionLocalProvider(LocalLo provides LegacyDarkLo.copy(grey = Color.White.copy(alpha = 0.72f))) {
    val lo = LocalLo.current
    val c = LocalConnect.current ?: return@CompositionLocalProvider
    val openDevices = LocalOpenDevices.current
    val haptic = rememberHaptic()
    val sub = lo.grey
    val m = d.track
    val pos = rememberRemotePosition(d)
    var drag by remember { mutableStateOf<Float?>(null) }
    var mode by remember { mutableStateOf(0) } // 0 artwork, 2 playing next
    val dur = d.duration
    val frac = drag ?: if (dur > 0) (pos / dur).toFloat().coerceIn(0f, 1f) else 0f
    val art by produceState<String?>(HiResArt.fallback(m?.thumbnailUrl), m?.id) {
        value = HiResArt.fallback(m?.thumbnailUrl)
        m?.let { value = HiResArt.best(it.title, it.artists.map { a -> a.name }, it.thumbnailUrl) }
    }
    val skipX = remember { Animatable(0f) }
    val skipScope = rememberCoroutineScope()

    val (dragY, dragMod) = rememberDismissDrag(onClose)
    Box(Modifier.fillMaxSize().graphicsLayer { translationY = dragY.value; alpha = 1f - (dragY.value / (size.height * 2f)).coerceIn(0f, 0.4f) }.background(lo.bg).blockTouches()) {
        val tint = CoverWash(m?.thumbnailUrl)
        Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().padding(horizontal = 24.dp)) {
            Box(Modifier.fillMaxWidth().height(52.dp).then(dragMod).a11y("Close player").pressable(RoundedCornerShape(4.dp), onClick = onClose), Alignment.Center) {
                Box(Modifier.width(36.dp).height(5.dp).background(sub.copy(alpha = 0.6f), RoundedCornerShape(3.dp)))
            }
            Spacer(Modifier.height(4.dp))
            if (mode == 2) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Cover(m?.thumbnailUrl, 48.dp, radius = 5.dp)
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(m?.title ?: "Nothing playing", style = LoType.body.copy(fontWeight = FontWeight.SemiBold), color = lo.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(d.artistLine(), style = LoType.sub, color = sub, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
                Row(Modifier.fillMaxWidth().padding(top = 18.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("Playing Next", style = LoType.body.copy(fontWeight = FontWeight.SemiBold), color = lo.ink, modifier = Modifier.weight(1f))
                    ToggleChip(Icons.Rounded.Shuffle, d.shuffle, "Shuffle") { c.send(d.id, JSONObject().put("type", "shuffle").put("on", !d.shuffle)) }
                    Spacer(Modifier.width(8.dp))
                    ToggleChip(if (d.repeat == "one") Icons.Rounded.RepeatOne else Icons.Rounded.Repeat, d.repeat != "off", if (d.repeat == "one") "Repeat one" else "Repeat") {
                        c.send(d.id, JSONObject().put("type", "repeat").put("mode", when (d.repeat) { "off" -> "all"; "all" -> "one"; else -> "off" }))
                    }
                }
                Box(Modifier.weight(1f).fillMaxWidth(), Alignment.Center) {
                    Text("The queue is on ${d.name}", style = LoType.body, color = sub)
                }
            } else {
                Box(
                    Modifier.weight(1f).fillMaxWidth().then(dragMod).pointerInput(d.id) {
                        detectHorizontalDragGestures(
                            onDragEnd = {
                                skipScope.launch {
                                    val go = size.width * 0.22f
                                    if (skipX.value < -go) { haptic(true); c.send(d.id, "next") } else if (skipX.value > go) { haptic(true); c.send(d.id, "prev") }
                                    skipX.animateTo(0f, spring(dampingRatio = 0.7f, stiffness = 380f))
                                }
                            },
                            onDragCancel = { skipScope.launch { skipX.animateTo(0f, spring(dampingRatio = 0.7f, stiffness = 380f)) } },
                        ) { change, dx -> change.consume(); skipScope.launch { skipX.snapTo(skipX.value + dx) } }
                    },
                    Alignment.Center,
                ) {
                    Box(Modifier.fillMaxSize().graphicsLayer { translationX = skipX.value * 0.7f; rotationZ = skipX.value / 60f }) { Artwork(art, d.playing, tint, m?.thumbnailUrl) }
                }
                Spacer(Modifier.height(18.dp))
                Column(Modifier.fillMaxWidth()) {
                    Text(m?.title ?: "Nothing playing", style = LoType.playerTitle.copy(fontSize = 21.sp, lineHeight = 26.sp), color = lo.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(d.artistLine(), style = LoType.body.copy(fontSize = 19.sp, lineHeight = 24.sp), color = sub, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
            Spacer(Modifier.height(10.dp))

            // Seek
            val dragging = drag != null
            val knob by animateDpAsState(if (dragging) 18.dp else 10.dp, spring(dampingRatio = 0.6f, stiffness = 500f), label = "rknob")
            val thick by animateDpAsState(if (dragging) 8.dp else 4.dp, spring(stiffness = 600f), label = "rthick")
            BoxWithConstraints(
                Modifier.fillMaxWidth().height(22.dp)
                    .pointerInput(dur) { detectTapGestures { o -> if (dur > 0) c.send(d.id, JSONObject().put("type", "seek").put("position", o.x / size.width * dur)) } }
                    .pointerInput(dur) {
                        detectHorizontalDragGestures(
                            onDragStart = { o -> drag = (o.x / size.width).coerceIn(0f, 1f) },
                            onDragEnd = { drag?.let { f -> c.send(d.id, JSONObject().put("type", "seek").put("position", f * dur)) }; drag = null },
                            onDragCancel = { drag = null },
                        ) { change, _ -> drag = (change.position.x / size.width).coerceIn(0f, 1f) }
                    },
                Alignment.CenterStart,
            ) {
                Box(Modifier.fillMaxWidth().height(thick).background(lo.grey.copy(alpha = 0.3f), CircleShape))
                Box(Modifier.fillMaxWidth(frac).height(thick).background(lo.ink.copy(alpha = 0.85f), CircleShape))
                Box(Modifier.offset(x = (maxWidth - knob) * frac).size(knob).background(lo.ink, CircleShape))
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(formatTime(((drag?.let { it * dur } ?: pos) * 1000).toLong()), style = LoType.caption.copy(fontSize = 11.sp), color = lo.grey)
                Text("-" + formatTime(((dur - (drag?.let { it * dur } ?: pos)).coerceAtLeast(0.0) * 1000).toLong()), style = LoType.caption.copy(fontSize = 11.sp), color = lo.grey)
            }

            Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically) {
                IconBtnV(Icons.Rounded.FastRewind, { c.send(d.id, "prev") }, size = 72.dp, iconSize = 52.dp)
                PlayPauseBtn(d.playing, { c.send(d.id, "toggle") }, size = 84.dp, iconSize = 64.dp)
                IconBtnV(Icons.Rounded.FastForward, { c.send(d.id, "next") }, size = 72.dp, iconSize = 52.dp)
            }

            // Volume of the remote device
            var vol by remember(d.id) { mutableStateOf(d.volume.toFloat()) }
            LaunchedEffect(d.volume) { vol = d.volume.toFloat() }
            fun setVol(x: Float, w: Int, send: Boolean) {
                vol = (x / w).coerceIn(0f, 1f)
                if (send) c.send(d.id, JSONObject().put("type", "volume").put("volume", vol.toDouble()))
            }
            Row(Modifier.fillMaxWidth().padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                IcV(Icons.Rounded.VolumeMute, 16.dp, lo.grey)
                BoxWithConstraints(
                    Modifier.weight(1f).height(26.dp).padding(horizontal = 10.dp)
                        .pointerInput(Unit) { detectTapGestures { o -> setVol(o.x, size.width, true) } }
                        .pointerInput(Unit) { detectHorizontalDragGestures(onDragEnd = { c.send(d.id, JSONObject().put("type", "volume").put("volume", vol.toDouble())) }) { change, _ -> setVol(change.position.x, size.width, false) } },
                    Alignment.CenterStart,
                ) {
                    Box(Modifier.fillMaxWidth().height(4.dp).background(lo.grey.copy(alpha = 0.3f), CircleShape))
                    Box(Modifier.fillMaxWidth(vol).height(4.dp).background(lo.ink.copy(alpha = 0.85f), CircleShape))
                    Box(Modifier.offset(x = (maxWidth - 10.dp) * vol).size(10.dp).background(lo.ink, CircleShape))
                }
                IcV(Icons.Rounded.VolumeUp, 16.dp, lo.grey)
            }
            // Same two buttons as the phone's own player; the device button shows where it is playing.
            Row(Modifier.fillMaxWidth().padding(top = 6.dp, bottom = 14.dp), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically) {
                Row(Modifier.a11y("Playing on ${d.name}").pressable(RoundedCornerShape(24.dp), onClick = openDevices).minTouch().padding(horizontal = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    IcV(Icons.Rounded.Devices, 24.dp, lo.signal)
                    Spacer(Modifier.width(6.dp))
                    Text(d.name, style = LoType.small.copy(fontWeight = FontWeight.SemiBold), color = lo.signal, maxLines = 1)
                }
                IconBtnV(Icons.Rounded.FormatListBulleted, { mode = if (mode == 2) 0 else 2 }, size = 48.dp, iconSize = 24.dp, tint = if (mode == 2) lo.signal else sub)
            }
        }
    }
}

/** Bottom sheet: "This phone" and every other device on the account. Tapping one moves the music there. */
@Composable
fun DevicesSheet(onDismiss: () -> Unit) {
    val lo = LocalLo.current
    val sheet = rememberSheetState(onDismiss)
    val c = LocalConnect.current ?: return
    val state by c.devices.collectAsState()
    val remote by c.remote.collectAsState()
    val localActive = remote == null
    val others = state.list.filter { it.id != c.selfId }
    SheetHost(sheet) {
            Box(Modifier.align(Alignment.CenterHorizontally).width(36.dp).height(5.dp).background(lo.grey.copy(alpha = 0.5f), RoundedCornerShape(3.dp)))
            Spacer(Modifier.height(14.dp))
            Text("Connect to a device", style = LoType.playerTitle.copy(fontSize = 20.sp), color = lo.ink)
            if (!state.online) Text("Offline", style = LoType.small, color = lo.grey, modifier = Modifier.padding(top = 4.dp))
            Spacer(Modifier.height(10.dp))
            DeviceRow(Icons.Rounded.PhoneAndroid, "This phone", if (localActive) "Playing here" else "Tap to play here", localActive, false) { c.transferTo(c.selfId); sheet.dismiss() }
            others.forEach { d ->
                Hairline(44.dp)
                val on = remote?.id == d.id
                DeviceRow(deviceIcon(d), d.name, (if (d.playing) "Playing" else if (d.track != null) "Paused" else "Idle") + (d.track?.let { " · ${it.title}" } ?: ""), on, d.playing) { c.transferTo(d.id); sheet.dismiss() }
            }
            if (others.isEmpty()) DeviceRow(Icons.Rounded.Language, "Web", "Offline", false, false) { }
    }
}

@Composable
private fun DeviceRow(icon: androidx.compose.ui.graphics.vector.ImageVector, name: String, sub: String, selected: Boolean, playing: Boolean, onClick: () -> Unit) {
    val lo = LocalLo.current
    val tint = if (selected) lo.signal else lo.ink
    Row(Modifier.fillMaxWidth().pressable(RoundedCornerShape(12.dp), onClick = onClick).padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        IcV(icon, 26.dp, tint)
        Spacer(Modifier.width(18.dp))
        Column(Modifier.weight(1f)) {
            Text(name, style = LoType.body.copy(fontWeight = FontWeight.SemiBold), color = tint, maxLines = 1)
            Text(sub, style = LoType.small, color = if (selected) lo.signal else lo.grey, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        if (playing) IcV(Icons.Rounded.VolumeUp, 20.dp, lo.signal)
    }
}
