"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Download, FileSpreadsheet, FileText, Loader2, Plus, Search, Wallet, X } from "lucide-react";
import { schoolApi, type BudgetRequest } from "@/lib/school-api";
import { downloadProtectedFile } from "@/lib/school-api";

const categories = ["REPAIR", "EVENT", "SUPPLIES", "BUILDING", "IT", "TRANSPORT", "EMERGENCY", "MAINTENANCE", "OTHER"];
const urgencies = ["LOW", "NORMAL", "HIGH", "URGENT"];
const statuses = ["", "PENDING_VALIDATION", "VALIDATED", "REFUSED", "PAID", "DRAFT"];

const labels: Record<string, string> = {
  REPAIR: "Réparation",
  EVENT: "Événement",
  SUPPLIES: "Fournitures",
  BUILDING: "Bâtiment",
  IT: "Informatique",
  TRANSPORT: "Transport",
  EMERGENCY: "Urgence",
  MAINTENANCE: "Maintenance",
  OTHER: "Autre",
  LOW: "Faible",
  NORMAL: "Normale",
  HIGH: "Haute",
  URGENT: "Urgente",
  PENDING_VALIDATION: "En attente Directeur",
  VALIDATED: "Validé",
  REFUSED: "Refusé",
  PAID: "Payé",
  DRAFT: "Brouillon",
};

function money(value?: number | null) {
  return `${(value || 0).toLocaleString("fr-FR")} FCFA`;
}

function actor(user?: BudgetRequest["requestedBy"]) {
  return user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.role : "Non renseigné";
}

