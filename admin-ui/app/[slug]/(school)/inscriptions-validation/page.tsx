"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardList, MessageSquareWarning, XCircle } from "lucide-react";
import { schoolApi, type Enrollment } from "@/lib/school-api";

function name(enrollment: Enrollment) {
  return enrollment.student ? `${enrollment.student.firstName} ${enrollment.student.lastName}` : "Élève";
}

function actor(user?: Enrollment["createdBy"]) {
  return user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.role : "Non renseigné";
}

export default function EnrollmentValidationPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [commentById, setCommentById] = useState<Record<string, string>>({});

  const load = async () => {
    const { data, error } = await schoolApi.pendingEnrollments();
    setMessage(error);
    setEnrollments(data?.enrollments || []);
  };

  useEffect(() => { void load(); }, []);

  const review = async (enrollment: Enrollment, decision: "VALIDATED" | "REFUSED" | "CORRECTION_REQUESTED") => {
    if (!enrollment.studentId) return;
    const { error } = await schoolApi.reviewEnrollment(enrollment.studentId, {
      decision,
      comment: commentById[enrollment.id],
    });
    setMessage(error || "Décision enregistrée.");
    void load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-white">Inscriptions à valider</h1>
        <p className="mt-1 text-sm text-gray-400">Toute inscription créée hors Direction reste en attente jusqu’à validation du Directeur.</p>
      </div>

      {message && <p className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-gray-300">{message}</p>}

      <div className="grid gap-4">
        {enrollments.map((enrollment) => (
          <article key={enrollment.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <ClipboardList className="h-5 w-5 text-emerald-500" />
                  <h2 className="font-heading text-xl font-bold text-white">{name(enrollment)}</h2>
                </div>
                <p className="mt-2 text-sm text-gray-400">
                  Année : {enrollment.academicYearLabel} · Statut : {enrollment.status}
                </p>
                <div className="mt-3 grid gap-1 text-xs text-gray-500">
                  <p>Créé par : {actor(enrollment.createdBy || enrollment.student?.createdBy)}</p>
                  <p>Date création : {new Date(enrollment.createdAt).toLocaleString("fr-FR")}</p>
                  <p>Classe : {enrollment.student?.classroom?.name || "Non affectée"}</p>
                </div>
              </div>
              <div className="min-w-[280px] space-y-3">
                <textarea
                  value={commentById[enrollment.id] || ""}
                  onChange={(e) => setCommentById((prev) => ({ ...prev, [enrollment.id]: e.target.value }))}
                  placeholder="Commentaire Directeur (optionnel)"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none"
                />
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => review(enrollment, "VALIDATED")} className="inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">
                    <CheckCircle2 className="h-4 w-4" /> Valider
                  </button>
                  <button onClick={() => review(enrollment, "CORRECTION_REQUESTED")} className="inline-flex items-center justify-center gap-1 rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white">
                    <MessageSquareWarning className="h-4 w-4" /> Corriger
                  </button>
                  <button onClick={() => review(enrollment, "REFUSED")} className="inline-flex items-center justify-center gap-1 rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white">
                    <XCircle className="h-4 w-4" /> Refuser
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      {enrollments.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
          <ClipboardList className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
          <p className="font-semibold text-white">Aucune inscription en attente</p>
          <p className="mt-1 text-sm text-gray-500">Les inscriptions créées par la Direction sont validées directement.</p>
        </div>
      )}
    </div>
  );
}
