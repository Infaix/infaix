/**
 * INFAIX icon family.
 *
 * Every icon is drawn on the same 24×24 lattice and built from the brand's
 * structural geometry: the 45°-rotated square (rhombus) used for nodes, the
 * thin double-stroke facet line, and the diamond node that appears throughout
 * the ecosystem, lifecycle and console surfaces.
 *
 * There are no glyph fonts or Unicode symbols in this family. Icons inherit
 * `currentColor`, so a single colour decision at the call site controls the
 * whole mark, and a closed/unavailable state is expressed by the caller's
 * colour rather than by a second drawing.
 */

import { type IconName } from "@/lib/icon-names";

export type { IconName };

/** A filled diamond node — the primitive shared by every other mark. */
function Node({ cx, cy, s = 3.4 }: { cx: number; cy: number; s?: number }) {
  return (
    <path
      d={`M${cx} ${cy - s}L${cx + s} ${cy}L${cx} ${cy + s}L${cx - s} ${cy}Z`}
      fill="currentColor"
      stroke="none"
    />
  );
}

/** A hollow diamond node, used where a position is reserved but not lit. */
function NodeOutline({ cx, cy, s = 3.4 }: { cx: number; cy: number; s?: number }) {
  return (
    <path
      d={`M${cx} ${cy - s}L${cx + s} ${cy}L${cx} ${cy + s}L${cx - s} ${cy}Z`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    />
  );
}

const PATHS: Record<IconName, React.ReactNode> = {
  /* ---- registry applications ------------------------------------------ */

  // Core: the insignia itself — nested rhombi around a lit centre.
  core: (
    <>
      <path d="M12 2.6 21.4 12 12 21.4 2.6 12Z" fill="none" strokeWidth="1.2" />
      <path d="M12 6.4 17.6 12 12 17.6 6.4 12Z" fill="none" strokeWidth="1" opacity="0.55" />
      <Node cx={12} cy={12} s={2.2} />
    </>
  ),

  // Chat: two overlapping conversation planes on the rhombic axis.
  chat: (
    <>
      <path d="M12 3 20 7.6 12 12.2 4 7.6Z" fill="none" strokeWidth="1.2" />
      <path d="M4 12.4 12 17 20 12.4" fill="none" strokeWidth="1.2" opacity="0.6" />
      <path d="M4 16.6 12 21.2 20 16.6" fill="none" strokeWidth="1.2" opacity="0.32" />
    </>
  ),

  // Forge: the hexagonal lattice, drawn as a rhombic cage.
  forge: (
    <>
      <path d="M12 2.4 20.2 7.2v9.6L12 21.6 3.8 16.8V7.2Z" fill="none" strokeWidth="1.2" />
      <path d="M12 7.2v9.6M3.8 12h16.4" fill="none" strokeWidth="1" opacity="0.5" />
      <Node cx={12} cy={12} s={2} />
    </>
  ),

  // AI: a four-point rhombic star with an inner facet.
  ai: (
    <>
      <path d="M12 2.4 14.3 9.7 21.6 12 14.3 14.3 12 21.6 9.7 14.3 2.4 12 9.7 9.7Z" fill="none" strokeWidth="1.2" />
      <path d="M12 7.4 13.6 10.4 16.6 12 13.6 13.6 12 16.6 10.4 13.6 7.4 12 10.4 10.4Z" fill="none" strokeWidth="1" opacity="0.5" />
    </>
  ),

  // Study: three stacked plates, the third lit.
  study: (
    <>
      <path d="M12 3 20.4 7 12 11 3.6 7Z" fill="none" strokeWidth="1.1" opacity="0.5" />
      <path d="M12 8.4 20.4 12.4 12 16.4 3.6 12.4Z" fill="none" strokeWidth="1.1" opacity="0.75" />
      <path d="M12 13.8 20.4 17.8 12 21.8 3.6 17.8Z" fill="none" strokeWidth="1.2" />
      <Node cx={12} cy={17.8} s={1.7} />
    </>
  ),

  // Atlas: a survey frame — outer rhombus, inner rhombus, four axis ticks.
  atlas: (
    <>
      <path d="M12 2.6 21.4 12 12 21.4 2.6 12Z" fill="none" strokeWidth="1.2" />
      <path d="M12 7.2 16.8 12 12 16.8 7.2 12Z" fill="none" strokeWidth="1" opacity="0.5" />
      <path d="M12 2.6v3.4M12 18v3.4M2.6 12H6M18 12h3.4" fill="none" strokeWidth="1" opacity="0.6" />
    </>
  ),

  // Shop: an open crate in isometric projection.
  shop: (
    <>
      <path d="M12 3.2 20.6 7.6 12 12 3.4 7.6Z" fill="none" strokeWidth="1.2" />
      <path d="M3.4 7.6v8.8L12 20.8l8.6-4.4V7.6" fill="none" strokeWidth="1.2" opacity="0.6" />
      <path d="M12 12v8.8" fill="none" strokeWidth="1" opacity="0.45" />
      <Node cx={7.7} cy={7.6} s={1.5} />
    </>
  ),

  /* ---- capabilities ---------------------------------------------------- */

  // Software: a rhombic frame enclosing a chevron pair.
  software: (
    <>
      <path d="M12 2.6 21.4 12 12 21.4 2.6 12Z" fill="none" strokeWidth="1.2" opacity="0.55" />
      <path d="M10 8.4 7 12l3 3.6M14 8.4l3 3.6-3 3.6" fill="none" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),

  // Robotics: a sensor head — rhombic shell, two optical nodes, a stem.
  robotics: (
    <>
      <path d="M12 5 19 9.2v5.6L12 19 5 14.8V9.2Z" fill="none" strokeWidth="1.2" />
      <Node cx={9.4} cy={11.4} s={1.5} />
      <Node cx={14.6} cy={11.4} s={1.5} />
      <path d="M12 19v2.6M12 5V2.4" fill="none" strokeWidth="1" opacity="0.55" />
    </>
  ),

  // Hardware: a processor — rotated square die with facet pins.
  hardware: (
    <>
      <path d="M12 5.6 18.4 12 12 18.4 5.6 12Z" fill="none" strokeWidth="1.2" />
      <path d="M12 9.2 14.8 12 12 14.8 9.2 12Z" fill="none" strokeWidth="1" opacity="0.6" />
      <path d="M12 2.6v3M12 18.4v3M2.6 12h3M18.4 12h3" fill="none" strokeWidth="1.2" />
      <path d="M5.1 5.1l2.1 2.1M16.8 16.8l2.1 2.1M18.9 5.1l-2.1 2.1M7.2 16.8l-2.1 2.1" fill="none" strokeWidth="1" opacity="0.45" />
    </>
  ),

  // Infrastructure: two stacked rack layers on the rhombic axis.
  infrastructure: (
    <>
      <path d="M12 3 20.6 7.2 12 11.4 3.4 7.2Z" fill="none" strokeWidth="1.2" />
      <path d="M3.4 12.4 12 16.6l8.6-4.2" fill="none" strokeWidth="1.2" opacity="0.65" />
      <path d="M3.4 17.4 12 21.6l8.6-4.2" fill="none" strokeWidth="1.2" opacity="0.38" />
      <Node cx={7.2} cy={7.2} s={1.4} />
      <NodeOutline cx={16.8} cy={7.2} s={1.4} />
    </>
  ),

  /* ---- FORGE inventory ------------------------------------------------- */

  // Compute: a lattice of lit and unlit cells.
  compute: (
    <>
      <path d="M12 3.2 20.8 12 12 20.8 3.2 12Z" fill="none" strokeWidth="1.1" opacity="0.45" />
      <path d="M12 7.4 16.6 12 12 16.6 7.4 12Z" fill="none" strokeWidth="1.1" />
      <Node cx={12} cy={12} s={2} />
    </>
  ),

  // Network: three nodes joined, the active pair lit.
  network: (
    <>
      <path d="M12 4.4 19.4 16.8H4.6Z" fill="none" strokeWidth="1.1" opacity="0.45" />
      <path d="M12 4.4v12.4M12 16.8 4.6 16.8M12 16.8l7.4 0" fill="none" strokeWidth="1" opacity="0.55" />
      <Node cx={12} cy={4.4} s={1.8} />
      <NodeOutline cx={4.6} cy={16.8} s={1.8} />
      <NodeOutline cx={19.4} cy={16.8} s={1.8} />
    </>
  ),

  // Fabrication: an isometric block with a cut line.
  fabrication: (
    <>
      <path d="M12 2.8 20.4 7.2 12 11.6 3.6 7.2Z" fill="none" strokeWidth="1.2" />
      <path d="M3.6 7.2v9.6L12 21.2l8.4-4.4V7.2" fill="none" strokeWidth="1.2" opacity="0.6" />
      <path d="M12 11.6v9.6" fill="none" strokeWidth="1" opacity="0.45" />
      <path d="M7.8 14.4 12 16.6l4.2-2.2" fill="none" strokeWidth="1" opacity="0.55" />
    </>
  ),

  // Bench: an instrument rail with a measured span.
  bench: (
    <>
      <path d="M3.4 12h17.2" fill="none" strokeWidth="1.2" />
      <path d="M6.6 7.2v9.6M17.4 7.2v9.6" fill="none" strokeWidth="1" opacity="0.5" />
      <path d="M6.6 12 12 6.6l5.4 5.4" fill="none" strokeWidth="1" opacity="0.45" />
      <Node cx={3.4} cy={12} s={1.9} />
      <Node cx={20.6} cy={12} s={1.9} />
      <NodeOutline cx={12} cy={12} s={1.9} />
    </>
  ),

  // Pipeline: three stages on a spine with a lit terminal.
  pipeline: (
    <>
      <path d="M4 12h16" fill="none" strokeWidth="1.1" opacity="0.5" />
      <NodeOutline cx={5.6} cy={12} s={2.4} />
      <NodeOutline cx={12} cy={12} s={2.4} />
      <Node cx={18.4} cy={12} s={2.8} />
      <path d="M12 5.6v3M12 15.4v3" fill="none" strokeWidth="1" opacity="0.4" />
    </>
  ),
};

/**
 * Renders one icon from the family. `size` is in logical units and the mark
 * always scales from the same 24-unit lattice.
 */
export default function InfaixIcon({
  name,
  size = 24,
  className = "",
  strokeWidth = 1,
  title,
}: {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
  title?: string;
}) {
  const drawing = PATHS[name];
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {drawing}
    </svg>
  );
}
