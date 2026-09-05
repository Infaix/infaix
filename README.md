# INFAIX Website

The public front door to the INFAIX technology ecosystem.

## What is INFAIX

INFAIX is an independent technology and engineering environment exploring and building across:

- Software
- Artificial Intelligence
- Robotics
- Hardware & Electronics
- Infrastructure
- Experimental Technology

## What is FORGE

FORGE is INFAIX's technical creation environment — where projects are built, tested, hosted, deployed and operated. It provides the infrastructure layer behind all INFAIX projects.

## Website Architecture

```
infaix.com          → Homepage (INFAIX identity, ecosystem, capabilities)
infaix.com/forge    → FORGE (infrastructure, projects, lab, experiments)
infaix.com/ai       → INFAIX AI (AI chat interface)
infaix.com/about    → About (philosophy, what INFAIX is)
infaix.com/login    → Account sign-in (invite-based identity)
infaix.com/register → Invite-only registration
infaix.com/account  → Protected account page (profile, password, logout)
infaix.com/ai       → INFAIX AI (session-authenticated bridge to ai.infaix.com)
```

## Account system

Invite-only identity backed by the Cloudflare Worker + D1 (`worker/`,
`db/`). Same-origin `/api/auth/*` and `/api/admin/*` endpoints; sessions in
`HttpOnly`/`Secure`/`SameSite=Lax` cookies. Full design, flows, and
operations: [`docs/auth.md`](docs/auth.md). Security policy:
[`SECURITY.md`](SECURITY.md).

## INFAIX AI bridge

`/ai` talks to same-origin `/api/ai/*` only. The Worker authenticates the
session, checks `AI_ACCESS`, mints a short-lived `jose` assertion, and
proxies SSE inference from the separate `InfaixAI` gateway (`ai.infaix.com`).
Contract and operations: [`docs/ai-architecture.md`](docs/ai-architecture.md).

## Technology Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + custom CSS
- **Fonts**: Space Grotesk (headings), Inter (body)
- **Deployment**: Cloudflare

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
npm start
```

## Lint

```bash
npm run lint
```

## Tests

```bash
npm test        # vitest: account-system unit tests (no network required)
```

## Environment Variables

| Variable | Description |
|---|---|
| `AI_GATEWAY_URL` | InfaixAI gateway origin (Worker-side only, never `NEXT_PUBLIC_*`) |

Copy `.env.example` to `.env.local` and configure as needed.

## AI Integration

The INFAIX AI chat interface calls same-origin `/api/ai/*` on the main
Worker, which authenticates the session, checks `AI_ACCESS`, and proxies
streaming inference from the separate `InfaixAI` gateway. The browser never
contacts Ollama or `ai.infaix.com` directly. See
[`docs/ai-architecture.md`](docs/ai-architecture.md).
```

## Project Structure

```
src/
  app/
    layout.tsx          → Root layout (fonts, metadata)
    page.tsx            → Homepage
    globals.css         → Global styles
    robots.ts           → SEO robots
    sitemap.ts          → SEO sitemap
    forge/
      page.tsx          → FORGE page
      projects/
        toolboxhq/
          page.tsx      → ToolboxHQ project page
    ai/
      page.tsx          → AI chat interface
    about/
      page.tsx          → About page
  components/
    Nav.tsx             → Navigation
    Footer.tsx          → Footer
    ScrollReveal.tsx    → Scroll reveal animation
public/
  infaix-logo.png       → INFAIX logo
```

## License

INFAIX. All rights reserved.
