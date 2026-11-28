# Handoff Spec: LoMu Android (current mobile UI)

Source of truth: `app/src/main/kotlin/com/lomu/app/ui/` (Theme, Root, Soundwaves, Screens, Player, Components, Motion). Units are dp; Figma uses the same numbers at 1x on a 412 x 915 frame (Pixel 7).

## Overview
LoMu is a personal music player (YouTube Music playback, own sync server). The look is "Soundwaves": white or true-black canvas, black ink as the accent, soft pastel cards, one black feature card, round grey buttons. The full player is the one exception: always dark, tinted by the cover art.

Navigation: bottom tab bar (Home, Search, Media, Create, optional New). Detail pages push on a back stack. Settings, Welcome, Import, Wrapped, Sleep, Mix are reached from cards, not tabs. Overlays: mini player, full player, devices sheet, track menu sheet.

## Layout
- Phone portrait is the design target; landscape only shrinks the tab bar (48 vs 64) and hides tab labels.
- Page gutter 20 (Home, Collections, Create); 16 on detail pages and Settings; rows inset 20.
- Bottom inset reserved for floating bars: 82 (tab bar only), 138 (tab bar + mini player), plus system nav bar. Lists end with `bottomPad` = inset + 24. A white-to-transparent gradient (inset + 8 high) sits under the bars so rows fade out beneath them.
- No tablet or desktop layout on the phone app (the web app covers those).

## Design Tokens Used
Colours (`Lo`, light / dark):
| Token | Light | Dark | Usage |
|---|---|---|---|
| `bg` | #FFFFFF | #0B0B0C | page canvas |
| `card` | #FFFFFF | #161617 | tab bar, sheets, cells |
| `surface2` | #F3F3F4 | #232325 | round buttons, search field, chips, art placeholder |
| `grouped` | #F5F5F6 | #0B0B0C | Settings page background |
| `cell` | #FFFFFF | #161617 | grouped Settings cells |
| `ink` | #0A0A0A | #F5F5F6 | primary text, active tab, accent fill |
| `grey` | #6B6B70 | #A0A0A6 | secondary text, inactive tab |
| `line` | #E6E6E8 | #2E2E31 | hairlines |
| `border2` | #D4D4D8 | #3F3F43 | strong outline |
| `signal` | #0A0A0A | #F5F5F6 | accent (same as ink) |
| `onSignal` | #FFFFFF | #0A0A0A | label on an accent fill |
| `red` | #C21A1A | #FF6B5E | destructive, error |
| `feature` | #0B0B0B | #28282B | Home feature card |
| `tiles[0..3]` | #F6EBE1 #E9EAF7 #E4F1EA #F3EDDD | #2A2420 #23242F #1F2924 #29261E | pastel cards: peach, lavender, mint, sand (cycled by index) |

Full player palette (both themes): `LegacyDarkLo`, i.e. bg #000000, ink #FFFFFF, secondary text white at 72%, accent #0A84FF, plus a colour wash from the cover.

Type (iOS text styles; SF Pro when bundled, Inter fallback; `APP_FONT_CHOICE = 1`):
| Token | Size / line / weight / tracking | Usage |
|---|---|---|
| `hero` | 32 / 38 / Bold / -0.6 | page titles, Welcome |
| `title` | 24 / 30 / Semibold / -0.2 | detail titles (26/31 Bold on Detail card) |
| `section` | 22 / 28 / Semibold / -0.2 | shelf headings |
| `playerTitle` | 22 / 28 / Bold / +0.35 (21/26 in player) | song title |
| `body` | 17 / 22 / Regular / -0.41 | rows, buttons (Semibold) |
| `sub` | 15 / 20 / Regular / -0.24 | secondary lines |
| `small` | 13 / 16 / Regular / -0.08 | captions, subtitles |
| `caption` | 12 / 14 / Medium / +0.07 | tab labels |

Shape: pill 12 radius (buttons), chips and search field fully round, tiles 24-26, Home feature card 28, Detail header card 32, cover radius 8 (rows) / 18 (shelves) / 28 (detail), tab bar top corners 28, mini player 36, Settings group 12.
Spacing in use: 4, 8, 12, 14, 16, 20, 24 (no token names in code; map to a 4-pt scale).

## Screens

