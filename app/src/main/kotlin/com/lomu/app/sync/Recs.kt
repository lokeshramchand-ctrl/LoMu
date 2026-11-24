package com.lomu.app.sync

import com.lomu.app.models.MediaMetadata
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

/**
 * On-device recommendation scoring. A direct port of web/src/server/recs-core.ts so the phone
 * builds the same shelves from its own play log and likes, with no server involved (the server
 * only has to supply the history from other devices, which sync already merges into the local
 * database). Pure functions, no I/O.
 */
data class PlayDoc(val track: MediaMetadata, val at: Long, val playedMs: Long, val completed: Boolean, val skipped: Boolean)
data class LikeDoc(val track: MediaMetadata, val at: Long)

class Affinity(
    val trackScore: Map<String, Double>,
    val artistScore: Map<String, Double>,
    val topTracks: List<MediaMetadata>,
    val onRepeat: List<MediaMetadata>,
    val heavilyPlayed: Set<String>,
    val skipped: Set<String>,
    val knownArtists: Set<String>,
    val favorites: List<MediaMetadata>,
)

private const val DAY = 86_400_000L
private fun decay(ageMs: Long, halfLifeDays: Double) = 0.5.pow(max(0L, ageMs).toDouble() / DAY / halfLifeDays)
private fun lead(t: MediaMetadata) = t.artists.firstOrNull()?.name?.lowercase().orEmpty()

fun affinity(plays: List<PlayDoc>, likes: List<LikeDoc>, now: Long): Affinity {
    val trackScore = HashMap<String, Double>()
    val artistScore = HashMap<String, Double>()
    val byId = HashMap<String, MediaMetadata>()
    val completions = HashMap<String, Int>()
    val recentSkips = HashMap<String, Int>()
    val monthPlays = LinkedHashMap<String, Int>()
    val likedIds = likes.map { it.track.id }.toSet()

    fun add(t: MediaMetadata, w: Double) {
        byId[t.id] = t
        trackScore[t.id] = (trackScore[t.id] ?: 0.0) + w
        for (a in t.artists) artistScore.merge(a.name.lowercase(), w * 0.5) { x, y -> x + y }
    }

    for (p in plays) {
        val age = now - p.at
        val d = decay(age, 14.0)
        when {
            p.completed -> {
                add(p.track, d)
                completions.merge(p.track.id, 1) { x, y -> x + y }
                if (age < 30 * DAY) monthPlays.merge(p.track.id, 1) { x, y -> x + y }
            }
            p.skipped -> {
                add(p.track, -1.2 * d)
                if (age < 21 * DAY) recentSkips.merge(p.track.id, 1) { x, y -> x + y }
            }
            else -> {
                // Further into the song is a stronger "yes"; flat 0.3 when the length is unknown.
                val dur = p.track.duration * 1000.0
                add(p.track, (if (dur > 0) min(0.7, max(0.1, p.playedMs / dur * 0.8)) else 0.3) * d)
            }
        }
    }
    for (l in likes) add(l.track, 2 * decay(now - l.at, 45.0))

    val ranked = trackScore.entries.filter { it.value > 0 }.sortedByDescending { it.value }
    val top = ArrayList<MediaMetadata>()
    val perArtist = HashMap<String, Int>()
    for ((id, _) in ranked) {
        val t = byId[id] ?: continue
        val n = perArtist[lead(t)] ?: 0
        if (n >= (if (top.size < 3) 1 else 2)) continue // spread the first few seeds, then at most two per artist
        perArtist[lead(t)] = n + 1
        top.add(t)
        if (top.size >= 20) break
    }

    val onRepeat = monthPlays.entries.sortedByDescending { it.value }.take(50).mapNotNull { byId[it.key] }

    val favorites = ranked.take(80).mapNotNull { byId[it.key] }

    return Affinity(
        trackScore, artistScore, top, onRepeat,
        heavilyPlayed = completions.filter { it.value >= 3 }.keys.toSet(),
        skipped = recentSkips.filter { it.value >= 1 && it.key !in likedIds }.keys.toSet(),
        knownArtists = artistScore.filter { it.value > 0 }.keys.toSet(),
        favorites = favorites,
    )
}

