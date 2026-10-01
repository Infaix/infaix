import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import OperationsConsole from "./operations-console";

export const metadata: Metadata = { title: "Operations Console", robots: { index: false, follow: false } };

export default function AdminPage() {
  return <><Nav /><main id="main-content" tabIndex={-1}>
    <section className="page-hero ops-hero"><div className="container">
      <div className="section-label">INFAIX Core / Operations</div>
      <h1>Operations Console</h1>
      <p className="ecosystem-intro">Identity, applications and the systems that connect them.</p>
    </div></section>
    <section className="section-pad ops-section"><div className="container"><OperationsConsole /></div></section>
  </main><Footer /></>;
}
