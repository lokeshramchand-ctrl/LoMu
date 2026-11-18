package com.lomu.app.ui

import android.annotation.SuppressLint
import android.webkit.CookieManager
import android.webkit.WebStorage
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.lomu.app.sync.ImportSummary
import com.lomu.app.sync.YtmImporter
import kotlinx.coroutines.launch

val LocalImporter = staticCompositionLocalOf<YtmImporter?> { null }

private const val LOGIN_URL = "https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fmusic.youtube.com"

/** Wipes every trace of the Google session from the embedded browser. */
private fun forgetSession(web: WebView?) {
    CookieManager.getInstance().removeAllCookies(null)
    CookieManager.getInstance().flush()
    WebStorage.getInstance().deleteAllData()
    web?.clearCache(true)
    web?.clearHistory()
}

/**
 * One-time import: sign in to Google in a normal web page, the cookie is read once, used to copy
 * liked songs and playlists into LoMu, then thrown away.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun ImportScreen() {
    val lo = LocalLo.current
    val nav = LocalNav.current
    val importer = LocalImporter.current
    val scope = rememberCoroutineScope()
    var phase by remember { mutableStateOf("login") } // login -> working -> done | failed
    var message by remember { mutableStateOf("") }
    var summary by remember { mutableStateOf<ImportSummary?>(null) }
    var web by remember { mutableStateOf<WebView?>(null) }
    DisposableEffect(Unit) { onDispose { forgetSession(web); web?.destroy() } }

    Column(Modifier.fillMaxSize()) {
        TopBar("Import from YouTube Music", nav::pop)
        when (phase) {
            "login" -> {
                Text(
                    "Sign in to Google below. LoMu copies your liked songs and playlists once and then forgets the session; your password is never seen by the app.",
                    style = LoType.small, color = lo.grey, modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
                )
                AndroidView(
                    modifier = Modifier.fillMaxSize(),
                    factory = { ctx ->
                        WebView(ctx).apply {
                            forgetSession(null)
                            settings.javaScriptEnabled = true
                            settings.domStorageEnabled = true
                            // Google refuses sign-in inside an embedded "wv" browser.
                            settings.userAgentString = settings.userAgentString.replace("; wv", "")
                            webViewClient = object : WebViewClient() {
                                override fun onPageFinished(view: WebView, url: String) {
                                    if (phase != "login" || !url.startsWith("https://music.youtube.com")) return
                                    val cookie = CookieManager.getInstance().getCookie("https://music.youtube.com")
                                    if (cookie == null || !cookie.contains("SAPISID")) return
                                    phase = "working"
                                    scope.launch {
                                        val result = importer?.import(cookie) { message = it }
                                        forgetSession(view)
                                        result?.onSuccess { summary = it; phase = "done" }
                                            ?.onFailure { message = it.message ?: "Import failed"; phase = "failed" }
                                    }
                                }
                            }
                            loadUrl(LOGIN_URL)
                            web = this
                        }
                    },
                )
            }
            "working" -> Column(Modifier.fillMaxWidth().padding(24.dp)) {
                Loading()
                Text(message, style = LoType.body, color = lo.ink)
            }
            "done" -> Column(Modifier.fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                val s = summary
                Text("Done", style = LoType.hero, color = lo.ink)
                Text("${s?.likedSongs ?: 0} liked songs and ${s?.playlists ?: 0} playlists are now in LoMu. The Google session has been cleared.", style = LoType.body, color = lo.grey)
                Pill("Back to library", { nav.tab(Screen.Library) })
            }
            else -> Column(Modifier.fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Import failed", style = LoType.title, color = lo.ink)
                Text(message, style = LoType.body, color = lo.grey)
                Pill("Try again", { phase = "login" })
            }
        }
    }
}
