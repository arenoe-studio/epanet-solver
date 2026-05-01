import { ResetPasswordClient } from "./reset-password-client";

export default async function ResetPasswordPage(props: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const params = await props.searchParams;
  const token = params?.token ?? "";
  return <ResetPasswordClient token={token} />;
}
