"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CalendarDays,
  Plus,
  CheckCircle,
  AlertCircle,
  Loader2,
  BadgeCheck,
  Clock,
  XCircle,
} from "lucide-react";
import { schoolAuthApi, schoolApiRequest } from "@/lib/school-api";

type YearStatus = "PENDING_PAYMENT" | "ACTIVE" | "EXPIRED" | "CANCELED";

interface SubscriptionYear {
  id: string;
  schoolYearLabel: string;
  yearLabel?: string;
  startsAt: string;
  endsAt: string;
  status: YearStatus;
  amountDue: number;
  amountPaid: number;
  paidAt?: string;
  invoiceRef?: string;
  remainingAmount?: number;
  accessActive?: boolean;
}

interface Summary {
  total: number;
  allYears: SubscriptionYear[];
  activeYear?: SubscriptionYear | null;
  expiredYear?: SubscriptionYear | null;
  nextYear?: SubscriptionYear | null;
  totalPaid: number;
  totalDue: number;
  remainingAmount?: number;
  isCurrentlyActive: boolean;
}

const STATUS_LABELS: Record<YearStatus, string> = {
  PENDING_PAYMENT: "En attente",
  ACTIVE: "Payée / active",
  EXPIRED: "Expiré",
  CANCELED: "Annulé",
};

const STATUS_ICONS: Record<YearStatus, React.ReactNode> = {
  PENDING_PAYMENT: <Clock className="w-4 h-4 text-orange-500" />,
  ACTIVE: <BadgeCheck className="w-4 h-4 text-emerald-500" />,
  EXPIRED: <XCircle className="w-4 h-4 text-red-400" />,
  CANCELED: <XCircle className="w-4 h-4 text-gray-400" />,
};

const STATUS_ROW_COLORS: Record<YearStatus, string> = {
  PENDING_PAYMENT: "border-orange-200 bg-orange-50/30",
  ACTIVE: "border-emerald-200 bg-emerald-50/30",
  EXPIRED: "border-red-100",
  CANCELED: "border-gray-100 opacity-50",
};

function fmtXOF(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(n);
}

