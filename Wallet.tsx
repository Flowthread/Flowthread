import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { db, auth, handleFirestoreError, OperationType } from "../firebase";
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { UserProfile, Transaction } from "../types";
import { Wallet as WalletIcon, ArrowDownLeft, ArrowUpRight, Plus, ExternalLink, CreditCard, AlertCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function Wallet() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [stripeBalance, setStripeBalance] = useState<{ available: any[]; pending: any[] } | null>(null);
  const [detailsSubmitted, setDetailsSubmitted] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribeProfile = onSnapshot(doc(db, "users", auth.currentUser.uid), (snapshot) => {
      const data = snapshot.data() as UserProfile;
      setProfile(data);
      
      // If we have a stripeAccountId, fetch balance
      if (data?.stripeAccountId) {
        fetchStripeBalance(data.stripeAccountId);
      }
    });

    const q = query(
      collection(db, "transactions"),
      where("toId", "==", auth.currentUser.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribeTransactions = onSnapshot(
      q,
      (snapshot) => {
        setTransactions(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction)));
        setLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, "transactions")
    );

    // Handle return from onboarding
    const stripeAccountIdParam = searchParams.get("stripe_account_id");
    if (stripeAccountIdParam && auth.currentUser) {
      updateDoc(doc(db, "users", auth.currentUser.uid), {
        stripeAccountId: stripeAccountIdParam,
      }).then(() => {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete("stripe_account_id");
        setSearchParams(newParams);
      });
    }

    return () => {
      unsubscribeProfile();
      unsubscribeTransactions();
    };
  }, [searchParams, setSearchParams]);

  const fetchStripeBalance = async (accountId: string) => {
    try {
      const response = await fetch(`/api/get-stripe-balance/${accountId}`);
      if (response.ok) {
        const data = await response.json();
        setStripeBalance(data.balance);
        setDetailsSubmitted(data.details_submitted);
      }
    } catch (err) {
      console.error("Error fetching Stripe balance", err);
    }
  };

  const handleConnectStripe = async () => {
    if (!auth.currentUser) return;
    setConnecting(true);
    setError(null);
    try {
      if (profile?.stripeAccountId && detailsSubmitted) {
        // Create login link for existing account that is fully onboarded
        const response = await fetch("/api/create-stripe-login-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId: profile.stripeAccountId }),
        });
        
        if (!response.ok) {
          const errData = await response.json();
          if (errData.error === "onboarding_incomplete") {
            // Fall through to onboarding logic
            await startOnboarding(profile.stripeAccountId);
          } else {
            throw new Error(errData.message || "Failed to create dashboard link");
          }
        } else {
          const { url } = await response.json();
          window.open(url, "_blank");
        }
      } else {
        // Start or resume onboarding
        await startOnboarding(profile?.stripeAccountId);
      }
    } catch (err: any) {
      console.error("Stripe Connect error", err);
      setError(err.message || "Failed to connect with Stripe");
    } finally {
      setConnecting(false);
    }
  };

  const startOnboarding = async (existingAccountId?: string) => {
    if (!auth.currentUser) return;
    const response = await fetch("/api/create-connect-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        email: auth.currentUser.email,
        accountId: existingAccountId
      }),
    });
    
    if (!response.ok) throw new Error("Failed to start onboarding");
    
    const { url, accountId } = await response.json();
    
    // Save accountId to user profile immediately if it's new
    if (!existingAccountId) {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        stripeAccountId: accountId,
      });
    }

    // Open onboarding in new tab
    window.open(url, "_blank");
  };

  const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0);
  const availableBalance = stripeBalance?.available?.[0]?.amount / 100 || 0;
  const pendingBalance = stripeBalance?.pending?.[0]?.amount / 100 || 0;

  return (
    <div className="px-4 py-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Earnings</h1>
        <p className="text-sm text-gray-500">Manage your earnings and payments</p>
      </header>

      {/* Balance Card */}
      <div className="relative mb-8 overflow-hidden rounded-[32px] bg-indigo-600 p-8 text-white shadow-2xl shadow-indigo-200">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl"></div>
        <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-indigo-400/20 blur-3xl"></div>
        
        <div className="relative z-10">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-indigo-100">Total Revenue</span>
            <WalletIcon size={24} className="text-indigo-200" />
          </div>
          <div className="mb-8 text-4xl font-black tracking-tight">
            ${totalRevenue.toLocaleString()}
          </div>
          
          {profile?.role === "freelancer" && (
            <div className="space-y-4">
              {stripeBalance && (
                <div className="grid grid-cols-2 gap-4 rounded-2xl bg-white/10 p-4 backdrop-blur-md">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">Available</p>
                    <p className="text-xl font-black">${availableBalance.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">Pending</p>
                    <p className="text-xl font-black">${pendingBalance.toLocaleString()}</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-red-500/20 p-3 text-xs font-medium text-red-100 backdrop-blur-sm">
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}

              <button
                onClick={handleConnectStripe}
                disabled={connecting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 font-bold text-indigo-600 transition-all active:scale-95 disabled:opacity-50"
              >
                {connecting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : profile.stripeAccountId ? (
                  <>
                    <CreditCard size={18} />
                    {detailsSubmitted ? "Withdraw" : "Complete Onboarding"}
                  </>
                ) : (
                  <>
                    <Plus size={18} />
                    Connect
                  </>
                )}
              </button>
              
              {profile.stripeAccountId && (
                <p className="text-center text-[10px] font-medium text-indigo-200">
                  Withdrawals are managed through your Stripe Express dashboard.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Recent Transactions</h3>
          <button className="text-xs font-bold text-indigo-600 uppercase tracking-wider">View All</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="mb-4 text-4xl">💸</span>
            <h3 className="mb-1 text-sm font-bold text-gray-900">No earnings yet</h3>
            <p className="max-w-[180px] text-xs text-gray-500">Your earnings will appear here after projects are paid.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center gap-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <ArrowDownLeft size={24} />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-gray-900">Payment Received</h4>
                  <p className="text-[10px] font-medium text-gray-400">
                    {format(t.createdAt.toDate(), "MMM dd, yyyy • HH:mm")}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-gray-900">+{t.amount}</div>
                  <div className="text-[10px] font-medium text-gray-400">Fee: {t.fee}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
