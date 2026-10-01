import Link from "next/link";
import ScrollReveal from "@/components/ScrollReveal";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import InfaixLogo from "@/components/infaix-logo";
import EcosystemMap from "@/components/ecosystem-map";
import { getPublicApps } from "@/lib/app-registry";
import type { InfaixApp } from "@/lib/app-contract";
import { shortName, statusLabel } from "@/lib/app-presentation";

const capabilities = [
  {
    name: "Software",
    desc: "Applications, systems, and developer tools.",
    forge: "→ FORGE",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M8 6 3 12l5 6M16 6l5 6-5 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    name: "AI Systems",
    desc: "Intelligent systems and machine learning.",
    forge: "→ FORGE",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.5 2.5M16.5 16.5 19 19M19 5l-2.5 2.5M7.5 16.5 5 19" strokeLinecap="round" />
        <circle cx="12" cy="12" r="3.2" />
      </svg>
    ),
  },
  {
    name: "Robotics",
    desc: "Autonomous systems and control.",
    forge: "→ FORGE",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M6 18v-6a6 6 0 0 1 12 0v6" strokeLinecap="round" />
        <rect x="4" y="16" width="16" height="4" rx="1" />
        <circle cx="9.5" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="14.5" cy="12" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    name: "Hardware & Electronics",
    desc: "Embedded systems and custom hardware.",
    forge: "→ FORGE",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="7" y="7" width="10" height="10" rx="1" />
        <rect x="10.5" y="10.5" width="3" height="3" />
        <path d="M9 7V4M15 7V4M9 20v-3M15 20v-3M7 9H4M7 15H4M20 9h-3M20 15h-3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "Infrastructure",
    desc: "Compute, networking, and automation.",
    forge: "IS FORGE",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="3" y="4" width="18" height="6" rx="1" />
        <rect x="3" y="14" width="18" height="6" rx="1" />
        <circle cx="7" cy="7" r="1" fill="currentColor" stroke="none" />
        <circle cx="7" cy="17" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

const layers = [
  {
    layer: "Organisation",
    title: "INFAIX",
    desc: ["The studio. The philosophy.", "The independent entity."],
    icon: (
      <svg className="layer-icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
        <path d="M20 4 26 14 20 34 14 14Z" />
        <path d="M14 14 8 22 20 34 32 22 26 14" />
        <path d="M20 4v8M14 14h12" stroke="rgba(145,70,255,0.6)" />
      </svg>
    ),
  },
  {
    layer: "Infrastructure",
    title: "FORGE",
    desc: ["The environment. The systems. The tools.", "Where creation happens."],
    icon: (
      <svg className="layer-icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
        <path d="M20 5 33 12.5v15L20 35 7 27.5v-15Z" />
        <path d="M20 5v15m0 0L7 12.5M20 20l13-7.5M20 20v15" stroke="rgba(145,70,255,0.55)" />
      </svg>
    ),
  },
  {
    layer: "Output",
    title: "PROJECTS",
    desc: ["The work that ships.", "Built on top of FORGE."],
    icon: (
      <svg className="layer-icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
        <path d="M20 6 34 13 20 20 6 13Z" />
        <path d="M6 20l14 7 14-7M6 27l14 7 14-7" />
      </svg>
    ),
  },
];

const forgeItems = [
  { name: "Compute", desc: "High performance workloads.", glyph: "▣" },
  { name: "Network", desc: "Segmentation, routing, security.", glyph: "⌁" },
  { name: "Fabrication", desc: "3D printing, CNC, prototyping.", glyph: "⬢" },
  { name: "Bench", desc: "Testing, instrumentation, repair.", glyph: "▤" },
  { name: "CI / Automation", desc: "Build, test, deploy, repeat.", glyph: "◉" },
];

const lifecycle = [
  { h: "BUILT", p: "Completed work. Live and available.", pill: "LIVE", tone: "live" },
  { h: "BUILDING", p: "Active projects. In progress.", pill: "ACTIVE", tone: "active" },
  { h: "DEVELOPING", p: "Prototypes and betas. Shaping the future.", pill: "DEVELOPMENT", tone: "" },
  { h: "EXPLORING", p: "Research and experiments. Pushing boundaries.", pill: "RESEARCH", tone: "" },
];

/** Polyhedral structure with the insignia at its centre; spokes converge on the logo. */
function HeroStructure() {
  const outer: [number, number][] = [[306, 86], [522, 248], [442, 548], [158, 520], [76, 262]];
  const depth: [number, number][] = [[352, 120], [548, 300], [430, 512], [190, 548], [104, 300]];
  const c: [number, number] = [320, 330];
  return (
    <svg className="hero-structure" viewBox="0 0 640 640" aria-hidden="true">
      <defs>
        <radialGradient id="heroCoreGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#9146FF" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#9146FF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={c[0]} cy={c[1]} r="250" fill="url(#heroCoreGlow)" />
      {Array.from({ length: 11 }).map((_, r) =>
        Array.from({ length: 13 }).map((_, col) => (
          <circle key={`${r}-${col}`} cx={32 + col * 48} cy={40 + r * 56} r="1" fill="rgba(200,190,225,0.12)" />
        ))
      )}
      <g fill="none" strokeWidth="1">
        <polygon points={depth.map((p) => p.join(" ")).join(" ")} stroke="rgba(170,150,210,0.1)" />
        {outer.map((p, i) => (
          <path key={`d${i}`} d={`M${p[0]} ${p[1]} L${depth[i][0]} ${depth[i][1]}`} stroke="rgba(170,150,210,0.1)" />
        ))}
        <polygon points={outer.map((p) => p.join(" ")).join(" ")} stroke="rgba(170,150,210,0.3)" />
        {outer.map((p, i) => (
          <path key={`s${i}`} d={`M${p[0]} ${p[1]} L${c[0]} ${c[1]}`} stroke="rgba(145,70,255,0.28)" strokeDasharray="2 6" />
        ))}
        <circle cx={outer[0][0]} cy={outer[0][1]} r="28" stroke="rgba(170,150,210,0.14)" />
        <circle cx={outer[0][0]} cy={outer[0][1]} r="48" stroke="rgba(170,150,210,0.08)" />
      </g>
      {outer.map(([x, y], i) => (
        <g key={`n${i}`} className="hero-node">
          {i % 2 === 0 && <circle cx={x} cy={y} r="10" fill="rgba(145,70,255,0.08)" />}
          <circle cx={x} cy={y} r={i % 2 === 0 ? 3 : 2} fill={i % 2 === 0 ? "#B36BFF" : "rgba(220,212,232,0.5)"} opacity={i % 2 === 0 ? 0.9 : 0.55} />
        </g>
      ))}
    </svg>
  );
}

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
          <dt>{label}</dt>
          <dd>{names.join(" · ")}</dd>
        </div>
      ))}
    </dl>
  );
}

