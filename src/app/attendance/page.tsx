import type { Metadata } from "next";
import { AttendancePage } from "@/views/attendance-page";

export const metadata: Metadata = {
  title: "Attendance — The Centennial School Platform",
  description: "Daily student, teacher and staff attendance with class-wise breakdown for your Centennial centre.",
  openGraph: {
    title: "Attendance — The Centennial School Platform",
    description: "Daily student, teacher and staff attendance with class-wise breakdown.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  return <AttendancePage />;
}
