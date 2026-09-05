import type { Metadata } from "next";
import { Suspense } from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import AuthShell from "@/components/auth-shell";
import Verifier from "./verifier";

export const metadata: Metadata = {
  title: "Verify email",
  description: "Verify your INFAIX account email address.",
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage() {
  return (
    <>
      <Nav />
      <main>
        <AuthShell
          label="INFAIX // Verification"
          title="VERIFY EMAIL"
          desc="Confirm your email address to activate your account. Links work once and expire after 24 hours."
        >
          <Suspense fallback={<div className="ai-hint">Loading…</div>}>
            <Verifier />
          </Suspense>
        </AuthShell>
      </main>
      <Footer />
    </>
  );
}
