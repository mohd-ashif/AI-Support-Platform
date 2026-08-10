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
