# INFAIX Core — visual review and redesign direction

**Scope:** frontend presentation only. Reviewed in a local browser at 1440×900 and
390×844 against `next dev`, plus source review of `globals.css`, the ambient
renderer, homepage, ecosystem map, launcher, subpages and the Operations Console.
No backend, data or architectural proposals are included.

**Status:** review only. Nothing was changed.

---

## 1. Summary judgement

INFAIX currently has one genuinely distinctive asset — the cosmic environment and
the insignia inside it — and then spends 7,000 pixels of vertical scroll
undermining it. The hero is close to right. Everything below the fold drifts toward
a recognisable category: dark-purple AI SaaS, Space Grotesk over Inter, one-hue
gradient, `01 /` numbered sections, list-with-icon-and-arrow rows.

The core problem is not styling. It is **repetition of a layout**. Six homepage
sections use the same two-column "short intro left, ruled list right" composition
at three different ratios, so the page has rhythm but no shape. The second problem
is that the palette the logo actually contains is almost entirely unused; the site
is built from two purple values while the mark is built from a pale, cold,
luminous crystal.

Concretely: the page is 8,208px tall on an 844px viewport — roughly ten viewports
for six sections. The ecosystem section alone is 1,656px. The hero is 1,005px,
which pushes its tagline, description, CTAs and registry index below the fold at
common laptop heights.

---

## 2. What is visually distinctive and must never be lost

### 2.1 The animated cosmic environment
`ambient-background.tsx` is the strongest thing on the site and the single best
argument for the brand. It is well engineered: one canvas, one rAF loop, capped
DPR, node budget scaled by viewport area, pause on hidden tab, static single frame
under reduced motion, and depth-weighted scroll and pointer parallax. The layered
construction — deep radial space, a 64px perspective grid with a radial mask, a
drifting node network with proximity links, three slowly rotating wireframe
solids, purple energy glows, vignette — is genuinely authored, not stock.

Keep the renderer, its restraint and its performance discipline exactly as they
are. It is the product's atmosphere and it is doing the work a stock
"dark SaaS gradient" would be doing on every competitor site.

The specific qualities to protect: opacity stays in the low range (nothing in the
canvas competes with text); motion is on the order of tens of seconds; the grid is
masked to the top of the viewport rather than tiled edge to edge; the polyhedra
sit at the margins and never cross the centre column.

### 2.2 The insignia composition
`HeroStructure` — a five-sided polyhedron with a ghosted inner offset copy, dashed
spokes converging on a central point, a radial core glow, and the crystal at the
centre with two counter-rotating technical rings and a breathing glow — is the
best single idea in the codebase. It reframes the logo as the centre of a structure
rather than a logo dropped on a page.

Preserve: the spoke convergence, the double-outline geometry, the dashed/dotted
line weights, the two ring radii with their different dash treatments, and the
deliberate asymmetry where alternating nodes are lit purple and larger.

### 2.3 The logo treatment as an engineering object
The `screen` blend plus the `#infaix-black-point` SVG filter to zero out the
asset's baked-in black rectangle is a careful, correct solution to a real problem,
and the comment explaining why no ancestor may create a stacking context is the
kind of note that keeps it working. The variant sizing table enforces the native
202:505 ratio everywhere. Keep all of this.

### 2.4 The node-and-trunk vocabulary
One small idea — a rotated square node on a line, filled purple when live, hollow
when planned, with a dashed segment for "not yet available" — is already applied
across the ecosystem, the launcher directory, the project lifecycle rail and the
console's event list. That reuse is the most INFAIX thing about the interface
design. It should be promoted from a repeated detail to a stated system primitive.

### 2.5 The honesty posture of the Operations Console
Reporting "Metric unavailable", "Health unknown", "Lifecycle is configured intent.
Runtime health has not been measured" and refusing to infer availability from a
configured URL is a real differentiator and is correct. It must survive the
redesign. A console that says "no data" instead of "0" is doing something no
generic dashboard does.

---

## 3. What is generic or underdeveloped

### 3.1 The palette throws away the brand's own colour
The site uses two purples: `#9146ff` and `#b36bff`, on `#08070c`. The logo is not
that colour. The mark is a pale, cold, near-white lilac crystal with lavender and
periwinkle facet shading and a saturated magenta-violet core, sitting on a hard
black. The site's palette could be mistaken for any dark AI product.

The fix is not a new hue. It is to sample the asset and admit the values already in
it: a cold crystal light for primary marks and headline highlights, a periwinkle
mid for structure and diagram strokes, and the existing magenta-violet reserved for
energy — live states, the core glow, the focal point only. That gives three
distinct values instead of two, and it ties every surface back to the mark.

