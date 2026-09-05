"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

// useLayoutEffect runs before browser paint, so the `.js` gate class is
// applied without a flash of visible text — but only when React is actually
// running. If JS fails to load/hydrate, the class is never added and all
// content stays visible (progressive enhancement).
const useIsoLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export default function ScrollReveal({
  children,
  className = "",
  direction = "up",
}: {
  children: React.ReactNode;
  className?: string;
  direction?: "up" | "left" | "right";
}) {
  const ref = useRef<HTMLDivElement>(null);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    document.documentElement.classList.add("js");

    if (!("IntersectionObserver" in window)) {
      el.classList.add("in-view");
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const dirClass =
    direction === "left"
      ? "left"
      : direction === "right"
      ? "right"
      : "";

  return (
    <div ref={ref} className={`reveal ${dirClass} ${className}`}>
      {children}
    </div>
  );
}
