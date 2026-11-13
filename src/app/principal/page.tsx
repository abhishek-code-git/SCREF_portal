import type { Metadata } from "next";
import { PrincipalPage } from "@/views/principal-page";

export const metadata: Metadata = {
  title: "Principal's Desk — The Centennial School Platform",
  description: "Principal's daily work: approvals, observations, staff matters and school tasks.",
  openGraph: {
    title: "Principal's Desk — The Centennial School Platform",
    description: "Everything the principal manages, in one place.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  return <PrincipalPage />;
}
