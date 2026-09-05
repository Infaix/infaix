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
      <main>
        <AuthShell
          label="INFAIX // Account"
          title="ACCOUNT"
          desc="Your identity across INFAIX. Only non-sensitive profile data is shown here."
        >
          <AccountDashboard />
        </AuthShell>
      </main>
      <Footer />
    </>
  );
}
