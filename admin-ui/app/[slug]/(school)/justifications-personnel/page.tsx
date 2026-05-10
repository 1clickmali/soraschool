"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, FileText, MessageSquare, RefreshCw, XCircle } from "lucide-react";
import { schoolApi, type StaffJustification, type StaffJustificationStatus } from "@/lib/school-api";
import { cn, formatDate } from "@/lib/utils";

const STATUS_LABELS: Record<StaffJustificationStatus, string> = {
  NONE: "Aucune",
  PENDING: "En attente",
  ACCEPTED: "Acceptée",
  REFUSED: "Refusée",
  NEEDS_MORE_INFO: "Complément demandé",
};

function statusClass(status: StaffJustificationStatus) {
  if (status === "ACCEPTED") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  if (status === "REFUSED") return "border-red-500/25 bg-red-500/10 text-red-300";
  if (status === "NEEDS_MORE_INFO") return "border-blue-500/25 bg-blue-500/10 text-blue-300";
  return "border-amber-500/25 bg-amber-500/10 text-amber-300";
}

export default function JustificationsPersonnelPage() {
  const [items, setItems] = useState<StaffJustification[]>([]);
  const [status, setStatus] = useState<StaffJustificationStatus | "">("PENDING");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [comment, setComment] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await schoolApi.staffJustifications(status || undefined);
    if (data?.justifications) setItems(data.justifications);
    if (error) setMessage({ type: "err", text: error });
    setLoading(false);
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const review = async (id: string, nextStatus: "ACCEPTED" | "REFUSED" | "NEEDS_MORE_INFO") => {
    setSavingId(id);
    const { error } = await schoolApi.reviewStaffJustification(id, { status: nextStatus, directorComment: comment[id] });
    setSavingId(null);
    setMessage(error ? { type: "err", text: error } : { type: "ok", text: `Justification ${STATUS_LABELS[nextStatus].toLowerCase()}.` });
    load();
  };

  return (
    <div className="min-h-screen bg-soraDark text-white">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-500/15 p-2.5"><MessageSquare className="h-6 w-6 text-amber-300" /></div>
            <div>
              <h1 className="font-heading text-2xl font-bold">Justifications du personnel</h1>
              <p className="text-sm text-gray-400">Validation Directeur obligatoire avant annulation ou application définitive des pénalités.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <select value={status} onChange={(e) => setStatus(e.target.value as StaffJustificationStatus | "")} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white [&>option]:bg-soraCard">
              <option value="">Tous les statuts</option>
              <option value="PENDING">En attente</option>
              <option value="ACCEPTED">Acceptées</option>
              <option value="REFUSED">Refusées</option>
              <option value="NEEDS_MORE_INFO">Compléments</option>
            </select>
            <button onClick={load} className="rounded-xl border border-white/10 p-2 text-gray-300 transition hover:bg-white/10"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></button>
          </div>
        </div>

        {message && (
          <div className={cn("flex items-center gap-2 rounded-xl border p-3 text-sm", message.type === "ok" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "border-red-500/25 bg-red-500/10 text-red-300")}>
            {message.type === "ok" ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />} {message.text}
          </div>
        )}

        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] py-14 text-sm text-gray-400"><RefreshCw className="h-4 w-4 animate-spin" /> Chargement...</div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] py-14 text-center text-sm text-gray-500">Aucune justification.</div>
          ) : items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-semibold">{item.staff ? `${item.staff.firstName} ${item.staff.lastName}` : item.staffId}</p>
                  <p className="mt-1 text-xs text-gray-500">Pointage du {item.attendance?.date ? formatDate(item.attendance.date) : "—"} · {item.attendance?.status ?? "—"}</p>
                  <p className="mt-3 max-w-3xl text-sm text-gray-300">{item.reason}</p>
                  {item.attachmentUrl && (
                    <a href={item.attachmentUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-blue-300 transition hover:bg-white/10">
                      <FileText className="h-4 w-4" /> Ouvrir le justificatif
                    </a>
                  )}
                </div>
                <span className={cn("rounded-full border px-3 py-1 text-xs", statusClass(item.status))}>{STATUS_LABELS[item.status]}</span>
              </div>

              {item.status === "PENDING" || item.status === "NEEDS_MORE_INFO" ? (
                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                  <input value={comment[item.id] ?? ""} onChange={(e) => setComment({ ...comment, [item.id]: e.target.value })} placeholder="Commentaire Directeur..." className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none" />
                  <div className="flex flex-wrap gap-2">
                    <button disabled={savingId === item.id} onClick={() => review(item.id, "ACCEPTED")} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"><CheckCircle className="h-4 w-4" /> Accepter</button>
                    <button disabled={savingId === item.id} onClick={() => review(item.id, "REFUSED")} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"><XCircle className="h-4 w-4" /> Refuser</button>
                    <button disabled={savingId === item.id} onClick={() => review(item.id, "NEEDS_MORE_INFO")} className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/20 disabled:opacity-60">Demander complément</button>
                  </div>
                </div>
              ) : item.directorComment ? (
                <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-gray-300">Décision Direction : {item.directorComment}</p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
