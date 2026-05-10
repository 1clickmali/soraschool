"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  GraduationCap,
  RefreshCw,
  Star,
  TrendingUp,
} from "lucide-react";
import { schoolApiRequest } from "@/lib/school-api";
import { cn } from "@/lib/utils";

interface Grade {
  id: string;
  score: number | null;
  value: number | null;
  maxScore: number | null;
  subject?: { name: string };
  period?: { name: string } | string;
  createdAt: string;
}

interface Absence {
  id: string;
  status: string;
  date: string;
  scheduleSlot?: { subject?: { name: string }; startsAt?: string; endsAt?: string };
}

interface Homework {
  id: string;
  title: string;
  dueDate: string | null;
  type: string;
  subject?: { name: string };
  classroom?: { name: string };
}

interface ScheduleSlot {
  id: string;
  startsAt: string;
  endsAt: string;
  subject?: { name: string };
  teacher?: { firstName: string; lastName: string };
}

interface StudentDashboard {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    matricule: string;
    classroom?: { name: string; gradeLevel?: { name: string }; academicYear?: { name: string } };
    disciplineScore?: { score: number; atRisk: boolean };
  } | null;
  recentGrades: Grade[];
  recentAbsences: Absence[];
  upcomingHomeworks: Homework[];
  todaySchedule: ScheduleSlot[];
}

function gradeColor(v: number) {
  if (v >= 16) return { text: "text-emerald-400", bg: "bg-emerald-400/10", label: "Excellent" };
  if (v >= 14) return { text: "text-lime-400",    bg: "bg-lime-400/10",    label: "Bien" };
  if (v >= 12) return { text: "text-yellow-400",  bg: "bg-yellow-400/10",  label: "Assez bien" };
  if (v >= 10) return { text: "text-orange-400",  bg: "bg-orange-400/10",  label: "Passable" };
  return              { text: "text-red-400",      bg: "bg-red-400/10",     label: "Insuffisant" };
}

function gradeValue(g: Grade) {
  const score = g.score ?? g.value ?? 0;
  const max = g.maxScore ?? 20;
  return max ? (score / max) * 20 : score;
}

function formatTime(t?: string) {
  if (!t) return "";
  return t.slice(0, 5);
}

