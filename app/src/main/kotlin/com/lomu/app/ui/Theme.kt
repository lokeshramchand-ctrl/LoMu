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
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import android.content.res.AssetManager
import androidx.compose.ui.platform.LocalContext
import com.lomu.app.R
import androidx.compose.ui.unit.sp

data class Lo(
    val bg: Color,
    val card: Color,
    val surface2: Color,
    val grouped: Color,
    val cell: Color,
    val ink: Color,
    val grey: Color,
    val line: Color,
    val border2: Color,
    val signal: Color,
    val signalSoft: Color,
    val red: Color,
    val dark: Boolean,
    val onSignal: Color = Color.White,
    val feature: Color = Color(0xFF0B0B0B),
    val tiles: List<Color> = listOf(Color(0xFFF6EBE1), Color(0xFFE9EAF7), Color(0xFFE4F1EA), Color(0xFFF3EDDD)),
)

val LightLo = Lo(
    bg = Color(0xFFFFFFFF), card = Color(0xFFFFFFFF), surface2 = Color(0xFFF3F3F4),
    grouped = Color(0xFFF5F5F6), cell = Color(0xFFFFFFFF),
    ink = Color(0xFF0A0A0A), grey = Color(0xFF6B6B70), line = Color(0xFFE6E6E8), border2 = Color(0xFFD4D4D8),
    signal = Color(0xFF0A0A0A), signalSoft = Color(0x140A0A0A), red = Color(0xFFC21A1A), dark = false, onSignal = Color.White,
)
val DarkLo = Lo(
    bg = Color(0xFF0B0B0C), card = Color(0xFF161617), surface2 = Color(0xFF232325),
    grouped = Color(0xFF0B0B0C), cell = Color(0xFF161617),
    ink = Color(0xFFF5F5F6), grey = Color(0xFFA0A0A6), line = Color(0xFF2E2E31), border2 = Color(0xFF3F3F43),
    signal = Color(0xFFF5F5F6), signalSoft = Color(0x33F5F5F6), red = Color(0xFFFF6B5E), dark = true, onSignal = Color(0xFF0A0A0A),
    feature = Color(0xFF28282B),
    tiles = listOf(Color(0xFF2A2420), Color(0xFF23242F), Color(0xFF1F2924), Color(0xFF29261E)),
)

val LegacyLightLo = Lo(
    bg = Color(0xFFFFFFFF), card = Color(0xFFFAFAFA), surface2 = Color(0xFFEEEEF0),
    grouped = Color(0xFFF2F2F7), cell = Color(0xFFFFFFFF),
    ink = Color(0xFF000000), grey = Color(0xFF666669), line = Color(0xFFC6C6C8), border2 = Color(0xFFC6C6C8),
    signal = Color(0xFF0062CC), signalSoft = Color(0x1F0062CC), red = Color(0xFFD70015), dark = false,
)
val LegacyDarkLo = Lo(
    bg = Color(0xFF000000), card = Color(0xFF222222), surface2 = Color(0xFF2C2C2E),
    grouped = Color(0xFF000000), cell = Color(0xFF1C1C1E),
    ink = Color(0xFFFFFFFF), grey = Color(0xFF9A9AA0), line = Color(0xFF38383A), border2 = Color(0xFF444446),
    signal = Color(0xFF0A84FF), signalSoft = Color(0x330A84FF), red = Color(0xFFFF453A), dark = true,
)

val LocalLo = staticCompositionLocalOf { LightLo }

object LoFonts {
    @Volatile var assets: AssetManager? = null
}

@OptIn(ExperimentalTextApi::class)
private val InterFamily = FontFamily(
    listOf(400, 500, 600, 700).map { w ->
        Font(R.font.inter_variable, FontWeight(w), variationSettings = FontVariation.Settings(FontVariation.weight(w), FontVariation.opticalSizing(17.sp)))
    },
)

private fun sfFamily(display: Boolean): FontFamily? {
    val am = LoFonts.assets ?: return null
    val have = runCatching { am.list("fonts")?.toSet() }.getOrNull() ?: return null
    fun f(name: String, w: FontWeight): Font? = if ("SF-Pro-$name.otf" in have) Font("fonts/SF-Pro-$name.otf", am, w) else null
    val cuts = if (display) listOfNotNull(f("Display-Semibold", FontWeight.SemiBold), f("Display-Bold", FontWeight.Bold))
    else listOfNotNull(f("Text-Regular", FontWeight.Normal), f("Text-Medium", FontWeight.Medium), f("Text-Semibold", FontWeight.SemiBold), f("Text-Bold", FontWeight.Bold))
    return if (cuts.isEmpty()) null else FontFamily(cuts)
}

enum class AppFont { System, SfPro, Inter }
const val APP_FONT_CHOICE = 1
private val appFont get() = AppFont.entries[APP_FONT_CHOICE]

val LoFont: FontFamily by lazy {
    when (appFont) {
        AppFont.System -> FontFamily.Default
        AppFont.SfPro -> sfFamily(false) ?: InterFamily
        AppFont.Inter -> InterFamily
    }
}

val LoDisplay: FontFamily by lazy { if (appFont == AppFont.SfPro) sfFamily(true) ?: LoFont else LoFont }

object LoType {
    val hero = TextStyle(fontFamily = LoDisplay, fontWeight = FontWeight.Bold, fontSize = 32.sp, lineHeight = 38.sp, letterSpacing = (-0.6).sp)
    val title = TextStyle(fontFamily = LoDisplay, fontWeight = FontWeight.SemiBold, fontSize = 24.sp, lineHeight = 30.sp, letterSpacing = (-0.2).sp)
    val playerTitle = TextStyle(fontFamily = LoFont, fontWeight = FontWeight.Bold, fontSize = 22.sp, lineHeight = 28.sp, letterSpacing = 0.35.sp)
    val section = TextStyle(fontFamily = LoDisplay, fontWeight = FontWeight.SemiBold, fontSize = 22.sp, lineHeight = 28.sp, letterSpacing = (-0.2).sp)
    val body = TextStyle(fontFamily = LoFont, fontWeight = FontWeight.Normal, fontSize = 17.sp, lineHeight = 22.sp, letterSpacing = (-0.41).sp)
    val small = TextStyle(fontFamily = LoFont, fontWeight = FontWeight.Normal, fontSize = 13.sp, lineHeight = 16.sp, letterSpacing = (-0.08).sp)
    val eyebrow = TextStyle(fontFamily = LoFont, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, lineHeight = 16.sp, letterSpacing = (-0.08).sp)
    val sub = TextStyle(fontFamily = LoFont, fontWeight = FontWeight.Normal, fontSize = 15.sp, lineHeight = 20.sp, letterSpacing = (-0.24).sp)
    val caption = TextStyle(fontFamily = LoFont, fontWeight = FontWeight.Medium, fontSize = 12.sp, lineHeight = 14.sp, letterSpacing = 0.07.sp)
}

@Composable
fun LoMuTheme(content: @Composable () -> Unit) {
    LoFonts.assets = LocalContext.current.assets
    val lo = if (isSystemInDarkTheme()) DarkLo else LightLo
    val scheme = if (lo.dark) darkColorScheme(background = lo.bg, surface = lo.card, primary = lo.signal, onPrimary = lo.onSignal, onBackground = lo.ink, onSurface = lo.ink)
    else lightColorScheme(background = lo.bg, surface = lo.card, primary = lo.signal, onPrimary = lo.onSignal, onBackground = lo.ink, onSurface = lo.ink)
    MaterialTheme(colorScheme = scheme) {
        CompositionLocalProvider(LocalLo provides lo, content = content)
    }
}
