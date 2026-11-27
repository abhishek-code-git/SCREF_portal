import type { Metadata } from "next";
import { StudentsPromotePage } from "@/views/students-promote-page";

export const metadata: Metadata = { title: "Promote Students — The Centennial School" };

export default function Page() {
  return <StudentsPromotePage />;
}
