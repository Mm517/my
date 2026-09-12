export type Attachment = {
  url: string;
  name: string;
  size: number;
  mimeType: string;
  kind: "image" | "pdf" | "doc" | "file";
};

export type PollOption = {
  id: string;
  text: string;
  votes: number;
  voters: { id: string; anonymousName: string }[];
};

export type Poll = {
  question: string;
  options: PollOption[];
  allowMultiple: boolean;
  closesAt: string | null;
  isClosed: boolean;
  totalVoters: number;
  myVotes: string[];
};

export type ReactionUser = {
  id: string;
  anonymousName: string;
};

export type ReactionAggregate = {
  emoji: string;
  count: number;
  userIds: string[];
  users: ReactionUser[];
};

export type MessageParent = {
  id: string;
  anonymousName: string;
  preview: string;
};

export type ChatMessage = {
  id: string;
  userId: string;
  anonymousName: string;
  grade: string | null;
  content: string;
  attachment: Attachment | null;
  poll: Poll | null;
  edited: boolean;
  filtered: boolean;
  isPinned: boolean;
  parent: MessageParent | null;
  reactions: ReactionAggregate[];
  mentions: string[];
  deliveredTo: string[];
  seenBy: string[];
  createdAt: string;
};

export type MessageReceiptUpdate = {
  id: string;
  deliveredTo: string[];
  seenBy: string[];
};

export type DirectoryUser = {
  anonymousName: string;
  ids: string[];
  isOnline: boolean;
  grade: string | null;
};

/** Matches middlewares/auth.ts `publicUser()` on the server. */
export type CurrentUser = {
  id: string;
  name: string;
  anonymousName: string;
  username: string | null;
  grade: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  isBanned: boolean;
  isMuted: boolean;
  messagesSent: number;
  joinedAt: string;
};

export type ChatState = {
  chatEnabled: boolean;
  announcement: string | null;
  memberCount: number;
  pinnedCount: number;
  onlineCount: number;
  updatedAt: string;
};

export type StudyPlan = {
  id: string;
  userId: string;
  title: string;
  subject: string | null;
  details: string;
  targetDate: string | null;
  createdAt: string;
};

export type Challenge = {
  id: string;
  userId: string;
  title: string;
  details: string;
  difficulty: "easy" | "medium" | "hard";
  completed: boolean;
  createdAt: string;
};

export type AdminUser = {
  id: string;
  name: string;
  anonymousName: string;
  grade: string | null;
  isAdmin: boolean;
  isBanned: boolean;
  isMuted: boolean;
  messagesSent: number;
  joinedAt: string;
  lastSeenAt: string | null;
  isOnline: boolean;
};

export type AdminStats = {
  totalUsers: number;
  totalMessages: number;
  bannedUsers: number;
  mutedUsers: number;
  messagesToday: number;
  flaggedMessages?: number;
  chatEnabled: boolean;
};

/** authorEmail removed — email lives in Supabase auth.users now, not exposed here. */
export type FlaggedMessage = {
  id: string;
  userId: string;
  anonymousName: string;
  authorRealName: string;
  content: string;
  attachment: Attachment | null;
  createdAt: string;
};
