export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
}

export interface Workspace {
  id: string;
  business_id: string;
  workspace_uuid: string;
  status: string;
}

export interface Conversation {
  id: string;
  workspace_id: string;
  visitor_id: string;
  status: 'open' | 'closed' | 'human_takeover';
}

export interface AnalyticsSeriesItem {
  date: string;
  conversations_count: number;
  ai_resolved_count: number;
  avg_response_ms: number;
}

export interface TopQuestion {
  question: string;
  count: number;
}

export interface AnalyticsSummary {
  total_conversations: number;
  overall_resolution_rate: number;
  avg_response_ms: number;
  csat_score: number | null;
  series: AnalyticsSeriesItem[];
  top_questions: TopQuestion[];
}
