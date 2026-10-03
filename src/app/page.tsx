import Link from "next/link";
import ScrollReveal from "@/components/ScrollReveal";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import InfaixLogo from "@/components/infaix-logo";
import EcosystemMap from "@/components/ecosystem-map";
import InfaixIcon, { type IconName } from "@/components/icons";
import NewsletterForm from "@/components/newsletter-form";
import { getPublicApps } from "@/lib/app-registry";
import type { InfaixApp } from "@/lib/app-contract";
import { shortName, statusLabel } from "@/lib/app-presentation";

const capabilities: { name: string; desc: string; icon: IconName }[] = [
  { name: "Software", desc: "Applications, systems, and developer tools.", icon: "software" },
  { name: "AI Systems", desc: "Intelligent systems and machine learning.", icon: "ai" },
  { name: "Robotics", desc: "Autonomous systems and control.", icon: "robotics" },
  { name: "Hardware & Electronics", desc: "Embedded systems and custom hardware.", icon: "hardware" },
  { name: "Infrastructure", desc: "Compute, networking, and automation.", icon: "infrastructure" },
];

const forgeItems: { name: string; desc: string; icon: IconName }[] = [
  { name: "Compute", desc: "High performance workloads.", icon: "compute" },
  { name: "Network", desc: "Segmentation, routing, security.", icon: "network" },
  { name: "Fabrication", desc: "3D printing, CNC, prototyping.", icon: "fabrication" },
  { name: "Bench", desc: "Testing, instrumentation, repair.", icon: "bench" },
  { name: "CI / Automation", desc: "Build, test, deploy, repeat.", icon: "pipeline" },
];

const lifecycle = [
  { h: "Built", p: "Completed work. Live and available.", pill: "Live", tone: "live" },
  { h: "Building", p: "Active projects. In progress.", pill: "Active", tone: "active" },
  { h: "Developing", p: "Prototypes and betas. Shaping the future.", pill: "Development", tone: "" },
  { h: "Exploring", p: "Research and experiments. Pushing boundaries.", pill: "Research", tone: "" },
];

/** Polyhedral structure with the insignia at its centre; spokes converge on the logo. */
function HeroStructure() {
  const outer: [number, number][] = [[306, 86], [522, 248], [442, 548], [158, 520], [76, 262]];
  const depth: [number, number][] = [[352, 120], [548, 300], [430, 512], [190, 548], [104, 300]];
  const c: [number, number] = [320, 330];
  return (
    <svg className="hero-structure" viewBox="0 0 640 640" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="heroCoreGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#9146FF" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#9146FF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={c[0]} cy={c[1]} r="250" fill="url(#heroCoreGlow)" />
      {Array.from({ length: 11 }).map((_, r) =>
        Array.from({ length: 13 }).map((_, col) => (
          <circle
            key={`${r}-${col}`}
            cx={32 + col * 48}
            cy={40 + r * 56}
            r="1"
            fill="var(--periwinkle)"
            fillOpacity="0.16"
          />
        ))
      )}
      <g fill="none" strokeWidth="1">
        {/* Ghosted inner geometry — the far face of the same structure. */}
        <polygon className="hero-ghost" points={depth.map((p) => p.join(" ")).join(" ")} />
        {outer.map((p, i) => (
          <path key={`d${i}`} className="hero-ghost" d={`M${p[0]} ${p[1]} L${depth[i][0]} ${depth[i][1]}`} />
        ))}
        <polygon className="hero-outline" points={outer.map((p) => p.join(" ")).join(" ")} />
        {/* Spokes converge on the insignia and resolve once, on first view. */}
        {outer.map((p, i) => (
          <path
            key={`s${i}`}
            className="hero-spoke"
            style={{ "--i": i } as React.CSSProperties}
            d={`M${p[0]} ${p[1]} L${c[0]} ${c[1]}`}
          />
        ))}
        <circle className="hero-ghost" cx={outer[0][0]} cy={outer[0][1]} r="28" />
        <circle className="hero-ghost" cx={outer[0][0]} cy={outer[0][1]} r="48" />
      </g>
      {/* Deliberate asymmetry: alternating nodes are lit and larger. */}
      {outer.map(([x, y], i) => (
        <g key={`n${i}`} className={`hero-node${i % 2 === 0 ? " is-lit" : ""}`}>
          {i % 2 === 0 && <circle cx={x} cy={y} r="9" className="hero-node-halo" />}
          <circle cx={x} cy={y} r={i % 2 === 0 ? 3 : 2} className="hero-node-dot" />
        </g>
      ))}
    </svg>
  );
}

