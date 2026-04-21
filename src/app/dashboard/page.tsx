import { redirect } from "next/navigation";

import { auth } from "@/lib/auth-server";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=%2Fdashboard");
  }
  redirect("/upload");
}