function ForgeDiagram() {
  const box = "rgba(25,23,33,0.95)";
  const edge = "rgba(120,105,150,0.5)";
  return (
    <svg viewBox="0 0 460 340" role="img" aria-label="FORGE infrastructure diagram: compute, network, fabrication and bench connected through INFAIX core into projects">
      <g stroke="rgba(145,70,255,0.45)" strokeWidth="1" fill="none">
        <path d="M110 78 V130 H195" />
        <path d="M350 78 V130 H265" />
        <path d="M110 262 V210 H195" />
        <path d="M350 262 V210 H265" />
        <path d="M265 170 H355" strokeDasharray="5 5" className="flow-line" />
        <path d="M195 170 H160" opacity="0.6" />
      </g>
      <g stroke="rgba(150,135,180,0.25)" strokeWidth="1" fill="none">
        <circle cx="230" cy="170" r="46" strokeDasharray="3 6" />
      </g>
      {[
        { x: 60, y: 30, label: "COMPUTE", glyph: "▣" },
        { x: 300, y: 30, label: "NETWORK", glyph: "⌁" },
        { x: 60, y: 254, label: "FABRICATION", glyph: "⬢" },
        { x: 300, y: 254, label: "BENCH", glyph: "◉" },
        { x: 355, y: 142, label: "PROJECTS", glyph: "☰" },
      ].map((b) => (
        <g key={b.label}>
          <rect x={b.x} y={b.y} width="100" height="56" rx="4" fill={box} stroke={edge} />
          <text x={b.x + 50} y={b.y + 25} textAnchor="middle" fill="#8d86a0" fontSize="13">{b.glyph}</text>
          <text x={b.x + 50} y={b.y + 42} textAnchor="middle" fill="#c9c3d6" fontSize="9" letterSpacing="1.5" fontFamily="Space Grotesk, sans-serif">{b.label}</text>
        </g>
      ))}
      <rect x="195" y="140" width="70" height="60" rx="6" fill="rgba(20,14,30,0.95)" stroke="rgba(145,70,255,0.6)" />
      <text x="230" y="168" textAnchor="middle" fill="#B36BFF" fontSize="20">◆</text>
      <text x="230" y="186" textAnchor="middle" fill="#6f6880" fontSize="7.5" letterSpacing="1.5" fontFamily="Space Grotesk, sans-serif">INFAIX</text>
      {[[110, 130], [350, 130], [110, 210], [350, 210], [355, 170]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill="#B36BFF" opacity="0.85" />
      ))}
      <polygon points="345,166 353,170 345,174" fill="#B36BFF" opacity="0.9" />
    </svg>
  );
}

