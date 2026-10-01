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

function focusable(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")].filter(
    (node) => !node.closest("[hidden]") && node.getClientRects().length > 0,
  );
}

/**
 * Disclosure of ordinary links. `site` holds destinations that move into the
 * panel on compact layouts, where the header shows only the brand and trigger.
 * Opening the panel moves focus inside it; Escape closes and restores the trigger.
 */
export default function AppLauncher({ apps, site }: { apps: InfaixApp[]; site?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const rootEl = root.current;
    if (!rootEl) return;
    const items = focusable(rootEl);
    const firstInside = items.find((node) => node !== trigger.current);
    firstInside?.focus();
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function keys(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const nodes = focusable(rootEl!);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    rootEl.addEventListener("keydown", keys);
    return () => {
      document.removeEventListener("pointerdown", outside);
      rootEl.removeEventListener("keydown", keys);
    };
  }, [open]);
  return <div className="app-launcher" ref={root}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
    onKeyDown={(event) => { if (event.key === "Escape" && open) { event.preventDefault(); setOpen(false); trigger.current?.focus(); } }}>
    <button type="button" ref={trigger} className="launcher-trigger" aria-expanded={open} aria-controls="infaix-launcher" onClick={() => setOpen(!open)}>
      <LauncherGlyph />
      <span className="launcher-label-wide">Apps</span>
      <span className="launcher-label-compact">Menu</span>
    </button>
    <div id="infaix-launcher" className="launcher-panel" role="dialog" aria-modal="true" aria-label="INFAIX applications" hidden={!open} onClick={(event) => {
      if ((event.target as HTMLElement).closest("a")) setOpen(false);
    }}>
      <span className="launcher-corner" aria-hidden="true" />
      <span className="launcher-corner is-end" aria-hidden="true" />
      {site && <nav className="launcher-site" aria-label="Site">{site}</nav>}
      <div className="launcher-head">
        <div className="section-label">INFAIX / Applications</div>
        <p className="launcher-intro">One field. Independent applications.</p>
      </div>
      <AppDirectory apps={apps} />
    </div>
  </div>;
}
