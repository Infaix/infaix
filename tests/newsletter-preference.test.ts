import { describe, expect, it } from "vitest";
import { settlePreference } from "../src/lib/newsletter-preference";

describe("newsletter preference load", () => {
  it("does not treat a failed load as unsubscribed", () => {
    expect(settlePreference({ state: "loading" }, false, null)).toEqual({ state: "unavailable" });
  });

  it("keeps the last loaded status when a refresh fails", () => {
    const ready = { state: "ready" as const, status: "SUBSCRIBED" as const };
    expect(settlePreference(ready, false, null)).toEqual(ready);
  });

  it("replaces the view when a load succeeds", () => {
    expect(settlePreference({ state: "unavailable" }, true, null)).toEqual({ state: "ready", status: null });
    expect(settlePreference({ state: "loading" }, true, "PENDING_CONFIRMATION")).toEqual({
      state: "ready",
      status: "PENDING_CONFIRMATION",
    });
  });
});
