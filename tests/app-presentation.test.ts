import { describe, expect, it } from "vitest";
import { INFAIX_APPS, getPublicApps } from "../src/lib/app-registry";
import { canLaunch } from "../src/lib/app-contract";
import { accessLabel, launchState, shortName, statusLabel } from "../src/lib/app-presentation";

describe("registry presentation helpers", () => {
  it("only presents launchable entries as open or restricted", () => {
    for (const app of INFAIX_APPS) expect(launchState(app) === "closed").toBe(!canLaunch(app));
    for (const app of getPublicApps()) if (!app.url) expect(launchState(app)).toBe("closed");
  });
  it("keeps private Chat closed even if it were live", () => {
    const chat = INFAIX_APPS.find((a) => a.id === "chat")!;
    expect(launchState(chat)).toBe("closed");
    expect(launchState({ ...chat, status: "live" })).toBe("closed");
  });
  it("marks restricted availability without granting access", () => {
    const ai = INFAIX_APPS.find((a) => a.id === "ai")!;
    expect(launchState({ ...ai, availability: "restricted" })).toBe("restricted");
    expect(launchState({ ...ai, availability: "restricted", status: "planned" })).toBe("closed");
  });
  it("labels entries without inventing state", () => {
    expect(shortName(INFAIX_APPS[0])).toBe("Core");
    expect(statusLabel("development")).toBe("In development");
    const planned = getPublicApps().find((a) => a.status === "planned")!;
    expect(accessLabel(planned)).toBe(planned.accessRequirement ?? "Not available yet");
  });
});
