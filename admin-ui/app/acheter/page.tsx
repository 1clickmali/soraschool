"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, Send } from "lucide-react";
import { publicApi } from "@/lib/school-api";

const PLANS = {
  BASIC: {
    name: "Basic",
    installationFee: 200_000,
    annualPrice: 100_000,
    description: "École unique avec toutes les fonctionnalités principales.",
  },
  PREMIUM: {
    name: "Premium",
    installationFee: 300_000,
    annualPrice: 500_000,
    description: "Groupes scolaires, multi-sites et rapports consolidés.",
  },
} as const;

function money(value: number) {
  return `${value.toLocaleString("fr-FR")} FCFA`;
}

function BuyPlanContent() {
  const searchParams = useSearchParams();
  const initialPlan = searchParams.get("plan") === "PREMIUM" ? "PREMIUM" : "BASIC";
  const [plan, setPlan] = useState<"BASIC" | "PREMIUM">(initialPlan);
  const [form, setForm] = useState({
    schoolName: "",
    city: "",
    country: "Côte d'Ivoire",
    contactName: "",
    phone: "",
    email: "",
    whatsapp: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selected = PLANS[plan];
  const total = useMemo(() => selected.installationFee + selected.annualPrice, [selected]);

  const submit = async () => {
    if (!form.schoolName.trim() || !form.contactName.trim() || !form.phone.trim()) {
      setError("Nom de l’école, contact et téléphone sont obligatoires.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    const { data, error } = await publicApi.createPlanOrder({ plan, ...form });
    setLoading(false);
    if (error) {
      setError(error);
      return;
    }
    setMessage(data?.message || "Demande envoyée. SoraSchool vous contactera rapidement.");
  };

  return (
    <main className="min-h-screen bg-[#f5f1e8] px-6 py-8 text-[#10231d]">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-[#064e3b]">
          <ArrowLeft className="h-4 w-4" /> Retour au site
        </Link>

        <div className="mt-10 grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <aside className="rounded-[2rem] bg-[#09251c] p-7 text-white shadow-2xl">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-[#f5c464]">Achat en ligne</p>
            <h1 className="mt-4 font-heading text-4xl font-black">Choisissez votre plan SoraSchool</h1>
            <p className="mt-4 text-sm leading-6 text-white/65">
              Votre demande est enregistrée avec idempotence. Une facture SaaS pourra être finalisée par SoraSchool sans doublon.
            </p>

            <div className="mt-8 grid gap-3">
              {Object.entries(PLANS).map(([key, item]) => (
                <button
                  key={key}
                  onClick={() => setPlan(key as "BASIC" | "PREMIUM")}
                  className={`rounded-3xl border p-5 text-left transition ${
                    plan === key ? "border-[#f5c464] bg-white/12" : "border-white/10 bg-white/6 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="font-heading text-2xl font-black">{item.name}</h2>
                    {plan === key && <CheckCircle2 className="h-6 w-6 text-[#f5c464]" />}
                  </div>
                  <p className="mt-2 text-sm text-white/65">{item.description}</p>
                  <p className="mt-4 text-xl font-black">{money(item.installationFee + item.annualPrice)}</p>
                  <p className="text-xs text-white/50">1ère année : installation + abonnement annuel</p>
                </button>
              ))}
            </div>
          </aside>

          <section className="rounded-[2rem] border border-[#064e3b]/10 bg-white p-7 shadow-xl shadow-[#064e3b]/5">
            <div className="mb-6 rounded-3xl bg-[#eff8f2] p-5">
              <p className="text-sm font-bold text-[#064e3b]">Plan {selected.name}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-[#6b7c75]">Installation</p>
                  <p className="font-black">{money(selected.installationFee)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#6b7c75]">Abonnement/an</p>
                  <p className="font-black">{money(selected.annualPrice)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#6b7c75]">Total 1ère année</p>
                  <p className="font-black text-[#064e3b]">{money(total)}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["schoolName", "Nom de l’école *"],
                ["city", "Ville"],
                ["contactName", "Nom du responsable *"],
                ["phone", "Téléphone *"],
                ["whatsapp", "WhatsApp"],
                ["email", "Email"],
              ].map(([key, label]) => (
                <label key={key} className="text-sm font-bold text-[#30473e]">
                  {label}
                  <input
                    value={form[key as keyof typeof form]}
                    onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-[#064e3b]/15 bg-[#f8faf8] px-4 py-3 outline-none focus:border-[#064e3b]"
                  />
                </label>
              ))}
              <label className="sm:col-span-2 text-sm font-bold text-[#30473e]">
                Message
                <textarea
                  value={form.message}
                  onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-[#064e3b]/15 bg-[#f8faf8] px-4 py-3 outline-none focus:border-[#064e3b]"
                  placeholder="Nombre d’élèves, besoins, date souhaitée..."
                />
              </label>
            </div>

            {error && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}
            {message && <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p>}

            <button
              onClick={submit}
              disabled={loading}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#064e3b] px-5 py-4 text-sm font-black text-white disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Envoyer la demande d’achat
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}

export default function BuyPlanPage() {
  return (
    <Suspense fallback={<main className="grid min-h-screen place-items-center bg-[#f5f1e8] text-sm font-bold text-[#064e3b]">Chargement…</main>}>
      <BuyPlanContent />
    </Suspense>
  );
}
