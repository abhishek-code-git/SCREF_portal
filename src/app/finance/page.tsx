import type { Metadata } from "next";
import { FinancePage } from "@/views/finance-page";

export const metadata: Metadata = {
  title: "Finance — The Centennial School Platform",
  description: "Fee collection, pending fees, expenses and revenue for your Centennial School centre, in plain numbers.",
  openGraph: {
    title: "Finance — The Centennial School Platform",
    description: "Fee collection, pending fees, expenses and revenue for your centre.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  return <FinancePage />;
}
