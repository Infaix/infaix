import type { Metadata } from "next";
import Link from "next/link";
import ScrollReveal from "@/components/ScrollReveal";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "About",
  description:
    "What INFAIX is, what it explores, and the relationship between INFAIX and FORGE.",
  openGraph: {
    title: "About | INFAIX",
    description:
      "What INFAIX is, what it explores, and the relationship between INFAIX and FORGE.",
    url: "https://infaix.com/about",
  },
};

export default function AboutPage() {
  return (
    <>
      <Nav />

      <main>
        <section className="page-hero">
          <div className="container">
            <ScrollReveal>
              <div className="section-label">ABOUT</div>
              <h1>INFAIX</h1>
              <p>Independent technology & engineering.</p>
            </ScrollReveal>
          </div>
        </section>

        <section className="section-pad" style={{ paddingTop: 0 }}>
          <div className="container" style={{ maxWidth: 720 }}>
            <ScrollReveal>
              <div className="cat-row" style={{ borderTop: "none" }}>
                <div className="cat-title">WHAT</div>
                <div className="cat-desc">
                  INFAIX is an independent technology and engineering
                  environment. It explores and builds across software, AI,
                  robotics, hardware and infrastructure.
                </div>
              </div>
              <div className="cat-row">
                <div className="cat-title">WHY</div>
                <div className="cat-desc">
                  To build real systems. To understand how things work by
                  making them ourselves. To push the boundary between software
                  and physical hardware.
                </div>
              </div>
              <div className="cat-row">
                <div className="cat-title">FORGE</div>
                <div className="cat-desc">
                  FORGE is INFAIX&apos;s technical creation environment.
                  Infrastructure, compute, AI, fabrication and bench space.
                  Everything INFAIX builds runs through FORGE.
                </div>
              </div>
              <div className="cat-row">
                <div className="cat-title">PROJECTS</div>
                <div className="cat-desc">
                  The output of FORGE. Real software, real hardware, real
                  systems. Each project is built, tested and operated within
                  the FORGE environment.
                </div>
              </div>
              <div className="cat-row">
                <div className="cat-title">PHILOSOPHY</div>
                <div className="cat-desc">
                  Build it. Break it. Understand it. Improve it.
                </div>
              </div>
              <div className="cat-row">
                <Link
                  href="/forge"
                  className="btn-quiet"
                  style={{ gridColumn: "1 / -1" }}
                >
                  Explore FORGE <span>&rarr;</span>
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </section>

        <section className="section-pad philosophy">
          <div className="container">
            <ScrollReveal>
              <h2>
                Build it.
                <br />
                Break it.
                <br />
                Understand it.
                <br />
                Improve it.
              </h2>
            </ScrollReveal>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
