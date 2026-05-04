"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckSquare,
  Users,
  AlertCircle,
  Clock,
  FileCheck,
  Download,
  BookOpen,
  ChevronLeft,
  CalendarX,
  Check,
  X,
  CheckCircle,
  RefreshCw,
} from "lucide-react";
import {
  downloadProtectedFile,
  schoolApi,
  type Student,
  type AttendanceSlot,
  type TeacherAttendanceRecord,
} from "@/lib/school-api";
import { cn } from "@/lib/utils";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

interface AttendanceRow {
  studentId: string;
  firstName: string;
  lastName: string;
  matricule?: string;
  status: AttendanceStatus;
  reason: string;
}

const STATUS_OPTIONS: {
  value: AttendanceStatus;
  label: string;
  icon: React.ElementType;
  activeColor: string;
}[] = [
  { value: "PRESENT", label: "Présent", icon: Check, activeColor: "text-emerald-400 border-emerald-500/40 bg-emerald-500/15" },
  { value: "ABSENT", label: "Absent", icon: X, activeColor: "text-red-400 border-red-500/40 bg-red-500/15" },
  { value: "LATE", label: "Retard", icon: Clock, activeColor: "text-amber-400 border-amber-500/40 bg-amber-500/15" },
  { value: "EXCUSED", label: "Justifié", icon: CheckCircle, activeColor: "text-blue-400 border-blue-500/40 bg-blue-500/15" },
];

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

