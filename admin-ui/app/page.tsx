import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  Clock,
  FileText,
  Landmark,
  LockKeyhole,
  QrCode,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";

const features = [
  { title: "Gestion scolaire complète", text: "Apprenants, enseignants, classes, évaluations, bulletins et documents officiels.", icon: BookOpenCheck },
  { title: "Finance claire", text: "Paiements, factures, reçus, abonnements, créances et suivi des restes à payer.", icon: WalletCards },
  { title: "Assiduité connectée", text: "Présences élèves liées à l’emploi du temps et pointage personnel par QR code.", icon: Clock },
  { title: "Rapports professionnels", text: "PDF, Excel, CSV, graphiques, statistiques et rapports consolidés Premium.", icon: BarChart3 },
  { title: "Documents maîtrisés", text: "Dossiers, permissions, traçabilité, téléchargements et historique d’actions.", icon: FileText },
  { title: "Architecture sécurisée", text: "Multi-tenant, school_id strict, audit logs et idempotence anti-doublons.", icon: ShieldCheck },
];

const roles = ["Directeur", "Comptable", "Secrétaire", "Enseignant", "Parent", "Élève"];

const plans = [
  {
    name: "Basic",
    price: "300 000 FCFA",
    renewal: "puis 100 000 FCFA/an",
    description: "Idéal pour une école unique souhaitant digitaliser sa gestion complète.",
    href: "/acheter?plan=BASIC",
    items: ["1 établissement", "Fonctionnalités principales", "Factures et reçus", "Rapports PDF/Excel"],
  },
  {
    name: "Premium",
    price: "800 000 FCFA",
    renewal: "puis 500 000 FCFA/an",
    description: "Idéal pour les groupes scolaires, réseaux d’écoles et établissements multi-sites.",
    href: "/acheter?plan=PREMIUM",
    items: ["Multi-établissements", "Dashboard groupe scolaire", "Rapports consolidés", "Toutes les fonctionnalités"],
  },
];

