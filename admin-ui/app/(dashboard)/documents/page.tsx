"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Building2, Download, Eye, FileCheck, FileClock, FileText, Search, Trash2 } from "lucide-react";
import { superAdminApi, downloadProtectedFile, type Institution, type OfficialDocument } from "@/lib/api";

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: typeof FileText }> = {
  CONTRACT: { label: "Contrat", color: "text-soraBlue bg-soraBlue/10", icon: FileCheck },
  RECEIPT: { label: "Reçu", color: "text-emerald-400 bg-emerald-400/10", icon: FileCheck },
  REPORT_CARD: { label: "Bulletin", color: "text-purple-400 bg-purple-400/10", icon: FileClock },
  PHOTO: { label: "Photo", color: "text-soraGold bg-soraGold/10", icon: FileText },
  OTHER: { label: "Autre", color: "text-gray-400 bg-gray-400/10", icon: FileText },
};

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${bytes} o`;
}

export default function DocumentsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Tous");
  const [selectedInstitutionId, setSelectedInstitutionId] = useState("");
  const [docs, setDocs] = useState<OfficialDocument[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);

  const load = async () => {
    const { data } = await superAdminApi.documents(selectedInstitutionId || undefined);
    setDocs(data?.documents || []);
  };

  useEffect(() => {
    superAdminApi.institutions().then(({ data }) => setInstitutions(data?.institutions || []));
  }, []);

  useEffect(() => {
    load();
  }, [selectedInstitutionId]);

  const filters = ["Tous", ...Array.from(new Set(docs.map((doc) => TYPE_CONFIG[doc.type]?.label || doc.type)))];
  const filtered = docs.filter((doc) => {
    const typeLabel = TYPE_CONFIG[doc.type]?.label || doc.type;
    const matchSearch =
      search === "" ||
      doc.title.toLowerCase().includes(search.toLowerCase()) ||
      doc.institution?.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "Tous" || typeLabel === filter;
    return matchSearch && matchFilter;
  });

  const remove = async (id: string) => {
    const { error } = await superAdminApi.deleteDocument(id);
    if (!error) setDocs((prev) => prev.filter((doc) => doc.id !== id));
  };

  return (
    <div className="space-y-6 max-w-[1600px]">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold font-heading text-white">Documents officiels</h1>
        <p className="text-gray-400 text-sm mt-0.5">{docs.length} document{docs.length !== 1 ? "s" : ""} synchronisé{docs.length !== 1 ? "s" : ""} depuis les écoles</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-xs flex-1">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <select
            value={selectedInstitutionId}
            onChange={(event) => setSelectedInstitutionId(event.target.value)}
            className="w-full bg-soraCard border border-white/8 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:border-white/20 transition-colors [&>option]:bg-soraCard"
          >
            <option value="">Toutes les écoles</option>
            {institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name}</option>)}
          </select>
        </div>
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" value={search} placeholder="Rechercher un document..."
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-soraCard border border-white/8 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-white/20 transition-colors" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {filters.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${filter === f ? "bg-soraBlue text-white" : "bg-soraCard border border-white/8 text-gray-400 hover:text-white"}`}>
              {f}
            </button>
          ))}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((doc, i) => {
          const cfg = TYPE_CONFIG[doc.type] || TYPE_CONFIG.OTHER;
          const Icon = cfg.icon;
          return (
            <motion.div key={doc.id}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="bg-soraCard border border-white/8 rounded-2xl p-4 hover:border-white/15 transition-all group">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{doc.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{doc.institution?.name || "Institution inconnue"}</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/6">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                  <span className="text-xs text-gray-600">{formatSize(doc.sizeBytes)}</span>
                  <span className="text-xs text-gray-600">{new Date(doc.createdAt).toLocaleDateString("fr-CI")}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => downloadProtectedFile(`/api/super-admin/documents/${doc.id}/download`, doc.title)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => downloadProtectedFile(`/api/super-admin/documents/${doc.id}/download`, doc.title)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-soraBlue hover:bg-soraBlue/10 transition-colors">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => remove(doc.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <FileText className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Aucun document trouvé</p>
        </div>
      )}
    </div>
  );
}
