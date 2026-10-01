"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/auth-client";
import { TIME_RANGES, type TimeRange, type OperationsResponse } from "@/lib/operations-contract";

const sections = ["Overview", "Monitoring", "Applications", "Users", "AI", "Security", "Logs", "Deployments", "Database", "Settings"] as const;
type Section = typeof sections[number];

function Unavailable({ title, reason }: { title: string; reason: string }) {
  return <div className="ops-panel"><h3>{title}</h3><p className="ops-muted">Metric unavailable</p><p>{reason}</p></div>;
}

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
  if (!data) return <div className="ops-panel" role="status">
    {state.error ? <><h2>{state.status === 401 ? "Sign in to continue" : state.status === 403 ? "Operations access required" : "Operations unavailable"}</h2>
      <p>{state.error}</p><div className="hero-ctas"><Link className="btn-quiet" href="/login?returnTo=%2Fadmin">Sign in →</Link>
        <button type="button" className="btn-forge" onClick={() => refresh()}>Retry</button></div></> : "Loading operations…"}
  </div>;
  const { snapshot, range: windowLabel } = data;
  const count = (event: string) => snapshot.events.find((e) => e.event === event)?.count ?? 0;
  const total = snapshot.events.reduce((sum, e) => sum + e.count, 0);
  const activity = Array.from({ length: 24 }, (_, i) => snapshot.activity.find((b) => b.bucket === i)?.count ?? 0);
  const max = Math.max(1, ...activity);
  return <div className="ops-layout">
    <nav className="ops-nav" aria-label="Operations sections">{sections.map((name) => <button key={name} type="button" aria-current={section === name ? "page" : undefined} onClick={() => setSection(name)}>{name}</button>)}</nav>
    <div className="ops-content" aria-busy={pending}>
      {data.environment !== "production" && <p className="auth-success" role="status">Non-production environment: {data.environment}. Local review fixtures, when present, are development/demo data.</p>}
      <div className="ops-toolbar"><div><h2>{section}</h2><p className="ops-muted">{data.environment} · Snapshot {new Date(data.to).toLocaleString()}</p></div>
        <div className="ops-controls"><label>Time range <select value={range} onChange={(e) => refresh(e.target.value as TimeRange)}>{Object.keys(TIME_RANGES).map((r) => <option key={r}>{r}</option>)}</select></label>
          <button type="button" className="launcher-trigger" onClick={() => { if (!pending) refresh(); }} aria-disabled={pending}>Refresh</button></div>
      </div>
      {pending && <p role="status" className="ops-muted">Refreshing… showing the previous {windowLabel} snapshot.</p>}

      {section === "Overview" && <>
        <div className="ops-metrics">{[["Total users", snapshot.totalUsers, "All accounts"], ["New users", snapshot.recentUsers, `Created in ${windowLabel}`], ["Active sessions", snapshot.activeSessions, "Unexpired sessions for active accounts; not online users"], ["Audit events", total, `Recorded in ${windowLabel}`]].map(([label, value, hint]) => <div className="ops-panel" key={label}><h3>{label}</h3><div className="ops-number">{value}</div><p className="ops-muted">{hint}</p></div>)}</div>
        <div className="ops-panel"><h3>Application lifecycle</h3><p>{data.applications.filter((a) => a.status === "live").length} live · {data.applications.filter((a) => a.status !== "live").length} in development or planned</p><p className="ops-muted">Lifecycle is configured intent. Runtime health has not been measured.</p><button type="button" className="btn-quiet" onClick={() => setSection("Applications")}>View applications →</button></div>
      </>}

      {(section === "Overview" || section === "Monitoring") && <>
        <div className="ops-panel"><h3>Recorded audit activity</h3><p className="ops-muted">{total} events · {windowLabel} · Equal time intervals. Counts reflect stored records, not all requests.</p>
          {total === 0 ? <p>No audit events recorded in this window.</p> : <>
            <div className="ops-chart" aria-hidden="true">{activity.map((n, i) => <div key={i}><span>{n || ""}</span><i style={{ height: `${n / max * 100}%` }} /></div>)}</div>
            <details><summary>View activity as a table</summary><div className="admin-table-wrap"><table className="admin-table"><caption>Audit events by interval (local time)</caption><thead><tr><th scope="col">Interval starting</th><th scope="col">Events</th></tr></thead><tbody>{activity.map((n, i) => <tr key={i}><td>{new Date(data.from + i * data.bucketMs).toLocaleString()}</td><td>{n}</td></tr>)}</tbody></table></div></details>
          </>}
        </div>
        <div className="ops-metrics"><Unavailable title="Request volume & error rate" reason="Collection is not connected to this console. Worker logs are separate from the audit log." /><Unavailable title="Response latency" reason="Request timing is emitted to Worker logs. A historical query source is not configured." /></div>
      </>}

      {section === "Applications" && <div className="ops-panel"><p className="ops-muted">Canonical registry. No remote health probes are configured. Destinations are configuration, not evidence of availability.</p>
        <div className="admin-table-wrap"><table className="admin-table"><caption>INFAIX application registry</caption><thead><tr><th scope="col">Application</th><th scope="col">Lifecycle / visibility</th><th scope="col">Access</th><th scope="col">Runtime</th></tr></thead><tbody>{data.applications.map((app) => <tr key={app.id}><td><strong>{app.icon} {app.name}</strong><p>{app.description}</p><span className="ops-muted">{app.url ?? "No destination configured"}</span></td><td>{app.status}<br />{app.visibility}<br />{app.availability}</td><td>{app.accessRequirement ?? (app.requiresAuth ? "Sign-in required" : "Public")}</td><td>Health unknown<br />Version unavailable<br />Latency unavailable<br />Recent errors unavailable<br />Environment: {app.id === "core" ? data.environment : "unknown"}</td></tr>)}</tbody></table></div></div>}

      {section === "Users" && <div className="ops-panel"><h3>Core accounts</h3><p>{snapshot.totalUsers} total users. {snapshot.recentUsers} created in {windowLabel}.</p>{data.role === "OWNER" ? <><p className="ops-muted">The existing owner console lists up to 200 recent accounts and manages AI access.</p><Link className="btn-quiet" href="/account/admin/ai-access">Open user administration →</Link></> : <p className="ops-muted">Individual user records and access controls remain OWNER-only.</p>}</div>}

      {section === "AI" && <><div className="ops-metrics"><div className="ops-panel"><h3>Recorded AI requests</h3><div className="ops-number">{count("AI_REQUEST")}</div><p className="ops-muted">Audit records in {windowLabel}; not a billing or completion total.</p></div><div className="ops-panel"><h3>Recorded gateway failures</h3><div className="ops-number">{count("AI_GATEWAY_FAILURE")}</div></div></div><Unavailable title="Tokens, cost & model latency" reason="Collection not configured. Prompts and responses are not exposed in operations." />{data.role === "OWNER" && <Link className="btn-quiet" href="/account/admin/ai-access">Manage AI access →</Link>}</>}

      {section === "Security" && <div className="ops-panel"><h3>Authentication activity · {windowLabel}</h3><ul className="kv-list"><li><span>Recorded login successes</span><strong>{count("LOGIN_SUCCESS")}</strong></li><li><span>Recorded login failures</span><strong>{count("LOGIN_FAILURE")}</strong></li><li><span>Active sessions (now)</span><strong>{snapshot.activeSessions}</strong></li></ul><p className="ops-muted">Roles are enforced by the Worker. No session identifiers, IP addresses or audit details are returned by this console.</p></div>}

      {(section === "Logs" || section === "Overview") && <div className="ops-panel"><h3>Recent operational events</h3><p className="ops-muted">Latest 30 audit records within {windowLabel}. All timestamps shown in local time.</p>{snapshot.recentEvents.length ? <ul className="ops-events">{snapshot.recentEvents.map((e, i) => <li key={i}><span>{e.event.replaceAll("_", " ")}</span><time dateTime={new Date(e.created_at).toISOString()}>{new Date(e.created_at).toLocaleString()}</time></li>)}</ul> : <p>No audit events recorded in this window.</p>}{section === "Logs" && <p className="ops-muted">Request logs remain in Cloudflare Observability. Their query integration is not configured here.</p>}</div>}

      {section === "Deployments" && <Unavailable title="Deployment history" reason="A deployment metadata source is not configured. No release version or deployment health is inferred from the registry." />}
      {section === "Database" && <div className="ops-panel"><h3>Core identity storage</h3><p>This snapshot was read from Core&apos;s D1-backed identity and audit store.</p><p className="ops-muted">Database size, query latency and backup status are unavailable. This console does not execute SQL or modify schema.</p></div>}
      {section === "Settings" && <div className="ops-panel"><h3>Configuration</h3><p>Application lifecycle is managed through reviewed registry changes. Runtime configuration is managed by operators.</p><p className="ops-muted">No secret values or production configuration controls are exposed here.</p></div>}
    </div>
  </div>;
}
