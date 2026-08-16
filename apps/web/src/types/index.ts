/**
 * Centralized TypeScript Domain Types for SupportAI Platform
 */

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string | null;
  created_at?: string;
}

export interface Business {
  id: string;
  name: string;
  slug?: string | null;
  status?: string;
  website_url?: string | null;
  industry?: string | null;
  logo_url?: string | null;
  owner_user_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface Workspace {
  id: string;
  business_id: string;
  workspace_uuid: string;
  plan_id?: string | null;
  status: string;
  role?: string;
  business?: Business | null;
  integration_viewed?: boolean;
  widget_tested?: boolean;
}

export interface TeamMember {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "agent" | string;
  joined_at: string;
}

export interface WebSource {
  id: string;
  workspace_id: string;
  url: string;
  status: "pending" | "crawling" | "completed" | "failed" | string;
  page_count: number;
  last_crawled_at?: string | null;
  error_message?: string | null;
}

export interface FileSource {
  id: string;
  workspace_id: string;
  filename: string;
  file_size_bytes: number;
  cloudinary_url?: string | null;
  status: "pending" | "processing" | "ready" | "failed" | string;
  error_message?: string | null;
}

export interface WidgetContentCard {
  title: string;
  description: string;
  icon_name?: string;
}

export interface WidgetConfigData {
  id: string;
  workspace_id: string;
  brand_name: string;
  tagline?: string | null;
  logo_url?: string | null;
  primary_color: string;
  greeting_message?: string | null;
  content_cards_json?: WidgetContentCard[];
  updated_at?: string | null;
}

export interface Plan {
  id: string;
  name: string;
  price_monthly_cents: number;
  price_annual_cents: number;
  price_monthly_display: string;
  price_annual_display: string;
  message_limit: number;
  seat_limit: number;
  trial_days?: number | null;
  stripe_price_id_monthly?: string | null;
  stripe_price_id_annual?: string | null;
  features_json: Record<string, any>;
}

export interface Subscription {
  id?: string | null;
  workspace_id: string;
  plan_id: string;
  plan_name: string;
  status: "active" | "trialing" | "past_due" | "canceled" | "incomplete" | string;
  messages_used: number;
  messages_limit: number;
  seats_used: number;
  seat_limit: number;
  price_monthly_cents: number;
  price_annual_cents: number;
  price_monthly_display: string;
  price_annual_display: string;
  stripe_customer_id?: string | null;
  stripe_sub_id?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  features_json?: Record<string, any>;
}

export interface AnalyticsDailyPoint {
  date: string;
  conversations_count: number;
  ai_resolved_count: number;
  avg_response_ms: number;
}

export interface TopQuestionItem {
  question: string;
  count: number;
}

export interface AnalyticsSummary {
  total_conversations: number;
  overall_resolution_rate: number;
  ai_resolution_rate?: number;
  avg_response_ms: number;
  avg_response_speed_ms?: number;
  csat_score?: number | null;
  conversations_change?: number;
  resolution_rate_change?: number;
  speed_change_ms?: number;
  series: AnalyticsDailyPoint[];
  top_questions: TopQuestionItem[];
}

export interface APIKeyItem {
  id: string;
  label: string;
  key_prefix: string;
  created_at: string;
  revoked: boolean;
}

export interface WebhookItem {
  id: string;
  url: string;
  events: string[];
  secret: string;
}
