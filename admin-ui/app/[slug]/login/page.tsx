"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone,
  ArrowRight,
  RefreshCw,
  ChevronLeft,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  GraduationCap,
} from "lucide-react";
import { schoolAuthApi, type SchoolInstitution } from "@/lib/school-api";
import { setSchoolTokens, setCurrentSchoolSlug } from "@/lib/school-auth";
import { useBranding } from "@/lib/branding";
import { cn } from "@/lib/utils";
import Link from "next/link";

type Step = "phone" | "otp";

// Fixed positions — no Math.random() to avoid hydration mismatch
const PARTICLES = [
  { id: 0,  x: 12,  y: 8,  size: 4, duration: 7,  delay: 0,   opacity: 0.15 },
  { id: 1,  x: 28,  y: 22, size: 3, duration: 9,  delay: 1.2, opacity: 0.12 },
  { id: 2,  x: 45,  y: 5,  size: 5, duration: 6,  delay: 0.5, opacity: 0.20 },
  { id: 3,  x: 67,  y: 15, size: 3, duration: 8,  delay: 2,   opacity: 0.10 },
  { id: 4,  x: 82,  y: 30, size: 4, duration: 10, delay: 0.8, opacity: 0.18 },
  { id: 5,  x: 93,  y: 7,  size: 2, duration: 7,  delay: 3,   opacity: 0.08 },
  { id: 6,  x: 5,   y: 50, size: 3, duration: 9,  delay: 1.5, opacity: 0.14 },
  { id: 7,  x: 20,  y: 70, size: 5, duration: 8,  delay: 0.3, opacity: 0.22 },
  { id: 8,  x: 38,  y: 85, size: 3, duration: 6,  delay: 2.5, opacity: 0.11 },
  { id: 9,  x: 55,  y: 60, size: 4, duration: 11, delay: 1,   opacity: 0.16 },
  { id: 10, x: 72,  y: 78, size: 2, duration: 7,  delay: 3.5, opacity: 0.09 },
  { id: 11, x: 88,  y: 55, size: 5, duration: 9,  delay: 0.7, opacity: 0.20 },
  { id: 12, x: 15,  y: 92, size: 3, duration: 8,  delay: 2.2, opacity: 0.13 },
  { id: 13, x: 50,  y: 40, size: 4, duration: 10, delay: 1.8, opacity: 0.17 },
  { id: 14, x: 78,  y: 90, size: 3, duration: 6,  delay: 0.4, opacity: 0.12 },
  { id: 15, x: 96,  y: 70, size: 2, duration: 7,  delay: 4,   opacity: 0.08 },
];

