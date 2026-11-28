package com.lomu.app.sync

import java.time.Instant
import java.time.ZoneId
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

data class SleepPlay(
    val id: String, val title: String, val artist: String, val thumb: String?,
    val at: Long, val playedMs: Long, val completed: Boolean, val skipped: Boolean,
)

data class SleepSession(
    val start: Long,
    val end: Long,
    val plays: List<SleepPlay>,
    val asleepFrom: Long,
    val lastAwakeIndex: Int,
    val asleepMs: Long,
    val confidence: String,
    val corrected: Boolean,
) {
    val lastAwake get() = plays[lastAwakeIndex]
}

private const val MIN = 60_000L
private const val MIN_RUN_MS = 75 * MIN
private const val MIN_RUN_SONGS = 10
private const val NODDING_OFF_MS = 15 * MIN

fun followsOn(a: SleepPlay, b: SleepPlay): Boolean {
    if (!a.completed || b.skipped) return false
    val delta = b.at - a.at
    if (delta <= 0) return false
    return abs(delta - a.playedMs) <= max(60_000.0, a.playedMs * 0.2) || abs(delta - b.playedMs) <= max(60_000.0, b.playedMs * 0.2)
}

fun collapseRepeats(plays: List<SleepPlay>): List<SleepPlay> {
    val out = ArrayList<SleepPlay>()
    for (p in plays.sortedBy { it.at }) {
        val prev = out.lastOrNull()
        if (prev != null && prev.id == p.id && p.playedMs >= prev.playedMs && p.at - prev.at < 90_000 + (p.playedMs - prev.playedMs)) out[out.lastIndex] = p.copy(at = min(prev.at, p.at))
        else out.add(p)
    }
    return out
}

private fun isNight(t: Long): Boolean {
    val h = Instant.ofEpochMilli(t).atZone(ZoneId.systemDefault()).hour
    return h >= 21 || h < 9
}

fun detectSleep(history: List<SleepPlay>, anchors: Map<Long, Long> = emptyMap()): List<SleepSession> {
    val plays = collapseRepeats(history)
    val out = ArrayList<SleepSession>()
    var run = ArrayList<SleepPlay>()
    fun flush() {
        if (run.size >= MIN_RUN_SONGS) {
            val last = run.last()
            val start = run.first().at
            val end = last.at + last.playedMs
            if (end - start >= MIN_RUN_MS) out.add(session(run, start, end, anchors[start]))
        }
        run = ArrayList()
    }
    for (p in plays) {
        if (run.isNotEmpty() && followsOn(run.last(), p)) run.add(p) else { flush(); run.add(p) }
    }
    flush()
    return out.reversed()
}

private fun session(run: List<SleepPlay>, start: Long, end: Long, anchor: Long?): SleepSession {
    val span = end - start
    var idx = 0
    var asleepFrom = start + min(NODDING_OFF_MS, span / 4)
    var corrected = false
    if (anchor != null) {
        val i = run.indexOfFirst { it.at == anchor }
        if (i >= 0) { idx = i; asleepFrom = run[i].at + run[i].playedMs / 2; corrected = true }
    }
    if (!corrected) idx = run.indexOfFirst { it.at + it.playedMs >= asleepFrom }.coerceAtLeast(0)
    val overnight = isNight(start) || isNight(start + span / 2)
    val confidence = if (overnight && span >= 180 * MIN) "high" else if (overnight || span >= 120 * MIN) "medium" else "low"
    return SleepSession(start, end, run, asleepFrom, idx, max(0, end - asleepFrom), confidence, corrected)
}

fun formatSpan(ms: Long): String {
    val m = Math.round(ms / MIN.toDouble())
    if (m < 60) return "${m}m"
    val h = m / 60
    return if (m % 60 != 0L) "${h}h ${m % 60}m" else "${h}h"
}

data class Nap(
    val startAt: Long,
    val endAt: Long,
    val from: Long,
    val to: Long,
    val betweenMs: Long,
    val wholeMs: Long,
    val songs: List<SleepPlay>,
)

fun stampsAtEnd(range: List<SleepPlay>): Boolean {
    var start = 0
    var end = 0
    for (i in 1 until range.size) {
        val a = range[i - 1]
        val b = range[i]
        val d = b.at - a.at
        if (d <= 0) continue
        val sa = abs(d - a.playedMs) <= max(60_000.0, a.playedMs * 0.2)
        val sb = abs(d - b.playedMs) <= max(60_000.0, b.playedMs * 0.2)
        if (sa && !sb) start++ else if (sb && !sa) end++
    }
    return end > start
}

fun napBetween(history: List<SleepPlay>, pickA: Long, pickB: Long): Nap? {
    val plays = collapseRepeats(history)
    val lo = min(pickA, pickB)
    val hi = max(pickA, pickB)
    val i = plays.indexOfFirst { it.at == lo }
    val j = plays.indexOfLast { it.at == hi }
    if (i < 0 || j < 0 || j < i) return null
    val range = plays.subList(i, j + 1)
    val first = range.first()
    val last = range.last()
    val atEnd = stampsAtEnd(range)
    val from = if (atEnd) first.at - first.playedMs else first.at
    val firstEnd = if (atEnd) first.at else first.at + first.playedMs
    val lastStart = if (atEnd) last.at - last.playedMs else last.at
    val to = if (atEnd) last.at else last.at + last.playedMs
    return Nap(lo, hi, from, to, max(0, lastStart - firstEnd), max(0, to - from), range)
}
