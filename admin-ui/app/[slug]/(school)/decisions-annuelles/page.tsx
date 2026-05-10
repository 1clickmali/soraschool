"use client";

import { useEffect, useState, useCallback } from "react";
import {
  GraduationCap,
  Play,
  CheckCircle,
  AlertCircle,
  Loader2,
  Users,
} from "lucide-react";
import { schoolApi, schoolAuthApi, schoolApiRequest, type AcademicYear } from "@/lib/school-api";

type DecisionStatus = "PENDING" | "ADMITTED" | "REPEATING" | "TRANSFERRED" | "EXCLUDED" | "GRADUATED";

interface AnnualDecision {
  id: string;
  studentId: string;
  academicYearId: string;
  classroomId?: string;
  annualAverage?: number;
  proposedStatus: DecisionStatus;
  finalStatus?: DecisionStatus;
  nextClassroomId?: string;
  notes?: string;
  validatedAt?: string;
  student: { id: string; firstName: string; lastName: string; matricule: string };
  validatedBy?: { firstName: string; lastName: string };
}

interface DecisionStats {
  total: number;
  admitted: number;
  repeating: number;
  transferred: number;
  excluded: number;
  graduated: number;
  pending: number;
}

const STATUS_LABELS: Record<DecisionStatus, string> = {
  PENDING: "En attente",
  ADMITTED: "Admis(e)",
  REPEATING: "Redoublant(e)",
  TRANSFERRED: "Transféré(e)",
  EXCLUDED: "Exclu(e)",
  GRADUATED: "Diplômé(e)",
};

const STATUS_COLORS: Record<DecisionStatus, string> = {
  PENDING: "bg-gray-100 text-gray-600",
  ADMITTED: "bg-green-100 text-green-700",
  REPEATING: "bg-orange-100 text-orange-700",
  TRANSFERRED: "bg-blue-100 text-blue-700",
  EXCLUDED: "bg-red-100 text-red-700",
  GRADUATED: "bg-purple-100 text-purple-700",
};

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl p-4 text-center ${color}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-xs mt-1 opacity-80">{label}</div>
    </div>
  );
}

