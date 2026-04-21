import { VerifyEmailNoticeClient } from "./verify-email-notice-client";

export default function VerifyEmailNoticePage(props: {
  searchParams?: { email?: string; sent?: string; reason?: string };
}) {
  const email = props.searchParams?.email ?? "";
  const sent = props.searchParams?.sent === "1";
  const reason = props.searchParams?.reason ?? "";
  return <VerifyEmailNoticeClient email={email} sent={sent} reason={reason} />;
}

