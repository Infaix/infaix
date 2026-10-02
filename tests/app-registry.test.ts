import { describe, expect, it } from "vitest";
import { INFAIX_APPS, getPublicApps } from "../src/lib/app-registry";
import { canLaunch, publicApps, type AppStatus } from "../src/lib/app-contract";
import worker from "../worker/index";
import { makeWorld } from "./helpers";

describe("canonical application discovery", () => {
  it("has unique IDs, safe destinations and the expected ecosystem", () => {
    expect(new Set(INFAIX_APPS.map((a) => a.id)).size).toBe(INFAIX_APPS.length);
    expect(INFAIX_APPS.map((a) => a.id)).toEqual(["core", "chat", "forge", "ai", "study", "atlas", "shop"]);
    for (const app of INFAIX_APPS) if (app.url) expect(app.url).toMatch(/^(\/(?!\/)|https:\/\/)/);
  });
  it("publishes Chat at the public hostname", () => {
    const chat = INFAIX_APPS.find((a) => a.id === "chat")!;
    expect(chat.url).toBe("https://chat.infaix.com");
    expect(canLaunch(chat)).toBe(true);
    expect(getPublicApps().find((a) => a.id === "chat")?.url).toBe("https://chat.infaix.com");
  });
  it.each<AppStatus>(["preview", "development", "planned", "maintenance"])("never launches a public %s product or exports its URL", (status) => {
    const app = { ...INFAIX_APPS[0], status };
    expect(canLaunch(app)).toBe(false);
    expect(publicApps([app])[0].url).toBeNull();
  });
  it("does not launch an unavailable live app", () => {
    expect(canLaunch({ ...INFAIX_APPS[0], availability: "unavailable" })).toBe(false);
  });
  it("serves a versioned public contract without identity storage", async () => {
    const res = await worker.fetch(new Request("https://infaix.com/api/apps"), makeWorld().ctx.env, { waitUntil() {} });
    expect(res.status).toBe(200);
    const body = await res.json() as { version: number; applications: unknown[] };
    expect(body.version).toBe(1);
    expect(body.applications).toEqual(getPublicApps());
    expect(JSON.stringify(body)).toContain("https://chat.infaix.com");
  });
});
