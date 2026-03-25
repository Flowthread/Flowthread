import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db, logout } from "../firebase";
import { doc, getDoc, addDoc, collection, Timestamp, updateDoc, deleteDoc } from "firebase/firestore";
import { UserProfile } from "../types";
import { 
  LogOut, Bell, Shield, HelpCircle, ChevronRight, Camera, 
  UserPlus, Copy, Check, Moon, Sun, Mail, Smartphone, 
  ExternalLink, Trash2, AlertTriangle, MessageSquare,
  MapPin, Globe, FileText, Briefcase, Plus, X, Search
} from "lucide-react";
import { toast } from "sonner";

const POPULAR_SKILLS = [
  "Graphic Design", "Web Development", "Copywriting", "Video Editing", 
  "Social Media Management", "SEO", "Illustration", "UI/UX", 
  "Photography", "Voiceover", "Translation", "Data Entry",
  "App Development", "Content Writing", "Digital Marketing",
  "3D Modeling", "Animation", "Branding", "Email Marketing",
  "Game Development", "Logo Design", "Marketing Strategy",
  "Mobile App Design", "Motion Graphics", "Product Design",
  "Public Relations", "Sales", "Transcription", "Virtual Assistant",
  "Web Design", "Writing"
].sort();

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: "",
    photoURL: "",
    bio: "",
    location: "",
    portfolioUrl: "",
    skills: [] as string[],
  });
  const [skillSearch, setSkillSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.currentUser) return;
    const fetchProfile = async () => {
      const userDoc = await getDoc(doc(db, "users", auth.currentUser!.uid));
      if (userDoc.exists()) {
        const data = userDoc.data() as UserProfile;
        setProfile(data);
        setEditForm({
          displayName: data.displayName || "",
          photoURL: data.photoURL || "",
          bio: data.bio || "",
          location: data.location || "",
          portfolioUrl: data.portfolioUrl || "",
          skills: data.skills || [],
        });
      }
      setLoading(false);
    };
    fetchProfile();
  }, []);

  const handleSaveProfile = async () => {
    if (!auth.currentUser || !profile) return;
    setLoading(true);
    try {
      const updateData = {
        displayName: editForm.displayName,
        photoURL: editForm.photoURL,
        bio: editForm.bio,
        location: editForm.location,
        portfolioUrl: editForm.portfolioUrl,
        skills: editForm.skills,
      };
      await updateDoc(doc(db, "users", auth.currentUser.uid), updateData);
      setProfile({ ...profile, ...updateData });
      setIsEditing(false);
      toast.success("Profile updated successfully!");
    } catch (err) {
      console.error("Error updating profile", err);
      toast.error("Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSkill = (skill: string) => {
    if (editForm.skills.includes(skill)) {
      setEditForm({ ...editForm, skills: editForm.skills.filter(s => s !== skill) });
    } else if (editForm.skills.length < 10) {
      setEditForm({ ...editForm, skills: [...editForm.skills, skill] });
      setSkillSearch("");
    } else {
      toast.error("You can select up to 10 skills.");
    }
  };

  const handleInviteClient = async () => {
    if (!auth.currentUser) return;
    try {
      const inviteRef = await addDoc(collection(db, "invites"), {
        inviterId: auth.currentUser.uid,
        role: "client",
        status: "pending",
        createdAt: Timestamp.now(),
      });
      const link = `${window.location.origin}/?invite=${inviteRef.id}&role=client`;
      setInviteLink(link);
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Error generating invite", err);
    }
  };

  const toggleSetting = async (key: keyof UserProfile, value: boolean) => {
    if (!auth.currentUser || !profile) return;
    
    const updatedProfile = { ...profile, [key]: value };
    setProfile(updatedProfile);

    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        [key]: value
      });
    } catch (err) {
      console.error(`Error updating ${key}`, err);
    }
  };

  const handleDeleteAccount = async () => {
    if (!auth.currentUser) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "users", auth.currentUser.uid));
      // In a real app, we might also call auth.currentUser.delete() 
      // but that requires recent login. For now, we just clear the doc and logout.
      await logout();
    } catch (err) {
      console.error("Error deleting account", err);
      alert("Failed to delete account. You may need to re-authenticate.");
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;

    // Limit size to 1MB for Firestore document limit
    if (file.size > 1024 * 1024) {
      alert("Image size must be less than 1MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        await updateDoc(doc(db, "users", auth.currentUser!.uid), {
          photoURL: base64String
        });
        setProfile(prev => prev ? { ...prev, photoURL: base64String } : null);
      } catch (err) {
        console.error("Error updating photo", err);
      }
    };
    reader.readAsDataURL(file);
  };

  if (loading) return (
    <div className="flex h-[80vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
    </div>
  );

  return (
    <div className="px-4 py-8 pb-24">
      <header className="mb-8 flex flex-col items-center text-center">
        <div className="relative mb-4">
          <img
            src={profile?.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName || "User"}&background=6366f1&color=fff`}
            alt="Profile"
            className="h-24 w-24 rounded-[32px] object-cover shadow-xl shadow-indigo-100 ring-4 ring-white"
          />
          {!isEditing && (
            <label className="absolute -bottom-2 -right-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg ring-2 ring-white transition-all active:scale-90">
              <Camera size={16} />
              <input 
                type="file" 
                className="hidden" 
                accept="image/*" 
                onChange={handlePhotoUpload} 
              />
            </label>
          )}
        </div>
        
        {isEditing ? (
          <div className="w-full max-w-lg space-y-4 text-left">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Display Name</label>
              <input
                type="text"
                value={editForm.displayName}
                onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                className="w-full rounded-xl bg-slate-50 px-4 py-2 font-bold outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500"
                placeholder="Display Name"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Location</label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  className="w-full rounded-xl bg-slate-50 px-4 py-2 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. London, UK"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Portfolio URL</label>
                <input
                  type="text"
                  value={editForm.portfolioUrl}
                  onChange={(e) => setEditForm({ ...editForm, portfolioUrl: e.target.value })}
                  className="w-full rounded-xl bg-slate-50 px-4 py-2 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500"
                  placeholder="https://portfolio.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bio</label>
              <textarea
                value={editForm.bio}
                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                rows={3}
                className="w-full rounded-xl bg-slate-50 px-4 py-2 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500"
                placeholder="Tell us about yourself..."
              />
            </div>

            {profile?.role === "freelancer" && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Skills (Max 10)</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {editForm.skills.map(skill => (
                    <span key={skill} className="flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600">
                      {skill}
                      <button onClick={() => toggleSkill(skill)}><X size={12} /></button>
                    </span>
                  ))}
                </div>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={skillSearch}
                    onChange={(e) => setSkillSearch(e.target.value)}
                    className="w-full rounded-xl bg-slate-50 py-2 pl-9 pr-4 text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500"
                    placeholder="Search skills..."
                  />
                </div>
                {skillSearch && (
                  <div className="mt-2 max-h-32 overflow-y-auto rounded-xl border border-slate-100 p-2">
                    <div className="flex flex-wrap gap-1">
                      {POPULAR_SKILLS.filter(s => s.toLowerCase().includes(skillSearch.toLowerCase()) && !editForm.skills.includes(s)).map(skill => (
                        <button
                          key={skill}
                          onClick={() => toggleSkill(skill)}
                          className="rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"
                        >
                          {skill}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Photo URL</label>
              <input
                type="text"
                value={editForm.photoURL}
                onChange={(e) => setEditForm({ ...editForm, photoURL: e.target.value })}
                className="w-full rounded-xl bg-slate-50 px-4 py-2 text-xs outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500"
                placeholder="Photo URL (optional)"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 rounded-xl bg-slate-100 py-2 text-sm font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                className="flex-1 rounded-xl bg-indigo-600 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-100"
              >
                Save Changes
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-slate-900">{profile?.displayName}</h2>
            <p className="mb-1 text-sm text-slate-500">{profile?.email}</p>
            {profile?.location && (
              <div className="mb-3 flex items-center justify-center gap-1 text-xs text-slate-400">
                <MapPin size={12} />
                {profile.location}
              </div>
            )}
            
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              <span className="rounded-full bg-indigo-50 px-4 py-1 text-xs font-bold uppercase tracking-wider text-indigo-600">
                {profile?.role}
              </span>
              <button
                onClick={() => setIsEditing(true)}
                className="rounded-full bg-slate-100 px-4 py-1 text-xs font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-200"
              >
                Edit Profile
              </button>
            </div>

            {profile?.bio && (
              <p className="max-w-md text-sm text-slate-600 mb-4">{profile.bio}</p>
            )}

            {profile?.skills && profile.skills.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5 mb-4">
                {profile.skills.map(skill => (
                  <span key={skill} className="rounded-lg bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-500 ring-1 ring-slate-100">
                    {skill}
                  </span>
                ))}
              </div>
            )}

            {profile?.portfolioUrl && (
              <a 
                href={profile.portfolioUrl} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:underline"
              >
                <Globe size={14} />
                Portfolio
                <ExternalLink size={12} />
              </a>
            )}
          </>
        )}
      </header>

      <div className="space-y-8">
        {/* ACCOUNT */}
        <section>
          <h3 className="mb-3 px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Account</h3>
          <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                  <Mail size={20} />
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Email</span>
                  <span className="font-bold text-slate-700">{profile?.email}</span>
                </div>
              </div>
            </div>
            <div className="h-px bg-slate-50 mx-4"></div>
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                  <Shield size={20} />
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Role</span>
                  <span className="font-bold text-slate-700 capitalize">{profile?.role}</span>
                </div>
              </div>
            </div>
            <div className="h-px bg-slate-50 mx-4"></div>
            <button 
              onClick={handleInviteClient}
              className="flex w-full items-center justify-between p-4 transition-colors hover:bg-slate-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <UserPlus size={20} />
                </div>
                <div className="text-left">
                  <span className="block font-bold text-slate-700">Invite Client</span>
                  <span className="text-xs text-slate-500">Get early access perks</span>
                </div>
              </div>
              {copied ? <Check size={20} className="text-emerald-500" /> : <Copy size={20} className="text-slate-300" />}
            </button>
            {inviteLink && (
              <div className="bg-slate-50 p-3 text-[10px] font-mono text-slate-400 break-all border-t border-slate-100">
                {inviteLink}
              </div>
            )}
          </div>
        </section>

        {/* NOTIFICATIONS */}
        <section>
          <h3 className="mb-3 px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Notifications</h3>
          <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Smartphone size={20} />
                </div>
                <span className="font-bold text-slate-700">Push Notifications</span>
              </div>
              <button 
                onClick={() => toggleSetting("pushNotifications", !profile?.pushNotifications)}
                className={`relative h-6 w-11 rounded-full transition-colors ${profile?.pushNotifications ? "bg-indigo-600" : "bg-slate-200"}`}
              >
                <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${profile?.pushNotifications ? "left-6" : "left-1"}`}></div>
              </button>
            </div>
            <div className="h-px bg-slate-50 mx-4"></div>
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Bell size={20} />
                </div>
                <span className="font-bold text-slate-700">Email Notifications</span>
              </div>
              <button 
                onClick={() => toggleSetting("emailNotifications", !profile?.emailNotifications)}
                className={`relative h-6 w-11 rounded-full transition-colors ${profile?.emailNotifications ? "bg-indigo-600" : "bg-slate-200"}`}
              >
                <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${profile?.emailNotifications ? "left-6" : "left-1"}`}></div>
              </button>
            </div>
          </div>
        </section>

        {/* SUPPORT */}
        <section>
          <h3 className="mb-3 px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Support</h3>
          <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100">
            <button 
              onClick={() => navigate("/help-center")}
              className="flex w-full items-center justify-between p-4 transition-colors hover:bg-slate-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <HelpCircle size={20} />
                </div>
                <span className="font-bold text-slate-700">Help Center</span>
              </div>
              <ChevronRight size={20} className="text-slate-300" />
            </button>
            <div className="h-px bg-slate-50 mx-4"></div>
            <button 
              onClick={() => navigate("/feedback")}
              className="flex w-full items-center justify-between p-4 transition-colors hover:bg-slate-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <MessageSquare size={20} />
                </div>
                <span className="font-bold text-slate-700">Send Feedback</span>
              </div>
              <ChevronRight size={20} className="text-slate-300" />
            </button>
          </div>
        </section>

        {/* DANGER ZONE */}
        <section>
          <h3 className="mb-3 px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-rose-400">Danger Zone</h3>
          <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-rose-100">
            <button 
              onClick={() => setShowDeleteModal(true)}
              className="flex w-full items-center gap-3 p-4 transition-colors hover:bg-rose-50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <Trash2 size={20} />
              </div>
              <span className="font-bold text-rose-600">Delete Account</span>
            </button>
          </div>
        </section>

        <button
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 font-bold text-slate-600 shadow-sm ring-1 ring-slate-100 transition-all active:scale-95"
        >
          <LogOut size={20} />
          Log Out
        </button>
      </div>

      <footer className="mt-12 text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">FlowThread v1.1.0</p>
      </footer>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[32px] bg-white p-8 shadow-2xl">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 mx-auto">
              <AlertTriangle size={32} />
            </div>
            <h3 className="mb-2 text-center text-xl font-bold text-slate-900">Delete Account?</h3>
            <p className="mb-8 text-center text-sm text-slate-500">
              This action is permanent and will remove all your data, project history, and wallet information.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="w-full rounded-2xl bg-rose-600 py-4 font-bold text-white shadow-lg shadow-rose-200 transition-all active:scale-95 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Yes, Delete Everything"}
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="w-full rounded-2xl bg-slate-100 py-4 font-bold text-slate-600 transition-all active:scale-95"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