### Home (`HomeScreen`)
Top row (status bar + 14): right-aligned grey capsule (surface2, 3 padding) holding Devices button (38 round) and avatar (38, user initials or "LM"). Page tints with the playing song's cover colour at the top, fading to white.
Sections, top to bottom:
1. Continue listening (only when another device has a queue): section title, one MediaRow (52 cover), small grey "Dismiss".
2. Feature card: black, radius 28, padding 14, 112 cover (radius 18), title (body semibold, white, 2 lines), artist (white 62%), heart (40 hit area) bottom-left, white 44 round play button bottom-right. Tap plays radio.
3. On Repeat: section title with chevron, horizontal row of 92 covers (radius 18), 12 gap, title 13 under each; tap plays the list from that song, title opens the Mix page.
4. Mixes, For your day, Moods and throwbacks: two-column grid of pastel tiles (radius 26, padding 12 x 16, round cover at 86% of tile width, title 16 medium centred, subtitle small grey up to 2 lines). 12 gaps. An odd last tile leaves the second cell empty.
5. Fallbacks: skeleton shelves while loading; error box with retry; open YouTube Music shelves when there is no personal data.

### Collections (`LibraryScreen`, tab "Media")
Title "Collections" (hero) with subline "N playlists   N liked songs" and a round search button. Chips: All / Playlists / Albums / Artists (selected = ink fill, onSignal text; others surface2). Two-column pastel grid (radius 24, padding 12 x 18, cover at 72% width radius 16, round for artists; title 16 medium, line small grey). "All" starts with Liked Songs. Empty: icon, "Nothing here yet", hint, accent pill "Import from YouTube Music".

### Create (`CreateScreen`)
Title "Create". New playlist card (tile 0, radius 26, padding 18): heading, hint, 50 high round white input, full-width accent pill "Create playlist". Below: stack of 22-radius row cards (16 padding, 44 white round icon, title semibold, grey line, chevron): Import, New releases, Wrapped, Sleep, Settings (Settings uses surface2).

### Detail pages: Album, Playlist, Artist, Local playlist, Mix (`Detail`)
Top row: optional capsule of 40 round action buttons on the left, 44 round Close on the right. Header card (radius 32, tile colour from title hash, padding 20 / 20 / 20 / 18): grey eyebrow (14), title (26 Bold, centred, 2 lines), cover (78% of width, max 280, radius 28, round for artists), then a row: 48 rounded square waveform icon, count + length, 52 round accent Shuffle button. Track list below as MediaRows with index numbers (36 wide), hairline inset 56, trailing duration. Long press opens the track menu.

### Search (`SearchScreen`)
46 high round search field (surface2) with mic or clear; results as `ResultRow`s; skeleton rows while loading.

### Settings (`SettingsScreen`)
Grouped (iOS style): page background `grouped`, groups radius 12 on `cell`, uppercase 13 grey headers, cells 16 x 12 padding, hairlines between, 30 coloured icon tiles (radius 7), destructive actions in `red`.

### Welcome (`Welcome`)
Full screen, 28 / 24 padding. 72 black square (radius 16) with note icon, "Welcome to LoMu" (hero), grey subtitle 20/25, three icon + title + sub rows (30 icon, 16 gap), full-width 52 high accent "Continue" pinned to the bottom.

### Import, Wrapped, Sleep
Same card and pill vocabulary; see `ImportScreen.kt`, `WrappedScreen.kt`, `SleepScreen.kt`.

## Components
| Component | Variants | Spec |
|---|---|---|
| Tab bar | active / inactive; 4 or 5 tabs | card fill, top radius 28, height 64 (48 landscape), 24 glyph + caption label, active = ink + Bold, inactive grey, 220 ms tint |
| Mini player | playing / paused; local / remote device | glass capsule radius 36, height 66, 14 side margin, 46 cover (radius 10), title 15 semibold, artist 13 medium grey, 52 play and skip buttons |
| Full player | artwork / playing-next list | always dark, 24 side padding, 52 high grabber area (36 x 5 bar), square artwork (shrinks to 86% when paused, 14 radius, tinted blur glow), title 21/26 + artist 19/24, 32 round like and more buttons, seek bar 4 (8 when dragging) with 10 (18) knob, controls 72 / 84 / 72, volume bar with speaker glyphs, bottom row Devices and Queue |
| MediaRow | indexed / cover; active; flat | 52 cover (radius 8), 14 gap, title body, line small grey, 7 vertical padding, hairline inset 66 (56 with index), active = ink to `signal` colour + bars on the cover (45% black scrim) |
| Pill | accent / filled / soft; icon optional | height 48, radius 12, horizontal padding 22, body semibold |
| Chips | selected / unselected | round, 16 x 8 padding, small semibold, 8 gap |
| RoundBtn / GlassCircle / Avatar | | 44 / 42 / 36-38 round on surface2 or glass |
| Pastel tile | colour index 0-3 | see Home and Collections |
| Cover | square / round | radius per use, surface2 placeholder, 0.5 hairline border |
| Track menu sheet | pages: menu, pick playlist, new playlist | bottom sheet, drag to dismiss, actions: play next, add to queue, like, add to playlist, go to album / artist, remove from queue |
| Devices sheet | | lists Connect devices; tap one to control it |
| Skeletons | rows, shelves, detail | surface2 blocks, shimmer |
| Empty / Error | | icon, title, hint, optional action; error with Retry |