function TerrainMesh() {
  const layers = [
    "M0 130 80 105 160 118 240 92 320 108 400 84 480 100 560 78 640 96 720 74 800 92 880 72 960 90 1040 76 1120 94 1200 80",
    "M0 148 80 126 160 138 240 114 320 130 400 108 480 124 560 102 640 120 720 100 800 116 880 98 960 114 1040 100 1120 116 1200 104",
    "M0 165 80 148 160 158 240 138 320 152 400 134 480 148 560 130 640 146 720 128 800 144 880 132 960 146 1040 136 1120 150 1200 140",
  ];
  return (
    <svg className="philosophy-terrain" viewBox="0 0 1200 180" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      {layers.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={i === 0 ? "rgba(145,70,255,0.35)" : "rgba(150,135,180,0.18)"} strokeWidth="1" />
      ))}
      {Array.from({ length: 24 }).map((_, i) => {
        const x = 20 + i * 50;
        const y = 80 + ((i * 37) % 50);
        return <circle key={i} cx={x} cy={y} r={i % 5 === 0 ? 2.4 : 1.2} fill={i % 5 === 0 ? "rgba(179,107,255,0.7)" : "rgba(200,190,225,0.3)"} />;
      })}
    </svg>
  );
}

function Seam({ index }: { index: string }) {
  return <div className="seam" aria-hidden="true"><span>{index}</span></div>;
}

