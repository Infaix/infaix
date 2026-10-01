import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import OperationsConsole from "./operations-console";

export const metadata: Metadata = { title: "Operations Console", robots: { index: false, follow: false } };

export default function AdminPage() {
  return <><Nav /><main id="main-content" tabIndex={-1} className="ops-main">
    <section className="ops-head"><div className="container ops-container">
      <div className="section-label">INFAIX Core / Operations</div>
      <h1>Operations Console</h1>
      <p>Identity, applications and the systems that connect them. Figures appear only when the Worker can supply them.</p>
    </div></section>
    <section className="ops-section"><div className="container ops-container"><OperationsConsole /></div></section>
  </main><Footer /></>;
}
