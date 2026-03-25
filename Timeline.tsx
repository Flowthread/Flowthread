import React, { useState, useEffect } from "react";
import { db, auth, handleFirestoreError, OperationType } from "../firebase";
import {
  collection,
  collectionGroup,
  query,
  orderBy,
  onSnapshot,
  limit,
  addDoc,
  Timestamp,
  where,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { TimelineItem as TimelineItemType, UserProfile, WorkPost } from "../types";
import { formatDistanceToNow, format } from "date-fns";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Briefcase, Activity, X, DollarSign, Calendar, Tag, Loader2, CheckCircle2, ArrowRight, Search, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { clsx } from "clsx";
import { toast } from "sonner";

export default function Timeline() {
  const [activeTab, setActiveTab] = useState<"work" | "activity">("work");
  const [activityItems, setActivityItems] = useState<TimelineItemType[]>([]);
  const [workPosts, setWorkPosts] = useState<WorkPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showWorkModal, setShowWorkModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hiringWorkId, setHiringWorkId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const POPULAR_SKILLS = [
    "Web Development", "Mobile Apps", "UI/UX Design", "Graphic Design", 
    "Content Writing", "Digital Marketing", "SEO", "Data Science", 
    "Machine Learning", "Video Editing", "3D Modeling", "Translation",
    "Virtual Assistant", "Customer Support", "Sales", "Legal Consulting"
  ];

  const filteredWorkPosts = workPosts.filter(post => 
    post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const [newWork, setNewWork] = useState({
    title: "",
    description: "",
    budget: 0,
    category: "",
    deadline: format(new Date(), "yyyy-MM-dd"),
  });

  const categories = POPULAR_SKILLS;

  useEffect(() => {
    const fetchProfile = async () => {
      if (!auth.currentUser) return;
      try {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (userDoc.exists()) {
          setUserProfile(userDoc.data() as UserProfile);
        }
      } catch (err) {
        console.error("Error fetching profile", err);
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    setLoading(true);
    let unsubscribe: () => void;

    if (activeTab === "activity") {
      if (!auth.currentUser || !userProfile) {
        setLoading(false);
        return;
      }

      const roleField = userProfile.role === "client" ? "clientId" : "freelancerId";
      const q = query(
        collectionGroup(db, "tasks"),
        where(roleField, "==", auth.currentUser.uid),
        orderBy("createdAt", "desc"),
        limit(20)
      );
      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const timelineItems: TimelineItemType[] = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              type: data.status === "delivered" ? "milestone_sent" : "milestone_created",
              title: data.title,
              subtitle: data.status === "delivered" ? "Project sent" : "New milestone created",
              projectName: "Project",
              userAvatar: "https://picsum.photos/seed/user/100/100",
              createdAt: data.createdAt,
              data: data,
            };
          });
          setActivityItems(timelineItems);
          setLoading(false);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, "all_tasks");
          setLoading(false);
        }
      );
    } else {
      const q = query(
        collection(db, "workPosts"),
        where("status", "==", "open"),
        orderBy("createdAt", "desc"),
        limit(20)
      );
      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          setWorkPosts(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as WorkPost)));
          setLoading(false);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, "workPosts");
          setLoading(false);
        }
      );
    }

    return () => unsubscribe && unsubscribe();
  }, [activeTab]);

  const handleCreateWork = async () => {
    if (!newWork.title || !newWork.budget || !newWork.category || !auth.currentUser || !userProfile) {
      toast.error("Please fill in all required fields");
      return;
    }
    setIsSubmitting(true);

    try {
      console.log("[Timeline] Creating work post:", newWork);
      await addDoc(collection(db, "workPosts"), {
        ...newWork,
        budget: Number(newWork.budget),
        clientId: auth.currentUser.uid,
        clientName: userProfile.displayName,
        clientAvatar: userProfile.photoURL,
        status: "open",
        createdAt: Timestamp.now(),
      });
      toast.success("Project posted!");
      setShowWorkModal(false);
      setNewWork({
        title: "",
        description: "",
        budget: 0,
        category: "",
        deadline: format(new Date(), "yyyy-MM-dd"),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "workPosts");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWork = async (postId: string) => {
    if (!window.confirm("Are you sure you want to remove this project permanently?")) return;
    console.log(`[Timeline] Deleting work post: ${postId}`);
    try {
      await deleteDoc(doc(db, "workPosts", postId));
      toast.success("Project removed");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `workPosts/${postId}`);
    }
  };

  const handleStartWork = async (work: WorkPost) => {
    if (!auth.currentUser || !userProfile || userProfile.role !== "freelancer") return;
    setHiringWorkId(work.id);

    try {
      // Create a new thread
      if (!work.clientId || !auth.currentUser.uid) {
        throw new Error("Thread requires one client and one freelancer");
      }
      const threadRef = await addDoc(collection(db, "threads"), {
        title: work.title,
        participants: [work.clientId, auth.currentUser.uid],
        clientId: work.clientId,
        freelancerId: auth.currentUser.uid,
        workPostId: work.id,
        updatedAt: Timestamp.now(),
        lastMessage: `Project accepted: ${work.title} with budget $${work.budget}`,
      });

      // Add system message
      await addDoc(collection(db, "threads", threadRef.id, "messages"), {
        text: `Project accepted: ${work.title} with budget $${work.budget}`,
        senderId: "system",
        senderName: "System",
        senderPhoto: "",
        createdAt: Timestamp.now(),
      });

      // Navigate to ChatRoom
      navigate(`/threads/${threadRef.id}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `threads`);
    } finally {
      setHiringWorkId(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Tabs Header */}
      <div className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 px-4 pt-6 backdrop-blur-md">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Feed</h1>
            <p className="text-sm text-slate-500">Discover projects and track activity</p>
          </div>
          {userProfile?.role === "client" && (
            <button
              onClick={() => setShowWorkModal(true)}
              className="flex h-12 items-center gap-2 rounded-2xl bg-indigo-600 px-6 font-bold text-white shadow-lg shadow-indigo-200 transition-all active:scale-95"
            >
              <Plus size={20} />
              Post a Project
            </button>
          )}
        </div>

        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab("work")}
            className={clsx(
              "flex items-center gap-2 border-b-2 pb-4 text-sm font-bold transition-all",
              activeTab === "work"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-400 hover:text-slate-600"
            )}
          >
            <Briefcase size={18} />
            Projects
          </button>
          <button
            onClick={() => setActiveTab("activity")}
            className={clsx(
              "flex items-center gap-2 border-b-2 pb-4 text-sm font-bold transition-all",
              activeTab === "activity"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-400 hover:text-slate-600"
            )}
          >
            <Activity size={18} />
            Activity
          </button>
        </div>

        {activeTab === "work" && (
          <div className="mt-4 pb-4">
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl bg-slate-100 py-3 pl-12 pr-4 text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 text-slate-900"
              />
            </div>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 p-4">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : activeTab === "work" ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2">
            {filteredWorkPosts.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
                <span className="mb-4 text-5xl">💼</span>
                <h3 className="mb-1 text-lg font-bold text-slate-900">
                  {searchQuery ? "No matches found" : "No projects yet"}
                </h3>
                <p className="max-w-[200px] text-sm text-slate-500">
                  {searchQuery ? "Try a different search term." : "No projects yet. Post your first project to get offers."}
                </p>
              </div>
            ) : (
              filteredWorkPosts.map((work) => (
                <motion.div
                  key={work.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="overflow-hidden rounded-[32px] bg-white p-6 shadow-xl shadow-slate-200/50 ring-1 ring-slate-100"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={work.clientAvatar || "https://picsum.photos/seed/client/100/100"}
                        alt={work.clientName}
                        className="h-10 w-10 rounded-2xl object-cover"
                      />
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{work.clientName}</h4>
                        <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">
                          {formatDistanceToNow(work.createdAt.toDate())} ago
                        </p>
                      </div>
                    </div>
                    <div className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                      {work.category}
                    </div>
                  </div>

                  <h2 className="mb-2 text-xl font-bold text-slate-900">{work.title}</h2>
                  <p className="mb-6 line-clamp-3 text-sm text-slate-500">{work.description}</p>

                  <div className="mb-6 flex items-center gap-6">
                    <div className="flex items-center gap-2 text-slate-900">
                      <DollarSign size={18} className="text-indigo-600" />
                      <span className="text-xl font-black">${work.budget}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <Calendar size={16} />
                      <span className="text-xs font-medium">{work.deadline}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    {userProfile?.role === "freelancer" && (
                      <button
                        onClick={() => handleStartWork(work)}
                        disabled={hiringWorkId === work.id}
                        className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 font-bold text-white shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] disabled:opacity-50"
                      >
                        {hiringWorkId === work.id ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <>
                            Accept
                            <ArrowRight size={18} />
                          </>
                        )}
                      </button>
                    )}
                    {work.clientId === auth.currentUser?.uid && (
                      <button
                        onClick={() => handleDeleteWork(work.id)}
                        className="flex items-center justify-center gap-2 rounded-2xl bg-rose-50 px-6 py-4 font-bold text-rose-600 transition-all hover:bg-rose-100 active:scale-95"
                      >
                        <Trash2 size={18} />
                        Remove
                      </button>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        ) : (
          <div className="timeline-container no-scrollbar">
            {activityItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <span className="mb-4 text-5xl">🎬</span>
                <h3 className="mb-1 text-lg font-bold text-slate-900">No activity yet</h3>
                <p className="max-w-[200px] text-sm text-slate-500">Activity from your chats will appear here.</p>
              </div>
            ) : (
              activityItems.map((item) => (
                <div key={item.id} className="timeline-item">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="relative flex h-full flex-col overflow-hidden rounded-[40px] bg-white shadow-2xl shadow-indigo-100 ring-1 ring-slate-100"
                  >
                    <div className="absolute inset-0 -z-10 opacity-5">
                      <div className="h-full w-full bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:20px_20px]"></div>
                    </div>

                    <div className="flex flex-1 flex-col p-8">
                      <div className="mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img src={item.userAvatar} alt="User" className="h-10 w-10 rounded-2xl object-cover" />
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">{item.projectName}</h4>
                            <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">
                              {formatDistanceToNow(item.createdAt.toDate())} ago
                            </p>
                          </div>
                        </div>
                        <div className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                          {item.type.replace("_", " ")}
                        </div>
                      </div>

                      <div className="flex flex-1 flex-col justify-center text-center">
                        <h2 className="mb-4 text-2xl font-bold tracking-tight text-slate-900">{item.title}</h2>
                        <p className="text-sm text-slate-500">{item.subtitle}</p>
                        {item.data?.price && (
                          <div className="mt-8 text-4xl font-black text-indigo-600">
                            ${item.data.price}
                          </div>
                        )}
                      </div>

                      <div className="mt-auto flex items-center justify-center gap-4">
                        <div className="h-1 w-12 rounded-full bg-slate-100"></div>
                        <div className="h-1 w-12 rounded-full bg-indigo-600"></div>
                        <div className="h-1 w-12 rounded-full bg-slate-100"></div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Post Work Modal */}
      <AnimatePresence>
        {showWorkModal && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="w-full max-w-md rounded-[40px] bg-white p-8 shadow-2xl"
            >
              <div className="mb-8 flex items-center justify-between">
                <h3 className="text-2xl font-black tracking-tight text-slate-900">Post a Project</h3>
                <button onClick={() => setShowWorkModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={28} />
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">Project Title</label>
                  <input
                    type="text"
                    value={newWork.title}
                    onChange={(e) => setNewWork({ ...newWork, title: e.target.value })}
                    className="w-full rounded-2xl bg-slate-50 px-5 py-4 text-sm font-medium outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 text-slate-900"
                    placeholder="e.g. Mobile App UI Design"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">Description</label>
                  <textarea
                    value={newWork.description}
                    onChange={(e) => setNewWork({ ...newWork, description: e.target.value })}
                    className="w-full rounded-2xl bg-slate-50 px-5 py-4 text-sm font-medium outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 text-slate-900"
                    placeholder="Describe the project goals and requirements..."
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">Budget ($)</label>
                    <div className="relative">
                      <DollarSign size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="number"
                        value={newWork.budget}
                        onChange={(e) => setNewWork({ ...newWork, budget: Number(e.target.value) })}
                        className="w-full rounded-2xl bg-slate-50 py-4 pl-10 pr-5 text-sm font-medium outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 text-slate-900"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">Deadline</label>
                    <input
                      type="date"
                      value={newWork.deadline}
                      onChange={(e) => setNewWork({ ...newWork, deadline: e.target.value })}
                      className="w-full rounded-2xl bg-slate-50 px-5 py-4 text-sm font-medium outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">Category</label>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto no-scrollbar p-1">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setNewWork({ ...newWork, category: cat })}
                        className={clsx(
                          "rounded-xl px-4 py-2 text-xs font-bold transition-all",
                          newWork.category === cat
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleCreateWork}
                  disabled={isSubmitting || !newWork.title}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-[24px] bg-indigo-600 py-5 font-bold text-white shadow-xl shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" /> : "Post"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
