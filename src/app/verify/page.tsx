import { VerifyClient } from "./VerifyClient";

export default function VerifyEmailPage(props: {
  searchParams?: { email?: string; sent?: string; callbackUrl?: string };
}) {
  const initialEmail = props.searchParams?.email ?? "";
  const sent = props.searchParams?.sent === "1";
  const callbackUrl = props.searchParams?.callbackUrl;
  return (
    <VerifyClient
      initialEmail={initialEmail}
      callbackUrl={callbackUrl}
      initialResendCooldownSeconds={sent ? 60 : 0}
    />
  );
}
