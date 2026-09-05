import type { Metadata } from "next";
import Link from "next/link";
import ScrollReveal from "@/components/ScrollReveal";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "FORGE",
  description:
    "INFAIX's technical creation environment. Infrastructure, projects, lab and experiments.",
  openGraph: {
    title: "FORGE | INFAIX",
    description:
      "INFAIX's technical creation environment. Infrastructure, projects, lab and experiments.",
    url: "https://infaix.com/forge",
  },
};

const infraItems = [
  { label: "COMPUTE", desc: "Processing and compute resources.", glyph: "▣" },
  { label: "NETWORK", desc: "Internal and external networking.", glyph: "⌁" },
  { label: "STORAGE", desc: "Persistent data and file systems.", glyph: "▤" },
  { label: "AI", desc: "Self-hosted model inference and pipelines.", glyph: "✦" },
  { label: "CI/CD", desc: "Automated build and deployment.", glyph: "◉" },
  { label: "FABRICATION", desc: "Hardware prototyping and assembly.", glyph: "⬢" },
  { label: "BENCH", desc: "Testing and experimentation surface.", glyph: "◈" },
];

export default function ForgePage() {
  return (
    <>
      <Nav />

      <main>
        <section className="page-hero">
          <div className="container">
            <ScrollReveal>
              <div className="section-label">Infrastructure</div>
              <h1>FORGE</h1>
              <p>
                The technical creation environment behind INFAIX. Where
                projects are built, tested and operated on real hardware and
                real networks.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* Infrastructure */}
        <section className="section-pad" style={{ paddingTop: 20 }}>
          <div className="container">
            <ScrollReveal>
              <div className="section-label">Infrastructure</div>
            </ScrollReveal>
            <ScrollReveal>
              <ul className="forge-list" style={{ borderTop: "1px solid var(--border)" }}>
                {infraItems.map((item) => (
                  <li key={item.label}>
                    <span className="fl-icon" aria-hidden="true">{item.glyph}</span>
                    <span className="fl-name">{item.label}</span>
                    <span className="fl-desc">{item.desc}</span>
                  </li>
                ))}
              </ul>
            </ScrollReveal>
          </div>
        </section>

        {/* Projects */}
        <section className="section-pad" style={{ paddingTop: 20 }}>
          <div className="container">
            <ScrollReveal>
              <div className="section-label">Projects</div>
            </ScrollReveal>
            <ScrollReveal>
              <Link href="/forge/projects/toolboxhq" className="project-card" style={{ display: "block" }}>
                <div className="project-status">Live</div>
                <h3>ToolboxHQ</h3>
                <p>Practical developer, file and utility tools built for the web.</p>
                <div className="project-meta">Software / Tooling / Active</div>
              </Link>
            </ScrollReveal>
            <ScrollReveal>
              <div style={{ marginTop: 24 }}>
                <Link href="/forge/projects" className="btn-quiet">
                  View all projects <span>&rarr;</span>
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* Lab */}
        <section className="section-pad" style={{ paddingTop: 20 }}>
          <div className="container">
            <ScrollReveal>
              <div className="section-label">Lab</div>
            </ScrollReveal>
            <ScrollReveal>
              <div className="cat-row" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="cat-title">ACTIVE</div>
                <div className="cat-desc">
                  Engineering work currently in progress. Software, hardware
                  and infrastructure projects under active development.
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* Experiments */}
        <section className="section-pad" style={{ paddingTop: 20 }}>
          <div className="container">
            <ScrollReveal>
              <div className="section-label">Experiments</div>
            </ScrollReveal>
            <div className="cat-row">
              <div className="cat-title">EXPLORING</div>
              <div>
                <div className="cat-desc">
                  Robotics, wearable interaction, AI systems, embedded
                  hardware and experimental technology.
                </div>
                <div className="cat-status">Research</div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
