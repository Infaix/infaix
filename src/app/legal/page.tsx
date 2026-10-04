import type { Metadata } from "next";
import Link from "next/link";
import ScrollReveal from "@/components/ScrollReveal";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { REVIEW_MARKERS, markerById, markerKind, type MarkerKind } from "@/lib/legal-content";
import { LEGAL_DOCUMENTS } from "@/lib/legal-documents";
import { DECISION_GROUPS } from "@/lib/legal-decisions";

/**
 * The checklist groups live in `lib/legal-decisions` so they can be tested in
 * Node. `tests/legal-content.test.ts` asserts they partition the marker set,
 * and that every marker carries one of the classifications below.
 */

export const metadata: Metadata = {
  title: "Legal & trust",
  description:
    "INFAIX Core's privacy policy, terms of use and cookie policy, the controls you actually have, and the decisions still awaiting owner, legal or product work.",
  openGraph: {
    title: "Legal & trust | INFAIX",
    description:
      "INFAIX Core's privacy policy, terms of use and cookie policy, the controls you actually have, and the decisions still awaiting owner, legal or product work.",
    url: "https://infaix.com/legal",
  },
};

const KIND_ORDER: MarkerKind[] = [
  "OWNER DECISION REQUIRED",
  "LEGAL REVIEW REQUIRED",
  "PRODUCT GAP",
  "IMPLEMENTATION UNKNOWN",
];

const KIND_NOTES: Record<MarkerKind, string> = {
  "OWNER DECISION REQUIRED": "Only INFAIX can settle these, usually with a business answer or counsel.",
  "LEGAL REVIEW REQUIRED": "Drafting questions for a lawyer. The text is left open rather than guessed.",
  "PRODUCT GAP": "A control the product does not have. Listed as a gap, never shipped as a control that does nothing.",
  "IMPLEMENTATION UNKNOWN": "The code does not establish the fact either way, so no claim is made.",
};

const CONTROLS: { label: string; title: string; body: string; href: string; cta: string; gap?: boolean }[] = [
  {
    label: "Email preferences",
    title: "Product news on or off",
    body: "Start or stop INFAIX product news from your account. Turning it off stops marketing only. Verification, password reset and security notices are transactional and continue either way.",
    href: "/account",
    cta: "Manage in account",
  },
  {
    label: "Account & data",
    title: "Correct and secure",
    body: "See what INFAIX holds about your account, change your display name, change your password, resend a verification email, and end your session. Changing your password signs out your other sessions.",
    href: "/account",
    cta: "Open account",
  },
  {
    label: "Browser storage",
    title: "One necessary cookie",
    body: "Signing out clears INFAIX's only cookie immediately. There is nothing optional to manage, and no consent state is stored in your browser.",
    href: "/legal/cookies",
    cta: "Read the cookie policy",
  },
  {
    label: "Not available yet",
    title: "Deletion, export, privacy requests",
    body: "INFAIX has no self-service account deletion, no data export, and no intake channel for privacy requests. These are recorded as product gaps rather than presented as working controls.",
    href: "#decisions",
    cta: "See the gaps",
    gap: true,
  },
];

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
                the code rather than from a template — including the parts that are
                still undecided.
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
                  These documents describe the service as it is built today, not as it
                  is planned.
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
                  <p className="instrument-label">Your controls</p>
                  <h2>What you can actually do.</h2>
                </div>
                <p className="band-note">
                  Every control here works today, inside INFAIX. Controls that do not
                  exist are labelled as gaps rather than shipped as buttons.
                </p>
              </div>
            </ScrollReveal>
            <ul className="legal-index-list">
              {CONTROLS.map((c) => (
                <li key={c.title}>
                  <ScrollReveal>
                    <Link href={c.href} className={`legal-index-card${c.gap ? " is-gap" : ""}`}>
                      <p className="instrument-label">{c.label}</p>
                      <h3>{c.title}</h3>
                      <p>{c.body}</p>
                      <span className="project-card-action">
                        {c.cta} <span aria-hidden="true">→</span>
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
                  03
                </span>
                <div>
                  <p className="instrument-label">How this is written</p>
                  <h2>Verified, or marked as undecided.</h2>
                </div>
                <p className="band-note">
                  Every factual claim in these documents maps to something in the
                  codebase. Where a fact was missing, the text says so instead of filling
                  the gap.
                </p>
              </div>
            </ScrollReveal>
            <ScrollReveal>
              <div className="legal-explainer">
                <div className="legal-explainer-item">
                  <p className="instrument-label">Verified</p>
                  <p>
                    Checked against the database schema, the Worker routes, and the
                    behaviour the tests pin down. Storage, lifetimes and access rules are
                    described as they actually are.
                  </p>
                </div>
                <div className="legal-explainer-item">
                  <p className="instrument-label">Marked, not guessed</p>
                  <p>
                    Where a fact was missing, the document carries a marked item naming
                    the question, and the collection below says who has to answer it. A
                    gap is never smoothed over with plausible wording.
                  </p>
                </div>
                <div className="legal-explainer-item">
                  <p className="instrument-label">Kept true automatically</p>
                  <p>
                    The service-status table in the Terms is generated from the same
                    registry that drives the product directory, and the policy versions
                    the signup form sends are the ones the server checks. Neither can
                    drift away from what is running.
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
                  04
                </span>
                <div>
                  <p className="instrument-label">Outstanding</p>
                  <h2>{REVIEW_MARKERS.length} items awaiting owner, legal or product work.</h2>
                </div>
                <p className="band-note">
                  Nothing in this list is a defect in the running product. Each one is a
                  judgement or a missing feature that has been recorded rather than
                  guessed at.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal>
              <dl className="legal-kind-summary">
                {KIND_ORDER.map((kind) => (
                  <div key={kind} className="legal-kind" data-kind={kind}>
                    <dt>{kind}</dt>
                    <dd>
                      <span className="legal-kind-count">
                        {REVIEW_MARKERS.filter((m) => markerKind(m.id) === kind).length}
                      </span>
                      {KIND_NOTES[kind]}
                    </dd>
                  </div>
                ))}
              </dl>
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
                            <span className="legal-decision-kind" data-kind={markerKind(marker.id)}>
                              {markerKind(marker.id)}
                            </span>
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