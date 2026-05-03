"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, ArrowRight, RefreshCw, ChevronLeft, AlertCircle, CheckCircle } from "lucide-react";
import { authApi } from "@/lib/api";
import { setTokens } from "@/lib/auth";
import { BrandMark, useBranding } from "@/lib/branding";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";

type Step = "phone" | "otp";

const PARTICLES = [
  { id: 0,  x: 8,  y: 12, size: 4, duration: 8,  delay: 0,   opacity: 0.15 },
  { id: 1,  x: 22, y: 35, size: 3, duration: 10, delay: 1,   opacity: 0.12 },
  { id: 2,  x: 40, y: 8,  size: 5, duration: 7,  delay: 0.5, opacity: 0.22 },
  { id: 3,  x: 60, y: 18, size: 3, duration: 9,  delay: 2,   opacity: 0.10 },
  { id: 4,  x: 75, y: 40, size: 4, duration: 11, delay: 0.8, opacity: 0.18 },
  { id: 5,  x: 90, y: 10, size: 2, duration: 7,  delay: 3,   opacity: 0.08 },
  { id: 6,  x: 3,  y: 55, size: 3, duration: 9,  delay: 1.5, opacity: 0.14 },
  { id: 7,  x: 18, y: 72, size: 5, duration: 8,  delay: 0.3, opacity: 0.20 },
  { id: 8,  x: 35, y: 88, size: 3, duration: 6,  delay: 2.5, opacity: 0.11 },
  { id: 9,  x: 52, y: 62, size: 4, duration: 12, delay: 1,   opacity: 0.16 },
  { id: 10, x: 70, y: 80, size: 2, duration: 7,  delay: 3.5, opacity: 0.09 },
  { id: 11, x: 85, y: 58, size: 5, duration: 9,  delay: 0.7, opacity: 0.20 },
  { id: 12, x: 12, y: 90, size: 3, duration: 8,  delay: 2.2, opacity: 0.13 },
  { id: 13, x: 48, y: 45, size: 4, duration: 10, delay: 1.8, opacity: 0.17 },
  { id: 14, x: 65, y: 95, size: 3, duration: 6,  delay: 0.4, opacity: 0.12 },
  { id: 15, x: 95, y: 75, size: 2, duration: 7,  delay: 4,   opacity: 0.08 },
  { id: 16, x: 30, y: 50, size: 3, duration: 9,  delay: 1.2, opacity: 0.14 },
  { id: 17, x: 55, y: 30, size: 4, duration: 8,  delay: 2.8, opacity: 0.16 },
  { id: 18, x: 80, y: 20, size: 2, duration: 10, delay: 0.6, opacity: 0.10 },
  { id: 19, x: 44, y: 75, size: 5, duration: 7,  delay: 3.2, opacity: 0.19 },
];

