"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { InfaixApp } from "@/lib/app-contract";
import AppDirectory from "./app-directory";

function LauncherGlyph() {
  return (
    <svg className="launcher-glyph" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2.5 13.5 8 8 13.5 2.5 8Z" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M8 2.5V8M2.5 8H8M8 8l5.5 0M8 8v5.5" stroke="currentColor" strokeWidth="1" opacity="0.45" />
      <circle cx="8" cy="8" r="1.6" fill="currentColor" />
    </svg>
  );
}

/**
 * Disclosure of ordinary links. `site` holds destinations that move into the
 * panel on compact layouts, where the header shows only the brand and trigger.
 */
export default function AppLauncher({ apps, site }: { apps: InfaixApp[]; site?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return <div className="app-launcher" ref={root}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
    onKeyDown={(event) => { if (event.key === "Escape" && open) { event.preventDefault(); setOpen(false); trigger.current?.focus(); } }}>
    <button type="button" ref={trigger} className="launcher-trigger" aria-expanded={open} aria-controls="infaix-launcher" onClick={() => setOpen(!open)}>
      <LauncherGlyph />
      <span className="launcher-label-wide">Apps</span>
      <span className="launcher-label-compact">Menu</span>
    </button>
    <div id="infaix-launcher" className="launcher-panel" hidden={!open} onClick={(event) => {
      if ((event.target as HTMLElement).closest("a")) setOpen(false);
    }}>
      {site && <nav className="launcher-site" aria-label="Site">{site}</nav>}
      <div className="launcher-head">
        <div className="section-label">INFAIX / Applications</div>
        <p className="launcher-intro">Independent tools. One ecosystem.</p>
      </div>
      <AppDirectory apps={apps} />
    </div>
  </div>;
}
