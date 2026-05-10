"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Building2, Loader2, Search, ShieldCheck } from "lucide-react";
import { publicApi, type SchoolInstitution } from "@/lib/school-api";

const LAST_SCHOOL_KEY = "last_school_slug";

function SchoolChooserContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forceChange = searchParams.get("change") === "1";
  const [query, setQuery] = useState("");
  const [institution, setInstitution] = useState<SchoolInstitution | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingMemory, setCheckingMemory] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (forceChange) {
      localStorage.removeItem(LAST_SCHOOL_KEY);
      setCheckingMemory(false);
      return;
    }
    const lastSlug = localStorage.getItem(LAST_SCHOOL_KEY);
    if (!lastSlug) {
      setCheckingMemory(false);
      return;
    }
    publicApi.resolveSchool(lastSlug).then(({ data }) => {
      if (data?.institution && data.institution.status !== "SUSPENDED") {
        router.replace(`/${data.institution.slug}/login`);
      } else {
        localStorage.removeItem(LAST_SCHOOL_KEY);
        setCheckingMemory(false);
      }
    }).catch(() => setCheckingMemory(false));
  }, [forceChange, router]);

  const resolve = async () => {
    if (!query.trim()) {
      setError("Entrez le code ou le nom de votre établissement.");
      return;
    }
    setLoading(true);
    setError(null);
    setInstitution(null);
    const { data, error } = await publicApi.resolveSchool(query.trim());
    setLoading(false);
    if (error || !data?.institution) {
      setError(error || "École introuvable. Vérifiez le code fourni par votre établissement.");
      return;
    }
    if (data.institution.status === "SUSPENDED") {
      setError("L’accès de cet établissement est suspendu. Veuillez contacter la direction ou SoraSchool.");
      return;
    }
    setInstitution(data.institution);
  };

  const continueToLogin = () => {
    if (!institution) return;
    localStorage.setItem(LAST_SCHOOL_KEY, institution.slug);
    router.push(`/${institution.slug}/login`);
  };

  if (checkingMemory) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f1e8] text-[#10231d]">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-[#064e3b]" />
          <span className="text-sm font-bold">Recherche de votre établissement mémorisé…</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(6,78,59,0.14),transparent_35%),#f5f1e8] px-6 py-8 text-[#10231d]">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-[#064e3b]">
          <ArrowLeft className="h-4 w-4" /> Retour au site
        </Link>

        <section className="mt-10 rounded-[2rem] border border-[#064e3b]/10 bg-white p-8 shadow-xl shadow-[#064e3b]/5">
          <div className="mb-8 flex items-start gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#064e3b] text-white">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-heading text-3xl font-black">Choisissez votre établissement</h1>
              <p className="mt-2 text-sm leading-6 text-[#50645c]">
                Entrez le code école ou le nom fourni par votre établissement. Nous mémoriserons ce choix sur cet appareil.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 items-center gap-3 rounded-2xl border border-[#064e3b]/15 bg-[#f8faf8] px-4 py-3">
              <Search className="h-5 w-5 text-[#064e3b]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && resolve()}
                placeholder="Exemple : iscf"
                className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-[#7b8d85]"
              />
            </div>
            <button
              onClick={resolve}
              disabled={loading}
              className="rounded-2xl bg-[#064e3b] px-6 py-3 text-sm font-black text-white disabled:opacity-60"
            >
              {loading ? "Recherche…" : "Continuer"}
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          {institution && (
            <div className="mt-6 rounded-3xl border border-[#064e3b]/15 bg-[#eff8f2] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#064e3b]">École trouvée</p>
                  <h2 className="mt-2 font-heading text-2xl font-black">{institution.name}</h2>
                  <p className="mt-1 text-sm text-[#50645c]">
                    Code : {institution.code || institution.slug} · {institution.city || institution.activeAcademicYearName || "SoraSchool"}
                  </p>
                </div>
                <ShieldCheck className="h-8 w-8 text-[#064e3b]" />
              </div>
              <button
                onClick={continueToLogin}
                className="mt-5 w-full rounded-2xl bg-[#064e3b] px-5 py-3 text-sm font-black text-white"
              >
                Se connecter à {institution.name}
              </button>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
            <button
              onClick={() => {
                localStorage.removeItem(LAST_SCHOOL_KEY);
                setInstitution(null);
                setQuery("");
                setError(null);
              }}
              className="font-bold text-[#064e3b]"
            >
              Changer d’établissement
            </button>
            <Link href="/admin/login" className="text-[#6b7c75] hover:text-[#064e3b]">
              Accès administration plateforme
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function SchoolChooserPage() {
  return (
    <Suspense fallback={<main className="grid min-h-screen place-items-center bg-[#f5f1e8] text-sm font-bold text-[#064e3b]">Chargement…</main>}>
      <SchoolChooserContent />
    </Suspense>
  );
}
