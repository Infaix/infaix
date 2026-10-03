import Link from "next/link";
import InfaixLogo from "@/components/infaix-logo";
import InfaixIcon from "@/components/icons";
import NewsletterForm from "@/components/newsletter-form";
import { LEGAL_LINKS } from "@/lib/legal-documents";

const links = [
  { href: "/", label: "INFAIX", icon: "core" as const },
  { href: "/forge", label: "FORGE", icon: "forge" as const },
  { href: "/ai", label: "AI", icon: "ai" as const },
  { href: "/about", label: "About", icon: "atlas" as const },
];

/**
 * The signature closes the page on the same image that opened it: the mark at
 * a size where its facet structure is actually legible, on the same
 * converging-spoke geometry as the hero, with the three-stage axis stated
 * once more as the spine of the footer.
 *
 * Below that signature the footer carries the two things a visitor has a right
 * to reach from anywhere: the legal documents, and a way to ask for product
 * news. Both are additions to the existing composition — the signature block,
 * the axis and the bottom bar are unchanged.
 */
export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-signature">
          <span className="footer-mark" aria-hidden="true">
            <InfaixLogo variant="footer" />
          </span>
          <span className="footer-identity">
            <span className="footer-wordmark">INFAIX</span>
            <span className="footer-tagline">Independent technology &amp; engineering.</span>
          </span>
          <span className="footer-axis" aria-hidden="true">
            <span className="footer-axis-label">Core</span>
            <span className="footer-axis-track">
              <span className="footer-axis-node is-core" />
              <span className="footer-axis-node" />
              <span className="footer-axis-node" />
            </span>
            <span className="footer-axis-label">Projects</span>
          </span>
        </div>

        <nav className="footer-links" aria-label="Footer">
          <ul>
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href}>
                  <InfaixIcon name={l.icon} size={18} />
                  <span>{l.label}</span>
                </Link>
              </li>
            ))}
            <li>
              <a href="https://github.com/infaix" target="_blank" rel="noopener noreferrer">
                <InfaixIcon name="forge" size={18} />
                <span>GitHub</span>
                <span className="footer-external" aria-hidden="true">↗</span>
              </a>
            </li>
          </ul>
        </nav>

        <div className="footer-news">
          <div className="footer-news-copy">
            <p className="instrument-label">Product news</p>
            <p className="footer-news-lede">
              Launches, project updates, beta and early-access invitations, and
              major feature releases. First-party only, no account required.
            </p>
          </div>
          <NewsletterForm source="footer-form" className="footer-news-form" />
        </div>

        <nav className="footer-legal" aria-label="Legal and privacy">
          <p className="instrument-label">Legal &amp; privacy</p>
          <ul>
            {LEGAL_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
              </li>
            ))}
            <li>
              <Link href="/legal#decisions">Open decisions</Link>
            </li>
          </ul>
          <p className="footer-legal-note">
            INFAIX uses one strictly necessary cookie and no trackers, so there is no
            consent dialog to dismiss. Full detail in the cookie policy.
          </p>
        </nav>

        <div className="footer-bottom">
          <span>© 2026 INFAIX. All rights reserved.</span>
          <span className="footer-bottom-axis">INFAIX → FORGE → PROJECTS</span>
        </div>
      </div>
    </footer>
  );
}