"use client";

import { useEffect, useState } from "react";
import { Building2, ImageIcon, Link, Palette, Save, Settings, Upload } from "lucide-react";
import { schoolApi, type SchoolSettings } from "@/lib/school-api";
import { SecureImage } from "@/components/ui/secure-image";
import { resolveAssetUrl } from "@/lib/api-url";

type AssetKey = "logoUrl" | "sealUrl" | "signatureUrl";

const assetFields: Array<{ key: AssetKey; type: string; label: string; help: string }> = [
  { key: "logoUrl", type: "LOGO", label: "Logo école", help: "Affiché sur les cartes, fiches et documents officiels." },
  { key: "sealUrl", type: "SEAL", label: "Cachet", help: "Utilisé pour les documents administratifs." },
  { key: "signatureUrl", type: "SIGNATURE", label: "Signature", help: "Signature officielle de la direction." },
];

const identityFields: Array<[keyof SchoolSettings, string, string]> = [
  ["name", "Nom officiel", "Institut / École"],
  ["motto", "Devise / slogan", "Sincérité - Science - Pratique"],
  ["phone", "Téléphone", "+225..."],
  ["whatsapp", "WhatsApp", "+225..."],
  ["email", "Email", "direction@ecole.ci"],
  ["address", "Adresse", "Quartier, ville"],
  ["website", "Site web", "https://..."],
  ["directorName", "Directeur", "Nom du responsable"],
  ["activeAcademicYearName", "Année scolaire active", "2025-2026"],
  ["currency", "Devise monétaire", "XOF"],
];

