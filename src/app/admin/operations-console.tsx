"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/auth-client";
import InfaixIcon from "@/components/icons";
import { resolveIcon } from "@/lib/icon-names";
import { TIME_RANGES, type TimeRange, type OperationsResponse } from "@/lib/operations-contract";

type Section = "Overview" | "Monitoring" | "Applications" | "Users" | "AI" | "Security" | "Logs" | "Deployments" | "Database" | "Settings";
const groups: { label: string; items: Section[] }[] = [
  { label: "Observe", items: ["Overview", "Monitoring", "Logs"] },
  { label: "Platform", items: ["Applications", "Users", "AI", "Security"] },
  { label: "Infrastructure", items: ["Deployments", "Database", "Settings"] },
];

function Chip({ tone = "neutral", children }: { tone?: "live" | "active" | "neutral" | "unavailable"; children: React.ReactNode }) {
  return <span className="ops-chip" data-tone={tone}>{children}</span>;
}

function Unavailable({ title, reason }: { title: string; reason: string }) {
  return <div className="ops-panel is-unavailable">
    <div className="ops-panel-head"><h3>{title}</h3><Chip tone="unavailable">Metric unavailable</Chip></div>
    <p>{reason}</p>
  </div>;
}

const statusTone = (status: string) => (status === "live" ? "live" : status === "development" || status === "preview" ? "active" : "neutral");
const time = (ms: number) => new Date(ms).toLocaleString();
const shortTime = (ms: number, rangeMs: number) => new Date(ms).toLocaleString(undefined, rangeMs >= 86400000
  ? { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
  : { hour: "2-digit", minute: "2-digit" });

export default function OperationsConsole() {
  const [section, setSection] = useState<Section>("Overview");
  const [range, setRange] = useState<TimeRange>("24H");
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState(true);
  const [state, setState] = useState<{ data?: OperationsResponse; error?: string; status?: number }>({});
  useEffect(() => {
    let current = true;
    api<OperationsResponse>(`/api/admin/operations?range=${range}`).then((result) => {
      if (current) {
        setState(result.ok && result.data ? { data: result.data } : { error: result.message ?? "Could not load operations.", status: result.status });
        setPending(false);
      }
    });
    return () => { current = false; };
  }, [range, revision]);
  function refresh(next: TimeRange = range) {
    setPending(true); setRange(next); setRevision((r) => r + 1);
  }
  const data = state.data;
  if (!data) return <div className="ops-state" role="status">
    {state.error ? <>
      <span className="ops-state-mark" aria-hidden="true"><InfaixIcon name="core" size={34} /></span>
      <h2>{state.status === 401 ? "Sign in to continue" : state.status === 403 ? "Operations access required" : "Operations unavailable"}</h2>
      <p>{state.error}</p>
      <div className="ops-state-actions">
        <Link className="btn-forge" href="/login?returnTo=%2Fadmin">Sign in <span aria-hidden="true">→</span></Link>
        <button type="button" className="ops-button" onClick={() => refresh()}>Retry</button>
      </div>
    </> : <><span className="ops-state-mark is-loading" aria-hidden="true"><InfaixIcon name="core" size={34} /></span><p>Loading operations…</p></>}
  </div>;

  const { snapshot, range: windowLabel } = data;
  const count = (event: string) => snapshot.events.find((e) => e.event === event)?.count ?? 0;
  const total = snapshot.events.reduce((sum, e) => sum + e.count, 0);
  const activity = Array.from({ length: 24 }, (_, i) => snapshot.activity.find((b) => b.bucket === i)?.count ?? 0);
  const max = Math.max(1, ...activity);
  const rangeMs = TIME_RANGES[windowLabel];
  const live = data.applications.filter((a) => a.status === "live").length;

  const activityPanel = <div className="ops-panel ops-span-2">
    <div className="ops-panel-head"><h3>Recorded audit activity</h3><span className="ops-muted">{total} events · {windowLabel}</span></div>
    <p className="ops-muted">Equal time intervals. Counts reflect stored records, not all requests.</p>
    {total === 0 ? <p className="ops-empty">No audit events recorded in this window.</p> : <>
      <figure className="ops-chart-figure" aria-hidden="true">
        <div className="ops-chart-frame">
          <div className="ops-chart-y"><span>{max}</span><span>0</span></div>
          <div className="ops-chart">{activity.map((n, i) => <div key={i} data-count={`${n} · ${shortTime(data.from + i * data.bucketMs, rangeMs)}`} className={n ? undefined : "is-zero"}><i style={{ height: n ? `${n / max * 100}%` : undefined }} /></div>)}</div>
        </div>
        <div className="ops-chart-x"><span>{shortTime(data.from, rangeMs)}</span><span>{shortTime(data.to, rangeMs)}</span></div>
      </figure>
      <details><summary>View activity as a table</summary><div className="admin-table-wrap"><table className="admin-table"><caption>Audit events by interval (local time)</caption><thead><tr><th scope="col">Interval starting</th><th scope="col">Events</th></tr></thead><tbody>{activity.map((n, i) => <tr key={i}><td>{time(data.from + i * data.bucketMs)}</td><td className="ops-num">{n}</td></tr>)}</tbody></table></div></details>
    </>}
  </div>;

  const eventsPanel = <div className="ops-panel">
    <div className="ops-panel-head"><h3>Recent operational events</h3><span className="ops-muted">Latest 30 · {windowLabel}</span></div>
    <p className="ops-muted">Latest 30 audit records within {windowLabel}. All timestamps shown in local time.</p>
    {snapshot.recentEvents.length ? <ol className="ops-events">{snapshot.recentEvents.map((e, i) => <li key={i}><span className="ops-event-name">{e.event.replaceAll("_", " ")}</span><time dateTime={new Date(e.created_at).toISOString()}>{time(e.created_at)}</time></li>)}</ol> : <p className="ops-empty">No audit events recorded in this window.</p>}
    {section === "Logs" && <p className="ops-muted">Request logs remain in Cloudflare Observability. Their query integration is not configured here.</p>}
  </div>;

  const requestUnavailable = <div className="ops-grid">
    <Unavailable title="Request volume & error rate" reason="Collection is not connected to this console. Worker logs are separate from the audit log." />
    <Unavailable title="Response latency" reason="Request timing is emitted to Worker logs. A historical query source is not configured." />
  </div>;

  return <div className="ops-layout">
    <nav className="ops-nav" aria-label="Operations sections">
      {groups.map((group) => <div key={group.label} className="ops-nav-group">
        <div className="ops-nav-label">{group.label}</div>
        {group.items.map((name) => <button key={name} type="button" aria-current={section === name ? "page" : undefined} onClick={() => setSection(name)}>{name}</button>)}
      </div>)}
    </nav>
    <div className="ops-content" aria-busy={pending}>
      <div className="ops-bar">
        <div className="ops-bar-meta">
          <Chip tone={data.environment === "production" ? "neutral" : "active"}>{data.environment}</Chip>
          <Chip>{data.role}</Chip>
          <span className="ops-muted">Snapshot {time(data.to)}</span>
        </div>
        <div className="ops-controls">
          <div className="ops-range" role="group" aria-label="Time range">
            {(Object.keys(TIME_RANGES) as TimeRange[]).map((r) => <button key={r} type="button" aria-pressed={range === r} onClick={() => { if (r !== range) refresh(r); }}>{r}</button>)}
          </div>
          <button type="button" className="ops-button" onClick={() => { if (!pending) refresh(); }} aria-disabled={pending}>Refresh</button>
        </div>
      </div>
      {data.environment !== "production" && <p className="ops-notice" role="status">Non-production environment: {data.environment}. Local review fixtures, when present, are development/demo data.</p>}
      <div className="ops-title"><h2>{section}</h2>{pending && <p role="status" className="ops-muted">Refreshing… showing the previous {windowLabel} snapshot.</p>}</div>

      {section === "Overview" && <>
        <dl className="ops-kpis">{([["Total users", snapshot.totalUsers, "All accounts"], ["New users", snapshot.recentUsers, `Created in ${windowLabel}`], ["Active sessions", snapshot.activeSessions, "Unexpired sessions for active accounts; not online users"], ["Audit events", total, `Recorded in ${windowLabel}`]] as const).map(([label, value, hint]) => <div key={label}><dt>{label}</dt><dd className="ops-number">{value}</dd><dd className="ops-hint">{hint}</dd></div>)}</dl>
        <div className="ops-grid">
          {activityPanel}
          <div className="ops-panel">
            <div className="ops-panel-head"><h3>Application lifecycle</h3><Chip tone="unavailable">Health unknown</Chip></div>
            <p><span className="ops-inline-number">{live}</span> live · <span className="ops-inline-number">{data.applications.length - live}</span> in development or planned</p>
            <ul className="ops-app-strip">{data.applications.map((app) => <li key={app.id} data-tone={statusTone(app.status)}><span aria-hidden="true"><InfaixIcon name={resolveIcon(app.icon)} size={15} /></span>{app.name.replace(/^INFAIX\s+/, "")}<span className="sr-only">: {app.status}</span></li>)}</ul>
            <p className="ops-muted">Lifecycle is configured intent. Runtime health has not been measured.</p>
            <button type="button" className="btn-quiet" onClick={() => setSection("Applications")}>View applications <span aria-hidden="true">→</span></button>
          </div>
          {eventsPanel}
        </div>
        {requestUnavailable}
      </>}

      {section === "Monitoring" && <><div className="ops-grid">{activityPanel}</div>{requestUnavailable}</>}

      {section === "Applications" && <div className="ops-panel"><p className="ops-muted">Canonical registry. No remote health probes are configured. Destinations are configuration, not evidence of availability.</p>
        <div className="admin-table-wrap"><table className="admin-table ops-table"><caption>INFAIX application registry</caption><thead><tr><th scope="col">Application</th><th scope="col">Lifecycle / visibility</th><th scope="col">Access</th><th scope="col">Runtime</th></tr></thead><tbody>{data.applications.map((app) => <tr key={app.id}>
          <td><strong className="ops-app-name"><span aria-hidden="true"><InfaixIcon name={resolveIcon(app.icon)} size={16} /></span> {app.name}</strong><p>{app.description}</p><code className="ops-dest">{app.url ?? "No destination configured"}</code></td>
          <td><div className="ops-chips"><Chip tone={statusTone(app.status)}>{app.status}</Chip><Chip>{app.visibility}</Chip><Chip>{app.availability}</Chip></div></td>
          <td>{app.accessRequirement ?? (app.requiresAuth ? "Sign-in required" : "Public")}</td>
          <td><ul className="ops-runtime"><li>Health unknown</li><li>Version unavailable</li><li>Latency unavailable</li><li>Recent errors unavailable</li><li className="is-known">Environment: {app.id === "core" ? data.environment : "unknown"}</li></ul></td>
        </tr>)}</tbody></table></div></div>}

      {section === "Users" && <div className="ops-panel"><h3>Core accounts</h3><p><span className="ops-inline-number">{snapshot.totalUsers}</span> total users. <span className="ops-inline-number">{snapshot.recentUsers}</span> created in {windowLabel}.</p>{data.role === "OWNER" ? <><p className="ops-muted">The existing owner console lists up to 200 recent accounts and manages AI access.</p><Link className="btn-quiet" href="/account/admin/ai-access">Open user administration <span aria-hidden="true">→</span></Link></> : <p className="ops-muted">Individual user records and access controls remain OWNER-only.</p>}</div>}

      {section === "AI" && <><dl className="ops-kpis is-pair"><div><dt>Recorded AI requests</dt><dd className="ops-number">{count("AI_REQUEST")}</dd><dd className="ops-hint">Audit records in {windowLabel}; not a billing or completion total.</dd></div><div><dt>Recorded gateway failures</dt><dd className="ops-number">{count("AI_GATEWAY_FAILURE")}</dd><dd className="ops-hint">Audit records in {windowLabel}</dd></div></dl><Unavailable title="Tokens, cost & model latency" reason="Collection not configured. Prompts and responses are not exposed in operations." />{data.role === "OWNER" && <Link className="btn-quiet" href="/account/admin/ai-access">Manage AI access <span aria-hidden="true">→</span></Link>}</>}

      {section === "Security" && <div className="ops-panel"><h3>Authentication activity · {windowLabel}</h3><ul className="kv-list ops-kv"><li><span>Recorded login successes</span><strong>{count("LOGIN_SUCCESS")}</strong></li><li><span>Recorded login failures</span><strong>{count("LOGIN_FAILURE")}</strong></li><li><span>Active sessions (now)</span><strong>{snapshot.activeSessions}</strong></li></ul><p className="ops-muted">Roles are enforced by the Worker. No session identifiers, IP addresses or audit details are returned by this console.</p></div>}

      {section === "Logs" && eventsPanel}

      {section === "Deployments" && <Unavailable title="Deployment history" reason="A deployment metadata source is not configured. No release version or deployment health is inferred from the registry." />}
      {section === "Database" && <div className="ops-panel"><h3>Core identity storage</h3><p>This snapshot was read from Core&apos;s D1-backed identity and audit store.</p><p className="ops-muted">Database size, query latency and backup status are unavailable. This console does not execute SQL or modify schema.</p></div>}
      {section === "Settings" && <div className="ops-panel"><h3>Configuration</h3><p>Application lifecycle is managed through reviewed registry changes. Runtime configuration is managed by operators.</p><p className="ops-muted">No secret values or production configuration controls are exposed here.</p></div>}
    </div>
  </div>;
}
