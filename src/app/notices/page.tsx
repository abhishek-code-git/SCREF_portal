import type { Metadata } from "next";
import { NoticesPage } from "@/views/notices-page";

export const metadata: Metadata = { title: "Notices — The Centennial School" };

export default function Page() {
  return <NoticesPage />;
}
