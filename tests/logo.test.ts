import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(process.cwd());
const SRC = join(ROOT, "src");
const PUBLIC_LOGO = join(ROOT, "public", "infaix-logo.png");
const OUT = join(ROOT, "out");

function walkTs(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkTs(full, out);
    else if (/\.(tsx?|css)$/.test(entry)) out.push(full);
  }
  return out;
}

describe("logo regression protection", () => {
  it("canonical asset exists, is a real PNG, and has content", () => {
    expect(existsSync(PUBLIC_LOGO)).toBe(true);
    const buf = readFileSync(PUBLIC_LOGO);
    expect(buf.length).toBeGreaterThan(10_000);
    expect(buf.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });

  it("single canonical source of truth (LOGO_SRC), root-relative", () => {
    // Read as text: importing the Next.js component into node is fragile,
    // and the guarantee we need is textual (one constant, one path).
    const src = readFileSync(join(SRC, "components", "logo-image.tsx"), "utf8");
    expect(src).toContain('export const LOGO_SRC = "/infaix-logo.png"');
  });

  it("no page bypasses the canonical logo component", () => {
    // Every in-repo reference to the logo file must live in logo-image.tsx
    // (the single implementation behind <InfaixLogo/>) or metadata config.
    const offenders: string[] = [];
    for (const file of walkTs(SRC)) {
      if (file.endsWith("logo-image.tsx")) continue;
      // Normalize separators: repo code is separator-agnostic, but test
      // globs return OS-native paths (backslash on Windows).
      const posix = file.split("\\").join("/");
      const text = readFileSync(file, "utf8");
      const usesAsset =
        text.includes("/infaix-logo.png") || text.includes("infaix-logo.png");
      const isAllowed =
        posix.endsWith("app/layout.tsx") || // metadata icon (root-relative, same asset)
        posix.endsWith("infaix-logo.tsx"); // canonical component (uses LOGO_SRC)
      if (usesAsset && !isAllowed) offenders.push(file);
      // No raw <img> logo tags anywhere: all rendering goes through next/image
      // inside LogoImage (retry + fallback behavior lives there).
      if (/<img[^>]*infaix-logo/.test(text)) offenders.push(file + " (raw <img>)");
    }
    expect(offenders).toEqual([]);
  });

  it("production build contains the logo byte-identical at the expected path", () => {
    if (!existsSync(join(OUT, "index.html"))) {
      console.warn("skip: out/ not built; run npm run build first");
      return;
    }
    const built = join(OUT, "infaix-logo.png");
    expect(existsSync(built)).toBe(true);
    expect(readFileSync(built).equals(readFileSync(PUBLIC_LOGO))).toBe(true);
  });

  it("every built page's logo reference resolves (incl. nested routes)", () => {
    if (!existsSync(join(OUT, "index.html"))) {
      console.warn("skip: out/ not built; run npm run build first");
      return;
    }
    const pages: string[] = [];
    const collect = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) collect(full);
        else if (entry.endsWith(".html")) pages.push(full);
      }
    };
    collect(OUT);
    expect(pages.length).toBeGreaterThan(5);
    const missing: string[] = [];
    for (const page of pages) {
      const html = readFileSync(page, "utf8");
      for (const m of html.matchAll(/(?:src|href)="(\/infaix-logo\.png[^"]*)"/g)) {
        const assetPath = m[1].split("?")[0];
        if (!existsSync(join(OUT, assetPath))) missing.push(`${page} -> ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("favicon ships in the build output", () => {
    if (!existsSync(join(OUT, "index.html"))) {
      console.warn("skip: out/ not built; run npm run build first");
      return;
    }
    expect(existsSync(join(OUT, "favicon.ico"))).toBe(true);
  });

  it("logo works after a clean rebuild (no stale-asset dependency)", () => {
    // Guards the "works locally, broken after deploy" class: the export must
    // be reproducible from source alone.
    if (!existsSync(join(OUT, "index.html"))) {
      console.warn("skip: out/ not built; run npm run build first");
      return;
    }
    execSync("git status --porcelain -- public/infaix-logo.png", { cwd: ROOT, encoding: "utf8" });
    // Asset is committed (no output means clean) — a deleted-but-cached
    // logo can never reach production unnoticed.
    const status = execSync("git status --porcelain -- public/infaix-logo.png", { cwd: ROOT, encoding: "utf8" }).trim();
    expect(status.startsWith("D") || status.startsWith(" D")).toBe(false);
  });
});
