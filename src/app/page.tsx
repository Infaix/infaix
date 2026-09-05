import Link from "next/link";
import ScrollReveal from "@/components/ScrollReveal";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import InfaixLogo from "@/components/infaix-logo";

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

const forgeItems = [
  { name: "Compute", desc: "High performance workloads.", glyph: "▣" },
  { name: "Network", desc: "Segmentation, routing, security.", glyph: "⌁" },
  { name: "Fabrication", desc: "3D printing, CNC, prototyping.", glyph: "⬢" },
  { name: "Bench", desc: "Testing, instrumentation, repair.", glyph: "▤" },
  { name: "CI / Automation", desc: "Build, test, deploy, repeat.", glyph: "◉" },
];

function HeroWireframe() {
  return (
    <svg viewBox="0 0 480 480" role="presentation" aria-hidden="true">
      <defs>
        <radialGradient id="heroWireGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#9146FF" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#9146FF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="240" cy="220" r="170" fill="url(#heroWireGlow)" />
      {/* faint dotted field */}
      {Array.from({ length: 9 }).map((_, r) =>
        Array.from({ length: 12 }).map((_, c) => (
          <circle
            key={`${r}-${c}`}
            cx={40 + c * 36}
            cy={30 + r * 48}
            r="1"
            fill="rgba(200,190,225,0.14)"
          />
        ))
      )}
      {/* large irregular polyhedron */}
      <g stroke="rgba(170,150,210,0.28)" strokeWidth="1" fill="none">
        <path d="M240 40 400 160 340 380 130 360 70 170 Z" />
        <path d="M240 40 250 220 340 380 M70 170 250 220 400 160 M130 360 250 220 M240 40 240 220" stroke="rgba(170,150,210,0.16)" />
        <path d="M250 220 240 120 330 200 250 220 150 200 240 120" stroke="rgba(145,70,255,0.25)" />
        <circle cx="240" cy="40" r="26" stroke="rgba(170,150,210,0.14)" />
        <circle cx="240" cy="40" r="44" stroke="rgba(170,150,210,0.09)" />
      </g>
      {/* nodes */}
      {[
        [240, 40, 1], [400, 160, 0], [340, 380, 1], [130, 360, 0], [70, 170, 0], [250, 220, 1],
      ].map(([x, y, p], i) => (
        <g key={i}>
          {p === 1 && <circle cx={x} cy={y} r="9" fill="rgba(145,70,255,0.08)" />}
          <circle cx={x} cy={y} r={p === 1 ? 3 : 2} fill={p === 1 ? "#B36BFF" : "rgba(220,212,232,0.5)"} opacity={p === 1 ? 0.9 : 0.5} />
        </g>
      ))}
    </svg>
  );
}

