export interface ChatMessage {
  id: string;
  role: "user" | "ai" | "system";
  content: string;
}

export interface Snapshot {
  spec: string;
  html: string;
  timestamp: number;
  summary: string;
  userMessage?: string;
}

export interface Session {
  id: string;
  title: string;
  createdAt: number;
  messages: ChatMessage[];
  specContent: string;
  htmlContent: string;
  snapshots: Snapshot[];
}
