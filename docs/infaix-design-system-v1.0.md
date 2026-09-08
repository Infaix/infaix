# INFAIX Design System

## Version 1.0 · Design specification

**Date:** 8 September 2026  
**Scope:** infaix.com, FORGE, CHAT, ATLAS, SHOP, and future INFAIX mobile, desktop and internal products.  
**Authority:** the shared visual and behavioural contract for future product work.  
**Delivery:** specification only. This document does not implement components, change existing products or certify their accessibility.

INFAIX interfaces should feel like precision instruments: understandable before use, dependable during use and legible after an operation completes. Craft is expressed through alignment, proportion, useful feedback and predictable behaviour. Decoration never substitutes for information.

### How to use this document

“Must” identifies a requirement. “Should” identifies the default, with documented exceptions permitted. “May” identifies an optional capability. All unqualified token values and component defaults are normative for new work.

Existing brand colours, fonts, artwork and ambient geometry are preserved. New numeric specifications in this document standardise previously undefined decisions; they are not claims about what every existing screen already implements. Existing visual inconsistencies are migration work, not precedents to copy.

Use the foundations first, then the component contract, then the product profile. A product profile may select density, composition and information emphasis. It may not override colour meaning, keyboard behaviour, focus treatment or state semantics.

### Contents

1. Brand and visual principles
2. Token architecture
3. Colour and contrast
4. Typography
5. Spacing, grids and responsive layout
6. Surfaces, borders, elevation and layers
7. Motion and transitions
8. Shared interaction contract
9. Component specifications
10. Loading, empty, error and success states
11. Icons, illustrations and product imagery
12. Charts and data presentation
13. Product expression and layout families
14. Accessibility and acceptance
15. Documentation, governance and adoption

## 1. Brand and visual principles

### 1.1 Brand philosophy

INFAIX builds and understands systems across software, hardware and infrastructure. The interface must communicate that work clearly. The established dark environment, Space Grotesk headings, Inter text, purple emphasis and geometric imagery are the common identity. Product personality comes from the work being performed, not a new theme.

The existing messaging remains authoritative. This specification is not permission to rewrite taglines, rename services or announce product capabilities. FORGE, CHAT, ATLAS and SHOP are product identities; the profiles below prescribe presentation rather than release status.

### 1.2 Principles with operational consequences

| Principle | Required design consequence | Reject |
|---|---|---|
| Precision | Align edges, baselines, numeric columns and repeated control dimensions | Almost-aligned panels and arbitrary local spacing |
| Engineering | Expose state, scope, units, dependencies and consequences where relevant | Decorative diagnostics, invented telemetry and fake progress |
| Confidence | One clear next action; explain limits and failures directly | Competing primary actions and exaggerated assurances |
| Quiet intelligence | Suggest useful actions without taking over the workflow | Constant prompting, animated assistants and unsolicited motion |
| Craftsmanship | Design loading, long content, keyboard use and recovery alongside the ideal state | Polished empty demos with fragile real-data layouts |
| Longevity | Prefer stable spatial relationships and familiar platform behaviour | Trend-led effects, novelty gestures and seasonal visual themes |

### 1.3 Brand invariants

- Use the official logo asset. Do not redraw, recolour, crop, stretch, trace or replace it with a glyph.
- Preserve its native aspect ratio. The current repository asset is a tall 202 × 505 mark. Match rendered width to height by this ratio, allowing pixel rounding.
- Minimum standalone mark height: 24 logical units. Default navigation/footer height: 34. Minimum surrounding clear space: one quarter of rendered mark height on every side, including the gap to a wordmark.
- Use the existing INFAIX wordmark treatment rather than inventing a lockup. Product names are adjacent text, not new illustrated logos.
- Use the original dark presentation for branded surfaces. System high-contrast modes are an accessibility adaptation, not a competing brand theme.
- The current ambient treatment is a brand asset: retain its slow geometry and restraint. Do not spread it into every functional panel.
- No new gradients, neon outlines, lens effects, celebratory confetti, decorative scan lines, heavy blur or pervasive glass surfaces.
- If artwork cannot load, preserve its reserved dimensions and show the accessible brand name. A loading failure must not produce a new symbol presented as the logo.

## 2. Token architecture

### 2.1 Three layers

| Layer | Naming pattern | Example | Who consumes it |
|---|---|---|---|
| Reference | `ref.category.name` | `ref.color.purple` | Semantic definitions only |
| Semantic | `color.role.state`, `space.name`, `motion.name` | `color.action.primary.background` | Shared components and layout primitives |
| Component | `component.part.property.state` | `button.primary.background.hover` | A component when a semantic alias alone cannot express its contract |

These are specification names, not implementation code. Platform packages must preserve their meaning when translating to web, iOS, Android or desktop resources. Colours use sRGB; sizes use logical units, equivalent to CSS pixels at the default web scale. Typography must scale with user settings. No raw device-pixel measurements are permitted in layout contracts.

Each token record must include name, value or alias, type, purpose, allowed surfaces, source, version and deprecation status. Alias chains must resolve without cycles. Component tokens must reference semantic tokens; product-specific literal colours are prohibited.

### 2.2 Ownership and fallback

One published version supplies every product. Do not maintain independent copies of shared palettes. Pin a version and record migrations. Missing semantic tokens must be proposed to the shared system, not silently replaced with a local value. Until a proposal is resolved, compose existing components and roles without introducing a new visual primitive.

The dark token set is the v1.0 default. Native platform fallbacks must retain readable text and controls if a custom font or asset fails. A future light theme requires a separately reviewed semantic mapping; it must not be generated by simply inverting colours.

## 3. Colour and contrast

### 3.1 Preserved reference palette

