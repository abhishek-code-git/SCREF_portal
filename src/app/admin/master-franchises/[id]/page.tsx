import type { Metadata } from "next";
import { AdminSectionPage } from "@/views/admin-section-page";

export const metadata: Metadata = { title: "Master Franchise Profile — The Centennial School" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await params;
  return <AdminSectionPage section="master-franchise-detail" />;
}
