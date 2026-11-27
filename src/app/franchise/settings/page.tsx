import type { Metadata } from "next";
import { Suspense } from "react";
import { FranchiseSettingsPage } from "@/views/franchise-settings-page";

export const metadata: Metadata = {
  title: "Settings — Franchise — The Centennial School",
  description: "Franchise contact and profile settings.",
};

export default function Page() {
  return <Suspense fallback={null}><FranchiseSettingsPage /></Suspense>;
}