export default function PublicLandingPage() {
  return (
    <main className="min-h-screen bg-[#f5f1e8] text-[#10231d]">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(6,78,59,0.16),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(200,155,60,0.20),transparent_26%),linear-gradient(135deg,#f5f1e8_0%,#eef7ef_45%,#f8e6bd_100%)]" />
        <div className="absolute left-1/2 top-0 h-[520px] w-[520px] -translate-x-1/2 rounded-full border border-[#064e3b]/10" />
        <div className="relative mx-auto flex max-w-7xl flex-col px-6 py-6 lg:px-8">
          <header className="flex items-center justify-between rounded-full border border-[#064e3b]/10 bg-white/70 px-4 py-3 shadow-sm backdrop-blur">
            <Link href="/" className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#064e3b] text-white shadow-lg">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="font-heading text-lg font-black">SoraSchool</p>
                <p className="text-xs text-[#496359]">SaaS scolaire intelligent</p>
              </div>
            </Link>
            <nav className="hidden items-center gap-6 text-sm font-semibold text-[#496359] md:flex">
              <a href="#fonctionnalites">Fonctionnalités</a>
              <a href="#plans">Plans</a>
              <a href="#contact">Contact</a>
            </nav>
            <div className="flex items-center gap-2">
              <Link href="/connexion" className="rounded-full px-4 py-2 text-sm font-bold text-[#064e3b] hover:bg-[#064e3b]/10">
                Se connecter
              </Link>
              <Link href="/acheter" className="rounded-full bg-[#064e3b] px-4 py-2 text-sm font-bold text-white shadow-lg shadow-[#064e3b]/20 hover:bg-[#0b674f]">
                Acheter
              </Link>
            </div>
          </header>

          <div className="grid items-center gap-12 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#064e3b]/15 bg-white/70 px-4 py-2 text-sm font-bold text-[#064e3b]">
                <LockKeyhole className="h-4 w-4" />
                Multi-tenant sécurisé pour écoles et groupes scolaires
              </div>
              <h1 className="max-w-4xl font-heading text-5xl font-black leading-[0.95] tracking-tight text-[#09251c] md:text-7xl">
                La plateforme qui rend une école plus simple à diriger.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#40594f]">
                SoraSchool centralise la scolarité, les finances, les documents, les présences, le pointage RH, les rapports et le budget dans un espace professionnel pensé pour l’Afrique de l’Ouest.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/acheter" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#064e3b] px-6 py-4 text-sm font-black text-white shadow-xl shadow-[#064e3b]/20 hover:bg-[#0b674f]">
                  Acheter / S’inscrire <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/connexion" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#064e3b]/15 bg-white/70 px-6 py-4 text-sm font-black text-[#064e3b] hover:bg-white">
                  Se connecter à mon école
                </Link>
              </div>
            </div>

            <div className="rounded-[2rem] border border-[#064e3b]/10 bg-[#09251c] p-5 text-white shadow-2xl">
              <div className="rounded-[1.5rem] bg-white/8 p-5">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-emerald-200">Tableau Directeur</p>
                    <p className="font-heading text-2xl font-black">Vue école en temps réel</p>
                  </div>
                  <QrCode className="h-9 w-9 text-[#f5c464]" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["Présents personnel", "24"],
                    ["Demandes budget", "6"],
                    ["Restes à payer", "1,2M"],
                    ["Rapports prêts", "12"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-white/10 p-4">
                      <p className="text-xs text-white/55">{label}</p>
                      <p className="mt-2 text-3xl font-black">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4">
                  <p className="text-sm font-bold text-emerald-100">Pointage QR sécurisé</p>
                  <p className="mt-1 text-xs leading-5 text-white/60">Heures d’entrée/sortie visibles chez la Direction, liées à l’emploi du temps.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="fonctionnalites" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="mb-10 max-w-3xl">
          <p className="font-black uppercase tracking-[0.25em] text-[#c28c23]">Produit</p>
          <h2 className="mt-3 font-heading text-4xl font-black">Un logiciel vendable, clair et complet.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="rounded-3xl border border-[#064e3b]/10 bg-white p-6 shadow-sm">
                <Icon className="mb-5 h-8 w-8 text-[#064e3b]" />
                <h3 className="font-heading text-xl font-black">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#50645c]">{feature.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="bg-[#09251c] px-6 py-18 text-white lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="font-black uppercase tracking-[0.25em] text-[#f5c464]">Espaces utilisateurs</p>
            <h2 className="mt-3 font-heading text-4xl font-black">Chaque rôle voit seulement ce qu’il doit gérer.</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((role) => (
              <div key={role} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/8 p-4">
                <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                <span className="font-bold">{role}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="plans" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="font-black uppercase tracking-[0.25em] text-[#c28c23]">Plans tarifaires</p>
            <h2 className="mt-3 font-heading text-4xl font-black">Basic ou Premium. Rien d’inutile.</h2>
          </div>
          <Link href="/connexion" className="inline-flex items-center gap-2 font-bold text-[#064e3b]">
            Déjà client ? Se connecter <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {plans.map((plan) => (
            <article key={plan.name} className="rounded-[2rem] border border-[#064e3b]/10 bg-white p-8 shadow-sm">
              <div className="mb-8 flex items-start justify-between gap-5">
                <div>
                  <h3 className="font-heading text-3xl font-black">{plan.name}</h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-[#50645c]">{plan.description}</p>
                </div>
                <Landmark className="h-8 w-8 text-[#c28c23]" />
              </div>
              <p className="text-4xl font-black text-[#064e3b]">{plan.price}</p>
              <p className="mt-1 text-sm font-semibold text-[#50645c]">{plan.renewal}</p>
              <div className="my-7 grid gap-2">
                {plan.items.map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm font-semibold">
                    <CheckCircle2 className="h-4 w-4 text-[#064e3b]" />
                    {item}
                  </div>
                ))}
              </div>
              <Link href={plan.href} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#064e3b] px-5 py-4 text-sm font-black text-white hover:bg-[#0b674f]">
                Acheter {plan.name} <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section id="contact" className="mx-auto max-w-7xl px-6 pb-16 lg:px-8">
        <div className="rounded-[2rem] bg-[#10231d] p-8 text-white md:p-10">
          <p className="text-sm font-bold text-emerald-200">Contact SoraSchool</p>
          <div className="mt-4 grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <h2 className="font-heading text-3xl font-black">Prêt à digitaliser votre établissement ?</h2>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/acheter" className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#064e3b]">Acheter maintenant</Link>
              <Link href="/connexion" className="rounded-2xl border border-white/20 px-5 py-3 text-sm font-black text-white">Se connecter</Link>
            </div>
          </div>
          <p className="mt-5 text-sm text-white/65">Email : contact@soratech.ci · WhatsApp : +225 07 04 92 80 68 · Site : soraschool.ci</p>
        </div>
      </section>
    </main>
  );
}
