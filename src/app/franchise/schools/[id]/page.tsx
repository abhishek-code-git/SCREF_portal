import type { Metadata } from "next";
import { Suspense } from "react";
import { FranchiseSchoolDetailPage } from "@/views/franchise-school-detail-page";

export const metadata: Metadata = {
  title: "School Detail — Franchise — The Centennial School",
  description: "View school details within your franchise.",
};

export default function Page() {
  return <Suspense fallback={null}><FranchiseSchoolDetailPage /></Suspense>;
}
