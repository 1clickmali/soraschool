"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { AlertTriangle, CheckCircle, Copy, Link2, RefreshCw, ShieldOff, TabletSmartphone } from "lucide-react";
import { schoolApi, type StaffTabletLink } from "@/lib/school-api";
import { cn, formatDate } from "@/lib/utils";

export default function PointageTablettePage() {
  const [links, setLinks] = useState<StaffTabletLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [created, setCreated] = useState<{ url: string; token: string; qrDataUrl: string } | null>(null);
  const [form, setForm] = useState({ validity: "7d" as "1d" | "7d" | "1m" | "school_year", label: "Tablette entrée principale", deviceHint: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await schoolApi.staffTabletLinks();
    if (data?.links) setLinks(data.links);
    if (error) setMessage({ type: "err", text: error });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setSaving(true);
    setMessage(null);
    const { data, error } = await schoolApi.createStaffTabletLink(form);
    setSaving(false);
    if (error) {
      setMessage({ type: "err", text: error });
      return;
    }
    if (data) {
      setCreated({ url: data.url, token: data.token, qrDataUrl: data.qrDataUrl });
      setMessage({ type: "ok", text: "Lien tablette généré. Copiez-le sur la tablette du gardien." });
      load();
    }
  };

  const disable = async (id: string) => {
    setSaving(true);
    const { error } = await schoolApi.disableStaffTabletLink(id);
    setSaving(false);
    setMessage(error ? { type: "err", text: error } : { type: "ok", text: "Lien tablette désactivé immédiatement." });
    load();
  };

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setMessage({ type: "ok", text: "Lien copié." });
  };

  return (
    <div className="min-h-screen bg-soraDark text-white">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-sky-500/15 p-2.5"><TabletSmartphone className="h-6 w-6 text-sky-300" /></div>
          <div>
            <h1 className="font-heading text-2xl font-bold">Pointage tablette</h1>
            <p className="text-sm text-gray-400">Lien sécurisé pour scanner les QR du personnel à l'entrée, sans accès aux autres modules.</p>
          </div>
        </div>

        {message && (
          <div className={cn("flex items-center gap-2 rounded-xl border p-3 text-sm", message.type === "ok" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "border-red-500/25 bg-red-500/10 text-red-300")}>
            {message.type === "ok" ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />} {message.text}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <h2 className="mb-4 font-semibold">Générer un lien</h2>
            <div className="space-y-3">
              <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Libellé" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none" />
              <input value={form.deviceHint} onChange={(e) => setForm({ ...form, deviceHint: e.target.value })} placeholder="Appareil autorisé si connu" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none" />
              <select value={form.validity} onChange={(e) => setForm({ ...form, validity: e.target.value as typeof form.validity })} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white [&>option]:bg-soraCard">
                <option value="1d">1 jour</option>
                <option value="7d">7 jours</option>
                <option value="1m">1 mois</option>
                <option value="school_year">Année scolaire complète</option>
              </select>
              <button disabled={saving} onClick={create} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-60">
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Générer le lien
              </button>
            </div>

            {created && (
              <div className="mt-5 space-y-3 rounded-2xl border border-sky-500/25 bg-sky-500/10 p-4">
                <div className="rounded-xl bg-white p-3">
                  <Image src={created.qrDataUrl} alt="QR lien tablette" width={208} height={208} unoptimized className="mx-auto h-52 w-52" />
                </div>
                <p className="break-all rounded-xl border border-white/10 bg-black/20 p-3 font-mono text-xs text-sky-100">{created.url}</p>
                <button onClick={() => copy(created.url)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-white transition hover:bg-white/10">
                  <Copy className="h-4 w-4" /> Copier le lien
                </button>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
              <h2 className="font-semibold">Liens actifs et historique</h2>
              <button onClick={load} className="rounded-xl border border-white/10 p-2 text-gray-300 transition hover:bg-white/10"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></button>
            </div>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-14 text-sm text-gray-400"><RefreshCw className="h-4 w-4 animate-spin" /> Chargement...</div>
            ) : links.length === 0 ? (
              <div className="py-14 text-center text-sm text-gray-500">Aucun lien tablette généré.</div>
            ) : links.map((link) => (
              <div key={link.id} className="border-b border-white/[0.05] p-5 last:border-b-0">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold">{link.label || "Lien tablette"}</p>
                    <p className="text-xs text-gray-500">Expire le {formatDate(link.expiresAt)} · {link.usageCount} utilisation(s)</p>
                    <span className={cn("mt-2 inline-flex rounded-full border px-2 py-1 text-xs", link.status === "ACTIVE" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "border-red-500/25 bg-red-500/10 text-red-300")}>{link.status}</span>
                  </div>
                  {link.status === "ACTIVE" && (
                    <button disabled={saving} onClick={() => disable(link.id)} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-60">
                      <ShieldOff className="h-4 w-4" /> Désactiver
                    </button>
                  )}
                </div>
                <div className="mt-4 grid gap-2">
                  {(link.scanLogs || []).slice(0, 5).map((log) => (
                    <div key={log.id} className="rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-xs text-gray-400">
                      {new Date(log.createdAt).toLocaleString("fr-FR")} · {log.action} · {log.result}
                    </div>
                  ))}
                  {!link.scanLogs?.length && <p className="text-xs text-gray-600">Aucun scan enregistré.</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
