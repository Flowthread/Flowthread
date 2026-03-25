import React, { useEffect, useState } from "react";
import { auth, signInWithGoogle, db } from "../firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { UserProfile } from "../types";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Logo } from "./Logo";
import Onboarding from "./Onboarding";

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleSelection, setRoleSelection] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists()) {
          const profileData = userDoc.data() as UserProfile;
          setProfile(profileData);
          setRoleSelection(false);
        } else {
          // Check for pre-filled role from invite
          const invitedRole = searchParams.get("role");
          if (invitedRole === "client" || invitedRole === "freelancer") {
            handleRoleSelect(invitedRole as "client" | "freelancer", firebaseUser);
          } else {
            setRoleSelection(true);
          }
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [searchParams]);

  const handleRoleSelect = async (role: "freelancer" | "client", currentUser?: User) => {
    const activeUser = currentUser || user;
    if (!activeUser) return;
    
    const newProfile: UserProfile = {
      uid: activeUser.uid,
      displayName: activeUser.displayName || "Anonymous",
      email: activeUser.email || "",
      photoURL: activeUser.photoURL || "",
      role,
      createdAt: Timestamp.now(),
      onboardingCompleted: role === "client", // Clients don't need onboarding
    };

    try {
      await setDoc(doc(db, "users", activeUser.uid), newProfile);
      
      // Track invite acceptance
      const inviteId = searchParams.get("invite");
      if (inviteId) {
        await updateDoc(doc(db, "invites", inviteId), {
          status: "accepted",
          inviteeId: activeUser.uid,
          acceptedAt: Timestamp.now(),
        });
      }

      setProfile(newProfile);
      setRoleSelection(false);
    } catch (err) {
      console.error("Error setting role", err);
    }
  };

  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err.code !== "auth/cancelled-popup-request" && err.code !== "auth/popup-closed-by-user") {
        console.error("Sign in error", err);
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 transition-colors duration-200">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-50 px-6 text-center transition-colors duration-200">
        <div className="mb-8 flex items-center justify-center">
          <Logo 
            variant="full" 
            className="max-w-[280px] w-full h-auto text-gray-900" 
          />
        </div>
        <button
          onClick={handleSignIn}
          disabled={isSigningIn}
          className="flex w-full max-w-xs items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4 font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200 transition-all hover:bg-gray-50 active:scale-95 disabled:opacity-50"
        >
          {isSigningIn ? (
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          ) : (
            <>
              <img src="https://www.google.com/favicon.ico" alt="Google" className="h-5 w-5" />
              Continue with Google
            </>
          )}
        </button>
      </div>
    );
  }

  if (roleSelection) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-50 px-6 text-center transition-colors duration-200">
        <h2 className="mb-2 text-2xl font-bold text-gray-900">Choose your role</h2>
        <p className="mb-8 text-gray-500">How will you be using FlowThread?</p>
        <div className="grid w-full max-w-xs gap-4">
          <button
            onClick={() => handleRoleSelect("freelancer")}
            className="group flex flex-col items-center rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 transition-all hover:ring-indigo-500"
          >
            <span className="mb-2 text-3xl">👨‍💻</span>
            <span className="font-bold text-gray-900">Freelancer</span>
            <span className="text-sm text-gray-500">I deliver work and get paid</span>
          </button>
          <button
            onClick={() => handleRoleSelect("client")}
            className="group flex flex-col items-center rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 transition-all hover:ring-indigo-500"
          >
            <span className="mb-2 text-3xl">💼</span>
            <span className="font-bold text-gray-900">Client</span>
            <span className="text-sm text-gray-500">I hire talent and manage projects</span>
          </button>
        </div>
      </div>
    );
  }

  if (profile && profile.role === "freelancer" && !profile.onboardingCompleted) {
    return (
      <Onboarding 
        profile={profile} 
        onComplete={(updatedProfile) => setProfile(updatedProfile)} 
      />
    );
  }

  return <>{children}</>;
}
