"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Clock,
  CheckCircle,
  LogIn,
  LogOut,
  AlertTriangle,
  Users,
  RefreshCw,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { schoolApi, type TeacherBadge, type Teacher } from "@/lib/school-api";
import { cn, formatDate } from "@/lib/utils";

function formatTime(dateStr?: string) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function minutesToLabel(min: number) {
  if (min <= 0) return <span className="text-emerald-400 text-xs">À l'heure</span>;
  return <span className="text-amber-400 text-xs">{min}min retard</span>;
}

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

export default function TeacherBadgesPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [badges, setBadges] = useState<TeacherBadge[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [badgesRes, teachersRes] = await Promise.all([
      schoolApi.teacherBadges({ month, teacherId: selectedTeacher || undefined }),
      schoolApi.teachers(),
    ]);
    if (badgesRes.error) setError(badgesRes.error);
    else if (badgesRes.data) setBadges(badgesRes.data.badges);
    if (teachersRes.data) setTeachers(teachersRes.data.teachers);
    setLoading(false);
  }, [month, selectedTeacher]);

  useEffect(() => { load(); }, [load]);

  const todayBadges = badges.filter((b) => b.date.startsWith(todayIso()));
  const presentToday = todayBadges.filter((b) => b.checkInAt).length;
  const lateToday = todayBadges.filter((b) => (b.lateMinutes ?? 0) > 0).length;

  return (
    <div className="min-h-screen bg-soraDark text-white">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-blue-500/15">
            <Clock className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-heading">Pointage enseignants</h1>
            <p className="text-sm text-gray-400">Suivi des entrées et sorties</p>
          </div>
        </motion.div>

        {/* Today stats */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="grid grid-cols-3 gap-3">
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 text-center">
            <Users className="w-5 h-5 text-blue-400 mx-auto mb-1" />
            <p className="text-2xl font-bold">{teachers.length}</p>
            <p className="text-xs text-gray-500">Total enseignants</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 text-center">
            <CheckCircle className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-emerald-400">{presentToday}</p>
            <p className="text-xs text-gray-500">Pointés aujourd'hui</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 text-center">
            <AlertTriangle className="w-5 h-5 text-amber-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-amber-400">{lateToday}</p>
            <p className="text-xs text-gray-500">Retards aujourd'hui</p>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="bg-transparent text-sm text-white focus:outline-none"
            />
          </div>
          <select
            value={selectedTeacher}
            onChange={(e) => setSelectedTeacher(e.target.value)}
            className="bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
          >
            <option value="">Tous les enseignants</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
            ))}
          </select>
          <button onClick={load} className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.07] hover:bg-white/[0.08] transition-colors">
            <RefreshCw className={cn("w-4 h-4 text-gray-400", loading && "animate-spin")} />
          </button>
        </motion.div>

        {error && (
          <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* Badges list */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-semibold text-gray-300">Pointages ({badges.length})</span>
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
              <RefreshCw className="w-4 h-4 animate-spin" /><span className="text-sm">Chargement…</span>
            </div>
          ) : badges.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Aucun pointage pour cette période.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {badges.map((badge) => {
                const teacher = badge.teacher ?? teachers.find((t) => t.id === badge.teacherId);
                const name = teacher ? `${teacher.firstName} ${teacher.lastName}` : badge.teacherId;
                const isIn = !!badge.checkInAt;
                const isOut = !!badge.checkOutAt;
                const duration =
                  isIn && isOut
                    ? Math.round((new Date(badge.checkOutAt!).getTime() - new Date(badge.checkInAt!).getTime()) / 60000)
                    : null;

                return (
                  <div key={badge.id} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white font-medium">{name}</p>
                      <p className="text-xs text-gray-500">{formatDate(badge.date)}</p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <LogIn className="w-3 h-3" />
                          <span className={cn(isIn ? "text-emerald-400" : "text-gray-600")}>{formatTime(badge.checkInAt)}</span>
                        </div>
                        {minutesToLabel(badge.lateMinutes ?? 0)}
                      </div>
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <LogOut className="w-3 h-3" />
                          <span className={cn(isOut ? "text-blue-400" : "text-gray-600")}>{formatTime(badge.checkOutAt)}</span>
                        </div>
                        {duration !== null && (
                          <span className="text-xs text-gray-500">{Math.floor(duration / 60)}h{String(duration % 60).padStart(2, "0")}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
