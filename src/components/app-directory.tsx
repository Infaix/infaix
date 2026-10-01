import Link from "next/link";
import { canLaunch, type InfaixApp } from "@/lib/app-contract";

export default function AppDirectory({ apps, compact = false }: { apps: InfaixApp[]; compact?: boolean }) {
  return <ul className={compact ? "app-directory compact" : "app-directory"}>
    {apps.map((app) => {
      const content = <>
        <span className="app-glyph" aria-hidden="true">{app.icon}</span>
        <div className="app-copy"><div className="app-title"><h3>{app.name}</h3><span className="status-pill">{app.status}</span></div>
          <p>{app.description}</p>
          <span className="app-access">{app.accessRequirement ?? (canLaunch(app) ? "Explore application →" : "Not available yet")}</span>
        </div>
      </>;
      return <li key={app.id}>{canLaunch(app) && app.url
        ? <Link className="app-entry" href={app.url}>{content}</Link>
        : <div className="app-entry unavailable">{content}</div>}</li>;
    })}
  </ul>;
}
