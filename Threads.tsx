import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth, handleFirestoreError, OperationType } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, onSnapshot, orderBy, addDoc, Timestamp, getDocs, doc, getDoc, deleteDoc } from "firebase/firestore";
import { Thread, UserProfile } from "../types";
import { Plus, Search, MessageSquare, ShieldCheck, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Threads() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [freelancerEmail, setFreelancerEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [verifyingChatId, setVerifyingChatId] = useState<string | null>(null);
  const [participantRoles, setParticipantRoles] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showMenuId, setShowMenuId] = useState<string | null>(null);
  const navigate = useNavigate();

  const filteredThreads = threads.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteThread = async (threadId: string) => {
    setDeletingId(threadId);
    try {
      // In a real app, we'd delete subcollections too. 
      // For this demo, we'll delete the main thread doc.
      await deleteDoc(doc(db, "threads", threadId));
      setShowDeleteConfirm(null);
      setShowMenuId(null);
    } catch (err) {
      console.error("Error deleting thread", err);
      alert("Failed to delete chat.");
    } finally {
      setDeletingId(null);
    }
  };
  const handleVerify = async (e: React.MouseEvent, thread: Thread) => {
    e.stopPropagation();
    if (verifyingChatId === thread.id) {
      setVerifyingChatId(null);
      return;
    }

    setVerifyingChatId(thread.id);
    const roles: Record<string, string> = {};
    for (const uid of thread.participants) {
      try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
          roles[uid] = (userDoc.data() as UserProfile).role;
        } else {
          roles[uid] = "unknown";
        }
      } catch (err) {
        roles[uid] = "error";
      }
    }
    setParticipantRoles(prev => ({ ...prev, ...roles }));
  };

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setThreads([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const q = query(
        collection(db, "threads"),
        where("participants", "array-contains", user.uid),
        orderBy("updatedAt", "desc")
      );

      unsubscribeSnapshot = onSnapshot(
        q,
        (snapshot) => {
          setThreads(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Thread)));
          setLoading(false);
        },
        (err) => {
          if (auth.currentUser) {
            handleFirestoreError(err, OperationType.LIST, "threads");
          }
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeSnapshot?.();
    };
  }, []);

  const handleCreateChat = async () => {
    if (!newChatTitle.trim() || !clientEmail.trim() || !freelancerEmail.trim() || !auth.currentUser) return;
    setCreating(true);
    setError(null);

    try {
      // 1. Find Client
      const clientQuery = query(collection(db, "users"), where("email", "==", clientEmail.trim()));
      const clientSnapshot = await getDocs(clientQuery);
      if (clientSnapshot.empty) throw new Error("Client not found with that email.");
      const clientData = clientSnapshot.docs[0].data() as UserProfile;
      if (clientData.role !== "client") throw new Error("User found is not a client.");

      // 2. Find Freelancer
      const freelancerQuery = query(collection(db, "users"), where("email", "==", freelancerEmail.trim()));
      const freelancerSnapshot = await getDocs(freelancerQuery);
      if (freelancerSnapshot.empty) throw new Error("Freelancer not found with that email.");
      const freelancerData = freelancerSnapshot.docs[0].data() as UserProfile;
      if (freelancerData.role !== "freelancer") throw new Error("User found is not a freelancer.");

      const participantUids = [clientData.uid, freelancerData.uid];
      
      const docRef = await addDoc(collection(db, "threads"), {
        title: newChatTitle,
        participants: participantUids,
        clientId: clientData.uid,
        freelancerId: freelancerData.uid,
        updatedAt: Timestamp.now(),
        lastMessage: "Chat created",
      });

      setShowNewChat(false);
      setNewChatTitle("");
      setClientEmail("");
      setFreelancerEmail("");
      navigate(`/threads/${docRef.id}`);
    } catch (err: any) {
      console.error("Error creating chat", err);
      setError(err.message || "Failed to create chat.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="px-4 py-6">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Chats</h1>
          <p className="text-sm text-slate-500">Your project chats</p>
        </div>
        <button
          onClick={() => setShowNewChat(true)}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 transition-all active:scale-90"
        >
          <Plus size={24} />
        </button>
      </header>

      <div className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <Search size={18} />
          </div>
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl bg-white py-3 pl-12 pr-4 text-sm shadow-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 text-slate-900"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
        </div>
      ) : filteredThreads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="mb-4 text-5xl">📭</span>
          <h3 className="mb-1 text-lg font-bold text-slate-900">
            {searchQuery ? "No matches found" : "No chats yet"}
          </h3>
          <p className="max-w-[200px] text-sm text-slate-500">
            {searchQuery ? "Try a different search term." : "No chats yet. Accept a project from the feed to start."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-2">
          {filteredThreads.map((thread) => (
            <div key={thread.id} className="group relative overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100 transition-all hover:ring-indigo-500">
              <button
                onClick={() => navigate(`/threads/${thread.id}`)}
                className="flex w-full items-center gap-4 p-4 text-left active:scale-[0.98]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <MessageSquare size={24} />
                </div>
                <div className="flex-1 pr-8">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 line-clamp-1">{thread.title}</h3>
                    <span className="text-[10px] font-medium text-slate-400">
                      {formatDistanceToNow(thread.updatedAt.toDate())} ago
                    </span>
                  </div>
                  <p className="line-clamp-1 text-xs text-slate-500">{thread.lastMessage || "No messages yet"}</p>
                </div>
              </button>

              {/* Three-dot Menu */}
              <div className="absolute right-2 top-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenuId(showMenuId === thread.id ? null : thread.id);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                >
                  <Plus size={18} className="rotate-45" /> {/* Using Plus rotated as X/Menu icon for simplicity or just import MoreVertical */}
                </button>

                {showMenuId === thread.id && (
                  <div className="absolute right-0 z-10 mt-1 w-32 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-xl">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(thread.id);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs font-bold text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 size={14} />
                      Delete Chat
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={(e) => handleVerify(e, thread)}
                className="absolute bottom-4 right-4 flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-600"
              >
                <ShieldCheck size={12} />
                Verify
                {verifyingChatId === thread.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>

              {verifyingChatId === thread.id && (
                <div className="border-t border-slate-50 bg-slate-50/50 p-4 text-[10px] font-mono text-slate-500">
                  <div className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-1">
                    <span className="font-bold uppercase tracking-tighter text-slate-400">Chat ID:</span>
                    <span className="truncate">{thread.id}</span>
                    
                    <span className="font-bold uppercase tracking-tighter text-slate-400">Client ID:</span>
                    <span className="truncate">{thread.clientId || "NOT SET"}</span>
                    
                    <span className="font-bold uppercase tracking-tighter text-slate-400">Freelancer:</span>
                    <span className="truncate">{thread.freelancerId || "NOT SET"}</span>
                    
                    <span className="col-span-2 mt-1 font-bold uppercase tracking-tighter text-slate-400">Participants:</span>
                    {thread.participants.map(uid => (
                      <React.Fragment key={uid}>
                        <span className="pl-2 font-bold text-indigo-400">{participantRoles[uid] || "loading..."}:</span>
                        <span className="truncate">{uid}</span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="mb-2 text-lg font-bold text-slate-900">Delete Chat?</h3>
            <p className="mb-6 text-sm text-slate-500">
              This will permanently remove this chat. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 rounded-xl bg-slate-100 py-3 font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteThread(showDeleteConfirm)}
                disabled={!!deletingId}
                className="flex-1 rounded-xl bg-rose-600 py-3 font-bold text-white shadow-lg shadow-rose-200 disabled:opacity-50"
              >
                {deletingId ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Chat Modal */}
      {showNewChat && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-xl font-bold text-slate-900">New Project Chat</h3>
            
            {error && (
              <div className="mb-4 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-600 border border-red-100">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Title</label>
                <input
                  type="text"
                  value={newChatTitle}
                  onChange={(e) => setNewChatTitle(e.target.value)}
                  placeholder="Project Name"
                  className="w-full rounded-xl bg-slate-50 px-4 py-3 text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Client Email</label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="client@example.com"
                  className="w-full rounded-xl bg-slate-50 px-4 py-3 text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Freelancer Email</label>
                <input
                  type="email"
                  value={freelancerEmail}
                  onChange={(e) => setFreelancerEmail(e.target.value)}
                  placeholder="freelancer@example.com"
                  className="w-full rounded-xl bg-slate-50 px-4 py-3 text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowNewChat(false);
                  setError(null);
                }}
                disabled={creating}
                className="flex-1 rounded-xl bg-slate-100 py-3 font-bold text-slate-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateChat}
                disabled={creating || !newChatTitle.trim() || !clientEmail.trim() || !freelancerEmail.trim()}
                className="flex flex-1 items-center justify-center rounded-xl bg-indigo-600 py-3 font-bold text-white shadow-lg shadow-indigo-200 disabled:opacity-50"
              >
                {creating ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                ) : (
                  "Create"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
