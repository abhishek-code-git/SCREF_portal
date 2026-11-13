import type { Metadata } from "next";
import { StaffPage } from "@/views/staff-page";

export const metadata: Metadata = {
  title: "Staff — The Centennial School Platform",
  description: "Teaching, administrative and support staff directory with attendance and leave.",
  openGraph: {
    title: "Staff — The Centennial School Platform",
    description: "Staff directory, attendance and leave for your centre.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  return <StaffPage />;
}
