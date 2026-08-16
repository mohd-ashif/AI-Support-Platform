import { redirect } from "next/navigation";

export default function LegacyAuthCallbackRedirect() {
  redirect("/callback");
}
