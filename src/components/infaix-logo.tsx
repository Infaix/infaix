import LogoImage, { LOGO_SRC } from "@/components/logo-image";

type LogoVariant = "navbar" | "hero" | "footer" | "mark" | "hero-illuminated" | "insignia" | "launcher";

// Official asset is 202x505 (tall crystal). Sizes below preserve that
// aspect ratio exactly — never stretch or squash the mark.
//
// `navbar` was 14x34, where the mark's internal facet structure collapses into
// an unreadable purple smudge. It is now 20x50: still a clear mark at header
// scale, and legible at the minimum standalone height the design system
// requires.
const SIZES: Record<LogoVariant, { width: number; height: number }> = {
  navbar: { width: 20, height: 50 },
  hero: { width: 74, height: 186 },
  "hero-illuminated": { width: 74, height: 186 },
  insignia: { width: 156, height: 390 },
  footer: { width: 22, height: 55 },
  mark: { width: 10, height: 24 },
  launcher: { width: 30, height: 75 },
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

  if (variant === "launcher") {
    // Compact insignia for the console panel: the mark with its ring orbit
    // only — no glow, so it stays quiet behind the application list.
    return (
      <span className="infaix-launcher-mark" role="presentation">
        <svg className="infaix-launcher-ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="46" fill="none" stroke="var(--periwinkle)" strokeOpacity="0.22" strokeWidth="1" strokeDasharray="3 6" />
          <circle cx="50" cy="50" r="36" fill="none" stroke="var(--crystal)" strokeOpacity="0.12" strokeWidth="1" />
        </svg>
        <LogoImage
          width={width}
          height={height}
          alt=""
          className="infaix-launcher-img"
        />
      </span>
    );
  }

  if (variant === "hero" || variant === "hero-illuminated" || variant === "insignia") {
    return (
      <span className={`infaix-hero-mark${variant === "insignia" ? " is-insignia" : ""} ${className}`} role="presentation">
        <span className="infaix-hero-glow" />
        <svg className="infaix-hero-rings" viewBox="0 0 220 220" aria-hidden="true">
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
