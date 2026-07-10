# Handoff: x402-mica Landing — "Official Journal" redesign (option 1c)

## Overview
Visual redesign of the x402-mica landing page (EU-facing x402 payment middleware with MiCA audit trails). Direction "1c — Official Journal": EU-institutional aesthetic — cream paper, deep EU-navy hero band, gold accents, serif display type, and an animated **audit-receipt card** as the hero's signature element (replacing the previous terminal window). All copy and content are unchanged from the original page; only the design changed.

## About the Design Files
The files in this bundle are **design references created in HTML** — they show the intended look and behavior; they are not necessarily production code to copy blindly. The task is to **recreate this design in the target codebase's environment** using its established patterns. That said, the original site is itself a single static HTML file, so `x402-mica-landing-1c-reference.html` is written to production quality (semantic markup, responsive, reduced-motion support) and may be adopted directly if the site remains a static single file.

## Fidelity
**High-fidelity (hifi).** Colors, typography, spacing, and interactions are final. Recreate pixel-perfectly.

## Files
- `PROMPT.md` — ready-to-paste Claude Code prompt containing the full spec and acceptance checklist. **Start here.**
- `x402-mica-landing-1c-reference.html` — complete working reference implementation (open in any browser; no build step).

## Screens / Views
One page (landing), sections top to bottom:

1. **Gold top bar** — 4px, `#B78A2E`, full width.
2. **Nav** — 64px tall, cream `#FAF7EF`, 1px `#E4DEC9` bottom hairline. IBM Plex Mono wordmark "402-mica" ("402" in gold). Right: Quickstart / Live demo / Networks (`#5C6382`, 13.5px, 600), GitHub (`#14224C`), npm as outlined button (1.5px `#14224C` border, radius 6; hover fills navy with cream text).
3. **Hero band** — `linear-gradient(180deg, #10225C, #0B1740)`, centered, text `#F5F1E4`, padding 72px 48px 0.
   - Decorative ring of 12 gold stars (150px, stars upright via counter-rotation), mono "402" centered inside.
   - Eyebrow: IBM Plex Mono 12px uppercase, letter-spacing .14em, `#E5B84F`: "x402 · MiCA · Base · USDC / EURC".
   - H1: Newsreader 600, clamp(2.3rem, 4.6vw, 3.375rem), line-height 1.1, max-width 850px; "audit trail" italic `#E5B84F`.
   - Lede: 16.5px `#B9C2E0`, max 62ch.
   - Install bar: cream `#FBF8F1` field with mono command + gold `#B78A2E` "Copy" button (hover `#A07924`); soft shadow.
   - Meta line: 13px `#8E9AC4`.
   - **Receipt card** (signature): 620px, `#FFFDF6`, 1px `#E4DEC9` border, radius 4, shadow `0 24px 48px -20px rgba(8,15,40,.45)`, `margin-bottom: -96px` so it overlaps the next section. Header: "AUDIT RECORD — audit.db" (mono 11px, .14em) + "↺ replay" ghost button; dashed `#D8D1BC` separators. Body (mono 12.5px/1.85): 2 exchange lines (request `#16357F`, "402" `#A87A1F`, "200 OK" `#1E7B4F`), dashed cut, 7 key/value rows (grid 130px/1fr, keys `#9B937B`). Stamp bottom-right: 2px solid `#16357F`, radius 6, rotated −7°, text "MiCA ★ RECORD / ✓ COMPLETE", background rgba(255,253,246,.85).
4. **§ 1 — Compliance** — first section clears the overlap (padding-top 150px). Pattern for all section headers: italic Newsreader 19px gold kicker ("§ n — …"), Newsreader 600 34px h2, 56×2px gold rule, slate lede (max 62ch). Three pillar columns (grid, gap 40): top hairline `#D8D1BC`, mono uppercase gold roman label (I. custody / II. audit / III. assets), Newsreader 600 21px h3, 14.5px `#565F7E` body. Inline code chips: mono 12px on `#F1EBDB`, radius 3.
5. **§ 2 — Integration** — "Exhibit A — Express middleware" full-width code block, then "Exhibit B — MCP tool decorator" and "Exhibit C — Audit dashboard" in a 2-column grid (gap 32). Code blocks: `#0E1D52`, radius 6, padding 22px 24px; mono 12.5–13px/1.75; syntax: base `#CDD7F2`, keywords `#93AEF5`, strings `#E5B84F`, comments `#6A7BAF`, functions `#55C795`. Closing note paragraph 14px slate.
6. **Demo notice** — card: 1.5px `#B78A2E` border on `#FFFDF6`, radius 8, padding 38px 42px, flex row space-between. Label "Notice — live demo" (mono gold), Newsreader 28px h2, slate copy; CTA "Open the demo →" navy `#14224C` fill, cream text, radius 6, hover `#0E1D52`. Keep the `TODO: verify demo URL` HTML comment.
7. **§ 3 — Networks** — ledger table on `#FFFDF6` with 1px `#E4DEC9` outer border: header cells mono 11px uppercase `#5C6382` with **2px `#14224C` bottom border**; body rows 14px padding, `#E4DEC9` row hairlines; code chips as above.
8. **Footer** — hairline top, centered, 13.5px `#5C6382`: tiny gold 12-star row (10px, letter-spacing 7px), links row (npm / GitHub / Issues, `#14224C`), credit line with gold author link.

## Interactions & Behavior
- **Receipt reveal**: on `load` and on "↺ replay": each `.r-line` fades in and slides up 4px (opacity/transform transition 300ms ease), staggered 380ms apart starting at ~320ms. The stamp is the final line: scales from 1.6 & −16° to 1 & −7° over 350ms with `cubic-bezier(.2, 1.6, .4, 1)` (springy overshoot).
- **Copy button**: writes `npm install x402-mica` to clipboard; label becomes "Copied" for 1.6s.
- **Hovers**: nav links → ink; npm outline button → filled navy; Copy → `#A07924`; replay → gold border; demo CTA → `#0E1D52`.
- **Reduced motion**: `prefers-reduced-motion: reduce` disables transitions; all lines and the stamp render visible (stamp still rotated −7°).
- Smooth-scroll anchors from nav to #quickstart / #demo / #networks.

## State Management
Static page. Only transient DOM state: receipt line visibility (CSS class toggled by JS with timers) and the temporary "Copied" button label. No data fetching.

## Design Tokens
See `:root` in the reference file (colors listed above). Spacing: 1060px content width, 40px side padding (20px mobile), 76px section padding, 150px first-section top padding, gaps 32/40px. Radii: 3 (chips), 4 (receipt), 6 (code/buttons), 8 (notice card). Type scale: 11/12/12.5/13/13.5/14.5/15/16/16.5/19/21/28/34/54px.

## Responsive (≤900px)
Pillars → 1 column; exhibit grid → 1 column; notice card stacks; nav shows only GitHub + npm; hero padding 56px/20px; first section padding-top 130px; receipt max-width 100%.

## Assets
No images. Fonts from Google Fonts: **Newsreader** (500/600 + italics), **Public Sans** (400–700), **IBM Plex Mono** (400–600). Stars are the ★ unicode glyph (decorative, `aria-hidden`).
