import type { Metadata } from "next";
import { StudentsPage } from "@/views/students-page";

export const metadata: Metadata = {
  title: "Students — The Centennial School Platform",
  description: "Student directory with attendance, fee status, transport and full student profiles.",
  openGraph: {
    title: "Students — The Centennial School Platform",
    description: "Student directory and profiles for your Centennial centre.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  return <StudentsPage />;
}
