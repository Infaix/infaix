/**
 * The INFAIX icon family's name set, separated from its drawing.
 *
 * Presentation logic in `lib` needs to know which marks exist (to resolve an
 * application id to a mark), but must not depend on a React component module.
 * This file holds the names and the safe resolver; `components/icons.tsx`
 * holds the geometry and imports the type from here.
 */

export const ICON_NAMES = [
  // Registry applications
  "core",
  "chat",
  "forge",
  "ai",
  "study",
  "atlas",
  "shop",
  // Capabilities
  "software",
  "robotics",
  "hardware",
  "infrastructure",
  // FORGE inventory
  "compute",
  "network",
  "fabrication",
  "bench",
  "pipeline",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

const KNOWN = new Set<string>(ICON_NAMES);

/**
 * Registry-safe resolution: an unknown, missing or malformed id falls back to
 * the Core mark rather than rendering nothing. Presentation only — it never
 * reads or writes access state.
 */
export function resolveIcon(name: string | undefined | null): IconName {
  return name && KNOWN.has(name) ? (name as IconName) : "core";
}
