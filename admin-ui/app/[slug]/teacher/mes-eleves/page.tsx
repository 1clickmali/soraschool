"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, Search } from "lucide-react";
import { schoolApiRequest, type Student } from "@/lib/school-api";
import { cn } from "@/lib/utils";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
};

interface Assignment {
  classroom?: { id: string; name: string };
}

interface StudentWithClass extends Student {
  classroomName?: string;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    ACTIVE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    ENROLLED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    PENDING: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    SUSPENDED: "bg-red-500/15 text-red-400 border-red-500/25",
    GRADUATED: "bg-blue-500/15 text-blue-400 border-blue-500/25",
    INACTIVE: "bg-gray-500/15 text-gray-400 border-gray-500/25",
  };
  const labels: Record<string, string> = {
    ACTIVE: "Actif",
    ENROLLED: "Inscrit",
    PENDING: "En attente",
    SUSPENDED: "Suspendu",
    GRADUATED: "Diplômé",
    INACTIVE: "Inactif",
  };
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", map[status] || "bg-gray-500/15 text-gray-400 border-gray-500/25")}>
      {labels[status] || status}
    </span>
  );
}

export default function MesElevesPage() {
  const [classrooms, setClassrooms] = useState<{ id: string; name: string }[]>([]);
  const [students, setStudents] = useState<StudentWithClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      // Get assignments to know teacher's classrooms
      const assignRes = await schoolApiRequest<{ assignments?: Assignment[] } | Assignment[]>("/api/academics/assignments");
      let assignments: Assignment[] = [];
      if (Array.isArray(assignRes.data)) assignments = assignRes.data;
      else if (assignRes.data && "assignments" in assignRes.data) assignments = assignRes.data.assignments || [];

      const classMap: Record<string, { id: string; name: string }> = {};
      for (const a of assignments) {
        if (a.classroom) classMap[a.classroom.id] = a.classroom;
      }
      const classroomList = Object.values(classMap);
      setClassrooms(classroomList);

      // Fetch students for each classroom
      const allStudents: StudentWithClass[] = [];
      await Promise.all(
        classroomList.map(async (cls) => {
          const res = await schoolApiRequest<{ students?: Student[] } | Student[]>(
            `/api/students?classroomId=${cls.id}`
          );
          let studs: Student[] = [];
          if (Array.isArray(res.data)) studs = res.data;
          else if (res.data && "students" in res.data) studs = res.data.students || [];

          for (const s of studs) {
            if (!allStudents.find((existing) => existing.id === s.id)) {
              allStudents.push({ ...s, classroomName: cls.name });
            }
          }
        })
      );
      setStudents(allStudents);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = students;
    if (selectedClass !== "all") {
      list = list.filter((s) => s.classroomId === selectedClass || s.classroom?.id === selectedClass);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.firstName.toLowerCase().includes(q) ||
          s.lastName.toLowerCase().includes(q) ||
          (s.matricule || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [students, selectedClass, search]);

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold font-heading text-white">Mes élèves</h1>
        <p className="text-gray-400 text-sm mt-1">
          {loading
            ? "Chargement…"
            : `Mon total : ${students.length} élève${students.length !== 1 ? "s" : ""} dans ${classrooms.length} classe${classrooms.length !== 1 ? "s" : ""}`}
        </p>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-3 mb-6"
      >
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Rechercher un élève…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.07] transition-all"
          />
        </div>

        {/* Class tabs */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedClass("all")}
            className={cn(
              "px-3 py-2 rounded-xl text-xs font-medium transition-all",
              selectedClass === "all"
                ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                : "bg-white/[0.04] text-gray-400 border border-white/10 hover:bg-white/[0.07]"
            )}
          >
            Toutes ({students.length})
          </button>
          {classrooms.map((cls) => {
            const count = students.filter((s) => s.classroomId === cls.id || s.classroom?.id === cls.id).length;
            return (
              <button
                key={cls.id}
                onClick={() => setSelectedClass(cls.id)}
                className={cn(
                  "px-3 py-2 rounded-xl text-xs font-medium transition-all",
                  selectedClass === cls.id
                    ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                    : "bg-white/[0.04] text-gray-400 border border-white/10 hover:bg-white/[0.07]"
                )}
              >
                {cls.name} ({count})
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden"
      >
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-9 h-9 rounded-full bg-white/10 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-white/10 rounded w-40" />
                  <div className="h-2.5 bg-white/[0.07] rounded w-24" />
                </div>
                <div className="h-5 bg-white/[0.07] rounded-full w-16" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <GraduationCap className="w-12 h-12 mb-2 opacity-20" />
            <p className="text-sm font-medium text-gray-400">Aucun élève trouvé</p>
            {search && <p className="text-xs mt-1">Essayez un autre terme de recherche</p>}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Élève</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide hidden md:table-cell">Matricule</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide hidden sm:table-cell">Classe</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Statut</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide hidden lg:table-cell">Parent</th>
                  </tr>
                </thead>
                <AnimatePresence mode="wait">
                  <motion.tbody
                    key={selectedClass + search}
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="divide-y divide-white/[0.04]"
                  >
                    {filtered.map((s) => (
                      <motion.tr
                        key={s.id}
                        variants={item}
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                              {(s.firstName[0] + s.lastName[0]).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-white">{s.firstName} {s.lastName}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{s.matricule || "—"}</td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 font-medium">
                            {s.classroomName || s.classroom?.name || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">{statusBadge(s.status)}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">
                          {s.parentPhone || s.guardianPhone || s.fatherPhone || "—"}
                        </td>
                      </motion.tr>
                    ))}
                  </motion.tbody>
                </AnimatePresence>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-white/[0.06] text-xs text-gray-600">
              {filtered.length} élève{filtered.length !== 1 ? "s" : ""} affiché{filtered.length !== 1 ? "s" : ""}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
