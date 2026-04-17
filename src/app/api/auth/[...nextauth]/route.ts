import NextAuth from "next-auth";

import { getAuthOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: unknown) {
  const handler = NextAuth(getAuthOptions());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (handler as any)(request, context);
}

export async function POST(request: Request, context: unknown) {
  const handler = NextAuth(getAuthOptions());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (handler as any)(request, context);
}
