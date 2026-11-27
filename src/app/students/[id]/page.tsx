import type { Metadata } from "next";
import { StudentDetailPage } from "@/views/student-detail-page";

export const metadata: Metadata = { title: "Student Profile — The Centennial School" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StudentDetailPage studentId={id} />;
}
