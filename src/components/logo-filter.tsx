/**
 * The official logo asset has a baked-in near-black rectangle
 * (rgb(8,7,7)). `mix-blend-mode: screen` already drops it against the page,
 * but on the header — which carries its own translucent surface — the residue
 * is faintly visible as a lighter box.
 *
 * `infaix-black-point` sets that black to zero without shifting hue: lighter
 * tones move by under 4%. It is defined once here and referenced by every
 * logo instance.
 */
export default function LogoFilter() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        <filter id="infaix-black-point" colorInterpolationFilters="sRGB">
          <feComponentTransfer>
            <feFuncR type="linear" slope="1.04" intercept="-0.04" />
            <feFuncG type="linear" slope="1.04" intercept="-0.04" />
            <feFuncB type="linear" slope="1.04" intercept="-0.04" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}