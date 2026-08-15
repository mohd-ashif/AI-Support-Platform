const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

let memoryAccessToken: string | null = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
let refreshPromise: Promise<string | null> | null = null;

export const setMemoryAccessToken = (token: string | null) => {
  memoryAccessToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      localStorage.setItem("access_token", token);
    } else {
      localStorage.removeItem("access_token");
    }
  }
};

export const getMemoryAccessToken = () => {
  if (!memoryAccessToken && typeof window !== "undefined") {
    memoryAccessToken = localStorage.getItem("access_token");
  }
  return memoryAccessToken;
};

let memoryWorkspaceId: string | null = typeof window !== "undefined" ? localStorage.getItem("workspace_id") : null;

export const setMemoryWorkspaceId = (id: string | null) => {
  memoryWorkspaceId = id;
  if (typeof window !== "undefined") {
    if (id) {
      localStorage.setItem("workspace_id", id);
    } else {
      localStorage.removeItem("workspace_id");
    }
  }
};

export const getMemoryWorkspaceId = () => {
  if (!memoryWorkspaceId && typeof window !== "undefined") {
    memoryWorkspaceId = localStorage.getItem("workspace_id");
  }
  return memoryWorkspaceId;
};

interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
  skipAuthRefresh?: boolean;
}

async function executeSingleRefresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          setMemoryAccessToken(refreshData.access_token);
          return refreshData.access_token as string;
        } else {
          setMemoryAccessToken(null);
          return null;
        }
      } catch (err) {
        setMemoryAccessToken(null);
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export async function apiFetch<T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const token = getMemoryAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const workspaceId = options.headers?.["X-Workspace-Id"] || options.headers?.["x-workspace-id"] || getMemoryWorkspaceId();
  if (workspaceId && !headers["X-Workspace-Id"] && !headers["x-workspace-id"]) {
    headers["X-Workspace-Id"] = workspaceId;
  }

  const config: RequestInit = {
    ...options,
    headers,
    credentials: "include",
  };

  let response: Response;
  try {
    response = await fetch(url, config);
  } catch (err: any) {
    throw new Error(
      err?.message && !err.message.includes("Failed to fetch")
        ? err.message
        : `Unable to connect to backend server (${API_BASE_URL}). Please verify that the API server is running.`
    );
  }

  // Single-flight refresh token queue on 401 Unauthorized
  if (
    response.status === 401 &&
    !options.skipAuthRefresh &&
    !endpoint.includes("/auth/login") &&
    !endpoint.includes("/auth/register") &&
    !endpoint.includes("/auth/refresh")
  ) {
    const newToken = await executeSingleRefresh();
    if (newToken) {
      setMemoryAccessToken(newToken);
      headers["Authorization"] = `Bearer ${newToken}`;
      try {
        response = await fetch(url, { ...config, headers });
      } catch (err: any) {
        throw new Error(
          err?.message && !err.message.includes("Failed to fetch")
            ? err.message
            : `Unable to connect to backend server (${API_BASE_URL}). Please verify that the API server is running.`
        );
      }
    } else {
      setMemoryAccessToken(null);
      if (
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith("/login") &&
        !window.location.pathname.startsWith("/signup")
      ) {
        window.location.href = "/login";
      }
    }
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ detail: response.statusText }));
    const errorMessage = errorBody.detail || "An error occurred";
    throw new Error(errorMessage);
  }

  const resultData = await response.json();
  if (endpoint.includes("/auth/refresh") && resultData?.access_token) {
    setMemoryAccessToken(resultData.access_token);
  }

  return resultData;
}
