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
  /** 공유 URL (R2에 업로드된 프로토타입) */
  shareUrl?: string;
}