export default function BudgetPage() {
  const [requests, setRequests] = useState<BudgetRequest[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    category: "SUPPLIES" as BudgetRequest["category"],
    amountRequested: "",
    urgency: "NORMAL" as BudgetRequest["urgency"],
    description: "",
  });

  const summary = useMemo(() => requests.reduce((acc, item) => {
    acc.requested += item.amountRequested;
    acc.approved += item.amountApproved || 0;
    acc.paid += item.amountPaid;
    acc.pending += item.status === "PENDING_VALIDATION" ? 1 : 0;
    return acc;
  }, { requested: 0, approved: 0, paid: 0, pending: 0 }), [requests]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await schoolApi.budgetRequests({ status: status || undefined, search: search || undefined });
    setLoading(false);
    if (error) {
      setMessage(error);
      return;
    }
    setRequests(data?.requests || []);
  }, [search, status]);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    if (!form.title.trim() || !Number(form.amountRequested)) {
      setMessage("Titre et montant demandé sont obligatoires.");
      return;
    }
    setSubmitting(true);
    const { error } = await schoolApi.createBudgetRequest({
      title: form.title,
      category: form.category,
      amountRequested: Number(form.amountRequested),
      urgency: form.urgency,
      description: form.description || undefined,
    });
    setSubmitting(false);
    setMessage(error || "Demande budget enregistrée.");
    if (!error) {
      setForm({ title: "", category: "SUPPLIES", amountRequested: "", urgency: "NORMAL", description: "" });
      void load();
    }
  };

  const review = async (id: string, decision: "VALIDATED" | "REFUSED", amount?: number) => {
    const { error } = await schoolApi.reviewBudgetRequest(id, { decision, amountApproved: amount });
    setMessage(error || (decision === "VALIDATED" ? "Demande validée." : "Demande refusée."));
    void load();
  };

  const pay = async (request: BudgetRequest) => {
    const remaining = (request.amountApproved || request.amountRequested) - request.amountPaid;
    const { error } = await schoolApi.payBudgetRequest(request.id, { amountPaid: Math.max(1, remaining) });
    setMessage(error || "Décaissement enregistré.");
    void load();
  };

  const exportFile = async (kind: "csv" | "xlsx" | "pdf") => {
    await downloadProtectedFile(`/api/budget/export/${kind}`, `budget.${kind}`, kind === "pdf" ? "open" : "download");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white">Budget</h1>
          <p className="mt-1 text-sm text-gray-400">Demandes de dépenses, validation Directeur, décaissements et traçabilité.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => exportFile("csv")} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-gray-300 hover:bg-white/8"><Download className="h-4 w-4" /> CSV</button>
          <button onClick={() => exportFile("xlsx")} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-gray-300 hover:bg-white/8"><FileSpreadsheet className="h-4 w-4" /> Excel</button>
          <button onClick={() => exportFile("pdf")} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-gray-300 hover:bg-white/8"><FileText className="h-4 w-4" /> PDF</button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          ["Demandé", money(summary.requested)],
          ["Validé", money(summary.approved)],
          ["Payé", money(summary.paid)],
          ["En attente", String(summary.pending)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-2 text-xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 lg:grid-cols-[1fr_180px_160px_160px_auto]">
        <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Motif : réparation table, fête scolaire..." className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none" />
        <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as BudgetRequest["category"] }))} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white [&>option]:bg-soraCard">
          {categories.map((item) => <option key={item} value={item}>{labels[item]}</option>)}
        </select>
        <input value={form.amountRequested} onChange={(e) => setForm((p) => ({ ...p, amountRequested: e.target.value }))} type="number" placeholder="Montant" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none" />
        <select value={form.urgency} onChange={(e) => setForm((p) => ({ ...p, urgency: e.target.value as BudgetRequest["urgency"] }))} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white [&>option]:bg-soraCard">
          {urgencies.map((item) => <option key={item} value={item}>{labels[item]}</option>)}
        </select>
        <button onClick={create} disabled={submitting} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Créer
        </button>
        <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Description / justification" className="lg:col-span-5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex max-w-md flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
          <Search className="h-4 w-4 text-emerald-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." className="flex-1 bg-transparent text-sm text-white outline-none" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white [&>option]:bg-soraCard">
          {statuses.map((item) => <option key={item || "ALL"} value={item}>{item ? labels[item] : "Tous les statuts"}</option>)}
        </select>
      </div>

      {message && <p className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-gray-300">{message}</p>}

      <div className="overflow-hidden rounded-2xl border border-white/[0.07]">
        <table className="min-w-full divide-y divide-white/[0.07]">
          <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Demande</th>
              <th className="px-4 py-3">Montants</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Traçabilité</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {loading ? (
              <tr><td className="px-4 py-8 text-center text-gray-500" colSpan={5}>Chargement…</td></tr>
            ) : requests.map((request) => (
              <tr key={request.id} className="text-sm">
                <td className="px-4 py-3">
                  <p className="font-semibold text-white">{request.title}</p>
                  <p className="text-xs text-gray-500">{labels[request.category]} · urgence {labels[request.urgency]}</p>
                </td>
                <td className="px-4 py-3 text-gray-300">
                  <p>Demandé : {money(request.amountRequested)}</p>
                  <p className="text-xs text-gray-500">Validé : {money(request.amountApproved)} · Payé : {money(request.amountPaid)}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-300">{labels[request.status] || request.status}</span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  <p>Créé par : {actor(request.requestedBy)}</p>
                  {request.approvedBy && <p>Validé par : {actor(request.approvedBy)}</p>}
                  {request.rejectedBy && <p>Refusé par : {actor(request.rejectedBy)}</p>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {request.status === "PENDING_VALIDATION" && (
                      <>
                        <button onClick={() => review(request.id, "VALIDATED", request.amountRequested)} className="rounded-lg bg-emerald-600/90 p-2 text-white hover:bg-emerald-500"><Check className="h-4 w-4" /></button>
                        <button onClick={() => review(request.id, "REFUSED")} className="rounded-lg bg-red-600/80 p-2 text-white hover:bg-red-500"><X className="h-4 w-4" /></button>
                      </>
                    )}
                    {request.status === "VALIDATED" && (
                      <button onClick={() => pay(request)} className="inline-flex items-center gap-1 rounded-lg bg-blue-600/80 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500"><Wallet className="h-3 w-3" /> Payer</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
