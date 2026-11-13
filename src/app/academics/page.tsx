import type { Metadata } from "next";
import { AcademicsPage } from "@/views/academics-page";

export const metadata: Metadata = {
  title: "Academic Management — The Centennial School Platform",
  description: "Secure access to the Centennial academic portal for timetables, exams, results and assignments.",
  openGraph: {
    title: "Academic Management — The Centennial School Platform",
    description: "One-click access to the connected academic system.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  return <AcademicsPage />;
}
