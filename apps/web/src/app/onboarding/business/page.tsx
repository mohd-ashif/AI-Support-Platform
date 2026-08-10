"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { setWorkspaces, setSelectedWorkspace } from "@/store/slices/authSlice";
import { apiFetch } from "@/lib/api";
import { Bot, Building2, Globe, Sparkles, Upload, X, Check, Loader2, ArrowRight } from "lucide-react";

const INDUSTRIES = [
  "SaaS/Tech",
  "Retail",
  "Healthcare",
  "Real Estate",
  "Education",
  "Finance",
  "Other",
];

export default function BusinessOnboardingPage() {
  const router = useRouter();
  const dispatch = useDispatch();

  const [businessName, setBusinessName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [industry, setIndustry] = useState("SaaS/Tech");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user already has an in-progress onboarding workspace
    async function checkExistingWorkspace() {
      try {
        const workspaces = await apiFetch("/workspaces");
        const onboardingWs = workspaces.find((w: any) => w.status === "onboarding");
        if (onboardingWs && onboardingWs.business) {
          setBusinessName(onboardingWs.business.name || "");
          setWebsiteUrl(onboardingWs.business.website_url || "");
          setIndustry(onboardingWs.business.industry || "SaaS/Tech");
          setLogoUrl(onboardingWs.business.logo_url || null);
          setPreviewUrl(onboardingWs.business.logo_url || null);
        }
      } catch (e) {
        // Ignore
      }
    }
    checkExistingWorkspace();
  }, []);

  const handleWebsiteBlur = () => {
    let url = websiteUrl.trim();
    if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
      setWebsiteUrl(`https://${url}`);
    }
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Image size must be less than 2MB.");
      return;
    }

    setError(null);
    setLogoFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const removeLogo = () => {
    setLogoFile(null);
    setPreviewUrl(null);
    setLogoUrl(null);
  };

  const uploadLogoToCloudinary = async (file: File): Promise<string | null> => {
    try {
      setUploadingLogo(true);
      const sigData = await apiFetch("/uploads/cloudinary-signature");
      
      if (sigData?.cloud_name && !sigData.cloud_name.startsWith("mock")) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("api_key", sigData.api_key);
        formData.append("timestamp", sigData.timestamp.toString());
        formData.append("signature", sigData.signature);
        formData.append("folder", sigData.folder);

        const res = await fetch(`https://api.cloudinary.com/v1_1/${sigData.cloud_name}/image/upload`, {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          return data.secure_url;
        }
      }
    } catch (err) {
      // Fallback to base64
    } finally {
      setUploadingLogo(false);
    }

    // Convert file to Base64 data URL fallback
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (businessName.trim().length < 2 || businessName.trim().length > 100) {
      setError("Business name must be between 2 and 100 characters.");
      return;
    }

    if (!websiteUrl.trim()) {
      setError("Website URL is required.");
      return;
    }

    setLoading(true);

    try {
      let finalLogoUrl = logoUrl;
      if (logoFile) {
        finalLogoUrl = await uploadLogoToCloudinary(logoFile);
      }

      const ws = await apiFetch("/workspaces", {
        method: "POST",
        body: JSON.stringify({
          business_name: businessName.trim(),
          website_url: websiteUrl.trim(),
          industry: industry,
          logo_url: finalLogoUrl,
        }),
      });

      dispatch(setSelectedWorkspace(ws));

      // Refresh workspaces in Redux
      const allWorkspaces = await apiFetch("/workspaces");
      dispatch(setWorkspaces(allWorkspaces));

      router.push("/onboarding/subscription");
    } catch (err: any) {
      setError(err.message || "Failed to create business workspace.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">
        {/* Progress Tracker */}
        <div className="w-full space-y-2">
          <div className="flex justify-between items-center text-[11px] font-bold text-neutral-400">
            <span className="text-[#D4AF37]">Step 1 of 2: Business Profile</span>
            <span>50% Completed</span>
          </div>
          <div className="w-full h-1.5 bg-[#1C1C1C] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] w-1/2 transition-all duration-500 rounded-full" />
          </div>
        </div>

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#D4AF37] via-[#F4D03F] to-[#FFEAA7] flex items-center justify-center shadow-xl shadow-[#D4AF37]/20">
            <Bot className="h-6 w-6 text-[#050505]" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Set Up Your Business</h1>
          <p className="text-xs text-neutral-400">
            Configure your organization profile to train custom AI support models.
          </p>
        </div>

        {/* Form Container */}
        <form
          onSubmit={handleSubmit}
          className="bg-[#111111] border border-[#222222] rounded-2xl p-8 space-y-5 shadow-2xl"
        >
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Business Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-300">
              Business Name <span className="text-[#D4AF37]">*</span>
            </label>
            <div className="relative">
              <Building2 className="absolute left-3.5 top-3 h-4 w-4 text-neutral-500" />
              <input
                type="text"
                required
                placeholder="Acme Support Inc."
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] focus:border-[#D4AF37] text-xs text-white placeholder-neutral-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Website URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-300">
              Website URL <span className="text-[#D4AF37]">*</span>
            </label>
            <div className="relative">
              <Globe className="absolute left-3.5 top-3 h-4 w-4 text-neutral-500" />
              <input
                type="text"
                required
                placeholder="https://acme-support.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                onBlur={handleWebsiteBlur}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] focus:border-[#D4AF37] text-xs text-white placeholder-neutral-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Industry Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-300">
              Industry <span className="text-[#D4AF37]">*</span>
            </label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] focus:border-[#D4AF37] text-xs text-white focus:outline-none"
            >
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind} className="bg-[#111111] text-white">
                  {ind}
                </option>
              ))}
            </select>
          </div>

          {/* Logo Upload with Signed Cloudinary Preview */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-300">Company Logo (Optional)</label>
            {previewUrl ? (
              <div className="flex items-center space-x-4 p-3 bg-[#050505] border border-[#222222] rounded-xl">
                <img
                  src={previewUrl}
                  alt="Logo Preview"
                  className="h-12 w-12 rounded-lg object-cover border border-[#333333]"
                />
                <div className="flex-1 truncate">
                  <p className="text-xs font-bold text-neutral-200 truncate">Logo Uploaded</p>
                  <p className="text-[10px] text-neutral-500">Max 2MB Image</p>
                </div>
                <button
                  type="button"
                  onClick={removeLogo}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-4 bg-[#050505] border-2 border-dashed border-[#222222] hover:border-[#D4AF37]/50 rounded-xl cursor-pointer transition-colors">
                <Upload className="h-5 w-5 text-[#D4AF37] mb-1" />
                <span className="text-xs text-neutral-300 font-semibold">Click to upload logo</span>
                <span className="text-[10px] text-neutral-500">PNG, JPG, SVG up to 2MB</span>
                <input type="file" accept="image/*" onChange={handleLogoSelect} className="hidden" />
              </label>
            )}
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={loading || uploadingLogo}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-black font-extrabold text-xs hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center space-x-2 shadow-lg shadow-[#D4AF37]/20"
          >
            {loading || uploadingLogo ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-black" />
                <span>Saving Workspace...</span>
              </>
            ) : (
              <>
                <span>Continue to Subscription</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