/** Registry summary rendered as an instrument reading, not a caption. */
function HeroIndex({ apps }: { apps: InfaixApp[] }) {
  const groups = new Map<string, string[]>();
  for (const app of apps) {
    const label = statusLabel(app.status);
    groups.set(label, [...(groups.get(label) ?? []), shortName(app)]);
  }
  return (
    <dl className="hero-index">
      {[...groups].map(([label, names]) => (
        <div key={label} data-status={label === "Live" ? "live" : "later"}>
          <dt>
            <span className="hero-index-dot" aria-hidden="true" />
            {label}
          </dt>
          <dd>{names.join(" · ")}</dd>
        </div>
      ))}
    </dl>
  );
}

const DIAGRAM_NODES: { x: number; y: number; label: string; icon: IconName }[] = [
  { x: 60, y: 30, label: "Compute", icon: "compute" },
  { x: 300, y: 30, label: "Network", icon: "network" },
  { x: 60, y: 254, label: "Fabrication", icon: "fabrication" },
  { x: 300, y: 254, label: "Bench", icon: "bench" },
  { x: 355, y: 142, label: "Projects", icon: "core" },
];

function ForgeDiagram() {
  return (
    <svg viewBox="0 0 460 340" role="img" aria-label="FORGE infrastructure diagram: compute, network, fabrication and bench connected through INFAIX core into projects">
      <g className="diagram-link">
        <path d="M110 78 V130 H195" />
        <path d="M350 78 V130 H265" />
        <path d="M110 262 V210 H195" />
        <path d="M350 262 V210 H265" />
        <path d="M195 170 H160" />
      </g>
      <path className="diagram-flow" d="M265 170 H355" />
      <circle className="diagram-orbit" cx="230" cy="170" r="46" />
      {DIAGRAM_NODES.map((b) => (
        <g key={b.label} className="diagram-node">
          <rect x={b.x} y={b.y} width="100" height="56" rx="3" />
          <g transform={`translate(${b.x + 50 - 11} ${b.y + 7}) scale(0.92)`}>
            <InfaixIcon name={b.icon} size={24} className="diagram-icon" />
          </g>
          <text x={b.x + 50} y={b.y + 45} textAnchor="middle" className="diagram-label">{b.label}</text>
        </g>
      ))}
      <g className="diagram-hub">
        <rect x="195" y="140" width="70" height="60" rx="3" />
        <g transform="translate(219 147) scale(0.92)">
          <InfaixIcon name="core" size={24} className="diagram-icon is-hub" />
        </g>
        <text x="230" y="193" textAnchor="middle" className="diagram-label is-hub">INFAIX</text>
      </g>
      {([[110, 130], [350, 130], [110, 210], [350, 210]] as const).map(([x, y], i) => (
        <rect
          key={i}
          className="diagram-joint"
          x={x - 3.5}
          y={y - 3.5}
          width="7"
          height="7"
          transform={`rotate(45 ${x} ${y})`}
        />
      ))}
    </svg>
  );
}

function TerrainMesh() {
  const lines = [
    "M0 130 80 105 160 118 240 92 320 108 400 84 480 100 560 78 640 96 720 74 800 92 880 72 960 90 1040 76 1120 94 1200 80",
    "M0 148 80 126 160 138 240 114 320 130 400 108 480 124 560 102 640 120 720 100 800 116 880 98 960 114 1040 100 1120 116 1200 104",
    "M0 165 80 148 160 158 240 138 320 152 400 134 480 148 560 130 640 146 720 128 800 144 880 132 960 146 1040 136 1120 150 1200 140",
  ];
  return (
    <svg className="philosophy-terrain" viewBox="0 0 1200 180" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
      {lines.map((d, i) => (
        <path key={i} d={d} className={i === 0 ? "is-primary" : undefined} />
      ))}
      {Array.from({ length: 24 }).map((_, i) => {
        const x = 20 + i * 50;
        const y = 80 + ((i * 37) % 50);
        return <circle key={i} cx={x} cy={y} r={i % 5 === 0 ? 2.4 : 1.2} className={i % 5 === 0 ? "is-lit" : undefined} />;
      })}
    </svg>
  );
}

