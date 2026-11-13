import type { Metadata } from "next";
import { TeacherPage } from "@/views/teacher-page";

export const metadata: Metadata = {
  title: "Teacher's Desk — The Centennial School Platform",
  description: "Mark class-wise student attendance and see your classes at a glance.",
  openGraph: {
    title: "Teacher's Desk — The Centennial School Platform",
    description: "Class-wise attendance marking for Centennial teachers.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  return <TeacherPage />;
}
