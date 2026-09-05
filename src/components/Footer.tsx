import Link from "next/link";
import InfaixLogo from "@/components/infaix-logo";

const links = [
  { href: "/", label: "INFAIX" },
  { href: "/forge", label: "FORGE" },
  { href: "/ai", label: "AI" },
  { href: "/about", label: "ABOUT" },
];

export default function Footer() {
  return (
    <footer>
      <div className="container">
        <div className="footer-top">
          <Link href="/" className="footer-brand" aria-label="INFAIX home">
            <InfaixLogo variant="footer" />
            <span className="footer-brand-text">
              <span className="name">INFAIX</span>
              <span className="tag">Independent technology &amp; engineering.</span>
            </span>
          </Link>
          <nav className="footer-links" aria-label="Footer">
            {links.map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
            <a
              href="https://github.com/infaix"
              target="_blank"
              rel="noopener noreferrer"
            >
              GITHUB ↗
            </a>
          </nav>
        </div>
        <div className="footer-bottom">
          <span>© 2026 INFAIX. All rights reserved.</span>
          <span>INFAIX → FORGE → PROJECTS</span>
        </div>
      </div>
    </footer>
  );
}