/** Consensus ranking: a candidate several strong seeds agree on beats one that appears once. */
fun rankCandidates(seeds: List<MediaMetadata>, cands: Map<String, List<MediaMetadata>>, aff: Affinity): List<MediaMetadata> {
    val score = HashMap<String, Double>()
    val byId = HashMap<String, MediaMetadata>()
    val seedIds = seeds.map { it.id }.toSet()
    seeds.forEachIndexed { si, seed ->
        val seedWeight = 1.0 / (1 + si * 0.25)
        val list = cands[seed.id].orEmpty()
        list.forEachIndexed { rank, t ->
            if (t.id in seedIds || t.id in aff.skipped || t.id in aff.heavilyPlayed) return@forEachIndexed
            byId[t.id] = t
            val positional = 1 - (rank.toDouble() / max(1, list.size)) * 0.5
            score.merge(t.id, seedWeight * positional) { x, y -> x + y }
        }
    }
    for ((id, s) in score.entries.toList()) {
        val t = byId[id] ?: continue
        val best = t.artists.maxOfOrNull { aff.artistScore[it.name.lowercase()] ?: 0.0 } ?: 0.0
        val boost = min(1.0, max(0.0, best) / 5)
        score[id] = s * (1 + 0.3 * boost)
    }
    return score.entries.sortedByDescending { it.value }.mapNotNull { byId[it.key] }
}

/** Keeps at most [cap] tracks per lead artist, preserving order. */
fun diversify(list: List<MediaMetadata>, cap: Int): List<MediaMetadata> {
    val seen = HashMap<String, Int>()
    val out = ArrayList<MediaMetadata>()
    for (t in list) {
        val a = lead(t)
        val n = seen[a] ?: 0
        if (a.isNotEmpty() && n >= cap) continue
        seen[a] = n + 1
        out.add(t)
    }
    return out
}

// ---- Daily mix (port of dailyMix in recs-core.ts): same three pools, same rhythm, deterministic per day.

fun dayKey(now: Long): String = java.time.Instant.ofEpochMilli(now).atZone(java.time.ZoneId.systemDefault()).toLocalDate().toString()

private fun rng(seed: String) = java.util.Random(seed.hashCode().toLong() * 2654435761L)

/** Picks [n] of [list], favouring the front but never in the same order two days running. */
private fun <T> pickWeighted(list: List<T>, n: Int, r: java.util.Random): List<T> =
    list.mapIndexed { i, t -> t to r.nextDouble().pow(1.0 / (1 + 1.5 / (1 + i * 0.15))) }
        .sortedByDescending { it.second }.take(n).map { it.first }

fun dailySeeds(top: List<MediaMetadata>, day: String, n: Int = 6): List<MediaMetadata> =
    if (top.size <= n) top else top.take(2) + pickWeighted(top.drop(2), n - 2, rng("seeds:$day"))

fun dailyMix(
    aff: Affinity, ranked: List<MediaMetadata>, day: String, size: Int = 40,
    salt: String = "", familiarPool: List<MediaMetadata>? = null, knownSet: Set<String>? = null, exclude: Set<String> = emptySet(),
): List<MediaMetadata> {
    val r = rng("mix:$day$salt")
    fun bad(t: MediaMetadata) = t.id in aff.skipped || t.id in exclude
    val ks = knownSet ?: aff.knownArtists
    val familiar = pickWeighted((familiarPool ?: aff.favorites).filter { !bad(it) }, (size * 0.35).toInt(), r)
    val fresh = ranked.filter { !bad(it) }
    val known = fresh.filter { t -> t.artists.any { it.name.lowercase() in ks } }
    val unknown = fresh.filter { t -> t.artists.none { it.name.lowercase() in ks } }
    val used = familiar.map { it.id }.toMutableSet()
    fun take(src: List<MediaMetadata>, n: Int): List<MediaMetadata> {
        val out = ArrayList<MediaMetadata>()
        for (t in pickWeighted(src.filter { it.id !in used }, n * 2, r)) {
            if (out.size >= n) break
            used.add(t.id); out.add(t)
        }
        return out
    }
    val q = mapOf(
        'F' to familiar.toMutableList(),
        'K' to take(known, (size * 0.4).toInt()).toMutableList(),
        'D' to take(unknown, (size * 0.25).toInt()).toMutableList(),
        'S' to take(fresh, size).toMutableList(),
    )
    val rhythm = "FKFKD"
    val total = q.values.sumOf { it.size }
    val out = ArrayList<MediaMetadata>()
    var i = 0
    while (out.size < size && out.size < total && i < size * 4) {
        for (k in listOf(rhythm[i % rhythm.length], 'F', 'K', 'D', 'S')) {
            val list = q.getValue(k)
            val idx = list.indexOfFirst { out.isEmpty() || lead(it) != lead(out.last()) }
            if (idx < 0) continue
            out.add(list.removeAt(idx))
            break
        }
        i++
    }
    return out
}