export default function HomePage() {
  const apps = getPublicApps();
  return (
    <>
      <Nav />

      <main id="main-content" tabIndex={-1}>
        {/* ============ HERO ============ */}
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

        {/* ============ ECOSYSTEM ============ */}
        <section id="ecosystem" className="section-pad ecosystem-section" aria-labelledby="ecosystem-title">
          <div className="container">
            <ScrollReveal>
              <div className="section-head is-centered">
                <div className="section-label">01 / Connected by Core</div>
                <h2 id="ecosystem-title">INFAIX Ecosystem</h2>
                <p>Independent applications. One INFAIX identity. Explore what is available, and what comes next.</p>
              </div>
            </ScrollReveal>
            <EcosystemMap apps={apps} />
          </div>
        </section>

        <Seam index="02" />

        {/* ============ STRUCTURE ============ */}
        <section className="section-pad layers-section" aria-labelledby="layers-title">
          <div className="container">
            <ScrollReveal>
              <div className="section-head">
                <div className="section-label">02 / Structure</div>
                <h2 id="layers-title">Three layers. One direction.</h2>
              </div>
            </ScrollReveal>
            <ScrollReveal>
              <ol className="layers">
                {layers.map((l) => (
                  <li key={l.title} className="layer">
                    <div className="layer-mark">{l.icon}</div>
                    <div className="layer-name">{l.layer}</div>
                    <div className="layer-title">{l.title}</div>
                    <p>{l.desc[0]}<br />{l.desc[1]}</p>
                  </li>
                ))}
              </ol>
            </ScrollReveal>
          </div>
        </section>

        {/* ============ WHAT WE BUILD ============ */}
        <section className="section-pad caps-section" aria-labelledby="caps-title">
          <div className="container">
            <div className="caps-layout">
              <ScrollReveal direction="left">
                <div className="caps-intro">
                  <div className="section-label">03 / What we build</div>
                  <h2 id="caps-title">Core capabilities.<br />Unified by FORGE.</h2>
                  <p>Different disciplines. One environment. All built, tested, and shipped through our infrastructure.</p>
                  <Link href="/forge" className="btn-quiet">
                    EXPLORE FORGE <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </ScrollReveal>
              <ScrollReveal>
                <ul className="capabilities">
                  {capabilities.map((cap) => (
                    <li key={cap.name} className="capability">
                      <div className="cap-icon">{cap.icon}</div>
                      <div>
                        <div className="cap-name">{cap.name}</div>
                        <div className="cap-desc">{cap.desc}</div>
                      </div>
                      <div className="cap-to">{cap.forge}</div>
                    </li>
                  ))}
                </ul>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* ============ FORGE ============ */}
        <section id="forge" className="section-pad forge-section" aria-labelledby="forge-title">
          <div className="container">
            <div className="forge-layout">
              <ScrollReveal direction="left">
                <div className="forge-copy">
                  <div className="section-label">04 / Forge</div>
                  <h2 id="forge-title">Where creation happens.</h2>
                  <p>
                    FORGE is the infrastructure layer that everything runs on.
                    A self-hosted lab and compute environment built for
                    experimentation, development, and production.
                  </p>
                  <ul className="forge-list">
                    {forgeItems.map((f) => (
                      <li key={f.name}>
                        <span className="fl-icon" aria-hidden="true">{f.glyph}</span>
                        <span className="fl-name">{f.name}</span>
                        <span className="fl-desc">{f.desc}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/forge" className="btn-quiet">
                    EXPLORE FORGE <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </ScrollReveal>

              <ScrollReveal direction="right">
                <div className="forge-diagram">
                  <ForgeDiagram />
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* ============ PROJECTS ============ */}
        <section className="section-pad projects-section" aria-labelledby="projects-title">
          <div className="container">
            <div className="projects-layout">
              <ScrollReveal direction="left">
                <div className="projects-intro">
                  <div className="section-label">05 / Projects</div>
                  <h2 id="projects-title">Built on FORGE.<br />Shipped to the world.</h2>
                  <p>The work that leaves the lab. Built with purpose. Released when it&apos;s ready.</p>
                  <Link href="/forge/projects" className="btn-quiet">
                    VIEW ALL PROJECTS <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </ScrollReveal>
              <ScrollReveal direction="right">
                <article className="project-feature">
                  <div className="project-window" aria-hidden="true">
                    <div className="project-window-bar"><i /><i /><i /></div>
                    <div className="project-window-body">
                      <span className="tool-chip">ToolboxHQ</span>
                      <span className="tool-chip dim">Developer tools</span>
                      <span className="tool-chip dim">File utilities</span>
                    </div>
                    <div className="tool-line" />
                    <div className="tool-line" style={{ marginLeft: 48 }} />
                  </div>
                  <div className="project-meta-row">
                    <h3>ToolboxHQ<span className="live-badge">LIVE</span></h3>
                    <p>A suite of developer tools designed to simplify, accelerate, and streamline the development workflow.</p>
                    <Link href="/forge/projects/toolboxhq" className="btn-quiet">
                      VISIT PROJECT <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </article>
              </ScrollReveal>
            </div>
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

        <Seam index="06" />

        {/* ============ PHILOSOPHY ============ */}
        <section className="section-pad philosophy" aria-labelledby="philosophy-title">
          <div className="container">
            <ScrollReveal>
              <div className="section-label">06 / Philosophy</div>
              <h2 id="philosophy-title">Build it. Break it. Understand it. Improve it.</h2>
            </ScrollReveal>
          </div>
          <TerrainMesh />
        </section>
      </main>

      <Footer />
    </>
  );
}
