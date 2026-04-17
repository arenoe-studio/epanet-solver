import { getServerSession } from "next-auth";

import { getAuthOptions } from "@/lib/auth";

export function auth() {
  return getServerSession(getAuthOptions());
}

