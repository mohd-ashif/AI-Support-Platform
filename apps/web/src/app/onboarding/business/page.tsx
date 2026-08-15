"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { setWorkspaces, setSelectedWorkspace } from "@/store/slices/authSlice";
import { useCreateWorkspaceMutation, useWorkspaces } from "@/hooks/queries/useWorkspaceQueries";
import { sourcesService } from "@/services/sourcesService";
import { useToast } from "@/components/ui/ToastProvider";
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
  const toast = useToast();

  const createWorkspaceMutation = useCreateWorkspaceMutation();
  const { data: existingWorkspaces = [], refetch: refetchWorkspaces } = useWorkspaces();

  const [businessName, setBusinessName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [industry, setIndustry] = useState("SaaS/Tech");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onboardingWs = existingWorkspaces.find((w) => w.status === "onboarding");
    if (onboardingWs && onboardingWs.business) {
      setBusinessName(onboardingWs.business.name || "");
      setWebsiteUrl(onboardingWs.business.website_url || "");
      setIndustry(onboardingWs.business.industry || "SaaS/Tech");
      setLogoUrl(onboardingWs.business.logo_url || null);
      setPreviewUrl(onboardingWs.business.logo_url || null);
    }
  }, [existingWorkspaces]);

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
      const sigData = await sourcesService.getCloudinarySignature();

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
      const msg = "Business name must be between 2 and 100 characters.";
      setError(msg);
      toast.error(msg);
      return;
    }

    if (!websiteUrl.trim()) {
      const msg = "Website URL is required.";
      setError(msg);
      toast.error(msg);
      return;
    }

    try {
      let finalLogoUrl = logoUrl;
      if (logoFile) {
        finalLogoUrl = await uploadLogoToCloudinary(logoFile);
      }

      const ws = await createWorkspaceMutation.mutateAsync({
        business_name: businessName.trim(),
        website_url: websiteUrl.trim(),
        industry: industry,
        logo_url: finalLogoUrl || undefined,
      });

      dispatch(setSelectedWorkspace(ws));

      const { data: freshWorkspaces } = await refetchWorkspaces();
      if (freshWorkspaces) {
        dispatch(setWorkspaces(freshWorkspaces));
      }

      toast.success("Business profile created! Proceeding to subscription selection...");
      router.push("/onboarding/subscription");
    } catch (err: any) {
      const msg = err.message || "Failed to create business workspace.";
      setError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col justify-between p-4 sm:p-8 animate-in fade-in duration-300">
      {/* Top Navigation */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-4 border-b border-[#1F1F1F]">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-[#D4AF37] via-[#F4D03F] to-[#FFEAA7] flex items-center justify-center shadow-lg shadow-[#D4AF37]/20">
            <Bot className="h-6 w-6 text-[#050505]" />
          </div>
          <span className="font-extrabold text-xl tracking-tight">
            Support<span className="text-[#D4AF37]">AI</span>
          </span>
        </div>
        <div className="text-xs font-semibold text-neutral-400">Step 1 of 2: Business Profile</div>
      </header>

      {/* Main Container */}
      <main className="max-w-xl mx-auto w-full my-8">
        <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-extrabold tracking-tight">Set up your business workspace</h1>
            <p className="text-xs text-neutral-400">
              Provide your business credentials to configure your dedicated AI support workspace.
            </p>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-2 flex items-center space-x-2">
                <Building2 className="h-4 w-4 text-[#D4AF37]" />
                <span>Business / Company Name *</span>
              </label>
              <input
                type="text"
                placeholder="Acme Corporation"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#050505] border border-[#222222] text-white placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-2 flex items-center space-x-2">
                <Globe className="h-4 w-4 text-[#D4AF37]" />
                <span>Website Domain URL *</span>
              </label>
              <input
                type="url"
                placeholder="https://acme.com"
                value={websiteUrl}
                onBlur={handleWebsiteBlur}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#050505] border border-[#222222] text-white placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-2 flex items-center space-x-2">
                <Sparkles className="h-4 w-4 text-[#D4AF37]" />
                <span>Industry Category</span>
              </label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#050505] border border-[#222222] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] transition-all"
              >
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
            </div>

            {/* Logo Upload */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-2">Company Brand Logo (Optional)</label>
              {previewUrl ? (
                <div className="relative w-24 h-24 rounded-xl border border-[#222222] bg-[#050505] p-2 flex items-center justify-center">
                  <img src={previewUrl} alt="Logo Preview" className="max-w-full max-h-full object-contain rounded" />
                  <button
                    type="button"
                    onClick={removeLogo}
                    className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label className="border-2 border-dashed border-[#222222] hover:border-[#D4AF37] transition-all rounded-xl p-4 text-center cursor-pointer bg-[#050505] flex items-center justify-center space-x-2">
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
                  <Upload className="h-4 w-4 text-[#D4AF37]" />
                  <span className="text-xs text-neutral-400">Upload logo image (PNG/JPG up to 2MB)</span>
                </label>
              )}
            </div>

            <button
              type="submit"
              disabled={createWorkspaceMutation.isPending || uploadingLogo}
              className="w-full flex items-center justify-center space-x-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#F4D03F] to-[#FFEAA7] text-[#050505] font-bold text-sm hover:brightness-110 transition-all shadow-lg shadow-[#D4AF37]/20 disabled:opacity-60"
            >
              {createWorkspaceMutation.isPending || uploadingLogo ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#050505]" />
              ) : (
                <>
                  <span>Next: Choose Plan</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      <footer className="max-w-4xl mx-auto w-full text-center text-xs text-neutral-500 py-4 border-t border-[#1F1F1F]">
        SupportAI Enterprise SaaS Platform &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
