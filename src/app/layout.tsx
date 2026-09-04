import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "INFAIX \u2014 Independent Technology & Engineering",
    template: "%s | INFAIX",
  },
  description:
    "INFAIX explores software, AI, robotics, hardware, and infrastructure. FORGE is the technical environment where projects are built, tested, and operated.",
  metadataBase: new URL("https://infaix.com"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://infaix.com",
    siteName: "INFAIX",
    title: "INFAIX \u2014 Independent Technology & Engineering",
    description:
      "INFAIX explores software, AI, robotics, hardware, and infrastructure. FORGE is the technical environment where projects are built, tested, and operated.",
  },
  twitter: {
    card: "summary_large_image",
    title: "INFAIX \u2014 Independent Technology & Engineering",
    description:
      "INFAIX explores software, AI, robotics, hardware, and infrastructure.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/infaix-logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#08070c",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
