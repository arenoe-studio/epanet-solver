import { ResetPasswordClient } from "./reset-password-client";

export default function ResetPasswordPage(props: {
  searchParams?: { token?: string };
}) {
  const token = props.searchParams?.token ?? "";
  return <ResetPasswordClient token={token} />;
}
