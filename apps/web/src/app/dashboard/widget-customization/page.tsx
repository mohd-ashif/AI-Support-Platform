"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WidgetCustomizationRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/widget");
  }, [router]);

  return null;
}
