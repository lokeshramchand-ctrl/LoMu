/**
 * BeatWave Project (C) 2026
 * Licensed under GPL-3.0 | See git history for contributors
 */

package com.lomu.app.playback.queues

import androidx.media3.common.MediaItem
import com.lomu.app.extensions.metadata
import com.lomu.app.models.MediaMetadata

class ListQueue(
    val title: String? = null,
    val items: List<MediaItem>,
    val startIndex: Int = 0,
    val position: Long = 0L,
    override val preloadItem: MediaMetadata? = items.getOrNull(startIndex)?.metadata,
) : Queue {

    override suspend fun getInitialStatus() = Queue.Status(title, items, startIndex, position)

    override fun hasNextPage(): Boolean = false

    override suspend fun nextPage() = throw UnsupportedOperationException()
}
