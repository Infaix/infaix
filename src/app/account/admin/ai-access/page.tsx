import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import AuthShell from "@/components/auth-shell";
import AiAccessManager from "./manager";

export const metadata: Metadata = {
  title: "AI access administration",
  description: "Owner-only management of INFAIX AI access.",
  robots: { index: false, follow: false },
};

export default function AiAccessAdminPage() {
  return (
    <>
      <Nav />
      <main>
        <AuthShell
          label="INFAIX // Owner"
          title="AI ACCESS"
          desc="Manage which active INFAIX users can access INFAIX AI. Changes take effect immediately and are audit-logged."
          wide
        >
          <AiAccessManager />
        </AuthShell>
      </main>
      <Footer />
    </>
  );
}
