// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import RegisterForm from "../src/app/register/form";
import AccountDashboard from "../src/app/account/dashboard";

const navigation = vi.hoisted(() => ({ router: { push: vi.fn(), refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => navigation.router }));
const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => { vi.unstubAllGlobals(); document.body.replaceChildren(); });

const user = { id: "usr_fixture", email: "fixture@example.invalid", display_name: "Fixture", role: "USER", status: "ACTIVE", email_verified: true, ai_access: false, created_at: 1, last_login_at: null };

async function mounted(Component: typeof AccountDashboard | typeof RegisterForm) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => { root.render(createElement(Component)); });
  return { container, close: () => act(async () => { root.unmount(); }) };
}

describe("Phase 0 consent and newsletter UI", () => {
  it("policy links leave acceptance unchanged and the checkbox remains explicitly focusable", async () => {
    const page = await mounted(RegisterForm);
    try {
      const checkbox = page.container.querySelector<HTMLInputElement>("#reg-terms")!;
      expect(checkbox.checked).toBe(false);
      expect(checkbox.disabled).toBe(false);
      expect(checkbox.tabIndex).toBe(0);
      checkbox.focus();
      expect(document.activeElement).toBe(checkbox);
      for (const path of ["/legal/terms", "/legal/privacy"]) {
        const link = page.container.querySelector<HTMLAnchorElement>(`a[href="${path}"]`)!;
        expect(link.closest("label")).toBeNull();
        await act(async () => { link.click(); });
        expect(checkbox.checked).toBe(false);
      }
      await act(async () => { checkbox.click(); });
      expect(checkbox.checked).toBe(true);
    } finally { await page.close(); }
  });

  it("failed preference load shows unavailable, cannot withdraw, and can retry a subscribed state", async () => {
    let fail = true;
    const mutations: string[] = [];
    vi.stubGlobal("fetch", async (path: string, init: RequestInit) => {
      if (init.method === "POST") mutations.push(path);
      if (path === "/api/auth/me") return Response.json({ user });
      return fail ? Response.json({ error: { code: "UNAVAILABLE" } }, { status: 503 }) : Response.json({ status: "SUBSCRIBED" });
    });
    const page = await mounted(AccountDashboard);
    try {
      expect(page.container.textContent).toContain("Email preferences could not be loaded.");
      expect(page.container.textContent).not.toContain("Not subscribed");
      expect(page.container.textContent).not.toContain("Stop product news");
      fail = false;
      const retry = [...page.container.querySelectorAll("button")].find((b) => b.textContent === "Try again")!;
      await act(async () => { retry.click(); });
      expect(page.container.textContent).toContain("Current newsletter status: Subscribed");
      expect(page.container.textContent).toContain("Stop product news");
      expect(mutations).toEqual([]);
    } finally { await page.close(); }
  });

  it("a malformed successful preference response stays unknown rather than implying no subscription", async () => {
    vi.stubGlobal("fetch", async (path: string) => Response.json(path === "/api/auth/me" ? { user } : {}));
    const page = await mounted(AccountDashboard);
    try {
      expect(page.container.textContent).toContain("Email preferences could not be loaded.");
      expect(page.container.textContent).not.toContain("Not subscribed");
    } finally { await page.close(); }
  });
});