// ---- Five themed daily mixes (port of clusterSeeds / dailyMixes in recs-core.ts).

private class Cluster(val seeds: MutableList<MediaMetadata>, val ids: MutableSet<String>, val artists: MutableSet<String>)

/** Groups seeds into at most [k] tastes: a shared artist or overlapping radios means the same sound. */
fun clusterSeeds(seeds: List<MediaMetadata>, cands: Map<String, List<MediaMetadata>>, k: Int = 5): List<List<MediaMetadata>> {
    val cs = seeds.map { s ->
        Cluster(mutableListOf(s), cands[s.id].orEmpty().map { it.id }.toMutableSet(), s.artists.map { it.name.lowercase() }.toMutableSet())
    }.toMutableList()
    fun sim(a: Cluster, b: Cluster): Double {
        val same = a.artists.any { it in b.artists }
        val n = a.ids.count { it in b.ids }
        val overlap = n.toDouble() / max(1, min(a.ids.size, b.ids.size))
        return ((if (same) 2.0 else 0.0) + overlap) / (1 + 0.15 * (a.seeds.size + b.seeds.size))
    }
    while (cs.size > k) {
        var bi = 0; var bj = 1; var best = -1.0
        for (i in cs.indices) for (j in i + 1 until cs.size) {
            val v = sim(cs[i], cs[j])
            if (v > best) { best = v; bi = i; bj = j }
        }
        val a = cs[bi]; val b = cs.removeAt(bj)
        a.seeds.addAll(b.seeds); a.ids.addAll(b.ids); a.artists.addAll(b.artists)
    }
    return cs.map { it.seeds }
}

data class ThemedMix(val title: String, val subtitle: String, val items: List<MediaMetadata>)

private fun mixName(group: List<MediaMetadata>, aff: Affinity): String {
    val score = LinkedHashMap<String, Pair<String, Double>>()
    for (t in group) {
        val a = t.artists.firstOrNull()?.name ?: continue
        val cur = score[a.lowercase()] ?: (a to 0.0)
        score[a.lowercase()] = cur.first to cur.second + (aff.trackScore[t.id] ?: 0.0)
    }
    val top = score.values.sortedByDescending { it.second }.take(3).map { it.first }
    return if (top.isEmpty()) "Your taste" else top.joinToString(", ") + " and more"
}

fun dailyMixes(aff: Affinity, cands: Map<String, List<MediaMetadata>>, day: String, count: Int = 5, size: Int = 40): List<ThemedMix> {
    val seeds = aff.topTracks.take(15)
    val groups = clusterSeeds(seeds, cands, count).sortedByDescending { g -> g.sumOf { aff.trackScore[it.id] ?: 0.0 } }
    val taken = HashSet<String>()
    val out = ArrayList<ThemedMix>()
    groups.forEachIndexed { i, g ->
        val artists = HashSet<String>()
        g.forEach { t -> t.artists.forEach { artists.add(it.name.lowercase()) } }
        val seen = HashMap<String, Int>()
        for (s in g) for (t in cands[s.id].orEmpty()) for (a in t.artists) seen.merge(a.name.lowercase(), 1) { x, y -> x + y }
        for ((a, n) in seen) if (n >= 2 && a in aff.knownArtists) artists.add(a)
        val familiar = aff.favorites.filter { t -> t.artists.any { it.name.lowercase() in artists } }
        val items = dailyMix(aff, rankCandidates(g, cands, aff), day, size, "#$i", familiar, artists, taken)
        if (items.size < 8) return@forEachIndexed
        taken.addAll(items.map { it.id })
        out.add(ThemedMix("", mixName(g, aff), items))
    }
    return out.mapIndexed { i, m -> m.copy(title = "Daily Mix ${i + 1}") }
}
