import type { Metadata } from "next";
import { Suspense } from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import AuthShell from "@/components/auth-shell";
import RegisterForm from "./form";

export const metadata: Metadata = {
  title: "Register",
  description: "Create your INFAIX account with an invitation.",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <>
      <Nav />
      <main>
        <AuthShell
          label="INFAIX // Invitation"
          title="REGISTER"
          desc="INFAIX registration is invite-only. Open your invitation link, then choose your credentials."
        >
          <Suspense fallback={<div className="ai-hint">Loading…</div>}>
            <RegisterForm />
          </Suspense>
        </AuthShell>
      </main>
      <Footer />
    </>
  );
}
