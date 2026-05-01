import { Suspense } from "react";
import { VerifyEmailNoticeClient } from "./verify-email-notice-client";

export default async function VerifyEmailNoticePage(props: {
  searchParams?: Promise<{ email?: string; sent?: string; reason?: string }>;
}) {
  const params = await props.searchParams;
  const email = params?.email ?? "";
  const sent = params?.sent === "1";
  const reason = params?.reason ?? "";
  return (
    <Suspense fallback={null}>
      <VerifyEmailNoticeClient email={email} sent={sent} reason={reason} />
    </Suspense>
  );
}
