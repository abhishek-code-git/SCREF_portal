import type { Metadata } from "next";
import { Suspense } from "react";
import { FranchiseDashboard } from "@/views/franchise-dashboard-page";

export const metadata: Metadata = {
  title: "Franchise Dashboard — The Centennial School",
  description: "Live summaries for schools assigned to your franchise owner account.",
};

export default function Page() {
  return <Suspense fallback={null}><FranchiseDashboard /></Suspense>;
}
