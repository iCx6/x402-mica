# Claude Code prompt — x402-mica „Official Journal" redesign

**Használat:** másold be a repo-dat a `design_handoff_x402_mica_1c/` mappával együtt (vagy tedd a mappát a repo gyökerébe), indítsd el a Claude Code-ot a repo gyökeréből, és illeszd be az alábbi promptot a `---` vonal alatt.

---

Redesign the x402-mica landing page to the **"Official Journal"** design direction.

## Source of truth

The file `design_handoff_x402_mica_1c/x402-mica-landing-1c-reference.html` in this repo is a **complete, working reference implementation** of the target design (single static HTML file, no build step). Open it in a browser first to see the intended result, then read its source.

- If this site is a single static HTML landing page (e.g. `x402-mica-landing.html` / `index.html`): adopt the reference implementation, preserving anything site-specific listed under "Must keep". Verify against the checklist below.
- If the landing page lives in a framework (React/Next/Astro/etc.): recreate the reference 1:1 using that codebase's conventions and component patterns. Match it pixel-perfectly — it is a hi-fi design, not a wireframe.

## Must keep (content is final — do not rewrite copy)

- All existing copy, headlines, code samples, and links (GitHub, npm, Issues, demo URL) exactly as in the reference.
- `<title>` and `<meta name="description">`.
- The `<!-- TODO: verify demo URL before publishing -->` comment near the demo CTA.
- Accessibility: `:focus-visible` outlines, `aria-label` on the receipt, `aria-hidden` on decorative star elements, `prefers-reduced-motion` fallback (all lines visible, no animation).

## Design summary

Concept: EU "Official Journal" aesthetic — cream paper document + deep-EU-navy hero band + gold accents. Serif display type. The hero's signature element is an **audit receipt card** (replacing the old terminal window): the 402→200 exchange condensed to two lines, then the audit-record fields revealed line by line, finished with a rotated "MiCA ★ RECORD / ✓ COMPLETE" stamp that scales in.

### Design tokens

Colors:
- `--paper: #FAF7EF` page background (warm cream)
- `--panel: #FFFDF6` cards, receipt, table
- `--ink: #14224C` primary text (deep navy)
- `--slate: #565F7E` secondary body text; `--muted: #5C6382` nav/labels; `--tan: #9B937B` de-emphasized
- `--line: #E4DEC9` hairlines; `--line-2: #D8D1BC` darker/dashed hairlines
- `--chip: #F1EBDB` inline-code chip background
- `--gold: #B78A2E` (kickers, rules, Copy button, top bar); `--gold-bright: #E5B84F` (gold on navy); hover `#A07924`
- Hero band gradient: `#10225C → #0B1740` (top→bottom); code blocks: `#0E1D52`
- Semantic: request lines + stamp `#16357F`; 402 `#A87A1F`; 200/compliant `#1E7B4F`
- Code syntax on navy: base `#CDD7F2`, keywords `#93AEF5`, strings `#E5B84F`, comments `#6A7BAF`, function names `#55C795`
- On-navy text: lede `#B9C2E0`, meta/dim `#8E9AC4`

Typography (Google Fonts):
- Display: **Newsreader** 500/600 (+ italics) — h1 54px/1.1 (clamp 2.3rem–3.375rem), h2 34px, h3 21px, § kickers 19px italic
- Body: **Public Sans** 400–700 — 16px/1.65 base
- Mono: **IBM Plex Mono** 400–600 — code 12.5–13px, labels 11–12px with `.14em` letter-spacing, uppercase

Other: content max-width 1060px, side padding 40px; section padding 76px; border-radius 4–8px (paper-like, small); gold rule 56×2px under h2.

### Page structure (top → bottom)

