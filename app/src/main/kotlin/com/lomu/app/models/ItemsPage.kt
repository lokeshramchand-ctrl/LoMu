package com.lomu.app.models

import androidx.compose.runtime.Stable
import com.music.innertube.models.YTItem

@Stable
data class ItemsPage(
    val items: List<YTItem>,
    val continuation: String?,
)
