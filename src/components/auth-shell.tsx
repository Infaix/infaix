import type { ReactNode } from "react";

/**
 * INFAIX-styled shell for authentication pages: technical label, title,
 * description, and a restrained panel. Reuses the site visual language
 * (no separate auth design).
 */
export default function AuthShell({
  label,
  title,
  desc,
  children,
}: {
  label: string;
  title: string;
  desc: string;
  children: ReactNode;
}) {
  return (
    <section className="page-hero" style={{ paddingBottom: 40 }}>
      <div className="container" style={{ maxWidth: 560 }}>
        <div className="section-label">{label}</div>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 52px)", letterSpacing: "0.04em" }}>{title}</h1>
        <p style={{ marginBottom: 28 }}>{desc}</p>
        <div className="ai-panel" style={{ minHeight: 0 }}>
          {children}
        </div>
      </div>
    </section>
  );
}
