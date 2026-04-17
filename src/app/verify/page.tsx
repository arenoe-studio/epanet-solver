import { VerifyClient } from "./VerifyClient";

export default function VerifyEmailPage(props: { searchParams?: { email?: string } }) {
  const initialEmail = props.searchParams?.email ?? "";
  return <VerifyClient initialEmail={initialEmail} />;
}

