import type { Metadata } from "next";
import { Dashboard } from "@/views/dashboard-page";

export const metadata: Metadata = {
  title: "Centre Dashboard — The Centennial School",
  description: "Students, staff, attendance, fee collection and admissions for your Centennial School centre in one command centre.",
  openGraph: {
    title: "Centre Dashboard — The Centennial School",
    description: "The command centre for every Centennial School franchise centre.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  return <Dashboard />;
}
