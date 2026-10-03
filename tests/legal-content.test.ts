import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LEGAL_DOCUMENTS, LEGAL_LINKS } from "../src/lib/legal-documents";
import { REVIEW_MARKERS, markerById, referencedMarkerIds, splitLegalText } from "../src/lib/legal-content";
import { DECISION_GROUPS } from "../src/lib/legal-decisions";
import { PRIVACY_VERSION, TERMS_VERSION } from "../src/lib/legal-versions";
import { NEWSLETTER_CONSENT_LABEL, NEWSLETTER_SOURCES } from "../src/lib/newsletter-consent";
import { SESSION_COOKIE } from "../worker/auth/sessions";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

/** Every text string in a document, joined so assertions can scan the whole thing. */
function documentText(doc: (typeof LEGAL_DOCUMENTS)[number]): string {
  const parts: string[] = [doc.title, doc.summary];
  for (const section of doc.sections) {
    parts.push(section.heading);
    for (const block of section.blocks) {
      if (block.kind === "table") {
        parts.push(block.caption, ...block.head, ...block.rows.flat());
      } else if (block.kind === "ul" || block.kind === "ol") {
        parts.push(...block.items);
      } else if (block.kind === "review") {
        const marker = markerById(block.marker);
        parts.push(marker ? `${marker.topic} ${marker.question} ${marker.current}` : "");
      } else {
        parts.push(block.text);
      }
    }
  }
  return parts.join("\n");
}

const ALL_TEXT = LEGAL_DOCUMENTS.map(documentText).join("\n");

describe("review markers", () => {
  it("uses only markers that exist", () => {
    const referenced = referencedMarkerIds([...LEGAL_DOCUMENTS]);
    expect(referenced.length).toBeGreaterThan(0);
    for (const id of referenced) expect(markerById(id), `unknown marker ${id}`).toBeDefined();
  });

  it("has no decision that is recorded but never shown", () => {
    const referenced = referencedMarkerIds([...LEGAL_DOCUMENTS]);
    const orphans = REVIEW_MARKERS.filter((m) => !referenced.includes(m.id)).map((m) => m.id);
    expect(orphans).toEqual([]);
  });

  it("carries a question and an as-built note for every decision", () => {
    for (const marker of REVIEW_MARKERS) {
      expect(marker.question.length, marker.id).toBeGreaterThan(20);
      expect(marker.current.length, marker.id).toBeGreaterThan(20);
      expect(marker.topic.trim().length, marker.id).toBeGreaterThan(0);
    }
  });

  it("groups the checklist so it partitions the markers exactly", () => {
    const grouped = DECISION_GROUPS.flatMap((g) => g.ids);
    expect(new Set(grouped).size).toBe(grouped.length);
    const known = REVIEW_MARKERS.map((m) => m.id).sort();
    expect([...grouped].sort()).toEqual(known);
  });
});

describe("cookie policy matches the audited implementation", () => {
  it("lists exactly one cookie, and it is the cookie the Worker actually sets", () => {
    const cookies = LEGAL_DOCUMENTS.flatMap((doc) =>
      doc.sections.flatMap((section) =>
        section.blocks
          .filter((b): b is Extract<typeof b, { kind: "table" }> => b.kind === "table")
          .flatMap((table) => table.rows)
          .map((row) => row[0]),
      ),
    );
    const cookieRows = [...new Set(cookies.filter((name) => name.includes("infaix")))];
    expect(cookieRows).toEqual([SESSION_COOKIE]);
  });

  it("names the deployed cookie name and its lifetime", () => {
    expect(ALL_TEXT).toContain(SESSION_COOKIE);
    expect(ALL_TEXT).toContain("30 days");
  });

  it("never claims a storage API or tracker that the codebase does not use", () => {
    const forbidden = [
      "google-analytics",
      "googletagmanager",
      "gtag",
      "hotjar",
      "clarity",
      "segment",
      "mixpanel",
      "facebook pixel",
      "intercom",
      "sentry",
      "datadog",
    ];
    for (const name of forbidden) expect(ALL_TEXT.toLowerCase()).not.toContain(name);
  });

  it("explains why there is no consent dialog instead of shipping one", () => {
    expect(ALL_TEXT.toLowerCase()).toContain("consent dialog");
  });
});

describe("documents do not invent facts", () => {
  it("makes no bare retention promise for records with no deletion job", () => {
    // Enforced lifetimes the software really has are allowed; a promise about
    // account, audit, conversation or newsletter retention is not.
    const claims = ["we keep for", "we retain for", "kept for up to", "retained for up to", "deleted after"];
    for (const claim of claims) expect(ALL_TEXT.toLowerCase()).not.toContain(claim);
  });

  it("does not claim the Shop is operating", () => {
    const terms = LEGAL_DOCUMENTS.find((d) => d.slug === "terms");
    expect(terms).toBeDefined();
    const shopRow = terms!.sections
      .flatMap((s) => s.blocks)
      .filter((b): b is Extract<typeof b, { kind: "table" }> => b.kind === "table")
      .flatMap((t) => t.rows)
      .find((row) => row[0].includes("Shop"));
    expect(shopRow).toBeDefined();
    expect(shopRow![1]).toBe("Planned");
    expect(shopRow![2].toLowerCase()).toContain("not operating");
  });

  it("does not claim a certification or a liability position", () => {
    expect(ALL_TEXT.toLowerCase()).not.toContain("iso 27001");
    expect(ALL_TEXT.toLowerCase()).not.toContain("soc 2");
    expect(ALL_TEXT.toLowerCase()).not.toContain("gdpr compliant");
    expect(ALL_TEXT.toLowerCase()).toContain("does not claim any external security certification");
  });

  it("never calls product news free advertising", () => {
    expect(ALL_TEXT.toLowerCase()).not.toContain("free advertising");
    expect(read("src/app/page.tsx").toLowerCase()).not.toContain("free advertising");
    expect(read("src/components/newsletter-form.tsx").toLowerCase()).not.toContain("free advertising");
  });
});