export default function AbonnementAnneesPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("DIRECTOR");

  const [showPurchase, setShowPurchase] = useState(false);
  const [purchaseYears, setPurchaseYears] = useState(1);
  const [purchaseLabel, setPurchaseLabel] = useState("");
  const [purchaseStart, setPurchaseStart] = useState("");
  const [purchasing, setPurchasing] = useState(false);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    const res = await schoolApiRequest<{ summary: Summary }>("/api/subscription-years/summary");
    if (res.data) setSummary(res.data.summary);
    else setError(res.error ?? "Erreur chargement");
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const meRes = await schoolAuthApi.me();
      if (meRes.data?.role) setUserRole(meRes.data.role);
      // Auto-fill current school year label
      const now = new Date();
      const startY = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
      setPurchaseLabel(`${startY}-${startY + 1}`);
      setPurchaseStart(`${startY}-09-01`);
    })();
    fetchSummary();
  }, [fetchSummary]);

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setPurchasing(true);
    setError(null);
    const res = await schoolApiRequest<{ years: SubscriptionYear[] }>("/api/subscription-years/purchase", {
      method: "POST",
      body: {
        yearsCount: purchaseYears,
        firstYearLabel: purchaseLabel,
        firstYearStartsAt: new Date(purchaseStart).toISOString(),
      },
    });
    if (res.data) {
      setSuccess(`${res.data.years.length} année(s) ajoutée(s) — facture générée et en attente de validation`);
      setShowPurchase(false);
      fetchSummary();
    } else {
      setError(res.error ?? "Erreur lors de la commande");
    }
    setPurchasing(false);
  };

  const isDirector = ["DIRECTOR", "CENTRAL_ADMIN"].includes(userRole);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Abonnement par année scolaire</h1>
            <p className="text-sm text-gray-500">Gérez vos accès annuels à SoraSchool</p>
          </div>
        </div>
        {isDirector && (
          <button
            onClick={() => setShowPurchase(!showPurchase)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
          >
            <Plus className="w-4 h-4" />
            Commander une année
          </button>
        )}
      </div>

      {/* Banners */}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />{success}
          <button className="ml-auto text-emerald-500" onClick={() => setSuccess(null)}>✕</button>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {/* Purchase form */}
      {showPurchase && (
        <div className="bg-white border border-indigo-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4">Commander 1 à 10 années scolaires</h3>
          <form onSubmit={handlePurchase} className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Nombre d'années</label>
                <input
                  type="number" min={1} max={10}
                  value={purchaseYears}
                  onChange={(e) => setPurchaseYears(parseInt(e.target.value))}
                  className="border rounded-lg px-3 py-2 text-sm w-full"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">1ère année (ex: 2024-2025)</label>
                <input
                  type="text"
                  value={purchaseLabel}
                  onChange={(e) => setPurchaseLabel(e.target.value)}
                  placeholder="2024-2025"
                  className="border rounded-lg px-3 py-2 text-sm w-full"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Date de début</label>
                <input
                  type="date"
                  value={purchaseStart}
                  onChange={(e) => setPurchaseStart(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm w-full"
                  required
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-indigo-50 rounded-lg p-3 text-sm text-indigo-800">
                Le montant est calculé automatiquement selon le plan actif de l'école.
              </div>
              <button
                type="submit"
                disabled={purchasing}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
              >
                {purchasing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Confirmer
              </button>
              <button type="button" onClick={() => setShowPurchase(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Current status card */}
      {summary && (
        <div className={`rounded-xl p-5 border-2 ${summary.isCurrentlyActive ? "border-emerald-400 bg-emerald-50" : "border-red-300 bg-red-50"}`}>
          <div className="flex items-center gap-3">
            {summary.isCurrentlyActive
              ? <BadgeCheck className="w-6 h-6 text-emerald-600" />
              : <AlertCircle className="w-6 h-6 text-red-500" />}
            <div>
              <p className={`font-semibold ${summary.isCurrentlyActive ? "text-emerald-800" : "text-red-700"}`}>
                {summary.isCurrentlyActive
                  ? `Accès actif — Année ${summary.activeYear?.schoolYearLabel ?? summary.activeYear?.yearLabel}`
                  : "Aucun accès actif — Renouvelez votre abonnement"}
              </p>
              {summary.activeYear && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Valide jusqu'au {new Date(summary.activeYear.endsAt).toLocaleDateString("fr-FR")}
                </p>
              )}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xl font-bold text-gray-800">{summary.total}</div>
              <div className="text-xs text-gray-500">Années achetées</div>
            </div>
            <div>
              <div className="text-xl font-bold text-emerald-700">{fmtXOF(summary.totalPaid)}</div>
              <div className="text-xs text-gray-500">Total payé</div>
            </div>
            <div>
              <div className="text-xl font-bold text-gray-700">{fmtXOF(summary.totalDue - summary.totalPaid)}</div>
              <div className="text-xs text-gray-500">Reste dû</div>
            </div>
          </div>
        </div>
      )}

      {/* Years list */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Historique des années scolaires</h3>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
        </div>

        {(!summary || summary.allYears.length === 0) && !loading ? (
          <div className="p-10 text-center text-gray-400">Aucune année commandée. Cliquez sur « Commander une année ».</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {summary?.allYears.map((y) => (
              <div key={y.id} className={`px-5 py-4 flex items-center justify-between gap-4 border-l-4 ${STATUS_ROW_COLORS[y.status]}`}>
                <div className="flex items-center gap-3">
                  {STATUS_ICONS[y.status]}
                  <div>
                    <p className="font-semibold text-gray-800">Année scolaire {y.schoolYearLabel}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(y.startsAt).toLocaleDateString("fr-FR")} → {new Date(y.endsAt).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${y.status === "ACTIVE" ? "text-emerald-700" : "text-gray-700"}`}>
                    {fmtXOF(y.amountPaid)} / {fmtXOF(y.amountDue)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {STATUS_LABELS[y.status]}
                    {y.paidAt ? ` — payé le ${new Date(y.paidAt).toLocaleDateString("fr-FR")}` : ""}
                  </p>
                </div>
                <span className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                  y.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" :
                  y.status === "PENDING_PAYMENT" ? "bg-orange-100 text-orange-700" :
                  y.status === "EXPIRED" ? "bg-red-100 text-red-600" :
                  "bg-gray-100 text-gray-500"
                }`}>
                  {STATUS_LABELS[y.status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
