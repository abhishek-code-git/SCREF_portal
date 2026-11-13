import type { Metadata } from "next";
import { ReportsPage } from "@/views/reports-page";

export const metadata: Metadata = {
  title: "Reports & Insights — The Centennial School Platform",
  description: "Generate student, attendance, academic, finance, admissions, staff and transport reports for your centre.",
  openGraph: {
    title: "Reports & Insights — The Centennial School Platform",
    description: "Generate and export reports across every part of your centre.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  return <ReportsPage />;
}
