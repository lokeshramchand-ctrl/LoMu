package com.lomu.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lomu.app.extensions.toMediaItem
import com.lomu.app.models.toMediaMetadata
import com.lomu.app.sync.WPlay
import com.lomu.app.sync.WrappedStats
import com.lomu.app.sync.buildWrapped
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext

private fun span(min: Int): Pair<String, String> =
    if (min >= 120) java.text.NumberFormat.getIntegerInstance().format(Math.round(min / 60.0)) to "hours" else min.toString() to (if (min == 1) "minute" else "minutes")

private fun hourLabel(h: Int) = "${if (h % 12 == 0) 12 else h % 12}${if (h < 12) "am" else "pm"}"

@Composable
private fun rememberWrappedPlays(): List<WPlay>? {
    val player = LocalPlayer.current
    val plays by remember(player) {
        (player?.database?.events() ?: flowOf(emptyList())).map { list ->
            withContext(Dispatchers.Default) {
                list.map { e ->
                    val dur = e.song.song.duration * 1000L
                    val completed = if (dur > 0) e.event.playTime >= dur * 0.85 else e.event.playTime >= 100_000
                    WPlay(e.song.toMediaMetadata(), e.event.timestamp.atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli(),
                        e.event.playTime, completed, !completed && e.event.playTime < 30_000)
                }
            }
        }
    }.collectAsState(null as List<WPlay>?)
    return plays
}

