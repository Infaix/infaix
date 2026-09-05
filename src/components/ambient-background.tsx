"use client";

import { useEffect, useRef } from "react";

interface StarNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  purple: boolean;
  phase: number;
  speed: number;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Global ambient background for INFAIX.
 *
 * Layers:
 *  1. Deep space base (CSS radial gradients, slow breathing)
 *  2. Technical grid (CSS, perspective fade, near-imperceptible drift)
 *  3. Network nodes (canvas, thin lines, slow drift, gentle pulse)
 *  4. Geometric wireframes (canvas, large slow-rotating polyhedra at edges)
 *  5. Purple energy (CSS glows + occasional illuminated canvas nodes)
 *
 * Performance:
 *  - One shared canvas, single rAF loop.
 *  - Pauses when tab hidden. Node count capped + reduced on mobile.
 *  - No React re-renders during animation.
 *  - Static single frame when prefers-reduced-motion is set.
 */
export default function AmbientBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const g = el.getContext("2d", { alpha: true });
    if (!g) return;
    const canvas: HTMLCanvasElement = el;
    const ctx: CanvasRenderingContext2D = g;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let running = true;
    let w = 0;
    let h = 0;
    let nodes: StarNode[] = [];
    let scrollY = 0;
    let t = Math.random() * 1000;

    // Large wireframe forms. Positions are relative (0-1) so resize is cheap.
    const frames: {
      kind: "octa" | "cube" | "rings";
      rx: number;
      ry: number;
      rotX: number;
      rotY: number;
      spinX: number;
      spinY: number;
      scale: number;
      purple: number;
    }[] = [
      // Right-edge hero polyhedron (matches reference: large mesh, right side)
      { kind: "octa", rx: 0.86, ry: 0.24, rotX: 0.4, rotY: 0.8, spinX: 0.00035, spinY: 0.00055, scale: 0.16, purple: 0.16 },
      // Left-edge faint structure behind logo zone
      { kind: "cube", rx: 0.07, ry: 0.3, rotX: 0.9, rotY: 0.2, spinX: 0.00028, spinY: -0.00042, scale: 0.09, purple: 0.1 },
      // Bottom philosophy terrain mesh anchor (drawn as low wire grid)
      { kind: "rings", rx: 0.5, ry: 0.99, rotX: 0, rotY: 0, spinX: 0, spinY: 0.0002, scale: 0.3, purple: 0.12 },
    ];

    const OCTA_VERTS: Vec3[] = [
      { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 },
      { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 },
    ];
    const OCTA_EDGES: [number, number][] = [
      [0, 2], [0, 3], [0, 4], [0, 5],
      [1, 2], [1, 3], [1, 4], [1, 5],
      [2, 4], [4, 3], [3, 5], [5, 2],
    ];
    const CUBE_VERTS: Vec3[] = [];
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        for (const sz of [-1, 1])
          CUBE_VERTS.push({ x: sx * 0.8, y: sy * 0.8, z: sz * 0.8 });
    const CUBE_EDGES: [number, number][] = [
      [0, 1], [1, 3], [3, 2], [2, 0],
      [4, 5], [5, 7], [7, 6], [6, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];

    function isMobile() {
      return Math.min(window.innerWidth, window.innerHeight) < 700 || window.innerWidth < 768;
    }

    function seedNodes() {
      const area = w * h;
      const mobile = isMobile();
      // Desktop ~60-75, mobile ~24-30. Never a particle explosion.
      const target = mobile
        ? Math.max(18, Math.min(30, area / 55000))
        : Math.max(40, Math.min(78, area / 24000));
      nodes = Array.from({ length: Math.round(target) }, () => {
        const purple = Math.random() < 0.14;
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * (mobile ? 0.1 : 0.16),
          vy: (Math.random() - 0.5) * (mobile ? 0.1 : 0.16),
          r: purple ? 1.1 + Math.random() * 1.1 : 0.6 + Math.random() * 1.0,
          purple,
          phase: Math.random() * Math.PI * 2,
          speed: 0.004 + Math.random() * 0.008,
        };
      });
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedNodes();
    }

    function rotate(p: Vec3, ax: number, ay: number): Vec3 {
      const cx = Math.cos(ax), sx = Math.sin(ax);
      const cy = Math.cos(ay), sy = Math.sin(ay);
      const y1 = p.y * cx - p.z * sx;
      const z1 = p.y * sx + p.z * cx;
      const x2 = p.x * cy + z1 * sy;
      const z2 = -p.x * sy + z1 * cy;
      return { x: x2, y: y1, z: z2 };
    }

    function drawWire(f: (typeof frames)[number], size: number) {
      const cx = f.rx * w;
      // Gentle scroll parallax: structures drift slightly as user scrolls.
      const cy = f.ry * h - Math.min(scrollY * 0.04, 120) * (f.kind === "rings" ? 0 : 1);
      if (f.kind === "rings") {
        // Concentric technical rings near bottom edge (philosophy terrain anchor).
        ctx.save();
        ctx.translate(cx, Math.min(cy, h - 20));
        for (let i = 1; i <= 4; i++) {
          const rr = (size * i) / 4;
          ctx.beginPath();
          ctx.ellipse(0, 0, rr, rr * 0.22, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(145, 70, 255, ${0.05 + 0.02 * (1 - i / 5)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.restore();
        return;
      }
      const verts = f.kind === "octa" ? OCTA_VERTS : CUBE_VERTS;
      const edges = f.kind === "octa" ? OCTA_EDGES : CUBE_EDGES;
      const projected = verts.map((v) => {
        const r = rotate(v, f.rotX, f.rotY);
        const persp = 1 / (1 + r.z * 0.25);
        return {
          x: cx + r.x * size * persp,
          y: cy + r.y * size * persp,
          z: r.z,
        };
      });
      // Edges: very thin, extremely low opacity, hint of purple.
      for (const [a, b] of edges) {
        const pa = projected[a], pb = projected[b];
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.strokeStyle = `rgba(150, 120, 200, ${f.purple})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      // Nodes at vertices: small dots, occasional purple illumination.
      for (const p of projected) {
        const tw = 0.5 + 0.5 * Math.sin(t * 0.02 + p.x * 0.01);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.4 + tw * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(179, 107, 255, ${0.12 + tw * 0.14})`;
        ctx.fill();
      }
    }

    function draw() {
      t += 1;
      ctx.clearRect(0, 0, w, h);

      // --- Layer 4: wireframes (behind nodes) ---
      const mobile = isMobile();
      const base = Math.min(w, h);
      for (const f of frames) {
        if (mobile && f.kind === "cube") continue; // simplify on mobile
        f.rotX += f.spinX * 16;
        f.rotY += f.spinY * 16;
        drawWire(f, base * f.scale * (mobile ? 0.8 : 1.25));
      }

      // --- Layer 3: network nodes ---
      const linkDist = mobile ? 110 : 140;
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        n.phase += n.speed;
        if (n.x < -20) n.x = w + 20;
        if (n.x > w + 20) n.x = -20;
        if (n.y < -20) n.y = h + 20;
        if (n.y > h + 20) n.y = -20;
      }
      // Links first (under dots).
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          if (Math.abs(dx) > linkDist || Math.abs(dy) > linkDist) continue;
          const d = Math.hypot(dx, dy);
          if (d > linkDist) continue;
          const o = (1 - d / linkDist) * 0.13;
          const eitherPurple = a.purple || b.purple;
          ctx.strokeStyle = eitherPurple
            ? `rgba(145, 70, 255, ${o + 0.04})`
            : `rgba(190, 180, 210, ${o})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      // Dots with gentle appearing/disappearing pulse.
      for (const n of nodes) {
        const tw = 0.5 + 0.5 * Math.sin(n.phase);
        const alpha = n.purple ? 0.25 + tw * 0.45 : 0.12 + tw * 0.25;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.purple
          ? `rgba(179, 107, 255, ${alpha})`
          : `rgba(220, 212, 232, ${alpha})`;
        ctx.fill();
        // Occasional halo on purple nodes — restrained energy.
        if (n.purple && tw > 0.86) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r * 4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(145, 70, 255, 0.05)`;
          ctx.fill();
        }
      }
    }

    function loop() {
      if (!running) return;
      draw();
      raf = requestAnimationFrame(loop);
    }

    function onScroll() {
      scrollY = window.scrollY || 0;
    }

    function onVisibility() {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!reduced.matches) {
        if (!running) {
          running = true;
          loop();
        }
      }
    }

    resize();
    onScroll();
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    if (reduced.matches) {
      // Static version: one tasteful frame, no motion.
      draw();
    } else {
      loop();
    }

    const mq = reduced;
    const onMq = () => {
      if (mq.matches) {
        running = false;
        cancelAnimationFrame(raf);
        draw();
      } else if (!running) {
        running = true;
        loop();
      }
    };
    if (typeof mq.addEventListener === "function") mq.addEventListener("change", onMq);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      if (typeof mq.removeEventListener === "function") mq.removeEventListener("change", onMq);
    };
  }, []);

  return (
    <div className="ambient" aria-hidden="true">
      <div className="ambient-deep" />
      <div className="ambient-glow ambient-glow-a" />
      <div className="ambient-glow ambient-glow-b" />
      <div className="ambient-grid" />
      <canvas ref={canvasRef} className="ambient-canvas" />
      <div className="ambient-vignette" />
    </div>
  );
}
