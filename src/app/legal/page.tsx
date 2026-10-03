import type { Metadata } from "next";
import Link from "next/link";
import ScrollReveal from "@/components/ScrollReveal";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { REVIEW_MARKERS, markerById } from "@/lib/legal-content";
import { LEGAL_DOCUMENTS } from "@/lib/legal-documents";
import { DECISION_GROUPS } from "@/lib/legal-decisions";

/**
 * The checklist groups live in `lib/legal-decisions` so they can be tested in
 * Node. `tests/legal-content.test.ts` asserts they partition the marker set.
 */

export const metadata: Metadata = {
  title: "Legal & trust",
  description:
    "INFAIX Core's privacy policy, terms of use and cookie policy, plus the decisions still awaiting owner and legal review.",
  openGraph: {
    title: "Legal & trust | INFAIX",
    description:
      "INFAIX Core's privacy policy, terms of use and cookie policy, plus the decisions still awaiting owner and legal review.",
    url: "https://infaix.com/legal",
  },
};

export default function LegalIndexPage() {
  return (
    <>
      <Nav />

      <main id="main-content" tabIndex={-1}>
        <section className="page-hero">
          <div className="page-frame" aria-hidden="true">
            <span />
            <span />
          </div>
          <div className="container">
            <ScrollReveal>
              <p className="instrument-label">Trust</p>
              <h1>Legal</h1>
              <p>
                What INFAIX Core actually does with your information, written from
                the code rather than from a template — including the parts that
                are still undecided.
              </p>
            </ScrollReveal>
          </div>
        </section>

        <section className="section-pad is-subpage">
          <div className="container band">
            <ScrollReveal>
              <div className="band-head">
                <span className="instrument-index" aria-hidden="true">
                  01
                </span>
                <div>
                  <p className="instrument-label">Documents</p>
                  <h2>What applies to you.</h2>
                </div>
                <p className="band-note">
                  These documents describe the service as it is built today, not as
                  it is planned.
                </p>
              </div>
            </ScrollReveal>
            <ul className="legal-index-list">
              {LEGAL_DOCUMENTS.map((doc) => (
                <li key={doc.slug}>
                  <ScrollReveal>
                    <Link href={`/legal/${doc.slug}`} className="legal-index-card">
                      <p className="instrument-label">{doc.label}</p>
                      <h3>{doc.title}</h3>
                      <p>{doc.summary}</p>
                      <span className="project-card-action">
                        Read <span aria-hidden="true">→</span>
                      </span>
                    </Link>
                  </ScrollReveal>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section-pad is-subpage">
          <div className="container band">
            <ScrollReveal>
              <div className="band-head">
                <span className="instrument-index" aria-hidden="true">
                  02
                </span>
                <div>
                  <p className="instrument-label">How this is written</p>
                  <h2>Verified, or marked as undecided.</h2>
                </div>
                <p className="band-note">
                  Every factual claim in these documents maps to something in the
                  codebase. Where a fact was missing, the text says so instead of
                  filling the gap.
                </p>
              </div>
            </ScrollReveal>
            <ScrollReveal>
              <div className="legal-explainer">
                <div className="legal-explainer-item">
                  <p className="instrument-label">Verified</p>
                  <p>
                    Checked against the database schema, the Worker routes, and the
                    behaviour the tests pin down. Storage, lifetimes and access rules
                    are described as they actually are.
                  </p>
                </div>
                <div className="legal-explainer-item">
                  <p className="instrument-label">Decision needed</p>
                  <p>
                    A question only the owner or counsel can answer — a retention
                    period, a jurisdiction, a contact address. Each appears inline
                    in the document and in the checklist below.
                  </p>
                </div>
                <div className="legal-explainer-item">
                  <p className="instrument-label">Kept true automatically</p>
                  <p>
                    The service-status table in the Terms is generated from the same
                    registry that drives the product directory, so it cannot drift
                    away from what is running.
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        <section className="section-pad is-subpage" id="decisions">
          <div className="container band">
            <ScrollReveal>
              <div className="band-head">
                <span className="instrument-index" aria-hidden="true">
                  03
                </span>
                <div>
                  <p className="instrument-label">Outstanding</p>
                  <h2>{REVIEW_MARKERS.length} decisions awaiting owner or legal review.</h2>
                </div>
                <p className="band-note">
                  Nothing in this list is a defect in the product. Each one is a
                  judgement call that has been recorded rather than guessed at.
                </p>
              </div>
            </ScrollReveal>

            {DECISION_GROUPS.map((group, gi) => (
              <div key={group.title} className="legal-decision-group">
                <ScrollReveal>
                  <h3 className="legal-decision-group-title">
                    <span className="instrument-index" aria-hidden="true">
                      {String(gi + 1).padStart(2, "0")}
                    </span>
                    {group.title}
                  </h3>
                  <p className="legal-decision-note">{group.note}</p>
                  <ol className="legal-decision-list">
                    {group.ids.map((id) => {
                      const marker = markerById(id);
                      if (!marker) return null;
                      return (
                        <li key={id} className="legal-decision">
                          <p className="legal-decision-topic">
                            {marker.topic}
                            <span className="legal-decision-id">{marker.id}</span>
                          </p>
                          <p className="legal-decision-question">{marker.question}</p>
                          <p className="legal-decision-current">
                            <span className="legal-decision-current-label">As built:</span> {marker.current}
                          </p>
                        </li>
                      );
                    })}
                  </ol>
                </ScrollReveal>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}