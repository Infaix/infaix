import type { InfaixApp } from "./app-contract";
import { publicApps } from "./app-contract";

/** Canonical lifecycle configuration; not a runtime health report.
 * Keep this module out of client components. Pass only publicApps() across RSC.
 * Releasing a product requires an explicit public + live + available decision.
 */
export const INFAIX_APPS: readonly InfaixApp[] = [
  { id: "core", name: "INFAIX Core", description: "One identity. Your entry point to INFAIX.", url: "/", icon: "◇", status: "live", visibility: "public", availability: "available", requiresAuth: false },
  { id: "chat", name: "INFAIX Chat", description: "Conversations connected by your INFAIX identity.", url: "https://chat.infaix.com", icon: "◈", status: "live", visibility: "public", availability: "available", requiresAuth: true },
  { id: "forge", name: "INFAIX Forge", description: "The infrastructure, projects and tools behind what we build.", url: "/forge", icon: "⬡", status: "live", visibility: "public", availability: "available", requiresAuth: false },
  { id: "ai", name: "INFAIX AI", description: "Explore AI through your INFAIX account.", url: "/ai", icon: "✧", status: "live", visibility: "public", availability: "restricted", requiresAuth: true, accessRequirement: "Sign-in and AI access required" },
  { id: "study", name: "INFAIX Study", description: "A future space for learning.", url: null, icon: "▤", status: "planned", visibility: "public", availability: "unavailable", requiresAuth: true },
  { id: "atlas", name: "INFAIX Atlas", description: "A future part of the INFAIX ecosystem.", url: null, icon: "◎", status: "planned", visibility: "public", availability: "unavailable", requiresAuth: true },
  { id: "shop", name: "INFAIX Shop", description: "A future destination for INFAIX products.", url: null, icon: "▱", status: "planned", visibility: "public", availability: "unavailable", requiresAuth: false },
];

export const getPublicApps = () => publicApps(INFAIX_APPS);
