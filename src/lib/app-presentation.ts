import { canLaunch, type AppStatus, type InfaixApp } from "./app-contract";
import { resolveIcon, type IconName } from "./icon-names";

/** Presentation helpers for registry entries. Display only; never access control. */
export type LaunchState = "open" | "restricted" | "closed";

export function launchState(app: InfaixApp): LaunchState {
  if (!canLaunch(app)) return "closed";
  return app.availability === "restricted" ? "restricted" : "open";
}

export function shortName(app: InfaixApp): string {
  return app.name.replace(/^INFAIX\s+/, "") || app.name;
}

/**
 * Resolves a registry `icon` value to a member of the drawn INFAIX family.
 * The registry stores a family name; anything unrecognised resolves to the
 * core mark rather than falling back to a glyph.
 */
export function iconName(app: InfaixApp): IconName {
  return resolveIcon(app.icon);
}

const STATUS_LABELS: Record<AppStatus, string> = {
  live: "Live",
  preview: "Preview",
  development: "In development",
  planned: "Planned",
  maintenance: "Maintenance",
};

export function statusLabel(status: AppStatus): string {
  return STATUS_LABELS[status];
}

export function accessLabel(app: InfaixApp): string {
  if (app.accessRequirement) return app.accessRequirement;
  return canLaunch(app) ? "Open" : "Not available yet";
}