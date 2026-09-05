"use client";

import Image from "next/image";
import { useState } from "react";

export const LOGO_SRC = "/infaix-logo.png";

/**
 * Canonical INFAIX logo image with delivery resilience.
 *
 * Primary path is always the official asset. If the first load fails
 * (stale edge, network blip), it retries once cache-busted; only if that
 * also fails does it render a branded text mark as a last resort so the
 * navbar/brand never collapses to an empty box.
 */
export default function LogoImage({
  width,
  height,
  alt,
  priority = false,
  className = "",
}: {
  width: number;
  height: number;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  const [phase, setPhase] = useState<"fresh" | "retry" | "fallback">("fresh");

  if (phase === "fallback") {
    return (
      <span
        className={`infaix-logo-fallback ${className}`}
        role="img"
        aria-label="INFAIX"
        style={{ fontSize: Math.round(height * 0.72) }}
      >
        ◆
      </span>
    );
  }

  return (
    <Image
      src={phase === "retry" ? `${LOGO_SRC}?retry=1` : LOGO_SRC}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      className={className}
      onError={() => setPhase(phase === "fresh" ? "retry" : "fallback")}
    />
  );
}
