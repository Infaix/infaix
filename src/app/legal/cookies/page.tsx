import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import LegalDocument from "@/components/legal-document";
import { cookiePolicy } from "@/lib/legal/cookies";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "One strictly necessary cookie. No trackers, no browser storage, and no consent dialog because there is nothing optional to consent to.",
  openGraph: {
    title: "Cookie Policy | INFAIX",
    description:
      "One strictly necessary cookie. No trackers, no browser storage, and no consent dialog because there is nothing optional to consent to.",
    url: "https://infaix.com/legal/cookies",
  },
};

export default function CookiesPage() {
  return (
    <>
      <Nav />
      <LegalDocument doc={cookiePolicy} />
      <Footer />
    </>
  );
}