"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Briefcase, Mail, Phone, RefreshCw, School } from "lucide-react";
import { schoolApi, type Teacher } from "@/lib/school-api";

export default function TeacherProfilePage() {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await schoolApi.teachers();
    setTeacher(data?.teachers?.[0] || null);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const fullName = teacher ? `${teacher.firstName} ${teacher.lastName}` : "Enseignant";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white">Mon profil</h1>
          <p className="mt-1 text-sm text-gray-400">Vos informations professionnelles sont gérées par la direction.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/[0.09]">
          <RefreshCw className="h-4 w-4" />
          Actualiser
        </button>
      </div>

      {loading ? (
        <div className="h-56 animate-pulse rounded-3xl border border-white/[0.07] bg-white/[0.04]" />
      ) : !teacher ? (
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.03] p-8 text-center text-gray-400">Profil professeur introuvable.</div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
          <section className="rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-500/14 to-white/[0.03] p-6">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-violet-600 text-2xl font-bold text-white">
              {teacher.firstName?.[0]}{teacher.lastName?.[0]}
            </div>
            <h2 className="font-heading text-2xl font-bold text-white">{fullName}</h2>
            <p className="mt-1 text-sm text-violet-200">{teacher.matricule || "Matricule non défini"}</p>
            <div className="mt-5 inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              {teacher.status || "ACTIVE"}
            </div>
          </section>

          <section className="rounded-3xl border border-white/[0.07] bg-white/[0.03] p-6">
            <h3 className="mb-4 font-semibold text-white">Informations</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <Info icon={Phone} label="Téléphone" value={teacher.phone || "Non renseigné"} />
              <Info icon={Mail} label="Email" value={teacher.email || "Non renseigné"} />
              <Info icon={Briefcase} label="Contrat" value={teacher.contractType || "Non renseigné"} />
              <Info icon={BadgeCheck} label="Spécialité" value={teacher.specialization || teacher.speciality || "Général"} />
            </div>
            <div className="mt-5">
              <h3 className="mb-3 font-semibold text-white">Affectations</h3>
              {!teacher.assignments?.length ? (
                <p className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-sm text-gray-500">Aucune affectation enregistrée.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {teacher.assignments.map((assignment, index) => (
                    <div key={`${assignment.classroom?.id}-${assignment.subject?.id}-${index}`} className="rounded-xl border border-white/[0.07] bg-white/[0.04] p-4">
                      <School className="mb-2 h-4 w-4 text-violet-300" />
                      <p className="font-medium text-white">{assignment.classroom?.name || "Classe"}</p>
                      <p className="text-xs text-gray-500">{assignment.subject?.name || "Matière"}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.04] p-4">
      <Icon className="mb-2 h-4 w-4 text-violet-300" />
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