export default function DecisionsAnnuellesPage() {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [classrooms, setClassrooms] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedClassroom, setSelectedClassroom] = useState<string>("");

  const [decisions, setDecisions] = useState<AnnualDecision[]>([]);
  const [stats, setStats] = useState<DecisionStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [bulkValidating, setBulkValidating] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<DecisionStatus>("ADMITTED");
  const [editNotes, setEditNotes] = useState("");

  const [userRole, setUserRole] = useState<string>("DIRECTOR");

  useEffect(() => {
    (async () => {
      const [meRes, yearsRes, clsRes] = await Promise.all([
        schoolAuthApi.me(),
        schoolApi.academicYears(),
        schoolApi.classes(),
      ]);
      if (meRes.data?.role) setUserRole(meRes.data.role);
      if (yearsRes.data?.academicYears) {
        setAcademicYears(yearsRes.data.academicYears);
        const active = yearsRes.data.academicYears.find((y: AcademicYear) => y.isActive);
        if (active) setSelectedYear(active.id);
      }
      if (clsRes.data?.classes) setClassrooms(clsRes.data.classes);
    })();
  }, []);

  const fetchDecisions = useCallback(async () => {
    if (!selectedYear) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ academicYearId: selectedYear, page: String(page), limit: "50" });
    if (selectedClassroom) params.set("classroomId", selectedClassroom);

    const [decisRes, statsRes] = await Promise.all([
      schoolApiRequest<{ decisions: AnnualDecision[]; total: number }>(`/api/annual-decisions?${params}`),
      schoolApiRequest<{ stats: DecisionStats }>(`/api/annual-decisions/stats/${selectedYear}`),
    ]);

    if (decisRes.data) {
      setDecisions(decisRes.data.decisions);
      setTotal(decisRes.data.total);
    } else {
      setError(decisRes.error ?? "Erreur chargement");
    }
    if (statsRes.data) setStats(statsRes.data.stats);
    setLoading(false);
  }, [selectedYear, selectedClassroom, page]);

  useEffect(() => {
    fetchDecisions();
  }, [fetchDecisions]);

  const handleCalculate = async () => {
    if (!selectedYear) return;
    setCalculating(true);
    setError(null);
    const res = await schoolApiRequest<{ processed: number }>("/api/annual-decisions/calculate", {
      method: "POST",
      body: { academicYearId: selectedYear },
    });
    if (res.data) {
      setSuccess(`${res.data.processed} décisions calculées automatiquement`);
      fetchDecisions();
    } else {
      setError(res.error ?? "Erreur calcul");
    }
    setCalculating(false);
  };

  const handleBulkValidate = async () => {
    if (!selectedYear || !confirm("Valider toutes les décisions proposées ?")) return;
    setBulkValidating(true);
    setError(null);
    const res = await schoolApiRequest<{ validated: number }>("/api/annual-decisions/bulk-validate", {
      method: "POST",
      body: { academicYearId: selectedYear },
    });
    if (res.data) {
      setSuccess(`${res.data.validated} décisions validées`);
      fetchDecisions();
    } else {
      setError(res.error ?? "Erreur validation");
    }
    setBulkValidating(false);
  };

  const handleValidate = async (id: string) => {
    const res = await schoolApiRequest(`/api/annual-decisions/${id}/validate`, {
      method: "POST",
      body: { finalStatus: editStatus, notes: editNotes || undefined },
    });
    if (res.data) {
      setSuccess("Décision validée");
      setEditingId(null);
      fetchDecisions();
    } else {
      setError(res.error ?? "Erreur");
    }
  };

  const handlePromote = async () => {
    if (!selectedYear || !confirm("Appliquer les décisions validées aux élèves concernés ?")) return;
    setPromoting(true);
    setError(null);
    const res = await schoolApiRequest<{ summary: { totalApplied: number } }>("/api/annual-decisions/promote", {
      method: "POST",
      body: { academicYearId: selectedYear },
    });
    if (res.data) {
      setSuccess(`${res.data.summary.totalApplied} décision(s) appliquée(s) aux dossiers élèves`);
      fetchDecisions();
    } else {
      setError(res.error ?? "Erreur lors de l'application des promotions");
    }
    setPromoting(false);
  };

  const isDirector = ["DIRECTOR", "CENTRAL_ADMIN"].includes(userRole);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Décisions annuelles</h1>
            <p className="text-sm text-gray-500">Admission, redoublement, transfert de fin d'année</p>
          </div>
        </div>
        {isDirector && (
          <div className="flex gap-2">
            <button
              onClick={handleCalculate}
              disabled={!selectedYear || calculating}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-60"
            >
              {calculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Calculer les moyennes
            </button>
            <button
              onClick={handleBulkValidate}
              disabled={!selectedYear || bulkValidating}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-60"
            >
              {bulkValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Valider toutes
            </button>
            <button
              onClick={handlePromote}
              disabled={!selectedYear || promoting}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition disabled:opacity-60"
            >
              {promoting ? <Loader2 className="w-4 h-4 animate-spin" /> : <GraduationCap className="w-4 h-4" />}
              Appliquer les promotions
            </button>
          </div>
        )}
      </div>

      {/* Banners */}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />{success}
          <button className="ml-auto text-emerald-500 hover:text-emerald-700" onClick={() => setSuccess(null)}>✕</button>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border rounded-xl p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Année scolaire</label>
          <select
            value={selectedYear}
            onChange={(e) => { setSelectedYear(e.target.value); setPage(1); }}
            className="border rounded-lg px-3 py-2 text-sm min-w-[180px]"
          >
            <option value="">— Choisir —</option>
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Classe</label>
          <select
            value={selectedClassroom}
            onChange={(e) => { setSelectedClassroom(e.target.value); setPage(1); }}
            className="border rounded-lg px-3 py-2 text-sm min-w-[160px]"
          >
            <option value="">Toutes les classes</option>
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3">
          <StatCard label="Total" value={stats.total} color="bg-gray-50 text-gray-800" />
          <StatCard label="Admis" value={stats.admitted} color="bg-green-50 text-green-800" />
          <StatCard label="Redoublants" value={stats.repeating} color="bg-orange-50 text-orange-800" />
          <StatCard label="Transférés" value={stats.transferred} color="bg-blue-50 text-blue-800" />
          <StatCard label="Exclus" value={stats.excluded} color="bg-red-50 text-red-800" />
          <StatCard label="Diplômés" value={stats.graduated} color="bg-purple-50 text-purple-800" />
          <StatCard label="En attente" value={stats.pending} color="bg-yellow-50 text-yellow-800" />
        </div>
      )}

      {/* Table */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Décisions ({total})
          </h3>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
        </div>

        {decisions.length === 0 && !loading ? (
          <div className="p-10 text-center text-gray-400">
            {selectedYear ? "Aucune décision. Cliquez sur « Calculer les moyennes » pour commencer." : "Sélectionnez une année scolaire."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Élève", "Matricule", "Moyenne", "Proposé", "Décision finale", "Validé par", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {decisions.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {d.student.firstName} {d.student.lastName}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{d.student.matricule}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">
                      {d.annualAverage !== undefined && d.annualAverage !== null
                        ? `${d.annualAverage.toFixed(2)}/20`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[d.proposedStatus]}`}>
                        {STATUS_LABELS[d.proposedStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {d.finalStatus ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[d.finalStatus]}`}>
                          {STATUS_LABELS[d.finalStatus]}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {d.validatedBy ? `${d.validatedBy.firstName} ${d.validatedBy.lastName}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {isDirector && !d.finalStatus && (
                        editingId === d.id ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <select
                              value={editStatus}
                              onChange={(e) => setEditStatus(e.target.value as DecisionStatus)}
                              className="border rounded-lg px-2 py-1 text-xs"
                            >
                              {(["ADMITTED", "REPEATING", "TRANSFERRED", "EXCLUDED", "GRADUATED"] as DecisionStatus[]).map((s) => (
                                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleValidate(d.id)}
                              className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700"
                            >
                              Valider
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-2 py-1 border rounded-lg text-xs hover:bg-gray-50"
                            >
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingId(d.id); setEditStatus(d.proposedStatus !== "PENDING" ? d.proposedStatus : "ADMITTED"); setEditNotes(""); }}
                            className="px-2.5 py-1 border rounded-lg text-xs text-gray-700 hover:bg-gray-50 transition"
                          >
                            Valider
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > 50 && (
          <div className="px-5 py-3 border-t flex items-center justify-between text-sm text-gray-500">
            <span>{(page - 1) * 50 + 1}–{Math.min(page * 50, total)} sur {total}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded-lg disabled:opacity-40 hover:bg-gray-50">Préc.</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page * 50 >= total} className="px-3 py-1 border rounded-lg disabled:opacity-40 hover:bg-gray-50">Suiv.</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
