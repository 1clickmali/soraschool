"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  BarChart2,
  FileDown,
  FileSpreadsheet,
  FileText,
  History,
  RefreshCw,
  Filter,
  AlertCircle,
  CheckCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Download,
} from "lucide-react";
import { schoolApi, schoolAuthApi, reportsApi, type ReportFilters, type ReportType, type ExportLog } from "@/lib/school-api";
import { getSchoolToken } from "@/lib/school-auth";
import { getApiBaseUrl } from "@/lib/api-url";

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  DAILY: "Rapport journalier",
  WEEKLY: "Rapport hebdomadaire",
  MONTHLY: "Rapport mensuel",
  QUARTERLY: "Rapport trimestriel",
  SEMESTER: "Rapport semestriel",
  ANNUAL: "Rapport annuel",
  SCHOOL_YEAR: "Rapport par année scolaire",
};

const SECTIONS = [
  { key: "summary", label: "Résumé général", roles: ["DIRECTOR", "CENTRAL_ADMIN", "ADMINISTRATION"] },
  { key: "finance", label: "Rapport financier", roles: ["DIRECTOR", "CENTRAL_ADMIN", "ACCOUNTANT", "ADMINISTRATION"] },
  { key: "pedagogy", label: "Pédagogie & notes", roles: ["DIRECTOR", "CENTRAL_ADMIN", "ADMINISTRATION"] },
  { key: "attendance", label: "Présences élèves", roles: ["DIRECTOR", "CENTRAL_ADMIN", "ADMINISTRATION"] },
  { key: "teachers", label: "Rapport enseignants", roles: ["DIRECTOR", "CENTRAL_ADMIN", "ADMINISTRATION"] },
  { key: "discipline", label: "Vie scolaire / discipline", roles: ["DIRECTOR", "CENTRAL_ADMIN", "ADMINISTRATION"] },
  { key: "calendar", label: "Calendrier scolaire", roles: ["DIRECTOR", "CENTRAL_ADMIN", "ADMINISTRATION"] },
  { key: "administrative", label: "Administratif", roles: ["DIRECTOR", "CENTRAL_ADMIN", "SECRETARIAT", "ADMINISTRATION"] },
];

interface PreviewData {
  summary?: Record<string, unknown>;
  finance?: Record<string, unknown>;
  pedagogy?: Record<string, unknown>;
  attendance?: Record<string, unknown>;
  teachers?: Record<string, unknown>;
  discipline?: Record<string, unknown>;
  calendar?: Record<string, unknown>;
  administrative?: Record<string, unknown>;
}