1. **Gold top bar** — 4px solid `--gold`, full width.
2. **Nav** — 64px, cream, hairline bottom. Mono wordmark ("402" in gold). Links: Quickstart, Live demo, Networks (muted), GitHub (ink), npm as 1.5px-outlined button (hover: fills ink, text cream).
3. **Hero band** (navy gradient, centered, cream text):
   - Circle of 12 gold ★ (150px ring, stars stay upright — counter-rotated), "402" in mono at center. Decorative, `aria-hidden`.
   - Mono uppercase gold-bright eyebrow: `x402 · MiCA · Base · USDC / EURC`
   - Serif h1, "audit trail" italic gold-bright.
   - Lede (max 62ch), install bar (cream field + gold Copy button, clipboard copy with "Copied" feedback), small meta line.
   - **Receipt card**: 620px, panel bg, 1px `--line` border, radius 4, large soft shadow; overlaps the band bottom by ~96px (`margin-bottom: -96px`). Header row "AUDIT RECORD — audit.db" (mono, letterspaced) + "↺ replay" ghost button, dashed hairline. Body: two exchange lines, dashed cut line, then 7 key/value rows (grid `130px 1fr`; keys in tan). Stamp bottom-right: 2px `#16357F` border, rotated −7°, semi-opaque panel bg.
   - Animation: on load and on replay, `.r-line` elements fade/slide in staggered (~380ms apart, 300ms ease each); the stamp is last, scaling from 1.6/−16° to 1/−7° with a springy cubic-bezier `(.2,1.6,.4,1)`.
4. **§ 1 — Compliance** (first section, `padding-top: 150px` to clear the receipt): italic serif gold kicker, serif h2, gold rule, lede; 3 pillar columns (gap 40) each with top hairline, mono roman-numeral label (I. custody / II. audit / III. assets), serif h3, 14.5px slate body.
5. **§ 2 — Integration**: Exhibit A (Express, full width), then Exhibit B (MCP) + Exhibit C (Audit dashboard) in a 2-col grid (gap 32). Each: mono uppercase gold "Exhibit X — …" label + navy code block (radius 6, padding 22/24). Code note paragraph after.
6. **Demo notice**: card with 1.5px gold border on panel bg, radius 8, padding 38/42; "Notice — live demo" label, serif h2, copy, and a navy filled CTA "Open the demo →" (radius 6).
7. **§ 3 — Networks**: same header pattern; ledger table on panel bg — header row mono uppercase with **2px ink bottom border**, rows with `--line` hairlines, inline-code chips on `--chip`.
8. **Footer**: hairline top, centered; tiny gold 12-star row, links row (npm / GitHub / Issues in ink), credit line with gold link.

### Interactions

- Copy button → `navigator.clipboard.writeText('npm install x402-mica')`, label swaps to "Copied" for 1.6s.
- Replay button → re-runs the receipt reveal (remove shown state, force reflow, re-stagger).
- Hovers: npm outline button fills ink; Copy button darkens to `#A07924`; replay border turns gold; demo CTA darkens to `#0E1D52`; nav links darken to ink.
- `prefers-reduced-motion: reduce` → all receipt lines and stamp fully visible, no transitions.

### Responsive (≤900px)

Side padding 20px; pillars and exhibit grid collapse to 1 column; demo notice stacks vertically; nav shows only GitHub + npm; hero band padding 56px/20px; first section padding-top 130px. Receipt is `max-width: 100%`.

## Acceptance checklist

- [ ] Page renders with no console errors; fonts load (Newsreader, Public Sans, IBM Plex Mono).
- [ ] Gold 4px top bar; navy hero band with upright 12-star ring; receipt overlaps into the cream section below.
- [ ] Receipt animation plays on load, replay button restarts it, stamp lands last with spring.
- [ ] Copy button copies the install command and shows "Copied".
- [ ] All copy, links, meta tags, and the demo-URL TODO comment are unchanged from the reference.
- [ ] Layout holds at 1440px, 1024px, and 375px widths.
- [ ] Reduced-motion mode shows everything statically.
