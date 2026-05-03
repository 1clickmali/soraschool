"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckSquare,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Calendar,
  LayoutGrid,
  Check,
  Clock,
  X,
  Download,
  Users,
} from "lucide-react";
import { downloadProtectedFile, schoolApi, type Student, type Classroom, type Teacher } from "@/lib/school-api";
import { cn } from "@/lib/utils";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

interface AttendanceEntry {
  studentId: string;
  student: Student;
  status: AttendanceStatus;
}

interface TeacherAttendanceEntry {
  teacherId: string;
  teacher: Teacher;
  status: AttendanceStatus;
  reason: string;
  penaltyAmount: number;
}

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; icon: React.ElementType; color: string; activeColor: string }> = {
  PRESENT: { label: "Présent", icon: Check, color: "text-gray-500 border-white/10 bg-white/[0.04]", activeColor: "text-emerald-400 border-emerald-500/40 bg-emerald-500/15" },
  ABSENT: { label: "Absent", icon: X, color: "text-gray-500 border-white/10 bg-white/[0.04]", activeColor: "text-red-400 border-red-500/40 bg-red-500/15" },
  LATE: { label: "Retard", icon: Clock, color: "text-gray-500 border-white/10 bg-white/[0.04]", activeColor: "text-amber-400 border-amber-500/40 bg-amber-500/15" },
  EXCUSED: { label: "Justifié", icon: CheckCircle, color: "text-gray-500 border-white/10 bg-white/[0.04]", activeColor: "text-blue-400 border-blue-500/40 bg-blue-500/15" },
};

