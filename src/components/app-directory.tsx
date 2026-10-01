import Link from "next/link";
import type { InfaixApp } from "@/lib/app-contract";
import { accessLabel, launchState, shortName, statusLabel } from "@/lib/app-presentation";

function Entry({ app }: { app: InfaixApp }) {
  const state = launchState(app);
  const content = <>
    <span className="app-node" aria-hidden="true" />
    <span className="app-glyph" aria-hidden="true">{app.icon}</span>
    <span className="app-copy">
      <span className="app-title"><span className="app-name"><span className="sr-only">INFAIX </span>{shortName(app)}</span><span className="eco-state" data-state={state}>{statusLabel(app.status)}</span></span>
      <span className="app-desc">{app.description}</span>
      {state !== "open" && <span className="app-access">{accessLabel(app)}</span>}
    </span>
  </>;
  return <li data-state={state}>{state !== "closed" && app.url
    ? <Link className="app-entry" href={app.url}>{content}</Link>
    : <div className="app-entry">{content}</div>}</li>;
}

/** Launcher list: ordinary links for launchable entries, static rows otherwise. */
export default function AppDirectory({ apps }: { apps: InfaixApp[] }) {
  const available = apps.filter((app) => launchState(app) !== "closed");
  const later = apps.filter((app) => launchState(app) === "closed");
  return <div className="app-directory">
    {available.length > 0 && <div className="app-group-block" role="group" aria-labelledby="launcher-available">
      <h3 id="launcher-available" className="app-group">Available</h3>
      <ul>{available.map((app) => <Entry key={app.id} app={app} />)}</ul>
    </div>}
    {later.length > 0 && <div className="app-group-block is-later" role="group" aria-labelledby="launcher-later">
      <h3 id="launcher-later" className="app-group">Not yet available</h3>
      <ul>{later.map((app) => <Entry key={app.id} app={app} />)}</ul>
    </div>}
  </div>;
}
