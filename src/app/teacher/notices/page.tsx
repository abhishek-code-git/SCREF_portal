import type { Metadata } from "next";
import { TeacherNoticesPage } from "@/views/teacher-notices-page";

export const metadata: Metadata = {
  title: "Notices — Teacher's Desk",
  description: "View and create class notices.",
};

export default function Page() {
  return <TeacherNoticesPage />;
}