| Reference token | Value | Provenance and role |
|---|---|---|
| `ref.color.void` | #08070C | Existing page background |
| `ref.color.surface` | #111019 | Existing panel background |
| `ref.color.surface2` | #191721 | Existing raised/hover surface |
| `ref.color.border` | #302A3D | Existing decorative dividers |
| `ref.color.purple` | #9146FF | Existing brand/action colour |
| `ref.color.highlight` | #B36BFF | Existing emphasis and focus colour |
| `ref.color.text` | #F0EDF5 | Existing primary text |
| `ref.color.muted` | #9B96A5 | Existing secondary text |
| `ref.color.white` | #FFFFFF | Existing solid-button foreground |
| `ref.color.success` | #7EE2B0 | Existing live/success treatment |
| `ref.color.error` | #E09999 | Existing authentication error text |
| `ref.color.purple-hover-legacy` | #9F5BFF | Existing hover colour; restricted by contrast |

Success and error are functional colours already present in the product, not new brand accents. Do not create an amber warning palette or additional chart rainbow. Warning and informational states use the mappings below with explicit icons and labels.

### 3.2 Semantic colour assignments

| Semantic token | Reference or exact composition | Use |
|---|---|---|
| `color.background.canvas` | void | Page/workspace ground |
| `color.background.panel` | surface | Cards, sidebar, forms |
| `color.background.raised` | surface2 | Popovers, dialogs, hovered rows |
| `color.text.primary` | text | Titles, body, values |
| `color.text.secondary` | muted | Supporting text, metadata, placeholders |
| `color.text.link` | highlight | Inline links; underline in prose |
| `color.text.on-action` | white | Solid purple button labels |
| `color.border.subtle` | border | Nonessential separation only |
| `color.border.control` | muted | Input/control boundary when needed for recognition |
| `color.border.selected` | highlight | Persistent selected state |
| `color.focus.ring` | highlight | Keyboard focus |
| `color.action.primary.background` | purple | Highest-priority operation |
| `color.action.primary.foreground` | white | Normal-size action text |
| `color.action.secondary.background` | surface | Secondary operation |
| `color.action.secondary.foreground` | text | Secondary label |
| `color.action.quiet.foreground` | muted; highlight on hover | Low-priority operation |
| `color.state.selected.background` | purple at 8% over surface | Selected row/tab field; not its sole cue |
| `color.state.success.foreground` | success | Successful/completed state |
| `color.state.error.foreground` | error | Failure/destructive action |
| `color.state.warning.foreground` | text | Caution with warning icon and label |
| `color.state.info.foreground` | muted | Neutral explanation |
| `color.state.disabled.foreground` | muted | Unavailable control; no whole-control fading |
| `color.state.disabled.background` | surface | Disabled control |
| `color.overlay.scrim` | void at 72% | Modal backdrop without blur |
| `color.selection.background` | purple | Text selection |
| `color.selection.foreground` | white | Selected text |

A focused selected row keeps both its selection cue and focus ring. Error does not replace focus. Colour is never the sole distinction between online/offline, selected/unselected, warning/success or enabled/disabled.

### 3.3 Contrast decisions

The following ratios were calculated from the repository sRGB values on opaque backgrounds, rounded to two decimals. Alpha layers, images and animated backgrounds require separate rendered verification.

| Foreground / background | Ratio | Decision |
|---|---:|---|
| text / void | 17.34:1 | Primary text approved |
| muted / surface2 | 6.16:1 | Secondary text approved |
| highlight / surface2 | 5.45:1 | Links and emphasis approved |
| white / purple | 4.64:1 | Solid-button text approved; keep fully opaque |
| text / purple | 4.01:1 | Do not use for normal-size button labels |
| white / purple-hover-legacy | 3.88:1 | Do not use for normal-size button labels |
| border / surface | 1.37:1 | Decorative divider only |
| muted / surface | 6.56:1 | Recognisable control boundary |
| success / surface2 | 11.29:1 | Functional status text approved |
| error / surface2 | 7.75:1 | Functional error text approved |

Solid primary buttons therefore retain purple on hover; use a highlight border and existing subtle positional feedback rather than lightening their background. This preserves the palette while correcting an inherited usage problem. No text opacity may reduce an approved pair below the accessibility floor.

## 4. Typography

### 4.1 Families and roles

`type.family.display` is Space Grotesk. `type.family.body` is Inter. Retain the existing font files/loading strategy where available; do not add another display or UI family. Display type communicates identity and structure; body type supports sustained work.

Code and terminal content use `type.family.code`: the platform's native fixed-width font, with a generic monospace fallback. This is a content accommodation, not an additional brand font. Use Inter with tabular numerals for ordinary measurements and tables; do not turn technical products into all-monospace interfaces.

### 4.2 Role scale

Sizes below are defaults at 100% user text size. The compact/wide values switch at the medium breakpoint, except fluid marketing display type, which may interpolate within its stated limits.

| Token | Family | Compact / wide size | Line height | Weight | Tracking |
|---|---|---:|---:|---:|---:|
| `type.display` | display | 40 / 72 | 1.08 | 500 | −0.01em |
| `type.title.page` | display | 32 / 40 | 1.15 | 500 | −0.01em |
| `type.title.section` | display | 24 / 32 | 1.2 | 500 | −0.01em |
| `type.title.panel` | display | 20 / 20 | 1.3 | 500 | 0 |
| `type.title.item` | display | 16 / 16 | 1.4 | 500 | 0 |
| `type.body.reading` | body | 18 / 18 | 1.7 | 400 | 0 |
| `type.body.default` | body | 16 / 16 | 1.6 | 400 | 0 |
| `type.body.compact` | body | 14 / 14 | 1.5 | 400 | 0 |
| `type.label` | body | 14 / 14 | 1.4 | 500 | 0 |
| `type.caption` | body | 12 / 12 | 1.5 | 400 | 0 |
| `type.eyebrow` | display | 12 / 12 | 1.5 | 500 | 0.12em |
| `type.button` | display | 14 / 14 | 1.4 | 500 | 0.02em |
| `type.code` | code | 14 / 14 | 1.6 | 400 | 0 |

Use 600 only for selective Inter emphasis. Do not simulate unavailable weights. Normal body text is never below 14; form entry is at least 16 on touch interfaces. Captions cannot carry the only explanation of a consequential action.

### 4.3 Rhythm and content rules