/** The vertical axis carrying the reader between movements. */
function Seam({ index }: { index: string }) {
  return (
    <div className="seam" aria-hidden="true">
      <span>{index}</span>
    </div>
  );
}

export default function HomePage() {
  const apps = getPublicApps();
  return (
    <>
      <Nav />

      <main id="main-content" tabIndex={-1}>
        {/* ============ MOVEMENT 1 · CENTRE STAGE ============ */}
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-frame" aria-hidden="true"><span /><span /><span /><span /></div>
          <div className="container hero-inner">
            <div className="hero-stage">
              <HeroStructure />
              <InfaixLogo variant="insignia" priority />
            </div>
            <p className="hero-eyebrow">An independent technology studio</p>
            <h1 id="hero-title" className="hero-wordmark">INFAIX</h1>
            <p className="hero-tag">Technology, connected.</p>
            <p className="hero-desc">
              Software, hardware and infrastructure, joined through one identity.
            </p>
            <div className="hero-ctas">
              <Link href="/#ecosystem" className="btn-forge">
                Explore the ecosystem <span aria-hidden="true">↓</span>
              </Link>
              <Link href="/account" className="btn-quiet">
                Account <span aria-hidden="true">→</span>
              </Link>
            </div>
            <HeroIndex apps={apps} />
          </div>
          <div className="hero-axis" aria-hidden="true" />
        </section>

        {/* ============ MOVEMENT 2 · ASYMMETRIC INSTRUMENT ============ */}
        <section id="ecosystem" className="section-pad ecosystem-section" aria-labelledby="ecosystem-title">
          <div className="container instrument">
            <div className="instrument-rail">
              <ScrollReveal direction="left">
                <div className="instrument-head">
                  <span className="instrument-index" aria-hidden="true">01</span>
                  <p className="instrument-label">Connected by Core</p>
                  <h2 id="ecosystem-title">INFAIX<br />Ecosystem</h2>
                  <p className="instrument-note">
                    Independent applications joined to one identity. Everything here
                    authenticates through Core.
                  </p>
                </div>
              </ScrollReveal>
            </div>
            <div className="instrument-body">
              <EcosystemMap apps={apps} />
            </div>
          </div>
        </section>

        <Seam index="02" />

        {/* ============ MOVEMENT 2 · ASYMMETRIC INSTRUMENT ============ */}
        <section className="section-pad caps-section" aria-labelledby="caps-title">
          <div className="container instrument">
            <div className="instrument-rail">
              <ScrollReveal direction="left">
                <div className="instrument-head">
                  <span className="instrument-index" aria-hidden="true">02</span>
                  <p className="instrument-label">What we build</p>
                  <h2 id="caps-title">Core<br />capabilities</h2>
                  <p className="instrument-note">
                    Different disciplines, one environment. Everything is built,
                    tested and shipped through FORGE.
                  </p>
                  <Link href="/forge" className="btn-quiet instrument-action">
                    Explore FORGE <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </ScrollReveal>
            </div>
            <div className="instrument-body">
              <ScrollReveal>
                <ul className="capabilities">
                  {capabilities.map((cap) => (
                    <li key={cap.name} className="capability">
                      <span className="cap-node" aria-hidden="true" />
                      <span className="cap-icon">
                        <InfaixIcon name={cap.icon} size={24} />
                      </span>
                      <span className="cap-copy">
                        <span className="cap-name">{cap.name}</span>
                        <span className="cap-desc">{cap.desc}</span>
                      </span>
                      <span className="cap-to">FORGE</span>
                    </li>
                  ))}
                </ul>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* ============ MOVEMENT 3 · WIDE DATA BAND ============ */}
        <section id="forge" className="section-pad forge-section" aria-labelledby="forge-title">
          <div className="container band">
            <ScrollReveal>
              <div className="band-head">
                <span className="instrument-index" aria-hidden="true">03</span>
                <div>
                  <p className="instrument-label">FORGE</p>
                  <h2 id="forge-title">Where creation happens.</h2>
                </div>
                <p className="band-note">
                  A self-hosted lab and compute environment built for
                  experimentation, development and production.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal>
              <ul className="forge-list">
                {forgeItems.map((f) => (
                  <li key={f.name} className="forge-item">
                    <span className="forge-item-icon">
                      <InfaixIcon name={f.icon} size={22} />
                    </span>
                    <span className="fl-name">{f.name}</span>
                    <span className="fl-desc">{f.desc}</span>
                  </li>
                ))}
              </ul>
            </ScrollReveal>

            <ScrollReveal>
              <div className="forge-diagram">
                <ForgeDiagram />
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ============ MOVEMENT 3 · WIDE DATA BAND ============ */}
        <section className="section-pad projects-section" aria-labelledby="projects-title">
          <div className="container band">
            <ScrollReveal>
              <div className="band-head">
                <span className="instrument-index" aria-hidden="true">04</span>
                <div>
                  <p className="instrument-label">Projects</p>
                  <h2 id="projects-title">Built on FORGE. Shipped to the world.</h2>
                </div>
                <p className="band-note">
                  The work that leaves the lab. Released when it is ready.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal>
              <article className="project-feature">
                <div className="project-readout" aria-hidden="true">
                  <span className="project-readout-bar" />
                  <ul className="project-readout-list">
                    <li><span className="project-readout-node" />ToolboxHQ</li>
                    <li><span className="project-readout-node is-dim" />Developer tools</li>
                    <li><span className="project-readout-node is-dim" />File utilities</li>
                  </ul>
                  <span className="project-readout-line" />
                  <span className="project-readout-line is-short" />
                </div>
                <div className="project-meta-row">
                  <p className="instrument-label">INFAIX Forge / project</p>
                  <h3>
                    ToolboxHQ
                    <span className="live-badge">Live</span>
                  </h3>
                  <p>A suite of developer tools designed to simplify, accelerate and streamline the development workflow.</p>
                  <div className="project-actions">
                    <Link href="/forge/projects/toolboxhq" className="btn-forge">Visit project</Link>
                    <Link href="/forge/projects" className="btn-quiet">
                      All projects <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </div>
              </article>
            </ScrollReveal>

            <ScrollReveal>
              <ol className="lifecycle" aria-label="Project lifecycle">
                {lifecycle.map((s) => (
                  <li key={s.h} data-tone={s.tone || undefined}>
                    <span className="lifecycle-node" aria-hidden="true" />
                    <h4>{s.h}</h4>
                    <p>{s.p}</p>
                    <span className={`status-pill ${s.tone}`}>{s.pill}</span>
                  </li>
                ))}
              </ol>
            </ScrollReveal>
          </div>
        </section>

        <Seam index="05" />

        {/* ============ MOVEMENT 1 · CENTRE STAGE ============ */}
        <section className="section-pad philosophy" aria-labelledby="philosophy-title">
          <div className="container">
            <ScrollReveal>
              <p className="instrument-label is-centered">05 / Philosophy</p>
              <h2 id="philosophy-title">Build it. Break it.<br />Understand it. Improve it.</h2>
              <p className="philosophy-note">
                INFAIX → FORGE → PROJECTS. One direction, three stages.
              </p>
            </ScrollReveal>
          </div>
          <TerrainMesh />
        </section>

        {/* ============ MOVEMENT 2 · ASYMMETRIC INSTRUMENT ============ */}
        <section className="section-pad news-section" aria-labelledby="news-title">
          <div className="container instrument">
            <div className="instrument-rail">
              <ScrollReveal>
                <div className="instrument-head">
                  <span className="instrument-index" aria-hidden="true">06</span>
                  <p className="instrument-label">Product news</p>
                  <h2 id="news-title">Hear about it when it ships.</h2>
                </div>
                <p className="instrument-note">
                  One list, first-party only. Nothing else uses it.
                </p>
              </ScrollReveal>
            </div>
            <div className="instrument-body">
              <ScrollReveal>
                <p className="news-lede">
                  INFAIX ships rarely and deliberately. This is the one place to hear
                  about a launch, a project milestone, a beta opening or a major
                  feature release. No account is needed to subscribe, and subscribing
                  does not create one.
                </p>
                <div className="news-mark" aria-hidden="true">
                  <span className="news-mark-node is-core" />
                  <span className="news-mark-node" />
                  <span className="news-mark-node" />
                </div>
                <NewsletterForm source="homepage" className="news-form-homepage" />
                <p className="news-transactional">
                  Account and security messages — verification, password reset,
                  security notices — are sent because your account needs them, and are
                  never part of this. Turning product news off does not affect them.
                  See the <Link href="/legal/privacy">privacy policy</Link>.
                </p>
              </ScrollReveal>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
