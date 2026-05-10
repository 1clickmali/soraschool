"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle, RefreshCw, Save, ShieldCheck, UserCog } from "lucide-react";
import { schoolApi, type SchoolUser, type StaffMember, type StaffPermissions, type StaffRoleTemplate } from "@/lib/school-api";
import { cn } from "@/lib/utils";

const PERMISSIONS: Array<{ key: string; label: string }> = [
  { key: "students.view", label: "Voir apprenants" },
  { key: "students.edit", label: "Modifier apprenants" },
  { key: "admissions.manage", label: "Gérer inscriptions" },
  { key: "payments.manage", label: "Gérer paiements" },
  { key: "finance.view", label: "Voir finances" },
  { key: "receipts.generate", label: "Générer reçus" },
  { key: "grades.manage", label: "Gérer évaluations" },
  { key: "attendance.manage", label: "Gérer assiduité" },
  { key: "discipline.manage", label: "Gérer vie scolaire" },
  { key: "documents.manage", label: "Gérer documents" },
  { key: "calendar.manage", label: "Gérer calendrier" },
  { key: "reports.manage", label: "Gérer rapports" },
  { key: "staff.manage", label: "Gérer personnel" },
  { key: "payroll.view", label: "Voir paie" },
  { key: "payroll.edit", label: "Modifier paie" },
  { key: "justifications.review", label: "Valider justifications" },
  { key: "calendar.validate", label: "Valider calendrier" },
  { key: "admissions.validate", label: "Valider admissions" },
];

const SYSTEM_ROLES: Array<{ value: SchoolUser["role"]; label: string }> = [
  { value: "TEACHER", label: "Enseignant" },
  { value: "ACCOUNTANT", label: "Comptable" },
  { value: "SECRETARIAT", label: "Secrétariat" },
  { value: "ADMINISTRATION", label: "Administration" },
  { value: "STOCK_MANAGER", label: "Stock & fournitures" },
];

function emptyPermissions(): StaffPermissions {
  return Object.fromEntries(PERMISSIONS.map((item) => [item.key, false]));
}

