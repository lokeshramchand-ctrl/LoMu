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

/** LoMu design tokens. Same palette as the web player (globals.css): flat paper surfaces, hairlines, one blue signal. */
data class Lo(
    val bg: Color,
    val card: Color,      // surface
    val surface2: Color,
    val ink: Color,
    val grey: Color,      // muted text
    val line: Color,      // hairline border
    val border2: Color,   // stronger border (inputs, buttons)
    val signal: Color,
    val signalSoft: Color,
    val red: Color,
    val dark: Boolean,
)

val LightLo = Lo(
    bg = Color(0xFFF7F7F6), card = Color(0xFFFFFFFF), surface2 = Color(0xFFF1F1F0),
    ink = Color(0xFF17181A), grey = Color(0xFF6F6E68), line = Color(0xFFE7E6E2), border2 = Color(0xFFD3D2CC),
    signal = Color(0xFF2231DD), signalSoft = Color(0x172231DD), red = Color(0xFFED272E), dark = false,
)
val DarkLo = Lo(
    bg = Color(0xFF0E0F11), card = Color(0xFF17181A), surface2 = Color(0xFF1D1E21),
    ink = Color(0xFFF4F3F1), grey = Color(0xFF9A9993), line = Color(0xFF26272A), border2 = Color(0xFF3A3B3F),
    signal = Color(0xFF6B78FF), signalSoft = Color(0x296B78FF), red = Color(0xFFFF5158), dark = true,
)

val LocalLo = staticCompositionLocalOf { LightLo }

object LoType {
    val hero = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 34.sp, lineHeight = 38.sp, letterSpacing = (-1.2).sp)
    val title = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 22.sp, lineHeight = 26.sp, letterSpacing = (-0.6).sp)
    val section = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 17.sp, letterSpacing = (-0.3).sp)
    val body = TextStyle(fontWeight = FontWeight.Medium, fontSize = 15.sp, letterSpacing = (-0.2).sp)
    val small = TextStyle(fontWeight = FontWeight.Medium, fontSize = 12.5.sp, letterSpacing = (-0.1).sp)
    val eyebrow = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 11.sp, letterSpacing = 0.9.sp)
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
