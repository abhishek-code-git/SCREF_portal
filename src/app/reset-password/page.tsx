import type { Metadata } from "next";
import { ResetPage } from "@/views/reset-password-page";

export const metadata: Metadata = {
  title: "Reset password — The Centennial School Platform",
  description: "Set a new password for your Centennial centre account.",
  openGraph: {
    title: "Reset password — The Centennial School Platform",
    description: "Set a new password for your centre account.",
    type: "website",
  },
  twitter: { card: "summary" },
};

export default function Page() {
  return <ResetPage />;
}
