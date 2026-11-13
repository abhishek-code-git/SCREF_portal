import type { Metadata } from "next";
import { TransportPage } from "@/views/transport-page";

export const metadata: Metadata = {
  title: "Transport — The Centennial School Platform",
  description: "Transport system integration for routes, buses and student pickups.",
  openGraph: {
    title: "Transport — The Centennial School Platform",
    description: "Connect your transport system to view routes and buses.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  return <TransportPage />;
}
