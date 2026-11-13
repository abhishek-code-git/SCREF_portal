import type { Metadata } from "next";
import { AdminSectionPage } from "@/views/admin-section-page";

export const metadata: Metadata = { title: "Franchises — The Centennial School" };

export default function Page() {
  return <AdminSectionPage section="franchises" />;
}

