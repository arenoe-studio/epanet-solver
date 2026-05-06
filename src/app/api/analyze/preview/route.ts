import { NextResponse } from "next/server";

import { auth } from "@/lib/auth-server";
import { parseJsonResponse } from "@/lib/http";
import { buildPythonApiUrl } from "@/lib/python-api";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".inp")) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 400 });
  }

  const pythonFormData = new FormData();
  pythonFormData.set("file", file);

  try {
    const pythonRes = await fetch(buildPythonApiUrl(req.url, "/v1/preview"), {
      method: "POST",
      body: pythonFormData,
      signal: AbortSignal.timeout(15000)
    });
    const { text, json } = await parseJsonResponse(pythonRes);

    if (pythonRes.ok && json) {
      return NextResponse.json({ success: true, ...json });
    }

    const msg =
      json?.detail ??
      json?.error ??
      (text && text.trim()) ??
      (pythonRes.status === 503
        ? "Solver sedang maintenance. Silakan coba lagi beberapa saat."
        : "System error");

    if (pythonRes.status === 422) {
      return NextResponse.json({ success: false, error: msg }, { status: 422 });
    }

    return NextResponse.json({ success: false, error: msg }, { status: pythonRes.status });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "Backend Python API timeout"
        : "System error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

