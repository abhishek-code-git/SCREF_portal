import type { Metadata } from "next";
import { Suspense } from "react";
import { FranchiseTeamPage } from "@/views/franchise-team-page";

export const metadata: Metadata = {
  title: "Team — Franchise — The Centennial School",
  description: "Manage staff across your franchise schools.",
};

export default function Page() {
  return <Suspense fallback={null}><FranchiseTeamPage /></Suspense>;
}
