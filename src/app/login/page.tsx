import { LoginClient } from "./LoginClient";

export default function LoginPage(props: {
  searchParams?: {
    callbackUrl?: string;
    verified?: string;
    reset?: string;
    email?: string;
  };
}) {
  const raw = props.searchParams?.callbackUrl;
  const callbackUrl = raw && raw.startsWith("/") ? raw : "/dashboard";
  const initialEmail = props.searchParams?.email ?? "";
  const verified = props.searchParams?.verified === "1";
  const reset = props.searchParams?.reset === "1";
  return (
    <LoginClient
      callbackUrl={callbackUrl}
      initialEmail={initialEmail}
      verified={verified}
      reset={reset}
    />
  );
}
