import Link from "next/link";
import InfaixLogo from "@/components/infaix-logo";
import InfaixIcon from "@/components/icons";

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

        <div className="footer-bottom">
          <span>© 2026 INFAIX. All rights reserved.</span>
          <span className="footer-bottom-axis">INFAIX → FORGE → PROJECTS</span>
        </div>
      </div>
    </footer>
  );
}