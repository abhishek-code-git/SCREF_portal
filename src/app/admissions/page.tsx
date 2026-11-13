import type { Metadata } from "next";
import { AdmissionsPage } from "@/views/admissions-page";

export const metadata: Metadata = {
  title: "Admissions — The Centennial School Platform",
  description: "Admissions pipeline from first enquiry to confirmed admission for your centre.",
  openGraph: {
    title: "Admissions — The Centennial School Platform",
    description: "Track enquiries, follow-ups and confirmed admissions.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  return <AdmissionsPage />;
}
