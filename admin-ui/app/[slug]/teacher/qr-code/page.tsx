"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AlertTriangle, Copy, QrCode, RefreshCw, ShieldCheck } from "lucide-react";
import { schoolApi, type StaffMember } from "@/lib/school-api";
import { cn } from "@/lib/utils";

export default function TeacherQrCodePage() {
  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [qrPayload, setQrPayload] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await schoolApi.staffMeQr();
    setStaff(data?.staff ?? null);
    setQrPayload(data?.qrPayload ?? "");
    setQrDataUrl(data?.qrDataUrl ?? "");
    setMessage(error ? { type: "err", text: error } : null);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const copy = async () => {
    await navigator.clipboard.writeText(qrPayload);
    setMessage({ type: "ok", text: "QR copié. À utiliser seulement pour dépannage interne." });
  };

  return (
    <div className="min-h-screen bg-soraDark pb-24 text-white">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-sky-500/15 p-2.5"><QrCode className="h-6 w-6 text-sky-300" /></div>
          <div>
            <h1 className="font-heading text-2xl font-bold">Mon QR code</h1>
            <p className="text-sm text-gray-400">QR sécurisé de pointage. Il est unique à votre école et peut être régénéré par la Direction.</p>
          </div>
        </div>

        {message && (
          <div className={cn("flex items-center gap-2 rounded-xl border p-3 text-sm", message.type === "ok" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "border-red-500/25 bg-red-500/10 text-red-300")}>
            {message.type === "ok" ? <ShieldCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />} {message.text}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] py-16 text-sm text-gray-400"><RefreshCw className="h-4 w-4 animate-spin" /> Chargement...</div>
        ) : (
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6">
            <div className="flex flex-col items-center gap-5 text-center">
              <div className="rounded-3xl border border-white/10 bg-white p-4">
                {qrDataUrl ? <Image src={qrDataUrl} alt="QR personnel" width={256} height={256} unoptimized className="h-64 w-64" /> : <QrCode className="h-64 w-64 text-slate-900" />}
              </div>
              <div>
                <p className="text-xl font-bold">{staff?.firstName} {staff?.lastName}</p>
                <p className="text-sm text-gray-400">{staff?.matricule} · QR v{staff?.qrTokenVersion}</p>
              </div>
              <textarea readOnly value={qrPayload} className="h-24 w-full rounded-xl border border-white/10 bg-black/20 p-3 font-mono text-xs text-gray-300 outline-none" />
              <button onClick={copy} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white transition hover:bg-white/10">
                <Copy className="h-4 w-4" /> Copier
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
