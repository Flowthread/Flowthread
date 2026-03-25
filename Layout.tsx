import React, { useState, useRef, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { MessageSquare, Clock, Wallet, User, Bell, Check, Trash2, ChevronRight, X } from "lucide-react";
import { clsx } from "clsx";
import { useNotifications } from "./NotificationProvider";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";
import { auth, db } from "../firebase";
import { doc, deleteDoc } from "firebase/firestore";
import { Logo } from "./Logo";

export default function Layout() {
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNotificationClick = async (notif: any) => {
    if (!notif.read) {
      await markAsRead(notif.id);
    }
    setShowNotifications(false);
    navigate(notif.link);
  };

  const handleDeleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!auth.currentUser) return;
    try {
      await deleteDoc(doc(db, "users", auth.currentUser.uid, "notifications", id));
    } catch (err) {
      console.error("Error deleting notification", err);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 pb-16 transition-colors duration-200">
      {/* Top Header */}
      <header className="sticky top-0 z-[60] flex h-16 items-center justify-between border-b border-gray-100 bg-white/80 px-4 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="bg-white rounded-lg p-1 shadow-sm border border-gray-100">
            <Logo variant="icon" className="h-8 w-8" />
          </div>
          <span className="font-bold text-gray-900 tracking-tight">FlowThread</span>
        </div>

        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-all active:scale-90"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-2 w-80 overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-gray-50 p-4">
                  <h3 className="font-bold text-gray-900">Notifications</h3>
                  <button onClick={() => setShowNotifications(false)} className="text-gray-400">
                    <X size={18} />
                  </button>
                </div>

                <div className="max-h-[400px] overflow-y-auto no-scrollbar">
                  {notifications.length > 0 ? (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={clsx(
                          "group relative flex cursor-pointer items-start gap-3 border-b border-gray-50 p-4 transition-colors hover:bg-gray-50",
                          !notif.read && "bg-indigo-50/30"
                        )}
                      >
                        <div className={clsx(
                          "mt-1 h-2 w-2 shrink-0 rounded-full",
                          notif.read ? "bg-transparent" : "bg-indigo-500"
                        )} />
                        <div className="flex-1 pr-6">
                          <p className={clsx(
                            "text-sm leading-tight",
                            notif.read ? "text-gray-600" : "text-gray-900 font-semibold"
                          )}>
                            {notif.title}
                          </p>
                          <p className="mt-1 text-xs text-gray-400 line-clamp-2">{notif.message}</p>
                          <span className="mt-2 block text-[10px] text-gray-400">
                            {format(notif.createdAt.toMillis(), "MMM d, h:mm a")}
                          </span>
                        </div>
                        <button
                          onClick={(e) => handleDeleteNotification(e, notif.id)}
                          className="absolute right-4 top-4 opacity-0 transition-opacity group-hover:opacity-100 text-gray-300 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Bell size={32} className="mb-2 text-gray-200" />
                      <p className="text-sm text-gray-400">No notifications yet</p>
                    </div>
                  )}
                </div>

                {notifications.length > 0 && (
                  <button 
                    onClick={() => {
                      setShowNotifications(false);
                      navigate("/notifications");
                    }}
                    className="flex w-full items-center justify-center gap-2 border-t border-gray-100 p-3 text-xs font-bold text-indigo-600 hover:bg-gray-50"
                  >
                    View All Notifications
                    <ChevronRight size={14} />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar">
        <div className="mx-auto w-full max-w-7xl">
          <Outlet />
        </div>
      </main>

      <nav className="bottom-nav fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-gray-100 bg-white px-4">
        <NavLink
          to="/threads"
          className={({ isActive }) =>
            clsx(
              "flex flex-col items-center gap-1 transition-colors",
              isActive ? "text-indigo-600" : "text-gray-400"
            )
          }
        >
          <MessageSquare size={24} />
          <span className="text-[10px] font-medium uppercase tracking-wider">Chats</span>
        </NavLink>
        <NavLink
          to="/timeline"
          className={({ isActive }) =>
            clsx(
              "flex flex-col items-center gap-1 transition-colors",
              isActive ? "text-indigo-600" : "text-gray-400"
            )
          }
        >
          <Clock size={24} />
          <span className="text-[10px] font-medium uppercase tracking-wider">Feed</span>
        </NavLink>
        <NavLink
          to="/wallet"
          className={({ isActive }) =>
            clsx(
              "flex flex-col items-center gap-1 transition-colors",
              isActive ? "text-indigo-600" : "text-gray-400"
            )
          }
        >
          <Wallet size={24} />
          <span className="text-[10px] font-medium uppercase tracking-wider">Earnings</span>
        </NavLink>
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            clsx(
              "flex flex-col items-center gap-1 transition-colors",
              isActive ? "text-indigo-600" : "text-gray-400"
            )
          }
        >
          <User size={24} />
          <span className="text-[10px] font-medium uppercase tracking-wider">Profile</span>
        </NavLink>
      </nav>
    </div>
  );
}
