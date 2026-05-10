"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle, Clock, LogIn, LogOut, RefreshCw, Save, Settings2, UserCheck, Users } from "lucide-react";
import { schoolApi, type StaffAttendance, type StaffAttendanceSettings, type StaffAttendanceStatus, type StaffMember } from "@/lib/school-api";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

const STATUS_LABELS: Record<StaffAttendanceStatus, string> = {
  PRESENT: "Présent",
  LATE: "Retard",
  ABSENT: "Absent",
  EARLY_DEPARTURE: "Départ anticipé",
  NOT_CHECKED_IN: "Non pointé",
  OFF_SCHEDULE_JUSTIFIED: "Hors planning justifié",
};

function time(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function statusClass(status: StaffAttendanceStatus) {
  if (status === "PRESENT") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  if (status === "OFF_SCHEDULE_JUSTIFIED") return "border-sky-500/25 bg-sky-500/10 text-sky-300";
  if (status === "LATE" || status === "EARLY_DEPARTURE") return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  if (status === "ABSENT") return "border-red-500/25 bg-red-500/10 text-red-300";
  return "border-gray-500/25 bg-gray-500/10 text-gray-300";
}

export default function PointagePersonnelPage() {
  const [records, setRecords] = useState<StaffAttendance[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [settings, setSettings] = useState<StaffAttendanceSettings | null>(null);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [status, setStatus] = useState<StaffAttendanceStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [manualReason, setManualReason] = useState("Correction / présence validée par la Direction");
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [attendanceRes, staffRes, settingsRes] = await Promise.all([
      schoolApi.staffAttendance({ staffId: selectedStaff || undefined, status: status || undefined }),
      schoolApi.staff(),
      schoolApi.staffSettings(),
    ]);
    if (attendanceRes.data?.records) setRecords(attendanceRes.data.records);
    if (staffRes.data?.staff) setStaff(staffRes.data.staff);
    if (settingsRes.data?.settings) setSettings(settingsRes.data.settings);
    if (attendanceRes.error) setMessage({ type: "err", text: attendanceRes.error });
    setLoading(false);
  }, [selectedStaff, status]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => ({
    total: records.length,
    present: records.filter((r) => r.status === "PRESENT").length,
    late: records.filter((r) => r.status === "LATE").length,
    absent: records.filter((r) => r.status === "ABSENT").length,
    penalties: records.reduce((sum, r) => sum + (r.penaltyApplied ? r.penaltyAmount : 0), 0),
  }), [records]);

  const updateSettings = async () => {
    if (!settings) return;
    setSaving(true);
    const { error } = await schoolApi.updateStaffSettings({
      defaultCheckInTime: settings.defaultCheckInTime,
      defaultCheckOutTime: settings.defaultCheckOutTime,
      lateToleranceMinutes: Number(settings.lateToleranceMinutes),
      earlyDepartureToleranceMinutes: Number(settings.earlyDepartureToleranceMinutes),
      latePenaltyAmount: Number(settings.latePenaltyAmount),
      absencePenaltyAmount: Number(settings.absencePenaltyAmount),
      justificationDeadlineHours: Number(settings.justificationDeadlineHours),
      autoApplyPenalties: settings.autoApplyPenalties,
    });
    setSaving(false);
    setMessage(error ? { type: "err", text: error } : { type: "ok", text: "Paramètres RH sauvegardés." });
  };

  const detectAbsences = async () => {
    setSaving(true);
    const { data, error } = await schoolApi.detectStaffAbsences();
    setSaving(false);
    setMessage(error ? { type: "err", text: error } : { type: "ok", text: `${data?.created.length ?? 0} absence(s) détectée(s).` });
    load();
  };

  const manualScan = async (staffId: string) => {
    setSaving(true);
    const { data, error } = await schoolApi.scanStaffAttendance(staffId, manualReason);
    setSaving(false);
    setMessage(error ? { type: "err", text: error } : { type: "ok", text: data?.message ?? "Pointage enregistré." });
    load();
  };

  return (
    <div className="min-h-screen bg-soraDark text-white">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-500/15 p-2.5"><Clock className="h-6 w-6 text-blue-300" /></div>
            <div>
              <h1 className="font-heading text-2xl font-bold">Pointage du personnel</h1>
              <p className="text-sm text-gray-400">Arrivées, départs, retards, absences et pénalités selon l'emploi du temps ou les horaires RH.</p>
            </div>
          </div>
          <button disabled={saving} onClick={detectAbsences} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-60">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />} Détecter les absences
          </button>
        </div>

        {message && (
          <div className={cn("flex items-center gap-2 rounded-xl border p-3 text-sm", message.type === "ok" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "border-red-500/25 bg-red-500/10 text-red-300")}>
            {message.type === "ok" ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />} {message.text}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-5">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"><Users className="h-5 w-5 text-gray-400" /><p className="mt-2 text-2xl font-bold">{stats.total}</p><p className="text-xs text-gray-500">Pointages</p></div>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"><UserCheck className="h-5 w-5 text-emerald-300" /><p className="mt-2 text-2xl font-bold text-emerald-300">{stats.present}</p><p className="text-xs text-gray-500">Présents</p></div>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"><Clock className="h-5 w-5 text-amber-300" /><p className="mt-2 text-2xl font-bold text-amber-300">{stats.late}</p><p className="text-xs text-gray-500">Retards</p></div>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"><AlertTriangle className="h-5 w-5 text-red-300" /><p className="mt-2 text-2xl font-bold text-red-300">{stats.absent}</p><p className="text-xs text-gray-500">Absences</p></div>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"><p className="text-xs text-gray-500">Pénalités appliquées</p><p className="mt-2 text-2xl font-bold">{formatCurrency(stats.penalties)}</p></div>
        </div>

        {settings && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <div className="mb-4 flex items-center gap-2"><Settings2 className="h-4 w-4 text-gray-400" /><h2 className="font-semibold">Règles RH de pointage</h2></div>
            <div className="grid gap-3 md:grid-cols-4">
              <label className="text-xs text-gray-400">Entrée officielle<input type="time" value={settings.defaultCheckInTime} onChange={(e) => setSettings({ ...settings, defaultCheckInTime: e.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white" /></label>
              <label className="text-xs text-gray-400">Sortie officielle<input type="time" value={settings.defaultCheckOutTime} onChange={(e) => setSettings({ ...settings, defaultCheckOutTime: e.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white" /></label>
              <label className="text-xs text-gray-400">Marge retard (min)<input type="number" value={settings.lateToleranceMinutes} onChange={(e) => setSettings({ ...settings, lateToleranceMinutes: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white" /></label>
              <label className="text-xs text-gray-400">Délai justification (h)<input type="number" value={settings.justificationDeadlineHours} onChange={(e) => setSettings({ ...settings, justificationDeadlineHours: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white" /></label>
              <label className="text-xs text-gray-400">Pénalité retard<input type="number" value={settings.latePenaltyAmount} onChange={(e) => setSettings({ ...settings, latePenaltyAmount: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white" /></label>
              <label className="text-xs text-gray-400">Pénalité absence<input type="number" value={settings.absencePenaltyAmount} onChange={(e) => setSettings({ ...settings, absencePenaltyAmount: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white" /></label>
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-gray-300 md:col-span-2"><input type="checkbox" checked={settings.autoApplyPenalties} onChange={(e) => setSettings({ ...settings, autoApplyPenalties: e.target.checked })} /> Appliquer automatiquement après détection/refus</label>
            </div>
            <button disabled={saving} onClick={updateSettings} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60">
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Sauvegarder les règles
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 md:flex-row">
          <select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white [&>option]:bg-soraCard">
            <option value="">Tout le personnel</option>
            {staff.map((member) => <option key={member.id} value={member.id}>{member.firstName} {member.lastName}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as StaffAttendanceStatus | "")} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white [&>option]:bg-soraCard">
            <option value="">Tous les statuts</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-200 transition hover:bg-white/10"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Actualiser</button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
            <div className="grid grid-cols-[1.2fr_110px_110px_150px_1fr_1fr] gap-3 border-b border-white/[0.07] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <span>Personnel</span><span>Entrée</span><span>Sortie</span><span>Statut</span><span>Planning</span><span>Justification / pénalité</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-14 text-sm text-gray-400"><RefreshCw className="h-4 w-4 animate-spin" /> Chargement...</div>
            ) : records.length === 0 ? (
              <div className="py-14 text-center text-sm text-gray-500">Aucun pointage pour ces filtres.</div>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {records.map((record) => (
                  <div key={record.id} className="grid grid-cols-[1.2fr_110px_110px_150px_1fr_1fr] items-center gap-3 px-5 py-4 text-sm">
                    <div><p className="font-medium">{record.staff ? `${record.staff.firstName} ${record.staff.lastName}` : record.staffId}</p><p className="text-xs text-gray-500">{formatDate(record.date)}</p></div>
                    <span className="inline-flex items-center gap-1 text-emerald-300"><LogIn className="h-3.5 w-3.5" /> {time(record.actualCheckInAt)}</span>
                    <span className="inline-flex items-center gap-1 text-blue-300"><LogOut className="h-3.5 w-3.5" /> {record.actualCheckOutAt ? time(record.actualCheckOutAt) : "Sortie non encore pointée"}</span>
                    <span className={cn("rounded-full border px-2 py-1 text-xs", statusClass(record.status))}>{STATUS_LABELS[record.status]}</span>
                    <p className="text-xs text-gray-400">{record.scheduleSlotId ? `Cours lié : ${record.scheduleSlotId.slice(0, 8)}…` : record.noScheduleReason ? "Hors planning justifié" : "Planning administratif"}</p>
                    <p className="text-xs text-gray-400">{record.noScheduleReason || record.justificationStatus} · {record.penaltyApplied ? formatCurrency(record.penaltyAmount) : "pénalité non appliquée"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <h2 className="mb-3 font-semibold">Correction Directeur</h2>
            <p className="mb-4 text-xs text-gray-500">Le pointage manuel est réservé à la Direction et passe par l'idempotence backend.</p>
            <textarea
              value={manualReason}
              onChange={(event) => setManualReason(event.target.value)}
              className="mb-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white outline-none"
              rows={3}
              placeholder="Justification si aucun cours n’est programmé"
            />
            <div className="space-y-2">
              {staff.slice(0, 8).map((member) => (
                <button key={member.id} disabled={saving} onClick={() => manualScan(member.id)} className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-sm transition hover:bg-white/10 disabled:opacity-60">
                  <span>{member.firstName} {member.lastName}</span>
                  <Clock className="h-4 w-4 text-blue-300" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
