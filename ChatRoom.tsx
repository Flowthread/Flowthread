import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, auth, handleFirestoreError, OperationType } from "../firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  Timestamp,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { Message, Task, UserProfile, Notification } from "../types";
import { Send, Plus, X, Calendar, DollarSign, CheckCircle2, ExternalLink, Loader2, Sparkles, Trash2, FileText, MapPin, Globe, Briefcase, MoreVertical, Edit2, Check, CheckCheck } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { motion, AnimatePresence } from "motion/react";
import { format, addDays, parseISO, isValid } from "date-fns";
import { clsx } from "clsx";
import { GoogleGenAI, Type } from "@google/genai";
import { toast } from "sonner";

export default function ChatRoom() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [inputText, setInputText] = useState("");
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showDeliverModal, setShowDeliverModal] = useState<string | null>(null);
  const [deliveryUrl, setDeliveryUrl] = useState("");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [thread, setThread] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [payingTaskId, setPayingTaskId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [analyzingMessageId, setAnalyzingMessageId] = useState<string | null>(null);
  const [taskFilter, setTaskFilter] = useState<"all" | "pending" | "paid" | "delivered" | "completed">("all");
  const [showCompleteModal, setShowCompleteModal] = useState<string | null>(null);
  const [showDeleteTaskModal, setShowDeleteTaskModal] = useState<string | null>(null);
  const [showDeleteAllTasksModal, setShowDeleteAllTasksModal] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<UserProfile | null>(null);
  const [showParticipantModal, setShowParticipantModal] = useState(false);
  const [showEditMsgModal, setShowEditMsgModal] = useState(false);
  const prevTasksRef = useRef<Task[]>([]);
  const analyzedMessagesRef = useRef<Set<string>>(new Set());
  const [suggestion, setSuggestion] = useState<{
    messageId: string;
    title: string;
    description: string;
    price: number;
    deadline: string;
  } | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [showMsgMenuId, setShowMsgMenuId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    deadline: format(new Date(), "yyyy-MM-dd"),
    price: 0,
  });

  // Mark messages as seen
  useEffect(() => {
    if (!auth.currentUser || !threadId || messages.length === 0) return;

    const uid = auth.currentUser.uid;
    const unseenMessages = messages.filter(m => 
      m.senderId !== uid && (!m.seenBy || !m.seenBy.includes(uid))
    );

    if (unseenMessages.length > 0) {
      console.log(`[Read Receipts] Marking ${unseenMessages.length} messages as seen by ${uid}`);
      unseenMessages.forEach(async (m) => {
        try {
          const msgRef = doc(db, "threads", threadId, "messages", m.id);
          await updateDoc(msgRef, {
            seenBy: [...(m.seenBy || []), uid]
          });
        } catch (err) {
          console.error("Error updating read receipt", err);
        }
      });
    }
  }, [messages, threadId]);

  useEffect(() => {
    if (!auth.currentUser || !threadId) return;
    const fetchProfile = async () => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) setUserProfile(userDoc.data() as UserProfile);
      } catch (err) {
        console.error("Error fetching profile", err);
      }
    };
    fetchProfile();

    const fetchThread = async () => {
      try {
        if (!threadId) return;
        const threadDoc = await getDoc(doc(db, "threads", threadId));
        if (threadDoc.exists()) {
          const data = threadDoc.data();
          setThread({ id: threadDoc.id, ...data });
          if (!data.clientId || !data.freelancerId) {
            setError("This thread is invalid. Please create a new thread from a work post.");
          }
        } else {
          setError("Thread not found.");
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `threads/${threadId}`);
        setError("Failed to load thread details.");
      }
    };
    fetchThread();
  }, [threadId]);

  useEffect(() => {
    if (!threadId || error) return;

    const messagesQuery = query(
      collection(db, "threads", threadId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribeMessages = onSnapshot(
      messagesQuery,
      (snapshot) => {
        setMessages(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Message)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `threads/${threadId}/messages`)
    );

    const tasksQuery = query(
      collection(db, "threads", threadId, "tasks"),
      orderBy("createdAt", "asc")
    );

    const unsubscribeTasks = onSnapshot(
      tasksQuery,
      (snapshot) => {
        console.log(`[Tasks Listener] Received ${snapshot.docs.length} tasks for thread ${threadId}`);
        setTasks(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Task)));
      },
      (err) => {
        console.error(`[Tasks Listener] Error:`, err);
        handleFirestoreError(err, OperationType.LIST, `threads/${threadId}/tasks`);
      }
    );

    return () => {
      unsubscribeMessages();
      unsubscribeTasks();
    };
  }, [threadId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      
      if (lastMessage.senderId === auth.currentUser?.uid && lastMessage.senderId !== "system") {
        if (!analyzedMessagesRef.current.has(lastMessage.id)) {
          analyzedMessagesRef.current.add(lastMessage.id);
          const isDirectCommand = lastMessage.text.toLowerCase().startsWith("@flow ai") || lastMessage.text.toLowerCase().startsWith("hi flow ai");
          
          if (isDirectCommand) {
             setSuggestion(null);
             analyzeMessage(lastMessage, true);
          } else if (userProfile?.role === "client") {
             setSuggestion(null);
             analyzeMessage(lastMessage, false);
          }
        }
      }
    }
  }, [messages, tasks, userProfile]);

  useEffect(() => {
    if (prevTasksRef.current.length > 0) {
      tasks.forEach(task => {
        const prevTask = prevTasksRef.current.find(t => t.id === task.id);
        if (prevTask && prevTask.status !== task.status) {
          toast.success(`Task status updated to ${task.status}`);
        }
      });
    }
    prevTasksRef.current = tasks;
  }, [tasks]);

  const analyzeMessage = async (message: Message, isDirectCommand: boolean = false) => {
    // Skip if there's already a pending task, UNLESS it's a direct command
    if (!isDirectCommand && tasks.some(t => t.status === "pending")) return;

    const text = message.text.toLowerCase();
    
    if (!isDirectCommand) {
      const keywords = ["can you", "could you", "i need", "build", "design", "write", "create", "fix", "help me with", "how much", "price", "deadline", "by"];
      const matches = keywords.filter(k => text.includes(k));
      if (matches.length < 2) return;
    }

    setAnalyzingMessageId(message.id);

    try {
      let extractedData: any = null;

      // Try Gemini API
      if (process.env.GEMINI_API_KEY) {
        try {
          const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          
          const prompt = isDirectCommand 
            ? `You are Flow AI, a smart assistant helping a client and freelancer manage their project.
Analyze the conversation and the latest message.
If the user is asking to create a task/milestone, extract the title, price (number), and deadline (YYYY-MM-DD).
If you have enough information (title, price, and deadline), set intent to "create_task".
If you are missing price or deadline, set intent to "ask_question" and provide a helpful reply asking for the missing details.
Respond ONLY with a JSON object in this format:
{
  "intent": "create_task" | "ask_question" | "none",
  "task": { "title": "...", "price": 100, "deadline": "YYYY-MM-DD" },
  "reply": "Your response if asking a question"
}

Latest Message: "${message.text}"`
            : `Extract from the following message: task title, deadline (as ISO date if possible), price (numeric). If not present, leave empty. Return as JSON.
            
Message: "${message.text}"`;

          const model = genAI.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: isDirectCommand ? {
                type: Type.OBJECT,
                properties: {
                  intent: { type: Type.STRING },
                  task: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      deadline: { type: Type.STRING },
                      price: { type: Type.NUMBER }
                    }
                  },
                  reply: { type: Type.STRING }
                }
              } : {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  deadline: { type: Type.STRING },
                  price: { type: Type.NUMBER }
                }
              }
            }
          });
          const response = await model;
          extractedData = JSON.parse(response.text || "{}");
        } catch (err) {
          console.error("Gemini analysis failed, falling back to regex", err);
        }
      }

      // Fallback or if Gemini failed
      if (!extractedData || (isDirectCommand && !extractedData.intent)) {
        const priceMatch = message.text.match(/\$(\d+)/) || message.text.match(/(\d+)\s*dollars/i);
        const price = priceMatch ? parseInt(priceMatch[1]) : 0;
        
        const deadlineMatch = message.text.match(/by\s+(friday|tomorrow|in\s+\d+\s+days)/i);
        let deadline = "";
        if (deadlineMatch) {
            deadline = format(addDays(new Date(), 3), "yyyy-MM-dd"); // rough fallback
        }

        if (isDirectCommand) {
          if (price > 0 && message.text.length > 15) {
             extractedData = { intent: "create_task", task: { title: message.text.replace(/@flow ai|hi flow ai/ig, "").trim().substring(0, 50), price, deadline: deadline || format(addDays(new Date(), 3), "yyyy-MM-dd") } };
          } else {
             extractedData = { intent: "ask_question", reply: "I can help create a task! Please provide a title, price, and deadline." };
          }
        } else {
          extractedData = {
            title: message.text.substring(0, 50),
            price: price,
            deadline: deadline
          };
        }
      }

      if (isDirectCommand) {
        if (extractedData.intent === "create_task" && extractedData.task) {
          // Create task directly
          let deadline = extractedData.task.deadline;
          if (deadline && !isValid(parseISO(deadline))) {
            deadline = format(addDays(new Date(), 3), "yyyy-MM-dd");
          } else if (!deadline) {
            deadline = format(addDays(new Date(), 3), "yyyy-MM-dd");
          }

          setNewTask({
            title: extractedData.task.title || "New Task",
            description: "Created by Flow AI",
            deadline: deadline,
            price: extractedData.task.price || 0,
          });
          setShowTaskModal(true);
          toast.success("Flow AI drafted a task for you!");
        } else if (extractedData.intent === "ask_question" && extractedData.reply) {
          // Send AI reply
          await addDoc(collection(db, "threads", threadId, "messages"), {
            text: extractedData.reply,
            senderId: "system",
            senderName: "Flow AI",
            senderPhoto: "https://ui-avatars.com/api/?name=Flow+AI&background=6366f1&color=fff",
            createdAt: Timestamp.now(),
            threadId: threadId,
          });
        }
      } else {
        setSuggestion({
          messageId: message.id,
          title: extractedData.title || message.text.substring(0, 50),
          description: message.text,
          price: extractedData.price || 0,
          deadline: extractedData.deadline || format(addDays(new Date(), 3), "yyyy-MM-dd")
        });
      }
    } catch (err) {
      console.error("Analysis error", err);
    } finally {
      setAnalyzingMessageId(null);
    }
  };

  const handleApplySuggestion = () => {
    if (!suggestion) return;
    
    let deadline = suggestion.deadline;
    // Basic validation of deadline
    if (deadline && !isValid(parseISO(deadline))) {
      deadline = format(addDays(new Date(), 3), "yyyy-MM-dd");
    } else if (!deadline) {
      deadline = format(addDays(new Date(), 3), "yyyy-MM-dd");
    }

    setNewTask({
      title: suggestion.title,
      description: suggestion.description,
      deadline: deadline,
      price: suggestion.price,
    });
    setShowTaskModal(true);
    setSuggestion(null);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !auth.currentUser || !threadId) return;

    const uid = auth.currentUser.uid;
    const msg = {
      text: inputText,
      type: "text" as const,
      senderId: uid,
      senderName: auth.currentUser.displayName || "User",
      senderPhoto: auth.currentUser.photoURL || "",
      createdAt: Timestamp.now(),
      threadId: threadId,
      seenBy: [uid],
    };

    try {
      console.log("[Chat] Sending message:", msg);
      await addDoc(collection(db, "threads", threadId, "messages"), msg);
      await updateDoc(doc(db, "threads", threadId), {
        lastMessage: inputText,
        updatedAt: Timestamp.now(),
      });
      
      // Create notification for other participant
      const otherId = thread?.participants?.find((id: string) => id !== uid);
      if (otherId) {
        await addDoc(collection(db, "users", otherId, "notifications"), {
          userId: otherId,
          title: `New message from ${auth.currentUser.displayName}`,
          message: inputText.length > 50 ? inputText.substring(0, 50) + "..." : inputText,
          type: "message",
          link: `/threads/${threadId}`,
          read: false,
          createdAt: Timestamp.now()
        });
      }

      setInputText("");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `threads/${threadId}/messages`);
      setError("Failed to send message.");
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) {
      toast.error("Please enter a milestone title.");
      return;
    }
    if (newTask.price <= 0) {
      toast.error("Please enter a valid price.");
      return;
    }
    if (!auth.currentUser || !threadId || !thread) {
      toast.error("Missing required information to create task.");
      return;
    }
    
    setIsSubmitting(true);

    const clientId = thread.clientId;
    const freelancerId = thread.freelancerId;

    if (!clientId || !freelancerId) {
      toast.error("Cannot create task because the chat is missing client or freelancer. Please create a new chat from a project.");
      setIsSubmitting(false);
      return;
    }

    const uid = auth.currentUser.uid;
    
    // Parse deadline string to Timestamp
    let deadlineTimestamp: Timestamp;
    try {
      const date = new Date(newTask.deadline);
      if (isNaN(date.getTime())) {
        deadlineTimestamp = Timestamp.fromDate(addDays(new Date(), 7));
      } else {
        deadlineTimestamp = Timestamp.fromDate(date);
      }
    } catch (e) {
      deadlineTimestamp = Timestamp.fromDate(addDays(new Date(), 7));
    }

    const taskData: Omit<Task, 'id'> = {
      title: newTask.title.trim(),
      description: newTask.description.trim() || "No description provided.",
      deadline: deadlineTimestamp,
      price: Number(newTask.price),
      status: "pending",
      threadId: threadId,
      creatorId: uid,
      clientId: clientId,
      freelancerId: freelancerId,
      createdAt: Timestamp.now(),
    };

    console.log("[handleCreateTask] Saving task data:", taskData);

    try {
      const docRef = await addDoc(collection(db, "threads", threadId, "tasks"), taskData);
      console.log("[handleCreateTask] Task created with ID:", docRef.id);
      
      // Create notification for other participant
      const otherId = thread?.participants?.find((id: string) => id !== uid);
      if (otherId) {
        try {
          await addDoc(collection(db, "users", otherId, "notifications"), {
            userId: otherId,
            title: "New Milestone Created",
            message: `A new milestone "${newTask.title}" has been added.`,
            type: "task_created",
            link: `/threads/${threadId}`,
            read: false,
            createdAt: Timestamp.now()
          });
        } catch (notifErr) {
          console.error("Failed to send notification", notifErr);
        }
      }

      toast.success("Milestone created successfully!");
      setShowTaskModal(false);
      setNewTask({ title: "", description: "", deadline: format(new Date(), "yyyy-MM-dd"), price: 0 });
    } catch (err) {
      console.error("[handleCreateTask] Error creating task:", err);
      handleFirestoreError(err, OperationType.CREATE, `threads/${threadId}/tasks`);
      toast.error("Failed to create task. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeliverWork = async (taskId: string, url: string) => {
    if (!threadId || !taskId || !url) return;

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      toast.error("Please provide a valid URL starting with http:// or https://");
      return;
    }

    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "threads", threadId, "tasks", taskId), {
        status: "delivered",
        deliveryUrl: url,
        deliveryType: "url",
        deliveryFileName: "External Link",
      });

      // Create notification for other participant
      const otherId = thread?.participants?.find((id: string) => id !== auth.currentUser?.uid);
      if (otherId) {
        await addDoc(collection(db, "users", otherId, "notifications"), {
          userId: otherId,
          title: "Work Delivered",
          message: "The freelancer has delivered work for a milestone via URL.",
          type: "delivery",
          link: `/threads/${threadId}`,
          read: false,
          createdAt: Timestamp.now(),
        });
      }

      toast.success("Work delivered successfully!");
      setShowDeliverModal(null);
      setDeliveryUrl("");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `threads/${threadId}/tasks/${taskId}`);
      setError("Failed to submit delivery.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePay = async (task: Task) => {
    if (!task.id || !threadId) return;
    setPayingTaskId(task.id);
    try {
      // Check if Demo Mode is enabled
      if (userProfile?.demoMode) {
        alert("Payment simulated (Stripe integration pending)");
        await updateDoc(doc(db, "threads", threadId, "tasks", task.id), {
          status: "paid",
          paidAt: Timestamp.now(),
        });

        // Create notification for other participant
        const otherId = thread?.participants?.find((id: string) => id !== auth.currentUser?.uid);
        if (otherId) {
          await addDoc(collection(db, "users", otherId, "notifications"), {
            userId: otherId,
            title: "Milestone Paid",
            message: `The client has paid for "${task.title}".`,
            type: "payment",
            link: `/threads/${threadId}`,
            read: false,
            createdAt: Timestamp.now()
          });
        }

        setPayingTaskId(null);
        return;
      }

      // Fetch the freelancer's stripeAccountId
      if (!task.freelancerId) {
        throw new Error("Freelancer not assigned to this task");
      }
      
      const freelancerDoc = await getDoc(doc(db, "users", task.freelancerId));
      const freelancerData = freelancerDoc.data() as UserProfile;
      
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          threadId: threadId,
          title: task.title,
          price: task.price,
          freelancerStripeAccountId: freelancerData?.stripeAccountId || null,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to create checkout session.");
      }

      const session = await response.json();
      if (session.url) {
        window.location.href = session.url;
      } else {
        throw new Error("No checkout URL returned from Stripe");
      }
    } catch (err: any) {
      console.error("Payment error", err);
      setError(err.message || "Payment failed to initialize.");
      setPayingTaskId(null);
    }
  };

  const handleCompleteWork = async (taskId: string) => {
    if (!threadId || !taskId) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "threads", threadId, "tasks", taskId), {
        status: "completed",
      });
      
      const otherId = thread?.participants?.find((id: string) => id !== auth.currentUser?.uid);
      if (otherId) {
        await addDoc(collection(db, "users", otherId, "notifications"), {
          userId: otherId,
          title: "Task Completed",
          message: "The client has approved and completed the task.",
          type: "completion",
          link: `/threads/${threadId}`,
          read: false,
          createdAt: Timestamp.now()
        });
      }
      setShowCompleteModal(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `threads/${threadId}/tasks/${taskId}`);
      setError("Failed to complete task.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!threadId || !taskId) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, "threads", threadId, "tasks", taskId));
      toast.success("Task deleted.");
      setShowDeleteTaskModal(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `threads/${threadId}/tasks/${taskId}`);
      toast.error("Failed to delete task.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAllTasks = async () => {
    if (!threadId) return;
    setIsSubmitting(true);
    try {
      for (const task of tasks) {
        await deleteDoc(doc(db, "threads", threadId, "tasks", task.id));
      }
      toast.success("All tasks deleted.");
      setShowDeleteAllTasksModal(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete all tasks.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShowParticipantProfile = async (uid: string) => {
    try {
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        setSelectedParticipant(userDoc.data() as UserProfile);
        setShowParticipantModal(true);
      }
    } catch (err) {
      console.error("Error fetching participant profile", err);
      toast.error("Failed to load profile.");
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!threadId) return;
    console.log(`[Chat] Deleting message: ${messageId}`);
    try {
      await deleteDoc(doc(db, "threads", threadId, "messages", messageId));
      toast.success("Message deleted");
    } catch (err) {
      console.error("Error deleting message", err);
      toast.error("Failed to delete message");
    }
  };

  const handleEditMessage = async () => {
    if (!threadId || !editingMessageId || !editText.trim()) return;
    console.log(`[Chat] Editing message: ${editingMessageId}`);
    try {
      await updateDoc(doc(db, "threads", threadId, "messages", editingMessageId), {
        text: editText,
        edited: true,
      });
      setEditingMessageId(null);
      setEditText("");
      toast.success("Message updated");
    } catch (err) {
      console.error("Error editing message", err);
      toast.error("Failed to update message");
    }
  };

  const combinedItems = [
    ...messages.map((m) => ({ ...m, itemType: "message" as const })),
    ...tasks.map((t) => ({ ...t, itemType: "task" as const })),
  ].sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-50 px-6 text-center">
        <div className="mb-4 text-4xl">🔍</div>
        <h2 className="mb-2 text-xl font-bold text-gray-900">{error}</h2>
        <button
          onClick={() => navigate("/threads")}
          className="mt-4 rounded-xl bg-indigo-600 px-6 py-2 font-bold text-white transition-all active:scale-95"
        >
          Back to Threads
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Header */}
      <header className="flex h-16 items-center border-b border-gray-100 bg-white/80 px-4 backdrop-blur-md">
        <button onClick={() => navigate("/threads")} className="mr-4 text-gray-400 hover:text-gray-600 transition-colors">
          <X size={24} />
        </button>
        <div 
          className="flex-1 cursor-pointer"
          onClick={() => {
            const otherId = thread?.participants?.find((id: string) => id !== auth.currentUser?.uid);
            if (otherId) handleShowParticipantProfile(otherId);
          }}
        >
          <h2 className="font-bold text-gray-900">{thread?.title || "Chat"}</h2>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">View Profile</p>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {combinedItems.map((item) => {
          if (item.itemType === "message") {
            const isMe = item.senderId === auth.currentUser?.uid;
            const otherParticipantId = thread?.participants?.find((id: string) => id !== auth.currentUser?.uid);
            const isSeenByOther = item.seenBy?.includes(otherParticipantId);

            return (
              <div key={item.id} className={clsx("flex flex-col group", isMe ? "items-end" : "items-start")}>
                <div className="flex items-center gap-2">
                  {!isMe && (
                    <img 
                      src={item.senderPhoto || `https://ui-avatars.com/api/?name=${item.senderName}&background=6366f1&color=fff`} 
                      alt={item.senderName} 
                      className="h-6 w-6 rounded-full object-cover cursor-pointer"
                      onClick={() => handleShowParticipantProfile(item.senderId)}
                    />
                  )}

                  {isMe && (
                    <div className="relative">
                      <button 
                        onClick={() => setShowMsgMenuId(showMsgMenuId === item.id ? null : item.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 transition-all"
                      >
                        <MoreVertical size={14} />
                      </button>
                      
                      {showMsgMenuId === item.id && (
                        <div className="absolute right-0 bottom-full mb-2 z-10 w-24 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl">
                          <button 
                            onClick={() => {
                              setEditingMessageId(item.id);
                              setEditText(item.text);
                              setShowEditMsgModal(true);
                              setShowMsgMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] font-bold text-gray-700 hover:bg-gray-50"
                          >
                            <Edit2 size={12} />
                            Edit
                          </button>
                          <button 
                            onClick={() => {
                              handleDeleteMessage(item.id);
                              setShowMsgMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] font-bold text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 size={12} />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div
                    className={clsx(
                      "relative max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm",
                      isMe
                        ? "chat-bubble-right bg-indigo-600 text-white"
                        : "chat-bubble-left bg-gray-100 text-gray-900"
                    )}
                  >
                    {item.type === "voice" || item.voiceUrl ? (
                      <div className="flex flex-col gap-1 py-1">
                        <div className="flex items-center gap-2">
                          <audio src={item.fileUrl || item.voiceUrl} controls className="h-8 max-w-[200px]" />
                        </div>
                        {item.duration && (
                          <span className={clsx("text-[10px]", isMe ? "text-white/60" : "text-gray-500")}>
                            {Math.floor(item.duration / 60)}:
                            {Math.floor(item.duration % 60)
                              .toString()
                              .padStart(2, "0")}
                          </span>
                        )}
                      </div>
                    ) : item.type === "file" || item.fileUrl ? (
                      <a
                        href={item.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 hover:underline"
                      >
                        <FileText size={16} />
                        <span className="truncate max-w-[150px]">{item.fileName || "Attachment"}</span>
                      </a>
                    ) : (
                      <div className="flex flex-col">
                        <span>{item.text}</span>
                        {item.edited && (
                          <span className={clsx("text-[9px] mt-0.5 opacity-60 italic", isMe ? "text-right" : "text-left")}>
                            edited
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-1 flex items-center gap-1.5 px-1">
                  <span className="text-[9px] text-gray-400">
                    {format(item.createdAt.toDate(), "HH:mm")}
                  </span>
                  {isMe && (
                    <div className="text-indigo-400">
                      {isSeenByOther ? <CheckCheck size={12} /> : <Check size={12} />}
                    </div>
                  )}
                </div>
                
                {/* AI Suggestion Chip */}
                {suggestion?.messageId === item.id && userProfile?.role === "client" && (
                  <motion.button
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={handleApplySuggestion}
                    className="mt-2 flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1.5 text-[10px] font-bold text-indigo-600 shadow-sm hover:bg-indigo-100 transition-all"
                  >
                    <Sparkles size={12} />
                    Create task from this message?
                  </motion.button>
                )}

                {analyzingMessageId === item.id && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400 italic">
                    <Loader2 size={10} className="animate-spin" />
                    Analyzing request...
                  </div>
                )}
              </div>
            );
          } else {
            return (
              <motion.div
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={item.id}
                className="mx-auto w-full max-w-xs rounded-2xl border border-gray-100 bg-white p-4 shadow-lg relative"
              >
                {item.creatorId === auth.currentUser?.uid && (
                  <button
                    onClick={() => setShowDeleteTaskModal(item.id)}
                    className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <div className="mb-3 flex items-center gap-2">
                  <span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                    Task
                  </span>
                  <span className={clsx(
                    "text-[10px] font-bold uppercase",
                    item.status === "paid" ? "text-emerald-500" : 
                    item.status === "delivered" ? "text-blue-500" :
                    item.status === "completed" ? "text-purple-500" : "text-amber-500"
                  )}>
                    {item.status}
                  </span>
                </div>
                <h3 className="mb-1 font-bold text-gray-900">{item.title}</h3>
                <p className="mb-4 text-xs text-gray-500">{item.description}</p>
                <div className="mb-4 flex items-center justify-between text-xs font-medium text-gray-400">
                  <div className="flex items-center gap-1">
                    <Calendar size={14} />
                    {item.deadline instanceof Timestamp 
                      ? format(item.deadline.toDate(), "MMM d, yyyy") 
                      : item.deadline}
                  </div>
                  <div className="flex items-center gap-1 text-gray-900">
                    <DollarSign size={14} />
                    {item.price}
                  </div>
                </div>

                {userProfile?.role === "client" && item.status === "pending" && (
                  <button
                    onClick={() => handlePay(item as Task)}
                    disabled={payingTaskId === item.id}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2 text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-50"
                  >
                    {payingTaskId === item.id ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      "Pay"
                    )}
                  </button>
                )}

                {userProfile?.role === "freelancer" && item.status === "paid" && (
                  <button
                    onClick={() => setShowDeliverModal(item.id)}
                    className="w-full rounded-xl bg-emerald-600 py-2 text-sm font-bold text-white transition-all active:scale-95"
                  >
                    Send
                  </button>
                )}

                {userProfile?.role === "client" && item.status === "delivered" && (
                  <button
                    onClick={() => setShowCompleteModal(item.id)}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2 text-sm font-bold text-white transition-all active:scale-95"
                  >
                    Approve Completion
                  </button>
                )}

                {item.status === "delivered" && userProfile?.role === "freelancer" && (
                  <div className="mt-4 flex flex-col items-center justify-center gap-1 rounded-xl bg-gray-50 py-2 px-4 text-sm font-bold text-gray-900">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-blue-500" />
                      Delivered
                      {item.deliveryUrl && (
                        <a href={item.deliveryUrl} target="_blank" rel="noreferrer" className="text-indigo-600">
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                    {item.deliveryFileName && (
                      <span className="text-[10px] text-gray-400 font-normal truncate max-w-full">
                        {item.deliveryFileName}
                      </span>
                    )}
                  </div>
                )}
                
                {item.status === "completed" && (
                  <div className="mt-4 flex flex-col items-center justify-center gap-1 rounded-xl bg-purple-50 py-2 px-4 text-sm font-bold text-purple-700">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-purple-500" />
                      Completed
                      {item.deliveryUrl && (
                        <a href={item.deliveryUrl} target="_blank" rel="noreferrer" className="text-indigo-600">
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                    {item.deliveryFileName && (
                      <span className="text-[10px] text-purple-400 font-normal truncate max-w-full">
                        {item.deliveryFileName}
                      </span>
                    )}
                  </div>
                )}
              </motion.div>
            );
          }
        })}
        <div ref={scrollRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-100 p-4 bg-white">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTaskModal(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-all active:scale-90"
          >
            <Plus size={20} />
          </button>
          
          <form onSubmit={handleSendMessage} className="flex flex-1 items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={userProfile?.role === "client" ? "Add Milestone or message..." : "Type a message..."}
                className="flex-1 rounded-full bg-gray-100 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            <button
              type="submit"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white transition-all active:scale-90 disabled:opacity-50"
              disabled={!inputText.trim()}
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>

      {/* Participant Profile Modal */}
      <AnimatePresence>
        {showParticipantModal && selectedParticipant && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-sm overflow-hidden rounded-[32px] bg-white shadow-2xl"
            >
              <div className="relative h-24 bg-indigo-600">
                <button 
                  onClick={() => setShowParticipantModal(false)}
                  className="absolute right-4 top-4 rounded-full bg-black/20 p-1.5 text-white backdrop-blur-md hover:bg-black/40 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="relative -mt-12 flex flex-col items-center px-8 pb-8 text-center">
                <img
                  src={selectedParticipant.photoURL || `https://ui-avatars.com/api/?name=${selectedParticipant.displayName}&background=6366f1&color=fff`}
                  alt={selectedParticipant.displayName}
                  className="mb-4 h-24 w-24 rounded-[32px] border-4 border-white object-cover shadow-xl"
                />
                <h3 className="text-xl font-bold text-gray-900">{selectedParticipant.displayName}</h3>
                <span className="mb-4 rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                  {selectedParticipant.role}
                </span>

                {selectedParticipant.role === "freelancer" ? (
                  <div className="w-full space-y-4">
                    {selectedParticipant.location && (
                      <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500">
                        <MapPin size={14} className="text-gray-400" />
                        {selectedParticipant.location}
                      </div>
                    )}
                    
                    {selectedParticipant.bio && (
                      <p className="text-sm text-gray-600 line-clamp-3">{selectedParticipant.bio}</p>
                    )}

                    {selectedParticipant.skills && selectedParticipant.skills.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-1.5">
                        {selectedParticipant.skills.map(skill => (
                          <span key={skill} className="rounded-lg bg-gray-50 px-2 py-1 text-[10px] font-bold text-gray-500 ring-1 ring-gray-100">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}

                    {selectedParticipant.portfolioUrl && (
                      <a 
                        href={selectedParticipant.portfolioUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 rounded-2xl bg-gray-100 py-3 text-sm font-bold text-gray-700 transition-all active:scale-95"
                      >
                        <Globe size={18} />
                        View Portfolio
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Project Client</p>
                )}
                
                <button
                  onClick={() => setShowParticipantModal(false)}
                  className="mt-6 w-full rounded-2xl bg-indigo-600 py-4 font-bold text-white shadow-lg shadow-indigo-100 transition-all active:scale-95"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Task Modal */}
      <AnimatePresence>
        {showTaskModal && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Add Milestone</h3>
                <button onClick={() => setShowTaskModal(false)} className="text-gray-400">
                  <X size={24} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-400">Milestone Title</label>
                  <input
                    type="text"
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    className="w-full rounded-xl bg-gray-50 px-4 py-3 text-sm outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-500"
                    placeholder="E.g. Logo Design"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-400">Description</label>
                  <textarea
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    className="w-full rounded-xl bg-gray-50 px-4 py-3 text-sm outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-500"
                    placeholder="Details about the work..."
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-400">Deadline</label>
                    <input
                      type="date"
                      value={newTask.deadline}
                      onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                      className="w-full rounded-xl bg-gray-50 px-4 py-3 text-sm outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-400">Price ($)</label>
                    <input
                      type="number"
                      value={newTask.price}
                      onChange={(e) => setNewTask({ ...newTask, price: Number(e.target.value) })}
                      className="w-full rounded-xl bg-gray-50 px-4 py-3 text-sm outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <button
                  onClick={handleCreateTask}
                  disabled={isSubmitting || !newTask.title.trim()}
                  className="mt-4 flex w-full items-center justify-center rounded-2xl bg-indigo-600 py-4 font-bold text-white shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" /> : "Add Milestone"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delivery Modal */}
      <AnimatePresence>
        {showDeliverModal && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Deliver Work</h3>
                <button onClick={() => setShowDeliverModal(null)} className="text-gray-400">
                  <X size={24} />
                </button>
              </div>
              <p className="mb-4 text-sm text-gray-500">
                Provide a link to your completed work. The client will be notified.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-400">Delivery URL</label>
                  <input
                    type="url"
                    value={deliveryUrl}
                    onChange={(e) => setDeliveryUrl(e.target.value)}
                    placeholder="https://example.com/your-work"
                    className="w-full rounded-xl bg-gray-50 px-4 py-3 text-sm outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  onClick={() => handleDeliverWork(showDeliverModal, deliveryUrl)}
                  disabled={isSubmitting || !deliveryUrl.trim()}
                  className="flex w-full items-center justify-center rounded-2xl bg-indigo-600 py-4 font-bold text-white shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" /> : "Submit Delivery"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Complete Modal */}
      <AnimatePresence>
        {showCompleteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl text-center"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="mb-2 text-xl font-bold text-gray-900">Approve Completion?</h3>
              <p className="mb-6 text-sm text-gray-500">
                Approve and mark task as completed? This will notify the freelancer.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCompleteModal(null)}
                  className="flex-1 rounded-xl bg-gray-100 py-3 font-bold text-gray-600 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleCompleteWork(showCompleteModal)}
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center rounded-xl bg-indigo-600 py-3 font-bold text-white transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : "Approve"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Task Modal */}
      <AnimatePresence>
        {showDeleteTaskModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl text-center"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Trash2 size={24} />
              </div>
              <h3 className="mb-2 text-xl font-bold text-gray-900">Delete Task?</h3>
              <p className="mb-6 text-sm text-gray-500">
                Are you sure you want to delete this task? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteTaskModal(null)}
                  className="flex-1 rounded-xl bg-gray-100 py-3 font-bold text-gray-600 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteTask(showDeleteTaskModal)}
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center rounded-xl bg-red-600 py-3 font-bold text-white transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : "Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Message Modal */}
      <AnimatePresence>
        {showEditMsgModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
            >
              <h3 className="mb-4 text-lg font-bold text-gray-900">Edit Message</h3>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="mb-6 w-full rounded-xl bg-gray-50 px-4 py-3 text-sm outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-500"
                rows={3}
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowEditMsgModal(false);
                    setEditingMessageId(null);
                  }}
                  className="flex-1 rounded-xl bg-gray-100 py-3 font-bold text-gray-600 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleEditMessage();
                    setShowEditMsgModal(false);
                  }}
                  className="flex-1 rounded-xl bg-indigo-600 py-3 font-bold text-white transition-all active:scale-95"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete All Tasks Modal */}
      <AnimatePresence>
        {showDeleteAllTasksModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl text-center"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Trash2 size={24} />
              </div>
              <h3 className="mb-2 text-xl font-bold text-gray-900">Delete All Tasks?</h3>
              <p className="mb-6 text-sm text-gray-500">
                Are you sure you want to delete all tasks in this chat? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteAllTasksModal(false)}
                  className="flex-1 rounded-xl bg-gray-100 py-3 font-bold text-gray-600 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAllTasks}
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center rounded-xl bg-red-600 py-3 font-bold text-white transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : "Delete All"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
