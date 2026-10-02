import type { Metadata } from "next";
import Link from "next/link";
import ScrollReveal from "@/components/ScrollReveal";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import InfaixIcon, { type IconName } from "@/components/icons";

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

const infraItems: { label: string; desc: string; icon: IconName }[] = [
  { label: "Compute", desc: "Processing and compute resources.", icon: "compute" },
  { label: "Network", desc: "Internal and external networking.", icon: "network" },
  { label: "Storage", desc: "Persistent data and file systems.", icon: "infrastructure" },
  { label: "AI", desc: "Self-hosted model inference and pipelines.", icon: "ai" },
  { label: "CI/CD", desc: "Automated build and deployment.", icon: "pipeline" },
  { label: "Fabrication", desc: "Hardware prototyping and assembly.", icon: "fabrication" },
  { label: "Bench", desc: "Testing and experimentation surface.", icon: "bench" },
];

export default function ForgePage() {
  return (
    <>
      <Nav />

      <main id="main-content" tabIndex={-1}>
        <section className="page-hero">
          <div className="page-frame" aria-hidden="true"><span /><span /></div>
          <div className="container">
            <ScrollReveal>
              <p className="instrument-label">Infrastructure</p>
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
        <section className="section-pad is-subpage">
          <div className="container band">
            <ScrollReveal>
              <div className="band-head">
                <span className="instrument-index" aria-hidden="true">01</span>
                <div>
                  <p className="instrument-label">Infrastructure</p>
                  <h2>What FORGE runs on.</h2>
                </div>
              </div>
            </ScrollReveal>
            <ScrollReveal>
              <ul className="forge-list">
                {infraItems.map((item) => (
                  <li key={item.label} className="forge-item">
                    <span className="forge-item-icon">
                      <InfaixIcon name={item.icon} size={22} />
                    </span>
                    <span className="fl-name">{item.label}</span>
                    <span className="fl-desc">{item.desc}</span>
                  </li>
                ))}
              </ul>
            </ScrollReveal>
          </div>
        </section>

        {/* Projects */}
        <section className="section-pad is-subpage">
          <div className="container band">
            <ScrollReveal>
              <div className="band-head">
                <span className="instrument-index" aria-hidden="true">02</span>
                <div>
                  <p className="instrument-label">Projects</p>
                  <h2>The work that ships.</h2>
                </div>
                <p className="band-note">
                  Released when it is ready. Each project is built, tested and
                  operated inside this environment.
                </p>
              </div>
            </ScrollReveal>
            <ScrollReveal>
              <Link href="/forge/projects/toolboxhq" className="project-card">
                <p className="instrument-label">Live / Software</p>
                <h3>ToolboxHQ</h3>
                <p>Practical developer, file and utility tools built for the web.</p>
                <span className="project-card-action">Open project <span aria-hidden="true">→</span></span>
              </Link>
            </ScrollReveal>
            <ScrollReveal>
              <div className="section-action">
                <Link href="/forge/projects" className="btn-quiet">
                  View all projects <span aria-hidden="true">→</span>
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* Lab + experiments */}
        <section className="section-pad is-subpage">
          <div className="container band">
            <ScrollReveal>
              <div className="band-head">
                <span className="instrument-index" aria-hidden="true">03</span>
                <div>
                  <p className="instrument-label">Lab &amp; experiments</p>
                  <h2>What is being explored.</h2>
                </div>
              </div>
            </ScrollReveal>
            <ScrollReveal>
              <ul className="capabilities">
                <li className="capability">
                  <span className="cap-node" aria-hidden="true" />
                  <span className="cap-icon"><InfaixIcon name="forge" size={24} /></span>
                  <span className="cap-copy">
                    <span className="cap-name">Active</span>
                    <span className="cap-desc">
                      Engineering work currently in progress. Software, hardware
                      and infrastructure projects under active development.
                    </span>
                  </span>
                  <span className="cap-to">Building</span>
                </li>
                <li className="capability">
                  <span className="cap-node" aria-hidden="true" />
                  <span className="cap-icon"><InfaixIcon name="ai" size={24} /></span>
                  <span className="cap-copy">
                    <span className="cap-name">Exploring</span>
                    <span className="cap-desc">
                      Robotics, wearable interaction, AI systems, embedded
                      hardware and experimental technology.
                    </span>
                  </span>
                  <span className="cap-to">Research</span>
                </li>
              </ul>
            </ScrollReveal>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
