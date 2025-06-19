export interface ThreadMessage {
  id: string;
  role: 'user' | 'amp' | 'system';
  content: string;
  ts: string; // ISO date string
  metadata?: {
    type?: 'text' | 'code' | 'error' | 'file_change';
    files?: string[];
    exitCode?: number;
  };
}

export interface MessageBubbleProps {
  message: ThreadMessage;
  className?: string;
}

export type MessageRole = 'user' | 'amp' | 'system';

export interface RoleConfig {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  bgColor: string;
  textColor: string;
  bubbleColor: string;
  borderColor: string;
}
