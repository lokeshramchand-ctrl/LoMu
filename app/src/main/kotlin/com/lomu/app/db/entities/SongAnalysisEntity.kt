package com.lomu.app.db.entities

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.time.LocalDateTime

@Entity(tableName = "song_analysis")
data class SongAnalysisEntity(
    @PrimaryKey val id: String,
    val bpm: Float,
    val anchorBeatMs: Float,
    val bpmConfidence: Float,
    val keyIndex: Int = -1,
    val keyIsMinor: Boolean = false,
    val keyConfidence: Float = 0f,
    val energyProfile: ByteArray = ByteArray(0),
    val analyzedAt: LocalDateTime = LocalDateTime.now(),
    val analysisVersion: Int = CURRENT_ANALYSIS_VERSION,
) {
    companion object {
        const val CURRENT_ANALYSIS_VERSION = 1
    }
}
