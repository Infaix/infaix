import type { Metadata } from "next";
import AIChat from "@/components/AIChat";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "INFAIX AI",
  description:
    "An AI running inside FORGE. Connect to INFAIX's self-hosted AI infrastructure.",
  openGraph: {
    title: "INFAIX AI | INFAIX",
    description:
      "An AI running inside FORGE. Connect to INFAIX's self-hosted AI infrastructure.",
    url: "https://infaix.com/ai",
  },
};

export default function AIPage() {
  return (
    <>
      <Nav />

      <main>
        <section className="page-hero">
          <div className="container">
            <h1>INFAIX AI</h1>
            <p>An AI running inside FORGE.</p>
          </div>
        </section>

        <section className="section-pad" style={{ paddingTop: 0 }}>
          <div className="container ai-wrap">
            <AIChat />
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}