import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import AuthShell from "@/components/auth-shell";
import LoginForm from "./form";

export const metadata: Metadata = {
  title: "Log in",
  description: "Sign in to your INFAIX account.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <>
      <Nav />
      <main>
        <AuthShell
          label="INFAIX // Account"
          title="LOG IN"
          desc="Sign in to your INFAIX account. Sessions are managed securely on INFAIX infrastructure."
        >
          <LoginForm />
        </AuthShell>
      </main>
      <Footer />
    </>
  );
}
