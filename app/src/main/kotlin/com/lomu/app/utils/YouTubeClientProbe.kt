
package com.lomu.app.utils

import com.music.innertube.YouTube
import com.music.innertube.models.YouTubeClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.net.HttpURLConnection
import java.net.URL
import kotlin.system.measureTimeMillis

object YouTubeClientProbe {

    data class Result(
        val clientName: String,
        val outcome: Outcome,
        val playabilityStatus: String?,
        val reason: String?,
        val formatCount: Int,
        val elapsedMillis: Long,
    ) {
        val line: String
            get() = buildString {
                append(outcome.symbol).append(' ').append(clientName.padEnd(28))
                append(outcome.name.lowercase().padEnd(16))
                append("${elapsedMillis}ms".padStart(7))
                playabilityStatus?.let { append("  ").append(it) }
                if (formatCount > 0) append("  formats=").append(formatCount)
                reason?.takeIf { it.isNotBlank() }?.let { append("  \"").append(it.take(80)).append('"') }
            }
    }

    enum class Outcome(val symbol: String) {
        PLAYABLE("OK "),
        DEAD_URL("URL"),
        NO_FORMAT("FMT"),
        REFUSED("NO "),
        ERROR("ERR"),
        SKIPPED("-- "),
    }

    suspend fun run(
        videoId: String,
        clients: List<YouTubeClient>,
        isLoggedIn: Boolean,
    ): List<Result> = withContext(Dispatchers.IO) {
        clients.map { client -> probe(videoId, client, isLoggedIn) }
    }

    private suspend fun probe(
        videoId: String,
        client: YouTubeClient,
        isLoggedIn: Boolean,
    ): Result {
        if (client.loginRequired && !isLoggedIn) {
            return Result(client.label, Outcome.SKIPPED, null, "requires login", 0, 0)
        }

        var status: String? = null
        var reason: String? = null
        var formats = 0
        var outcome = Outcome.ERROR

        val elapsed = measureTimeMillis {
            runCatching {
                withTimeoutOrNull(PROBE_TIMEOUT_MILLIS) {
                    val response = YouTube.player(videoId, null, client, null, null).getOrThrow()
                    status = response.playabilityStatus.status
                    reason = response.playabilityStatus.reason
                    val audio = response.streamingData?.adaptiveFormats
                        ?.filter { it.isAudio }
                        .orEmpty()
                    formats = audio.size

                    outcome = when {
                        status != "OK" -> Outcome.REFUSED
                        audio.isEmpty() -> Outcome.NO_FORMAT
                        else -> {
                            val url = audio.firstOrNull { !it.url.isNullOrEmpty() }?.url
                            when {
                                url == null -> Outcome.NO_FORMAT
                                urlIsServing(url) -> Outcome.PLAYABLE
                                else -> Outcome.DEAD_URL
                            }
                        }
                    }
                } ?: run { outcome = Outcome.ERROR; reason = "timed out" }
            }.onFailure { error ->
                outcome = Outcome.ERROR
                reason = error.message?.take(120)
            }
        }

        return Result(client.label, outcome, status, reason, formats, elapsed)
    }

    private fun urlIsServing(url: String): Boolean = runCatching {
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            setRequestProperty("Range", "bytes=0-0")
            connectTimeout = URL_CHECK_TIMEOUT_MILLIS
            readTimeout = URL_CHECK_TIMEOUT_MILLIS
        }
        try {
            connection.responseCode in 200..299
        } finally {
            connection.disconnect()
        }
    }.getOrDefault(false)

    fun format(videoId: String, results: List<Result>): String = buildString {
        appendLine("Client probe for videoId=$videoId")
        appendLine("=".repeat(72))
        results.forEach { appendLine(it.line) }
        appendLine("=".repeat(72))
        val playable = results.count { it.outcome == Outcome.PLAYABLE }
        appendLine("$playable of ${results.size} clients returned a stream that is actually serving.")
        if (playable == 0) {
            appendLine(
                "None worked. That points at something shared -- network, region or " +
                    "account -- rather than at any one client being stale.",
            )
        }
    }

    private const val PROBE_TIMEOUT_MILLIS = 15_000L
    private const val URL_CHECK_TIMEOUT_MILLIS = 8_000
}

private val YouTubeClient.label: String
    get() = friendlyName ?: clientName
