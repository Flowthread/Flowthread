import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import { db, auth, handleFirestoreError, OperationType } from "../firebase";
import { doc, updateDoc, addDoc, collection, Timestamp, getDoc } from "firebase/firestore";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { motion } from "motion/react";

export default function Success() {
  const { threadId } = useParams<{ threadId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sessionId = searchParams.get("session_id");
  const taskId = searchParams.get("taskId");

  useEffect(() => {
    const updateTaskStatus = async () => {
      if (!taskId || !threadId || !auth.currentUser) {
        setLoading(false);
        return;
      }

      try {
        const uid = auth.currentUser.uid;
        // 1. Update task status
        const taskRef = doc(db, "threads", threadId, "tasks", taskId);
        const taskSnap = await getDoc(taskRef);
        
        if (!taskSnap.exists()) {
          setError("Task not found. The payment might have been processed, but we couldn't find the associated task record.");
          setLoading(false);
          return;
        }

        const taskData = taskSnap.data();
        if (taskData.status === "paid") {
          setLoading(false);
          return; // Already paid
        }

        await updateDoc(taskRef, {
          status: "paid",
          paidAt: Timestamp.now(),
        });

        // 2. Add transaction record
        await addDoc(collection(db, "transactions"), {
          taskId,
          threadId,
          amount: taskData.price,
          fee: taskData.price * 0.025,
          status: "completed",
          fromId: uid,
          toId: taskData.freelancerId || null,
          createdAt: Timestamp.now(),
        });

        // 3. Send notification (system message)
        await addDoc(collection(db, "threads", threadId, "messages"), {
          text: `Payment of $${taskData.price} received for task: ${taskData.title}`,
          senderId: "system",
          senderName: "System",
          senderPhoto: "",
          createdAt: Timestamp.now(),
        });

        // 4. Update thread last message
        await updateDoc(doc(db, "threads", threadId), {
          lastMessage: `Payment received: $${taskData.price}`,
          updatedAt: Timestamp.now(),
        });

        setLoading(false);
      } catch (err) {
        console.error("Error updating task status", err);
        handleFirestoreError(err, OperationType.UPDATE, `threads/${threadId}/tasks/${taskId}`);
        setError("Failed to update payment status. Your payment was successful, but we encountered an error updating the task. Please contact support with your session ID.");
        setLoading(false);
      }
    };

    updateTaskStatus();
  }, [taskId, threadId, sessionId]);

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
        <p className="mt-4 font-medium text-gray-600">Verifying payment...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-50 px-6 text-center">
        <div className="mb-4 text-4xl">❌</div>
        <h2 className="mb-2 text-xl font-bold text-gray-900">Payment Error</h2>
        <p className="text-gray-500">{error}</p>
        <button
          onClick={() => navigate("/threads")}
          className="mt-6 rounded-xl bg-indigo-600 px-6 py-2 font-bold text-white shadow-lg shadow-indigo-200"
        >
          Back to Chats
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-gray-50 px-6 text-center">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-xl shadow-emerald-100"
      >
        <CheckCircle2 size={48} />
      </motion.div>
      <h1 className="mb-2 text-3xl font-bold text-gray-900">Payment Successful!</h1>
      <p className="mb-8 max-w-xs text-gray-500">
        The milestone has been marked as paid. The freelancer can now send the work.
      </p>
      <button
        onClick={() => navigate(`/threads/${threadId}`)}
        className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-8 py-4 font-bold text-white shadow-xl shadow-indigo-200 transition-all active:scale-95"
      >
        Back to Chat
        <ArrowRight size={20} />
      </button>
    </div>
  );
}
