import { apiFetch } from "@/lib/api";
import { User, Workspace } from "@/types";

export interface LoginPayload {
  email: string;
  password?: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
  workspaces: Workspace[];
}

export const authService = {
  async getCurrentUser(): Promise<User> {
    return apiFetch<User>("/auth/me");
  },

  async login(payload: LoginPayload): Promise<AuthResponse> {
    return apiFetch<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
      skipAuthRefresh: true,
    });
  },

  async register(payload: { email: string; password?: string; name?: string }): Promise<AuthResponse> {
    return apiFetch<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
      skipAuthRefresh: true,
    });
  },

  async refreshToken(): Promise<{ access_token: string }> {
    return apiFetch<{ access_token: string }>("/auth/refresh", {
      method: "POST",
      skipAuthRefresh: true,
    });
  },

  async getGoogleUrl(): Promise<{ url: string }> {
    return apiFetch<{ url: string }>("/auth/google/url");
  },

  async googleAuth(code: string): Promise<AuthResponse> {
    return apiFetch<AuthResponse>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  },

  async logout(): Promise<{ message: string }> {
    return apiFetch<{ message: string }>("/auth/logout", {
      method: "POST",
    });
  },
};
