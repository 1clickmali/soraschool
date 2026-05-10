"use client";

import { useEffect, useState, useCallback } from "react";
import { Globe, BookOpen, Plus, Save, AlertCircle, CheckCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { schoolApiRequest } from "@/lib/school-api";

interface CountryConfig {
  code: string;
  name: string;
  nameFr: string;
  currency: string;
  gradingSystem: string;
  passingThreshold: number;
  maxScore: number;
  termCount: number;
}

interface Curriculum {
  id: string;
  countryCode: string;
  institutionKind: string;
  cycle: string;
  name: string;
  description?: string;
  isActive: boolean;
  subjects: Array<{ id: string; name: string; weeklyHours: number; coefficient: number; isCompulsory: boolean; order: number }>;
}

const CYCLE_LABELS: Record<string, string> = {
  MATERNELLE: "Maternelle",
  PRIMAIRE: "Primaire",
  COLLEGE: "Collège",
  LYCEE: "Lycée",
  UNIVERSITE: "Université",
  FORMATION: "Formation professionnelle",
};

export default function ConfigPaysPage() {
  const [countries, setCountries] = useState<CountryConfig[]>([]);
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [editingCountry, setEditingCountry] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<CountryConfig>>({});
  const [saving, setSaving] = useState(false);

  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [expandedCurriculum, setExpandedCurriculum] = useState<string | null>(null);

  const [showAddCurriculum, setShowAddCurriculum] = useState(false);
  const [newCurriculum, setNewCurriculum] = useState({
    countryCode: "",
    institutionKind: "PRIMARY",
    cycle: "PRIMAIRE",
    name: "",
    description: "",
  });
  const [addingCurriculum, setAddingCurriculum] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [cRes, curRes] = await Promise.all([
      schoolApiRequest<{ countries: CountryConfig[] }>("/api/curriculum/countries/config"),
      schoolApiRequest<{ curricula: Curriculum[] }>("/api/curriculum"),
    ]);
    if (cRes.data) setCountries(cRes.data.countries);
    if (curRes.data) setCurricula(curRes.data.curricula);
    if (cRes.error) setError(cRes.error);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveCountry = async (code: string) => {
    setSaving(true);
    const res = await schoolApiRequest(`/api/curriculum/countries/${code}`, {
      method: "PATCH",
      body: editForm,
    });
    if (res.data) {
      setSuccess(`Pays ${code} mis à jour`);
      setEditingCountry(null);
      fetchData();
    } else {
      setError(res.error ?? "Erreur");
    }
    setSaving(false);
  };

  const handleAddCurriculum = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingCurriculum(true);
    const res = await schoolApiRequest<{ curriculum: Curriculum }>("/api/curriculum", {
      method: "POST",
      body: newCurriculum,
    });
    if (res.data) {
      setSuccess("Curriculum créé");
      setShowAddCurriculum(false);
      setNewCurriculum({ countryCode: "", institutionKind: "PRIMARY", cycle: "PRIMAIRE", name: "", description: "" });
      fetchData();
    } else {
      setError(res.error ?? "Erreur");
    }
    setAddingCurriculum(false);
  };

  const filteredCurricula = selectedCountry
    ? curricula.filter((c) => c.countryCode === selectedCountry)
    : curricula;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-600 flex items-center justify-center">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pays & programmes</h1>
            <p className="text-sm text-gray-500">Paramètres régionaux CEDEAO et curricula officiels</p>
          </div>
        </div>
      </div>

      {/* Banners */}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />{success}
          <button className="ml-auto" onClick={() => setSuccess(null)}>✕</button>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Countries */}
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-600" />
            <h2 className="font-semibold text-gray-800">Pays CEDEAO ({countries.length})</h2>
            {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400 ml-auto" />}
          </div>
          <div className="divide-y divide-gray-100 max-h-[560px] overflow-y-auto">
            {countries.map((c) => (
              <div key={c.code} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-gray-800">{c.code}</span>
                    <span className="ml-2 text-gray-600 text-sm">{c.nameFr}</span>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">{c.gradingSystem}</span>
                      <span className="text-xs px-2 py-0.5 bg-blue-50 rounded-full text-blue-600">Seuil: {c.passingThreshold}/{c.maxScore}</span>
                      <span className="text-xs px-2 py-0.5 bg-gray-50 rounded-full text-gray-500">{c.termCount} trimestre(s)</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (editingCountry === c.code) {
                        setEditingCountry(null);
                      } else {
                        setEditingCountry(c.code);
                        setEditForm({ passingThreshold: c.passingThreshold, maxScore: c.maxScore, termCount: c.termCount, gradingSystem: c.gradingSystem });
                      }
                    }}
                    className="text-xs px-2.5 py-1 border rounded-lg hover:bg-gray-50 transition"
                  >
                    {editingCountry === c.code ? "Annuler" : "Modifier"}
                  </button>
                </div>
                {editingCountry === c.code && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 font-medium block mb-1">Système de notation</label>
                        <select
                          value={editForm.gradingSystem ?? c.gradingSystem}
                          onChange={(e) => setEditForm((f) => ({ ...f, gradingSystem: e.target.value }))}
                          className="border rounded-lg px-2 py-1.5 text-sm w-full"
                        >
                          <option value="numeric_20">Numérique /20</option>
                          <option value="numeric_100">Numérique /100</option>
                          <option value="letter">Lettres (A–F)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 font-medium block mb-1">Nombre de trimestres</label>
                        <select
                          value={editForm.termCount ?? c.termCount}
                          onChange={(e) => setEditForm((f) => ({ ...f, termCount: parseInt(e.target.value) }))}
                          className="border rounded-lg px-2 py-1.5 text-sm w-full"
                        >
                          <option value={2}>2 semestres</option>
                          <option value={3}>3 trimestres</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 font-medium block mb-1">Score max</label>
                        <input
                          type="number" min={10} max={100} step={1}
                          value={editForm.maxScore ?? c.maxScore}
                          onChange={(e) => setEditForm((f) => ({ ...f, maxScore: parseFloat(e.target.value) }))}
                          className="border rounded-lg px-2 py-1.5 text-sm w-full"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 font-medium block mb-1">Seuil de réussite</label>
                        <input
                          type="number" min={0} max={100} step={0.5}
                          value={editForm.passingThreshold ?? c.passingThreshold}
                          onChange={(e) => setEditForm((f) => ({ ...f, passingThreshold: parseFloat(e.target.value) }))}
                          className="border rounded-lg px-2 py-1.5 text-sm w-full"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => handleSaveCountry(c.code)}
                      disabled={saving}
                      className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 text-white rounded-lg text-sm hover:bg-cyan-700 disabled:opacity-60"
                    >
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      Enregistrer
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Curricula */}
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <h2 className="font-semibold text-gray-800">Programmes officiels ({curricula.length})</h2>
            <button
              onClick={() => setShowAddCurriculum(!showAddCurriculum)}
              className="ml-auto flex items-center gap-1.5 px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs hover:bg-indigo-700"
            >
              <Plus className="w-3 h-3" />
              Ajouter
            </button>
          </div>

          {showAddCurriculum && (
            <div className="border-b p-4 bg-indigo-50">
              <form onSubmit={handleAddCurriculum} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 font-medium block mb-1">Pays</label>
                    <select
                      value={newCurriculum.countryCode}
                      onChange={(e) => setNewCurriculum((f) => ({ ...f, countryCode: e.target.value }))}
                      className="border rounded-lg px-2 py-1.5 text-sm w-full"
                      required
                    >
                      <option value="">— Pays —</option>
                      {countries.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.nameFr}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium block mb-1">Cycle</label>
                    <select
                      value={newCurriculum.cycle}
                      onChange={(e) => setNewCurriculum((f) => ({ ...f, cycle: e.target.value }))}
                      className="border rounded-lg px-2 py-1.5 text-sm w-full"
                    >
                      {Object.entries(CYCLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium block mb-1">Type d'établissement</label>
                    <select
                      value={newCurriculum.institutionKind}
                      onChange={(e) => setNewCurriculum((f) => ({ ...f, institutionKind: e.target.value }))}
                      className="border rounded-lg px-2 py-1.5 text-sm w-full"
                    >
                      <option value="MATERNELLE">Maternelle</option>
                      <option value="PRIMARY">Primaire</option>
                      <option value="COLLEGE">Collège</option>
                      <option value="LYCEE">Lycée</option>
                      <option value="UNIVERSITY">Université</option>
                      <option value="TRAINING_CENTER">Centre de formation</option>
                      <option value="GROUPE_SCOLAIRE">Groupe scolaire</option>
                      <option value="OTHER">Autre</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 font-medium block mb-1">Nom du programme</label>
                    <input
                      type="text"
                      value={newCurriculum.name}
                      onChange={(e) => setNewCurriculum((f) => ({ ...f, name: e.target.value }))}
                      placeholder="ex: Programme Primaire CI"
                      className="border rounded-lg px-2 py-1.5 text-sm w-full"
                      required
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={addingCurriculum} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-60">
                    {addingCurriculum ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Créer
                  </button>
                  <button type="button" onClick={() => setShowAddCurriculum(false)} className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50">Annuler</button>
                </div>
              </form>
            </div>
          )}

          <div className="px-4 py-3 border-b">
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="border rounded-lg px-2 py-1.5 text-sm w-full"
            >
              <option value="">Tous les pays</option>
              {countries.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.nameFr}</option>)}
            </select>
          </div>

          <div className="divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
            {filteredCurricula.length === 0 && !loading && (
              <div className="p-8 text-center text-gray-400 text-sm">Aucun programme trouvé</div>
            )}
            {filteredCurricula.map((c) => (
              <div key={c.id} className="p-4">
                <button
                  className="w-full flex items-center justify-between text-left"
                  onClick={() => setExpandedCurriculum(expandedCurriculum === c.id ? null : c.id)}
                >
                  <div>
                    <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 mr-2">{c.countryCode}</span>
                    <span className="text-xs px-1.5 py-0.5 bg-indigo-100 rounded text-indigo-700 mr-2">{CYCLE_LABELS[c.cycle] ?? c.cycle}</span>
                    <span className="font-medium text-gray-800 text-sm">{c.name}</span>
                  </div>
                  {expandedCurriculum === c.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {expandedCurriculum === c.id && (
                  <div className="mt-3 space-y-1">
                    {c.subjects.length === 0 ? (
                      <p className="text-xs text-gray-400">Aucune matière définie</p>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-400">
                            <th className="text-left py-1">Matière</th>
                            <th className="text-center py-1">H/sem</th>
                            <th className="text-center py-1">Coef</th>
                            <th className="text-center py-1">Oblig.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.subjects.sort((a, b) => a.order - b.order).map((s) => (
                            <tr key={s.id} className="border-t border-gray-50">
                              <td className="py-1.5 text-gray-700">{s.name}</td>
                              <td className="text-center text-gray-600">{s.weeklyHours}h</td>
                              <td className="text-center text-gray-600">{s.coefficient}</td>
                              <td className="text-center">{s.isCompulsory ? "✓" : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
