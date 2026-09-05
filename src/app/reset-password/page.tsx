import type { Metadata } from "next";
import { Suspense } from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import AuthShell from "@/components/auth-shell";
import ResetForm from "./form";

export const metadata: Metadata = {
  title: "Set new password",
  description: "Choose a new password for your INFAIX account.",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <>
      <Nav />
      <main>
        <AuthShell
          label="INFAIX // Recovery"
          title="NEW PASSWORD"
          desc="Choose a new password. Your reset link works once and expires after 1 hour."
        >
          <Suspense fallback={<div className="ai-hint">Loading…</div>}>
            <ResetForm />
          </Suspense>
        </AuthShell>
      </main>
      <Footer />
    </>
  );
}
