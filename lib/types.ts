export type Message = {
  sid: string;
  dir: 'in' | 'out';
  body: string;
  at: string;
  status: string;
  error: number | null;
  media: number;
};

export type Conversation = {
  phone: string;
  name: string;
  status: string;
  amount: string;
  folder: string;
  reminders: number;
  lastAt: string;
  lastInAt: string | null;
  windowOpen: boolean;
  messages: Message[];
};

export type TemplateInfo = {
  sid: string;
  name: string;
  body: string;
  variables: string[];
  sample: Record<string, string>;
  category: string;
};
