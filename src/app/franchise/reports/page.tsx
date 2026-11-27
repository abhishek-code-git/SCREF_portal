import type { Metadata } from "next";
import { Suspense } from "react";
import { FranchiseReportsPage } from "@/views/franchise-reports-page";

export const metadata: Metadata = {
  title: "Reports — Franchise — The Centennial School",
  description: "Cross-school reports for your franchise.",
};

export default function Page() {
  return <Suspense fallback={null}><FranchiseReportsPage /></Suspense>;
}
