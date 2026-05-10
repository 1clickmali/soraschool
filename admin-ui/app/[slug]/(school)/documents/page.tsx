"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileText, Folder, FolderPlus, Search, ShieldCheck, Trash2, Upload } from "lucide-react";
import { schoolApi, type DocumentFolder, type SchoolDocument } from "@/lib/school-api";
import { getApiBaseUrl } from "@/lib/api-url";
import { getSchoolToken } from "@/lib/school-auth";

const documentTypes = ["PHOTO", "BIRTH_CERTIFICATE", "ID_CARD", "MEDICAL_CERTIFICATE", "REPORT_CARD", "DIPLOMA", "CV", "CONTRACT", "RECEIPT", "OTHER"];
const folderCategories = [
  "DIRECTION",
  "ACCOUNTING",
  "SECRETARIAT",
  "TEACHERS",
  "CLASSES",
  "STUDENTS",
  "PARENTS",
  "CONTRACTS",
  "INVOICES",
  "RECEIPTS",
  "REPORT_CARDS",
  "ENROLLMENT_FORMS",
  "REPORTS",
  "OFFICIAL_DOCUMENTS",
  "BUDGET",
  "OTHER",
];

const categoryLabels: Record<string, string> = {
  DIRECTION: "Direction",
  ACCOUNTING: "Comptabilité",
  SECRETARIAT: "Secrétariat",
  TEACHERS: "Enseignants",
  CLASSES: "Classes",
  STUDENTS: "Élèves",
  PARENTS: "Parents",
  CONTRACTS: "Contrats",
  INVOICES: "Factures",
  RECEIPTS: "Reçus",
  REPORT_CARDS: "Bulletins",
  ENROLLMENT_FORMS: "Fiches d’inscription",
  REPORTS: "Rapports",
  OFFICIAL_DOCUMENTS: "Documents officiels",
  BUDGET: "Budget",
  OTHER: "Autres",
};

