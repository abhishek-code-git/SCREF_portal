import type { Metadata } from "next";
import { ParentsPage } from "@/views/parents-page";

export const metadata: Metadata = {
  title: "Parents — The Centennial School Platform",
  description: "Parent directory, requests and communication tools for your Centennial centre.",
  openGraph: {
    title: "Parents — The Centennial School Platform",
    description: "Parent directory and communication for your centre.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  return <ParentsPage />;
}
