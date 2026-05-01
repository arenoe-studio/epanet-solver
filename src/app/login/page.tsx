import { LoginClient } from "./LoginClient";

export default async function LoginPage(props: {
  searchParams?: Promise<{
    callbackUrl?: string;
    verified?: string;
    reset?: string;
    email?: string;
  }>;
}) {
  const params = await props.searchParams;
  const raw = params?.callbackUrl;
  const callbackUrl = raw && raw.startsWith("/") ? raw : "/dashboard";
  const initialEmail = params?.email ?? "";
  const verified = params?.verified === "1";
  const reset = params?.reset === "1";
  return (
    <LoginClient
      callbackUrl={callbackUrl}
      initialEmail={initialEmail}
      verified={verified}
      reset={reset}
    />
  );
}
