// AI entitlement: the single server-authoritative answer to "can this
// account use INFAIX AI?". Used by the Worker's /api/ai/* routes and
// documented for the InfaixAI backend's SessionValidator integration
// (which must call back to the authority rather than duplicate this).
// Rule: default deny. OWNER bypasses; ADMIN/USER require ai_access = 1;
// DISABLED (or missing) accounts are never entitled.
import type { Store } from "./store";

export async function canUseInfaixAI(store: Store, userId: string): Promise<boolean> {
  if (!userId) return false;
  const user = await store.getUserById(userId);
  if (!user || user.status !== "ACTIVE") return false;
  if (user.role === "OWNER") return true;
  return (user.ai_access ?? 0) === 1;
}
