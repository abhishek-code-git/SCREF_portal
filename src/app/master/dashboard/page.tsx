import type { Metadata } from "next";
import { MasterDashboardPage } from "@/views/master-dashboard-page";

export const metadata: Metadata = { title: "Master Franchise Dashboard — The Centennial Network" };
export default function Page() { return <MasterDashboardPage />; }
