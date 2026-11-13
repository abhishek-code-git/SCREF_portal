import type { Metadata } from "next";
import { LoginPage } from "@/views/login-page";

export const metadata: Metadata = {
  title: "Sign in or create an account — The Centennial School",
  description: "Sign in to your Centennial School account or register a new school centre.",
  openGraph: {
    title: "Sign in or create an account — The Centennial School",
    description: "Secure access for Centennial School owners and invited staff.",
    type: "website",
  },
  twitter: { card: "summary" },
};

export default function Page() {
  return <LoginPage />;
}
