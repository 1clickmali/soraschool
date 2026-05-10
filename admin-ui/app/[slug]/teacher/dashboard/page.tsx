"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  LayoutGrid,
  GraduationCap,
  CheckSquare,
  Star,
  BookOpen,
  MessageSquare,
  ClipboardCheck,
  PenLine,
  Clock,
  UserX,
} from "lucide-react";
import { schoolApi, type Assignment, type SchoolDashboardData, type ScheduleSlot } from "@/lib/school-api";
import { cn } from "@/lib/utils";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  iconColor: string;
}

function StatCard({ icon: Icon, label, value, sub, color, iconColor }: StatCardProps) {
  return (
    <motion.div variants={item}>
      <div className={cn("border rounded-2xl p-5 hover:bg-white/[0.05] transition-colors", color)}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold text-white font-heading mt-1.5">{value}</p>
            {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
          </div>
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", iconColor)}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 animate-pulse">
      <div className="h-3 bg-white/10 rounded w-24 mb-3" />
      <div className="h-7 bg-white/10 rounded w-16" />
    </div>
  );
}

function formatSlotTime(slot: ScheduleSlot) {
  return `${slot.startsAt.replace(":", "h")} – ${slot.endsAt.replace(":", "h")}`;
}

export default function TeacherDashboardPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [dashData, setDashData] = useState<SchoolDashboardData | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [dashRes, assignRes] = await Promise.all([
        schoolApi.dashboard(),
        schoolApi.assignments(),
      ]);

      if (dashRes.data) setDashData(dashRes.data);
      setAssignments(assignRes.data?.assignments || []);
      setLoading(false);
    };
    load();
  }, []);

  // Deduplicate classrooms from assignments
  const uniqueClassrooms = assignments.reduce<Record<string, Assignment["classroom"]>>((acc, a) => {
    if (a.classroom) acc[a.classroom.id] = a.classroom;
    return acc;
  }, {});
  const classroomCount = Object.keys(uniqueClassrooms).length;

  const stats: StatCardProps[] = [
    {
      icon: LayoutGrid,
      label: "Mes classes",
      value: loading ? "…" : classroomCount || "—",
      color: "bg-violet-500/8 border-violet-500/15",
      iconColor: "bg-violet-500/20 text-violet-400",
    },
    {
      icon: GraduationCap,
      label: "Mes élèves",
      value: loading ? "…" : dashData?.totalStudents ?? "—",
      sub: "Toutes mes classes",
      color: "bg-white/[0.03] border-white/[0.07]",
      iconColor: "bg-blue-500/20 text-blue-400",
    },
    {
      icon: CheckSquare,
      label: "Absences récentes",
      value: loading ? "…" : dashData?.recentAbsences ?? 0,
      sub: "7 derniers jours",
      color: "bg-white/[0.03] border-white/[0.07]",
      iconColor: "bg-emerald-500/20 text-emerald-400",
    },
    {
      icon: Star,
      label: "Évaluations saisies",
      value: loading ? "…" : dashData?.gradesCount ?? 0,
      color: "bg-white/[0.03] border-white/[0.07]",
      iconColor: "bg-amber-500/20 text-amber-400",
    },
    {
      icon: BookOpen,
      label: "Affectations",
      value: loading ? "…" : dashData?.assignments ?? classroomCount,
      sub: "Matières / classes",
      color: "bg-white/[0.03] border-white/[0.07]",
      iconColor: "bg-orange-500/20 text-orange-400",
    },
    {
      icon: MessageSquare,
      label: "Conversations",
      value: loading ? "…" : dashData?.urgentMessages ?? 0,
      color: "bg-white/[0.03] border-white/[0.07]",
      iconColor: "bg-pink-500/20 text-pink-400",
    },
  ];

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold font-heading text-white">Tableau de bord</h1>
        <p className="text-gray-400 text-sm mt-1">Bienvenue dans votre espace enseignant</p>
      </motion.div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6"
        >
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </motion.div>
      )}

      {/* Quick actions */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="mb-6"
      >
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Actions rapides</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/${slug}/teacher/presences`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/25 text-violet-300 text-sm font-medium transition-all hover:scale-[1.02]"
          >
            <ClipboardCheck className="w-4 h-4" />
            Faire l&apos;appel
          </Link>
          <Link
            href={`/${slug}/teacher/notes`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 text-gray-300 text-sm font-medium transition-all hover:scale-[1.02]"
          >
            <PenLine className="w-4 h-4" />
            Saisir notes
          </Link>
          <Link
            href={`/${slug}/teacher/devoirs`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 text-gray-300 text-sm font-medium transition-all hover:scale-[1.02]"
          >
            <BookOpen className="w-4 h-4" />
            Donner un devoir
          </Link>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Assignments table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="lg:col-span-2 bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden"
        >
          <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
            <LayoutGrid className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-white">Mes affectations</h2>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 bg-white/[0.05] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : assignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <LayoutGrid className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">Aucune affectation trouvée</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Classe</th>
                    <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Matière</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {assignments.map((a) => (
                    <tr key={a.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3 text-white font-medium">{a.classroom?.name || "—"}</td>
                      <td className="px-5 py-3 text-gray-300">{a.subject?.name || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Today's schedule */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-violet-400" />
              <h2 className="text-sm font-semibold text-white">Emploi du temps aujourd&apos;hui</h2>
            </div>
            <div className="space-y-2">
              {(dashData?.todaySchedule || []).length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">Aucun cours planifié aujourd&apos;hui</p>
              ) : (
                (dashData?.todaySchedule || []).map((slot) => (
                  <div key={slot.id} className="flex items-start gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <div className="w-1 h-full min-h-[40px] bg-violet-500 rounded-full flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-violet-300">{formatSlotTime(slot)}</p>
                      <p className="text-sm text-white font-medium">{slot.subject?.name || "Matière non définie"}</p>
                      <p className="text-xs text-gray-500">{slot.classroom?.name || "Classe non définie"} · {slot.room || "Salle non définie"}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>

          {/* Recent absences */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <UserX className="w-4 h-4 text-red-400" />
              <h2 className="text-sm font-semibold text-white">Absences récentes</h2>
            </div>
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4">
              <p className="text-3xl font-bold text-white font-heading">{dashData?.recentAbsences ?? 0}</p>
              <p className="text-xs text-red-300/80 mt-1">absence(s) ou retard(s) sur vos classes cette semaine</p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
