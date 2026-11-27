package com.lomu.app.update

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.widget.Toast
import com.lomu.app.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import timber.log.Timber
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * Self-update from GitHub Releases (the repo is public). Every push builds an APK and publishes release `android-v<run>`;
 * this build knows its own run number (BuildConfig.BUILD_NUMBER) and installs a newer one. Builds made on a dev machine
 * have number 0 and never update themselves. The first install of an update asks once ("allow from this source");
 * after that, Android 12+ installs without a prompt where it can.
 */
object AppUpdater {
    private const val RELEASES = "https://api.github.com/repos/lokeshramchand-ctrl/LoMu/releases?per_page=20"
    private const val EVERY_MS = 30 * 60_000L
    private val http = OkHttpClient.Builder().callTimeout(5, TimeUnit.MINUTES).build()

    /** Looks for a newer build at most every 30 minutes and installs it; never while music is playing. */
    suspend fun check(context: Context, playing: () -> Boolean) = withContext(Dispatchers.IO) {
        if (BuildConfig.BUILD_NUMBER == 0 || playing()) return@withContext
        val prefs = context.getSharedPreferences("lomu_update", Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        if (now - prefs.getLong("checked", 0) < EVERY_MS) return@withContext
        prefs.edit().putLong("checked", now).apply()
        try {
            val (tag, build, url) = latest() ?: return@withContext
            if (build <= BuildConfig.BUILD_NUMBER) return@withContext
            if (!context.packageManager.canRequestPackageInstalls()) {
                if (prefs.getString("asked", null) != tag) {
                    prefs.edit().putString("asked", tag).apply()
                    withContext(Dispatchers.Main) {
                        Toast.makeText(context, "Update available: allow LoMu to install updates", Toast.LENGTH_LONG).show()
                        context.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                    }
                }
                return@withContext
            }
            // One attempt an hour per release, so a failing install does not loop.
            if (prefs.getString("tried", null) == tag && now - prefs.getLong("triedAt", 0) < 60 * 60_000L) return@withContext
            prefs.edit().putString("tried", tag).putLong("triedAt", now).apply()
            Timber.i("update: $tag found (this build ${BuildConfig.BUILD_NUMBER}), downloading")
            install(context, download(context, url))
        } catch (e: Exception) {
            Timber.w(e, "update check failed")
        }
    }

    private fun latest(): Triple<String, Int, String>? {
        http.newCall(Request.Builder().url(RELEASES).header("Accept", "application/vnd.github+json").build()).execute().use { r ->
            if (!r.isSuccessful) return null
            val a = JSONArray(r.body!!.string())
            for (i in 0 until a.length()) {
                val rel = a.getJSONObject(i)
                val tag = rel.optString("tag_name")
                val n = Regex("^android-v(\\d+)$").find(tag)?.groupValues?.get(1)?.toIntOrNull() ?: continue
                val assets = rel.getJSONArray("assets")
                for (j in 0 until assets.length()) {
                    val x = assets.getJSONObject(j)
                    if (x.optString("name") == "LoMu.apk") return Triple(tag, n, x.getString("browser_download_url"))
                }
            }
        }
        return null
    }

    private fun download(context: Context, url: String): File {
        val f = File(context.cacheDir, "update/LoMu.apk").also { it.parentFile!!.mkdirs() }
        http.newCall(Request.Builder().url(url).build()).execute().use { r ->
            if (!r.isSuccessful) error("download ${r.code}")
            f.outputStream().use { out -> r.body!!.byteStream().copyTo(out) }
        }
        if (f.length() < 1_000_000) error("download too small")
        return f
    }

    private fun install(context: Context, apk: File) {
        val installer = context.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
        if (Build.VERSION.SDK_INT >= 31) params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
        val id = installer.createSession(params)
        installer.openSession(id).use { s ->
            apk.inputStream().use { input -> s.openWrite("LoMu.apk", 0, apk.length()).use { out -> input.copyTo(out); s.fsync(out) } }
            val pi = android.app.PendingIntent.getBroadcast(
                context, id, Intent(context, UpdateReceiver::class.java).setPackage(context.packageName),
                android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_MUTABLE,
            )
            s.commit(pi.intentSender)
        }
    }
}

/** Receives the installer's result: shows the system's confirm screen when it needs one, logs the rest. */
class UpdateReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, -1)
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            @Suppress("DEPRECATION")
            val confirm = intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT)
            confirm?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)?.let { runCatching { context.startActivity(it) } }
        } else Timber.i("update install status $status ${intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)}")
    }
}
