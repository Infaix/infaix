import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import AuthShell from "@/components/auth-shell";
import AccountDashboard from "./dashboard";

export const metadata: Metadata = {
  title: "Account",
  description: "Your INFAIX account.",
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return (
    <>
      <Nav />
      <main id="main-content" tabIndex={-1}>
        <AuthShell
          label="INFAIX // Account"
          title="ACCOUNT"
          desc="Your INFAIX identity. Email, verification, and the security controls for this account."
        >
          <AccountDashboard />
        </AuthShell>
      </main>
      <Footer />
    </>
  );
}
