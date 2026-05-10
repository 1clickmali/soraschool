"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle, Clock, FileUp, RefreshCw, Send } from "lucide-react";
import { schoolApi, type StaffAttendance, type StaffJustification } from "@/lib/school-api";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

export default function TeacherJustificationsPage() {
  const [records, setRecords] = useState<StaffAttendance[]>([]);
  const [justifications, setJustifications] = useState<StaffJustification[]>([]);
  const [selectedAttendanceId, setSelectedAttendanceId] = useState("");
  const [reason, setReason] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const [attendanceRes, justificationsRes] = await Promise.all([schoolApi.staffAttendanceMe(), schoolApi.staffJustificationsMe()]);
    if (attendanceRes.data?.records) setRecords(attendanceRes.data.records);
    if (justificationsRes.data?.justifications) setJustifications(justificationsRes.data.justifications);
    if (attendanceRes.error || justificationsRes.error) setMessage({ type: "err", text: attendanceRes.error || justificationsRes.error || "Erreur" });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const justifiableRecords = useMemo(() => records.filter((record) => ["LATE", "ABSENT", "EARLY_DEPARTURE"].includes(record.status)), [records]);

  const submit = async () => {
    if (!selectedAttendanceId || reason.length < 3) {
      setMessage({ type: "err", text: "Sélectionnez un retard/absence et expliquez la justification." });
      return;
    }
    setSaving(true);
    const { error } = await schoolApi.submitStaffJustification({ attendanceId: selectedAttendanceId, reason, attachmentUrl: attachmentUrl || undefined });
    setSaving(false);
    setMessage(error ? { type: "err", text: error } : { type: "ok", text: "Justification envoyée à la Direction." });
    if (!error) {
      setReason("");
      setAttachmentUrl("");
      setSelectedAttendanceId("");
      load();
    }
  };

  return (
    <div className="min-h-screen bg-soraDark pb-24 text-white">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-amber-500/15 p-2.5"><FileUp className="h-6 w-6 text-amber-300" /></div>
          <div>
            <h1 className="font-heading text-2xl font-bold">Mes justifications</h1>
            <p className="text-sm text-gray-400">Envoyez une explication ou un lien justificatif. Seul le Directeur valide.</p>
          </div>
        </div>

        {message && (
          <div className={cn("flex items-center gap-2 rounded-xl border p-3 text-sm", message.type === "ok" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "border-red-500/25 bg-red-500/10 text-red-300")}>
            {message.type === "ok" ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />} {message.text}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <h2 className="mb-4 font-semibold">Nouvelle justification</h2>
            <div className="space-y-3">
              <select value={selectedAttendanceId} onChange={(e) => setSelectedAttendanceId(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white [&>option]:bg-soraCard">
                <option value="">Sélectionner un événement</option>
                {justifiableRecords.map((record) => <option key={record.id} value={record.id}>{formatDate(record.date)} · {record.status} · {formatCurrency(record.penaltyAmount)}</option>)}
              </select>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Expliquez la raison..." className="h-28 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none" />
              <input value={attachmentUrl} onChange={(e) => setAttachmentUrl(e.target.value)} placeholder="Lien photo/PDF justificatif si disponible" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none" />
              <button disabled={saving} onClick={submit} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:opacity-60">
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">Retards / absences</h2>
                <button onClick={load} className="rounded-xl border border-white/10 p-2 text-gray-300 transition hover:bg-white/10"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></button>
              </div>
              {loading ? <div className="py-8 text-center text-sm text-gray-500">Chargement...</div> : justifiableRecords.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500">Aucun événement à justifier.</div>
              ) : justifiableRecords.map((record) => (
                <div key={record.id} className="mb-2 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.025] p-3 text-sm">
                  <span><Clock className="mr-2 inline h-4 w-4 text-amber-300" /> {formatDate(record.date)} · {record.status}</span>
                  <span className="text-xs text-gray-400">{record.justificationStatus} · {formatCurrency(record.penaltyAmount)}</span>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
              <h2 className="mb-4 font-semibold">Historique des justifications</h2>
              {justifications.length === 0 ? <div className="py-8 text-center text-sm text-gray-500">Aucune justification envoyée.</div> : justifications.map((item) => (
                <div key={item.id} className="mb-2 rounded-xl border border-white/10 bg-white/[0.025] p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <strong>{item.status}</strong>
                    <span className="text-xs text-gray-500">{formatDate(item.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-gray-300">{item.reason}</p>
                  {item.directorComment && <p className="mt-2 text-xs text-blue-300">Direction : {item.directorComment}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
