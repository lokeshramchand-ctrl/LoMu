package com.lomu.app

import android.app.Application
import android.graphics.Bitmap
import androidx.datastore.preferences.core.edit
import coil3.ImageLoader
import coil3.PlatformContext
import coil3.SingletonImageLoader
import coil3.disk.DiskCache
import coil3.disk.directory
import coil3.memory.MemoryCache
import coil3.request.allowHardware
import coil3.request.bitmapConfig
import coil3.request.crossfade
import com.lomu.app.constants.VisitorDataKey
import com.lomu.app.di.ApplicationScope
import com.lomu.app.utils.cipher.CipherDeobfuscator
import com.lomu.app.utils.dataStore
import com.lomu.app.utils.get
import com.music.innertube.YouTube
import com.music.innertube.models.YouTubeLocale
import dagger.hilt.android.HiltAndroidApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import timber.log.Timber
import java.util.Locale
import javax.inject.Inject
import javax.inject.Provider

@HiltAndroidApp
class App : Application(), SingletonImageLoader.Factory {

    @Inject
    @ApplicationScope
    lateinit var applicationScope: CoroutineScope

    @Inject
    lateinit var downloadUtilProvider: Provider<com.lomu.app.playback.DownloadUtil>

    override fun onCreate() {
        super.onCreate()
        if (BuildConfig.DEBUG) Timber.plant(Timber.DebugTree())

        // YouTube is used anonymously: no cookie, just a persisted visitor id.
        YouTube.cookie = null
        YouTube.visitorData = dataStore.get(VisitorDataKey, "").takeIf { it.isNotBlank() && it != "null" }
        val locale = Locale.getDefault()
        YouTube.locale = YouTubeLocale(
            gl = locale.country.takeIf { it.length == 2 } ?: "US",
            hl = locale.language.takeIf { it.isNotBlank() } ?: "en",
        )

        runCatching { CipherDeobfuscator.initialize(this) }

        applicationScope.launch(Dispatchers.IO) {
            runCatching { downloadUtilProvider.get() }.onFailure { Timber.e(it, "Cache warm-up failed") }
        }
        applicationScope.launch(Dispatchers.IO) {
            if (YouTube.visitorData == null) {
                YouTube.visitorData().getOrNull()?.let { fresh ->
                    YouTube.visitorData = fresh
                    dataStore.edit { it[VisitorDataKey] = fresh }
                }
            }
        }
        // Warm the cipher WebView off the first-play critical path.
        applicationScope.launch(Dispatchers.IO) {
            delay(100)
            runCatching { CipherDeobfuscator.prewarm() }.onFailure { Timber.e(it, "Cipher prewarm failed") }
        }
    }

    override fun newImageLoader(context: PlatformContext): ImageLoader =
        ImageLoader.Builder(this)
            .crossfade(true)
            .allowHardware(true)
            .bitmapConfig(Bitmap.Config.HARDWARE)
            .memoryCache { MemoryCache.Builder().maxSizePercent(context, 0.30).build() }
            .diskCache {
                DiskCache.Builder()
                    .directory(filesDir.resolve("coil"))
                    .maxSizeBytes(512L * 1024 * 1024)
                    .build()
            }
            .build()
}
