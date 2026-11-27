import type { Metadata } from "next";
import { TeacherHomeworkPage } from "@/views/teacher-homework-page";

export const metadata: Metadata = {
  title: "Homework — Teacher's Desk",
  description: "Create and manage homework for your classes.",
};

export default function Page() {
  return <TeacherHomeworkPage />;
}