function actor(user?: SchoolDocument["uploadedBy"]) {
  return user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.role : "Non renseigné";
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<SchoolDocument[]>([]);
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [search, setSearch] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [category, setCategory] = useState("");
  const [ownerType, setOwnerType] = useState("INSTITUTION");
  const [ownerId, setOwnerId] = useState("");
  const [type, setType] = useState("OTHER");
  const [files, setFiles] = useState<File[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderCategory, setNewFolderCategory] = useState("OTHER");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const selectedFolder = useMemo(() => folders.find((folder) => folder.id === selectedFolderId), [folders, selectedFolderId]);

  const load = useCallback(async () => {
    setLoading(true);
    const [folderRes, docRes, settingsRes] = await Promise.all([
      schoolApi.documentFolders(),
      schoolApi.documents({ search, folderId: selectedFolderId || undefined, category: category || undefined }),
      schoolApi.settings(),
    ]);
    setLoading(false);
    if (folderRes.data?.folders) {
      setFolders(folderRes.data.folders);
      if (!selectedFolderId && folderRes.data.folders[0]) setSelectedFolderId(folderRes.data.folders[0].id);
    }
    if (docRes.data?.documents) setDocuments(docRes.data.documents);
    if (settingsRes.data?.institution?.id && !ownerId) setOwnerId(settingsRes.data.institution.id);
    if (folderRes.error || docRes.error) setMessage(folderRes.error || docRes.error);
  }, [category, ownerId, search, selectedFolderId]);

  useEffect(() => { void load(); }, [load]);

  const createFolder = async () => {
    if (!newFolderName.trim()) {
      setMessage("Nom du dossier requis.");
      return;
    }
    const { data, error } = await schoolApi.createDocumentFolder({ name: newFolderName.trim(), category: newFolderCategory });
    setMessage(error || "Dossier créé.");
    if (!error && data?.folder) {
      setNewFolderName("");
      setSelectedFolderId(data.folder.id);
      void load();
    }
  };

  const upload = async () => {
    if (!selectedFolderId) { setMessage("Choisissez un dossier avant l’upload. Aucun fichier ne doit être orphelin."); return; }
    if (!ownerId.trim()) { setMessage("Renseignez le propriétaire du document."); return; }
    if (!files.length) { setMessage("Choisissez au moins un fichier PDF/JPG/PNG."); return; }
    const uploadCategory = selectedFolder?.category || "OTHER";
    const { error } = await schoolApi.uploadDocuments(ownerType, ownerId.trim(), type, files, undefined, selectedFolderId, uploadCategory);
    setMessage(error || "Document envoyé dans le dossier sélectionné.");
    if (!error) {
      setFiles([]);
      void load();
    }
  };

  const remove = async (id: string) => {
    const { error } = await schoolApi.deleteDocument(id);
    setMessage(error || "Document supprimé.");
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
        <h1 className="font-heading text-2xl font-bold text-white">Documents officiels</h1>
        <p className="mt-1 text-sm text-gray-400">Dossiers, permissions, tri, traçabilité et fichiers toujours classés.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <aside className="space-y-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-white">Dossiers</p>
            <Folder className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="space-y-2">
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => setSelectedFolderId(folder.id)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                  selectedFolderId === folder.id ? "bg-emerald-500/15 text-emerald-300" : "bg-white/[0.03] text-gray-300 hover:bg-white/[0.07]"
                }`}
              >
                <span className="truncate">{folder.name}</span>
                <span className="text-xs text-gray-500">{folder._count?.documents ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-white/10 bg-black/10 p-3">
            <p className="mb-2 text-xs font-bold uppercase text-gray-500">Nouveau dossier</p>
            <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Nom du dossier" className="mb-2 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none" />
            <select value={newFolderCategory} onChange={(e) => setNewFolderCategory(e.target.value)} className="mb-2 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white [&>option]:bg-soraCard">
              {folderCategories.map((item) => <option key={item} value={item}>{categoryLabels[item]}</option>)}
            </select>
            <button onClick={createFolder} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white">
              <FolderPlus className="h-4 w-4" /> Créer dossier
            </button>
          </div>
        </aside>

        <main className="space-y-5">
          <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 lg:grid-cols-6">
            <select value={ownerType} onChange={(e) => setOwnerType(e.target.value)} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white [&>option]:bg-soraCard">
              {["INSTITUTION", "STUDENT", "TEACHER", "PARENT", "USER"].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <input value={ownerId} onChange={(e) => setOwnerId(e.target.value)} placeholder="ID propriétaire" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none" />
            <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white [&>option]:bg-soraCard">
              {documentTypes.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <select value={selectedFolderId} onChange={(e) => setSelectedFolderId(e.target.value)} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white [&>option]:bg-soraCard">
              <option value="">Choisir dossier</option>
              {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
            </select>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/15 px-3 py-2 text-sm text-gray-300">
              <Upload className="h-4 w-4 text-emerald-500" />
              {files.length ? `${files.length} fichier(s)` : "PDF/JPG/PNG"}
              <input hidden multiple type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
            </label>
            <button onClick={upload} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500">Uploader</button>
            {message && <p className="lg:col-span-6 text-sm text-gray-300">{message}</p>}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex max-w-md flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5">
              <Search className="h-4 w-4 text-emerald-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher document..." className="flex-1 bg-transparent text-sm text-white outline-none" />
            </div>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white [&>option]:bg-soraCard">
              <option value="">Toutes catégories</option>
              {folderCategories.map((item) => <option key={item} value={item}>{categoryLabels[item]}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {documents.map((doc) => (
              <div key={doc.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
                <div className="flex items-start gap-3">
                  <FileText className="mt-1 h-5 w-5 text-emerald-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white">{doc.title}</p>
                    <p className="mt-1 text-xs text-gray-500">{doc.type} · {(doc.sizeBytes / 1024).toFixed(1)} Ko</p>
                    <p className="mt-1 text-xs text-gray-600">Dossier : {doc.folder?.name || "Non classés"}</p>
                    <p className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                      <ShieldCheck className="h-3 w-3 text-emerald-500" />
                      Créé par : {actor(doc.uploadedBy)}
                    </p>
                  </div>
                  <button onClick={() => download(doc)} className="rounded-lg p-2 text-gray-400 hover:bg-emerald-500/10 hover:text-emerald-400">
                    <Download className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove(doc.id)} className="rounded-lg p-2 text-gray-500 hover:bg-red-500/10 hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {!loading && documents.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
              <FileText className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
              <p className="font-semibold text-white">Aucun document</p>
              <p className="mt-1 text-sm text-gray-500">Créez un dossier, puis envoyez un fichier classé.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
