import type { Metadata } from "next";
import { ExamsPage } from "@/views/exams-page";

export const metadata: Metadata = { title: "Exams & Results — The Centennial School" };

export default function Page() {
  return <ExamsPage />;
}
