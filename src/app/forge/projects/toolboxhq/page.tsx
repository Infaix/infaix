import type { Metadata } from "next";
import Link from "next/link";
import ScrollReveal from "@/components/ScrollReveal";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "ToolboxHQ",
  description:
    "Practical developer, file and utility tools built for the web.",
  openGraph: {
    title: "ToolboxHQ | FORGE | INFAIX",
    description:
      "Practical developer, file and utility tools built for the web.",
    url: "https://infaix.com/forge/projects/toolboxhq",
  },
};

export default function ToolboxHQPage() {
  return (
    <>
      <Nav />

      <main>
        <section className="page-hero">
          <div className="container">
            <ScrollReveal>
              <div className="section-label">FORGE / PROJECTS</div>
              <div className="project-status" style={{ marginBottom: 14 }}>
                LIVE
              </div>
              <h1>ToolboxHQ</h1>
              <p>
                Practical developer, file and utility tools built for the
                web.
              </p>
            </ScrollReveal>
          </div>
        </section>

        <section className="section-pad">
          <div className="container" style={{ maxWidth: 720 }}>
            <ScrollReveal>
              <div className="cat-row" style={{ borderTop: "none" }}>
                <div className="cat-title">DESCRIPTION</div>
                <div className="cat-desc">
                  ToolboxHQ is a collection of developer, file and
                  productivity tools designed for practical daily use. Built
                  as part of the INFAIX FORGE environment.
                </div>
              </div>
              <div className="cat-row">
                <div className="cat-title">DOMAIN</div>
                <div className="cat-desc">toolboxhq.infaix.com</div>
              </div>
              <div className="cat-row">
                <div className="cat-title">STATUS</div>
                <div className="cat-desc">Live and active.</div>
              </div>
              <div className="cat-row">
                <div className="cat-title">ENVIRONMENT</div>
                <div className="cat-desc">FORGE</div>
              </div>
              <div className="cat-row">
                <Link
                  href="/forge"
                  className="btn-quiet"
                  style={{ gridColumn: "1 / -1" }}
                >
                  &larr; Back to FORGE
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
