package com.music.innertube

import org.junit.Assert.assertEquals
import org.junit.Test

class DataSyncIdTest {
    @Test
    fun normalizesDataSyncId() {
        val innerTube = InnerTube()

        innerTube.dataSyncId = "AbCd1234||"
        assertEquals("AbCd1234", innerTube.dataSyncId)

        innerTube.dataSyncId = "AbCd1234||EfGh5678"
        assertEquals("AbCd1234", innerTube.dataSyncId)

        innerTube.dataSyncId = "AbCd1234"
        assertEquals("AbCd1234", innerTube.dataSyncId)

        innerTube.dataSyncId = "null"
        assertEquals(null, innerTube.dataSyncId)

        innerTube.dataSyncId = ""
        assertEquals(null, innerTube.dataSyncId)
    }
}
