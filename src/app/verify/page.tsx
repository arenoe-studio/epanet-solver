import { redirect } from "next/navigation";

export default function VerifyEmailPage(props: {
  searchParams?: { email?: string; sent?: string };
}) {
  const email = props.searchParams?.email ?? "";
  const sent = props.searchParams?.sent ?? "0";
  const qp = new URLSearchParams();
  if (email) qp.set("email", email);
  qp.set("sent", sent === "1" ? "1" : "0");
  redirect(`/verify-email-notice?${qp.toString()}`);
}
