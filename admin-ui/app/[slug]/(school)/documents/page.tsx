"use client";

import { useEffect, useState } from "react";
import { Download, FileText, Search, Trash2, Upload } from "lucide-react";
import { schoolApi, type SchoolDocument } from "@/lib/school-api";
import { getApiBaseUrl } from "@/lib/api-url";
import { getSchoolToken } from "@/lib/school-auth";

const documentTypes = ["PHOTO", "BIRTH_CERTIFICATE", "ID_CARD", "MEDICAL_CERTIFICATE", "REPORT_CARD", "DIPLOMA", "CV", "CONTRACT", "RECEIPT", "OTHER"];

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<SchoolDocument[]>([]);
  const [search, setSearch] = useState("");
  const [ownerType, setOwnerType] = useState("STUDENT");
  const [ownerId, setOwnerId] = useState("");
  const [type, setType] = useState("OTHER");
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    const { data } = await schoolApi.documents({ search });
    setDocuments(data?.documents || []);
  };

  useEffect(() => { void load(); }, [search]);

  const upload = async () => {
    if (!ownerId.trim()) { setMessage("Renseignez l'ID du propriétaire (élève/prof/école)"); return; }
    if (!files.length) { setMessage("Choisissez au moins un fichier PDF/JPG/PNG"); return; }
    const { error } = await schoolApi.uploadDocuments(ownerType, ownerId.trim(), type, files);
    setMessage(error || "Document envoyé");
    if (!error) {
      setFiles([]);
      void load();
    }
  };

  const remove = async (id: string) => {
    await schoolApi.deleteDocument(id);
    void load();
  };

  const download = async (doc: SchoolDocument) => {
    const token = getSchoolToken();
    const res = await fetch(`${getApiBaseUrl()}${doc.fileUrl}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-white">Documents</h1>
        <p className="text-gray-400 text-sm mt-1">Documents élèves, parents, professeurs, école, reçus, cartes et bulletins.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
        <select value={ownerType} onChange={(e) => setOwnerType(e.target.value)} className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white [&>option]:bg-soraCard">
          {["STUDENT", "TEACHER", "PARENT", "INSTITUTION", "USER"].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <input value={ownerId} onChange={(e) => setOwnerId(e.target.value)} placeholder="ID propriétaire" className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white" />
        <select value={type} onChange={(e) => setType(e.target.value)} className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white [&>option]:bg-soraCard">
          {documentTypes.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <label className="flex items-center gap-2 rounded-xl border border-dashed border-white/15 px-3 py-2 text-sm text-gray-300 cursor-pointer">
          <Upload className="w-4 h-4 text-emerald-500" />
          {files.length ? `${files.length} fichier(s)` : "PDF/JPG/PNG"}
          <input hidden multiple type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
        </label>
        <button onClick={upload} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500">Uploader</button>
        {message && <p className="lg:col-span-5 text-sm text-gray-300">{message}</p>}
      </div>

      <div className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 max-w-md">
        <Search className="w-4 h-4 text-emerald-500" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher document, type, matricule..." className="bg-transparent text-sm text-white outline-none flex-1" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {documents.map((doc) => (
          <div key={doc.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-emerald-500 mt-1" />
              <div className="min-w-0 flex-1">
                <p className="text-white font-semibold truncate">{doc.title}</p>
                <p className="text-xs text-gray-500 mt-1">{doc.type} · {(doc.sizeBytes / 1024).toFixed(1)} Ko</p>
                <p className="text-xs text-gray-600 mt-1">{doc.ownerType} · {doc.ownerId}</p>
              </div>
              <button onClick={() => download(doc)} className="p-2 rounded-lg text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10">
                <Download className="w-4 h-4" />
              </button>
              <button onClick={() => remove(doc.id)} className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      {documents.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
          <FileText className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <p className="text-white font-semibold">Aucun document</p>
          <p className="text-sm text-gray-500 mt-1">Ajoutez des pièces PDF/JPG/PNG pour les dossiers.</p>
        </div>
      )}
    </div>
  );
}
