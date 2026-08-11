"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { store } from "@/store";
import { AuthGuard } from "@/components/auth/AuthGuard";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 30, // 30s default staleTime
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <AuthGuard>{children}</AuthGuard>
      </Provider>
    </QueryClientProvider>
  );
}

