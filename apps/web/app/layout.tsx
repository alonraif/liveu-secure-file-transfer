import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LiveU Secure File Transfer",
  description: "Internal platform for secure external file delivery."
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
