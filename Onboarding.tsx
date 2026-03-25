import React, { useState } from "react";
import { db, auth } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { UserProfile } from "../types";
import { Search, X, Check, ArrowRight, ArrowLeft, Camera, Globe, MapPin, User, FileText } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

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

interface OnboardingProps {
  profile: UserProfile;
  onComplete: (updatedProfile: UserProfile) => void;
}

export default function Onboarding({ profile, onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [skills, setSkills] = useState<string[]>(profile.skills || []);
  const [searchTerm, setSearchTerm] = useState("");
  const [details, setDetails] = useState({
    displayName: profile.displayName || "",
    location: profile.location || "",
    bio: profile.bio || "",
    portfolioUrl: profile.portfolioUrl || "",
    photoURL: profile.photoURL || "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredSkills = POPULAR_SKILLS.filter(skill => 
    skill.toLowerCase().includes(searchTerm.toLowerCase()) && !skills.includes(skill)
  );

  const toggleSkill = (skill: string) => {
    if (skills.includes(skill)) {
      setSkills(skills.filter(s => s !== skill));
    } else if (skills.length < 10) {
      setSkills([...skills, skill]);
      setSearchTerm("");
    } else {
      toast.error("You can select up to 10 skills.");
    }
  };

  const handleComplete = async () => {
    if (!details.displayName.trim()) {
      toast.error("Full name is required.");
      return;
    }

    if (details.portfolioUrl && !isValidUrl(details.portfolioUrl)) {
      toast.error("Please enter a valid portfolio URL.");
      return;
    }

    if (details.photoURL && !isValidUrl(details.photoURL) && !details.photoURL.startsWith("data:image")) {
      toast.error("Please enter a valid photo URL.");
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedData = {
        ...details,
        skills,
        onboardingCompleted: true,
      };
      await updateDoc(doc(db, "users", profile.uid), updatedData);
      onComplete({ ...profile, ...updatedData });
      toast.success("Onboarding completed!");
    } catch (err) {
      console.error("Error completing onboarding", err);
      toast.error("Failed to save profile. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      toast.error("Image size must be less than 1MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setDetails({ ...details, photoURL: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-50 p-4 sm:p-6">
      <div className="w-full max-w-2xl overflow-hidden rounded-[32px] bg-white shadow-2xl ring-1 ring-gray-100">
        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-gray-100">
          <motion.div 
            className="h-full bg-indigo-600"
            initial={{ width: "50%" }}
            animate={{ width: step === 1 ? "50%" : "100%" }}
          />
        </div>

        <div className="p-8 sm:p-12">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-gray-900">What are your skills?</h2>
                  <p className="mt-2 text-gray-500">Select up to 10 skills that describe your expertise.</p>
                </div>

                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search skills..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-2xl bg-gray-50 py-4 pl-12 pr-4 font-medium text-gray-900 outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Selected Skills Chips */}
                <div className="flex flex-wrap gap-2">
                  {skills.map(skill => (
                    <span 
                      key={skill}
                      className="flex items-center gap-1.5 rounded-full bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-600"
                    >
                      {skill}
                      <button onClick={() => toggleSkill(skill)} className="hover:text-indigo-800">
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                  {skills.length === 0 && (
                    <p className="w-full text-center text-sm italic text-gray-400">No skills selected yet.</p>
                  )}
                </div>

                {/* Skill Suggestions */}
                <div className="max-h-48 overflow-y-auto rounded-2xl border border-gray-100 p-2 no-scrollbar">
                  <div className="flex flex-wrap gap-2">
                    {filteredSkills.map(skill => (
                      <button
                        key={skill}
                        onClick={() => toggleSkill(skill)}
                        className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-all hover:border-indigo-500 hover:text-indigo-600"
                      >
                        {skill}
                      </button>
                    ))}
                    {filteredSkills.length === 0 && searchTerm && (
                      <p className="w-full p-4 text-center text-sm text-gray-400">No matching skills found.</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => setStep(2)}
                    disabled={skills.length === 0}
                    className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-8 py-4 font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
                  >
                    Next Step
                    <ArrowRight size={20} />
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-gray-900">Personal Details</h2>
                  <p className="mt-2 text-gray-500">Tell clients more about yourself.</p>
                </div>

                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <img
                      src={details.photoURL || `https://ui-avatars.com/api/?name=${details.displayName || "User"}&background=6366f1&color=fff`}
                      alt="Profile"
                      className="h-24 w-24 rounded-[32px] object-cover shadow-xl ring-4 ring-white"
                    />
                    <label className="absolute -bottom-2 -right-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg ring-2 ring-white transition-all active:scale-90">
                      <Camera size={16} />
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handlePhotoUpload} 
                      />
                    </label>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                      <User size={14} /> Full Name
                    </label>
                    <input
                      type="text"
                      value={details.displayName}
                      onChange={(e) => setDetails({ ...details, displayName: e.target.value })}
                      className="w-full rounded-2xl bg-gray-50 px-4 py-3 font-medium text-gray-900 outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                      <MapPin size={14} /> Location
                    </label>
                    <input
                      type="text"
                      value={details.location}
                      onChange={(e) => setDetails({ ...details, location: e.target.value })}
                      className="w-full rounded-2xl bg-gray-50 px-4 py-3 font-medium text-gray-900 outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g. London, UK"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                    <FileText size={14} /> Bio
                  </label>
                  <textarea
                    value={details.bio}
                    onChange={(e) => setDetails({ ...details, bio: e.target.value })}
                    rows={3}
                    className="w-full rounded-2xl bg-gray-50 px-4 py-3 font-medium text-gray-900 outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-500"
                    placeholder="Tell clients about your experience and what you offer..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                    <Globe size={14} /> Portfolio URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={details.portfolioUrl}
                    onChange={(e) => setDetails({ ...details, portfolioUrl: e.target.value })}
                    className="w-full rounded-2xl bg-gray-50 px-4 py-3 font-medium text-gray-900 outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-500"
                    placeholder="https://yourportfolio.com"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => setStep(1)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gray-100 py-4 font-bold text-gray-600 transition-all active:scale-95"
                  >
                    <ArrowLeft size={20} />
                    Back
                  </button>
                  <button
                    onClick={handleComplete}
                    disabled={isSubmitting}
                    className="flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? "Saving..." : "Complete Profile"}
                    {!isSubmitting && <Check size={20} />}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
