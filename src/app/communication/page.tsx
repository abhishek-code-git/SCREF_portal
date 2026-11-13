import type { Metadata } from "next";
import { CommunicationPage } from "@/views/communication-page";

export const metadata: Metadata = {
  title: "Communication Centre — The Centennial School Platform",
  description: "Compose announcements and notifications for parents, students and staff from one place.",
  openGraph: {
    title: "Communication Centre — The Centennial School Platform",
    description: "Announcements and notifications for parents, students and staff.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  return <CommunicationPage />;
}
