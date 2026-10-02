import Link from "next/link";
import type { InfaixApp } from "@/lib/app-contract";
import { accessLabel, iconName, launchState, shortName, statusLabel } from "@/lib/app-presentation";
import InfaixIcon from "@/components/icons";

/**
 * Core sits between two arms inside a bounded field.
 *
 * The geometry is a real diagram, not a list with gaps: two orbit ellipses
 * enclose the hub, a solid spine runs from the hub to every launchable
 * application, and a dashed spine runs to every application that cannot be
 * opened. Hovering or focusing a station illuminates its own spine and dims the
 * rest, so the field reads as one system responding to a point of interest.
 *
 * Presentation only — arm membership and launch state come from the public
 * registry projection. The SVG is decorative and hidden from assistive tech;
 * the lists and links carry the same information semantically.
 */
function AccessWithArrow({ label }: { label: string }) {
  const cut = label.lastIndexOf(" ");
  const head = cut < 0 ? "" : label.slice(0, cut + 1);
  const tail = cut < 0 ? label : label.slice(cut + 1);
  return (
    <>
      {head}
      <span className="eco-access-end">
        {tail}
        <span className="eco-arrow" aria-hidden="true">→</span>
      </span>
    </>
  );
}

function Station({ app }: { app: InfaixApp }) {
  const state = launchState(app);
  const body = (
    <>
      <span className="eco-station-icon">
        <InfaixIcon name={iconName(app)} size={22} />
      </span>
      <span className="eco-station-copy">
        <span className="eco-station-head">
          <span className="eco-prefix">INFAIX</span>
          <span className="eco-state" data-state={state}>{statusLabel(app.status)}</span>
        </span>
        <h3>{shortName(app)}</h3>
        <p>{app.description}</p>
        <span className="eco-access">
          {state === "closed" ? accessLabel(app) : <AccessWithArrow label={accessLabel(app)} />}
        </span>
      </span>
    </>
  );
  return (
    <li className="eco-station" data-state={state}>
      <span className="eco-spine" aria-hidden="true" />
      <span className="eco-node" aria-hidden="true" />
      {state !== "closed" && app.url ? (
        <Link className="eco-station-body" href={app.url}>{body}</Link>
      ) : (
        <div className="eco-station-body">{body}</div>
      )}
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
      {/* Field geometry: two orbits around the hub, and the two arm spines. */}
      <svg className="eco-geometry" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="ecoSpineLive" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--crystal)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--purple)" stopOpacity="0.14" />
          </linearGradient>
        </defs>
        <ellipse className="eco-orbit is-outer" cx="500" cy="310" rx="470" ry="286" />
        <ellipse className="eco-orbit is-inner" cx="500" cy="310" rx="330" ry="196" />
        <path className="eco-bus" d="M60 310 H440" />
        <path className="eco-bus is-live" d="M560 310 H940" />
      </svg>

      <div className="eco-field">
        {core && (
          <div className="eco-hub">
            <span className="eco-hub-rail" aria-hidden="true" />
            <span className="eco-hub-icon">
              <InfaixIcon name={iconName(core)} size={30} />
            </span>
            <span className="eco-hub-copy">
              <span className="eco-hub-meta">
                <span>{core.name}</span>
                <span className="eco-state" data-state={launchState(core)}>{statusLabel(core.status)}</span>
              </span>
              <h3>{core.description}</h3>
            </span>
            <ul className="eco-hub-facts" aria-label="Provided by INFAIX Core">
              <li>Account</li>
              <li>Sessions</li>
              <li>Roles</li>
            </ul>
            <Link className="eco-hub-link" href="/account">
              Your INFAIX account <span aria-hidden="true">→</span>
            </Link>
          </div>
        )}

        <div className="eco-arm is-later">
          <div className="eco-arm-label"><span className="eco-arm-node" aria-hidden="true" />Not yet available</div>
          <ol aria-label="Applications not yet available">
            {later.map((app) => <Station key={app.id} app={app} />)}
          </ol>
        </div>

        <div className="eco-arm is-live">
          <div className="eco-arm-label"><span className="eco-arm-node" aria-hidden="true" />Available now</div>
          <ol aria-label="Applications you can open">
            {live.map((app) => <Station key={app.id} app={app} />)}
          </ol>
        </div>
      </div>

      <div className="eco-legend" aria-hidden="true">
        <span><i className="solid" />Available</span>
        <span><i className="dashed" />Not yet available</span>
      </div>
    </div>
  );
}