export default function RolesPersonnelPage() {
  const [roles, setRoles] = useState<StaffRoleTemplate[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [systemRole, setSystemRole] = useState<SchoolUser["role"] | "">("");
  const [isActive, setIsActive] = useState(true);
  const [permissions, setPermissions] = useState<StaffPermissions>(emptyPermissions());
  const [roleForm, setRoleForm] = useState({ name: "", description: "", permissions: emptyPermissions() });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [rolesRes, staffRes] = await Promise.all([schoolApi.staffRoles(), schoolApi.staff()]);
    if (rolesRes.data?.roles) setRoles(rolesRes.data.roles);
    if (staffRes.data?.staff) setStaff(staffRes.data.staff);
    if (rolesRes.error || staffRes.error) setMessage({ type: "err", text: rolesRes.error || staffRes.error || "Erreur de chargement" });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectedStaff = useMemo(() => staff.find((member) => member.id === selectedStaffId), [staff, selectedStaffId]);

  useEffect(() => {
    if (!selectedStaff) return;
    setSelectedRoleId(selectedStaff.roleTemplateId ?? null);
    setSystemRole(selectedStaff.systemRole ?? "");
    setIsActive(selectedStaff.status !== "SUSPENDED");
    setPermissions({ ...emptyPermissions(), ...(selectedStaff.permissions ?? {}) });
  }, [selectedStaff]);

  const togglePermission = (key: string) => setPermissions((current) => ({ ...current, [key]: !current[key] }));
  const toggleRoleFormPermission = (key: string) => setRoleForm((current) => ({ ...current, permissions: { ...current.permissions, [key]: !current.permissions[key] } }));

  const createRole = async () => {
    if (!roleForm.name.trim()) {
      setMessage({ type: "err", text: "Le nom du rôle est obligatoire." });
      return;
    }
    setSaving(true);
    const { error } = await schoolApi.createStaffRole(roleForm);
    setSaving(false);
    setMessage(error ? { type: "err", text: error } : { type: "ok", text: "Rôle personnalisé créé." });
    if (!error) {
      setRoleForm({ name: "", description: "", permissions: emptyPermissions() });
      load();
    }
  };

  const applyPermissions = async () => {
    if (!selectedStaff) {
      setMessage({ type: "err", text: "Sélectionnez un personnel." });
      return;
    }
    setSaving(true);
    const { error } = await schoolApi.updateStaffPermissions(selectedStaff.id, {
      roleTemplateId: selectedRoleId || null,
      permissions,
      systemRole: systemRole || null,
      isActive,
    });
    setSaving(false);
    setMessage(error ? { type: "err", text: error } : { type: "ok", text: "Permissions mises à jour par la Direction." });
    if (!error) load();
  };

  return (
    <div className="min-h-screen bg-soraDark text-white">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-cyan-500/15 p-2.5"><ShieldCheck className="h-6 w-6 text-cyan-300" /></div>
          <div>
            <h1 className="font-heading text-2xl font-bold">Rôles & permissions du personnel</h1>
            <p className="text-sm text-gray-400">Seul le Directeur attribue les rôles internes, suspend ou réactive un accès.</p>
          </div>
        </div>

        {message && (
          <div className={cn("flex items-center gap-2 rounded-xl border p-3 text-sm", message.type === "ok" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "border-red-500/25 bg-red-500/10 text-red-300")}>
            {message.type === "ok" ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />} {message.text}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <h2 className="mb-4 flex items-center gap-2 font-semibold"><UserCog className="h-4 w-4 text-cyan-300" /> Créer un rôle modèle</h2>
            <div className="space-y-3">
              <input value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} placeholder="Ex : Surveillant principal" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none" />
              <input value={roleForm.description} onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} placeholder="Description" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none" />
              <div className="grid grid-cols-1 gap-2">
                {PERMISSIONS.map((permission) => (
                  <label key={permission.key} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-sm text-gray-300">
                    <input type="checkbox" checked={!!roleForm.permissions[permission.key]} onChange={() => toggleRoleFormPermission(permission.key)} />
                    {permission.label}
                  </label>
                ))}
              </div>
              <button disabled={saving} onClick={createRole} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-60">
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer le rôle
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Attribuer à un personnel</h2>
              <button onClick={load} className="rounded-xl border border-white/10 p-2 text-gray-300 transition hover:bg-white/10"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <select value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value)} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white [&>option]:bg-soraCard">
                <option value="">Sélectionner un personnel</option>
                {staff.map((member) => <option key={member.id} value={member.id}>{member.firstName} {member.lastName}</option>)}
              </select>
              <select value={selectedRoleId ?? ""} onChange={(e) => {
                const roleId = e.target.value || null;
                const role = roles.find((item) => item.id === roleId);
                setSelectedRoleId(roleId);
                if (role) setPermissions({ ...emptyPermissions(), ...role.permissions });
              }} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white [&>option]:bg-soraCard">
                <option value="">Aucun modèle</option>
                {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
              </select>
              <select value={systemRole} onChange={(e) => setSystemRole(e.target.value as SchoolUser["role"] | "")} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white [&>option]:bg-soraCard">
                <option value="">Pas de rôle système</option>
                {SYSTEM_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-sm text-gray-300">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Accès actif
              </label>
            </div>

            <div className="mt-5 grid gap-2 md:grid-cols-2">
              {PERMISSIONS.map((permission) => (
                <label key={permission.key} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-sm text-gray-300">
                  <input type="checkbox" checked={!!permissions[permission.key]} onChange={() => togglePermission(permission.key)} />
                  {permission.label}
                </label>
              ))}
            </div>

            <button disabled={saving || !selectedStaffId} onClick={applyPermissions} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60">
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Appliquer les permissions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