- Reading measure: 60–72 characters, default 66. Marketing introductions: 42–55 characters. Long research text uses reading type, not caption-sized UI type.
- Space after a heading: 12 for panel/item titles, 16 for sections, 24 for page titles. Paragraph-to-paragraph spacing: 16; lists within prose: 8 between items.
- Use sentence case for controls and application headings. Preserve existing brand names, acronyms and website taglines. Uppercase is reserved for short eyebrows and established branding, not body copy.
- The INFAIX hero wordmark may use the existing expanded tracking; default 0.18em. Do not apply that tracking to product workspace headings.
- Start-aligned text is the default. Centre alignment is permitted for a short editorial statement, never for forms, tables or long instructions.
- Headings represent document hierarchy independently of visual size. Never choose a heading level to obtain a font size.
- Truncate only repeated metadata where space is constrained. Names needed to distinguish objects, errors, totals and action consequences must wrap or expose the complete value on focus and activation.
- Localisation must support bidirectional text, long translations and non-Latin fallback glyphs. Avoid fixed-height text containers.

## 5. Spacing, grids and responsive layout

### 5.1 Spacing tokens

| Token | Logical units | Primary use |
|---|---:|---|
| `space.0` | 0 | Flush edges |
| `space.1` | 4 | Tight internal association |
| `space.2` | 8 | Icon/label gap, related controls |
| `space.3` | 12 | Small component padding |
| `space.4` | 16 | Standard internal gap |
| `space.5` | 20 | Compact panel padding |
| `space.6` | 24 | Panel padding and group separation |
| `space.8` | 32 | Section within a workspace |
| `space.10` | 40 | Wide page gutter |
| `space.12` | 48 | Major application separation |
| `space.16` | 64 | Compact editorial section |
| `space.18` | 72 | Existing mobile editorial rhythm |
| `space.24` | 96 | Wide editorial section |

Two-unit adjustments are allowed only for optical alignment and must not change component bounds. Use 8 between label-related elements, 24 between form groups and 32 between distinct tasks. Do not assemble spacing from arbitrary margins on both neighbouring components: the containing layout owns the gap.

### 5.2 Breakpoints and grid

| Token | Width threshold | Grid | Default outer gutter | Column gap |
|---|---:|---:|---:|---:|
| `breakpoint.compact` | 0 | 4 | 24 | 16 |
| `breakpoint.medium` | 640 | 8 | 24 | 24 |
| `breakpoint.wide` | 1024 | 12 | 40 | 24 |
| `breakpoint.expanded` | 1440 | 12 | 40 | 32 |

Thresholds describe available content width, not device identity. A sidebar or split pane may make a wide device contain a compact region. Components must reflow based on their usable width. Density must never be inferred from width alone.

`layout.editorial.max` is 1180 including gutters, preserving the website container. `layout.workspace.max` is 1600 for bounded work; data canvases may use remaining width. `layout.reading.max` is 66ch. `layout.form.max` is 480. Auth page outer shell is 560. `layout.inspector.width` is 320, minimum 280. `layout.sidebar.width` is 256; collapsed rail is 64. All are proposed shared layout tokens, not required immediate migrations.

### 5.3 Reflow rules

- Design from 320 logical units upward. Support portrait, landscape, text enlargement and split-screen use.
- Move secondary information below the task before hiding it. Never hide the only route to a product destination or action.
- On compact layouts, persistent sidebars become labelled drawers. Inspectors become a separate view or full-height sheet with an explicit Back/Close action.
- Preserve reading and focus order when columns stack. Marketing copy and its primary action precede decorative artwork.
- Controls wrap as groups; text does not squeeze below its role minimum to preserve a row.
- Horizontal scrolling is reserved for inherently two-dimensional data, code and diagrams. Keep it inside a labelled region; provide keyboard access and a nonvisual equivalent.
- Respect safe areas and the on-screen keyboard. Bottom actions must remain reachable without covering focused inputs.
- Application content has one primary vertical scroll owner. Secondary scroll regions need a task reason; nested scrolling is not a generic panel style.
- Sticky elements must reserve their space and account for anchor and focus offsets, including wrapped navigation height.

### 5.4 Density

Comfortable is the default: 44 minimum control height, 48 list/table row minimum and 24 panel padding. Compact is an explicit preference for pointer/keyboard workflows: 36 control height, 36 row minimum and 16 panel padding. Touch hit areas remain at least 44 even in compact mode; do not overlap adjacent hit areas. Use comfortable density when this cannot be achieved. Text wraps increase row height in both modes.

## 6. Surfaces, borders, elevation and layers

### 6.1 Geometry tokens

| Category | Tokens and values | Rule |
|---|---|---|
| Radius | `radius.none` 0; `radius.small` 2; `radius.control` 3; `radius.panel` 4; `radius.overlay` 6; `radius.round` 50% | Round only for circular avatars/status dots; no default pill-shaped controls |
| Borders | `border.width.default` 1; `border.width.emphasis` 2 | Solid strokes; emphasis for focus/selection where specified |
| Focus | `focus.width` 2; `focus.offset` 3 | Highlight ring, never clipped |
| Shadow | `shadow.none` none; `shadow.popover` 0, 4, 12, 0, black 20%; `shadow.modal` 0, 12, 32, 0, black 28% | Values are horizontal offset, vertical offset, blur, spread and colour; no coloured shadows |
| Opacity | `opacity.full` 1; `opacity.scrim` 0.72; `opacity.selection` 0.08; `opacity.decorative.max` 0.25 | Decorative limit excludes the unchanged official logo and its existing treatment |

### 6.2 Elevation contract

`elevation.0`: canvas, no shadow. `elevation.1`: panel with subtle divider/border, no shadow. `elevation.2`: raised popover with subtle border and popover shadow. `elevation.3`: modal with raised surface, border and modal shadow. Elevation conveys overlap, not importance. A primary action does not need a raised card.

Use opaque surfaces in working areas. Retain existing website transparency only where it already contributes to the brand composition and passes contrast checks. New components must not add backdrop blur. Borders that identify controls use the control token; ornamental card edges may use the subtle token.

### 6.3 Layer tokens

