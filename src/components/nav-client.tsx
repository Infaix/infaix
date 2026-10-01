"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import InfaixLogo from "@/components/infaix-logo";
import AppLauncher from "./app-launcher";
import type { InfaixApp } from "@/lib/app-contract";

const links = [
  { href: "/#ecosystem", label: "PRODUCTS" },
  { href: "/forge/projects", label: "PROJECTS" },
  { href: "/about", label: "ABOUT" },
];

function isActive(pathname: string, href: string) {
  if (href.startsWith("/#")) return false;
  return pathname === href || pathname.startsWith(href + "/");
}

export default function NavClient({ apps }: { apps: InfaixApp[] }) {
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
            setIsOwner(data.user?.role === "OWNER" || data.user?.role === "ADMIN");
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
  const current = (href: string) => (pathname === href ? "page" : undefined);

  const site = <>
    {links.map((l) => <Link key={l.href} href={l.href} aria-current={current(l.href)}>{l.label}</Link>)}
    <Link href={authLink.href} aria-current={current(authLink.href)}>{authLink.label}</Link>
    {isOwner && <Link href="/admin" aria-current={current("/admin")}>OPERATIONS</Link>}
  </>;

  return (
    <header>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <div className="container">
        <nav aria-label="Primary">
          <Link href="/" className="brand-mark" aria-label="INFAIX home">
            <span className="mark-holder">
              <InfaixLogo variant="navbar" priority />
            </span>
            <span>INFAIX</span>
          </Link>

          <div className="nav-links">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={isActive(pathname, l.href) ? "active" : undefined} aria-current={current(l.href)}>
                {l.label}
              </Link>
            ))}
          </div>

          <div className="nav-tools">
            <AppLauncher key={pathname} apps={apps} site={site} />
            <Link className="nav-account" href={authLink.href} aria-current={current(authLink.href)}>{authLink.label}</Link>
            {isOwner && <Link className="nav-account nav-ops" href="/admin" aria-current={current("/admin")}>OPS</Link>}
          </div>
        </nav>
      </div>
    </header>
  );
}
