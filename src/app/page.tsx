import type { Metadata } from "next";
import { Welcome } from "@/views/index-page";

export const metadata: Metadata = {
  title: "The Centennial School — One School Network. One Digital Ecosystem.",
  description: "Connected technology for management, academics, students, parents and operations across every Centennial School centre.",
  openGraph: {
    title: "The Centennial School — One School Network. One Digital Ecosystem.",
    description: "Connected technology for management, academics, students, parents and operations across every Centennial School centre.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  return <Welcome />;
}
