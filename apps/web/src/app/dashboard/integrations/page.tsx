import { redirect } from "next/navigation";

export default function LegacyIntegrationsRedirect() {
  redirect("/dashboard/widget#installation");
}
