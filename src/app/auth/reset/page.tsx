import ResetForm from "./ResetForm";

// This page reads the password-recovery session from the browser (URL hash /
// cookies set by Supabase after the email link redirect) — there is nothing
// to render server-side. Forcing dynamic rendering keeps Next.js from trying
// to statically prerender it at build time, which requires the Supabase env
// vars to be present in the *build* environment — previously this took down
// the entire production build whenever they weren't.
export const dynamic = "force-dynamic";

export default function ResetPage() {
  return <ResetForm />;
}
