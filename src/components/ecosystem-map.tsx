import Link from "next/link";
import type { InfaixApp } from "@/lib/app-contract";
import { accessLabel, launchState, shortName, statusLabel } from "@/lib/app-presentation";

/**
 * Core sits between two arms. Launchable applications are on the live arm;
 * entries that cannot be opened stay on the planned arm and are not links.
 * The split is presentation only — membership comes from the public registry.
 */
function AccessWithArrow({ label }: { label: string }) {
  const cut = label.lastIndexOf(" ");
  const head = cut < 0 ? "" : label.slice(0, cut + 1);
  const tail = cut < 0 ? label : label.slice(cut + 1);
  return <>{head}<span className="eco-access-end">{tail}<span className="eco-arrow" aria-hidden="true">→</span></span></>;
}

function Station({ app }: { app: InfaixApp }) {
  const state = launchState(app);
  const body = (
    <>
      <span className="eco-node" aria-hidden="true" />
      <span className="eco-glyph" aria-hidden="true">{app.icon}</span>
      <span className="eco-prefix">INFAIX</span>
      <h3>{shortName(app)}</h3>
      <span className="eco-state" data-state={state}>{statusLabel(app.status)}</span>
      <p>{app.description}</p>
      <span className="eco-access">
        {state === "closed" ? accessLabel(app) : <AccessWithArrow label={accessLabel(app)} />}
      </span>
    </>
  );
  return (
    <li className="eco-station" data-state={state}>
      {state !== "closed" && app.url
        ? <Link className="eco-station-body" href={app.url}>{body}</Link>
        : <div className="eco-station-body">{body}</div>}
    </li>
  );
}

export default function EcosystemMap({ apps }: { apps: InfaixApp[] }) {
  const core = apps.find((app) => app.id === "core");
  const stations = apps.filter((app) => app.id !== "core");
  const live = stations.filter((app) => launchState(app) !== "closed");
  const later = stations.filter((app) => launchState(app) === "closed");
  return (
    <div className="eco-map">
      <div className="eco-field">
        {core && (
          <div className="eco-hub">
            <span className="eco-hub-glyph" aria-hidden="true">{core.icon}</span>
            <div className="eco-hub-copy">
              <div className="eco-hub-meta">
                <span>{core.name}</span>
                <span className="eco-state" data-state={launchState(core)}>{statusLabel(core.status)}</span>
              </div>
              <h3>{core.description}</h3>
              <ul className="eco-hub-facts" aria-label="Provided by INFAIX Core">
                <li>Account</li>
                <li>Sessions</li>
                <li>Roles</li>
              </ul>
            </div>
            <Link className="eco-hub-link" href="/account">
              Your INFAIX account <span aria-hidden="true">→</span>
            </Link>
          </div>
        )}
        <ol className="eco-arm is-later" aria-label="Applications not yet available">
          {later.map((app) => <Station key={app.id} app={app} />)}
        </ol>
        <ol className="eco-arm is-live" aria-label="Applications you can open">
          {live.map((app) => <Station key={app.id} app={app} />)}
        </ol>
      </div>
      <div className="eco-legend" aria-hidden="true">
        <span><i className="solid" />Available</span>
        <span><i className="dashed" />Not yet available</span>
      </div>
    </div>
  );
}
