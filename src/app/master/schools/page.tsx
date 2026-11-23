import type { Metadata } from "next";
import { MasterSchoolsPage } from "@/views/master-schools-page";

export const metadata: Metadata = { title: "Schools — Master Network" };
export default function Page() { return <MasterSchoolsPage />; }
