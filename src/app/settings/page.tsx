import type { Metadata } from "next";
import { SettingsPage } from "@/views/settings-page";

export const metadata: Metadata = {
  title: "Settings — The Centennial School Platform",
  description: "Centre profile, account, notification and security settings.",
  openGraph: {
    title: "Settings — The Centennial School Platform",
    description: "Manage your centre profile and account preferences.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  return <SettingsPage />;
}
