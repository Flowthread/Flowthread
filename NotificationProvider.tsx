import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  limit, 
  doc, 
  updateDoc 
} from "firebase/firestore";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string;
  read: boolean;
  createdAt: any;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setNotifications([]);
        setUnreadCount(0);
        return;
      }

      const q = query(
        collection(db, "users", user.uid, "notifications"),
        orderBy("createdAt", "desc"),
        limit(20)
      );

      const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const notifs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Notification[];
        
        setNotifications(notifs);
        setUnreadCount(notifs.filter(n => !n.read).length);
      }, (err) => {
        // Only handle if still logged in
        if (auth.currentUser) {
          console.error("Error fetching notifications", err);
        }
      });

      return () => unsubscribeSnapshot();
    });

    return () => unsubscribeAuth();
  }, []);

  const markAsRead = async (id: string) => {
    if (!auth.currentUser) return;
    try {
      const notifRef = doc(db, "users", auth.currentUser.uid, "notifications", id);
      await updateDoc(notifRef, { read: true });
    } catch (err) {
      console.error("Error marking notification as read", err);
    }
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
