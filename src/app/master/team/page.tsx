import type { Metadata } from "next";
import { MasterTeamPage } from "@/views/master-team-page";

export const metadata: Metadata = { title: "Team — Master Network" };
export default function Page() { return <MasterTeamPage />; }
