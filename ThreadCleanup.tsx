import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, doc, deleteDoc, query, where } from "firebase/firestore";
import { Thread } from "../types";
import { Loader2, Trash2, AlertTriangle, CheckSquare, Square } from "lucide-react";

export default function ThreadCleanup({ onComplete }: { onComplete: () => void }) {
  const [loading, setLoading] = useState(false);
  const [invalidThreads, setInvalidThreads] = useState<Thread[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);

  const findInvalidThreads = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "threads"),
        where("participants", "array-contains", auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      const invalid = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as Thread))
        .filter(t => !t.clientId || !t.freelancerId || t.participants.length < 2);
      
      setInvalidThreads(invalid);
      setSelectedIds(new Set(invalid.map(t => t.id)));
      if (invalid.length > 0) setShowModal(true);
      else alert("No invalid threads found.");
    } catch (err) {
      console.error("Error finding invalid threads", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} threads?`)) return;

    setLoading(true);
    try {
      for (const id of selectedIds) {
        await deleteDoc(doc(db, "threads", id));
      }
      setShowModal(false);
      onComplete();
    } catch (err) {
      console.error("Error deleting threads", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <>
      <button
        onClick={findInvalidThreads}
        disabled={loading}
        className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-xs font-bold text-red-600 border border-red-100 shadow-sm hover:bg-red-100 disabled:opacity-50"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        Clean Up Chats
      </button>

      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3 text-red-600">
              <AlertTriangle size={24} />
              <h3 className="text-xl font-bold">Invalid Chats Found</h3>
            </div>
            
            <p className="mb-4 text-sm text-slate-500">
              The following chats are missing a Client ID, Freelancer ID, or have fewer than 2 participants.
            </p>

            <div className="mb-6 max-h-60 overflow-y-auto space-y-2 no-scrollbar">
              {invalidThreads.map(t => (
                <div 
                  key={t.id} 
                  onClick={() => toggleSelect(t.id)}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 cursor-pointer hover:bg-slate-50"
                >
                  {selectedIds.has(t.id) ? (
                    <CheckSquare size={18} className="text-indigo-600" />
                  ) : (
                    <Square size={18} className="text-slate-300" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 truncate">{t.title}</p>
                    <p className="text-[10px] text-slate-400 font-mono truncate">{t.id}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-xl bg-slate-100 py-3 font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading || selectedIds.size === 0}
                className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-red-600 py-3 font-bold text-white shadow-lg shadow-red-200 disabled:opacity-50"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                Delete Selected ({selectedIds.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
