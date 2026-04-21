import { ResetPasswordClient } from "./reset-password-client";

export default function ResetPasswordPage(props: {
  searchParams?: { email?: string; token?: string };
}) {
  const email = props.searchParams?.email ?? "";
  const token = props.searchParams?.token ?? "";
  return <ResetPasswordClient email={email} token={token} />;
}