describe("document plumbing", () => {
  it("splits inline links into label and destination", () => {
    const parts = splitLegalText("see [[the policy|/legal/privacy]] and [[out|https://example.com]] now");
    expect(parts).toEqual([
      "see ",
      { label: "the policy", href: "/legal/privacy" },
      " and ",
      { label: "out", href: "https://example.com" },
      " now",
    ]);
  });

  it("only links to routes that exist", () => {
    for (const link of LEGAL_LINKS) {
      expect(existsSync(join(ROOT, "src/app", link.href.replace(/^\//, ""), "page.tsx")), link.href).toBe(true);
    }
  });

  it("keeps the client-visible version strings in step with the documents", () => {
    const terms = LEGAL_DOCUMENTS.find((d) => d.slug === "terms")!;
    const privacy = LEGAL_DOCUMENTS.find((d) => d.slug === "privacy")!;
    expect(TERMS_VERSION).toBe(terms.version);
    expect(PRIVACY_VERSION).toBe(privacy.version);
  });

  it("gives every document a version, a date and non-empty prose", () => {
    for (const doc of LEGAL_DOCUMENTS) {
      expect(doc.version, doc.slug).toMatch(/\d{4}-\d{2}-\d{2}$/);
      expect(doc.effective.length, doc.slug).toBeGreaterThan(0);
      expect(doc.sections.length, doc.slug).toBeGreaterThan(3);
      expect(documentText(doc).length, doc.slug).toBeGreaterThan(800);
    }
  });

  it("gives every section a unique anchor", () => {
    for (const doc of LEGAL_DOCUMENTS) {
      const ids = doc.sections.map((s) => s.id);
      expect(new Set(ids).size, doc.slug).toBe(ids.length);
    }
  });
});

describe("consent surfaces", () => {
  it("labels every newsletter capture surface the Worker accepts", () => {
    expect(NEWSLETTER_SOURCES).toContain("footer-form");
    expect(NEWSLETTER_SOURCES).toContain("homepage");
    // Phase 1 surfaces must keep working.
    expect(NEWSLETTER_SOURCES).toContain("registration");
    expect(NEWSLETTER_SOURCES).toContain("account-settings");
    expect(read("src/components/newsletter-form.tsx")).toContain("NEWSLETTER_POLICY_VERSION");
  });

  it("never sends consent unless the box was actually ticked", () => {
    const form = read("src/components/newsletter-form.tsx");
    expect(form).toContain("const [consent, setConsent] = useState(false)");
    expect(form).toContain("if (!consent)");
    expect(form).toMatch(/if \(!consent\) \{[\s\S]*?setError\([\s\S]*?return;[\s\S]*?\}/);
  });

  it("keeps signup acknowledgement and marketing consent as separate, unticked controls", () => {
    const form = read("src/app/register/form.tsx");
    expect(form).toContain("const [newsletter, setNewsletter] = useState(false)");
    expect(form).toContain("const [terms, setTerms] = useState(false)");
    expect(form).not.toContain("useState(true)");
    // The acknowledgement is a hard gate; the newsletter is not.
    expect(form).toMatch(/if \(!terms\) \{[\s\S]*?setError\([\s\S]*?return;/);
    expect(form).toContain("/legal/terms");
    expect(form).toContain("/legal/privacy");
    expect(form).toContain("NEWSLETTER_CONSENT_LABEL");
    expect(form).toContain("from \"@/lib/newsletter-consent\"");
    // The label has to say what it is and how to get out of it.
    expect(NEWSLETTER_CONSENT_LABEL).toContain("Optional");
    expect(NEWSLETTER_CONSENT_LABEL).toContain("Unsubscribe");
  });

  it("keeps account and security mail outside the newsletter choice", () => {
    const form = read("src/components/newsletter-form.tsx");
    expect(form).toMatch(/Never an\s+account or security message/);
    const account = read("src/app/account/dashboard.tsx");
    expect(account).toContain("/legal/privacy");
    expect(account).toContain("/legal/cookies");
  });

  it("adds no storage or tracking surface to the site", () => {
    const sources = ["src/components/newsletter-form.tsx", "src/components/legal-document.tsx", "src/app/legal/page.tsx"];
    for (const file of sources) {
      const body = read(file);
      expect(body, file).not.toContain("localStorage");
      expect(body, file).not.toContain("sessionStorage");
      expect(body, file).not.toContain("document.cookie");
      expect(body, file).not.toContain("indexedDB");
    }
  });
});

describe("signature footer is preserved", () => {
  it("keeps the mark, wordmark, axis and bottom bar", () => {
    const footer = read("src/components/Footer.tsx");
    expect(footer).toContain("footer-signature");
    expect(footer).toContain("InfaixLogo");
    expect(footer).toContain("footer-wordmark");
    expect(footer).toContain("footer-axis");
    expect(footer).toContain("footer-bottom");
  });

  it("adds the news band and legal row rather than replacing the signature", () => {
    const footer = read("src/components/Footer.tsx");
    expect(footer).toContain("footer-news");
    expect(footer).toContain("footer-legal");
    expect(footer).toContain("LEGAL_LINKS");
    expect(footer).toContain('aria-label="Legal and privacy"');
    expect(footer).toContain("/legal#decisions");
    // Every document is reachable from the footer, not just some of them.
    expect(LEGAL_LINKS.length).toBe(3);
  });
});