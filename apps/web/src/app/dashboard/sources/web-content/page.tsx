import { redirect } from "next/navigation";

export default function LegacyWebContentRedirect() {
  redirect("/dashboard/knowledge");
}
