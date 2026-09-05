"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import InfaixLogo from "@/components/infaix-logo";

const links = [
  { href: "/", label: "INFAIX" },
  { href: "/forge", label: "FORGE" },
  { href: "/ai", label: "AI" },
  { href: "/about", label: "ABOUT" },
];

export default function Nav() {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  // Session state only affects which auth link is shown; under `next dev`
  // (no Worker API) the request fails and we fall back to the login link.
  useEffect(() => {
    let live = true;
    fetch("/api/auth/me")
      .then(async (r) => {
        if (!live) return;
        setSignedIn(r.ok);
        if (r.ok) {
          try {
            const data = (await r.json()) as { user?: { role?: string } };
            setIsOwner(data.user?.role === "OWNER");
          } catch {
            setIsOwner(false);
          }
        } else {
          setIsOwner(false);
        }
      })
      .catch(() => {
        if (live) {
          setSignedIn(false);
          setIsOwner(false);
        }
      });
    return () => {
      live = false;
    };
  }, [pathname]);

  const authLink = signedIn ? { href: "/account", label: "ACCOUNT" } : { href: "/login", label: "LOGIN" };
  const allLinks = isOwner ? [...links, authLink, { href: "/account/admin/ai-access", label: "ADMIN" }] : [...links, authLink];

  return (
    <header>
      <div className="container">
        <nav aria-label="Primary">
          <Link href="/" className="brand-mark" aria-label="INFAIX home">
            <span className="mark-holder">
              <InfaixLogo variant="navbar" priority />
            </span>
            <span>INFAIX</span>
          </Link>

          <div className="nav-links">
            {allLinks.map((l) => {
              const active =
                l.href === "/"
                  ? pathname === "/"
                  : pathname === l.href || pathname.startsWith(l.href + "/");
              const cls = [
                active ? "active" : "",
                l.href === "/login" || l.href === "/account" || l.href === "/account/admin/ai-access"
                  ? "nav-auth"
                  : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cls || undefined}
                  aria-current={active ? "page" : undefined}
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
            aria-label="INFAIX on GitHub"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
            <span className="gh-label">GITHUB</span>
            <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
