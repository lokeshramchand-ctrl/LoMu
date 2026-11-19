package com.lomu.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun Welcome(onStart: () -> Unit) {
    val lo = LocalLo.current
    Column(Modifier.fillMaxSize().background(lo.bg).statusBarsPadding().navigationBarsPadding().padding(28.dp)) {
        Spacer(Modifier.weight(1f))
        Box(Modifier.size(68.dp).background(lo.ink, RoundedCornerShape(20.dp)), Alignment.Center) { Ic(Ph.Waveform, 34.dp, lo.bg) }
        Spacer(Modifier.height(24.dp))
        Text("LoMu", style = LoType.hero.copy(fontSize = 56.sp, lineHeight = 58.sp, letterSpacing = (-2).sp), color = lo.ink)
        Text("Your music, everywhere.", style = LoType.title, color = lo.grey)
        Spacer(Modifier.height(32.dp))
        listOf(
            Ph.Headphones to "Plays anonymously from YouTube Music. No ads, no Google account.",
            Ph.Cloud to "Syncs your likes and playlists to your own server.",
            Ph.Sparkles to "Mixes, radio and lyrics that learn what you like.",
        ).forEach { (icon, text) ->
            Row(Modifier.padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(40.dp).background(lo.surface2, RoundedCornerShape(12.dp)).border(1.dp, lo.line, RoundedCornerShape(12.dp)), Alignment.Center) { Ic(icon, 20.dp) }
                Spacer(Modifier.width(14.dp))
                Text(text, style = LoType.body, color = lo.ink, modifier = Modifier.weight(1f))
            }
        }
        Spacer(Modifier.weight(1f))
        Pill("Get started", onStart, icon = Ph.Right, modifier = Modifier.fillMaxWidth().height(52.dp))
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
fun LoMuRoot(seenWelcome: Boolean, onWelcomeDone: () -> Unit) {
    val lo = LocalLo.current
    val nav = remember { Nav() }
    var showPlayer by remember { mutableStateOf(false) }
    var welcome by remember { mutableStateOf(!seenWelcome) }
    val pc = LocalPlayer.current
    val meta = pc?.mediaMetadata?.collectAsState()?.value

    if (welcome) {
        Welcome { welcome = false; onWelcomeDone() }
        return
    }
    BackHandler(enabled = showPlayer || nav.canPop) {
        if (showPlayer) showPlayer = false else nav.pop()
    }
    CompositionLocalProvider(LocalNav provides nav) {
        Box(Modifier.fillMaxSize().background(lo.bg)) {
            Column(Modifier.fillMaxSize()) {
                Box(Modifier.weight(1f)) {
                    AnimatedContent(
                        targetState = nav.current,
                        transitionSpec = { fadeIn(tween(220)) togetherWith fadeOut(tween(120)) },
                        label = "screen",
                    ) { screen ->
                        when (screen) {
                            Screen.Home -> HomeScreen()
                            Screen.Search -> SearchScreen()
                            Screen.Library -> LibraryScreen()
                            Screen.Settings -> SettingsScreen()
                            is Screen.Album -> AlbumScreen(screen.id)
                            is Screen.Artist -> ArtistScreen(screen.id)
                            is Screen.Playlist -> PlaylistScreen(screen.id)
                            is Screen.LocalPlaylist -> LocalPlaylistScreen(screen.id)
                            Screen.Import -> ImportScreen()
                        }
                    }
                }
                if (meta != null) MiniPlayer({ showPlayer = true })
                TabBar(nav)
            }
            AnimatedVisibility(
                visible = showPlayer,
                enter = slideInVertically(tween(320)) { it } + fadeIn(tween(200)),
                exit = slideOutVertically(tween(260)) { it } + fadeOut(tween(200)),
            ) { FullPlayer { showPlayer = false } }
        }
    }
}

private data class TabDef(val label: String, val icon: Ph, val screen: Screen)

@Composable
private fun TabBar(nav: Nav) {
    val lo = LocalLo.current
    val tabs = listOf(
        TabDef("Home", Ph.Home, Screen.Home),
        TabDef("Search", Ph.Search, Screen.Search),
        TabDef("Library", Ph.Library, Screen.Library),
        TabDef("Settings", Ph.Settings, Screen.Settings),
    )
    Column(Modifier.fillMaxWidth().background(lo.card)) {
        Box(Modifier.fillMaxWidth().height(1.dp).background(lo.line))
        Row(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 8.dp, vertical = 6.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
            tabs.forEach { t ->
                val active = nav.stack.first() == t.screen
                Column(
                    Modifier.weight(1f).pressable(RoundedCornerShape(16.dp)) { nav.tab(t.screen) }.padding(vertical = 4.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Box(Modifier.height(30.dp).width(58.dp).clip(CircleShape).background(if (active) lo.signalSoft else androidx.compose.ui.graphics.Color.Transparent), Alignment.Center) {
                        Ic(t.icon, 22.dp, if (active) lo.signal else lo.grey)
                    }
                    Text(t.label, style = LoType.small.copy(fontSize = 11.sp), color = if (active) lo.signal else lo.grey)
                }
            }
        }
    }
}
