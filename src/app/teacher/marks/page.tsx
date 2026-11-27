import type { Metadata } from "next";
import { TeacherMarksPage } from "@/views/teacher-marks-page";

export const metadata: Metadata = {
  title: "Marks — Teacher's Desk",
  description: "Enter and review exam marks for your classes.",
};

export default function Page() {
  return <TeacherMarksPage />;
}
