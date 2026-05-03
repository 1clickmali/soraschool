"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Plus, Phone, ShieldCheck, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableRowSkeleton } from "@/components/ui/skeleton";
import { superAdminApi, type AllowedAccess, type Institution } from "@/lib/api";

const roles = ["DIRECTOR", "ADMINISTRATION", "TEACHER", "PARENT", "STOCK_MANAGER", "ACCOUNTANT", "SECRETARIAT"];

const roleColors: Record<string, string> = {
  SUPER_ADMIN: "text-soraGold bg-soraGold/10",
  DIRECTOR: "text-soraBlue bg-soraBlue/10",
  ADMINISTRATION: "text-purple-400 bg-purple-400/10",
  SECRETARIAT: "text-indigo-400 bg-indigo-400/10",
  TEACHER: "text-emerald-400 bg-emerald-400/10",
  PARENT: "text-orange-400 bg-orange-400/10",
  STOCK_MANAGER: "text-pink-400 bg-pink-400/10",
  ACCOUNTANT: "text-cyan-400 bg-cyan-400/10",
};

function fullName(access: AllowedAccess) {
  return [access.firstName, access.lastName].filter(Boolean).join(" ").trim() || "Utilisateur invité";
}

export default function AccesAutorisesPage() {
  const [list, setList] = useState<AllowedAccess[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState("");
  const [form, setForm] = useState({ phone: "", name: "", role: "TEACHER", institutionId: "", email: "" });

  const load = async () => {
    setLoading(true);
    const [accessRes, institutionsRes] = await Promise.all([
      superAdminApi.allowedPhones(selectedInstitutionId || undefined),
      superAdminApi.institutions(),
    ]);
    setList(accessRes.data?.allowedPhones || []);
    setInstitutions(institutionsRes.data?.institutions || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [selectedInstitutionId]);

  useEffect(() => {
    if (!form.institutionId && institutions[0]) {
      setForm((prev) => ({ ...prev, institutionId: institutions[0].id }));
    }
  }, [form.institutionId, institutions]);

  const revoke = async (id: string) => {
    const { error: err } = await superAdminApi.revokeAllowedPhone(id);
    if (!err) setList((prev) => prev.filter((item) => item.id !== id));
  };

  const submit = async () => {
    if (!form.institutionId || !form.phone.trim()) {
      setError("Institution et téléphone sont obligatoires.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error: err } = await superAdminApi.createAllowedPhone({
      institutionId: form.institutionId,
      phone: form.phone,
      name: form.name || undefined,
      role: form.role,
      email: form.email || undefined,
    });
    setSubmitting(false);
    if (err) {
      setError(err);
      return;
    }
    setShowForm(false);
    setForm({ phone: "", name: "", role: "TEACHER", institutionId: institutions[0]?.id || "", email: "" });
    load();
  };

  const inputCls = "w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-gray-600 focus:border-soraBlue/50 transition-colors text-sm";

  return (
    <div className="space-y-6 max-w-[1600px]">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-white">Accès autorisés</h1>
          <p className="text-gray-400 text-sm mt-0.5">{list.length} numéro{list.length !== 1 ? "s" : ""} autorisé{list.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select value={selectedInstitutionId} onChange={e => setSelectedInstitutionId(e.target.value)} className={inputCls}>
            <option value="" className="bg-soraCard">Toutes les écoles</option>
            {institutions.map((institution) => <option key={institution.id} value={institution.id} className="bg-soraCard">{institution.name}</option>)}
          </select>
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowForm(true)}>Ajouter</Button>
        </div>
      </motion.div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-soraCard border border-white/8 rounded-2xl p-5">
          <p className="text-sm font-semibold text-white mb-4">Nouveau numéro autorisé</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Institution *</label>
              <select value={form.institutionId} onChange={e => setForm({ ...form, institutionId: e.target.value })} className={inputCls}>
                {institutions.map((institution) => (
                  <option key={institution.id} value={institution.id} className="bg-soraCard">{institution.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Téléphone *</label>
              <input type="text" value={form.phone} placeholder="+225 07 00 00 00 00"
                onChange={e => setForm({ ...form, phone: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Nom complet</label>
              <input type="text" value={form.name} placeholder="Koné Aminata"
                onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Email</label>
              <input type="email" value={form.email} placeholder="utilisateur@ecole.ci"
                onChange={e => setForm({ ...form, email: e.target.value })} className={inputCls} />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-gray-400 mb-1 block">Rôle</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className={inputCls}>
                {roles.map(r => <option key={r} value={r} className="bg-soraCard">{r}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mb-3">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" loading={submitting} onClick={submit}>Ajouter</Button>
            <Button size="sm" variant="secondary" onClick={() => setShowForm(false)}>Annuler</Button>
          </div>
        </motion.div>
      )}

      <div className="bg-soraCard border border-white/8 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/8">
              {["Téléphone", "Nom", "Rôle", "Institution", "Statut", "Action"].map(h => (
                <th key={h} className="text-left px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center">
                  <ShieldCheck className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">Aucun accès autorisé</p>
                  <p className="text-gray-600 text-sm mt-1">Ajoutez les numéros qui peuvent se connecter aux écoles.</p>
                </td>
              </tr>
            ) : (
              list.map((access, i) => (
                <motion.tr key={access.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.04 * i }}
                  className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-4">
                    <span className="flex items-center gap-2 text-sm text-gray-300 font-mono">
                      <Phone className="w-3.5 h-3.5 text-gray-500" />{access.phone}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="flex items-center gap-2 text-sm text-white font-medium">
                      <User className="w-3.5 h-3.5 text-gray-500" />{fullName(access)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${roleColors[access.role] || "text-gray-400 bg-gray-400/10"}`}>
                      {access.role}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-400">{access.institution?.name || "—"}</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-emerald-400 bg-emerald-400/10">
                      <Check className="w-3 h-3" />
                      {access.usedAt ? "Utilisé" : "Autorisé"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button onClick={() => revoke(access.id)}
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium text-red-400 hover:bg-red-400/10 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                      Retirer
                    </button>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
