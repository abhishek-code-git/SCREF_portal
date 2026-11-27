import type { Metadata } from "next";
import { ClassesPage } from "@/views/classes-page";

export const metadata: Metadata = { title: "Classes & Timetable — The Centennial School" };

export default function Page() {
  return <ClassesPage />;
}