export default function PresencesPage() {
  const today = todayISO();

  const [slots, setSlots] = useState<AttendanceSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<AttendanceSlot | null>(null);

  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ownHistory, setOwnHistory] = useState<TeacherAttendanceRecord[]>([]);

  const loadSlots = useCallback(async () => {
    setSlotsLoading(true);
    setSelectedSlot(null);
    setRows([]);
    const { data } = await schoolApi.attendanceSlots();
    setSlots(data?.slots || []);
    setSlotsLoading(false);
  }, []);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const loadStudentsForSlot = useCallback(async (slot: AttendanceSlot) => {
    setStudentsLoading(true);
    setRows([]);
    const [studentsRes, attendanceRes] = await Promise.all([
      schoolApi.students("", slot.classroomId),
      schoolApi.attendance(today, undefined, slot.id),
    ]);
    let students: Student[] = [];
    if (studentsRes.data?.students) students = studentsRes.data.students;
    const existing = new Map(
      (attendanceRes.data?.records || []).map((r) => [r.studentId, r])
    );
    setRows(
      students.map((s) => ({
        studentId: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        matricule: s.matricule,
        status: (existing.get(s.id)?.status || "PRESENT") as AttendanceStatus,
        reason: existing.get(s.id)?.reason || "",
      }))
    );
    setStudentsLoading(false);
  }, [today]);

  const selectSlot = (slot: AttendanceSlot) => {
    setSelectedSlot(slot);
    setError(null);
    setSaved(false);
    loadStudentsForSlot(slot);
  };

  const loadOwnHistory = useCallback(async () => {
    const { data } = await schoolApi.myTeacherAttendances();
    setOwnHistory(data?.records || []);
  }, []);

  useEffect(() => {
    loadOwnHistory();
  }, [loadOwnHistory]);

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setRows((prev) =>
      prev.map((r) => (r.studentId === studentId ? { ...r, status } : r))
    );
  };

  const counts = {
    present: rows.filter((r) => r.status === "PRESENT").length,
    absent: rows.filter((r) => r.status === "ABSENT").length,
    late: rows.filter((r) => r.status === "LATE").length,
    excused: rows.filter((r) => r.status === "EXCUSED").length,
  };

  const handleSave = async () => {
    if (!selectedSlot || rows.length === 0) return;
    setSaving(true);
    setError(null);
    const { error: err } = await schoolApi.saveAttendance(
      selectedSlot.id,
      today,
      rows.map((r) => ({
        studentId: r.studentId,
        status: r.status,
        reason: r.reason || undefined,
      }))
    );
    setSaving(false);
    if (err) {
      setError(err);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      // Refresh slots to show updated badge
      const { data } = await schoolApi.attendanceSlots();
      setSlots(data?.slots || []);
      if (selectedSlot) {
        const updated = (data?.slots || []).find((s) => s.id === selectedSlot.id);
        if (updated) setSelectedSlot(updated);
      }
      loadOwnHistory();
    }
  };

  const exportOwnHistory = async () => {
    const err = await downloadProtectedFile(
      "/api/attendance/teachers/export",
      "mon-historique-presence.csv"
    );
    if (err) setError(err);
  };

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold font-heading text-white">Présences</h1>
        <p className="text-gray-400 text-sm mt-1">
          Faites l&apos;appel pour vos cours programmés aujourd&apos;hui
        </p>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 mb-4 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slot panel */}
      <AnimatePresence mode="wait">
        {!selectedSlot ? (
          <motion.div key="slot-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Mes cours aujourd&apos;hui —{" "}
              {new Date(today + "T12:00:00").toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </h2>

            {slotsLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-24 rounded-2xl bg-white/[0.04] animate-pulse" />
                ))}
              </div>
            ) : slots.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
                <CalendarX className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">Aucun cours programmé aujourd&apos;hui</p>
                <p className="text-xs text-gray-600 mt-1">
                  Contactez l&apos;administration pour vérifier votre emploi du temps
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {slots.map((slot, idx) => {
                  const done = slot.attendanceSessions.length > 0;
                  const recordCount = slot.attendanceSessions[0]?.records.length ?? 0;
                  return (
                    <motion.button
                      key={slot.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.06 }}
                      onClick={() => selectSlot(slot)}
                      className={cn(
                        "text-left p-4 rounded-2xl border transition-all hover:border-violet-500/30 hover:bg-white/[0.06] group",
                        done
                          ? "bg-emerald-500/5 border-emerald-500/20"
                          : "bg-white/[0.03] border-white/[0.08]"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-1.5 text-xs font-mono text-gray-400">
                          <Clock className="w-3.5 h-3.5" />
                          {slot.startsAt} – {slot.endsAt}
                        </div>
                        {done ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <Check className="w-3 h-3" />
                            Appel fait ({recordCount})
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-500/15 text-violet-400 border border-violet-500/20 group-hover:bg-violet-500/25">
                            Faire l&apos;appel
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-white truncate mb-0.5">
                        {slot.subject?.name || "Cours"}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{slot.classroom.name}</p>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="slot-detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="mb-6"
          >
            {/* Back */}
            <button
              onClick={() => {
                setSelectedSlot(null);
                setError(null);
                setSaved(false);
              }}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-4"
            >
              <ChevronLeft className="w-4 h-4" />
              Retour aux créneaux
            </button>

            {/* Slot header */}
            <div className="flex flex-wrap items-center gap-3 mb-5 p-4 bg-white/[0.03] border border-white/[0.07] rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {selectedSlot.subject?.name || "Cours"} — {selectedSlot.classroom.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {selectedSlot.startsAt} – {selectedSlot.endsAt} ·{" "}
                    {new Date(today + "T12:00:00").toLocaleDateString("fr-FR")}
                  </p>
                </div>
              </div>

              {!studentsLoading && rows.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 ml-auto text-xs">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">{counts.present}</span>
                    <span className="text-emerald-400/70">présents</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20">
                    <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-red-400 font-semibold">{counts.absent}</span>
                    <span className="text-red-400/70">absents</span>
                  </div>
                  {counts.late > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-amber-400 font-semibold">{counts.late}</span>
                      <span className="text-amber-400/70">retards</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/10">
                    <Users className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-gray-300">{rows.length} élèves</span>
                  </div>
                </div>
              )}
            </div>

            {/* Student list */}
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden mb-5">
              {studentsLoading ? (
                <div className="p-5 space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4 animate-pulse">
                      <div className="w-8 h-8 rounded-full bg-white/10 flex-shrink-0" />
                      <div className="h-3 bg-white/10 rounded w-32" />
                      <div className="flex gap-2 ml-auto">
                        {[...Array(4)].map((_, j) => (
                          <div key={j} className="h-8 w-16 bg-white/[0.07] rounded-lg" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                  <Users className="w-12 h-12 mb-2 opacity-20" />
                  <p className="text-sm">Aucun élève dans cette classe</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  <div className="grid grid-cols-[1fr_auto] items-center px-5 py-3 border-b border-white/[0.06]">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Élève</span>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</span>
                  </div>
                  {rows.map((row, idx) => (
                    <motion.div
                      key={row.studentId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                        {(row.firstName[0] + (row.lastName[0] || "")).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {row.firstName} {row.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{row.matricule || "—"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {STATUS_OPTIONS.map((opt) => {
                          const Icon = opt.icon;
                          const isActive = row.status === opt.value;
                          return (
                            <button
                              key={opt.value}
                              onClick={() => setStatus(row.studentId, opt.value)}
                              className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all hover:opacity-80",
                                isActive
                                  ? opt.activeColor
                                  : "text-gray-500 border-white/10 bg-white/[0.04]"
                              )}
                            >
                              <Icon className="w-3 h-3" />
                              <span className="hidden sm:inline">{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Save */}
            {rows.length > 0 && (
              <div className="flex items-center gap-4">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)]"
                >
                  {saving ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckSquare className="w-4 h-4" />
                  )}
                  Enregistrer l&apos;appel
                </button>
                <AnimatePresence>
                  {saved && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-sm text-emerald-400 font-medium"
                    >
                      ✓ Appel enregistré avec succès
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Personal history */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-white">Mon historique de présence</h2>
          </div>
          <button
            onClick={exportOwnHistory}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-xs text-gray-300 hover:bg-white/[0.08] transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>

        {ownHistory.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Clock className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Aucun retard ou absence enregistré pour votre compte.</p>
            <p className="text-gray-600 text-xs mt-1">
              Cet historique est personnel : vous ne voyez pas les données des autres professeurs.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {ownHistory.slice(0, 12).map((record) => (
              <div
                key={record.id}
                className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-white">
                    {new Date(record.date).toLocaleDateString("fr-FR")}
                  </p>
                  <p className="text-xs text-gray-500">{record.reason || "Aucun motif renseigné"}</p>
                </div>
                <span
                  className={cn(
                    "w-fit rounded-full border px-2.5 py-1 text-xs font-medium",
                    record.status === "PRESENT" && "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
                    record.status === "ABSENT" && "border-red-500/25 bg-red-500/10 text-red-300",
                    record.status === "LATE" && "border-amber-500/25 bg-amber-500/10 text-amber-300",
                    record.status === "EXCUSED" && "border-blue-500/25 bg-blue-500/10 text-blue-300"
                  )}
                >
                  {record.status === "PRESENT"
                    ? "Présent"
                    : record.status === "ABSENT"
                    ? "Absent"
                    : record.status === "LATE"
                    ? "Retard"
                    : "Justifié"}
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
