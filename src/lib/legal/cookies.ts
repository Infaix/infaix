/**
 * INFAIX Core — Cookie Policy.
 *
 * This document describes an audit, not a policy aspiration. Every row below
 * was confirmed by searching the source for cookie writes, Web Storage, the
 * Cache API and third-party script tags. There is exactly one entry, and it
 * is strictly necessary, which is why the site shows no consent banner: a
 * dialog offering to accept optional technology that does not exist would be
 * theatre. `tests/legal-content.test.ts` keeps this list honest.
 */

import type { LegalDocument } from "../legal-content";

export const cookiePolicy: LegalDocument = {
  slug: "cookies",
  label: "Cookies",
  title: "Cookie Policy",
  summary:
    "One strictly necessary cookie. No trackers, no storage APIs, and no consent dialog — because there is nothing optional to consent to.",
  version: "cookies-2026-10-03",
  effective: "3 October 2026",
  sections: [
    {
      id: "summary",
      heading: "In one paragraph",
      blocks: [
        {
          kind: "p",
          text: "INFAIX Core sets a single cookie, called infaix_session, and only when you sign in. Its only job is to keep you signed in and to prevent other sites from making authenticated requests as you. It is not used for advertising, profiling or analytics.",
        },
        {
          kind: "p",
          text: "This site uses no local storage, no session storage, no IndexedDB, no service-worker cache and no third-party script. There is no analytics, no tag manager, no advertising pixel and no social embed.",
        },
        {
          kind: "fact",
          title: "Why there is no cookie banner here",
          text: "A banner with an “Accept all” button would be misleading if the only thing to accept is the one thing that cannot be switched off. Consent belongs to optional processing. INFAIX has none, so INFAIX shows you this page instead of an interstitial — and the preference is not something you have to manage, because there is nothing to turn off.",
        },
      ],
    },
    {
      id: "cookie-table",
      heading: "The complete list",
      blocks: [
        {
          kind: "p",
          text: "This is every cookie this site can set. If something ever appears here that is not on this list, that is a defect, and it should be reported.",
        },
        {
          kind: "table",
          caption: "Cookies used by INFAIX Core",
          head: ["Name", "Purpose", "Category", "Set when", "Lifespan"],
          rows: [
            [
              "infaix_session",
              "Maintains your sign-in and enforces same-site requests, so another website cannot act as you",
              "Strictly necessary",
              "You sign in",
              "30 days from last use, extended each time you use the session; cleared on sign-out or when your password is changed or reset",
            ],
          ],
        },
      ],
    },
    {
      id: "cookie-details",
      heading: "How that cookie behaves",
      blocks: [
        {
          kind: "p",
          text: "The technical detail is here because it is the part people most often want and it is all verifiable:",
        },
        {
          kind: "table",
          caption: "Attributes of infaix_session",
          head: ["Attribute", "Value", "Why"],
          rows: [
            ["Readable by page scripts", "No — marked HttpOnly", "If you visit INFAIX through a link on another site, that site's code cannot read your session"],
            ["Transmitted only over HTTPS", "Yes — marked Secure in production", "The cookie is not sent over an unencrypted connection"],
            ["Sent on cross-site requests", "No in production — marked SameSite=None with an origin check", "Requests from another site are rejected even though the browser would attach the cookie"],
            ["Scope", "All INFAIX paths; the parent INFAIX domain in production", "So INFAIX products can share one sign-in without exposing the cookie to unrelated sites"],
            ["Contents", "A random opaque token plus a signature", "No email address, no name, no identifier you could recognise, and no profile. Only a hash of it is stored on the server"],
          ],
        },
        {
          kind: "p",
          text: "On development and preview environments the cookie is host-only and sent on same-site requests only, because a secure cross-site cookie cannot work over plain local HTTP.",
        },
      ],
    },
    {
      id: "not-used",
      heading: "What is not used",
      blocks: [
        {
          kind: "table",
          caption: "Storage and tracking technologies not present on this site",
          head: ["Technology", "Status", "Note"],
          rows: [
            ["localStorage", "Not used", "No site preferences, drafts or identifiers are kept in your browser"],
            ["sessionStorage", "Not used", "Nothing is written per tab"],
            ["IndexedDB", "Not used", "No offline database"],
            ["Cache API / service worker", "Not used", "The site does not run background code in your browser"],
            ["Web fonts from a third party", "Not used", "Typefaces are served by INFAIX itself, so no font request reaches anyone else"],
            ["Analytics or session replay", "Not used", "No measurement of how you use the site"],
            ["Advertising or social pixels", "Not used", "No third party learns that you came here"],
            ["Embedded third-party content", "Not used", "No video, map, chat widget or comment system is embedded"],
            ["Fingerprinting", "Not used", "No canvas, font or audio probing"],
          ],
        },
        {
          kind: "fact",
          title: "Server-side storage is a different thing",
          text: "Your account, sessions and security records live on INFAIX's server, not in your browser. This page covers only what sits on your device. The server side is described in the [[Privacy Policy|/legal/privacy]].",
        },
      ],
    },
    {
      id: "control",
      heading: "Controlling it",
      blocks: [
        {
          kind: "p",
          text: "You do not need to do anything to consent to what INFAIX uses. If you would rather not have the cookie, here is what happens and how to remove it.",
        },
        {
          kind: "ul",
          items: [
            "Sign out from [[your account|/account]] or from the navigation. The cookie is cleared immediately; nothing has to expire.",
            "Change your password. Every session is destroyed, which ends sign-in everywhere.",
            "Clear cookies for this site in your browser's settings. Every current and previous INFAIX session ends at once.",
            "Block cookies for this site entirely, or use a browser that blocks third-party cookies.",
          ],
        },
        {
          kind: "fact",
          title: "The only thing blocking it costs you",
          text: "Withholding the session cookie means you can read this site but cannot stay signed in, so pages that need your identity will send you to [[sign in|/login]] each time. Everything else works exactly as before.",
        },
        {
          kind: "p",
          text: "Browser settings for blocking cookies are documented by each browser vendor. INFAIX does not link to a specific vendor's instructions here, because that would go stale faster than this page does.",
        },
      ],
    },
    {
      id: "changes",
      heading: "If this changes",
      blocks: [
        {
          kind: "p",
          text: "INFAIX's position is that consent is for optional processing, so the following rules apply:",
        },
        {
          kind: "ol",
          items: [
            "Any new technology that is not strictly necessary will appear on this page before it reaches your device, with what it does and who receives the data.",
            "It will not load until you actively agree. Not loading, not scrolling past, and not closing a dialog will all count as “no”.",
            "Refusing will leave the strictly necessary cookie working, and will not break the site.",
            "No tracking will be added to test or demonstrate a consent banner.",
            "Changing your mind will be as easy as making the choice was.",
          ],
        },
        {
          kind: "review",
          marker: "consent-architecture",
        },
      ],
    },
  ],
};