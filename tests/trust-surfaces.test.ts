import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LEGAL_DOCUMENTS } from "../src/lib/legal-documents";
import {
  MARKER_KINDS,
  REVIEW_MARKERS,
  markerById,
  markerKind,
  referencedMarkerIds,
  type MarkerKind,
} from "../src/lib/legal-content";
import { DECISION_GROUPS } from "../src/lib/legal-decisions";
import { PRIVACY_VERSION, TERMS_VERSION } from "../src/lib/legal-versions";
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "../worker/auth/legal";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const doc = (slug: string) => {
  const found = LEGAL_DOCUMENTS.find((d) => d.slug === slug);
  if (!found) throw new Error(`missing document ${slug}`);
  return found;
};

function docText(slug: string): string {
  const parts: string[] = [];
  for (const section of doc(slug).sections) {
    parts.push(section.heading);
    for (const block of section.blocks) {
      if (block.kind === "table") parts.push(block.caption, ...block.head, ...block.rows.flat());
      else if (block.kind === "ul" || block.kind === "ol") parts.push(...block.items);
      else if (block.kind === "review") {
        const m = markerById(block.marker);
        parts.push(m ? `${m.topic} ${m.question} ${m.current}` : "");
      } else if (block.kind === "fact") parts.push(block.title, block.text);
      else parts.push(block.text);
    }
  }
  return parts.join("\n");
}

const VALID_KINDS: MarkerKind[] = [
  "OWNER DECISION REQUIRED",
  "LEGAL REVIEW REQUIRED",
  "PRODUCT GAP",
  "IMPLEMENTATION UNKNOWN",
];

describe("marker classification (§20)", () => {
  it("classifies every unresolved item, with no undefined or invented kind", () => {
    for (const marker of REVIEW_MARKERS) {
      expect(Object.keys(MARKER_KINDS), marker.id).toContain(marker.id);
      expect(VALID_KINDS, marker.id).toContain(MARKER_KINDS[marker.id]);
    }
  });

  it("marks the missing self-service controls as product gaps rather than features", () => {
    for (const id of ["erasure", "data-export", "access-requests", "marketing-unsubscribe"]) {
      expect(markerKind(id), id).toBe("PRODUCT GAP");
    }
  });

  it("does not describe a product gap as if the control existed", () => {
    const privacy = docText("privacy");
    expect(privacy).toContain("no self-service account deletion");
    expect(privacy.toLowerCase()).not.toContain("you can delete your account");
    expect(privacy.toLowerCase()).not.toContain("download your data");
  });

  it("ships no deletion or export control in the account UI", () => {
    const dashboard = read("src/app/account/dashboard.tsx").toLowerCase();
    expect(dashboard).not.toContain("delete account");
    expect(dashboard).not.toContain("download my data");
    const router = read("worker/auth/router.ts");
    expect(router).not.toMatch(/account\/(delete|export)/);
  });
});

describe("legal acceptance records are disclosed (§3)", () => {
  it("describes the acceptance record and what it deliberately excludes", () => {
    const privacy = docText("privacy");
    expect(privacy).toContain("Legal acceptance records");
    expect(privacy).toContain("terms version");
    expect(privacy).toContain("privacy version");
    expect(privacy).toMatch(/no IP address, no user agent and no device information/);
  });

  it("states the acceptance record is separate from newsletter consent", () => {
    expect(docText("privacy")).toMatch(/not joined to your newsletter subscription/);
    expect(docText("terms")).toMatch(/kept separately from your newsletter subscription/);
  });

  it("records the acceptance in the Terms as well", () => {
    expect(docText("terms")).toMatch(/recorded with your account/);
    expect(docText("terms")).toMatch(/records no IP address or device information/);
  });

  it("leaves acceptance retention open rather than inventing a period", () => {
    expect(markerById("legal-acceptance-retention")).toBeDefined();
    expect(docText("privacy")).toContain("Retention: legal acceptance records");
    expect(markerKind("legal-acceptance-retention")).toBe("OWNER DECISION REQUIRED");
  });
});

describe("policy versioning is preserved (§21)", () => {
  it("keeps the current versions unchanged", () => {
    expect(TERMS_VERSION).toBe("terms-2026-10-03");
    expect(PRIVACY_VERSION).toBe("privacy-2026-10-03");
    expect(doc("terms").version).toBe(TERMS_VERSION);
    expect(doc("privacy").version).toBe(PRIVACY_VERSION);
  });

  it("keeps the server's enforced versions identical to the published ones", () => {
    expect(CURRENT_TERMS_VERSION).toBe(doc("terms").version);
    expect(CURRENT_PRIVACY_VERSION).toBe(doc("privacy").version);
  });

  it("sends exactly those versions from the registration form", () => {
    const form = read("src/app/register/form.tsx");
    expect(form).toContain("termsVersion: TERMS_VERSION");
    expect(form).toContain("privacyVersion: PRIVACY_VERSION");
    expect(form).toContain("accepted: true");
  });
});

