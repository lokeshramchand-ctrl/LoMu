package com.lomu.app.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/** LoMu design tokens, mirrored from the web player. */
data class Lo(
    val bg: Color,
    val card: Color,
    val ink: Color,
    val grey: Color,
    val line: Color,
    val dark: Boolean,
)

val LightLo = Lo(Color(0xFFE9EBF3), Color(0xFFF6F7FB), Color(0xFF0D0D11), Color(0xFF8C8E9A), Color(0x1F0D0D11), false)
val DarkLo = Lo(Color(0xFF131419), Color(0xFF1D1E26), Color(0xFFF2F3F8), Color(0xFF8C8E9A), Color(0x22FFFFFF), true)

val LocalLo = staticCompositionLocalOf { LightLo }

object LoType {
    val hero = TextStyle(fontWeight = FontWeight.Black, fontSize = 44.sp, lineHeight = 44.sp, letterSpacing = (-1.5).sp)
    val title = TextStyle(fontWeight = FontWeight.ExtraBold, fontSize = 24.sp, letterSpacing = (-0.5).sp)
    val section = TextStyle(fontWeight = FontWeight.ExtraBold, fontSize = 18.sp)
    val body = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
    val small = TextStyle(fontWeight = FontWeight.Medium, fontSize = 12.sp)
}

@Composable
fun LoMuTheme(content: @Composable () -> Unit) {
    val lo = if (isSystemInDarkTheme()) DarkLo else LightLo
    val scheme = if (lo.dark) darkColorScheme(background = lo.bg, surface = lo.card, primary = lo.ink, onPrimary = lo.bg, onBackground = lo.ink, onSurface = lo.ink)
    else lightColorScheme(background = lo.bg, surface = lo.card, primary = lo.ink, onPrimary = lo.bg, onBackground = lo.ink, onSurface = lo.ink)
    MaterialTheme(colorScheme = scheme) {
        CompositionLocalProvider(LocalLo provides lo, content = content)
    }
}
