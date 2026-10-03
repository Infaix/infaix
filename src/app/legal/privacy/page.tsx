import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import LegalDocument from "@/components/legal-document";
import { privacyPolicy } from "@/lib/legal/privacy";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What INFAIX Core collects, why it collects it, how long it keeps it, and the decisions still under review.",
  openGraph: {
    title: "Privacy Policy | INFAIX",
    description:
      "What INFAIX Core collects, why it collects it, how long it keeps it, and the decisions still under review.",
    url: "https://infaix.com/legal/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <LegalDocument doc={privacyPolicy} />
      <Footer />
    </>
  );
}