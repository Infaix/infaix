import type { Metadata } from "next";
import Link from "next/link";
import ScrollReveal from "@/components/ScrollReveal";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Projects",
  description:
    "What comes out of FORGE. Real software, real hardware, real systems shipped and running.",
  openGraph: {
    title: "Projects | FORGE | INFAIX",
    description:
      "What comes out of FORGE. Real software, real hardware, real systems shipped and running.",
    url: "https://infaix.com/forge/projects",
  },
};

export default function ProjectsPage() {
  return (
    <>
      <Nav />

      <main>
        <section className="page-hero">
          <div className="container">
            <ScrollReveal>
              <div className="section-label">Forge / Projects</div>
              <h1>PROJECTS</h1>
              <p>
                What comes out of FORGE. Real software, real hardware,
                real systems shipped and running.
              </p>
            </ScrollReveal>
          </div>
        </section>

        <section className="section-pad" style={{ paddingTop: 20 }}>
          <div className="container">
            <ScrollReveal>
              <div className="section-label">Output</div>
            </ScrollReveal>
            <ScrollReveal>
              <Link
                href="/forge/projects/toolboxhq"
                className="project-card"
                style={{ display: "block" }}
              >
                <div className="project-status">Live</div>
                <h3>ToolboxHQ</h3>
                <p>Practical developer, file and utility tools built for the web.</p>
                <div className="project-meta">Software / Tooling / Active</div>
              </Link>
            </ScrollReveal>
            <ScrollReveal>
              <div className="cat-row">
                <div className="cat-title">PIPELINE</div>
                <div className="cat-desc">
                  Built. Building. Developing. Exploring. Each project is
                  built, tested and operated within the FORGE environment,
                  and released when it&apos;s ready.
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
