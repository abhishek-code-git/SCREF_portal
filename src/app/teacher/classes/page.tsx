import type { Metadata } from "next";
import { TeacherClassesPage } from "@/views/teacher-classes-page";

export const metadata: Metadata = {
  title: "My Classes — Teacher's Desk",
  description: "View your assigned classes and students.",
};

export default function Page() {
  return <TeacherClassesPage />;
}
