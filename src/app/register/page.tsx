import type { Metadata } from "next";
import { Suspense } from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import AuthShell from "@/components/auth-shell";
import RegisterForm from "./form";

export const metadata: Metadata = {
  title: "Register",
  description: "Create your INFAIX account.",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <>
      <Nav />
      <main id="main-content" tabIndex={-1}>
        <AuthShell
          label="INFAIX // Account"
          title="REGISTER"
          desc="Create your INFAIX identity. An account is not access to Chat, AI, or other private products."
        >
          <Suspense fallback={<div className="ai-hint loading-state" role="status">Loading…</div>}>
            <RegisterForm />
          </Suspense>
        </AuthShell>
      </main>
      <Footer />
    </>
  );
}
