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
  { label: "COMPUTE", desc: "Processing and compute resources." },
  { label: "NETWORK", desc: "Internal and external networking." },
  { label: "STORAGE", desc: "Persistent data and file systems." },
  { label: "AI", desc: "Self-hosted model inference and pipelines." },
  { label: "CI/CD", desc: "Automated build and deployment." },
  { label: "FABRICATION", desc: "Hardware prototyping and assembly." },
  { label: "BENCH", desc: "Testing and experimentation surface." },
];

export default function ForgePage() {
  return (
    <>
      <Nav />

      <main>
        <section className="page-hero">
          <div className="container">
            <ScrollReveal>
              <div className="section-label">INFRASTRUCTURE</div>
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
        <section className="section-pad">
          <div className="container">
            <ScrollReveal>
              <div className="section-label">INFRASTRUCTURE</div>
            </ScrollReveal>
            {infraItems.map((item) => (
              <ScrollReveal key={item.label}>
                <div className="cat-row">
                  <div className="cat-title">{item.label}</div>
                  <div className="cat-desc">{item.desc}</div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* Projects */}
        <section className="section-pad">
          <div className="container">
            <ScrollReveal>
              <div className="section-label">PROJECTS</div>
            </ScrollReveal>
            <ScrollReveal>
              <Link href="/forge/projects/toolboxhq" className="project-card" style={{ display: "block" }}>
                <div className="project-status">LIVE</div>
                <h3>ToolboxHQ</h3>
                <p>Practical developer, file and utility tools built for the web.</p>
                <div className="project-meta">SOFTWARE / TOOLING / ACTIVE</div>
              </Link>
            </ScrollReveal>
          </div>
        </section>

        {/* Lab */}
        <section className="section-pad">
          <div className="container">
            <ScrollReveal>
              <div className="section-label">LAB</div>
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
        <section className="section-pad">
          <div className="container">
            <ScrollReveal>
              <div className="section-label">EXPERIMENTS</div>
            </ScrollReveal>
            <div className="cat-row">
              <div className="cat-title">EXPLORING</div>
              <div>
                <div className="cat-desc">
                  Robotics, wearable interaction, AI systems, embedded
                  hardware and experimental technology.
                </div>
                <div className="cat-status">RESEARCH</div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