Success green `#7ee2b0` is currently the only non-purple accent and it reads as
borrowed. It should stay functional, but the "live" signal should be carried by the
crystal light and the lit node, with green reserved for confirmed health in the
console.

### 3.2 Typography is the category default
Space Grotesk over Inter is, at this moment, the most widely used pairing in dark
AI product design. It is competent and it is invisible as a brand signal.

What is worth keeping is the *treatment* rather than the families: the extreme
uppercase tracking (0.1em–0.28em) on navigation, section labels and small caps, and
the tabular numerics in the console. That instrumentation-label quality is more
distinctive than the typeface choice. Section labels in `01 / CONNECTED BY CORE`
form, with a tracked label, a slash and a tracked descriptor, are a good INFAIX
convention and should be extended rather than replaced.

One display face with a real personality — something with more industrial or
monospaced-technical character than Grotesk — used only for the wordmark, section
numbers and the largest headings, would move recognisability further than any
gradient change.

### 3.3 Six sections, one layout
`caps-layout` (0.85fr / 1.35fr), `forge-layout` (0.9fr / 1.1fr) and
`projects-layout` (0.8fr / 1.2fr) are the same composition at three ratios. Each
pair is a short heading, one paragraph, one quiet CTA on the left; a ruled list on
the right. The result is that scrolling produces a sensation of repetition rather
than progression, and each section leaves large dead columns — the capabilities
section reserves roughly 500px of empty space below its CTA.

The ecosystem section is the one place with a genuinely original structure (hub
between two arms) and it is the strongest content on the page. It should be the
model, not the exception.

### 3.4 The "map" is not a map
`.eco-field-lines`, `.eco-ellipse`, `.eco-ellipse.is-inner` and the
`line.is-closed` rules are all defined in `globals.css` and none of them is
rendered. `ecosystem-map.tsx` produces no SVG. What ships is a hub card flanked by
two lists, with the CSS grid gaps standing in for connection geometry.

This is the highest-value single fix on the site. The concept — Core at the centre
of a field, live applications on a solid arm, planned applications on a dashed arm
— is already designed in the stylesheet and simply never built. Restoring the
connecting lines and the orbit ellipses would immediately make the section read as
an instrument diagram rather than a list.

Two related defects in the same component: `.eco-node` and `.eco-glyph` are both
assigned `grid-column: 1; grid-row: 1 / span 6`, so they overlap and the rendered
result shows a purple diamond and a smaller icon stacked in the same cell. And
`.eco-state` is a grid item stretched by default `justify-self`, so every "LIVE" and
"PLANNED" pill expands to the full column width — a 294px outlined bar containing
the word "LIVE". That is the most visually broken element in the ecosystem.

### 3.5 Unicode glyphs as iconography
Applications are identified by `◇ ◈ ⬡ ✧ ▤ ◎ ▱` and FORGE items by `▣ ⌁ ⬢ ▤ ◉ ☰`.
These are font-dependent, already degrading in the current render — `⌁` and `☰`
fall back to unrelated shapes — and they are the single most generic icon decision
in the codebase. They also carry no relationship to the mark's geometry.

Every icon should be drawn as SVG on the same 45°-rotated-square and rhombic
vocabulary as the node primitive, so that the ecosystem, the launcher, the
capability rows and the console strip all read as one instrument panel.

### 3.6 The launcher is a dropdown, not an instrument
The panel works — focus is moved inside on open, Escape restores the trigger,
focus is trapped, and the site destinations migrate into it on compact layouts.
Those behaviours are correct and should be preserved.

The presentation is not. It is a 420px dropdown with browser-default scrollbars on
both axes (measured 402px scrollWidth in a 401px clientWidth, producing a visible
horizontal scrollbar), a semi-transparent background that lets the hero wordmark
read through it on mobile, and no relationship to the mark. On mobile it becomes a
full-width sheet that ends in nothing — no bottom edge, no signature, just a
scroll cut.

The launcher is INFAIX's only recurring branded surface. It is also the surface a
returning user sees every single visit. It deserves to be the most designed object
in the interface: a proper console panel with the insignia, a proper status rail,
and scrollbars that read as part of the system rather than as browser defaults.

### 3.7 Motion is wallpaper, not choreography
Nine concurrent infinite animations run at all times: 22s breathe, 14s and 18s
glow pulses, 36s grid drift, 60s ring rotation, 32s structure drift, 9s logo float,
7s layer flow, 5s axis pulse, 3.5s dash flow. Plus canvas rotation and pointer
parallax.

Individually each is well judged. Collectively they direct attention nowhere —
nothing accelerates on approach, nothing settles on arrival, and the only
scroll-linked motion in the entire codebase is the 112px seam line. The hero's
staged entrance (0.1s → 0.85s delays) is the one moment that reads as authored.

