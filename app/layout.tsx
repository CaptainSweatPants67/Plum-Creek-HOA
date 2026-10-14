import type { Metadata } from "next";
import { SiteChrome } from "./components/SiteChrome";
import "./globals.css";
import "./public.css";
import "./portal.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.CF_PAGES_URL ??
  "http://localhost:3000";

export const metadata: Metadata = {
  title: "Plum Creek Homeowners Association",
  description:
    "Official Plum Creek HOA information, current leadership, community events, governing documents, and recorded neighborhood plats.",
  metadataBase: new URL(siteUrl),
  icons: {
    icon: "/plum-creek-entrance.jpg",
  },
  openGraph: {
    title: "Plum Creek Homeowners Association",
    description:
      "Neighborhood information and community documents in one convenient place.",
    type: "website",
    images: [
      {
        url: `${siteUrl}/og.png`,
        width: 1733,
        height: 908,
        alt: "Plum Creek Homeowners Association",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Plum Creek Homeowners Association",
    description:
      "Neighborhood information and community documents in one convenient place.",
    images: [`${siteUrl}/og.png`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
