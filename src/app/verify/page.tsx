import { VerifyClient } from "./VerifyClient";

export default function VerifyEmailPage(props: {
  searchParams?: { email?: string; callbackUrl?: string };
}) {
  const initialEmail = props.searchParams?.email ?? "";
  const callbackUrl = props.searchParams?.callbackUrl;
  return <VerifyClient initialEmail={initialEmail} callbackUrl={callbackUrl} />;
}