function ForgeDiagram() {
  const box = "rgba(25,23,33,0.95)";
  const edge = "rgba(120,105,150,0.5)";
  return (
    <svg viewBox="0 0 460 340" role="img" aria-label="FORGE infrastructure diagram: compute, network, fabrication and bench connected through INFAIX core into projects">
      {/* connectors */}
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
      {/* boxes */}
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
      {/* core */}
      <rect x="195" y="140" width="70" height="60" rx="6" fill="rgba(20,14,30,0.95)" stroke="rgba(145,70,255,0.6)" />
      <text x="230" y="168" textAnchor="middle" fill="#B36BFF" fontSize="20">◆</text>
      <text x="230" y="186" textAnchor="middle" fill="#6f6880" fontSize="7.5" letterSpacing="1.5" fontFamily="Space Grotesk, sans-serif">INFAIX</text>
      {/* node dots */}
      {[[110, 130], [350, 130], [110, 210], [350, 210], [355, 170]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill="#B36BFF" opacity="0.85" />
      ))}
      <polygon points="372,166 380,170 372,174" fill="#B36BFF" opacity="0.9" />
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

export default function HomePage() {
  return (
    <>
      <Nav />

      <main>
        {/* ============ HERO ============ */}
        <section className="hero">
          <div className="container hero-inner">
            <div className="hero-grid">
              <div className="hero-left">
                <ScrollReveal direction="left">
                  <InfaixLogo variant="hero-illuminated" priority />
                </ScrollReveal>
                <div className="hero-copy">
                  <ScrollReveal>
                    <h1>INFAIX</h1>
                    <div className="hero-tag">BUILD WHAT&apos;S NEXT.</div>
                    <p className="hero-desc">
                      INFAIX is an independent technology studio.
                      We build at the intersection of software, hardware,
                      and infrastructure.
                    </p>
                    <div className="hero-ctas">
                      <Link href="/forge" className="btn-forge">
                        ENTER FORGE <span aria-hidden="true">→</span>
                      </Link>
                      <Link href="/ai" className="btn-quiet">
                        INFAIX AI <span aria-hidden="true">→</span>
                      </Link>
                    </div>
                  </ScrollReveal>
                </div>
              </div>
              <div className="hero-wire" aria-hidden="true">
                <div className="hero-wire-glow" />
                <HeroWireframe />
              </div>
            </div>
          </div>
        </section>

        {/* ============ THREE-LAYER SYSTEM ============ */}
        <section className="section-pad" style={{ paddingTop: 40 }}>
          <div className="container">
            <ScrollReveal>
              <div className="ecosystem">
                <div className="eco-cell">
                  <div className="eco-top">
                    <svg className="eco-icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                      <path d="M20 4 26 14 20 34 14 14Z" />
                      <path d="M14 14 8 22 20 34 32 22 26 14" />
                      <path d="M20 4v8M14 14h12" stroke="rgba(145,70,255,0.6)" />
                    </svg>
                    <div>
                      <div className="eco-layer">Organisation</div>
                      <div className="eco-title">INFAIX</div>
                    </div>
                  </div>
                  <p className="eco-desc">The studio. The philosophy.<br />The independent entity.</p>
                </div>
                <div className="eco-link" aria-hidden="true"><span>›</span></div>
                <div className="eco-cell">
                  <div className="eco-top">
                    <svg className="eco-icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                      <path d="M20 5 33 12.5v15L20 35 7 27.5v-15Z" />
                      <path d="M20 5v15m0 0L7 12.5M20 20l13-7.5M20 20v15" stroke="rgba(145,70,255,0.55)" />
                    </svg>
                    <div>
                      <div className="eco-layer">Infrastructure</div>
                      <div className="eco-title">FORGE</div>
                    </div>
                  </div>
                  <p className="eco-desc">The environment. The systems. The tools.<br />Where creation happens.</p>
                </div>
                <div className="eco-link" aria-hidden="true"><span>›</span></div>
                <div className="eco-cell">
                  <div className="eco-top">
                    <svg className="eco-icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                      <path d="M20 6 34 13 20 20 6 13Z" />
                      <path d="M6 20l14 7 14-7M6 27l14 7 14-7" />
                    </svg>
                    <div>
                      <div className="eco-layer">Output</div>
                      <div className="eco-title">PROJECTS</div>
                    </div>
                  </div>
                  <p className="eco-desc">The work that ships.<br />Built on top of FORGE.</p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ============ WHAT WE BUILD ============ */}
        <section className="section-pad" style={{ paddingTop: 20 }}>
          <div className="container">
            <div className="caps-layout">
              <ScrollReveal direction="left">
                <div className="caps-intro">
                  <div className="section-label">What we build</div>
                  <h2>Core capabilities.<br />Unified by FORGE.</h2>
                  <p>Different disciplines. One environment. All built, tested, and shipped through our infrastructure.</p>
                  <Link href="/forge" className="btn-quiet">
                    EXPLORE FORGE <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </ScrollReveal>
              <div>
                {capabilities.map((cap) => (
                  <ScrollReveal key={cap.name}>
                    <div className="capability">
                      <div className="cap-icon">{cap.icon}</div>
                      <div>
                        <div className="cap-name">{cap.name}</div>
                        <div className="cap-desc">{cap.desc}</div>
                      </div>
                      <div className="cap-to">{cap.forge}</div>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ============ FORGE ============ */}
        <section id="forge" className="section-pad forge-section">
          <div className="container">
            <div className="forge-layout">
              <ScrollReveal direction="left">
                <div className="forge-copy">
                  <div className="section-label">Forge</div>
                  <h2>Where creation happens.</h2>
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
        <section className="section-pad">
          <div className="container">
            <ScrollReveal>
              <div className="projects-shell">
                <div className="projects-layout">
                  <div className="projects-intro">
                    <div className="section-label">Projects</div>
                    <h2>Built on FORGE.<br />Shipped to the world.</h2>
                    <p>The work that leaves the lab. Built with purpose. Released when it&apos;s ready.</p>
                    <Link href="/forge/projects/toolboxhq" className="btn-quiet">
                      VIEW ALL PROJECTS <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                  <div className="project-feature">
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
                      <div>
                        <h3>ToolboxHQ<span className="live-badge">LIVE</span></h3>
                        <p>A suite of developer tools designed to simplify, accelerate, and streamline the development workflow.</p>
                        <Link href="/forge/projects/toolboxhq" className="btn-quiet">
                          VISIT PROJECT <span aria-hidden="true">→</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="status-strip">
                  {[
                    { h: "BUILT", p: "Completed work. Live and available.", pill: "LIVE", cls: "live" },
                    { h: "BUILDING", p: "Active projects. In progress.", pill: "ACTIVE", cls: "active" },
                    { h: "DEVELOPING", p: "Prototypes and betas. Shaping the future.", pill: "DEVELOPMENT", cls: "" },
                    { h: "EXPLORING", p: "Research and experiments. Pushing boundaries.", pill: "RESEARCH", cls: "" },
                  ].map((s) => (
                    <div className="status-cell" key={s.h}>
                      <h4>{s.h}</h4>
                      <p>{s.p}</p>
                      <span className={`status-pill ${s.cls}`}>{s.pill}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ============ PHILOSOPHY ============ */}
        <section className="section-pad philosophy" style={{ paddingBottom: 0 }}>
          <div className="container">
            <ScrollReveal>
              <div className="section-label">Philosophy</div>
              <h2>Build it. Break it. Understand it. Improve it.</h2>
            </ScrollReveal>
          </div>
          <TerrainMesh />
        </section>
      </main>

      <Footer />
    </>
  );
}
