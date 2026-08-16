import { redirect } from "next/navigation";

export default function LegacyWidgetCustomizationRedirect() {
  redirect("/dashboard/widget");
}
