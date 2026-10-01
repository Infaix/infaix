"use client";

import { useEffect, useRef, useState } from "react";
import type { InfaixApp } from "@/lib/app-contract";
import AppDirectory from "./app-directory";

export default function AppLauncher({ apps }: { apps: InfaixApp[] }) {
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
      <span aria-hidden="true">◇</span> APPS
    </button>
    <div id="infaix-launcher" className="launcher-panel" hidden={!open} onClick={(event) => {
      if ((event.target as HTMLElement).closest("a")) setOpen(false);
    }}>
      <div className="section-label">INFAIX / Applications</div>
      <p className="launcher-intro">Independent tools. One ecosystem.</p>
      <AppDirectory apps={apps} compact />
    </div>
  </div>;
}
