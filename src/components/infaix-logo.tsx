import Image from "next/image";

type LogoVariant = "navbar" | "hero" | "footer" | "mark" | "hero-illuminated";

// Official asset is 202x505 (tall crystal). Sizes below preserve that
// aspect ratio exactly — never stretch or squash the mark.
const SIZES: Record<LogoVariant, { width: number; height: number }> = {
  navbar: { width: 14, height: 34 },
  hero: { width: 74, height: 186 },
  "hero-illuminated": { width: 74, height: 186 },
  footer: { width: 14, height: 34 },
  mark: { width: 10, height: 24 },
};

/**
 * Reusable INFAIX logo. Always uses the official asset
 * at /public/infaix-logo.png — never replaced or recolored.
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

  if (variant === "hero" || variant === "hero-illuminated") {
    return (
      <span className={`infaix-hero-mark ${className}`} role="presentation">
        <span className="infaix-hero-glow" />
        <svg className="infaix-hero-rings" viewBox="0 0 220 220" aria-hidden="true">
          <circle cx="110" cy="110" r="96" fill="none" stroke="rgba(145,70,255,0.22)" strokeWidth="1" strokeDasharray="3 7" />
          <circle cx="110" cy="110" r="78" fill="none" stroke="rgba(190,180,210,0.14)" strokeWidth="1" />
          <ellipse cx="110" cy="176" rx="62" ry="12" fill="none" stroke="rgba(145,70,255,0.28)" strokeWidth="1" />
          <ellipse cx="110" cy="176" rx="44" ry="8" fill="none" stroke="rgba(179,107,255,0.3)" strokeWidth="1" />
        </svg>
        <Image
          src="/infaix-logo.png"
          alt=""
          width={width}
          height={height}
          priority={priority}
          className="infaix-hero-img"
        />
      </span>
    );
  }

  return (
    <Image
      src="/infaix-logo.png"
      alt="INFAIX"
      width={width}
      height={height}
      priority={priority}
      className={`infaix-logo-img ${className}`}
    />
  );
}