Motion should be spent at moments of meaning: the insignia resolving on load, an
arm illuminating when a station is hovered or focused, the seam carrying the
section number, the console's live indicator breathing only while a snapshot is
being fetched.

### 3.8 Mobile is a compressed desktop, not a designed layout
At 390px the hero holds up well — the structure scales to 118vw, the rings and glow
reduce, the wordmark tracking tightens. That part is right.

Below that it degrades. The ecosystem's vertical rail puts nodes and glyphs at
different offsets so the connecting lines read as broken rather than intentional.
The launcher's site links form a 2×2 grid of bare tracked words with no visual
grouping. The capability and FORGE lists both break to a 2-column grid where the
description drops to a second row under the name, leaving the arrow labels orphaned
at the right of the previous row. No touch-specific treatment exists beyond min-height
corrections.

### 3.9 Operations Console is disciplined but anonymous
The console is the best-executed surface after the hero and the least branded.
It uses the right surfaces, correct chips, real unavailable states and tabular
numerics. But it drops the mark, the cosmic field and the node vocabulary
entirely. Ten nav items across three groups render as a plain admin sidebar with a
left border indicator.

Five of the ten sections resolve to an unavailable panel. That is honest and
correct, but as composition it means a visitor to half the console sees repeated
dashed grey boxes — accurate, and visually inert. The console should look like an
instrument panel built by the same people who built the insignia: same node
primitives for the application lifecycle strip, same crystal light for confirmed
values, same field geometry behind it, and a status band that reads as a live
instrument rather than a row of chips.

### 3.10 Smaller items worth naming
- **Nav logo is unreadable.** The crystal renders at 14×34px, where its internal
  facet structure collapses into a purple smudge. At that size the mark should
  either be simplified to a legible silhouette or the wordmark should carry the
  brand alone.
- **"EXPLORE FORGE" appears twice**, in adjacent sections, pointing at the same
  destination.
- **Dead CSS.** `.btn-primary`, `.nav-github`, `.nav-links a.active`,
  `.grid-bg`, `.cat-status`, `.ai-status-online/offline`, `.ops-grid > .ops-panel`
  and the entire `.eco-field-lines` block are defined but never rendered. A
  3,068-line stylesheet with substantial unused surface is itself a design smell.
- **Subpages are thin.** `/forge`, `/about` and `/ai` use a shared `page-hero`
  plus definition rows. They carry the header and the ambient field and nothing
  else — no frames, no seams, no field geometry. They read as placeholder routes
  waiting for content.
- **The footer is conventional.** Brand left, links right, rule, copyright. It is
  the last thing on the page and the only place the logo could act as a signature.

---

## 4. Redesign direction

**The concept: the insignia is a core, and the page is the instrument it powers.**

The current site describes INFAIX. The redesigned site should *operate* it. Every
section should feel like a readout from the same machine the hero depicts, with
the cosmic field as continuous context and the node-and-trunk grammar as the
through-line.

### 4.1 Composition — three distinct movements, not six repeated ones

Replace the uniform two-column pattern with three alternating structural modes, so
the scroll has shape:

1. **Full-bleed centre stage** — the hero and the philosophy close. Symmetrical,
   centred, no columns, nothing to the sides. Reserved for the two moments that
   should feel ceremonial.
2. **Asymmetric instrument layout** — a narrow left rail carrying the section
   index, label and a one-line descriptor, with the content field to its right. The
   ecosystem and capabilities sections use this. The rail gives the page a spine.
3. **Wide data band** — full container width, no side rail, for content that is
   genuinely tabular: the FORGE inventory, the project lifecycle, the console.

Cut total homepage height by roughly 35%. Every current section pays 112px of
vertical padding top and bottom plus a 56px heading margin; that should become
~72px with tighter heading spacing, and the philosophy section's 500px of trailing
void should be closed by the terrain mesh meeting the footer edge.

The hero should fit within one viewport at 1440×900. The 480px stage plus
tagline, description, CTAs and index currently totals 1,005px. Reduce the stage to
~400px, tighten the index margin, and the whole hero lands inside the fold with the
registry index visible — which is the point of it.

### 4.2 Palette — admit the crystal's own colours

Sample the logo asset and add the two values it already contains:

- a **crystal light** (pale, cold lilac-white) for the wordmark's focal treatment,
  primary CTA foregrounds, confirmed values in the console, and the lit node;
- a **periwinkle mid** for diagram strokes, ring geometry, grid lines and inactive
  structural elements — currently these are all `rgba(200,185,230,...)`, a
  compromise between the two purples rather than a real colour.

Keep `#9146ff` as the energy accent and `#b36bff` as the emphasis tone. Reduce
green to console-only health confirmation.

This is a five-token change and it is the highest ratio of recognisability to risk
of anything in this document.

### 4.3 Typography — keep the tracking, change the voice

