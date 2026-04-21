export function getRequestOrigin(request: Request): string {
  const explicit =
    process.env.APP_BASE_URL ??
    process.env.NEXTAUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL;

  if (explicit) return explicit.replace(/\/$/, "");

  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    "localhost:3000";

  return `${proto}://${host}`;
}

