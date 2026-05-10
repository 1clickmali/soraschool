"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Calendar, CheckCircle, Clock, LogIn, LogOut, RefreshCw } from "lucide-react";
import { schoolApi, type StaffAttendance } from "@/lib/school-api";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

function formatTime(dateStr?: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function todayKey() {
  return new Date().toISOString().split("T")[0];
}

export default function TeacherPointagePage() {
  const [records, setRecords] = useState<StaffAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [noScheduleReason, setNoScheduleReason] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await schoolApi.staffAttendanceMe();
    if (data?.records) setRecords(data.records);
    if (error) setMsg({ type: "err", text: error });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const today = useMemo(() => records.find((record) => record.date.startsWith(todayKey())) ?? null, [records]);
  const eventsToJustify = records.filter((record) => ["LATE", "ABSENT", "EARLY_DEPARTURE"].includes(record.status) && record.justificationStatus !== "ACCEPTED");

  const point = async () => {
    setActionLoading(true);
    setMsg(null);
    const { data, error } = await schoolApi.scanStaffAttendance(undefined, noScheduleReason);
    setActionLoading(false);
    setMsg(error ? { type: "err", text: error } : { type: "ok", text: data?.message ?? "Pointage enregistré." });
    load();
  };

  const now = new Date();
  const todayLabel = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="min-h-screen bg-soraDark pb-24 text-white">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-blue-500/15 p-2.5"><Clock className="h-6 w-6 text-blue-300" /></div>
          <div>
            <h1 className="font-heading text-2xl font-bold">Mon pointage</h1>
            <p className="text-sm capitalize text-gray-400">{todayLabel}</p>
          </div>
        </div>

        {msg && (
          <div className={cn("flex items-center gap-2 rounded-xl border p-3 text-sm", msg.type === "ok" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "border-red-500/25 bg-red-500/10 text-red-300")}>
            {msg.type === "ok" ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />} {msg.text}
          </div>
        )}

        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-500">Aujourd'hui</p>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center">
              <LogIn className="mx-auto mb-2 h-5 w-5 text-emerald-300" />
              <p className="text-2xl font-bold text-emerald-300">{formatTime(today?.actualCheckInAt)}</p>
              <p className="text-xs text-gray-500">Arrivée</p>
            </div>
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-center">
              <LogOut className="mx-auto mb-2 h-5 w-5 text-blue-300" />
              <p className="text-2xl font-bold text-blue-300">{formatTime(today?.actualCheckOutAt)}</p>
              <p className="text-xs text-gray-500">Départ</p>
            </div>
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-center">
              <AlertTriangle className="mx-auto mb-2 h-5 w-5 text-amber-300" />
              <p className="text-2xl font-bold text-amber-300">{today?.lateMinutes ?? 0} min</p>
              <p className="text-xs text-gray-500">Retard</p>
            </div>
          </div>

          <button disabled={actionLoading || !!today?.actualCheckOutAt} onClick={point} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-base font-bold text-white transition hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-400">
            {actionLoading ? <RefreshCw className="h-5 w-5 animate-spin" /> : today?.actualCheckInAt ? <LogOut className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
            {today?.actualCheckOutAt ? "Pointage complet aujourd'hui" : today?.actualCheckInAt ? "Pointer le départ" : "Pointer l'arrivée"}
          </button>
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Justification si aucun cours n’est programmé
            </label>
            <textarea
              value={noScheduleReason}
              onChange={(event) => setNoScheduleReason(event.target.value)}
              rows={3}
              placeholder="Ex : réunion avec la Direction, remplacement, préparation de cours..."
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none"
            />
            <p className="mt-2 text-xs text-gray-500">Sans emploi du temps, le pointage est refusé si cette justification est vide.</p>
          </div>
        </div>

        {eventsToJustify.length > 0 && (
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
            <div className="flex items-center gap-2 font-semibold text-amber-200"><AlertTriangle className="h-4 w-4" /> Justification requise</div>
            <p className="mt-2 text-sm text-amber-100/80">{eventsToJustify.length} événement(s) peuvent entraîner une pénalité. Envoyez une justification depuis “Mes justifications”.</p>
          </div>
        )}

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03]">
          <div className="flex items-center gap-2 border-b border-white/[0.07] px-5 py-4"><Calendar className="h-4 w-4 text-gray-400" /><span className="text-sm font-semibold text-gray-300">Historique récent</span></div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400"><RefreshCw className="h-4 w-4 animate-spin" /> Chargement...</div>
          ) : records.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">Aucun pointage.</div>
          ) : records.map((record) => (
            <div key={record.id} className="flex items-center justify-between border-b border-white/[0.05] px-5 py-3 text-sm last:border-b-0">
              <div>
                <p className="font-medium">{formatDate(record.date)}</p>
                <p className="text-xs text-gray-500">{record.status} · {record.noScheduleReason || record.justificationStatus}</p>
              </div>
              <div className="text-right text-xs text-gray-400">
                <p>{formatTime(record.actualCheckInAt)} → {formatTime(record.actualCheckOutAt)}</p>
                <p>{record.penaltyAmount ? formatCurrency(record.penaltyAmount) : "Aucune pénalité"}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