const colorFields: Array<[keyof SchoolSettings, string, string]> = [
  ["primaryColor", "Couleur principale", "#064E3B"],
  ["secondaryColor", "Couleur secondaire", "#F7F1DE"],
  ["accentColor", "Couleur accent", "#C89B3C"],
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Partial<SchoolSettings>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await schoolApi.settings();
    if (error) setMessage(error);
    if (data?.institution) setSettings(data.institution);
  };

  useEffect(() => {
    void load();
  }, []);

  const update = (key: keyof SchoolSettings, value: string) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    const payload = Object.fromEntries(
      Object.entries(settings).filter(([, value]) => value !== null && value !== undefined && value !== "")
    ) as Partial<SchoolSettings>;
    const { error } = await schoolApi.updateSettings(payload);
    setSaving(false);
    setMessage(error || "Paramètres enregistrés. Les prochains PDF utiliseront ces couleurs et logos.");
    if (!error) void load();
  };

  const uploadAsset = async (field: (typeof assetFields)[number], file?: File | null) => {
    if (!file) return;
    const institutionId = settings.institutionId || settings.id;
    if (!institutionId) {
      setMessage("Impossible d'uploader : institution introuvable.");
      return;
    }
    setUploading(field.key);
    const { data, error } = await schoolApi.uploadDocuments("INSTITUTION", institutionId, field.type, [file], field.label);
    setUploading(null);
    if (error) {
      setMessage(error);
      return;
    }
    const fileUrl = data?.documents?.[0]?.fileUrl;
    if (fileUrl) setSettings((current) => ({ ...current, [field.key]: fileUrl }));
    setMessage(`${field.label} importé avec succès.`);
    void load();
  };

  const primary = settings.primaryColor || "#064E3B";
  const secondary = settings.secondaryColor || "#F7F1DE";
  const accent = settings.accentColor || "#C89B3C";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-white">Paramètres</h1>
          <p className="text-gray-400 text-sm mt-1">Identité école, logo, couleurs premium, cachet, signature et informations officielles.</p>
        </div>
        <button onClick={save} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60">
          <Save className="w-4 h-4" /> {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-white">Identité visuelle</p>
              <p className="text-xs text-gray-500">Ces fichiers alimentent les cartes, contrats et fiches PDF.</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {assetFields.map((field) => {
              const currentUrl = settings[field.key];
              const displayUrl = currentUrl ? resolveAssetUrl(currentUrl) : null;
              return (
                <div key={field.key} className="rounded-2xl border border-white/[0.08] bg-black/15 p-3">
                  <div className="mb-3 flex h-24 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
                    {displayUrl
                      ? <img key={displayUrl} src={displayUrl} alt={field.label} className="h-full w-full object-contain p-2" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      : <span className="text-xs text-gray-600">Aucun fichier</span>
                    }
                  </div>
                  <p className="text-sm font-semibold text-white">{field.label}</p>
                  <p className="mt-1 min-h-8 text-xs text-gray-500">{field.help}</p>
                  {/* URL directe */}
                  <div className="mt-2 flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1.5">
                    <Link className="h-3 w-3 shrink-0 text-gray-600" />
                    <input
                      className="flex-1 bg-transparent text-xs text-white placeholder:text-gray-600 outline-none"
                      placeholder="https://... (coller URL)"
                      value={currentUrl && /^https?:\/\//.test(currentUrl) ? currentUrl : ""}
                      onChange={(e) => update(field.key, e.target.value)}
                    />
                  </div>
                  {/* Upload */}
                  <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/[0.05] px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/[0.09]">
                    <Upload className="h-3.5 w-3.5" />
                    {uploading === field.key ? "Import..." : "Ou importer fichier"}
                    <input hidden type="file" accept="image/jpeg,image/png" onChange={(event) => void uploadAsset(field, event.target.files?.[0])} />
                  </label>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-white">Couleurs des documents</p>
              <p className="text-xs text-gray-500">La carte élève/professeur reprend ces couleurs.</p>
            </div>
          </div>

          <div className="mb-5 overflow-hidden rounded-2xl border border-white/10">
            <div className="h-20 px-5 py-4" style={{ background: primary }}>
              <div className="h-10 w-20 rounded-xl border-2 p-2" style={{ borderColor: accent, background: secondary }}>
                <div className="h-full w-full rounded-lg" style={{ background: primary }} />
              </div>
            </div>
            <div className="flex items-center justify-between bg-white px-5 py-4">
              <div>
                <p className="text-sm font-bold" style={{ color: primary }}>{settings.name || "Nom de l'école"}</p>
                <p className="text-xs" style={{ color: "#647067" }}>{settings.motto || "Devise de l'établissement"}</p>
              </div>
              <div className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: accent, color: primary }}>CARTE</div>
            </div>
          </div>

          <div className="grid gap-3">
            {colorFields.map(([key, label, fallback]) => (
              <label key={key} className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-black/15 p-3">
                <span>
                  <span className="block text-sm font-semibold text-white">{label}</span>
                  <span className="text-xs text-gray-500">{String(settings[key] || fallback)}</span>
                </span>
                <input type="color" value={String(settings[key] || fallback)} onChange={(event) => update(key, event.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-white/10 bg-transparent" />
              </label>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-white">Informations officielles</p>
            <p className="text-xs text-gray-500">Ces informations apparaissent sur les fiches, contrats et reçus.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {identityFields.map(([key, label, placeholder]) => (
            <label key={key} className="block rounded-2xl border border-white/[0.07] bg-black/15 p-4">
              <span className="text-xs font-medium text-gray-400">{label}</span>
              <input
                value={String(settings[key] || "")}
                onChange={(event) => update(key, event.target.value)}
                placeholder={placeholder}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none placeholder:text-gray-600 focus:border-emerald-500/50"
              />
            </label>
          ))}
        </div>
      </section>

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
        <div className="flex items-start gap-3">
          <Settings className="w-5 h-5 text-emerald-500 mt-1" />
          <div>
            <p className="text-white font-semibold">Important</p>
            <p className="text-sm text-gray-500 mt-1">Après changement du logo ou des couleurs, ouvre à nouveau les cartes PDF : elles sont générées dynamiquement avec les nouveaux paramètres.</p>
          </div>
        </div>
      </div>

      {message && <p className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-gray-300">{message}</p>}
    </div>
  );
}
