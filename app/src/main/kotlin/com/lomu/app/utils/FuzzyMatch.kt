package com.lomu.app.utils

fun fuzzyScore(query: String, target: String): Int? {
    if (query.isBlank()) return 0
    val q = query.trim().lowercase()
    val t = target.lowercase()

    var score = 0
    var searchFrom = 0
    var consecutiveRun = 0
    for (qc in q) {
        val idx = t.indexOf(qc, searchFrom)
        if (idx == -1) return null
        consecutiveRun = if (idx == searchFrom) consecutiveRun + 1 else 1
        score += consecutiveRun * 2 - (idx - searchFrom)
        if (idx == 0 || t[idx - 1] == ' ') score += 3
        searchFrom = idx + 1
    }
    score -= (t.length - q.length) / 4
    return score
}

private fun demo() {
    check(fuzzyScore("abc", "xyz") == null)
    check(fuzzyScore("", "anything") == 0)
    check(fuzzyScore("cofee", "coffee shop") != null)
    check(fuzzyScore("taly", "italy") != null)
    val exact = fuzzyScore("italy", "italy")!!
    val loose = fuzzyScore("ity", "italy")!!
    check(exact > loose)
}
