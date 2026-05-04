"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckSquare,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Calendar,
  Check,
  Clock,
  X,
  Download,
  Users,
  BookOpen,
  ChevronLeft,
  CalendarX,
} from "lucide-react";
import {
  downloadProtectedFile,
  schoolApi,
  type Student,
  type Teacher,
  type AttendanceSlot,
  type TeacherAttendanceRecord,
} from "@/lib/school-api";
import { cn } from "@/lib/utils";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

interface AttendanceEntry {
  studentId: string;
  student: Student;
  status: AttendanceStatus;
  reason: string;
}

interface TeacherAttendanceEntry {
  teacherId: string;
  teacher: Teacher;
  status: AttendanceStatus;
  reason: string;
  penaltyAmount: number;
}

const STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; icon: React.ElementType; color: string; activeColor: string }
> = {
  PRESENT: {
    label: "Présent",
    icon: Check,
    color: "text-gray-500 border-white/10 bg-white/[0.04]",
    activeColor: "text-emerald-400 border-emerald-500/40 bg-emerald-500/15",
  },
  ABSENT: {
    label: "Absent",
    icon: X,
    color: "text-gray-500 border-white/10 bg-white/[0.04]",
    activeColor: "text-red-400 border-red-500/40 bg-red-500/15",
  },
  LATE: {
    label: "Retard",
    icon: Clock,
    color: "text-gray-500 border-white/10 bg-white/[0.04]",
    activeColor: "text-amber-400 border-amber-500/40 bg-amber-500/15",
  },
  EXCUSED: {
    label: "Justifié",
    icon: CheckCircle,
    color: "text-gray-500 border-white/10 bg-white/[0.04]",
    activeColor: "text-blue-400 border-blue-500/40 bg-blue-500/15",
  },
};

function SlotStatusBadge({ done, count }: { done: boolean; count: number }) {
  if (done) {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
        <Check className="w-3 h-3" />
        Appel fait ({count})
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
      <Clock className="w-3 h-3" />
      En attente
    </span>
  );
}