export default function RapportsPage() {
  const { slug } = useParams() as { slug: string };

  const [userRole, setUserRole] = useState<string>("DIRECTOR");
  const [classrooms, setClassrooms] = useState<Array<{ id: string; name: string }>>([]);

  const [filters, setFilters] = useState<ReportFilters>({
    reportType: "MONTHLY",
    sections: SECTIONS.map((s) => s.key).join(","),
  });
  const [selectedSections, setSelectedSections] = useState<Set<string>>(
    new Set(SECTIONS.map((s) => s.key))
  );

  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewMeta, setPreviewMeta] = useState<{ startDate: string; endDate: string } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [exportLoading, setExportLoading] = useState<"pdf" | "excel" | "csv" | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  const [history, setHistory] = useState<ExportLog[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    (async () => {
      const [meRes, classRes] = await Promise.all([
        schoolAuthApi.me(),
        schoolApi.classes(),
      ]);
      if (meRes.data?.role) setUserRole(meRes.data.role as string);
      if (classRes.data?.classes) setClassrooms(classRes.data.classes);
    })();
  }, []);

  const fetchPreview = useCallback(async () => {
    setLoadingPreview(true);
    setPreviewError(null);
    const f = { ...filters, sections: Array.from(selectedSections).join(",") };
    const res = await reportsApi.preview(f);
    if (res.data) {
      setPreviewData(res.data.data as PreviewData);
      setPreviewMeta({ startDate: res.data.meta.startDate, endDate: res.data.meta.endDate });
    } else {
      setPreviewError(res.error ?? "Erreur lors du chargement du rapport");
    }
    setLoadingPreview(false);
  }, [filters, selectedSections]);

  const doExport = async (format: "pdf" | "excel" | "csv") => {
    setExportLoading(format);
    setExportSuccess(null);
    try {
      const token = getSchoolToken();
      const f = { ...filters, sections: Array.from(selectedSections).join(",") };
      const params = new URLSearchParams();
      Object.entries(f).forEach(([k, v]) => { if (v) params.set(k, String(v)); });
      const url = `${getApiBaseUrl()}/api/reports/export/${format}?${params.toString()}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Erreur export" }));
        setPreviewError(err.message ?? "Erreur lors de l'export");
      } else {
        const blob = await res.blob();
        const ext = format === "pdf" ? "pdf" : format === "excel" ? "xlsx" : "csv";
        const fileName = `rapport_${f.reportType ?? "mensuel"}_${new Date().toISOString().slice(0, 10)}.${ext}`;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(a.href);
        setExportSuccess(`${fileName} téléchargé`);
        fetchHistory();
      }
    } catch {
      setPreviewError("Erreur réseau lors de l'export");
    }
    setExportLoading(null);
  };

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    const res = await reportsApi.history();
    if (res.data) {
      setHistory(res.data.logs);
      setHistoryTotal(res.data.total);
    }
    setLoadingHistory(false);
  }, []);

  const toggleSection = (key: string) => {
    setSelectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const visibleSections = SECTIONS.filter((s) =>
    s.roles.includes(userRole)
  );

  const fmt = (n: unknown) => typeof n === "number" ? n.toLocaleString("fr-FR") : "—";
  const fmtXOF = (n: unknown) => typeof n === "number" ? `${n.toLocaleString("fr-FR")} XOF` : "—";
  const fmtPct = (n: unknown) => typeof n === "number" ? `${n.toFixed(1)}%` : "—";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
            <BarChart2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Rapports & exports</h1>
            <p className="text-sm text-gray-500">Générez et exportez vos rapports scolaires</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowHistory(!showHistory); if (!showHistory) fetchHistory(); }}
            className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 transition"
          >
            <History className="w-4 h-4" />
            Historique {historyTotal > 0 && <span className="ml-1 px-1.5 py-0.5 bg-gray-100 rounded-full text-xs">{historyTotal}</span>}
          </button>
        </div>
      </div>

      {/* Success / Error banners */}
      {exportSuccess && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {exportSuccess}
        </div>
      )}
      {previewError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {previewError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Config */}
        <div className="space-y-4">
          {/* Type de rapport */}
          <div className="bg-white border rounded-xl p-4 space-y-3">
            <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Type de rapport</h2>
            <div className="space-y-1">
              {(Object.entries(REPORT_TYPE_LABELS) as Array<[ReportType, string]>).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilters((f) => ({ ...f, reportType: key }))}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                    filters.reportType === key
                      ? "bg-emerald-600 text-white font-medium"
                      : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Filtres avancés */}
          <div className="bg-white border rounded-xl overflow-hidden">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="w-full flex items-center justify-between p-4 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition"
            >
              <span className="flex items-center gap-2"><Filter className="w-4 h-4" />Filtres avancés</span>
              {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showFilters && (
              <div className="px-4 pb-4 space-y-3 border-t">
                <div>
                  <label className="text-xs text-gray-500 font-medium">Période personnalisée</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <input
                      type="date"
                      value={filters.startDate?.slice(0, 10) ?? ""}
                      onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value ? new Date(e.target.value).toISOString() : undefined }))}
                      className="text-xs border rounded-lg px-2 py-1.5 w-full"
                    />
                    <input
                      type="date"
                      value={filters.endDate?.slice(0, 10) ?? ""}
                      onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value ? new Date(e.target.value).toISOString() : undefined }))}
                      className="text-xs border rounded-lg px-2 py-1.5 w-full"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Classe</label>
                  <select
                    value={filters.classroomId ?? ""}
                    onChange={(e) => setFilters((f) => ({ ...f, classroomId: e.target.value || undefined }))}
                    className="text-xs border rounded-lg px-2 py-1.5 w-full mt-1"
                  >
                    <option value="">Toutes les classes</option>
                    {classrooms.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Sections */}
          <div className="bg-white border rounded-xl p-4 space-y-3">
            <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Sections incluses</h2>
            <div className="space-y-2">
              {visibleSections.map((s) => (
                <label key={s.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedSections.has(s.key)}
                    onChange={() => toggleSection(s.key)}
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700">{s.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={fetchPreview}
              disabled={loadingPreview}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition disabled:opacity-60"
            >
              {loadingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Prévisualiser
            </button>
            <button
              onClick={() => doExport("pdf")}
              disabled={!!exportLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition disabled:opacity-60"
            >
              {exportLoading === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Exporter PDF
            </button>
            <button
              onClick={() => doExport("excel")}
              disabled={!!exportLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-60"
            >
              {exportLoading === "excel" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              Exporter Excel (.xlsx)
            </button>
            <button
              onClick={() => doExport("csv")}
              disabled={!!exportLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition disabled:opacity-60"
            >
              {exportLoading === "csv" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              Exporter CSV
            </button>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="lg:col-span-2 space-y-4">
          {!previewData && !loadingPreview && (
            <div className="bg-white border rounded-xl p-12 flex flex-col items-center justify-center text-center space-y-3">
              <BarChart2 className="w-12 h-12 text-gray-200" />
              <p className="text-gray-500 font-medium">Aucun rapport chargé</p>
              <p className="text-gray-400 text-sm">Configurez les options et cliquez sur "Prévisualiser"</p>
            </div>
          )}

          {loadingPreview && (
            <div className="bg-white border rounded-xl p-12 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
          )}

          {previewData && !loadingPreview && (
            <>
              {previewMeta && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800">
                  Période : <strong>{new Date(previewMeta.startDate).toLocaleDateString("fr-FR")}</strong> → <strong>{new Date(previewMeta.endDate).toLocaleDateString("fr-FR")}</strong>
                </div>
              )}

              {/* Summary */}
              {previewData.summary && (
                <div className="bg-white border rounded-xl p-5">
                  <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span>A. Résumé général
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "Élèves", value: fmt(previewData.summary.students) },
                      { label: "Enseignants", value: fmt(previewData.summary.teachers) },
                      { label: "Classes", value: fmt(previewData.summary.classrooms) },
                      { label: "Utilisateurs actifs", value: fmt(previewData.summary.activeUsers) },
                    ].map((kpi) => (
                      <div key={kpi.label} className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-emerald-700">{kpi.value}</div>
                        <div className="text-xs text-gray-500 mt-1">{kpi.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Finance */}
              {previewData.finance && (
                <div className="bg-white border rounded-xl p-5">
                  <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-500"></span>B. Rapport financier
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      { label: "Encaissé", value: fmtXOF(previewData.finance.collected), color: "text-emerald-700" },
                      { label: "Total facturé", value: fmtXOF(previewData.finance.totalDue), color: "text-blue-700" },
                      { label: "Reste à payer", value: fmtXOF(previewData.finance.remaining), color: "text-red-600" },
                      { label: "Factures retard", value: fmt(previewData.finance.lateInvoices), color: "text-orange-600" },
                      { label: "Factures générées", value: fmt(previewData.finance.invoicesGenerated), color: "text-gray-700" },
                    ].map((kpi) => (
                      <div key={kpi.label} className="bg-gray-50 rounded-lg p-3">
                        <div className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{kpi.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pedagogy */}
              {previewData.pedagogy && (
                <div className="bg-white border rounded-xl p-5">
                  <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>C. Rapport pédagogique
                  </h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-blue-700">
                        {typeof previewData.pedagogy.averageGrade === "number" ? previewData.pedagogy.averageGrade.toFixed(2) : "—"}/20
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Moyenne générale</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-green-700">{fmtPct(previewData.pedagogy.successRate)}</div>
                      <div className="text-xs text-gray-500 mt-1">Taux de réussite</div>
                    </div>
                  </div>
                  {Array.isArray(previewData.pedagogy.bySubject) && previewData.pedagogy.bySubject.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-gray-500 mb-2">Moyennes par matière</div>
                      <div className="space-y-1.5">
                        {(previewData.pedagogy.bySubject as Array<Record<string, unknown>>).slice(0, 8).map((s, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-sm text-gray-700 w-40 truncate">{String(s.name)}</span>
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${Math.min(100, ((s.average as number) / 20) * 100)}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium text-blue-700 w-12 text-right">
                              {typeof s.average === "number" ? s.average.toFixed(1) : "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Attendance */}
              {previewData.attendance && (
                <div className="bg-white border rounded-xl p-5">
                  <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>D. Présences élèves
                  </h3>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    {[
                      { label: "Total", value: fmt(previewData.attendance.total), color: "bg-gray-50 text-gray-700" },
                      { label: "Présents", value: fmt(previewData.attendance.present), color: "bg-green-50 text-green-700" },
                      { label: "Absents", value: fmt(previewData.attendance.absent), color: "bg-red-50 text-red-600" },
                      { label: "Retards", value: fmt(previewData.attendance.late), color: "bg-orange-50 text-orange-600" },
                      { label: "Justifiées", value: fmt(previewData.attendance.justified), color: "bg-blue-50 text-blue-600" },
                      { label: "Non justifiées", value: fmt(previewData.attendance.unjustified), color: "bg-red-50 text-red-800" },
                    ].map((kpi) => (
                      <div key={kpi.label} className={`${kpi.color} rounded-lg p-2.5 text-center`}>
                        <div className="text-xl font-bold">{kpi.value}</div>
                        <div className="text-xs mt-0.5 opacity-70">{kpi.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Teachers */}
              {previewData.teachers && (
                <div className="bg-white border rounded-xl p-5">
                  <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span>E. Rapport enseignants
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-purple-50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-purple-700">{fmt(previewData.teachers.totalTeachers)}</div>
                      <div className="text-xs text-gray-500 mt-1">Enseignants actifs</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-gray-700">{fmt(previewData.teachers.scheduledSlots)}</div>
                      <div className="text-xs text-gray-500 mt-1">Créneaux</div>
                    </div>
                    <div className="bg-indigo-50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-indigo-700">{fmt(previewData.teachers.totalBadges)}</div>
                      <div className="text-xs text-gray-500 mt-1">Badgeages</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Discipline */}
              {previewData.discipline && (
                <div className="bg-white border rounded-xl p-5">
                  <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>F. Vie scolaire / Discipline
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "Incidents", value: fmt(previewData.discipline.incidents), color: "bg-red-50 text-red-700" },
                      { label: "Sanctions", value: fmt(previewData.discipline.sanctions), color: "bg-orange-50 text-orange-700" },
                      { label: "Récompenses", value: fmt(previewData.discipline.rewards), color: "bg-green-50 text-green-700" },
                      { label: "Score moyen", value: typeof previewData.discipline.averageScore === "number" ? `${previewData.discipline.averageScore.toFixed(0)}/100` : "—", color: "bg-blue-50 text-blue-700" },
                      { label: "Élèves à risque", value: fmt(previewData.discipline.atRiskStudents), color: "bg-red-50 text-red-600" },
                      { label: "Score < 60", value: fmt(previewData.discipline.lowScoreStudents), color: "bg-yellow-50 text-yellow-700" },
                    ].map((kpi) => (
                      <div key={kpi.label} className={`${kpi.color} rounded-lg p-3 text-center`}>
                        <div className="text-xl font-bold">{kpi.value}</div>
                        <div className="text-xs mt-0.5 opacity-70">{kpi.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Calendar */}
              {previewData.calendar && (
                <div className="bg-white border rounded-xl p-5">
                  <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-500"></span>H. Calendrier scolaire
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="bg-cyan-50 rounded-lg p-3 text-center min-w-[80px]">
                      <div className="text-2xl font-bold text-cyan-700">{fmt(previewData.calendar.total)}</div>
                      <div className="text-xs text-gray-500 mt-1">Événements</div>
                    </div>
                    {previewData.calendar.byType != null && typeof previewData.calendar.byType === "object" && (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(previewData.calendar.byType as Record<string, unknown>).map(([type, count]) => (
                          <span key={type} className="px-2.5 py-1 bg-gray-100 rounded-full text-xs text-gray-700">
                            {type}: <strong>{String(count)}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* History */}
      {showHistory && (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <History className="w-4 h-4" />Historique des exports ({historyTotal})
            </h3>
            {loadingHistory && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          </div>
          {history.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">Aucun export enregistré</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Utilisateur", "Rôle", "Type", "Sections", "Format", "Fichier", "Date"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-800 font-medium">
                      {log.user ? `${log.user.firstName} ${log.user.lastName}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">{log.userRole}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{REPORT_TYPE_LABELS[log.reportType] ?? log.reportType}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{log.sections.join(", ")}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        log.format === "PDF" ? "bg-red-100 text-red-700" :
                        log.format === "EXCEL" ? "bg-green-100 text-green-700" :
                        "bg-blue-100 text-blue-700"
                      }`}>{log.format}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[180px]">{log.fileName}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(log.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
