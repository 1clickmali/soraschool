"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Download, FileSignature, RefreshCw } from "lucide-react";
import { downloadProtectedFile, schoolApi, type StaffMember } from "@/lib/school-api";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function TeacherContratPage() {
  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await schoolApi.staffMe();
    setStaff(data?.staff ?? null);
    setError(error);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openPdf = async (id: string, number: string) => {
    const error = await downloadProtectedFile(`/api/staff/contracts/${id}/pdf`, `contrat-${number}.pdf`, "open");
    if (error) setError(error);
  };

  return (
    <div className="min-h-screen bg-soraDark pb-24 text-white">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-indigo-500/15 p-2.5"><FileSignature className="h-6 w-6 text-indigo-300" /></div>
          <div>
            <h1 className="font-heading text-2xl font-bold">Mon contrat</h1>
            <p className="text-sm text-gray-400">Contrats RH disponibles selon autorisation de la Direction.</p>
          </div>
        </div>

        {error && <div className="flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-300"><AlertTriangle className="h-4 w-4" /> {error}</div>}

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] py-16 text-sm text-gray-400"><RefreshCw className="h-4 w-4 animate-spin" /> Chargement...</div>
        ) : !staff?.contracts?.length ? (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] py-16 text-center text-sm text-gray-500">Aucun contrat disponible.</div>
        ) : (
          <div className="space-y-3">
            {staff.contracts.map((contract) => (
              <div key={contract.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold">{contract.title}</p>
                    <p className="text-xs text-gray-500">{contract.number} · {contract.status}</p>
                    <p className="mt-2 text-sm text-gray-300">{formatCurrency(contract.salary)} · {formatDate(contract.startsAt)} - {contract.endsAt ? formatDate(contract.endsAt) : "Indéterminée"}</p>
                  </div>
                  <button onClick={() => openPdf(contract.id, contract.number)} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500">
                    <Download className="h-4 w-4" /> Ouvrir PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