export default function AttendancePage() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);

  // Slots view
  const [slots, setSlots] = useState<AttendanceSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<AttendanceSlot | null>(null);

  // Student attendance
  const [students, setStudents] = useState<Student[]>([]);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Teacher attendance
  const [teacherEntries, setTeacherEntries] = useState<TeacherAttendanceEntry[]>([]);
  const [teacherLoading, setTeacherLoading] = useState(true);
  const [teacherSaving, setTeacherSaving] = useState(false);

  const loadSlots = useCallback(async () => {
    setSlotsLoading(true);
    setSelectedSlot(null);
    setEntries([]);
    const { data } = await schoolApi.attendanceSlots(date);
    setSlots(data?.slots || []);
    setSlotsLoading(false);
  }, [date]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const loadStudentsForSlot = useCallback(
    async (slot: AttendanceSlot) => {
      setStudentsLoading(true);
      setEntries([]);
      const [studentsRes, attendanceRes] = await Promise.all([
        schoolApi.students("", slot.classroomId),
        schoolApi.attendance(date, undefined, slot.id),
      ]);
      const studs = studentsRes.data?.students || [];
      const existing = new Map(
        (attendanceRes.data?.records || []).map((r) => [r.studentId, r])
      );
      setStudents(studs);
      setEntries(
        studs.map((s) => ({
          studentId: s.id,
          student: s,
          status: (existing.get(s.id)?.status || "PRESENT") as AttendanceStatus,
          reason: existing.get(s.id)?.reason || "",
        }))
      );
      setStudentsLoading(false);
    },
    [date]
  );

  const selectSlot = (slot: AttendanceSlot) => {
    setSelectedSlot(slot);
    setSaveError(null);
    setSaveSuccess(null);
    loadStudentsForSlot(slot);
  };

  const loadTeacherEntries = useCallback(async () => {
    setTeacherLoading(true);
    const [teacherRes, attendanceRes] = await Promise.all([
      schoolApi.teachers(),
      schoolApi.teacherAttendances(date),
    ]);
    const teacherList = teacherRes.data?.teachers || [];
    const existing = new Map(
      (attendanceRes.data?.records || []).map((r) => [r.teacherId, r])
    );
    setTeacherEntries(
      teacherList.map((teacher) => {
        const record = existing.get(teacher.id);
        return {
          teacherId: teacher.id,
          teacher,
          status: (record?.status || "PRESENT") as AttendanceStatus,
          reason: record?.reason || "",
          penaltyAmount: record?.penaltyAmount || 0,
        };
      })
    );
    setTeacherLoading(false);
  }, [date]);

  useEffect(() => {
    loadTeacherEntries();
  }, [loadTeacherEntries]);

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setEntries((prev) =>
      prev.map((e) => (e.studentId === studentId ? { ...e, status } : e))
    );
  };

  const setTeacherStatus = (teacherId: string, status: AttendanceStatus) => {
    setTeacherEntries((prev) =>
      prev.map((e) => (e.teacherId === teacherId ? { ...e, status } : e))
    );
  };

  const updateTeacherEntry = (
    teacherId: string,
    patch: Partial<TeacherAttendanceEntry>
  ) => {
    setTeacherEntries((prev) =>
      prev.map((e) => (e.teacherId === teacherId ? { ...e, ...patch } : e))
    );
  };

  const handleSave = async () => {
    if (!selectedSlot) return;
    if (entries.length === 0) {
      setSaveError("Aucun élève dans cette classe");
      return;
    }
    setSaveError(null);
    setSaving(true);
    const res = await schoolApi.saveAttendance(
      selectedSlot.id,
      date,
      entries.map((e) => ({
        studentId: e.studentId,
        status: e.status,
        reason: e.reason || undefined,
      }))
    );
    setSaving(false);
    if (res.error) {
      setSaveError(res.error);
      return;
    }
    setSaveSuccess("Appel enregistré avec succès !");
    setTimeout(() => setSaveSuccess(null), 3000);
    // Refresh slots to update badge
    const { data } = await schoolApi.attendanceSlots(date);
    setSlots(data?.slots || []);
    if (selectedSlot) {
      const updated = (data?.slots || []).find((s) => s.id === selectedSlot.id);
      if (updated) setSelectedSlot(updated);
    }
  };

  const handleSaveTeachers = async () => {
    if (teacherEntries.length === 0) return;
    setSaveError(null);
    setTeacherSaving(true);
    const results = await Promise.all(
      teacherEntries.map((e) =>
        schoolApi.saveTeacherAttendance({
          teacherId: e.teacherId,
          date,
          status: e.status,
          reason: e.reason || undefined,
          penaltyAmount: e.penaltyAmount || undefined,
        })
      )
    );
    setTeacherSaving(false);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      setSaveError(failed.error);
      return;
    }
    setSaveSuccess("Présences des professeurs enregistrées !");
    setTimeout(() => setSaveSuccess(null), 3000);
    loadTeacherEntries();
  };

  const exportAllStudents = async () => {
    const error = await downloadProtectedFile(
      "/api/attendance/students/export",
      "presence-eleves-historique.csv"
    );
    if (error) setSaveError(error);
  };

  const exportAllTeachers = async () => {
    const error = await downloadProtectedFile(
      "/api/attendance/teachers/export",
      "presence-profs-historique.csv"
    );
    if (error) setSaveError(error);
  };

  const presentCount = entries.filter((e) => e.status === "PRESENT").length;
  const absentCount = entries.filter((e) => e.status === "ABSENT").length;
  const lateCount = entries.filter((e) => e.status === "LATE").length;
  const excusedCount = entries.filter((e) => e.status === "EXCUSED").length;

  const teacherPresentCount = teacherEntries.filter((e) => e.status === "PRESENT").length;
  const teacherAbsentCount = teacherEntries.filter((e) => e.status === "ABSENT").length;
  const teacherLateCount = teacherEntries.filter((e) => e.status === "LATE").length;
  const teacherExcusedCount = teacherEntries.filter((e) => e.status === "EXCUSED").length;

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold font-heading text-white">Présences</h1>
        <p className="text-gray-400 text-sm mt-1">
          L&apos;appel est obligatoirement lié à un créneau de l&apos;emploi du temps
        </p>
      </motion.div>

      {/* Date selector + exports */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-wrap items-center gap-3 mb-6"
      >
        <div className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5">
          <Calendar className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent text-sm text-white focus:outline-none"
          />
        </div>
        <button
          onClick={exportAllStudents}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-gray-300 text-sm hover:bg-white/[0.08] transition-all"
        >
          <Download className="w-4 h-4" />
          Export élèves
        </button>
        <button
          onClick={exportAllTeachers}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm hover:bg-blue-500/20 transition-all"
        >
          <Download className="w-4 h-4" />
          Export profs
        </button>
      </motion.div>

      {/* Error/success feedback */}
      <AnimatePresence>
        {saveError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 mb-4 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {saveError}
          </motion.div>
        )}
        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 mb-4 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3"
          >
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            {saveSuccess}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slot panel */}
      <AnimatePresence mode="wait">
        {!selectedSlot ? (
          <motion.div key="slot-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Slots grid */}
            <div className="mb-2">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Cours programmés — {new Date(date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
              </h2>
            </div>

            {slotsLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-24 rounded-2xl bg-white/[0.04] animate-pulse" />
                ))}
              </div>
            ) : slots.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
                <CalendarX className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">Aucun cours programmé ce jour</p>
                <p className="text-xs text-gray-600 mt-1">Vérifiez l&apos;emploi du temps dans le menu Emploi du temps</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {slots.map((slot, idx) => {
                  const done = slot.attendanceSessions.length > 0;
                  const recordCount = slot.attendanceSessions[0]?.records.length ?? 0;
                  return (
                    <motion.button
                      key={slot.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => selectSlot(slot)}
                      className={cn(
                        "text-left p-4 rounded-2xl border transition-all hover:border-emerald-500/30 hover:bg-white/[0.06]",
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
                        <SlotStatusBadge done={done} count={recordCount} />
                      </div>
                      <p className="text-sm font-semibold text-white truncate mb-0.5">
                        {slot.subject?.name || "Cours"}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{slot.classroom.name}</p>
                      {slot.teacher && (
                        <p className="text-xs text-gray-600 truncate mt-0.5">
                          {slot.teacher.firstName} {slot.teacher.lastName}
                        </p>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="slot-detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            {/* Back + slot header */}
            <div className="flex items-center gap-3 mb-5">
              <button
                onClick={() => {
                  setSelectedSlot(null);
                  setSaveError(null);
                  setSaveSuccess(null);
                }}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Retour aux créneaux
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-5 p-4 bg-white/[0.03] border border-white/[0.07] rounded-2xl">
              <div className="flex items-center gap-2 text-emerald-400">
                <BookOpen className="w-5 h-5" />
                <div>
                  <p className="text-sm font-semibold text-white">
                    {selectedSlot.subject?.name || "Cours"} — {selectedSlot.classroom.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {selectedSlot.startsAt} – {selectedSlot.endsAt}
                    {selectedSlot.teacher && ` · ${selectedSlot.teacher.firstName} ${selectedSlot.teacher.lastName}`}
                  </p>
                </div>
              </div>

              {!studentsLoading && entries.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 ml-auto text-xs">
                  {[
                    { label: "Présents", count: presentCount, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
                    { label: "Absents", count: absentCount, color: "text-red-400 bg-red-500/10 border-red-500/20" },
                    { label: "Retards", count: lateCount, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
                    { label: "Justifiés", count: excusedCount, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
                  ].map((s) => (
                    <div key={s.label} className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-xl border", s.color)}>
                      <span className="font-bold">{s.count}</span>
                      <span>{s.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Student list */}
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden mb-4">
              {studentsLoading ? (
                <div className="p-6 space-y-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4 animate-pulse">
                      <div className="w-9 h-9 rounded-full bg-white/10 flex-shrink-0" />
                      <div className="flex-1"><div className="h-3 bg-white/10 rounded w-32" /></div>
                      <div className="flex gap-2">
                        {[...Array(4)].map((_, j) => (
                          <div key={j} className="w-20 h-8 bg-white/10 rounded-lg" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                  <Users className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-sm">Aucun élève dans cette classe</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  <div className="grid grid-cols-[1fr_auto] items-center px-5 py-3 border-b border-white/[0.06]">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Élève</span>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</span>
                  </div>
                  {entries.map((entry, idx) => (
                    <motion.div
                      key={entry.studentId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                        {(entry.student.firstName[0] + (entry.student.lastName[0] || "")).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {entry.student.firstName} {entry.student.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{entry.student.matricule || "—"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {(["PRESENT", "ABSENT", "LATE", "EXCUSED"] as AttendanceStatus[]).map((status) => {
                          const cfg = STATUS_CONFIG[status];
                          const Icon = cfg.icon;
                          const isActive = entry.status === status;
                          return (
                            <button
                              key={status}
                              onClick={() => setStatus(entry.studentId, status)}
                              className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all hover:opacity-80",
                                isActive ? cfg.activeColor : cfg.color
                              )}
                            >
                              <Icon className="w-3 h-3" />
                              <span className="hidden sm:inline">{cfg.label}</span>
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
            {entries.length > 0 && (
              <div className="flex items-center gap-4 mb-8">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)] disabled:opacity-60"
                >
                  {saving ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckSquare className="w-4 h-4" />
                  )}
                  Enregistrer l&apos;appel
                </motion.button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Teacher attendance — admin section */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden mt-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-5 py-4 border-b border-white/[0.06]">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-white">Présences des professeurs</h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Présence journalière des enseignants — visible uniquement par l&apos;administration
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {[
              { label: "Présents", count: teacherPresentCount, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
              { label: "Absents", count: teacherAbsentCount, color: "text-red-400 bg-red-500/10 border-red-500/20" },
              { label: "Retards", count: teacherLateCount, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
              { label: "Justifiés", count: teacherExcusedCount, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
            ].map((item) => (
              <span key={item.label} className={cn("px-2.5 py-1 rounded-full border", item.color)}>
                {item.count} {item.label}
              </span>
            ))}
          </div>
        </div>

        {teacherLoading ? (
          <div className="p-6 space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-white/[0.05] animate-pulse" />
            ))}
          </div>
        ) : teacherEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-gray-500">
            <Users className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-sm">Aucun professeur enregistré</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {teacherEntries.map((entry) => (
              <div
                key={entry.teacherId}
                className="grid gap-3 px-5 py-4 lg:grid-cols-[1fr_auto_180px] lg:items-center hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-slate-800 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                    {(entry.teacher.firstName[0] + (entry.teacher.lastName[0] || "")).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {entry.teacher.firstName} {entry.teacher.lastName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {entry.teacher.matricule || entry.teacher.specialization || "Professeur"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {(["PRESENT", "ABSENT", "LATE", "EXCUSED"] as AttendanceStatus[]).map((status) => {
                    const cfg = STATUS_CONFIG[status];
                    const Icon = cfg.icon;
                    const isActive = entry.status === status;
                    return (
                      <button
                        key={status}
                        onClick={() => setTeacherStatus(entry.teacherId, status)}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all",
                          isActive ? cfg.activeColor : cfg.color
                        )}
                      >
                        <Icon className="w-3 h-3" />
                        <span>{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-[1fr_76px] gap-2">
                  <input
                    value={entry.reason}
                    onChange={(e) => updateTeacherEntry(entry.teacherId, { reason: e.target.value })}
                    placeholder="Motif / note"
                    className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40"
                  />
                  <input
                    type="number"
                    min={0}
                    value={entry.penaltyAmount || ""}
                    onChange={(e) =>
                      updateTeacherEntry(entry.teacherId, { penaltyAmount: Number(e.target.value) || 0 })
                    }
                    placeholder="Pénalité"
                    className="bg-white/[0.04] border border-white/10 rounded-lg px-2 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {teacherEntries.length > 0 && (
          <div className="flex items-center gap-4 px-5 py-4 border-t border-white/[0.06]">
            <button
              onClick={handleSaveTeachers}
              disabled={teacherSaving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all disabled:opacity-60"
            >
              {teacherSaving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckSquare className="w-4 h-4" />
              )}
              Enregistrer les professeurs
            </button>
            <button
              onClick={exportAllTeachers}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-gray-300 text-sm hover:bg-white/[0.08] transition-all"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
