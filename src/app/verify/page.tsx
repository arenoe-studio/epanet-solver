import { VerifyClient } from "./VerifyClient";

export default function VerifyEmailPage(props: {
  searchParams?: { email?: string; sent?: string; callbackUrl?: string };
}) {
  const initialEmail = props.searchParams?.email ?? "";
  const codeSent = props.searchParams?.sent === "1";
  const callbackUrl = props.searchParams?.callbackUrl;
  return (
    <VerifyClient initialEmail={initialEmail} codeSent={codeSent} callbackUrl={callbackUrl} />
  );
}
