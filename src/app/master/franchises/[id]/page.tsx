import type { Metadata } from "next";
import { MasterFranchiseDetailPage } from "@/views/master-franchise-detail-page";

export const metadata: Metadata = { title: "Franchise Details — Master Network" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <MasterFranchiseDetailPage id={id} />; }
