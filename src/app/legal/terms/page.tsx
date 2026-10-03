import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import LegalDocument from "@/components/legal-document";
import { termsOfUse } from "@/lib/legal/terms";

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "The agreement that comes with using INFAIX Core, written against what actually runs today.",
  openGraph: {
    title: "Terms of Use | INFAIX",
    description:
      "The agreement that comes with using INFAIX Core, written against what actually runs today.",
    url: "https://infaix.com/legal/terms",
  },
};

export default function TermsPage() {
  return (
    <>
      <Nav />
      <LegalDocument doc={termsOfUse} />
      <Footer />
    </>
  );
}