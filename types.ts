import { Timestamp } from "firebase/firestore";

export type UserRole = "freelancer" | "client";

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  role: UserRole;
  stripeAccountId?: string;
  demoMode?: boolean;
  createdAt: Timestamp;
  pushNotifications?: boolean;
  emailNotifications?: boolean;
  // New fields
  skills?: string[];
  location?: string;
  bio?: string;
  portfolioUrl?: string;
  onboardingCompleted?: boolean;
}

export interface Thread {
  id: string;
  title: string;
  participants: string[];
  clientId?: string;
  freelancerId?: string;
  workPostId?: string;
  lastMessage?: string;
  updatedAt: Timestamp;
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhoto: string;
  createdAt: Timestamp;
  threadId: string; // Added for easier notification filtering
  type?: "text" | "file" | "voice";
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  voiceUrl?: string; // Keeping for backward compatibility if needed, but requirements say fileUrl
  duration?: number;
  seenBy?: string[];
  edited?: boolean;
}

export type TaskStatus = "pending" | "paid" | "delivered" | "completed";

export interface Task {
  id: string;
  title: string;
  description: string;
  deadline: Timestamp;
  price: number;
  status: TaskStatus;
  deliveryUrl?: string;
  deliveryType?: string;
  deliveryFileName?: string;
  threadId: string;
  creatorId: string;
  clientId: string;
  freelancerId: string;
  createdAt: Timestamp;
}

export interface Transaction {
  id: string;
  taskId: string;
  amount: number;
  fee: number;
  status: string;
  fromId: string;
  toId: string;
  createdAt: Timestamp;
}

export interface WorkPost {
  id: string;
  title: string;
  description: string;
  budget: number;
  category: string;
  deadline: string;
  clientId: string;
  clientName: string;
  clientAvatar: string;
  status: "open" | "closed";
  createdAt: Timestamp;
}

export interface TimelineItem {
  id: string;
  type: "message" | "milestone_created" | "milestone_sent" | "payment" | "work_posted";
  title: string;
  subtitle: string;
  projectName: string;
  userAvatar: string;
  createdAt: Timestamp;
  data?: any;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "message" | "task_status" | "task_created" | "payment" | "delivery";
  link: string;
  read: boolean;
  createdAt: Timestamp;
}
