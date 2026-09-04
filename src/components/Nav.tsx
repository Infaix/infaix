"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

const links = [
  { href: "/forge", label: "FORGE" },
  { href: "/ai", label: "AI" },
  { href: "/about", label: "About" },
];

export default function Nav() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <header>
      <div className="container">
        <nav>
          <Link href="/" className="brand-mark">
            <span className="mark-holder">
              <Image
                src="/infaix-logo.png"
                alt="INFAIX"
                width={22}
                height={22}
                priority
              />
            </span>
            <span>INFAIX</span>
          </Link>

          <div className="nav-links">
            {links.map((l) => {
              const active =
                l.href === "/"
                  ? isHome
                  : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={active ? "active" : undefined}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>

          <a
            href="https://github.com/infaix"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-github"
          >
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}
