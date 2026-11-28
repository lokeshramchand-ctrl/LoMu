package com.lomu.app.sync

import com.lomu.app.models.MediaMetadata
import java.time.Instant
import java.time.ZoneId

data class WPlay(val track: MediaMetadata, val at: Long, val playedMs: Long, val completed: Boolean, val skipped: Boolean)
data class WArtist(val name: String, val thumb: String?, val ms: Long, val plays: Int)
data class WSong(val track: MediaMetadata, val plays: Int)

data class WrappedStats(
    val label: String,
    val years: List<Int>,
    val minutes: Int,
    val plays: Int,
    val songs: Int,
    val artists: Int,
    val topArtists: List<WArtist>,
    val topSongs: List<WSong>,
    val topArtistShare: Double,
    val personaTitle: String,
    val personaLine: String,
    val peakHour: Int?,
    val hourMs: List<Long>,
    val busiestDay: Pair<String, Int>?,
    val busiestMonth: Pair<String, Int>?,
    val longestStreak: Int,
    val activeDays: Int,
    val newArtists: Int,
    val skipRate: Double,
)

private fun persona(hourMs: List<Long>): Pair<String, String> {
    val total = max1(hourMs.sum())
    fun part(from: Int, to: Int) = hourMs.withIndex().sumOf { (h, v) -> if (if (from < to) h in from until to else h >= from || h < to) v else 0L } / total.toDouble()
    val night = part(22, 5); val morning = part(5, 11); val afternoon = part(11, 17); val evening = part(17, 22)
    fun pct(x: Double) = Math.round(x * 100)
    return when {
        night >= 0.3 -> "Night Owl" to "${pct(night)}% of your listening happens after 10pm."
        morning >= 0.3 -> "Early Bird" to "${pct(morning)}% of your listening happens before 11am."
        afternoon >= evening -> "Daytime Drifter" to "${pct(afternoon)}% of your listening is between 11am and 5pm."
        else -> "Evening Unwinder" to "${pct(evening)}% of your listening is between 5pm and 10pm."
    }
}

private fun max1(v: Long) = if (v < 1) 1L else v

fun buildWrapped(history: List<WPlay>, year: Int?): WrappedStats? {
    val zone = ZoneId.systemDefault()
    fun local(at: Long) = Instant.ofEpochMilli(at).atZone(zone)
    val years = history.map { local(it.at).year }.distinct().sortedDescending()
    val inPeriod = history.filter { year == null || local(it.at).year == year }
    if (inPeriod.isEmpty()) return null

    fun lead(t: MediaMetadata) = t.artists.firstOrNull()?.name?.takeIf { it != "N/A" }
    val firstSeen = HashMap<String, Long>()
    for (p in history) lead(p.track)?.let { a -> firstSeen[a] = minOf(firstSeen[a] ?: Long.MAX_VALUE, p.at) }

    val hourMs = LongArray(24)
    val dayMs = HashMap<java.time.LocalDate, Long>()
    val monthMs = HashMap<Pair<Int, Int>, Long>()
    val songPlays = LinkedHashMap<String, Pair<MediaMetadata, Int>>()
    class Acc(var thumb: String?, var ms: Long = 0, var plays: Int = 0)
    val artists = HashMap<String, Acc>()
    var totalMs = 0L; var skips = 0; var done = 0
    for (p in inPeriod) {
        val w = local(p.at)
        totalMs += p.playedMs
        if (p.completed) done++
        if (p.skipped) skips++
        hourMs[w.hour] += p.playedMs
        dayMs.merge(w.toLocalDate(), p.playedMs) { x, y -> x + y }
        monthMs.merge(w.year to w.monthValue, p.playedMs) { x, y -> x + y }
        val cur = songPlays[p.track.id] ?: (p.track to 0)
        songPlays[p.track.id] = cur.first to cur.second + if (p.completed) 1 else 0
        lead(p.track)?.let { a ->
            val x = artists.getOrPut(a) { Acc(p.track.thumbnailUrl) }
            x.ms += p.playedMs
            if (p.completed) x.plays++
        }
    }

    val days = dayMs.keys.sorted()
    var best = 0; var run = 0
    days.forEachIndexed { i, d ->
        run = if (i > 0 && days[i - 1].plusDays(1) == d) run + 1 else 1
        best = maxOf(best, run)
    }
    val topArtists = artists.entries.sortedByDescending { it.value.ms }
    val peak = hourMs.max()
    val (pTitle, pLine) = persona(hourMs.toList())
    val topDay = dayMs.entries.maxByOrNull { it.value }
    val topMonth = monthMs.entries.maxByOrNull { it.value }
    val dayFmt = java.time.format.DateTimeFormatter.ofPattern("d MMMM", java.util.Locale.getDefault())
    val monthName = { m: Int -> java.time.Month.of(m).getDisplayName(java.time.format.TextStyle.FULL, java.util.Locale.getDefault()) }
    val periodStart = year?.let { java.time.LocalDate.of(it, 1, 1).atStartOfDay(zone).toInstant().toEpochMilli() } ?: Long.MIN_VALUE
    val periodEnd = year?.let { java.time.LocalDate.of(it + 1, 1, 1).atStartOfDay(zone).toInstant().toEpochMilli() } ?: Long.MAX_VALUE

    return WrappedStats(
        label = year?.toString() ?: "All time",
        years = years,
        minutes = Math.round(totalMs / 60_000.0).toInt(),
        plays = done,
        songs = songPlays.size,
        artists = artists.size,
        topArtists = topArtists.take(5).map { WArtist(it.key, it.value.thumb, it.value.ms, it.value.plays) },
        topSongs = songPlays.values.sortedByDescending { it.second }.take(10).map { WSong(it.first, it.second) },
        topArtistShare = if (totalMs > 0 && topArtists.isNotEmpty()) topArtists[0].value.ms.toDouble() / totalMs else 0.0,
        personaTitle = pTitle,
        personaLine = pLine,
        peakHour = if (peak > 0) hourMs.indexOf(peak) else null,
        hourMs = hourMs.toList(),
        busiestDay = topDay?.let { it.key.format(dayFmt) to Math.round(it.value / 60_000.0).toInt() },
        busiestMonth = topMonth?.let { monthName(it.key.second) to Math.round(it.value / 60_000.0).toInt() },
        longestStreak = best,
        activeDays = days.size,
        newArtists = firstSeen.values.count { it in periodStart until periodEnd },
        skipRate = if (inPeriod.isNotEmpty()) skips.toDouble() / inPeriod.size else 0.0,
    )
}