| Token | Order |
|---|---:|
| `z.ambient` | 0 |
| `z.content` | 1 |
| `z.sticky-local` | 10 |
| `z.navigation` | 50 |
| `z.popover` | 100 |
| `z.modal-scrim` | 200 |
| `z.modal` | 210 |
| `z.modal-popover` | 220 |
| `z.notification` | 300 |
| `z.tooltip` | 310 |
| `z.skip-link` | 400 |

These are relative levels, not permission to escape component stacking contexts. An overlay coordinator must resolve ownership. Background notifications and tooltips cannot become interactive above a modal; only the active modal's owned overlays may do so. Prevent nested modal workflows; replace modal content or use a dedicated page when work becomes complex.

## 7. Motion and transitions

Motion explains continuity, causality and state. Functional feedback is prompt; spatial transitions decelerate; ambient motion is slow. “Slow” is not a reason to delay an operation or hide content.

### 7.1 Motion tokens

| Token | Value | Use |
|---|---|---|
| `motion.duration.instant` | 0ms | Focus, direct manipulation, reduced-motion spatial changes |
| `motion.duration.press` | 100ms | Press/release feedback |
| `motion.duration.hover` | 180ms | Control colour/border response |
| `motion.duration.standard` | 240ms | Tabs, disclosure and small state changes |
| `motion.duration.enter` | 300ms | Dialog/drawer entry |
| `motion.duration.exit` | 180ms | Dismissal |
| `motion.duration.page` | 320ms | Optional route content transition |
| `motion.duration.editorial` | 900ms | Existing website reveal treatment |
| `motion.ease.out` | cubic-bezier(0.22, 1, 0.36, 1) | Entry and settling; preserved existing curve |
| `motion.ease.in-out` | cubic-bezier(0.4, 0, 0.2, 1) | Reversible state changes |
| `motion.ease.linear` | linear | Measured progress and continuous rotation |
| `motion.distance.control` | 2 | Existing marketing button lift, maximum |
| `motion.distance.overlay` | 8 | Dialog entrance, maximum |
| `motion.distance.page` | 8 | Optional page entrance, maximum |

Existing editorial reveals may retain their 28-unit vertical/32-unit horizontal travel. Do not apply those distances to application data or forms. The legacy ambient cycles remain: logo breath 6s, logo float 9s, glow 14/18s, deep breath 22s, grid 36s and rings 60s. They are not a menu of effects for new components.

### 7.2 Spring behaviour

Springs are optional for native direct manipulation, resizable drawers and drag settling. Use a critically damped model: normalised mass 1, stiffness 320, damping 36, no overshoot or bounce. Engines use different units: match the observable result—settled within 1% of the target within approximately 400ms—rather than copying incompatible numbers. Non-physics platforms use the 300ms out curve. No spring dependency is justified for a button hover.

### 7.3 Interaction choreography

| Interaction | Behaviour | Reduced motion |
|---|---|---|
| Buttons | Colour/border response at 180ms; press at 100ms; workspace controls do not move; existing marketing lift may remain | No translation; immediate colour feedback |
| Cards | Interactive cards change border/surface in 180ms; static cards have no action-like response | Immediate colour/border state |
| Navigation | Indicator updates in 180ms; route becomes active when navigation commits | Immediate indicator |
| Sidebar/drawer | Optional 300ms entry, 180ms exit; no content-scale effect | Appears/disappears immediately |
| Dialog | Optional opacity and up to 8-unit translation on entry; focus established before interaction | Immediate spatial placement; opacity change at most 100ms |
| Tabs | Selection immediate; panel may fade for 100ms when already available | Immediate replacement |
| Accordion | 240ms expansion; use known content bounds and avoid repeated layout measurement | Immediate expansion |
| Page | Keep shell stable; optional incoming fade/8-unit movement for 320ms; do not animate outgoing and incoming reading surfaces together | Immediate content replacement |
| Loading | Existing status pulse may use 2.4s; indeterminate spinner only when needed, 1.2s rotation | Static indicator and live status text |
| Scroll | User-driven, interruptible; never scroll-jack or snap editorial reading | Programmatic scroll instant |

Hover animations reverse from their current position. Never queue repeated hover transitions. Focus visibility is immediate. Animation completion must not gate network requests, form submission, keyboard input or screen-reader content.

### 7.4 Ambient and performance rules

Preserve the existing shared canvas, capped particle counts and geometry. Time is measured by elapsed duration, not frame count. Resume without jumping after a hidden tab; pause offscreen/background work. Redraw a static frame after resize in reduced-motion mode and respond to preference changes without reload.

New workspace shells may show the approved ambient treatment only in exposed background areas. Reading, editing and measurement surfaces remain opaque. Existing website animations remain present in standard mode. Provide a persistent “Background motion” setting with System and Off options; Off retains the static composition. No sound accompanies ambient motion.

Target 60fps on representative supported hardware, approximately 16.7ms per frame for the entire page, not just the animation. Profile rather than assert GPU acceleration. Prefer transform and opacity; retain existing paint-based effects only within the measured budget. No new animation library, gradient, blur layer or always-on compositor hint is required by this system.

## 8. Shared interaction contract

### 8.1 State hierarchy

Every interactive component specifies default, hover, pressed, focus-visible, selected/expanded where applicable, disabled, busy and error states. State precedence is: disabled blocks action; busy prevents duplicate action; error describes validity; selected describes persistence; focus remains visible over all operable states. Hover never carries essential information alone.

Native semantics take precedence over appearance: links navigate, buttons act, checkboxes select independently, radio buttons choose one option and switches change an immediate setting. A card with one destination is a link. A card containing multiple controls is a container with explicitly separate actions.

### 8.2 Behaviour rules

- Activate pointer actions on release, with cancellation when dragged away. Never activate a destructive action on pointer-down.
- Preserve entered values after validation or network failure. Busy states reserve the control's dimensions and prevent duplicate submission.
- Optimistic updates are permitted for reversible, low-risk edits with reliable rollback. Do not claim successful deployment, payment, permission changes or deletion before confirmation from the service.
- Disabled actions include an adjacent explanation when their reason is not obvious. Do not depend on a tooltip attached to an unfocusable control.
- Focus follows the user's task: return it after overlays, move it to a meaningful destination after navigation, retain it during background refresh.
- Essential controls remain discoverable on touch and keyboard. Hover-only row actions are prohibited.
- Long actions may be cancellable when cancellation is supported; never label a dismiss-only control “Cancel operation”.

