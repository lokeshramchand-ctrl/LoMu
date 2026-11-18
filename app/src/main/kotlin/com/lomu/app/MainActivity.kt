/**
 * LoMu (C) 2026 — derived from BeatWave, licensed under GPL-3.0
 */

package com.lomu.app

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.lifecycleScope
import com.lomu.app.db.MusicDatabase
import com.lomu.app.lyrics.LyricsHelper
import com.lomu.app.playback.MusicService
import com.lomu.app.playback.PlayerConnection
import com.lomu.app.ui.LocalLyrics
import com.lomu.app.ui.LocalPlayer
import com.lomu.app.ui.LoMuRoot
import com.lomu.app.ui.LoMuTheme
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    @Inject lateinit var database: MusicDatabase
    @Inject lateinit var lyricsHelper: LyricsHelper

    private var connection by mutableStateOf<PlayerConnection?>(null)

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName, service: IBinder) {
            if (service is MusicService.MusicBinder) {
                connection = PlayerConnection(this@MainActivity, service, database, lifecycleScope)
            }
        }

        override fun onServiceDisconnected(name: ComponentName) {
            connection?.dispose()
            connection = null
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        if (Build.VERSION.SDK_INT >= 33) {
            requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 1)
        }
        val intent = Intent(this, MusicService::class.java)
        startService(intent)
        bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)

        val prefs = getSharedPreferences("lomu", MODE_PRIVATE)
        setContent {
            LoMuTheme {
                CompositionLocalProvider(LocalPlayer provides connection, LocalLyrics provides lyricsHelper) {
                    LoMuRoot(
                        seenWelcome = prefs.getBoolean("seenWelcome", false),
                        onWelcomeDone = { prefs.edit().putBoolean("seenWelcome", true).apply() },
                    )
                }
            }
        }
    }

    override fun onDestroy() {
        runCatching { unbindService(serviceConnection) }
        connection?.dispose()
        connection = null
        super.onDestroy()
    }
}
