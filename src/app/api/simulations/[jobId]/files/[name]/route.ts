import { NextResponse } from "next/server";

import { auth } from "@/lib/auth-server";

function getBackendBaseUrl(requestUrl: string) {
  const env = process.env.PYTHON_API_URL;
  if (env) {
    try {
      const u = new URL(env);
      if (u.pathname && u.pathname !== "/") return `${u.origin}`;
      return env.replace(/\/+$/, "");
    } catch {
      return env;
    }
  }
  return new URL(requestUrl).origin;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ jobId: string; name: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId, name } = await ctx.params;
  const base = getBackendBaseUrl(req.url);
  const url = `${base}/v1/simulations/${encodeURIComponent(jobId)}/files/${encodeURIComponent(name)}`;

  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      const msg = json?.detail ?? json?.error ?? "Not found";
      return NextResponse.json({ error: msg }, { status: res.status });
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const headers = new Headers();
    const ct = res.headers.get("content-type");
    if (ct) headers.set("content-type", ct);
    const cd = res.headers.get("content-disposition");
    if (cd) headers.set("content-disposition", cd);
    return new Response(buf, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: "System error" }, { status: 500 });
  }
}

