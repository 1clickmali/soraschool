"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CheckSquare, Users, AlertCircle, Clock, FileCheck, Download } from "lucide-react";
import { downloadProtectedFile, schoolApi, schoolApiRequest, type Student, type TeacherAttendanceRecord } from "@/lib/school-api";
import { cn } from "@/lib/utils";

interface Assignment {
  classroom?: { id: string; name: string };
}

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

interface AttendanceRow {
  studentId: string;
  firstName: string;
  lastName: string;
  status: AttendanceStatus;
  comment: string;
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; icon: string; color: string }[] = [
  { value: "PRESENT", label: "Présent", icon: "✓", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20" },
  { value: "ABSENT", label: "Absent", icon: "✗", color: "text-red-400 border-red-500/30 bg-red-500/10 hover:bg-red-500/20" },
  { value: "LATE", label: "Retard", icon: "⏰", color: "text-amber-400 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20" },
  { value: "EXCUSED", label: "Justifié", icon: "📋", color: "text-blue-400 border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20" },
];

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

export default function PresencesPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;

  const [classrooms, setClassrooms] = useState<{ id: string; name: string }[]>([]);
  const [selectedClassId, setSelectedClassId] = useState(searchParams.get("classroomId") || "");
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownHistory, setOwnHistory] = useState<TeacherAttendanceRecord[]>([]);

  // Load classrooms
  useEffect(() => {
    schoolApiRequest<{ assignments?: Assignment[] } | Assignment[]>("/api/academics/assignments").then(({ data }) => {
      let assignments: Assignment[] = [];
      if (Array.isArray(data)) assignments = data;
      else if (data && "assignments" in data) assignments = data.assignments || [];

      const map: Record<string, { id: string; name: string }> = {};
      for (const a of assignments) {
        if (a.classroom) map[a.classroom.id] = a.classroom;
      }
      const list = Object.values(map);
      setClassrooms(list);
      if (!selectedClassId && list.length > 0) setSelectedClassId(list[0].id);
    });
  }, [selectedClassId]);

  const loadStudents = useCallback(async () => {
    if (!selectedClassId) return;
    setLoadingStudents(true);
    setRows([]);
    const [res, attendanceRes] = await Promise.all([
      schoolApiRequest<{ students?: Student[] } | Student[]>(`/api/students?classroomId=${selectedClassId}`),
      schoolApi.attendance(selectedDate, selectedClassId),
    ]);
    let students: Student[] = [];
    if (Array.isArray(res.data)) students = res.data;
    else if (res.data && "students" in res.data) students = res.data.students || [];
    const existing = new Map((attendanceRes.data?.records || []).map((record) => [record.studentId, record]));

    setRows(
      students.map((s) => ({
        studentId: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        status: (existing.get(s.id)?.status || "PRESENT") as AttendanceStatus,
        comment: existing.get(s.id)?.reason || "",
      }))
    );
    setLoadingStudents(false);
  }, [selectedClassId, selectedDate]);

  useEffect(() => {
    if (selectedClassId) loadStudents();
  }, [selectedClassId, loadStudents]);

  const loadOwnHistory = useCallback(async () => {
    const { data } = await schoolApi.myTeacherAttendances();
    setOwnHistory(data?.records || []);
  }, []);

  useEffect(() => {
    loadOwnHistory();
  }, [loadOwnHistory]);

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setRows((prev) => prev.map((r) => (r.studentId === studentId ? { ...r, status } : r)));
  };

  const setComment = (studentId: string, comment: string) => {
    setRows((prev) => prev.map((r) => (r.studentId === studentId ? { ...r, comment } : r)));
  };

  const counts = {
    present: rows.filter((r) => r.status === "PRESENT").length,
    absent: rows.filter((r) => r.status === "ABSENT").length,
    late: rows.filter((r) => r.status === "LATE").length,
    excused: rows.filter((r) => r.status === "EXCUSED").length,
  };

  const handleSave = async () => {
    if (!selectedClassId || rows.length === 0) return;
    setSaving(true);
    setError(null);
    const { data, error: err } = await schoolApi.saveAttendance(
      selectedClassId,
      selectedDate,
      rows.map((r) => ({
        studentId: r.studentId,
        status: r.status,
        reason: r.comment || undefined,
      }))
    );
    setSaving(false);
    if (err) {
      setError(err);
    } else if (data) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      loadOwnHistory();
    }
  };

  const exportClassAttendance = async () => {
    if (!selectedClassId) return;
    const err = await downloadProtectedFile(
      `/api/attendance/students/export?date=${selectedDate}&classroomId=${selectedClassId}`,
      `presence-${selectedClassName || "classe"}-${selectedDate}.csv`
    );
    if (err) setError(err);
  };

  const exportOwnHistory = async () => {
    const err = await downloadProtectedFile("/api/attendance/teachers/export", "mon-historique-presence.csv");
    if (err) setError(err);
  };

  const selectedClassName = classrooms.find((c) => c.id === selectedClassId)?.name;

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold font-heading text-white">Présences</h1>
        <p className="text-gray-400 text-sm mt-1">Faites l&apos;appel pour vos classes</p>
      </motion.div>

      {/* Selectors */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 mb-6"
      >
        <div>
          <label className="block text-xs text-gray-500 font-medium mb-1.5 uppercase tracking-wide">Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.07] transition-all"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 font-medium mb-1.5 uppercase tracking-wide">Classe</label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-violet-500/50 transition-all appearance-none"
          >
            <option value="" disabled>Sélectionner une classe…</option>
            {classrooms.map((c) => (
              <option key={c.id} value={c.id} className="bg-soraDark">{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={exportClassAttendance}
            disabled={!selectedClassId}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-gray-300 text-sm hover:bg-white/[0.08] disabled:opacity-50 transition-all"
          >
            <Download className="w-4 h-4" />
            Exporter
          </button>
        </div>
      </motion.div>

      {/* Live counts */}
      {rows.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex flex-wrap gap-3 mb-5"
        >
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <CheckSquare className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-400">{counts.present}</span>
            <span className="text-xs text-emerald-400/70">présents</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-semibold text-red-400">{counts.absent}</span>
            <span className="text-xs text-red-400/70">absents</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-amber-400">{counts.late}</span>
            <span className="text-xs text-amber-400/70">en retard</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <FileCheck className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-blue-400">{counts.excused}</span>
            <span className="text-xs text-blue-400/70">justifiés</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.05] border border-white/10 ml-auto">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300">{rows.length} élèves</span>
          </div>
        </motion.div>
      )}

      {/* Attendance table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden mb-6"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-white">
              {selectedClassName ? `Appel — ${selectedClassName}` : "Sélectionnez une classe"}
            </h2>
          </div>
          {rows.length > 0 && (
            <span className="text-xs text-gray-500">{selectedDate}</span>
          )}
        </div>

        {!selectedClassId ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <CheckSquare className="w-12 h-12 mb-2 opacity-20" />
            <p className="text-sm">Choisissez une classe pour commencer l&apos;appel</p>
          </div>
        ) : loadingStudents ? (
          <div className="p-5 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-white/10 flex-shrink-0" />
                <div className="h-3 bg-white/10 rounded w-32" />
                <div className="flex gap-2 ml-auto">
                  {[...Array(4)].map((_, j) => <div key={j} className="h-8 w-16 bg-white/[0.07] rounded-lg" />)}
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Élève</th>
                  <th className="text-center px-2 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Statut</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide hidden lg:table-cell">Commentaire</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {rows.map((row) => (
                  <tr key={row.studentId} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                          {(row.firstName[0] + row.lastName[0]).toUpperCase()}
                        </div>
                        <span className="font-medium text-white">{row.firstName} {row.lastName}</span>
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-1.5 justify-center flex-wrap">
                        {STATUS_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setStatus(row.studentId, opt.value)}
                            className={cn(
                              "px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all",
                              row.status === opt.value
                                ? opt.color.replace("hover:", "")
                                : "text-gray-500 border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"
                            )}
                          >
                            <span className="hidden sm:inline">{opt.icon} {opt.label}</span>
                            <span className="sm:hidden">{opt.icon}</span>
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3 hidden lg:table-cell">
                      <input
                        type="text"
                        placeholder="Commentaire optionnel…"
                        value={row.comment}
                        onChange={(e) => setComment(row.studentId, e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.07] text-xs text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-violet-500/40 transition-all"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Save button */}
      {rows.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="flex items-center gap-4 mb-8"
        >
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_rgba(139,92,246,0.4)]"
          >
            {saving ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                />
                Enregistrement…
              </>
            ) : (
              <>
                <CheckSquare className="w-4 h-4" />
                Enregistrer l&apos;appel
              </>
            )}
          </button>

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
          {error && (
            <span className="text-sm text-red-400">{error}</span>
          )}
        </motion.div>
      )}

      {/* History */}
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
            <p className="text-gray-600 text-xs mt-1">Cet historique est personnel : vous ne voyez pas les données des autres professeurs.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {ownHistory.slice(0, 12).map((record) => (
              <div key={record.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{new Date(record.date).toLocaleDateString("fr-FR")}</p>
                  <p className="text-xs text-gray-500">{record.reason || "Aucun motif renseigné"}</p>
                </div>
                <span className={cn(
                  "w-fit rounded-full border px-2.5 py-1 text-xs font-medium",
                  record.status === "PRESENT" && "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
                  record.status === "ABSENT" && "border-red-500/25 bg-red-500/10 text-red-300",
                  record.status === "LATE" && "border-amber-500/25 bg-amber-500/10 text-amber-300",
                  record.status === "EXCUSED" && "border-blue-500/25 bg-blue-500/10 text-blue-300"
                )}>
                  {record.status === "PRESENT" ? "Présent" : record.status === "ABSENT" ? "Absent" : record.status === "LATE" ? "Retard" : "Justifié"}
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
