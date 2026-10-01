# Core visual preservation audit

Audited before frontend edits: `globals.css`, `layout.tsx`, `Nav`, `Footer`, homepage, `infaix-logo`, `ambient-background`, `ScrollReveal`, account/admin UI and the existing v1.0 design specification. Original homepage reviewed in a local browser before changes.

| Foundation | Existing implementation retained |
|---|---|
| Palette | void #08070c; surface #111019; surface2 #191721; border #302a3d; purple #9146ff; highlight #b36bff; text #f0edf5; muted #9b96a5 |
| Background | Deep-space radial layers, 64px perspective grid, canvas network nodes, octahedron/cube/rings, vignette |
| Motion | Ambient 22s breathe; 14/18s glows; 36s grid drift; canvas slow rotation and drift; 0.9s reveal with cubic-bezier(0.22,1,0.36,1) |
| Typography | Space Grotesk headings and display; Inter body; tracked navigation and section labels |
| Logo | Official PNG, screen blend to remove baked black background, existing navbar/hero/footer sizes and glow treatment |
| Spacing | 1180px container; 40px desktop / 24px mobile gutters; existing hero and section rhythm |
| Surfaces | Thin restrained borders, 2px control corners, existing dark translucent surfaces and purple accent states |
| Interaction | Highlight focus ring, understated hover, native links, existing reveal and reduced-motion overrides |

The hero artwork, logo treatment, typography families, color values and cosmic renderer were not replaced. A later visual pass retuned hero copy, the ecosystem field and the launcher surface while keeping those anchors. Added ecosystem entries use the existing border and capability-row vocabulary. Operations uses the same surfaces and type, with compact metadata and explicit unavailable states, not a new analytics theme.

Performance audit: ambient rendering already uses one canvas and one requestAnimationFrame loop, capped device pixel ratio (1.5), at most 78 desktop / 30 mobile nodes, no per-frame React state, hidden-tab pause and media-query change handling. Reduced motion draws a single frame and suppresses CSS animation. No speculative particle rewrite or additional animation/library was justified. The operations chart is CSS with 24 bars and a table, no visualization dependency. New UI introduces no dependency.

Visual validation results are recorded in the delivery report after browser review. This is a preservation audit, not a claim of formal accessibility certification.
