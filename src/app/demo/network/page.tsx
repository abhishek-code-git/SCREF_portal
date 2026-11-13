import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DemoNetworkPage } from "@/views/demo-network-page";
import { DEMO_MODE } from "@/lib/demo-mode";

export const metadata: Metadata = {
  title: "Demo Network — The Centennial School",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (!DEMO_MODE) notFound();
  return <DemoNetworkPage />;
}
