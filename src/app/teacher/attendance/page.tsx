import type { Metadata } from "next";
import { TeacherAttendancePage } from "@/views/teacher-attendance-page";

export const metadata: Metadata = {
  title: "Attendance — Teacher's Desk",
  description: "Mark and review class attendance.",
};

export default function Page() {
  return <TeacherAttendancePage />;
}
