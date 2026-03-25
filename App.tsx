import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import AuthGuard from "./components/AuthGuard";
import Layout from "./components/Layout";
import Threads from "./pages/Threads";
import Timeline from "./pages/Timeline";
import Wallet from "./pages/Wallet";
import Profile from "./pages/Profile";
import Notifications from "./pages/Notifications";
import HelpCenter from "./pages/HelpCenter";
import Feedback from "./pages/Feedback";
import Success from "./pages/Success";
import ChatRoom from "./components/ChatRoom";
import ErrorBoundary from "./components/ErrorBoundary";
import { NotificationProvider } from "./components/NotificationProvider";
import { Toaster } from "sonner";

export default function App() {
  return (
    <ErrorBoundary>
      <NotificationProvider>
        <Router>
          <AuthGuard>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Navigate to="/threads" replace />} />
                <Route path="/threads" element={<Threads />} />
                <Route path="/timeline" element={<Timeline />} />
                <Route path="/wallet" element={<Wallet />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/help-center" element={<HelpCenter />} />
                <Route path="/feedback" element={<Feedback />} />
                <Route path="/thread/:threadId/success" element={<Success />} />
              </Route>
              <Route path="/threads/:threadId" element={<ChatRoom />} />
            </Routes>
          </AuthGuard>
        </Router>
        <Toaster position="top-center" richColors />
      </NotificationProvider>
    </ErrorBoundary>
  );
}
