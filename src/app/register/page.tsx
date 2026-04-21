import { RegisterClient } from "./RegisterClient";

export default function RegisterPage(props: {
  searchParams?: {
    email?: string;
  };
}) {
  const initialEmail = props.searchParams?.email ?? "";
  return <RegisterClient initialEmail={initialEmail} />;
}
