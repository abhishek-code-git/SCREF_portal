import type { Metadata } from "next";
import { SupportPage } from "@/views/support-page";

export const metadata: Metadata = {
  title: "Support — The Centennial School Platform",
  description: "Raise support tickets with Centennial head office and track their status.",
  openGraph: {
    title: "Support — The Centennial School Platform",
    description: "Head office support for your Centennial centre.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  return <SupportPage />;
}
