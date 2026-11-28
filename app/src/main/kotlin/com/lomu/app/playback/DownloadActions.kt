

package com.lomu.app.playback

import android.content.Context
import androidx.core.net.toUri
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.offline.Download
import androidx.media3.exoplayer.offline.DownloadRequest
import androidx.media3.exoplayer.offline.DownloadService

data class DownloadTarget(
    val id: String,
    val title: String,
)

fun shouldQueueDownload(state: Int?): Boolean = when (state) {
    null, Download.STATE_FAILED, Download.STATE_STOPPED -> true
    else -> false
}

fun shouldCancelDownload(state: Int?): Boolean = when (state) {
    Download.STATE_QUEUED,
    Download.STATE_DOWNLOADING,
    Download.STATE_FAILED,
    Download.STATE_STOPPED,
    Download.STATE_RESTARTING,
    -> true

    else -> false
}

@UnstableApi
fun downloadSongs(
    context: Context,
    songs: List<DownloadTarget>,
    downloads: Map<String, Download>,
) {
    songs.forEach { song ->
        if (!shouldQueueDownload(downloads[song.id]?.state)) return@forEach
        DownloadService.sendAddDownload(
            context,
            ExoDownloadService::class.java,
            DownloadRequest
                .Builder(song.id, song.id.toUri())
                .setCustomCacheKey(song.id)
                .setData(song.title.toByteArray())
                .build(),
            false,
        )
    }
}

@UnstableApi
fun downloadSong(
    context: Context,
    id: String,
    title: String,
    downloads: Map<String, Download>,
) = downloadSongs(context, listOf(DownloadTarget(id, title)), downloads)

@UnstableApi
fun cancelDownloads(
    context: Context,
    ids: List<String>,
    downloads: Map<String, Download>,
) {
    ids.forEach { id ->
        if (!shouldCancelDownload(downloads[id]?.state)) return@forEach
        DownloadService.sendRemoveDownload(context, ExoDownloadService::class.java, id, false)
    }
}

@UnstableApi
fun removeDownloads(
    context: Context,
    ids: List<String>,
) {
    ids.forEach { id ->
        DownloadService.sendRemoveDownload(context, ExoDownloadService::class.java, id, false)
    }
}
