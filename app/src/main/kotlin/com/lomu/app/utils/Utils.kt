/**
 * BeatWave Project (C) 2026
 * Licensed under GPL-3.0 | See git history for contributors
 */

package com.lomu.app.utils

import android.content.Context
import android.content.res.Configuration
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Shape
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
fun reportException(throwable: Throwable) {
    throwable.printStackTrace()
}

@Suppress("DEPRECATION")
fun setAppLocale(context: Context, locale: Locale) {
    val config = Configuration(context.resources.configuration)
    config.setLocale(locale)
    context.resources.updateConfiguration(config, context.resources.displayMetrics)
}

// A radius only ever yields three distinct shapes (single / first / last), but
// this is called from inside ~29 lazy-list item lambdas, so it used to allocate
// a fresh AbsoluteSmoothCornerShape per item per composition. The identity churn
// also missed Compose's outline cache — which keys on the shape instance — so
// every row rebuilt its corner Path on every draw. Cache per radius instead.
private val listItemShapes = ConcurrentHashMap<Dp, Array<Shape>>()

fun listItemShape(index: Int, count: Int, radius: Dp = 24.dp): Shape {
    val shapes = listItemShapes.getOrPut(radius) {
        val smoothness = 60
        arrayOf(
            RoundedCornerShape(topStart = radius, topEnd = radius, bottomStart = radius, bottomEnd = radius),
            RoundedCornerShape(topStart = radius, topEnd = radius, bottomStart = 0.dp, bottomEnd = 0.dp),
            RoundedCornerShape(topStart = 0.dp, topEnd = 0.dp, bottomStart = radius, bottomEnd = radius),
        )
    }
    return when {
        count == 1 -> shapes[0]
        index == 0 -> shapes[1]
        index == count - 1 -> shapes[2]
        else -> RectangleShape
    }
}
