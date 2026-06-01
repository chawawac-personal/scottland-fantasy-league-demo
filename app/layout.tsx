import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scottland Fantasy League",
  description: "The premier fantasy football platform for Scottland FC supporters in Zimbabwe",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
