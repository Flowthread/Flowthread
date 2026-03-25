import React, { useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, doc, updateDoc, getDoc, query, where } from "firebase/firestore";
import { UserProfile } from "../types";
import { Loader2, RefreshCw } from "lucide-react";

export default function ThreadMigration() {
  const [migrating, setMigrating] = useState(false);
  const [status, setStatus] = useState("");

  const runMigration = async () => {
    if (!auth.currentUser) return;
    setMigrating(true);
    setStatus("Fetching threads...");

    try {
      const q = query(
        collection(db, "threads"),
        where("participants", "array-contains", auth.currentUser.uid)
      );
      const threadsSnapshot = await getDocs(q);
      console.log(`[Migration] Found ${threadsSnapshot.docs.length} threads for current user.`);
      let updatedCount = 0;

      for (const threadDoc of threadsSnapshot.docs) {
        const threadData = threadDoc.data();
        console.log(`[Migration] Checking thread: ${threadDoc.id}`, {
          title: threadData.title,
          participants: threadData.participants,
          clientId: threadData.clientId || "not set",
          freelancerId: threadData.freelancerId || "not set"
        });

        if (threadData.clientId && threadData.freelancerId) {
          console.log(`[Migration] Thread ${threadDoc.id} already has both IDs. Skipping.`);
          continue;
        }

        if (threadData.participants && threadData.participants.length === 2) {
          setStatus(`Migrating thread: ${threadData.title}...`);
          let clientId = threadData.clientId;
          let freelancerId = threadData.freelancerId;

          const p1Doc = await getDoc(doc(db, "users", threadData.participants[0]));
          const p2Doc = await getDoc(doc(db, "users", threadData.participants[1]));
          
          if (p1Doc.exists() && p2Doc.exists()) {
            const p1Data = p1Doc.data() as UserProfile;
            const p2Data = p2Doc.data() as UserProfile;

            if (p1Data.role === "client") clientId = p1Data.uid;
            else if (p1Data.role === "freelancer") freelancerId = p1Data.uid;

            if (p2Data.role === "client") clientId = p2Data.uid;
            else if (p2Data.role === "freelancer") freelancerId = p2Data.uid;

            if (clientId && freelancerId) {
              try {
                await updateDoc(doc(db, "threads", threadDoc.id), {
                  clientId,
                  freelancerId
                });
                console.log(`[Migration] Successfully updated thread ${threadDoc.id}`, { clientId, freelancerId });
                updatedCount++;
              } catch (updateErr) {
                console.error(`[Migration] Failed to update thread ${threadDoc.id}`, updateErr);
              }
            } else {
              console.warn(`[Migration] Could not determine both roles for thread ${threadDoc.id}`, { clientId, freelancerId });
            }
          } else {
            console.warn(`[Migration] One or more participant docs missing for thread ${threadDoc.id}`);
          }
        } else {
          console.log(`[Migration] Thread ${threadDoc.id} does not have exactly 2 participants. Skipping auto-migration.`);
        }
      }
      console.log(`[Migration] Finished. Updated ${updatedCount} threads.`);
      setStatus(`Migration complete! Updated ${updatedCount} threads.`);
    } catch (err: any) {
      console.error("Migration error", err);
      setStatus(`Migration failed: ${err.message}`);
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="mb-6 rounded-2xl bg-indigo-50 p-4 border border-indigo-100">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-indigo-900">Chat Data Migration</h4>
          <p className="text-xs text-indigo-600">Fix missing Client/Freelancer IDs in existing chats.</p>
        </div>
        <button
          onClick={runMigration}
          disabled={migrating}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm disabled:opacity-50"
        >
          {migrating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Run Migration
        </button>
      </div>
      {status && (
        <p className="mt-2 text-[10px] font-medium text-indigo-500 italic">{status}</p>
      )}
    </div>
  );
}