export default function AttendancePage() {
  const params = useParams();

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [classId, setClassId] = useState("");
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [teacherEntries, setTeacherEntries] = useState<TeacherAttendanceEntry[]>([]);
  const [teacherLoading, setTeacherLoading] = useState(true);
  const [teacherSaving, setTeacherSaving] = useState(false);

  useEffect(() => {
    schoolApi.classes().then(({ data }) => {
      if (data?.classes) {
        setClasses(data.classes);
        if (data.classes.length > 0) setClassId(data.classes[0].id);
      }
    });
  }, []);

  const loadStudents = useCallback(async () => {
    if (!classId) {
      setStudents([]);
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [studentsRes, attendanceRes] = await Promise.all([
      schoolApi.students("", classId),
      schoolApi.attendance(date, classId),
    ]);
    const studs = studentsRes.data?.students || [];
    const existing = new Map((attendanceRes.data?.records || []).map((record) => [record.studentId, record.status]));
    setStudents(studs);
    setEntries(
      studs.map((s) => ({
        studentId: s.id,
        student: s,
        status: (existing.get(s.id) || "PRESENT") as AttendanceStatus,
      }))
    );
    setLoading(false);
  }, [classId, date]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const loadTeacherEntries = useCallback(async () => {
    setTeacherLoading(true);
    const [teacherRes, attendanceRes] = await Promise.all([
      schoolApi.teachers(),
      schoolApi.teacherAttendances(date),
    ]);
    const teacherList = teacherRes.data?.teachers || [];
    const existing = new Map((attendanceRes.data?.records || []).map((record) => [record.teacherId, record]));
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
    setEntries((prev) => prev.map((e) => e.studentId === studentId ? { ...e, status } : e));
  };

  const setTeacherStatus = (teacherId: string, status: AttendanceStatus) => {
    setTeacherEntries((prev) => prev.map((entry) => entry.teacherId === teacherId ? { ...entry, status } : entry));
  };

  const updateTeacherEntry = (teacherId: string, patch: Partial<TeacherAttendanceEntry>) => {
    setTeacherEntries((prev) => prev.map((entry) => entry.teacherId === teacherId ? { ...entry, ...patch } : entry));
  };

  const handleSave = async () => {
    if (!classId) { setSaveError("Sélectionnez une classe"); return; }
    if (entries.length === 0) { setSaveError("Aucun élève à enregistrer"); return; }
    setSaveError(null);
    setSaving(true);
    const res = await schoolApi.saveAttendance(
      classId,
      date,
      entries.map((entry) => ({ studentId: entry.studentId, status: entry.status }))
    );
    setSaving(false);
    if (res.error) {
      setSaveError(res.error);
      return;
    }
    setSaveSuccess("Appel enregistré avec succès !");
    setTimeout(() => setSaveSuccess(null), 3000);
  };

  const handleSaveTeachers = async () => {
    if (teacherEntries.length === 0) { setSaveError("Aucun professeur à enregistrer"); return; }
    setSaveError(null);
    setTeacherSaving(true);
    const results = await Promise.all(teacherEntries.map((entry) => schoolApi.saveTeacherAttendance({
      teacherId: entry.teacherId,
      date,
      status: entry.status,
      reason: entry.reason || undefined,
      penaltyAmount: entry.penaltyAmount || undefined,
    })));
    setTeacherSaving(false);
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      setSaveError(failed.error);
      return;
    }
    setSaveSuccess("Présences des professeurs enregistrées !");
    setTimeout(() => setSaveSuccess(null), 3000);
    loadTeacherEntries();
  };

  const exportStudents = async () => {
    if (!classId) { setSaveError("Sélectionnez une classe avant l'export"); return; }
    const error = await downloadProtectedFile(`/api/attendance/students/export?date=${date}&classroomId=${classId}`, `presence-eleves-${date}.csv`);
    if (error) setSaveError(error);
  };

  const exportAllStudents = async () => {
    const error = await downloadProtectedFile("/api/attendance/students/export", "presence-eleves-historique.csv");
    if (error) setSaveError(error);
  };

  const exportTeachers = async () => {
    const error = await downloadProtectedFile(`/api/attendance/teachers/export?date=${date}`, `presence-profs-${date}.csv`);
    if (error) setSaveError(error);
  };

  const exportAllTeachers = async () => {
    const error = await downloadProtectedFile("/api/attendance/teachers/export", "presence-profs-historique.csv");
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
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold font-heading text-white">Présences</h1>
        <p className="text-gray-400 text-sm mt-1">Enregistrement des présences quotidiennes</p>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5">
          <Calendar className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent text-sm text-white focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 flex-1 sm:max-w-xs">
          <LayoutGrid className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="bg-transparent text-sm text-white flex-1 focus:outline-none [&>option]:bg-soraCard"
          >
            <option value="">Choisir une classe</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={exportStudents}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-gray-300 text-sm hover:bg-white/[0.08] transition-all"
        >
          <Download className="w-4 h-4" />
          Export élèves jour
        </button>
        <button
          onClick={exportAllStudents}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-gray-300 text-sm hover:bg-white/[0.08] transition-all"
        >
          <Download className="w-4 h-4" />
          Tout élèves
        </button>
        <button
          onClick={exportTeachers}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm hover:bg-blue-500/20 transition-all"
        >
          <Download className="w-4 h-4" />
          Export profs jour
        </button>
        <button
          onClick={exportAllTeachers}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm hover:bg-blue-500/20 transition-all"
        >
          <Download className="w-4 h-4" />
          Tout profs
        </button>
      </motion.div>

      {/* Summary stats */}
      {!loading && entries.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="flex items-center gap-3 mb-5">
          {[
            { label: "Présents", count: presentCount, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
            { label: "Absents", count: absentCount, color: "text-red-400 bg-red-500/10 border-red-500/20" },
            { label: "Retards", count: lateCount, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
            { label: "Justifiés", count: excusedCount, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
          ].map((s) => (
            <div key={s.label} className={cn("flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border", s.color)}>
              <span className="font-bold">{s.count}</span>
              <span>{s.label}</span>
            </div>
          ))}
          <span className="text-xs text-gray-600 ml-2">{entries.length} élèves au total</span>
        </motion.div>
      )}

      {/* Attendance list */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden mb-4">
        {loading ? (
          <div className="p-6 space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="w-9 h-9 rounded-full bg-white/10 flex-shrink-0" />
                <div className="flex-1"><div className="h-3 bg-white/10 rounded w-32" /></div>
                <div className="flex gap-2">
                  {[...Array(3)].map((_, j) => <div key={j} className="w-20 h-8 bg-white/10 rounded-lg" />)}
                </div>
              </div>
            ))}
          </div>
        ) : !classId ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <LayoutGrid className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-sm">Sélectionnez une classe pour commencer</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <CheckSquare className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-sm">Aucun élève dans cette classe</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {/* Header */}
            <div className="grid grid-cols-[1fr_auto] items-center px-5 py-3 border-b border-white/[0.06]">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Élève</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</span>
            </div>
            {entries.map((entry, idx) => (
              <motion.div
                key={entry.studentId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
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
                          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all",
                          isActive ? cfg.activeColor : cfg.color,
                          "hover:opacity-80"
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
      </motion.div>

      {/* Save button + feedback */}
      {entries.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex items-center gap-4 mb-8">
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)] disabled:opacity-60"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
            Enregistrer l&apos;appel
          </motion.button>

          <AnimatePresence>
            {saveError && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />{saveError}
              </motion.div>
            )}
            {saveSuccess && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-emerald-400 text-sm">
                <CheckCircle className="w-4 h-4" />{saveSuccess}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Teacher attendance */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-5 py-4 border-b border-white/[0.06]">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-white">Présences des professeurs</h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">Visible par l&apos;administration. Chaque professeur voit uniquement son propre historique côté espace prof.</p>
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
              <div key={entry.teacherId} className="grid gap-3 px-5 py-4 lg:grid-cols-[1fr_auto_180px] lg:items-center hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-slate-800 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                    {(entry.teacher.firstName[0] + (entry.teacher.lastName[0] || "")).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{entry.teacher.firstName} {entry.teacher.lastName}</p>
                    <p className="text-xs text-gray-500">{entry.teacher.matricule || entry.teacher.specialization || "Professeur"}</p>
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
                    onChange={(event) => updateTeacherEntry(entry.teacherId, { reason: event.target.value })}
                    placeholder="Motif / note"
                    className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40"
                  />
                  <input
                    type="number"
                    min={0}
                    value={entry.penaltyAmount || ""}
                    onChange={(event) => updateTeacherEntry(entry.teacherId, { penaltyAmount: Number(event.target.value) || 0 })}
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
              {teacherSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
              Enregistrer les professeurs
            </button>
            <button
              onClick={exportTeachers}
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
