import { LoginClient } from "./LoginClient";

export default function LoginPage(props: {
  searchParams?: { callbackUrl?: string };
}) {
  const raw = props.searchParams?.callbackUrl;
  const callbackUrl = raw && raw.startsWith("/") ? raw : "/upload";
  return <LoginClient callbackUrl={callbackUrl} />;
}