Retain Space Grotesk and Inter for their existing roles; they are competent and
replacing them wholesale is not worth the regression risk. Instead:

- introduce **one display face** with industrial or technical character for the
  wordmark, section numbers and the largest headings only;
- formalise the **instrument label** style — uppercase, 0.18em–0.28em tracking,
  Space Grotesk, muted or highlight — and apply it to every label, chip, node
  caption and console header, replacing ad-hoc sizes;
- extend **tabular numerics** beyond the console to the hero registry index, the
  capability counts and the lifecycle rail.

### 4.4 Iconography — one drawn family

Replace every unicode glyph with SVG built on the mark's geometry: 45°-rotated
squares for nodes, rhombic forms for identity, thin double-stroke facets for
structure. Apply the same family to the ecosystem stations, the launcher, the
capability rows, the FORGE inventory, the console application strip and the
registry.

### 4.5 Ecosystem — build the map that is already specified

Restore the connecting geometry: orbit ellipses around the hub, solid spokes to
live stations, dashed spokes to planned ones. Then fix the two defects — offset
`.eco-node` and `.eco-glyph` into distinct positions on the rail, and constrain
`.eco-state` with `justify-self: start`.

Then make it interactive: hovering or focusing any station illuminates its spoke
and node and dims the others slightly, so the field responds as a system. The
existing `:has()` rule already gestures at this.

### 4.6 Navigation and launcher — the console panel

Replace the 420px dropdown with a proper console panel: 560–640px, the insignia
watermarked at low opacity in a corner, a status rail along the top showing Core
state, applications grouped by arm with the trunk grammar carried over, and custom
scrollbars that read as part of the instrument.

On mobile, keep the full-width sheet but give it a real bottom edge, a signature
row, and an opaque-enough ground that the page behind stops reading through it.
Move the bare 2×2 site links into a labelled group with a divider so they read as
navigation rather than as four floating words.

### 4.7 Motion — spend it at moments of meaning

Keep the ambient field exactly as it is — it is the atmosphere and it should stay
constant and unfussy. Add or sharpen motion at five specific points:

1. the insignia resolving out of the field on load (the existing staged entrance,
   refined);
2. an ecosystem arm illuminating on station hover or focus;
3. the seam drawing its axis and delivering the section number as it enters view
   (already present, extend to the label);
4. the console's live indicator breathing only during a fetch;
5. the hero's structure slowly resolving its spokes on first view.

Reduce continuous loops where they add nothing — the 22s breathe and the two
independent glow pulses can collapse into one field rhythm.

### 4.8 Operations Console — same system, honest data

Bring the console into the family: node glyphs on the application lifecycle strip,
crystal light on confirmed numeric values, the field geometry behind the header,
and a status band that reads as an instrument. Group the ten nav items with node
markers. Keep every unavailable state and its wording exactly as it is — that
discipline is a brand asset, not a limitation.

### 4.9 What to remove

- The repeated two-column layout — replaced by the three structural modes above.
- All unicode glyphs — replaced by drawn SVG.
- Dead CSS: `.btn-primary`, `.nav-github`, `.grid-bg`, `.cat-status`,
  `.ai-status-online/offline`, and the unused states.
- The duplicate "EXPLORE FORGE" CTA.
- The 14px nav logo, or its rendering at that size — one or the other.
- The generic footer — replace with a signature treatment that uses the mark at a
  size where it is legible, closing the page on the same image that opened it.

---

## 5. Priority order

| Rank | Change | Reason |
|---|---|---|
| 1 | Palette: add crystal light and periwinkle from the logo | Highest recognisability per unit of risk |
| 2 | Build the ecosystem map geometry; fix node/glyph overlap and stretched pills | The concept already exists in CSS and is not rendered; the section is the strongest content |
| 3 | Vary homepage composition; cut height ~35%; fit the hero to one viewport | The page currently reads as one layout repeated |
| 4 | Replace unicode glyphs with a drawn SVG family | Removes the most generic element and unifies the system |
| 5 | Replace the launcher dropdown with a console panel | Highest-frequency branded surface, currently the weakest |
| 6 | Instrument typography system; display face for wordmark and section numbers | Makes the label grammar consistent and adds voice |
| 7 | Bring the Operations Console into the family; keep unavailable states verbatim | Currently anonymous; its honesty must survive |
| 8 | Mobile-specific layout work for ecosystem, launcher and lists | Currently compressed desktop |
| 9 | Purge dead CSS | Hygiene, and it shrinks the file that everything else lives in |
| 10 | Signature footer | Closes the page on the mark |

---

## 6. What this review does not claim

This is a visual and experiential assessment from source and browser review. It is
not an accessibility certification, a performance benchmark, or a claim about
rendering on platforms other than the one reviewed. No files were modified in
producing it.