import React, { useState } from "react";
import { Send, Star, Loader2, MessageSquare, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { db, auth } from "../firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { toast } from "sonner";
import { clsx } from "clsx";

export default function Feedback() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || rating === 0 || !auth.currentUser) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, "feedback"), {
        userId: auth.currentUser.uid,
        title: title.trim(),
        description: description.trim(),
        rating,
        createdAt: Timestamp.now(),
        status: "unread",
      });

      toast.success("Feedback submitted successfully!");
      setSubmitted(true);
      setTitle("");
      setDescription("");
      setRating(0);
    } catch (err) {
      console.error("Error submitting feedback", err);
      toast.error("Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center bg-gray-50 px-6 text-center transition-colors duration-200">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
        >
          <CheckCircle2 size={48} />
        </motion.div>
        <h2 className="mb-2 text-2xl font-bold text-gray-900">Thank you!</h2>
        <p className="mb-8 text-gray-500">Your feedback helps us improve FlowThread for everyone.</p>
        <button
          onClick={() => setSubmitted(false)}
          className="rounded-2xl bg-indigo-600 px-8 py-4 font-bold text-white shadow-lg shadow-indigo-200 transition-all active:scale-95"
        >
          Send More Feedback
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 pb-24 transition-colors duration-200">
      <header className="mb-12 text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-600 text-white shadow-xl shadow-indigo-200">
            <MessageSquare size={32} />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Send Feedback</h1>
        <p className="mt-2 text-gray-500">Share your thoughts and help us improve</p>
      </header>

      <div className="mx-auto max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-6 rounded-[40px] bg-white p-8 shadow-sm ring-1 ring-gray-100">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-400">Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  className="transition-all active:scale-90"
                >
                  <Star
                    size={32}
                    className={clsx(
                      "transition-colors",
                      (hoverRating || rating) >= star
                        ? "fill-amber-400 text-amber-400"
                        : "text-gray-200"
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-400">Title (Optional)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief summary of your feedback"
              className="w-full rounded-2xl bg-gray-50 px-5 py-4 text-sm font-medium outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-500 text-gray-900"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-400">Description</label>
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell us more about your experience..."
              rows={5}
              className="w-full rounded-2xl bg-gray-50 px-5 py-4 text-sm font-medium outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-500 text-gray-900"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !description || rating === 0}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-5 font-bold text-white shadow-xl shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="animate-spin" />
            ) : (
              <>
                <Send size={20} />
                Submit Feedback
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
