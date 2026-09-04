import Image from "next/image";
import Link from "next/link";
import ScrollReveal from "@/components/ScrollReveal";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

const capabilities = [
  {
    title: "SOFTWARE",
    desc: "Applications, systems, tooling and infrastructure built for performance and reliability.",
    forge: "FORGE \u2014 CI/CD \u00B7 Compute \u00B7 Deploy",
  },
  {
    title: "AI SYSTEMS",
    desc: "Self-hosted intelligence, local models, and custom AI pipelines designed to run within FORGE.",
    forge: "FORGE \u2014 AI \u00B7 Compute \u00B7 Storage",
  },
  {
    title: "ROBOTICS",
    desc: "Autonomous systems, sensors, and physical computing bridging software and hardware.",
    forge: "FORGE \u2014 Fabrication \u00B7 Bench \u00B7 Compute",
  },
  {
    title: "HARDWARE & ELECTRONICS",
    desc: "Custom circuits, embedded systems, and physical devices designed and prototyped in-house.",
    forge: "FORGE \u00B7 Fabrication \u00B7 Bench",
  },
  {
    title: "INFRASTRUCTURE",
    desc: "Networks, servers, storage and orchestration that underpin the entire INFAIX environment.",
    forge: "FORGE \u2014 Compute \u00B7 Network \u00B7 Storage",
  },
];

const forgeNodes = [
  "COMPUTE",
  "NETWORK",
  "STORAGE",
  "AI",
  "CI/CD",
  "FABRICATION",
  "BENCH",
];

export default function HomePage() {
  return (
    <>
      <Nav />

      <div className="grid-bg" aria-hidden="true" />

      <main>
        {/* Hero */}
        <section className="hero">
          <div className="container hero-inner">
            <Image
              src="/infaix-logo.png"
              alt=""
              width={48}
              height={48}
              className="hero-mark"
              priority
            />
            <h1>INFAIX</h1>
            <h2>Independent technology & engineering.</h2>
            <p>
              Software, AI, robotics, hardware and infrastructure.
              <br />
              Build what&apos;s next.
            </p>
            <div className="hero-ctas">
              <Link href="/forge" className="btn-primary">
                ENTER FORGE
              </Link>
              <Link href="/ai" className="btn-quiet">
                INFAIX AI <span>&rarr;</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Three-layer ecosystem */}
        <section className="section-pad">
          <div className="container">
            <ScrollReveal>
              <div className="section-label">ECOSYSTEM</div>
            </ScrollReveal>
            <ScrollReveal>
              <div className="ecosystem">
                <div className="eco-cell">
                  <div className="eco-layer">ORGANISATION</div>
                  <div className="eco-title">INFAIX</div>
                  <p className="eco-desc">
                    The identity. The hub. Independent technology and
                    engineering across software, AI, robotics and
                    infrastructure.
                  </p>
                </div>
                <div className="eco-cell">
                  <div className="eco-layer">INFRASTRUCTURE</div>
                  <div className="eco-title">FORGE</div>
                  <p className="eco-desc">
                    The environment. Compute, network, storage, AI pipelines
                    and fabrication where everything is built, tested and
                    operated.
                  </p>
                </div>
                <div className="eco-cell">
                  <div className="eco-layer">OUTPUT</div>
                  <div className="eco-title">PROJECTS</div>
                  <p className="eco-desc">
                    What comes out of FORGE. Real software, real hardware,
                    real systems shipped and running.
                  </p>
                </div>
              </div>
            </ScrollReveal>
            <div className="eco-connector">
              <span>&rarr;</span>
            </div>
          </div>
        </section>

        {/* What We Build */}
        <section className="section-pad">
          <div className="container">
            <ScrollReveal>
              <div className="section-label">WHAT WE BUILD</div>
            </ScrollReveal>
            {capabilities.map((cap, i) => (
              <ScrollReveal key={cap.title}>
                <div className="capability">
                  <div className="cap-index">{String(i + 1).padStart(2, "0")}</div>
                  <div className="cap-body">
                    <h3>{cap.title}</h3>
                    <p>{cap.desc}</p>
                    <div className="cap-forge">{cap.forge}</div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* FORGE section */}
        <section id="forge" className="section-pad forge-section">
          <div className="container">
            <div className="forge-layout">
              <ScrollReveal direction="left">
                <div className="forge-copy">
                  <h2>FORGE</h2>
                  <h3>The technical creation environment.</h3>
                  <p>
                    INFAIX&apos;s engineering infrastructure. Where projects
                    are built, tested and operated on real hardware and real
                    networks.
                  </p>
                  <ul className="forge-specs">
                    {forgeNodes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                  <Link href="/forge" className="btn-quiet">
                    Explore FORGE <span>&rarr;</span>
                  </Link>
                </div>
              </ScrollReveal>

              <ScrollReveal direction="right">
                <div className="forge-diagram" role="img" aria-label="FORGE infrastructure diagram showing compute, network, storage, AI, CI/CD, fabrication and bench feeding into projects">
                  {forgeNodes.map((n) => (
                    <div className="forge-node" key={n}>
                      <span className="node-dot" />
                      {n}
                    </div>
                  ))}
                  <div className="forge-lines" aria-hidden="true">
                    {"\u2502"}
                  </div>
                  <div className="forge-sink">
                    <span className="node-dot" />
                    PROJECTS
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* Philosophy */}
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
              <p className="phil-sub">
                INFAIX is an independent technology and engineering
                environment exploring what&apos;s possible across software,
                AI, robotics, hardware and infrastructure.
              </p>
            </ScrollReveal>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
