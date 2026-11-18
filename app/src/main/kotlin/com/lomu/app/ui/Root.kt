package com.lomu.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp

@Composable
fun Welcome(onStart: () -> Unit) {
    val lo = LocalLo.current
    Column(Modifier.fillMaxSize().background(lo.bg).statusBarsPadding().navigationBarsPadding().padding(28.dp)) {
        Spacer(Modifier.weight(1f))
        Text("New", style = LoType.hero.copy(fontSize = 64.sp), color = lo.ink)
        Text("Age Of", style = LoType.hero.copy(fontSize = 64.sp), color = lo.grey)
        Text("Music", style = LoType.hero.copy(fontSize = 64.sp), color = lo.ink)
        Spacer(Modifier.height(20.dp))
        Text("Your music. No ads. Nobody else's account.", style = LoType.body, color = lo.grey)
        Spacer(Modifier.height(36.dp))
        Pill("Get Started", onStart)
        Spacer(Modifier.height(12.dp))
    }
}

private val Int.sp get() = androidx.compose.ui.unit.TextUnit(this.toFloat(), androidx.compose.ui.unit.TextUnitType.Sp)

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
                    when (val s = nav.current) {
                        Screen.Home -> HomeScreen()
                        Screen.Search -> SearchScreen()
                        Screen.Library -> LibraryScreen()
                        Screen.Settings -> SettingsScreen()
                        is Screen.Album -> AlbumScreen(s.id)
                        is Screen.Artist -> ArtistScreen(s.id)
                        is Screen.Playlist -> PlaylistScreen(s.id)
                        is Screen.LocalPlaylist -> LocalPlaylistScreen(s.id)
                        Screen.Import -> ImportScreen()
                    }
                }
                if (meta != null) MiniPlayer({ showPlayer = true })
                TabBar(nav)
            }
            if (showPlayer) FullPlayer { showPlayer = false }
        }
    }
}

@Composable
private fun TabBar(nav: Nav) {
    val lo = LocalLo.current
    val tabs = listOf("Home" to Screen.Home, "Search" to Screen.Search, "Library" to Screen.Library, "Settings" to Screen.Settings)
    Row(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 12.dp, vertical = 8.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
        tabs.forEach { (name, screen) ->
            val active = nav.stack.first() == screen
            Text(
                name, style = LoType.body, color = if (active) lo.bg else lo.grey,
                modifier = Modifier.clip(CircleShape).background(if (active) lo.ink else lo.bg).clickable { nav.tab(screen) }.padding(horizontal = 16.dp, vertical = 9.dp),
            )
        }
    }
}
