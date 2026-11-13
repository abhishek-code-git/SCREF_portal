import type { Metadata } from "next";
import { StudentPage } from "@/views/student-page";

export const metadata: Metadata = {
  title: "Student Portal — The Centennial School Platform",
  description: "View your school, class, and attendance information.",
};

export default function Page() {
  return <StudentPage />;
}
