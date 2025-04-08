import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HubSpot to SFMC Migration Tool | Red Hibbert Group",
  description: "Seamlessly transfer your marketing assets from HubSpot to Salesforce Marketing Cloud with our dedicated migration tool.",
  keywords: "HubSpot, Salesforce Marketing Cloud, SFMC, data migration, email migration, contacts migration, marketing automation",
  authors: [{ name: "Red Hibbert Group", url: "https://www.redhibbert.com" }],
  metadataBase: new URL("https://www.redhibbert.com"),
  openGraph: {
    title: "HubSpot to SFMC Migration Tool | Red Hibbert Group",
    description: "Seamlessly transfer your marketing assets from HubSpot to Salesforce Marketing Cloud with our dedicated migration tool.",
    url: "https://www.redhibbert.com",
    siteName: "Red Hibbert Group",
    images: [
      {
        url: "/HubSpot_Migrator_Logo.png",
        width: 800,
        height: 600,
        alt: "HubSpot to SFMC Migration Tool",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HubSpot to SFMC Migration Tool | Red Hibbert Group",
    description: "Seamlessly transfer your marketing assets from HubSpot to Salesforce Marketing Cloud with our dedicated migration tool.",
    images: ["/HubSpot_Migrator_Logo.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Disable the Next.js development indicator */}
        <style>
          {`
            #__next-build-watcher { display: none !important; }
            .next-build-watcher { display: none !important; }
          `}
        </style>
        {/* Canonical link for SEO */}
        <link rel="canonical" href="https://www.redhibbert.com" />
        {/* Favicon */}
        <link rel="icon" href="/HubSpot_Migrator_Logo.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