@Composable
fun WrappedScreen() {
    val lo = LocalLo.current
    val nav = LocalNav.current
    val player = LocalPlayer.current
    val plays = rememberWrappedPlays()
    var year by remember { mutableStateOf<Int?>(java.time.Year.now().value) }
    var all by remember { mutableStateOf(false) }
    val stats: WrappedStats? = remember(plays, year, all) { plays?.let { buildWrapped(it, if (all) null else year) } }
    val years = remember(plays) { plays?.let { l -> l.map { java.time.Instant.ofEpochMilli(it.at).atZone(java.time.ZoneId.systemDefault()).year }.distinct().sortedDescending() }.orEmpty() }
    LaunchedEffect(years) { if (years.isNotEmpty() && year !in years) year = years.first() }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = bottomPad())) {
        item { BackTitle("Create", "Your Wrapped", nav::pop) }
        item {
            Row(Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                years.forEach { y -> Chip(y.toString(), !all && year == y) { all = false; year = y } }
                Chip("All time", all) { all = true }
            }
        }
        if (plays == null) item { Text("Counting every song...", style = LoType.sub, color = lo.grey, modifier = Modifier.padding(20.dp)) }
        else if (stats == null) item { EmptyState(Ph.Sparkles, "Nothing listened to yet") }
        else {
            val time = span(stats.minutes)
            item {
                Panel(tileColor(0)) {
                    Eyebrow("You listened for")
                    Text(time.first, style = LoType.hero.copy(fontSize = 64.sp, lineHeight = 68.sp), color = lo.ink)
                    Text(time.second, style = LoType.title, color = lo.ink)
                    Text("${stats.plays} songs finished across ${stats.activeDays} days: ${stats.songs} different songs by ${stats.artists} artists.", style = LoType.sub, color = lo.grey)
                }
            }
            stats.topArtists.firstOrNull()?.let { top ->
                item {
                    Panel(lo.surface2) {
                        Eyebrow("Your top artist")
                        Text(top.name, style = LoType.hero, color = lo.ink, maxLines = 2, overflow = TextOverflow.Ellipsis)
                        Text("${Math.round(stats.topArtistShare * 100)}% of your listening time, ${top.plays} finished songs.", style = LoType.sub, color = lo.grey)
                        stats.topArtists.drop(1).forEachIndexed { i, a ->
                            Row(Modifier.fillMaxWidth().padding(top = 6.dp)) {
                                Text("${i + 2}", style = LoType.sub, color = lo.grey, modifier = Modifier.width(28.dp))
                                Text(a.name, style = LoType.sub, color = lo.ink, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                                Text("${a.plays} songs", style = LoType.small, color = lo.grey)
                            }
                        }
                    }
                }
            }
            if (stats.topSongs.isNotEmpty()) item {
                Panel(tileColor(1)) {
                    Eyebrow("Your top songs")
                    stats.topSongs.forEachIndexed { i, s ->
                        Row(Modifier.fillMaxWidth().pressable(RoundedCornerShape(8.dp)) {
                            val tracks = stats.topSongs.map { it.track }
                            player?.playMediaItems("Your top songs", tracks.map { it.toMediaItem() }, i)
                        }.padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text("${i + 1}", style = LoType.sub, color = lo.grey, modifier = Modifier.width(28.dp))
                            Column(Modifier.weight(1f)) {
                                Text(s.track.title, style = LoType.sub.copy(fontWeight = FontWeight.SemiBold), color = lo.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text(s.track.artists.joinToString { it.name }, style = LoType.small, color = lo.grey, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                            Text("${s.plays}×", style = LoType.small, color = lo.grey)
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    Pill("Play my top ${stats.topSongs.size}", { player?.playMediaItems("Your top songs", stats.topSongs.map { it.track.toMediaItem() }) }, accent = true, icon = Ph.Play)
                }
            }
            item {
                Panel(tileColor(2)) {
                    Eyebrow("You are a")
                    Text(stats.personaTitle, style = LoType.hero.copy(fontSize = 40.sp, lineHeight = 44.sp), color = lo.ink)
                    Text(stats.personaLine + (stats.peakHour?.let { " Your busiest hour is ${hourLabel(it)}." } ?: ""), style = LoType.sub, color = lo.grey)
                    val max = (stats.hourMs.max()).coerceAtLeast(1L).toFloat()
                    Row(Modifier.fillMaxWidth().height(80.dp).padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.Bottom) {
                        stats.hourMs.forEachIndexed { h, v ->
                            Box(Modifier.weight(1f).fillMaxHeight((v / max).coerceAtLeast(0.04f)).background(if (h == stats.peakHour) lo.signal else lo.ink.copy(alpha = 0.18f), RoundedCornerShape(topStart = 3.dp, topEnd = 3.dp)))
                        }
                    }
                }
            }
            item {
                Panel(tileColor(3)) {
                    Fact("${stats.longestStreak}", "day streak, your longest")
                    stats.busiestMonth?.let { Fact(it.first, "your biggest month, ${span(it.second).first} ${span(it.second).second}") }
                    stats.busiestDay?.let { Fact(it.first, "your biggest day, ${span(it.second).first} ${span(it.second).second}") }
                    Fact("${stats.newArtists}", if (all) "artists you have played" else "new artists discovered")
                    Fact("${Math.round(stats.skipRate * 100)}%", "of songs skipped early")
                }
            }
        }
    }
}

@Composable
private fun Panel(fill: Color, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp).fillMaxWidth().background(fill, RoundedCornerShape(22.dp)).padding(20.dp), verticalArrangement = Arrangement.spacedBy(4.dp), content = content)
}

@Composable
private fun Eyebrow(text: String) {
    Text(text.uppercase(), style = LoType.small.copy(fontWeight = FontWeight.SemiBold, letterSpacing = 1.sp), color = LocalLo.current.grey)
}

@Composable
private fun Fact(big: String, line: String) {
    val lo = LocalLo.current
    Column(Modifier.padding(vertical = 6.dp)) {
        Text(big, style = LoType.title, color = lo.ink)
        Text(line, style = LoType.small, color = lo.grey)
    }
}

@Composable
private fun Chip(text: String, on: Boolean, onClick: () -> Unit) {
    val lo = LocalLo.current
    val shape = RoundedCornerShape(50)
    Text(text, style = LoType.sub.copy(fontWeight = FontWeight.Medium), color = if (on) lo.onSignal else lo.ink,
        modifier = Modifier.background(if (on) lo.signal else lo.surface2, shape).pressable(shape, onClick = onClick).padding(horizontal = 16.dp, vertical = 8.dp))
}
