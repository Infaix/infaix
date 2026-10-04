// @vitest-environment happy-dom
import { act, createElement, StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import Verifier from "../src/app/verify-email/verifier";
import { handleRegister, handleVerifyEmail } from "../worker/auth/handlers";
import { makeWorld, ORIGIN, post } from "./helpers";

const location = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(location.search) }));

const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => { vi.unstubAllGlobals(); document.body.replaceChildren(); });

describe("verification in a real React Strict Mode component", () => {
  it("redeems once on effect replay, keeps first success, and rechecks on a later visit", async () => {
    const w = makeWorld();
    // Happy DOM removes browser-forbidden Origin headers from constructors.
    // At this transport boundary restore the header a real browser sends.
    const serverRequest = (path: string, payload: unknown) => {
      const request = post(path, payload);
      request.headers.set("origin", ORIGIN);
      return request;
    };
    const registration = await handleRegister(w.ctx, serverRequest("/api/auth/register", { email: "fixture@example.invalid", displayName: "Fixture", password: "Correct-Horse-99-Battery" }));
    expect(registration.status).toBe(201);
    const token = (await w.store.latestOutbox("fixture@example.invalid", "email_verification"))!.link_token;
    location.search = `token=${token}`;
    let requests = 0;
    let effectRuns = 0;
    let responseTask: Promise<Response>;
    function ReplayProbe() { useEffect(() => { effectRuns++; }, []); return null; }
    vi.stubGlobal("fetch", (path: string, init: RequestInit) => {
      expect(path).toBe("/api/auth/verify-email");
      requests++;
      const payload = JSON.parse(String(init.body));
      responseTask = handleVerifyEmail(w.ctx, serverRequest(path, payload)).then((result) => Response.json(result.body, { status: result.status, headers: result.headers }));
      return responseTask;
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => {
        root.render(createElement(StrictMode, null, createElement(ReplayProbe), createElement(Verifier)));
      });
      await act(async () => { await responseTask; });
      expect(effectRuns).toBe(2); // Proves this harness actually replayed effects.
      expect(requests).toBe(1);
      expect(container.textContent).toContain("Your email is confirmed.");
      expect(container.textContent).not.toContain("already verified");
      await act(async () => { root.render(null); });
      await act(async () => { root.render(createElement(StrictMode, null, createElement(Verifier))); });
      await act(async () => { await responseTask; });
      expect(requests).toBe(2);
      expect(container.textContent).toContain("This account is already verified.");
      expect(w.store.sessions.size).toBe(0);
    } finally { await act(async () => { root.unmount(); }); }
  });
});
