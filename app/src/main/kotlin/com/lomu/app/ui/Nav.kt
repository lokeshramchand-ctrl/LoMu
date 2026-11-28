package com.lomu.app.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

sealed interface Screen {
    data object Home : Screen
    data object New : Screen
    data object Search : Screen
    data object Library : Screen
    data object Create : Screen
    data object Settings : Screen
    data class Album(val id: String) : Screen
    data class Artist(val id: String) : Screen
    data class Playlist(val id: String) : Screen
    data class LocalPlaylist(val id: String) : Screen
    data object Import : Screen
    data object Liked : Screen
    data object Playlists : Screen
    data object Albums : Screen
    data object Artists : Screen
    data object Sleep : Screen
    data object Wrapped : Screen
    data object Mix : Screen
}

class Nav {
    val stack = mutableStateListOf<Screen>(Screen.Home)
    val homeList = androidx.compose.foundation.lazy.LazyListState()
    val current: Screen get() = stack.last()
    val canPop get() = stack.size > 1
    var op by mutableStateOf(NavOp.Tab)
        private set
    fun push(s: Screen) { op = NavOp.Push; stack.add(s) }
    fun pop() { if (canPop) { op = NavOp.Pop; stack.removeAt(stack.lastIndex) } }
    fun tab(s: Screen) { op = NavOp.Tab; stack.clear(); stack.add(s) }
}

object MixStore {
    var title: String = ""
    var tracks: List<com.lomu.app.models.MediaMetadata> = emptyList()
    var why: Map<String, String> = emptyMap()
}