### 8.3 Shortcut registry

| Shortcut | Shared intent | Constraint |
|---|---|---|
| Cmd/Ctrl+K | Open command palette | Show a visible entry point; do not intercept during IME composition |
| Escape | Close the top dismissible transient surface | Does not silently discard unsaved work |
| Tab / Shift+Tab | Move between controls | No positive custom tab ordering |
| Enter / Space | Native activation for the focused control | Links retain platform behaviour |
| Arrow keys / Home / End | Navigate composite widgets | Only inside the active widget, not global page hijacking |
| Cmd/Ctrl+Enter | Submit a multiline composer when advertised | Enter continues to insert a newline by default |

Preserve browser/OS shortcuts such as Find, Reload, Back and window management. Avoid single-character global shortcuts; if offered, users can disable or remap them and they are inactive in editable content. Show platform-specific key names. Display all product shortcuts in Help → Keyboard shortcuts. No feature may require a shortcut.

## 9. Component specifications

### 9.1 Buttons and icon actions

Comfortable height 44, horizontal padding 16, icon gap 8, control radius 3. Large editorial actions may be 48 high with 24 horizontal padding. Labels use button type and a specific verb: “Create project”, “Save changes”, “Retry”.

Primary: opaque purple with white text; hover keeps purple and adds highlight border. Secondary: panel surface, primary text, control border; hover raised surface. Quiet: transparent, secondary text, highlight on hover; no boundary required when label clearly identifies an action. Destructive: panel surface, error foreground/border, explicit verb; never use brand purple to signify danger. Disabled: panel surface, muted text, no motion, no opacity fade. Loading: retain width, replace label with an operation-specific phrase and expose busy state.

One primary action per task group. Cancel is secondary or quiet. Icon-only actions need a 44-square hit area and accessible name; use a focusable tooltip for supplemental explanation, not as the name itself. A tooltip is shown on hover or focus, dismissed with Escape, and must not contain interactive controls.

### 9.2 Inputs and form composition

Input height at least 44, padding 12 horizontally, radius 3, panel/void surface and control border. Label sits above with an 8 gap. Helper/error text sits below with an 8 gap. Field groups are 24 apart. Textareas grow from three lines and expose resizing where supported.

Labels remain visible; placeholders provide examples rather than names. Show required/optional status consistently; if most fields are required, label optional fields and state the convention once. Connect help and errors to the field's accessible description. Error uses text and error colour, identifies the issue and gives a correction.

Validate after blur or submission, not aggressively while a person is composing text. After a failed submit, provide a linked error summary and move focus to it; if there is only one field, focus that field. Clear errors when corrected. Preserve input after failure and allow password managers, copy and paste. Password reveal is a labelled toggle. Format hints must not force unnecessary input memory tests.

Checkbox/radio visual size 20 with a 44 hit region. Checkbox mixed state is explicit; radio groups have a group label. Space changes selection; radio arrow keys follow platform conventions. Switch visual size 36 × 20 inside a 44-high target: label describes the setting, state is exposed, changes apply immediately with failure rollback. Use a checkbox when a Save action commits changes later.

### 9.3 Search, selects and dropdowns

Search is a labelled search field with a clear action when populated. Input height 44; result row minimum 44; result groups have text labels. Default server-query debounce is 200ms; suppress requests during IME composition and discard stale responses. Explicit submit remains immediate.

Provide distinct initial, searching, results, no-results and failure states. Retain the query during errors and navigation back. Announce the settled result count politely, not every keystroke. Selecting a suggestion does not silently trigger an unrelated action.