function Particles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {PARTICLES.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-emerald-500"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            opacity: p.opacity,
          }}
          animate={{
            y: [0, -28, 0],
            opacity: [p.opacity, p.opacity * 2, p.opacity],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

function OtpInput({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, char: string) => {
    const newValue = [...value];
    if (char.length > 1) {
      const digits = char.replace(/\D/g, "").split("").slice(0, 6);
      const filled = [...Array(6)].map((_, i) => digits[i] || "");
      onChange(filled);
      const nextFocus = Math.min(digits.length, 5);
      inputsRef.current[nextFocus]?.focus();
      return;
    }
    if (/^\d$/.test(char)) {
      newValue[index] = char;
      onChange(newValue);
      if (index < 5) inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace") {
      const newValue = [...value];
      if (newValue[index]) {
        newValue[index] = "";
        onChange(newValue);
      } else if (index > 0) {
        inputsRef.current[index - 1]?.focus();
        newValue[index - 1] = "";
        onChange(newValue);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  return (
    <div className="flex gap-3 justify-center">
      {Array.from({ length: 6 }).map((_, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05, duration: 0.3 }}
        >
          <input
            ref={(el) => {
              inputsRef.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={value[index] || ""}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onFocus={(e) => e.target.select()}
            disabled={disabled}
            className={cn(
              "w-12 h-14 text-center text-xl font-bold rounded-xl border-2 transition-all duration-200",
              "bg-white/[0.04] text-white",
              "focus:outline-none focus:ring-0",
              value[index]
                ? "border-emerald-500 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                : "border-white/15 focus:border-emerald-500/60",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          />
        </motion.div>
      ))}
    </div>
  );
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 3);
}

export default function SchoolLoginPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const { branding } = useBranding();

  const [institution, setInstitution] = useState<SchoolInstitution | null>(null);
  const [loadingInstitution, setLoadingInstitution] = useState(true);

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("+225");
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    if (!slug) return;
    schoolAuthApi.getInstitutionBySlug(slug).then(({ data }) => {
      if (data?.institution) setInstitution(data.institution);
      setLoadingInstitution(false);
    }).catch(() => setLoadingInstitution(false));
  }, [slug]);

  const startResendCountdown = useCallback(() => {
    setResendCountdown(60);
    const interval = setInterval(() => {
      setResendCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, []);

  const handleRequestOtp = async () => {
    const phoneNum = phone.trim();
    if (!phoneNum || phoneNum.length < 8) {
      setError("Veuillez saisir un numéro de téléphone valide");
      return;
    }
    setError(null);
    setLoading(true);
    const { data, error: err } = await schoolAuthApi.requestOtp(phoneNum, slug);
    setLoading(false);
    if (err) { setError(err); return; }
    setSuccess(data?.debugCode ? `Code OTP de test : ${data.debugCode}` : "Code OTP envoyé !");
    if (!data?.debugCode) setTimeout(() => setSuccess(null), 3000);
    setStep("otp");
    startResendCountdown();
  };

  const handleVerifyOtp = async () => {
    const code = otp.join("");
    if (code.length !== 6) {
      setError("Veuillez saisir les 6 chiffres du code");
      return;
    }
    setError(null);
    setLoading(true);
    const { data, error: err } = await schoolAuthApi.verifyOtp(phone.trim(), code, slug);
    setLoading(false);
    if (err || !data) {
      setError(err || "Code invalide");
      setOtp(Array(6).fill(""));
      return;
    }
    setSchoolTokens(data.accessToken, data.refreshToken);
    setCurrentSchoolSlug(slug);
    setSuccess("Connexion réussie ! Redirection...");
    const nextPath =
      data.user.role === "PARENT"
        ? `/${slug}/parent/dashboard`
        : data.user.role === "TEACHER"
          ? `/${slug}/teacher/dashboard`
          : data.user.role === "STUDENT"
            ? `/${slug}/student/dashboard`
            : `/${slug}/dashboard`;
    setTimeout(() => router.push(nextPath), 800);
  };

  const handleResend = async () => {
    if (resendCountdown > 0) return;
    setError(null);
    setLoading(true);
    const { data, error: err } = await schoolAuthApi.requestOtp(phone.trim(), slug);
    setLoading(false);
    if (err) { setError(err); return; }
    setSuccess(data?.debugCode ? `Nouveau code OTP de test : ${data.debugCode}` : "Nouveau code envoyé !");
    if (!data?.debugCode) setTimeout(() => setSuccess(null), 3000);
    setOtp(Array(6).fill(""));
    startResendCountdown();
  };

  const schoolName = institution?.name || (loadingInstitution ? "Chargement..." : slug.toUpperCase());
  const initials = institution?.name ? getInitials(institution.name) : slug.slice(0, 3).toUpperCase();

  return (
    <div className="min-h-screen bg-soraDark flex items-center justify-center relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-50" />
      <div className="absolute inset-0 bg-gradient-radial from-emerald-500/6 via-transparent to-transparent" />

      {/* Glow orbs */}
      <motion.div
        className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/8 rounded-full blur-3xl"
        animate={{ scale: [1, 1.1, 1], opacity: [0.08, 0.14, 0.08] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-700/8 rounded-full blur-3xl"
        animate={{ scale: [1, 1.15, 1], opacity: [0.06, 0.1, 0.06] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />

      <Particles />

      {/* Back link */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="absolute top-6 left-6"
      >
        <Link
          href="/login"
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Retour admin
        </Link>
      </motion.div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md mx-4"
      >
        <div className="relative bg-white/[0.03] border border-white/[0.08] rounded-3xl backdrop-blur-xl shadow-2xl overflow-hidden">
          {/* Top gradient line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />
          {/* Inner glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.03] to-transparent rounded-3xl" />

          <div className="relative p-8">
            {/* Institution header */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="flex flex-col items-center mb-8"
            >
              {/* Logo / Initials */}
              <div className="relative mb-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                  {institution?.logo ? (
                    <img src={institution.logo} alt={schoolName} className="w-full h-full object-cover rounded-2xl" />
                  ) : (
                    <span className="text-white font-bold text-lg font-heading">
                      {initials}
                    </span>
                  )}
                </div>
                <motion.div
                  className="absolute -inset-1 rounded-2xl border border-emerald-500/30"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                  style={{ borderStyle: "dashed" }}
                />
              </div>
              <h1 className="text-xl font-bold font-heading text-white text-center leading-tight">
                {schoolName}
              </h1>
              <div className="flex items-center gap-1.5 mt-2">
                <GraduationCap className="w-3.5 h-3.5 text-emerald-500" />
                <p className="text-emerald-500/80 text-xs font-medium">Portail Établissement</p>
              </div>
              {institution?.status && (
                <span className={cn(
                  "mt-2 text-xs px-2.5 py-0.5 rounded-full border font-medium",
                  institution.status === "ACTIVE"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                )}>
                  {institution.status === "ACTIVE" ? "Actif" : "Période d'essai"}
                </span>
              )}
            </motion.div>

            {/* Step content */}
            <AnimatePresence mode="wait">
              {step === "phone" ? (
                <motion.div
                  key="phone"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="text-center mb-6">
                    <h2 className="text-lg font-semibold font-heading text-white">
                      Connexion sécurisée
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">
                      Entrez votre numéro pour recevoir un code OTP
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-500" />
                        <div className="w-px h-5 bg-white/10" />
                      </div>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleRequestOtp()}
                        placeholder="+225 07 00 00 00 01"
                        className={cn(
                          "w-full bg-white/[0.04] border border-white/10 rounded-xl",
                          "pl-16 pr-4 py-3.5 text-white placeholder:text-gray-600",
                          "focus:border-emerald-500/50 focus:bg-emerald-500/[0.03] transition-all duration-200",
                          "text-sm font-medium"
                        )}
                      />
                    </div>

                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5"
                        >
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          {error}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <AnimatePresence>
                      {success && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5"
                        >
                          <CheckCircle className="w-4 h-4 flex-shrink-0" />
                          {success}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleRequestOtp}
                      disabled={loading}
                      className={cn(
                        "w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl",
                        "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700",
                        "text-white font-semibold text-sm",
                        "transition-all duration-200 shadow-[0_0_20px_rgba(16,185,129,0.3)]",
                        "hover:shadow-[0_0_30px_rgba(16,185,129,0.45)]",
                        "disabled:opacity-60 disabled:cursor-not-allowed"
                      )}
                    >
                      {loading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          Recevoir le code OTP
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </motion.button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="otp"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="text-center mb-6">
                    <h2 className="text-lg font-semibold font-heading text-white">
                      Vérification OTP
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">
                      Code envoyé au{" "}
                      <span className="text-white font-medium">{phone}</span>
                    </p>
                  </div>

                  <div className="space-y-6">
                    <OtpInput value={otp} onChange={setOtp} disabled={loading} />

                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5"
                        >
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          {error}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <AnimatePresence>
                      {success && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5"
                        >
                          <CheckCircle className="w-4 h-4 flex-shrink-0" />
                          {success}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleVerifyOtp}
                      disabled={loading || otp.join("").length < 6}
                      className={cn(
                        "w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl",
                        "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700",
                        "text-white font-semibold text-sm",
                        "transition-all duration-200 shadow-[0_0_20px_rgba(16,185,129,0.3)]",
                        "disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
                      )}
                    >
                      {loading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          Vérifier et se connecter
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </motion.button>

                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => {
                          setStep("phone");
                          setError(null);
                          setOtp(Array(6).fill(""));
                        }}
                        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Retour
                      </button>
                      <button
                        onClick={handleResend}
                        disabled={resendCountdown > 0 || loading}
                        className={cn(
                          "flex items-center gap-1.5 text-sm transition-colors",
                          resendCountdown > 0
                            ? "text-gray-600 cursor-not-allowed"
                            : "text-emerald-500 hover:text-emerald-400"
                        )}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        {resendCountdown > 0 ? `Renvoyer (${resendCountdown}s)` : "Renvoyer le code"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-xs text-gray-600 mt-6 px-4"
        >
          Votre numéro doit être autorisé par l&apos;administration &middot; {branding.appName} &copy; 2026 · Support {branding.supportEmail} · {branding.supportPhone}
        </motion.p>
      </motion.div>
    </div>
  );
}
