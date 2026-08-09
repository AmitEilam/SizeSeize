import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const body = Source_Sans_3({
  variable: "--font-source",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "SizeSeize",
  description:
    "Monitor product sizes and get email alerts when your size is back in stock.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full`}>
      <body
        className="min-h-full flex flex-col antialiased"
        style={
          {
            "--font-display": "var(--font-fraunces)",
            "--font-body": "var(--font-source)",
          } as React.CSSProperties
        }
      >
        {children}
      </body>
    </html>
  );
}
