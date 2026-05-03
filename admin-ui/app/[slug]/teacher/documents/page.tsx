"use client";

import { useEffect, useState } from "react";
import { Download, FileText, IdCard, RefreshCw } from "lucide-react";
import { downloadProtectedFile, schoolApi, type SchoolDocument, type Teacher } from "@/lib/school-api";

export default function TeacherDocumentsPage() {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [documents, setDocuments] = useState<SchoolDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const teacherRes = await schoolApi.teachers();
    const current = teacherRes.data?.teachers?.[0] || null;
    setTeacher(current);
    if (current) {
      const docsRes = await schoolApi.documents({ ownerType: "TEACHER", ownerId: current.id });
      setDocuments(docsRes.data?.documents || []);
      if (docsRes.error) setMessage(docsRes.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const openTeacherPdf = async (kind: "card" | "profile-pdf" | "contract-pdf") => {
    if (!teacher) return;
    const names = {
      card: `carte-professeur-${teacher.matricule || teacher.id}.pdf`,
      "profile-pdf": `fiche-professeur-${teacher.matricule || teacher.id}.pdf`,
      "contract-pdf": `contrat-professeur-${teacher.matricule || teacher.id}.pdf`,
    };
    const error = await downloadProtectedFile(`/api/teachers/${teacher.id}/${kind}`, names[kind], "open");
    if (error) setMessage(error);
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white">Mes documents</h1>
          <p className="mt-1 text-sm text-gray-400">Carte professeur, fiche RH, contrat et documents transmis par l’école.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/[0.09]">
          <RefreshCw className="h-4 w-4" />
          Actualiser
        </button>
      </div>

      {message && <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</div>}

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <button onClick={() => openTeacherPdf("card")} disabled={!teacher} className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-5 text-left text-white transition hover:bg-violet-500/15 disabled:opacity-50">
          <IdCard className="mb-3 h-5 w-5 text-violet-300" />
          <p className="font-semibold">Carte professeur</p>
          <p className="mt-1 text-xs text-gray-400">Ouvrir le PDF officiel</p>
        </button>
        <button onClick={() => openTeacherPdf("profile-pdf")} disabled={!teacher} className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-5 text-left text-white transition hover:bg-white/[0.07] disabled:opacity-50">
          <FileText className="mb-3 h-5 w-5 text-emerald-300" />
          <p className="font-semibold">Fiche professeur</p>
          <p className="mt-1 text-xs text-gray-400">Identité, affectations et documents RH</p>
        </button>
        <button onClick={() => openTeacherPdf("contract-pdf")} disabled={!teacher} className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-5 text-left text-white transition hover:bg-white/[0.07] disabled:opacity-50">
          <FileText className="mb-3 h-5 w-5 text-amber-300" />
          <p className="font-semibold">Contrat</p>
          <p className="mt-1 text-xs text-gray-400">Contrat généré par l’école</p>
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03]">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-sm font-semibold text-white">Documents téléversés</h2>
        </div>
        {loading ? (
          <div className="p-5 text-sm text-gray-500">Chargement...</div>
        ) : documents.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">Aucun document importé pour le moment.</div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {documents.map((document) => (
              <button key={document.id} onClick={() => downloadProtectedFile(document.fileUrl, document.title, "open")} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-white/[0.03]">
                <span>
                  <span className="block text-sm font-medium text-white">{document.title}</span>
                  <span className="text-xs text-gray-500">{document.type}</span>
                </span>
                <Download className="h-4 w-4 text-violet-300" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
