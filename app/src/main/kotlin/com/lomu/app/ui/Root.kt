package com.lomu.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.scaleIn
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
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
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.platform.LocalContext
import dev.chrisbanes.haze.hazeSource
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LibraryMusic
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.outlined.GridView
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.LibraryMusic
import androidx.compose.material.icons.rounded.MusicNote
import androidx.compose.material.icons.rounded.Search

@Composable
fun Welcome(onStart: () -> Unit) {
    val lo = LocalLo.current
    Column(Modifier.fillMaxSize().background(lo.bg).statusBarsPadding().navigationBarsPadding().padding(horizontal = 28.dp, vertical = 24.dp)) {
        Spacer(Modifier.weight(1f))
        Box(Modifier.size(72.dp).background(lo.signal, RoundedCornerShape(16.dp)), Alignment.Center) {
            IcV(androidx.compose.material.icons.Icons.Rounded.MusicNote, 40.dp, lo.onSignal)
        }
        Spacer(Modifier.height(24.dp))
        Text("Welcome to LoMu", style = LoType.hero, color = lo.ink)
        Text("Your music, everywhere.", style = LoType.body.copy(fontSize = 20.sp, lineHeight = 25.sp), color = lo.grey, modifier = Modifier.padding(top = 4.dp))
        Spacer(Modifier.height(32.dp))
        listOf(
            Ph.Headphones to ("Listen anonymously" to "Plays from YouTube Music. No ads, no Google account."),
            Ph.Cloud to ("Synced to you" to "Likes and playlists sync to your own server."),
            Ph.Sparkles to ("Made for you" to "Mixes, radio and lyrics that learn what you like."),
        ).forEach { (icon, text) ->
            Row(Modifier.padding(vertical = 10.dp), verticalAlignment = Alignment.Top) {
                Ic(icon, 30.dp, lo.signal, Modifier.padding(top = 2.dp))
                Spacer(Modifier.width(16.dp))
                Column(Modifier.weight(1f)) {
                    Text(text.first, style = LoType.body.copy(fontWeight = FontWeight.SemiBold), color = lo.ink)
                    Text(text.second, style = LoType.sub, color = lo.grey)
                }
            }
        }
        Spacer(Modifier.weight(1f))
        Pill("Continue", onStart, accent = true, modifier = Modifier.fillMaxWidth().height(52.dp))
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
    val remote = rememberRemote()
    var showDevices by remember { mutableStateOf(false) }
    var menu by remember { mutableStateOf<MenuTarget?>(null) }

    if (welcome) {
        Welcome { welcome = false; onWelcomeDone() }
        return
    }
    BackHandler(enabled = menu != null || showDevices || showPlayer || nav.canPop) {
        if (menu != null) menu = null else if (showDevices) showDevices = false else if (showPlayer) showPlayer = false else nav.pop()
    }
    val hasPlayer = meta != null || remote != null
    val landscape = androidx.compose.ui.platform.LocalConfiguration.current.orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE
    val insetBase by androidx.compose.animation.core.animateDpAsState(if (landscape) (if (hasPlayer) 112.dp else 62.dp) else if (hasPlayer) 138.dp else 82.dp, tween(380, easing = IosEase), label = "inset")
    val inset = insetBase + WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    val haze = remember { dev.chrisbanes.haze.HazeState() }
    CompositionLocalProvider(LocalHaze provides haze, LocalNav provides nav, LocalBottomInset provides inset, LocalOpenDevices provides { showDevices = true }, LocalTrackMenu provides { menu = it }) {
        Box(Modifier.fillMaxSize().background(lo.bg)) {
            AnimatedContent(
                targetState = nav.current,
                transitionSpec = {
                    when (nav.op) {
                        NavOp.Push -> (slideInHorizontally(tween(430, easing = IosEase)) { it } + fadeIn(tween(160)))
                            .togetherWith(slideOutHorizontally(tween(430, easing = IosEase)) { -it / 4 } + fadeOut(tween(430), targetAlpha = 0.55f))
                            .apply { targetContentZIndex = 1f }
                        NavOp.Pop -> (slideInHorizontally(tween(430, easing = IosEase)) { -it / 4 } + fadeIn(tween(430), initialAlpha = 0.55f))
                            .togetherWith(slideOutHorizontally(tween(380, easing = IosEase)) { it } + fadeOut(tween(260, delayMillis = 120)))
                            .apply { targetContentZIndex = -1f }
                        NavOp.Tab -> (fadeIn(tween(240, delayMillis = 60)) + scaleIn(tween(300, easing = IosEase), initialScale = 0.985f)) togetherWith fadeOut(tween(120))
                    }
                },
                label = "screen",
                modifier = Modifier.fillMaxSize().hazeSource(haze),
            ) { screen ->
                Box(Modifier.fillMaxSize().background(lo.bg)) {
                when (screen) {
                    Screen.Home -> HomeScreen()
                    Screen.New -> NewScreen()
                    Screen.Search -> SearchScreen()
                    Screen.Library -> LibraryScreen()
                    Screen.Create -> CreateScreen()
                    Screen.Settings -> SettingsScreen()
                    is Screen.Album -> AlbumScreen(screen.id)
                    is Screen.Artist -> ArtistScreen(screen.id)
                    is Screen.Playlist -> PlaylistScreen(screen.id)
                    is Screen.LocalPlaylist -> LocalPlaylistScreen(screen.id)
                    Screen.Import -> ImportScreen()
                    Screen.Liked -> LikedScreen()
                    Screen.Playlists -> PlaylistsScreen()
                    Screen.Albums -> SavedAlbumsScreen()
                    Screen.Artists -> SavedArtistsScreen()
                    Screen.Sleep -> SleepScreen()
                    Screen.Wrapped -> WrappedScreen()
                    Screen.Mix -> MixScreen()
                }
                }
            }
            if (nav.canPop && !showPlayer) Box(Modifier.align(Alignment.CenterStart).fillMaxHeight().width(22.dp).edgeSwipeBack(true) { nav.pop() })
            Box(
                Modifier.align(Alignment.BottomCenter).fillMaxWidth().height(inset + 8.dp)
                    .background(androidx.compose.ui.graphics.Brush.verticalGradient(listOf(Color.Transparent, lo.bg.copy(alpha = 0.92f), lo.bg))),
            )
            Column(Modifier.align(Alignment.BottomCenter).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                AnimatedVisibility(
                    visible = hasPlayer,
                    modifier = Modifier.padding(horizontal = 14.dp),
                    enter = slideInVertically(tween(450, easing = IosEase)) { it / 2 } + fadeIn(tween(250)) + scaleIn(spring(dampingRatio = 0.7f, stiffness = 300f), initialScale = 0.9f),
                    exit = slideOutVertically(tween(300, easing = IosEase)) { it / 2 } + fadeOut(tween(200)),
                ) {
                    if (remote != null) RemoteMiniPlayer(remote, { showPlayer = true })
                    else MiniPlayer({ showPlayer = true })
                }
                TabBar(nav)
            }
            AnimatedVisibility(
                visible = showPlayer,
                enter = slideInVertically(tween(480, easing = IosEase)) { it } + fadeIn(tween(220)),
                exit = slideOutVertically(tween(340, easing = IosEase)) { it } + fadeOut(tween(260)),
            ) { if (remote != null) RemotePlayer(remote) { showPlayer = false } else FullPlayer { showPlayer = false } }
            if (showDevices) DevicesSheet { showDevices = false }
            menu?.let { t -> TrackMenuSheet(t, { menu = null }) { s -> showPlayer = false; nav.push(s) } }
        }
    }
}

private data class TabDef(val label: String, val icon: ImageVector, val screen: Screen)

@Composable
private fun TabBar(nav: Nav) {
    val lo = LocalLo.current
    val tabs = listOfNotNull(
        TabDef("Home", Ph.Waveform.vector, Screen.Home),
        TabDef("Search", Ph.Search.vector, Screen.Search),
        TabDef("Media", Ph.Library.vector, Screen.Library),
        TabDef("Create", Ph.Plus.vector, Screen.Create),
        if (UiPrefs.showNew(LocalContext.current)) TabDef("New", Ph.Compass.vector, Screen.New) else null,
    )
    val shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp)
    val haptic = rememberHaptic()
    val landscape = androidx.compose.ui.platform.LocalConfiguration.current.orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE
    Row(
        Modifier.fillMaxWidth().background(lo.card, shape).navigationBarsPadding().height(if (landscape) 48.dp else 64.dp).padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        tabs.forEach { t ->
            val active = nav.stack.first() == t.screen
            val tint by animateColorAsState(if (active) lo.ink else lo.grey, tween(220), label = "tabTint")
            Column(
                Modifier.weight(1f).fillMaxHeight()
                    .semantics { selected = active }
                    .pressable(RoundedCornerShape(16.dp), role = androidx.compose.ui.semantics.Role.Tab) { if (!active) haptic(false); nav.tab(t.screen) },
                horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center,
            ) {
                IcV(t.icon, 24.dp, tint)
                if (!landscape) Text(t.label, style = LoType.caption.copy(fontWeight = if (active) FontWeight.Bold else FontWeight.Medium), color = tint, modifier = Modifier.padding(top = 3.dp))
            }
        }
    }
}
