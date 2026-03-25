import React, { useEffect } from "react";
import { useNotifications } from "../components/NotificationProvider";
import { format } from "date-fns";
import { MessageSquare, DollarSign, CheckCircle2, PlusCircle, Bell, ChevronRight, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { doc, deleteDoc } from "firebase/firestore";

export default function Notifications() {
  const { notifications, markAsRead, unreadCount } = useNotifications();
  const navigate = useNavigate();

  const getIcon = (type: string) => {
    switch (type) {
      case "message": return <MessageSquare className="text-blue-500" size={20} />;
      case "payment": return <DollarSign className="text-green-500" size={20} />;
      case "delivery": return <CheckCircle2 className="text-purple-500" size={20} />;
      case "task_created": return <PlusCircle className="text-indigo-500" size={20} />;
      default: return <Bell className="text-slate-400" size={20} />;
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!auth.currentUser) return;
    try {
      await deleteDoc(doc(db, "users", auth.currentUser.uid, "notifications", id));
    } catch (err) {
      console.error("Error deleting notification", err);
    }
  };

  const handleNotificationClick = async (notif: any) => {
    if (!notif.read) {
      await markAsRead(notif.id);
    }
    navigate(notif.link);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
          <p className="mt-1 text-gray-500">
            {unreadCount > 0 ? `You have ${unreadCount} unread notifications` : "You're all caught up!"}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {notifications.length > 0 ? (
            notifications.map((notif) => (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => handleNotificationClick(notif)}
                className={clsx(
                  "group relative flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition-all hover:shadow-md",
                  notif.read 
                    ? "border-gray-100 bg-white" 
                    : "border-indigo-100 bg-indigo-50/30"
                )}
              >
                <div className={clsx(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  notif.read ? "bg-gray-100" : "bg-indigo-100"
                )}>
                  {getIcon(notif.type)}
                </div>

                <div className="flex-1 pr-8">
                  <div className="flex items-center justify-between">
                    <h3 className={clsx(
                      "font-semibold",
                      notif.read ? "text-gray-700" : "text-gray-900"
                    )}>
                      {notif.title}
                    </h3>
                    <span className="text-xs text-gray-400">
                      {format(notif.createdAt.toMillis(), "MMM d, h:mm a")}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                    {notif.message}
                  </p>
                </div>

                <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 flex items-center gap-2">
                  <button
                    onClick={(e) => handleDelete(e, notif.id)}
                    className="rounded-full p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                  <ChevronRight size={20} className="text-gray-300" />
                </div>

                {!notif.read && (
                  <div className="absolute left-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                )}
              </motion.div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
                <Bell size={40} className="text-gray-300" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">No notifications yet</h3>
              <p className="mt-1 text-gray-500">We'll let you know when something happens.</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
