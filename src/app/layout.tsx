import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { PwaProvider } from "@/components/pwa/PwaProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "KarmSolar",
  description: "AI-powered interactive presentations for KarmSolar",
  applicationName: "KarmSolar",
  appleWebApp: {
    capable: true,
    title: "KarmSolar",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/favicon.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#171717" },
  ],
  width: "device-width",
  initialScale: 1,
};

/** Applies the saved theme before first paint to avoid a flash. */
const themeInit = `try{var t=localStorage.getItem("pk-theme");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.dataset.theme=d?"dark":"light"}catch(e){document.documentElement.dataset.theme="dark"}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      data-theme="dark"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <PwaProvider>{children}</PwaProvider>
      </body>
    </html>
  );
}
