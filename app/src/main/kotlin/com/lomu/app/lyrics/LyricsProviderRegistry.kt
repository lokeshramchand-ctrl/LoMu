/**
 * BeatWave Project (C) 2026
 * Licensed under GPL-3.0 | See git history for contributors
 */

package com.lomu.app.lyrics

import com.lomu.app.constants.PreferredLyricsProvider

/**
 * Central registry for all lyrics providers.
 * Maps provider names (used for persistence) to provider objects,
 * and handles serialization/deserialization of the custom priority order.
 */
object LyricsProviderRegistry {
    private val providerMap = mapOf(
        "BetterLyrics"    to BetterLyricsProvider,
        "LrcLib"          to LrcLibLyricsProvider,
        "YouTubeSubtitle" to YouTubeSubtitleLyricsProvider,
        "YouTubeMusic"    to YouTubeLyricsProvider,
    )

    val providerNames = providerMap.keys.toList()

    fun getProviderByName(name: String): LyricsProvider? = providerMap[name]

    fun deserializeProviderOrder(orderString: String): List<String> {
        if (orderString.isBlank()) return getDefaultProviderOrder()
        return orderString.split(",").map { it.trim() }.filter { it in providerNames }
    }

    fun serializeProviderOrder(providers: List<String>): String =
        providers.filter { it in providerNames }.joinToString(",")

    fun getDefaultProviderOrder(): List<String> = listOf(
        "BetterLyrics",
        "LrcLib",
        "YouTubeSubtitle",
        "YouTubeMusic",
    )

    fun getOrderedProviders(orderString: String): List<LyricsProvider> =
        deserializeProviderOrder(orderString).mapNotNull { getProviderByName(it) }

    /** Maps a [PreferredLyricsProvider] enum value to its registry name, used for migration. */
    fun getProviderNameForEnum(enum: PreferredLyricsProvider): String = when (enum) {
        PreferredLyricsProvider.LRCLIB        -> "LrcLib"
        PreferredLyricsProvider.BETTER_LYRICS -> "BetterLyrics"
        else -> "LrcLib"
    }

    /** Returns the human-readable display name for a registry provider key. */
    fun getDisplayName(name: String): String = when (name) {
        "BetterLyrics"    -> "Better Lyrics"
        "LrcLib"          -> "LrcLib"
        "YouTubeSubtitle" -> "YouTube Subtitle"
        "YouTubeMusic"    -> "YouTube Music"
        else              -> name
    }
}