## States and Interactions
| Element | State | Behaviour |
|---|---|---|
| Any pressable | pressed | `pressable` scale / dim feedback; min touch 44 (`minTouch`) |
| Tab | tap | haptic if switching; fade + 0.985 scale-in 240 ms |
| Track row | tap / long press | play from here / open track menu with haptic |
| Feature card | tap / heart / play | radio from song / toggle like / (card tap) |
| Like heart | on | filled, pop animation |
| Pill | disabled | not used on current screens except Settings actions (reduced emphasis) |
| Loading | | skeletons, never a lone spinner except `Loading()` (48 padding) |
| Error | | message + Retry |
| Empty | | EmptyState with a next step |

## Motion
| Element | Trigger | Animation | Duration | Easing |
|---|---|---|---|---|
| Screen push | navigate | new page slides in from right, old drifts left 25% and dims to 55% | 430 ms | `IosEase` cubic-bezier(0.32, 0.72, 0, 1) |
| Screen pop | back | reverse | 430 ms in / 380 ms out | IosEase |
| Tab change | tab tap | cross-fade + scale 0.985 to 1 | 240 ms (+60 delay) | IosEase |
| Mini player | song loaded | slide up half its height, fade, spring scale from 0.9 | 450 ms, spring damping 0.7 / stiffness 300 | |
| Full player | open / close | slide up from bottom + fade / reverse | 480 / 340 ms | IosEase |
| Bottom inset | player appears | animates 82 to 138 | 380 ms | IosEase |
| Mini title | song change | fade + slide up a third | 260 ms | IosEase |
| Artwork | play / pause | scale 1 / 0.86 | spring 0.7 / 300 | |
| Seek knob | drag | 10 to 18, bar 4 to 8 | spring 0.6 / 500 | |
| Skip swipe | drag artwork | follows finger, rotation = dx / 60, springs back | spring 0.7 / 380 | |
Gestures: swipe from the left 22 dp edge = back; pull down on the player = close; swipe artwork left / right = next / previous; long press a row = menu.

## Content and Edge Cases
- Titles one line with ellipsis (row title, tile title, feature title two lines); tile subtitles two lines; detail title two lines.
- Long artist lists are joined with ", " and cut at one line.
- Empty library, empty queue ("Queue is empty"), no network (error box + retry), nothing playing ("Nothing playing" in the player).
- Mixes: a 5th mix leaves an empty cell in the last row.
- Signed out: Home falls back to the open YouTube Music feed.
- Dark mode: all tokens above; pastel tiles darken; feature card lifts to #28282B.
- Large system font scale is not locked: rows and tiles grow in height; the tab bar labels do not wrap (one line, caption).

## Accessibility
- Every icon-only control sets a label (`a11y` / `iconLabel`); tabs expose `selected` and Role.Tab; pressables expose Role.Button.
- Contrast: ink on bg, grey on bg and onSignal on signal are all at least 4.5:1 (checked in `Theme.kt`).
- Touch targets at least 44 (`minTouch`); toggle chips are 36 x 28 visually but padded to 44.
- Focus order is top to bottom, left to right; the player's close area is the first element.
- Back: system back closes in order: track menu, devices sheet, player, then pops the stack.

## Not specified in code (decide in design)
- Skeleton shimmer colours and speed, glass blur radius and tint on the mini player, exact press scale, icon set names beyond `Ph` / Material rounded (icons are Phosphor-style glyphs in `PhIcons.kt` plus Material rounded).
- Landscape layouts for detail pages and the player.