describe("Shop boundary (§18)", () => {
  it("does not present Shop as operating", () => {
    const terms = docText("terms");
    expect(terms).toContain("INFAIX Shop is not a shop you can use");
    expect(terms).toMatch(/does not currently sell anything/);
  });

  it("invents no commerce policy for a service that cannot take an order", () => {
    const all = LEGAL_DOCUMENTS.map((d) => docText(d.slug)).join("\n").toLowerCase();
    for (const invention of ["refund policy", "shipping policy", "shipping rates", "delivery times", "payment methods"]) {
      expect(all, invention).not.toContain(invention);
    }
  });

  it("records the required commerce pass instead", () => {
    const marker = markerById("shop-commerce-compliance");
    expect(marker).toBeDefined();
    expect(markerKind("shop-commerce-compliance")).toBe("LEGAL REVIEW REQUIRED");
    expect(marker!.current).toMatch(/Australian Consumer Law/);
    expect(marker!.current).toMatch(/PCI scope/);
  });
});

describe("AI output notice is a product requirement, not a blanket disclaimer (§19)", () => {
  it("records the open question against the restricted AI product", () => {
    const marker = markerById("ai-output-notice");
    expect(marker).toBeDefined();
    expect(markerKind("ai-output-notice")).toBe("LEGAL REVIEW REQUIRED");
    expect(marker!.current).toMatch(/restricted/);
  });

  it("does not make a sweeping disclaimer document", () => {
    const all = LEGAL_DOCUMENTS.map((d) => docText(d.slug)).join("\n").toLowerCase();
    expect(LEGAL_DOCUMENTS.map((d) => d.slug)).not.toContain("disclaimer");
    expect(all).not.toContain("100% secure");
    expect(all).not.toContain("military-grade");
    expect(all).not.toContain("unhackable");
  });
});

describe("transactional and marketing stay separate (§10)", () => {
  it("keeps account mail free of promotional language", () => {
    const templates = read("worker/auth/email-templates.ts");
    expect(templates).toMatch(/about your account, not a promotion/);
    for (const leak of ["newsletter", "product news", "subscribe", "discount"]) {
      expect(templates.toLowerCase(), leak).not.toContain(leak);
    }
  });

  it("says in both the UI and the policy that marketing opt-out is marketing-only", () => {
    expect(docText("privacy")).toMatch(/They are sent regardless of your newsletter choice/);
    expect(read("src/components/newsletter-form.tsx")).toMatch(/Never an\s+account or security message/);
  });
});

describe("newsletter stays an explicit opt-in (§9, §8)", () => {
  it("never pre-checks marketing consent", () => {
    const form = read("src/app/register/form.tsx");
    expect(form).toContain("const [newsletter, setNewsletter] = useState(false)");
    expect(form).toContain("const [terms, setTerms] = useState(false)");
    expect(form).not.toContain("useState(true)");
    expect(form).toContain("<fieldset className=\"auth-optional\">");
  });

  it("does not describe the newsletter as advertising", () => {
    for (const file of ["src/app/page.tsx", "src/components/newsletter-form.tsx", "src/components/Footer.tsx"]) {
      expect(read(file).toLowerCase(), file).not.toContain("free advertising");
    }
  });
});

describe("no private Chat exposure (§4)", () => {
  it("keeps development and private origins out of the legal surfaces", () => {
    for (const slug of ["privacy", "terms", "cookies"]) {
      expect(docText(slug), slug).not.toContain("chat.infaix");
      expect(docText(slug), slug).not.toContain("127.0.0.1");
    }
  });

  it("describes the handoff without naming a private destination", () => {
    const privacy = docText("privacy");
    expect(privacy).toContain("signed identity assertion");
    expect(privacy).toMatch(/No name, no email address/);
  });
});

describe("checklist integrity", () => {
  it("partitions the marker set exactly", () => {
    const grouped = DECISION_GROUPS.flatMap((g) => g.ids);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect([...grouped].sort()).toEqual(REVIEW_MARKERS.map((m) => m.id).sort());
  });

  it("surfaces every marker in at least one document", () => {
    const referenced = referencedMarkerIds([...LEGAL_DOCUMENTS]);
    expect(REVIEW_MARKERS.filter((m) => !referenced.includes(m.id)).map((m) => m.id)).toEqual([]);
  });

  it("renders the classification in the hub", () => {
    const hub = read("src/app/legal/page.tsx");
    expect(hub).toContain("markerKind(");
    expect(hub).toContain("legal-decision-kind");
    expect(hub).toContain("legal-kind-summary");
    // Every classification must be reachable as a label, not just as a type.
    for (const kind of VALID_KINDS) expect(hub, kind).toContain(kind);
  });
});