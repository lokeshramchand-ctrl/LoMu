package com.lomu.app.sync

import com.lomu.app.models.MediaMetadata
import org.junit.Assert.assertEquals
import org.junit.Test

private fun song(id: String, artist: String) = MediaMetadata(id, id, listOf(MediaMetadata.Artist(null, artist)), 200)

class NextUpTest {
    @Test
    fun skippedBlockedAndRecentGoLikedArtistsFirstCappedAtThree() {
        val now = 1_000_000_000L
        val plays = listOf(
            PlayDoc(song("fav1", "Fave"), now, 200_000, completed = true, skipped = false),
            PlayDoc(song("skip", "Meh"), now, 1_000, completed = false, skipped = true),
        )
        val aff = affinity(plays, emptyList(), now, blocked = setOf("blocked"))
        val list = listOf(
            song("a", "Other"), song("skip", "Meh"), song("b", "Blocked"), song("recent", "Other"),
            song("f1", "Fave"), song("f2", "Fave"), song("f3", "Fave"), song("f4", "Fave"), song("seed", "Other"),
        )
        val out = nextUpRank(list, "seed", setOf("recent"), aff).map { it.id }
        assertEquals(listOf("f1", "f2", "f3", "a"), out)
    }
}
