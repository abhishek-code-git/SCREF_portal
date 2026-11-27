import type { Metadata } from "next";
import { TeacherTimetablePage } from "@/views/teacher-timetable-page";

export const metadata: Metadata = {
  title: "My Timetable — Teacher's Desk",
  description: "Your weekly teaching schedule.",
};

export default function Page() {
  return <TeacherTimetablePage />;
}
