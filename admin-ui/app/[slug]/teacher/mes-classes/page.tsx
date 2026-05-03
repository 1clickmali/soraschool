"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { School, GraduationCap, CheckSquare, Star, BookOpen, Users } from "lucide-react";
import { schoolApiRequest } from "@/lib/school-api";
import { cn } from "@/lib/utils";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

interface Assignment {
  id: string;
  classroom?: { id: string; name: string; studentCount?: number };
  subject?: { id: string; name: string };
}

interface ClassGroup {
  classroom: { id: string; name: string; studentCount?: number };
  subjects: { id: string; name: string }[];
}

function SkeletonClassCard() {
  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 animate-pulse space-y-3">
      <div className="h-5 bg-white/10 rounded w-32" />
      <div className="h-3 bg-white/[0.07] rounded w-24" />
      <div className="h-3 bg-white/[0.07] rounded w-20" />
    </div>
  );
}

export default function MesClassesPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    schoolApiRequest<{ assignments?: Assignment[] } | Assignment[]>("/api/academics/assignments").then(({ data }) => {
      let assignments: Assignment[] = [];
      if (Array.isArray(data)) assignments = data;
      else if (data && "assignments" in data && Array.isArray(data.assignments)) assignments = data.assignments;

      // Group by classroom
      const map: Record<string, ClassGroup> = {};
      for (const a of assignments) {
        if (!a.classroom) continue;
        if (!map[a.classroom.id]) {
          map[a.classroom.id] = { classroom: a.classroom, subjects: [] };
        }
        if (a.subject && !map[a.classroom.id].subjects.find((s) => s.id === a.subject!.id)) {
          map[a.classroom.id].subjects.push(a.subject);
        }
      }
      setClassGroups(Object.values(map));
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold font-heading text-white">Mes classes</h1>
        <p className="text-gray-400 text-sm mt-1">
          {loading ? "Chargement…" : `${classGroups.length} classe${classGroups.length !== 1 ? "s" : ""} assignée${classGroups.length !== 1 ? "s" : ""}`}
        </p>
      </motion.div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <SkeletonClassCard key={i} />)}
        </div>
      ) : classGroups.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 text-gray-500"
        >
          <School className="w-14 h-14 mb-3 opacity-20" />
          <p className="text-base font-medium text-gray-400">Aucune classe assignée</p>
          <p className="text-sm mt-1">Contactez votre administration</p>
        </motion.div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {classGroups.map(({ classroom, subjects }) => (
            <motion.div
              key={classroom.id}
              variants={item}
              className={cn(
                "relative bg-soraCard border rounded-2xl p-5 hover:bg-white/[0.06] transition-colors overflow-hidden group",
                "border-violet-500/20 hover:border-violet-500/35"
              )}
            >
              {/* Accent gradient */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />

              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center">
                  <School className="w-5 h-5 text-violet-400" />
                </div>
                {classroom.studentCount !== undefined && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Users className="w-3.5 h-3.5" />
                    <span>{classroom.studentCount} élèves</span>
                  </div>
                )}
              </div>

              <h3 className="text-lg font-bold text-white font-heading mb-1">{classroom.name}</h3>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {subjects.map((s) => (
                  <span
                    key={s.id}
                    className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 font-medium"
                  >
                    {s.name}
                  </span>
                ))}
                {subjects.length === 0 && (
                  <span className="text-xs text-gray-600">Aucune matière</span>
                )}
              </div>

              <div className="flex gap-2 flex-wrap">
                <Link
                  href={`/${slug}/teacher/presences?classroomId=${classroom.id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 text-xs font-medium transition-colors"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  Faire l&apos;appel
                </Link>
                <Link
                  href={`/${slug}/teacher/notes?classroomId=${classroom.id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-gray-300 text-xs font-medium transition-colors"
                >
                  <Star className="w-3.5 h-3.5" />
                  Notes
                </Link>
                <Link
                  href={`/${slug}/teacher/devoirs?classroomId=${classroom.id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-gray-300 text-xs font-medium transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Devoirs
                </Link>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {!loading && classGroups.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6 flex items-center gap-2 text-xs text-gray-600"
        >
          <GraduationCap className="w-3.5 h-3.5" />
          <span>
            Total : {classGroups.length} classe{classGroups.length !== 1 ? "s" : ""} ·{" "}
            {[...new Set(classGroups.flatMap((g) => g.subjects.map((s) => s.id)))].length} matière
            {[...new Set(classGroups.flatMap((g) => g.subjects.map((s) => s.id)))].length !== 1 ? "s" : ""}
          </span>
        </motion.div>
      )}
    </div>
  );
}
