import Link from "next/link";
import Image from "next/image";

const links = [
  { href: "/forge", label: "FORGE" },
  { href: "/ai", label: "AI" },
  { href: "/about", label: "About" },
  { href: "https://github.com/infaix", label: "GitHub", external: true },
];

export default function Footer() {
  return (
    <footer>
      <div className="container">
        <div className="footer-top">
          <Link href="/" className="footer-brand">
            <Image
              src="/infaix-logo.png"
              alt="INFAIX"
              width={30}
              height={30}
              className="footer-mark"
            />
            <span className="footer-brand-text">
              <span className="name">INFAIX</span>
              <span className="tag">Independent technology & engineering.</span>
            </span>
          </Link>
          <div className="footer-links">
            {links.map((l) =>
              l.external ? (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {l.label}
                </a>
              ) : (
                <Link key={l.href} href={l.href}>
                  {l.label}
                </Link>
              )
            )}
          </div>
        </div>
        <div className="footer-bottom">&copy; 2026 INFAIX</div>
      </div>
    </footer>
  );
}
