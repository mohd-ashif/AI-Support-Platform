import { redirect } from "next/navigation";

export default function LegacyDataImporterRedirect() {
  redirect("/dashboard/knowledge");
}
