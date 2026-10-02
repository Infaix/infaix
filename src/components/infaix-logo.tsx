import LogoImage, { LOGO_SRC } from "@/components/logo-image";

type LogoVariant = "navbar" | "hero" | "footer" | "mark" | "hero-illuminated" | "insignia";

// Official asset is 202x505 (tall crystal). Sizes below preserve that
// aspect ratio exactly — never stretch or squash the mark.
const SIZES: Record<LogoVariant, { width: number; height: number }> = {
  navbar: { width: 14, height: 34 },
  hero: { width: 74, height: 186 },
  "hero-illuminated": { width: 74, height: 186 },
  insignia: { width: 156, height: 390 },
  footer: { width: 14, height: 34 },
  mark: { width: 10, height: 24 },
};

/**
 * Reusable INFAIX logo — the single canonical source of truth.
 * Always renders the official asset at /public/infaix-logo.png
 * (see LOGO_SRC) — never replaced or recolored.
 * The `hero-illuminated` variant presents it as an engineered
 * insignia: purple glow, faint wireframe ring + technical base.
 */
export default function InfaixLogo({
  variant = "navbar",
  priority = false,
  className = "",
}: {
  variant?: LogoVariant;
  priority?: boolean;
  className?: string;
}) {
  const { width, height } = SIZES[variant];

  if (variant === "hero" || variant === "hero-illuminated" || variant === "insignia") {
    return (
      <span className={`infaix-hero-mark${variant === "insignia" ? " is-insignia" : ""} ${className}`} role="presentation">
        <span className="infaix-hero-glow" />
        <svg className="infaix-hero-rings" viewBox="0 0 220 220" aria-hidden="true">
          {/* The asset's black is rgb(8,7,7); under `screen` that lifts the
              whole image rectangle. This sets the black point to zero without
              shifting hue — lighter tones move by under 4%. */}
          <filter id="infaix-black-point" colorInterpolationFilters="sRGB">
            <feComponentTransfer>
              <feFuncR type="linear" slope="1.04" intercept="-0.04" />
              <feFuncG type="linear" slope="1.04" intercept="-0.04" />
              <feFuncB type="linear" slope="1.04" intercept="-0.04" />
            </feComponentTransfer>
          </filter>
          <g className="infaix-hero-orbit">
            <circle cx="110" cy="110" r="96" fill="none" stroke="rgba(145,70,255,0.22)" strokeWidth="1" strokeDasharray="3 7" />
            <circle cx="110" cy="110" r="78" fill="none" stroke="rgba(190,180,210,0.14)" strokeWidth="1" />
          </g>
          <ellipse cx="110" cy="158" rx="62" ry="12" fill="none" stroke="rgba(145,70,255,0.28)" strokeWidth="1" />
          <ellipse cx="110" cy="158" rx="44" ry="8" fill="none" stroke="rgba(179,107,255,0.3)" strokeWidth="1" />
        </svg>
        <LogoImage
          width={width}
          height={height}
          alt=""
          priority={priority}
          className="infaix-hero-img"
        />
      </span>
    );
  }

  return (
    <LogoImage
      width={width}
      height={height}
      alt="INFAIX"
      priority={priority}
      className={`infaix-logo-img ${className}`}
    />
  );
}

export { LOGO_SRC };