Use a native select for short simple choices. A searchable choice uses a combobox with a labelled listbox; arrow keys move options, Enter selects, Escape closes and restores prior committed value, Tab continues focus. Action dropdowns use menu semantics; arrow keys navigate, Home/End reach boundaries and Escape restores the trigger. Do not use action-menu semantics for ordinary site navigation. Follow the appropriate [WAI-ARIA APG pattern](https://www.w3.org/WAI/ARIA/apg/patterns/), not a custom keyboard model.

### 9.4 Cards and panels

Cards group an object or destination. Default padding 24, compact 20, radius 4, panel surface and subtle border. Title, supporting description, metadata and action follow that order with 8/16 gaps. Equal-height cards are optional; text must not be clipped to achieve them.

Panels contain work. Default header and body padding 24; related content uses 16 gaps. Use dividers rather than nested cards for closely related settings. Interactive cards provide the same affordance on focus as on hover; static panels do not lift or glow. No clickable outer card may contain nested links or buttons that conflict with its activation area.

### 9.5 Topbar, navigation, sidebar and breadcrumbs

Application topbar height is at least 64; website navigation retains its 76 minimum on wide layouts and may wrap. Product identity is start-aligned, contextual actions are end-aligned. Keep location and task title visible before secondary utilities. Account controls reserve a stable region while session state resolves; show a neutral accessible loading state rather than flashing the wrong identity.

Sidebar width 256, rail 64; item height 44, horizontal padding 16, gap 8. Group labels use caption/eyebrow type. The current destination has highlight text or border plus a persistent structural marker; focus adds a separate ring. Expanded/collapsed groups retain their state within the current product. Rails require accessible names and tooltips; compact screens use a drawer with a labelled opener and modal keyboard handling.

Primary site navigation consists of links with the current page identified. Do not assign application menu keyboard behaviour to it. Product switching is explicit and preserves each product's last useful location when permitted.

Breadcrumbs describe hierarchy rather than click history. Use a labelled navigation region, linked ancestors, a nonlinked current item and decorative separators. On compact screens collapse middle ancestors into an accessible disclosure, retaining the nearest parent and current item. Do not truncate the only identifying object name.

### 9.6 Tabs and accordions

Tabs switch peer views in one context. Tab targets are at least 44 high; use a 2-unit highlight underline for the active tab. Only the selected tab is in the normal tab sequence; arrows move between tabs, Home/End reach boundaries. Automatic activation is allowed only when the panel is already available without perceptible delay; otherwise Enter/Space activates. Keep focus on the tab. Persistent routes should use links instead of pretending to be tab panels. See the [APG tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).

Accordion headers are buttons inside meaningful headings, minimum 44 high, with an 8 icon gap and expanded state. Enter/Space toggles; Tab visits every header. Multiple panels may remain open by default. Do not collapse another panel unless the specific task requires single expansion and documentation states it. Error-containing sections open automatically on submit and remain navigable.

### 9.7 Dialogs, drawers and popovers

Default dialog width 480; wide dialog 640; never wider than the viewport minus 48. Padding 24, radius 6, raised surface. At compact widths, a complex dialog becomes a full-height sheet with safe-area padding. Header names the task; body explains consequences; footer holds secondary then primary action in reading order. Allow the body to scroll while keeping essential controls reachable.

Modal background is inert. Focus starts at the first useful control or a static heading for long explanations; destructive confirmation starts on the safest appropriate element. Tab stays inside; Escape dismisses unless doing so would lose work, in which case a clear discard decision is required. Closing restores focus to the trigger or a logical successor if it no longer exists. See the [APG dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

Do not open dialogs merely to announce success. An anchored popover stays within the viewport, flips placement when needed and closes on Escape/outside activation. If it contains interactive controls, use the relevant nonmodal dialog/menu/combobox contract rather than a tooltip. Closing a popover does not submit a form.

### 9.8 Notifications and inline messages

Inline feedback is preferred beside the affected object. Notifications are for outcomes outside the current context, not a replacement for field errors. Default width 360, compact width viewport minus 48, padding 16, radius 4. Stack at most three; group repetitions. New notifications do not steal focus.

Success notices without actions may dismiss after 6 seconds, pausing on hover/focus, with a persistent event record when the outcome matters. Errors, warnings and notices with actions persist until dismissed or resolved. Use polite announcements for routine outcomes; urgent alerts only for immediate interruption-worthy failure. No sound or animation is needed to establish importance.

### 9.9 Tables and lists

Tables use primary text for values, secondary text for metadata, subtle row dividers and no zebra stripes by default. Comfortable row minimum 48; compact 36; cell horizontal padding 16, vertical padding at least 8. Header text uses label type. Align text to start, numbers to end and decimal precision consistently. Show units in column headings and locale-aware values.

Sortable headers expose the active sort direction and a labelled button. Selection checkboxes include the row name; the header checkbox exposes a mixed state. Bulk actions state the selected count and whether selection covers this page or all matching results. Loading and sorting preserve row identity and focus. Empty, unavailable and zero values are distinct.

Use native table semantics for ordinary data; do not add arrow-key grid behaviour unless spreadsheet-like cell interaction is actually required. A data grid needs a separately documented cell navigation/editing contract. Sticky headers must not obscure focused controls. Horizontal overflow remains inside the table region; retain key identifiers or offer a row detail view.

Lists use 48 minimum rows, 16 padding, 8 between icon and text. A row's primary action and secondary actions are separate. Offer explicit selection checkboxes for bulk work. Virtualised lists must preserve accessible position/count and keyboard focus; use pagination if the implementation cannot do so reliably.

### 9.10 Timeline, badges and status indicators

Timeline entries use an ordered list, 24 between events, a 1-unit decorative connector and an 8-unit marker. Text supplies event, actor where relevant, timestamp and outcome. Relative time exposes an absolute time and timezone on focus/activation. New live events do not move the reader's position; show “New events” when they are reading earlier history.

Badge: 12-unit caption type, 4 vertical/8 horizontal padding, radius 2, no interaction unless explicitly an action. Status dots are 6 units with an 8 gap to a label. Neutral/queued/offline use muted; active/in-progress use highlight; completed/healthy use success; failed use error; warning uses primary text and a warning icon. “Live” means available, not guaranteed healthy. “Unknown” and stale data must not look like healthy status. Pulsing is optional only while an actual operation is active; never on every badge.

### 9.11 Command palette

The palette is a modal task surface, default width 640, maximum height 70% of the visible viewport. Search input height 48; results minimum 44; padding 8 around result groups. Initial results show relevant commands and recent destinations, without inventing activity.

Focus starts in the query. Arrow keys move the active result, Enter executes or navigates, Escape closes and returns focus. Result rows show action/destination, context and optional shortcut. Fuzzy matches may emphasise text without changing reading order. Commands requiring arguments open a labelled next step with Back; dangerous commands still require their normal confirmation. Respect permissions before displaying executable actions. Queries, empty results, unavailable actions and network failures have explicit states. It must also be reachable from a visible Search/Commands control.

## 10. Loading, empty, error and success states

| State | Required content | Behaviour |
|---|---|---|
| Initial loading | Name the work being loaded | Reserve credible dimensions; announce once politely |
| Operation pending | “Saving…”, “Connecting…” or precise equivalent | Immediate feedback; suppress duplicate action |
| Longer operation | Stage and measured progress if available | After 10s explain continuation and recovery; never invent a percentage |
| First-use empty | What belongs here and one available next action | No fake objects or decorative dashboard data |
| No results | Query/filter context and a way to adjust it | Preserve input; distinguish from backend failure |
| No permission | Scope of restriction and legitimate access route | Do not describe inaccessible data as empty |
| Offline | Last available data, freshness and retry path | Preserve edits; never imply server save |
| Error | What failed, impact, preserved work and recovery | Field error inline; task error near task; page failure retains navigation |
| Success | Completed outcome and next action only if useful | Confirm after service acknowledgement; no celebration effect |
| Partial success | Completed and failed portions separately | Retry only failed portions when supported |

Show a loading skeleton only when the final structure is known and the delay exceeds 300ms. Use static existing surface blocks; no shimmer gradient. Do not impose a minimum artificial delay. Replace placeholders in place without collapsing the layout. Skeletons are decorative to assistive technology; a single status describes loading. Progress must have a name and measurable value when determinate.

For streamed AI output, display a waiting phrase before the first content, then replace it with the response. Do not repeatedly announce individual tokens. Announce generation state and completion, while making the response accessible for normal reading. Keep the user's scroll position when they read earlier content; provide “Jump to latest”. Stop is available while generation can be cancelled. Streaming failure preserves received content and labels it incomplete. AI generation is never represented as certainty or verified research by appearance alone.

## 11. Icons, illustrations and product imagery

### 11.1 Iconography

Use one shared outline family built around the existing geometric style. Default canvas 24 × 24, stroke 1.5; display at 20 in controls and 16 in metadata, preserving optical weight. Use simple paths, consistent caps and restrained detail. Do not mix emoji, arbitrary Unicode glyphs and unrelated icon packs for equivalent controls.

Icons support labels. Decorative icons are hidden from assistive technology; meaningful icon-only controls have explicit names. Directional icons mirror in right-to-left layouts when their meaning is directional; brand marks, media controls and factual diagrams do not automatically mirror. Product logos are not UI icons.

### 11.2 Illustration

Use accurate wireframes, engineering diagrams, sparse connectors and meaningful nodes. Lines are thin, structure is readable and emphasis comes from existing purple. An illustration either explains a relationship or preserves established ambient identity. Do not add arbitrary orbital systems, futuristic HUDs, glowing brains or ornamental dashboards.

Meaningful diagrams need a title, text explanation, legible labels and accessible relationship descriptions. Decorative geometry has no focus stops or screen-reader narration. Complex diagrams may pan/zoom only with visible controls and a text alternative; gestures cannot be the sole interface.

### 11.3 Images

Product photography shows actual form, material and finish on quiet backgrounds. Preserve colour fidelity. Do not recolour products to purple or use generated imagery to imply features not present. Gallery tiles default to 1:1; technical diagrams retain their native ratio; editorial images may use 3:2. Use contain for product inspection and diagrams, crop only for intentionally editorial images. Reserve aspect ratio during loading.

Provide useful alternative text, captions for technical distinctions and a clear image-error state. A selected thumbnail has both a border and selected semantics. Zoom is user initiated and keyboard operable. Do not autoplay product carousels or video. Include captions/transcripts for explanatory media.

## 12. Charts and data presentation

Charts answer a named question. Specify units, period, timezone, source, freshness and aggregation. Show zero, missing and stale values distinctly. Use tabular numerals, labelled axes and a caption summarising the principal relationship. Interactive charts also provide the underlying accessible table or equivalent structured summary.

| Chart token | Mapping | Non-colour distinction |
|---|---|---|
| `chart.series.primary` | highlight | Solid line, circle marker |
| `chart.series.secondary` | text | Dashed line, square marker |
| `chart.series.tertiary` | muted | Dotted line, triangle marker |
| `chart.grid` | border | Decorative guide only |
| `chart.label` | muted | Caption type, minimum 12 |
| `chart.threshold.error` | error | Labelled threshold and distinct line pattern |
| `chart.threshold.success` | success | Only meaningful positive target/status |

Use at most three directly compared series by default; beyond that, use filtering or small multiples instead of new hues. Avoid filled gradients, 3D charts and decorative smoothing of measurements. Bar charts normally start at zero; any truncated numerical axis is explicitly indicated. Do not use a colour ramp alone to communicate heatmap values—include numbers, patterns or an accessible alternative.

Tooltips appear on focus as well as pointer interaction and include the same values as the table. Selection persists independently of hover. Charts do not animate historical data on every refresh; update without changing reading position. Live displays offer Pause and disclose paused/stale state.

## 13. Product expression and layout families

The shared core is recognisable through typography, dark surfaces, restrained purple, geometry, spacing and behaviour. Personality is selected through content measure, density and composition. Do not assign each product a different accent colour.

| Product | Purpose and expression | Default layout/density | Brand motion |
|---|---|---|---|
| Website · infaix.com | Brand, purpose, vision, editorial clarity | 1180 outer container, generous 72/96 section rhythm | Existing ambient and editorial reveals preserved |
| FORGE · forge.infaix.com | Engineering, structured operations, technical precision | Workspace shell, sidebar, object lists, inspectors; comfortable with compact option | Minimal exposed-shell ambient; operational data stays still |
| CHAT · chat.infaix.com | Collaborative work, calm focus, comfortable conversation | Conversation list and central reading/composer region; comfortable | No decorative motion behind messages or composer |
| ATLAS · atlas.infaix.com | Knowledge, research, reading and connected sources | 66ch reading column with optional outline and source inspector | Static reading surface; relationship motion only after an explicit action |
| SHOP · shop.infaix.com | Premium physical/digital products, material clarity | Product-first gallery, clear specification and purchase groups | User-controlled media; quiet existing brand treatment outside product detail |

### 13.1 Website

Communicate what INFAIX is before asking visitors to explore. Give the explanation and next action priority over ambient art. Use the established short editorial statements and project evidence. Status labels distinguish available work from future plans. This specification does not authorise new roadmap content or rename the existing AI page.

### 13.2 FORGE

Structure screens around object, state, action and history. Show environment and resource scope before consequential operations. Measurements have units; logs have timestamps; deployment and access actions state their target. Dense information is permitted; tiny labels and unreadable contrast are not. Use tables and structured panels rather than ornamental metrics cards.

### 13.3 CHAT

Prioritise comfortable reading, clear authorship, recoverable drafts and an unobstructed composer. Conversation text uses body.default; extended reading may use body.reading. Distinguish user, collaborator, assistant and system messages with names and structure, not colour alone. Explain tool activity in plain language and expose details on demand. Keep sources attached to claims when present. Do not use glowing assistant avatars or unnecessary typing theatrics.

### 13.4 ATLAS

Use body.reading, persistent location, document outlines and citations that return users to their reading position. Separate source material, annotations and generated synthesis. Graphs are alternate views of knowledge, not mandatory landing screens. Provide lists and search as equivalent routes. Research uncertainty and provenance must remain visible.

### 13.5 SHOP

Let product form and information create desire. Provide image scale, specifications, compatibility, availability and complete cost clearly. Purchase actions are stable and explicit. Do not use false scarcity, countdown pressure or animation around price. Selection states distinguish variants with labels and imagery; colour swatches need names. Checkout errors preserve valid input and identify the exact recovery step.

### 13.6 Layout families

| Family | Composition rule | Compact transformation |
|---|---|---|
| Editorial | Page title/introduction, sectional narrative, supporting evidence, footer | Single column; copy before decoration |
| Workspace | Stable shell, task header, toolbar, work region, optional inspector | Drawer navigation; inspector becomes a separate view |
| List/detail | Object list, selected detail, scoped actions | Navigate between list and detail; restore list position |
| Reading | Outline, 66ch text, optional references | Text first; outline and sources behind explicit controls |
| Settings/form | Group title, labelled fields, local save/recovery | One column; actions follow the associated fields |
| Product detail | Gallery, identity/price/availability, configuration, specifications | Gallery then decision information; sticky action cannot obscure content |
| Authentication | Branded shell, focused form, recovery links | Full available width within form measure |

These are compositional contracts, not page mockups. Preserve platform Back behaviour, deep links and state restoration. Mobile and desktop products inherit tokens and semantics while respecting native controls, safe areas, window resizing, context menus, accessibility APIs and text scaling. Do not reproduce browser chrome inside a native application.

## 14. Accessibility and acceptance

### 14.1 Required baseline

Web products must meet WCAG 2.2 AA across complete workflows. Normal text needs at least 4.5:1 contrast; large text at least 3:1; essential control boundaries and meaningful graphics at least 3:1 against adjacent colours. Support keyboard operation, visible focus, 200% text resize and reflow at 320 CSS pixels subject to the standard's two-dimensional-content exceptions. Sticky elements must not obscure keyboard focus. Accessibility claims require testing of complete pages and processes, not a token checklist. Source: [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

INFAIX additionally requires 44 × 44 logical-unit touch targets, fully visible focus, no flashing decoration and an off setting for nonessential ambient motion. These are system requirements, not a claim that every one is the AA minimum. Reduced motion removes spatial animation rather than merely shortening it; this also adopts the intent of [Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html), an AAA criterion.

### 14.2 Component release checklist

- Complete keyboard path, including reverse navigation, opening, cancellation, selection, recovery and focus return.
- Accessible name, role, value, state and descriptions; headings and landmarks form a coherent document.
- Meaningful status changes announced without flooding live regions or stealing focus.
- Focus ring visible on each state, not clipped by overflow or hidden beneath fixed controls.
- Actual contrast checked in default, hover, focus, selected, invalid and busy states; transparency tested over its real background.
- Touch targets and drag alternatives verified. No hover-only instructions or gesture-only actions.
- Long labels, translated text, bidirectional content, empty data, large datasets and wrapping verified.
- 320/375/640/1024/1440 widths, 200% text size and browser zoom that produces the required reflow tested.
- System reduced motion, product motion Off, forced colours and increased contrast tested; meaning survives without colour.
- Screen-reader testing with representative desktop and mobile combinations; automated checks supplement manual verification.
- Slow/offline network, asset failure, partial success and permission denial remain understandable and recoverable.

APG describes established widget behaviour, not a certification system. Use its [keyboard interface guidance](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) and pattern-specific contracts, then test the real implementation with assistive technology.

## 15. Documentation, governance and adoption

### 15.1 Required component record

Every component document contains: purpose; when to use/avoid; anatomy; token aliases; variants; comfortable/compact dimensions; all applicable states; keyboard map; screen-reader semantics; focus entry/exit; motion and reduced-motion behaviour; responsive transformations; content/localisation rules; loading/error behaviour; performance constraints; tested platforms; examples using realistic long data; owner; version; change history.

Illustrative examples must include the failure and long-content cases. A screenshot alone is not a component specification. A token name without allowed use is not a token definition. Do not mark a component stable while an interaction decision remains “TBD”.

### 15.2 Change policy

- **Patch:** clarification or correction that does not change a consumer contract.
- **Minor:** additive token, component or opt-in capability with existing behaviour preserved.
- **Major:** removal, semantic colour reassignment, geometry/behaviour change requiring consumer migration or altered keyboard contract.
- Deprecations identify replacement, reason, affected products and migration guidance. Retain deprecated aliases for at least one minor release before a major removal.
- An exception names its user need, affected scope, accessibility evidence, owner and review date. “It looks better” is not sufficient.
- Review new patterns against existing components first. Product teams contribute to the shared system; they do not fork its basic interaction language.

### 15.3 Adoption order

1. Inventory existing assets, fonts, literal values and component behaviours.
2. Map preserved values to the reference and semantic tokens; record inherited contrast or behaviour gaps.
3. Apply the shared interaction and accessibility contract to high-use controls.
4. Adopt layout/density contracts product by product without rewriting information architecture.
5. Validate complete workflows, performance and brand continuity before declaring conformance.

This order is guidance for later implementation, not authorisation to change application code in this task. The system introduces no dependency requirement and no automatic migration.

### 15.4 Decision rule for future engineers and AI

When a specification appears to leave a choice open, use the semantic token, component default and product profile in that order. Preserve native platform behaviour and accessible operation. If the decision would require a new colour, motion effect, control pattern or exception to the keyboard contract, document the proposed addition for system review instead of inventing it in a product.

### 15.5 Source ledger and version history

Repository sources inspected for this specification:

- `src/app/globals.css`: palette, spacing, fonts, surfaces, interactions and motion cycles.
- `src/app/layout.tsx`: Space Grotesk/Inter and dark root presentation.
- `src/components/infaix-logo.tsx`, `src/components/logo-image.tsx`, `public/infaix-logo.png`: existing logo asset, dimensions and presentation contract.
- `src/components/ambient-background.tsx`: geometric background, loop, mobile limits and reduced-motion behaviour.
- Existing navigation, form, chat and account patterns: baseline for shared behaviour; existing defects are not normative.

Accessibility sources are linked beside the requirements they support. Token mappings, dimensions, product profiles and component defaults beyond the repository baseline are INFAIX v1.0 design decisions. External design systems are not used as visual templates.

**1.0 — 8 September 2026:** establishes the preserved brand foundations, semantic tokens, product profiles, component contracts, motion rules, accessibility acceptance and documentation governance. No implementation code or page mockups accompany this version.