function formatDate(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

const HOMEWORK_LABELS: Record<string, string> = {
  DEVOIR: "Devoir",
  EXAMEN: "Examen",
  INTERROGATION: "Interrogation",
  PROJET: "Projet",
};

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export default function StudentDashboardPage() {
  const [data, setData] = useState<StudentDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    schoolApiRequest<StudentDashboard>("/api/dashboard").then(({ data: d }) => {
      if (d) setData(d);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-6 w-6 animate-spin text-violet-400" />
      </div>
    );
  }

  const student = data?.student;
  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
        <GraduationCap className="h-12 w-12 text-gray-600" />
        <p className="text-gray-400">Votre dossier élève n&apos;est pas encore configuré.</p>
        <p className="text-sm text-gray-600">Contactez l&apos;administration de l&apos;établissement.</p>
      </div>
    );
  }

  const avgGrade = data?.recentGrades.length
    ? data.recentGrades.reduce((s, g) => s + gradeValue(g), 0) / data.recentGrades.length
    : null;

  const disciplineScore = student.disciplineScore?.score ?? 100;
  const atRisk = student.disciplineScore?.atRisk ?? false;

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-2xl font-bold text-white font-heading">
          Bonjour, {student.firstName} 👋
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          {student.classroom?.name
            ? `${student.classroom.name} · ${student.classroom.gradeLevel?.name ?? ""} · ${student.classroom.academicYear?.name ?? ""}`
            : "Aucune classe assignée"}
          {" · "}Matricule : <span className="text-white font-mono">{student.matricule}</span>
        </p>
      </motion.div>

      {/* Stats row */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            icon: GraduationCap,
            label: "Moyenne générale",
            value: avgGrade != null ? `${avgGrade.toFixed(1)}/20` : "—",
            color: avgGrade != null ? gradeColor(avgGrade).text : "text-gray-400",
            bg: avgGrade != null ? gradeColor(avgGrade).bg : "bg-white/[0.04]",
          },
          {
            icon: AlertTriangle,
            label: "Absences récentes",
            value: String(data?.recentAbsences.length ?? 0),
            color: "text-rose-400",
            bg: "bg-rose-400/10",
          },
          {
            icon: BookOpen,
            label: "Travaux à rendre",
            value: String(data?.upcomingHomeworks.length ?? 0),
            color: "text-blue-400",
            bg: "bg-blue-400/10",
          },
          {
            icon: Star,
            label: "Score discipline",
            value: `${disciplineScore}/100`,
            color: atRisk ? "text-red-400" : disciplineScore >= 70 ? "text-emerald-400" : "text-orange-400",
            bg: atRisk ? "bg-red-400/10" : disciplineScore >= 70 ? "bg-emerald-400/10" : "bg-orange-400/10",
          },
        ].map((stat) => (
          <motion.div key={stat.label} variants={item}
            className={cn("rounded-2xl border border-white/[0.06] p-4", stat.bg)}
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={cn("h-4 w-4", stat.color)} />
              <span className="text-xs text-gray-500">{stat.label}</span>
            </div>
            <p className={cn("text-2xl font-bold tabular-nums", stat.color)}>{stat.value}</p>
          </motion.div>
        ))}
      </motion.div>

      {atRisk && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="mb-6 rounded-2xl border border-red-500/25 bg-red-500/10 p-4 flex items-start gap-3"
        >
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-300">Élève à risque</p>
            <p className="text-xs text-red-400/80 mt-0.5">Votre score de discipline est critique. Prenez contact avec votre professeur principal.</p>
          </div>
        </motion.div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Today's schedule */}
        <motion.div variants={item} initial="hidden" animate="show"
          className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="h-4 w-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-white">Cours du jour</h2>
          </div>
          {data?.todaySchedule.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle2 className="h-8 w-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Pas de cours programmés aujourd&apos;hui</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data?.todaySchedule.map((slot) => (
                <div key={slot.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.05] px-3 py-2.5">
                  <div className="flex flex-col items-center min-w-[44px]">
                    <span className="text-[11px] font-mono text-violet-300">{formatTime(slot.startsAt)}</span>
                    <span className="text-[10px] text-gray-600">{formatTime(slot.endsAt)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{slot.subject?.name ?? "—"}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {slot.teacher ? `${slot.teacher.firstName} ${slot.teacher.lastName}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Upcoming homeworks */}
        <motion.div variants={item} initial="hidden" animate="show"
          className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">Travaux à rendre</h2>
          </div>
          {data?.upcomingHomeworks.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle2 className="h-8 w-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Aucun travail en attente</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data?.upcomingHomeworks.map((hw) => (
                <div key={hw.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.05] px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{hw.title}</p>
                    <p className="text-xs text-gray-500">
                      {HOMEWORK_LABELS[hw.type] ?? hw.type} · {hw.subject?.name ?? ""}
                    </p>
                  </div>
                  {hw.dueDate && (
                    <div className="shrink-0 flex items-center gap-1 text-xs text-orange-400">
                      <Clock className="h-3 w-3" />
                      {formatDate(hw.dueDate)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Recent grades */}
        <motion.div variants={item} initial="hidden" animate="show"
          className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">Dernières notes</h2>
          </div>
          {data?.recentGrades.length === 0 ? (
            <div className="text-center py-6">
              <GraduationCap className="h-8 w-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Aucune note publiée</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data?.recentGrades.slice(0, 6).map((g) => {
                const v = gradeValue(g);
                const c = gradeColor(v);
                return (
                  <div key={g.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.05] px-3 py-2.5">
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold", c.bg, c.text)}>
                      {v.toFixed(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{g.subject?.name ?? "—"}</p>
                      <p className="text-xs text-gray-500">
                        {typeof g.period === "string" ? g.period : g.period?.name ?? ""}
                      </p>
                    </div>
                    <span className={cn("text-sm font-bold tabular-nums", c.text)}>
                      {v.toFixed(1)}<span className="text-xs text-gray-600">/20</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Recent absences */}
        <motion.div variants={item} initial="hidden" animate="show"
          className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="h-4 w-4 text-rose-400" />
            <h2 className="text-sm font-semibold text-white">Absences & retards</h2>
          </div>
          {data?.recentAbsences.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Aucune absence récente</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data?.recentAbsences.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.05] px-3 py-2.5">
                  <div className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    a.status === "ABSENT" ? "bg-red-400" : "bg-orange-400"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {a.scheduleSlot?.subject?.name ?? "—"}
                    </p>
                    <p className="text-xs text-gray-500">{a.status === "ABSENT" ? "Absent(e)" : "En retard"}</p>
                  </div>
                  <span className="text-xs text-gray-500">{formatDate(a.date)}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
