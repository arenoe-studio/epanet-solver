import { notFound, redirect } from "next/navigation";

import { isAdminEmail } from "@/lib/admin";
import { auth } from "@/lib/auth-server";

export async function requireAdmin() {
  const session = await auth();
  const email = session?.user?.email ?? null;
  const userId = session?.user?.id ?? null;

  if (!session || !email || !userId) {
    redirect("/login?callbackUrl=%2Fadmin");
  }

  if (!isAdminEmail(email)) {
    notFound();
  }

  return {
    session,
    email,
    userId
  };
}
