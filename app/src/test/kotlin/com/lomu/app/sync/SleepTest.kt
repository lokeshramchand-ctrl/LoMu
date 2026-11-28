package com.lomu.app.sync

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.ZoneId
import java.time.ZonedDateTime

private const val MIN = 60_000L
private val T0 = ZonedDateTime.of(2026, 11, 21, 16, 0, 0, 0, ZoneId.systemDefault()).toInstant().toEpochMilli()

private fun lenOf(i: Int) = 180_000L + (i % 7) * 20_000L

private fun queue(n: Int, startAt: Long = T0, endStamped: Boolean = false, idPrefix: String = "s"): List<SleepPlay> {
    var begin = startAt
    return List(n) { i ->
        val len = lenOf(i)
        val p = SleepPlay("$idPrefix$i", "Song $i", "Artist", null, if (endStamped) begin + len else begin, len, completed = true, skipped = false)
        begin += len
        p
    }
}
private fun total(from: Int, to: Int) = (from..to).sumOf { lenOf(it) }

class SleepTest {

    @Test fun twoHourTripStartStamped() {
        val q = queue(34)
        val nap = napBetween(q, q[3].at, q[30].at)!!
        assertEquals(28, nap.songs.size)
        assertEquals(q[3].at, nap.from)
        assertEquals(q[30].at + lenOf(30), nap.to)
        assertEquals(total(3, 30), nap.wholeMs)
        assertEquals(total(4, 29), nap.betweenMs)
    }

    @Test fun sameResultWhenLogStampsTheEnd() {
        val a = queue(34, endStamped = false)
        val b = queue(34, endStamped = true)
        val na = napBetween(a, a[3].at, a[30].at)!!
        val nb = napBetween(b, b[3].at, b[30].at)!!
        assertTrue(stampsAtEnd(nb.songs))
        assertFalse(stampsAtEnd(na.songs))
        assertEquals(na.wholeMs, nb.wholeMs)
        assertEquals(na.betweenMs, nb.betweenMs)
        assertEquals(na.from, nb.from)
        assertEquals(na.to, nb.to)
    }

    @Test fun pickOrderDoesNotMatter() {
        val q = queue(20)
        assertEquals(napBetween(q, q[2].at, q[15].at), napBetween(q, q[15].at, q[2].at))
    }

    @Test fun singleSongPickIsJustThatSong() {
        val q = queue(5)
        val nap = napBetween(q, q[2].at, q[2].at)!!
        assertEquals(1, nap.songs.size)
        assertEquals(lenOf(2), nap.wholeMs)
        assertEquals(0L, nap.betweenMs)
    }

    @Test fun adjacentSongsHaveNoGapBetween() {
        val q = queue(5)
        val nap = napBetween(q, q[1].at, q[2].at)!!
        assertEquals(total(1, 2), nap.wholeMs)
        assertEquals(0L, nap.betweenMs)
    }

    @Test fun unknownPicksGiveNull() {
        val q = queue(5)
        assertNull(napBetween(q, q[1].at, 12345L))
        assertNull(napBetween(emptyList(), 1L, 2L))
    }

    @Test fun pausedMidTripCountsTheWholeWallClock() {
        val first = queue(10)
        val second = queue(10, startAt = T0 + total(0, 9) + 20 * MIN, idPrefix = "t")
        val all = first + second
        val nap = napBetween(all, all[0].at, all[19].at)!!
        assertEquals(total(0, 9) + 20 * MIN + total(0, 9), nap.wholeMs)
        assertTrue(nap.wholeMs > 2 * total(0, 9))
    }

    @Test fun listenedTimeShorterThanSongIsRespected() {
        val q = queue(10).toMutableList()
        q[9] = q[9].copy(playedMs = 60_000)
        val nap = napBetween(q, q[0].at, q[9].at)!!
        assertEquals(total(0, 8) + 60_000, nap.wholeMs)
    }

    @Test fun repeatedRowsForOneListenCollapse() {
        val rows = listOf(
            SleepPlay("a", "A", "x", null, T0, 30_000, false, false),
            SleepPlay("a", "A", "x", null, T0 + 20_000, 50_000, false, false),
            SleepPlay("a", "A", "x", null, T0 + 40_000, 180_000, true, false),
            SleepPlay("b", "B", "x", null, T0 + 180_000, 200_000, true, false),
        )
        assertEquals(2, collapseRepeats(rows).size)
        val nap = napBetween(rows, T0, T0 + 180_000)!!
        assertEquals(2, nap.songs.size)
    }

    @Test fun repeatOneLoopIsNotCollapsed() {
        val loop = List(5) { i -> SleepPlay("a", "A", "x", null, T0 + i * 200_000L, 200_000, true, false) }
        assertEquals(5, collapseRepeats(loop).size)
    }

    @Test fun detectsALongUnattendedRun() {
        val s = detectSleep(queue(60))
        assertEquals(1, s.size)
        assertEquals(60, s[0].plays.size)
        assertTrue(s[0].asleepMs in 200 * MIN..245 * MIN)
    }

    @Test fun ignoresShortRuns() {
        assertTrue(detectSleep(queue(12)).isEmpty())
    }

    @Test fun aSkipBreaksTheRun() {
        val q = queue(24).toMutableList()
        q[12] = q[12].copy(completed = false, playedMs = 8_000, skipped = true)
        assertTrue(detectSleep(q).isEmpty())
    }

    @Test fun anchorMovesTheEstimate() {
        val q = queue(60)
        val auto = detectSleep(q)[0]
        val fixed = detectSleep(q, mapOf(auto.start to q[30].at))[0]
        assertTrue(fixed.corrected)
        assertEquals(30, fixed.lastAwakeIndex)
        assertEquals(q[30].at + lenOf(30) / 2, fixed.asleepFrom)
        assertTrue(fixed.asleepMs < auto.asleepMs)
    }

    @Test fun twoSeparateRunsAreBothFoundNewestFirst() {
        val a = queue(40)
        val b = queue(40, startAt = T0 + 5 * 3_600_000L, idPrefix = "t")
        val found = detectSleep(a + b)
        assertEquals(2, found.size)
        assertTrue(found[0].start > found[1].start)
    }

    @Test fun logStampedAtEndIsStillOneRun() {
        assertEquals(1, detectSleep(queue(60, endStamped = true)).size)
    }

    @Test fun formatsSpans() {
        assertEquals("45m", formatSpan(45 * MIN))
        assertEquals("2h", formatSpan(120 * MIN))
        assertEquals("1h 59m", formatSpan(119 * MIN))
        assertEquals("0m", formatSpan(0))
    }

    @Test fun napOverAnAutoDetectedRunAgrees() {
        val q = queue(60)
        val run = detectSleep(q)[0]
        val nap = napBetween(q, run.plays.first().at, run.plays.last().at)!!
        assertEquals(run.end - run.start, nap.wholeMs)
        assertNotNull(nap)
    }
}
