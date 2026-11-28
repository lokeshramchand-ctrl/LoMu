/* Dev-only "Demo data / Worst case" switch. The data is changed where it enters the app (api.ts get()), never in the components.
   Values are realistic: YouTube titles run to 100 characters, uploaders credit six artists, catalogues hold CJK / Arabic / Thai / Vietnamese titles,
   some tracks have no art, no artists or a zero length. Modes: demo | worst | empty | one. Never active in a production build. */

export type DataMode = 'demo' | 'worst' | 'empty' | 'one';
export const MODES: { id: DataMode; label: string }[] = [
  { id: 'demo', label: 'Demo data' },
  { id: 'worst', label: 'Worst case' },
  { id: 'empty', label: 'Empty' },
  { id: 'one', label: 'One' },
];

export function dataMode(): DataMode {
  if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') return 'demo';
  const m = new URLSearchParams(window.location.search).get('data') ?? window.sessionStorage.getItem('lomu-data');
  return m === 'worst' || m === 'empty' || m === 'one' ? m : 'demo';
}

const TITLES = [
  'Pachai Nirame (From "Alaipayuthey") [Remastered 2019 Deluxe Anniversary Edition] - Official Music Video (4K)', // 100 chars, the YouTube limit
  'Ö',
  '夜に駆ける (Yoru ni Kakeru) – YOASOBI 🎧✨',
  'ملكة جمال الكون – النسخة الكاملة',
  'Dil Dhadakne Do (Title Track) feat. Priyanka Chopra, Farhan Akhtar, Ranveer Singh & Anil Kapoor',
  '<b>Bold</b> &amp; **markdown** <script>x</script>',
  'Nhạc Việt Nam Hay Nhất Mọi Thời Đại Tuyển Chọn',
  'ฟังเพลงเพราะ ๆ ทั้งวัน สบาย ๆ ชิล ๆ',
  'Jo',
  'Supercalifragilisticexpialidocious_Live_at_Wembley_Stadium_1986_Remaster',
];
const ARTIST_NAMES = [
  ['Aleksandra Wiśniewska-Kowalczyk', 'Jean-Baptiste Emmanuel Zorg', 'A. R. Rahman', 'Shreya Ghoshal', 'Sid Sriram', 'Anirudh Ravichander'],
  ['A'],
  [],
  ['Мария Ивановна Петрова-Водкина'],
  ['Hiroyuki Sawano feat. Mika Kobayashi & Benjamin'],
];
const ARTISTS = ARTIST_NAMES.map((l) => l.map((name) => ({ name })));
const DURATIONS: (number | undefined)[] = [0, 59, undefined, 36000, 213, 7384];
const THUMBS: (string | undefined)[] = ['https://invalid.example/missing.jpg', undefined, undefined]; // the rest keep their real art

function nameOf(i: number, kind: string) {
  const t = TITLES[i % TITLES.length];
  return kind === 'artist' ? t.slice(0, 60) : t;
}

/** Rewrites every song / album / playlist / artist object in a response, spreading the failures across rows. */
function worstify(v: unknown, n = { i: 0 }): unknown {
  if (Array.isArray(v)) return v.map((x) => worstify(x, n));
  if (!v || typeof v !== 'object') return v;
  const o = { ...(v as Record<string, unknown>) };
  if (typeof o.kind === 'string' && ['song', 'album', 'playlist', 'artist'].includes(o.kind)) {
    const i = n.i++;
    o.title = nameOf(i, o.kind);
    if (o.kind === 'song' || o.kind === 'album') o.artists = ARTISTS[i % ARTISTS.length];
    if (o.kind === 'song') o.duration = DURATIONS[i % DURATIONS.length];
    if (o.kind !== 'artist') o.subtitle = o.kind === 'album' ? 'Album · ' + 'Original Motion Picture Soundtrack '.repeat(2) : o.subtitle;
    if (i % 4 === 0 || i % 7 === 3) o.thumb = THUMBS[i % THUMBS.length];
    return o;
  }
  for (const k of Object.keys(o)) {
    if (k === 'title' && typeof o[k] === 'string' && Array.isArray(o.items)) o[k] = `Because you listened to ${TITLES[n.i % TITLES.length]} (${n.i++})`; // shelf titles
    else o[k] = worstify(o[k], n);
  }
  return o;
}

/** Empties lists, or cuts every list to one item. */
function shrink(v: unknown, keep: number): unknown {
  if (Array.isArray(v)) return v.slice(0, keep).map((x) => shrink(x, keep));
  if (!v || typeof v !== 'object') return v;
  return Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, shrink(x, keep)]));
}

export function applyMode<T>(json: T): T {
  const m = dataMode();
  if (m === 'worst') return worstify(json) as T;
  if (m === 'empty') return shrink(json, 0) as T;
  if (m === 'one') return shrink(json, 1) as T;
  return json;
}