function Particles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {PARTICLES.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-soraBlue"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            opacity: p.opacity,
          }}
          animate={{
            y: [0, -30, 0],
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

// OTP Input component
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
      // Handle paste
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
            ref={(el) => { inputsRef.current[index] = el; }}
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
              "bg-white/[0.04] text-white otp-input",
              "focus:outline-none focus:ring-0",
              value[index]
                ? "border-soraBlue bg-soraBlue/10 shadow-[0_0_15px_rgba(0,102,255,0.3)]"
                : "border-white/15 focus:border-soraBlue/60",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          />
        </motion.div>
      ))}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const { branding } = useBranding();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("+225");
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);

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

    const { data, error: err } = await authApi.requestOtp(phoneNum);

    setLoading(false);
    if (err) {
      setError(err);
      return;
    }

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

    const { data, error: err } = await authApi.verifyOtp(phone.trim(), code);

    setLoading(false);
    if (err || !data) {
      setError(err || "Code invalide");
      setOtp(Array(6).fill(""));
      return;
    }

    setTokens(data.accessToken, data.refreshToken);
    if (data.user) setUser(data.user);

    setSuccess("Connexion réussie ! Redirection...");
    setTimeout(() => router.push("/dashboard"), 800);
  };

  const handleResend = async () => {
    if (resendCountdown > 0) return;
    setError(null);
    setLoading(true);
    const { data, error: err } = await authApi.requestOtp(phone.trim());
    setLoading(false);
    if (err) { setError(err); return; }
    setSuccess(data?.debugCode ? `Nouveau code OTP de test : ${data.debugCode}` : "Nouveau code envoyé !");
    if (!data?.debugCode) setTimeout(() => setSuccess(null), 3000);
    setOtp(Array(6).fill(""));
    startResendCountdown();
  };

  return (
    <div className="min-h-screen bg-soraDark flex items-center justify-center relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-grid-pattern opacity-50" />
      <div className="absolute inset-0 bg-gradient-radial from-soraBlue/8 via-transparent to-transparent" />

      {/* Large glow orbs */}
      <motion.div
        className="absolute -top-40 -right-40 w-96 h-96 bg-soraBlue/10 rounded-full blur-3xl"
        animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.15, 0.1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl"
        animate={{ scale: [1, 1.15, 1], opacity: [0.08, 0.12, 0.08] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />

      <Particles />

      {/* Login card */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md mx-4"
      >
        {/* Card */}
        <div className="relative bg-white/[0.03] border border-white/[0.08] rounded-3xl backdrop-blur-xl shadow-2xl overflow-hidden">
          {/* Top gradient line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-soraBlue/60 to-transparent" />

          {/* Inner glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-soraBlue/[0.04] to-transparent rounded-3xl" />

          <div className="relative p-8">
            {/* Logo */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="flex flex-col items-center mb-8"
            >
              <div className="relative mb-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-soraBlue to-blue-700 flex items-center justify-center overflow-hidden shadow-glow-blue">
                  <BrandMark className="h-full w-full object-cover" />
                </div>
                {/* Spinning ring */}
                <motion.div
                  className="absolute -inset-1 rounded-2xl border border-soraBlue/30"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                  style={{ borderStyle: "dashed" }}
                />
              </div>
              <h1 className="text-2xl font-bold font-heading gradient-text">
                {branding.appName}
              </h1>
              <p className="text-gray-500 text-sm mt-1">{branding.slogan || "Panneau Super Administrateur"}</p>
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
                    {/* Phone input */}
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
                          "focus:border-soraBlue/50 focus:bg-soraBlue/[0.04] transition-all duration-200",
                          "text-sm font-medium"
                        )}
                      />
                    </div>

                    {/* Error */}
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

                    {/* Success */}
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

                    {/* CTA */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleRequestOtp}
                      disabled={loading}
                      className={cn(
                        "w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl",
                        "bg-soraBlue hover:bg-blue-500 active:bg-blue-700",
                        "text-white font-semibold text-sm",
                        "transition-all duration-200 shadow-glow-blue hover:shadow-[0_0_30px_rgba(0,102,255,0.5)]",
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
                    <OtpInput
                      value={otp}
                      onChange={setOtp}
                      disabled={loading}
                    />

                    {/* Error */}
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

                    {/* Verify button */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleVerifyOtp}
                      disabled={loading || otp.join("").length < 6}
                      className={cn(
                        "w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl",
                        "bg-soraBlue hover:bg-blue-500 active:bg-blue-700",
                        "text-white font-semibold text-sm",
                        "transition-all duration-200 shadow-glow-blue",
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

                    {/* Actions row */}
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
                            : "text-soraBlue hover:text-blue-400"
                        )}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        {resendCountdown > 0
                          ? `Renvoyer (${resendCountdown}s)`
                          : "Renvoyer le code"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-xs text-gray-600 mt-6"
        >
          Accès réservé aux administrateurs autorisés · {branding.appName} &copy; 2026 · Support {branding.supportEmail} · {branding.supportPhone}
        </motion.p>
      </motion.div>
    </div>
  );
}
