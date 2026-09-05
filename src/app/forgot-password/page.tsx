import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import AuthShell from "@/components/auth-shell";
import ForgotForm from "./form";

export const metadata: Metadata = {
  title: "Forgot password",
  description: "Request a password reset for your INFAIX account.",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <>
      <Nav />
      <main>
        <AuthShell
          label="INFAIX // Recovery"
          title="RESET PASSWORD"
          desc="Enter your account email. If it exists, a single-use reset link will be issued (valid 1 hour)."
        >
          <ForgotForm />
        </AuthShell>
      </main>
      <Footer />
    </>
  );
}
