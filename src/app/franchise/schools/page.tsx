import type { Metadata } from "next";
import { Suspense } from "react";
import { FranchiseSchoolsPage } from "@/views/franchise-schools-page";

export const metadata: Metadata = {
  title: "My Schools — Franchise — The Centennial School",
  description: "View and manage schools within your franchise.",
};

export default function Page() {
  return <Suspense fallback={null}><FranchiseSchoolsPage /></Suspense>;
}
