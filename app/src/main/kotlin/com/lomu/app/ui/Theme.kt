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

/**
 * LoMu design tokens, modelled on Apple Music: pure white / true black canvas, iOS system greys,
 * hairline separators, grouped inset cells and one red accent.
 */
data class Lo(
    val bg: Color,          // page canvas
    val card: Color,        // elevated surface (bars, mini player, sheets)
    val surface2: Color,    // fills: search field, art placeholder, segmented track
    val grouped: Color,     // background of grouped (Settings style) pages
    val cell: Color,        // grouped cell background
    val ink: Color,         // primary label
    val grey: Color,        // secondary label
    val line: Color,        // hairline separator
    val border2: Color,     // stronger outline
    val signal: Color,      // accent (system blue)
    val signalSoft: Color,  // accent tint for fills
    val red: Color,         // destructive / error
    val dark: Boolean,
    val onSignal: Color = Color.White, // label or icon drawn on a filled accent surface
    val feature: Color = Color(0xFF0B0B0B), // the black feature card on Home
    val tiles: List<Color> = listOf(Color(0xFFF6EBE1), Color(0xFFE9EAF7), Color(0xFFE4F1EA), Color(0xFFF3EDDD)), // pastel card fills: peach, lavender, mint, sand
)

/**
 * White page, black ink and accent, soft pastel cards (peach, lavender, mint, sand) and one black feature card. Every pair is checked for 4.5:1 or better:
 * text on the page, grey text, and the label on a filled accent surface.
 */
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

/** The previous Apple-style palette. The player screens keep it so their look does not change. */
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

/** Holds the asset manager so the type scale can look for SF Pro files shipped on the device. */
object LoFonts {
    @Volatile var assets: AssetManager? = null
}

/** Inter (SIL OFL) is the open stand-in used whenever the SF Pro files are not bundled. */
@OptIn(ExperimentalTextApi::class)
private val InterFamily = FontFamily(
    listOf(400, 500, 600, 700).map { w ->
        Font(R.font.inter_variable, FontWeight(w), variationSettings = FontVariation.Settings(FontVariation.weight(w), FontVariation.opticalSizing(17.sp)))
    },
)

/** SF Pro from assets/fonts when present; [display] picks the Display cut for titles. */
private fun sfFamily(display: Boolean): FontFamily? {
    val am = LoFonts.assets ?: return null
    val have = runCatching { am.list("fonts")?.toSet() }.getOrNull() ?: return null
    fun f(name: String, w: FontWeight): Font? = if ("SF-Pro-$name.otf" in have) Font("fonts/SF-Pro-$name.otf", am, w) else null
    val cuts = if (display) listOfNotNull(f("Display-Semibold", FontWeight.SemiBold), f("Display-Bold", FontWeight.Bold))
    else listOfNotNull(f("Text-Regular", FontWeight.Normal), f("Text-Medium", FontWeight.Medium), f("Text-Semibold", FontWeight.SemiBold), f("Text-Bold", FontWeight.Bold))
    return if (cuts.isEmpty()) null else FontFamily(cuts)
}

/**
 * Which typeface the app uses. The first Apple Music design shipped with the phone's own system font (Roboto),
 * and that is what stays the default. Set to [AppFont.SfPro] to switch to SF Pro (needs the files in assets/fonts,
 * falls back to Inter without them) or [AppFont.Inter].
 */
enum class AppFont { System, SfPro, Inter }
const val APP_FONT_CHOICE = 1 // 0 = System, 1 = SF Pro, 2 = Inter
private val appFont get() = AppFont.entries[APP_FONT_CHOICE]

/** Body / label family. */
val LoFont: FontFamily by lazy {
    when (appFont) {
        AppFont.System -> FontFamily.Default
        AppFont.SfPro -> sfFamily(false) ?: InterFamily
        AppFont.Inter -> InterFamily
    }
}

/** Title family (Large Title, Title 2): SF Pro Display when SF Pro is chosen, otherwise the same as the body. */
val LoDisplay: FontFamily by lazy { if (appFont == AppFont.SfPro) sfFamily(true) ?: LoFont else LoFont }

/** Type scale after the iOS text styles: Large Title, Title 2, Headline, Body, Subhead, Footnote. */
object LoType {
    val hero = TextStyle(fontFamily = LoDisplay, fontWeight = FontWeight.Bold, fontSize = 32.sp, lineHeight = 38.sp, letterSpacing = (-0.6).sp)       // Large Title
    val title = TextStyle(fontFamily = LoDisplay, fontWeight = FontWeight.SemiBold, fontSize = 24.sp, lineHeight = 30.sp, letterSpacing = (-0.2).sp)
    /** The player's own title style: the former Apple-style Title 2, so the player is unchanged. */
    val playerTitle = TextStyle(fontFamily = LoFont, fontWeight = FontWeight.Bold, fontSize = 22.sp, lineHeight = 28.sp, letterSpacing = 0.35.sp)       // Title 2
    val section = TextStyle(fontFamily = LoDisplay, fontWeight = FontWeight.SemiBold, fontSize = 22.sp, lineHeight = 28.sp, letterSpacing = (-0.2).sp)
    val body = TextStyle(fontFamily = LoFont, fontWeight = FontWeight.Normal, fontSize = 17.sp, lineHeight = 22.sp, letterSpacing = (-0.41).sp)  // Body
    val small = TextStyle(fontFamily = LoFont, fontWeight = FontWeight.Normal, fontSize = 13.sp, lineHeight = 16.sp, letterSpacing = (-0.08).sp) // Footnote
    val eyebrow = TextStyle(fontFamily = LoFont, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, lineHeight = 16.sp, letterSpacing = (-0.08).sp)
    val sub = TextStyle(fontFamily = LoFont, fontWeight = FontWeight.Normal, fontSize = 15.sp, lineHeight = 20.sp, letterSpacing = (-0.24).sp)    // Subheadline
    val caption = TextStyle(fontFamily = LoFont, fontWeight = FontWeight.Medium, fontSize = 12.sp, lineHeight = 14.sp, letterSpacing = 0.07.sp)   // Caption 3 (tab labels)
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
