"use client";

import { useEffect, useMemo, useState } from "react";
import type { ElementType } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  CalendarOff,
  CheckCircle2,
  Clock,
  Edit3,
  Filter,
  Loader2,
  MapPin,
  Palmtree,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import {
  schoolApi,
  type Assignment,
  type CalendarFilters,
  type CalendarItemStatus,
  type CentralSchool,
  type Classroom,
  type CreateHolidayLeaveInput,
  type HolidayLeave,
  type HolidayLeaveType,
  type Level,
} from "@/lib/school-api";
import { superAdminApi, type Institution } from "@/lib/api";
import { cn } from "@/lib/utils";

type HolidaysWorkspaceMode = "school" | "teacher" | "parent" | "super";

type HolidayTypeMeta = {
  value: HolidayLeaveType;
  label: string;
  color: string;
  accent: string;
};

const HOLIDAY_TYPES: HolidayTypeMeta[] = [
  { value: "VACATION", label: "Vacances scolaires", color: "#10B981", accent: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" },
  { value: "LEAVE", label: "Congé", color: "#06B6D4", accent: "bg-cyan-500/15 text-cyan-300 border-cyan-500/25" },
  { value: "PUBLIC_HOLIDAY", label: "Jour férié", color: "#F59E0B", accent: "bg-amber-500/15 text-amber-300 border-amber-500/25" },
  { value: "CLOSURE", label: "Fermeture établissement", color: "#64748B", accent: "bg-slate-500/15 text-slate-300 border-slate-500/25" },
  { value: "ADMINISTRATIVE_LEAVE", label: "Congé administratif", color: "#8B5CF6", accent: "bg-violet-500/15 text-violet-300 border-violet-500/25" },
  { value: "TEACHER_LEAVE", label: "Congé enseignant", color: "#EC4899", accent: "bg-pink-500/15 text-pink-300 border-pink-500/25" },
  { value: "NO_CLASS_PERIOD", label: "Période sans cours", color: "#F97316", accent: "bg-orange-500/15 text-orange-300 border-orange-500/25" },
];

const STATUS_LABELS: Record<CalendarItemStatus, string> = {
  DRAFT: "Brouillon",
  PUBLISHED: "Publié",
  CANCELED: "Annulé",
};

const STATUS_STYLES: Record<CalendarItemStatus, string> = {
  DRAFT: "bg-slate-500/10 text-slate-300 border-slate-500/20",
  PUBLISHED: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  CANCELED: "bg-red-500/10 text-red-300 border-red-500/20",
};

const fieldClass = "min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-[16px] text-white outline-none transition placeholder:text-gray-600 focus:border-emerald-500/50 sm:text-sm [&>option]:bg-soraDark";

type HolidayForm = {
  institutionId: string;
  establishmentId: string;
  classroomId: string;
  gradeLevelId: string;
  title: string;
  type: HolidayLeaveType;
  description: string;
  startsDate: string;
  endsDate: string;
  status: CalendarItemStatus;
  color: string;
};

function holidayMeta(type: HolidayLeaveType) {
  return HOLIDAY_TYPES.find((item) => item.value === type) || HOLIDAY_TYPES[0];
}

function toLocalDateInput(date: Date) {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
}

function isoFromDate(date: string, end = false) {
  return new Date(`${date}T${end ? "23:59:00" : "00:00:00"}`).toISOString();
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatDate(value?: string | Date | null, options?: Intl.DateTimeFormatOptions) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("fr-CI", options || { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function daysBetween(start: string, end: string) {
  const startsAt = new Date(`${start}T00:00:00`);
  const endsAt = new Date(`${end}T00:00:00`);
  return Math.max(1, Math.floor((endsAt.getTime() - startsAt.getTime()) / 86_400_000) + 1);
}

function createEmptyForm(): HolidayForm {
  const today = new Date();
  const end = addDays(today, 6);
  return {
    institutionId: "",
    establishmentId: "",
    classroomId: "",
    gradeLevelId: "",
    title: "",
    type: "VACATION",
    description: "",
    startsDate: toLocalDateInput(today),
    endsDate: toLocalDateInput(end),
    status: "PUBLISHED",
    color: holidayMeta("VACATION").color,
  };
}

function formFromHoliday(holiday: HolidayLeave): HolidayForm {
  return {
    institutionId: holiday.institutionId || "",
    establishmentId: holiday.establishmentId || "",
    classroomId: holiday.classroomIds?.[0] || "",
    gradeLevelId: holiday.gradeLevelIds?.[0] || "",
    title: holiday.title,
    type: holiday.type,
    description: holiday.description || "",
    startsDate: toLocalDateInput(new Date(holiday.startsAt)),
    endsDate: toLocalDateInput(new Date(holiday.endsAt)),
    status: holiday.status,
    color: holiday.color || holidayMeta(holiday.type).color,
  };
}

function holidayTargets(holiday: HolidayLeave) {
  const classes = holiday.classrooms?.map((item) => item.name).filter(Boolean) || [];
  const levels = holiday.gradeLevels?.map((item) => item.name).filter(Boolean) || [];
  if (classes.length) return classes.join(", ");
  if (levels.length) return levels.join(", ");
  if (holiday.establishment?.name) return holiday.establishment.name;
  if (holiday.institution?.name) return holiday.institution.name;
  return "Toute l'école";
}

function StatCard({ icon: Icon, label, value, tone }: { icon: ElementType; label: string; value: string | number; tone: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 sm:p-4">
      <div className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-xl sm:h-10 sm:w-10", tone)}>
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
      </div>
      <p className="font-heading text-xl font-bold leading-none text-white sm:text-2xl">{value}</p>
      <p className="mt-1 text-xs leading-snug text-gray-400 sm:text-sm">{label}</p>
    </div>
  );
}

export function HolidaysWorkspace({ mode }: { mode: HolidaysWorkspaceMode }) {
  const [holidays, setHolidays] = useState<HolidayLeave[]>([]);
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [schools, setSchools] = useState<CentralSchool[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [classroomFilter, setClassroomFilter] = useState("");
  const [establishmentFilter, setEstablishmentFilter] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<HolidayLeave | null>(null);
  const [selectedHoliday, setSelectedHoliday] = useState<HolidayLeave | null>(null);
  const [form, setForm] = useState<HolidayForm>(() => createEmptyForm());

  const isSuper = mode === "super";
  const isParent = mode === "parent";
  const isTeacher = mode === "teacher";
  const canManage = mode === "school" || mode === "super";
  const api = isSuper ? superAdminApi : schoolApi;
  const accent = isSuper ? "from-blue-500/25 via-sky-500/10 to-transparent" : isTeacher ? "from-violet-500/25 via-fuchsia-500/10 to-transparent" : isParent ? "from-amber-500/25 via-emerald-500/10 to-transparent" : "from-emerald-500/25 via-cyan-500/10 to-transparent";

  const filters = useMemo<CalendarFilters>(() => ({
    type: typeFilter || undefined,
    status: statusFilter || undefined,
    classroomId: classroomFilter || undefined,
    establishmentId: establishmentFilter || undefined,
    institutionId: institutionFilter || undefined,
    search: search.trim() || undefined,
  }), [classroomFilter, establishmentFilter, institutionFilter, search, statusFilter, typeFilter]);

  const loadReferences = async () => {
    if (mode === "parent") return;
    if (mode === "super") {
      const institutionsRes = await superAdminApi.institutions();
      setInstitutions(institutionsRes.data?.institutions || []);
      return;
    }
    if (mode === "teacher") {
      const [assignmentRes, levelRes] = await Promise.all([schoolApi.assignments(), schoolApi.levels()]);
      const classMap = new Map<string, Classroom>();
      (assignmentRes.data?.assignments || []).forEach((assignment: Assignment) => {
        if (assignment.classroom) classMap.set(assignment.classroom.id, assignment.classroom);
      });
      setClasses(Array.from(classMap.values()).sort((a, b) => a.name.localeCompare(b.name, "fr")));
      setLevels(levelRes.data?.levels || []);
      return;
    }
    const [classRes, levelRes, schoolsRes] = await Promise.all([
      schoolApi.classes(),
      schoolApi.levels(),
      schoolApi.centralSchools(),
    ]);
    setClasses(classRes.data?.classes || []);
    setLevels(levelRes.data?.levels || []);
    setSchools(schoolsRes.data?.schools || []);
  };

  const loadHolidays = async () => {
    setLoading(true);
    const { data, error } = await api.holidayLeaves(filters);
    if (error) setMessage(error);
    setHolidays(data?.holidays || []);
    setLoading(false);
  };

  useEffect(() => {
    void loadReferences();
  }, [mode]);

  useEffect(() => {
    void loadHolidays();
  }, [filters]);

  const sortedHolidays = useMemo(
    () => [...holidays].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [holidays]
  );

  const stats = useMemo(() => {
    const published = holidays.filter((holiday) => holiday.status === "PUBLISHED").length;
    const draft = holidays.filter((holiday) => holiday.status === "DRAFT").length;
    const totalDays = holidays.reduce((sum, holiday) => sum + (holiday.durationDays || 0), 0);
    const next = sortedHolidays.find((holiday) => new Date(holiday.endsAt) >= new Date());
    return { published, draft, totalDays, next };
  }, [holidays, sortedHolidays]);

  const openCreate = () => {
    if (!canManage) return;
    setEditingHoliday(null);
    setForm(createEmptyForm());
    setFormOpen(true);
  };

  const openEdit = (holiday: HolidayLeave) => {
    if (!canManage) return;
    setEditingHoliday(holiday);
    setForm(formFromHoliday(holiday));
    setDetailOpen(false);
    setFormOpen(true);
  };

  const openDetail = (holiday: HolidayLeave) => {
    setSelectedHoliday(holiday);
    setDetailOpen(true);
  };

  const saveHoliday = async () => {
    if (!form.title.trim()) {
      setMessage("Ajoutez un titre.");
      return;
    }
    if (isSuper && !form.institutionId) {
      setMessage("Choisissez l'école ou le groupe concerné.");
      return;
    }
    if (new Date(form.endsDate) < new Date(form.startsDate)) {
      setMessage("La date de fin doit être après la date de début.");
      return;
    }
    setSaving(true);
    setMessage(null);
    const payload: CreateHolidayLeaveInput = {
      institutionId: form.institutionId || undefined,
      establishmentId: form.establishmentId || undefined,
      title: form.title.trim(),
      type: form.type,
      description: form.description.trim() || undefined,
      startsAt: isoFromDate(form.startsDate),
      endsAt: isoFromDate(form.endsDate, true),
      classroomIds: form.classroomId ? [form.classroomId] : [],
      gradeLevelIds: form.gradeLevelId ? [form.gradeLevelId] : [],
      status: form.status,
      color: form.color,
    };
    const result = editingHoliday
      ? await api.updateHolidayLeave(editingHoliday.id, payload)
      : await api.createHolidayLeave(payload);
    setSaving(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setFormOpen(false);
    setEditingHoliday(null);
    setMessage(editingHoliday ? "Vacance / congé mis à jour et resynchronisé dans le calendrier." : "Vacance / congé créé et automatiquement ajouté au calendrier.");
    await loadHolidays();
  };

  const cancelHoliday = async (holiday: HolidayLeave) => {
    if (!canManage) return;
    setSaving(true);
    const { error } = await api.updateHolidayLeave(holiday.id, { status: "CANCELED" });
    setSaving(false);
    if (error) {
      setMessage(error);
      return;
    }
    setDetailOpen(false);
    setMessage("Période annulée et visible comme annulée dans le calendrier.");
    await loadHolidays();
  };

  const deleteHoliday = async (holiday: HolidayLeave) => {
    if (!canManage) return;
    setSaving(true);
    const { error } = await api.deleteHolidayLeave(holiday.id);
    setSaving(false);
    if (error) {
      setMessage(error);
      return;
    }
    setDetailOpen(false);
    setMessage("Période supprimée du module et du calendrier.");
    await loadHolidays();
  };

  return (
    <div className="space-y-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:space-y-6">
      <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-soraCard p-4 shadow-2xl sm:rounded-[2rem] sm:p-6">
        <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", accent)} />
        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="mb-3 inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold text-gray-300 sm:mb-4 sm:text-xs">
              <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
              <span className="truncate">Synchronisé automatiquement avec le calendrier</span>
            </div>
            <h1 className="font-heading text-[clamp(1.75rem,7vw,2.75rem)] font-bold leading-[1.05] tracking-tight text-white">Vacances / Congés</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400 sm:text-[15px]">
              Vacances scolaires, congés administratifs, jours fériés, fermetures et périodes sans cours. Chaque période publiée apparaît automatiquement dans le Calendrier.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <button onClick={() => loadHolidays()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-gray-200 transition hover:bg-white/[0.08]">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Actualiser
            </button>
            <button onClick={() => window.print()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-gray-200 transition hover:bg-white/[0.08]">
              <Printer className="h-4 w-4" />
              Imprimer
            </button>
            {canManage && (
              <button onClick={openCreate} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white shadow-[0_0_24px_rgba(16,185,129,0.25)] transition hover:bg-emerald-400">
                <Plus className="h-4 w-4" />
                Nouvelle période
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <StatCard icon={ShieldCheck} label="Périodes publiées" value={stats.published} tone="bg-emerald-500/15 text-emerald-300" />
        <StatCard icon={AlertCircle} label="Brouillons" value={stats.draft} tone="bg-amber-500/15 text-amber-300" />
        <StatCard icon={Clock} label="Jours planifiés" value={stats.totalDays} tone="bg-blue-500/15 text-blue-300" />
        <StatCard icon={Palmtree} label="Prochaine période" value={stats.next ? formatDate(stats.next.startsAt, { day: "2-digit", month: "short" }) : "-"} tone="bg-violet-500/15 text-violet-300" />
      </div>

      <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-3 sm:rounded-[2rem] sm:p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
          <div className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 sm:col-span-2 xl:col-span-1">
            <Search className="h-4 w-4 text-emerald-300" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher une période, un campus..." className="min-w-0 flex-1 bg-transparent text-[16px] text-white outline-none placeholder:text-gray-600 sm:text-sm" />
          </div>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className={fieldClass}>
            <option value="">Tous les types</option>
            {HOLIDAY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={fieldClass}>
            <option value="">Tous les statuts</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          {!isParent && !isSuper && (
            <select value={classroomFilter} onChange={(event) => setClassroomFilter(event.target.value)} className={fieldClass}>
              <option value="">Toutes les classes</option>
              {classes.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.name}</option>)}
            </select>
          )}
          {mode === "school" && schools.length > 0 && (
            <select value={establishmentFilter} onChange={(event) => setEstablishmentFilter(event.target.value)} className={fieldClass}>
              <option value="">Tous les campus</option>
              {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
            </select>
          )}
          {isSuper && (
            <select value={institutionFilter} onChange={(event) => setInstitutionFilter(event.target.value)} className={fieldClass}>
              <option value="">Toutes les écoles / groupes</option>
              {institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name}</option>)}
            </select>
          )}
          <div className="flex min-h-11 items-center gap-2 text-xs text-gray-500">
            <Filter className="h-4 w-4" />
            {sortedHolidays.length} résultat(s)
          </div>
        </div>
      </div>

      {message && (
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-gray-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-[1.5rem] border border-white/10 bg-white/[0.03] sm:min-h-[360px] sm:rounded-[2rem]">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-300" />
        </div>
      ) : sortedHolidays.length ? (
        <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-2">
          {sortedHolidays.map((holiday, index) => {
            const meta = holidayMeta(holiday.type);
            return (
              <motion.button
                key={holiday.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.25) }}
                onClick={() => openDetail(holiday)}
                className="group min-h-24 overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.04] text-left transition active:scale-[0.99] hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07] sm:rounded-[1.75rem]"
              >
                <div className="h-1.5" style={{ backgroundColor: holiday.color || meta.color }} />
                <div className="p-4 sm:p-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
                    <span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", meta.accent)}>{meta.label}</span>
                    <span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", STATUS_STYLES[holiday.status])}>{STATUS_LABELS[holiday.status]}</span>
                  </div>
                  <h2 className="font-heading text-lg font-bold leading-tight text-white sm:text-xl">{holiday.title}</h2>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-400">{holiday.description || "Aucune description renseignée."}</p>
                  <div className="mt-4 grid grid-cols-1 gap-2 sm:mt-5 sm:grid-cols-3 sm:gap-3">
                    <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
                      <p className="text-xs text-gray-500">Début</p>
                      <p className="mt-1 font-semibold text-white">{formatDate(holiday.startsAt)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
                      <p className="text-xs text-gray-500">Fin</p>
                      <p className="mt-1 font-semibold text-white">{formatDate(holiday.endsAt)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
                      <p className="text-xs text-gray-500">Durée</p>
                      <p className="mt-1 font-semibold text-white">{holiday.durationDays} jour(s)</p>
                    </div>
                  </div>
                  <p className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                    <MapPin className="h-4 w-4" />
                    {holidayTargets(holiday)}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[1.5rem] border border-dashed border-white/10 p-8 text-center sm:rounded-[2rem] sm:p-12">
          <CalendarOff className="mx-auto mb-4 h-10 w-10 text-gray-600 sm:h-12 sm:w-12" />
          <p className="font-semibold text-white">Aucune vacance ou congé trouvé</p>
          <p className="mt-1 text-sm text-gray-500">Créez une période officielle pour l'afficher automatiquement dans le calendrier.</p>
        </div>
      )}

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={editingHoliday ? "Modifier vacances / congé" : "Nouvelle période"} size="xl">
        <div className="space-y-5">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-100">
            Cette période sera synchronisée avec le module Calendrier. Les parents, élèves et professeurs concernés la verront selon leurs permissions.
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {isSuper && (
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">École / groupe</label>
                <select value={form.institutionId} onChange={(event) => setForm((prev) => ({ ...prev, institutionId: event.target.value }))} className={fieldClass}>
                  <option value="">Choisir une école ou une administration centrale</option>
                  {institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name}</option>)}
                </select>
              </div>
            )}
            {mode === "school" && schools.length > 0 && (
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Établissement / campus</label>
                <select value={form.establishmentId} onChange={(event) => setForm((prev) => ({ ...prev, establishmentId: event.target.value }))} className={fieldClass}>
                  <option value="">Tous les campus du groupe</option>
                  {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
                </select>
              </div>
            )}
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Titre</label>
              <input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Ex : Vacances de Noël, jour férié, fermeture administrative..." className={fieldClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Type</label>
              <select value={form.type} onChange={(event) => {
                const type = event.target.value as HolidayLeaveType;
                setForm((prev) => ({ ...prev, type, color: holidayMeta(type).color }));
              }} className={fieldClass}>
                {HOLIDAY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Statut</label>
              <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as CalendarItemStatus }))} className={fieldClass}>
                {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Date début</label>
              <input type="date" value={form.startsDate} onChange={(event) => setForm((prev) => ({ ...prev, startsDate: event.target.value }))} className={fieldClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Date fin</label>
              <input type="date" value={form.endsDate} onChange={(event) => setForm((prev) => ({ ...prev, endsDate: event.target.value }))} className={fieldClass} />
            </div>
            {!isSuper && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Classe concernée</label>
                  <select value={form.classroomId} onChange={(event) => setForm((prev) => ({ ...prev, classroomId: event.target.value }))} className={fieldClass}>
                    <option value="">Toutes les classes</option>
                    {classes.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Niveau concerné</label>
                  <select value={form.gradeLevelId} onChange={(event) => setForm((prev) => ({ ...prev, gradeLevelId: event.target.value }))} className={fieldClass}>
                    <option value="">Tous les niveaux</option>
                    {levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}
                  </select>
                </div>
              </>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Couleur calendrier</label>
              <input type="color" value={form.color} onChange={(event) => setForm((prev) => ({ ...prev, color: event.target.value }))} className="h-12 min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.05] p-1" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Durée automatique</label>
              <div className="min-h-11 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-3 text-sm font-semibold text-white">
                {daysBetween(form.startsDate, form.endsDate)} jour(s)
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Description</label>
              <textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} rows={4} placeholder="Détails de la période, consignes, services fermés, conditions..." className={fieldClass} />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button onClick={() => setFormOpen(false)} className="min-h-11 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-300 transition hover:bg-white/[0.06]">
              Annuler
            </button>
            <button onClick={saveHoliday} disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-400 disabled:opacity-60">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingHoliday ? "Enregistrer" : "Créer et synchroniser"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={detailOpen} onClose={() => setDetailOpen(false)} title="Détail vacances / congé" size="lg">
        {selectedHoliday && (
          <div className="space-y-5">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", holidayMeta(selectedHoliday.type).accent)}>{holidayMeta(selectedHoliday.type).label}</span>
                <span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", STATUS_STYLES[selectedHoliday.status])}>{STATUS_LABELS[selectedHoliday.status]}</span>
              </div>
              <h2 className="font-heading text-xl font-bold leading-tight text-white sm:text-2xl">{selectedHoliday.title}</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-400">{selectedHoliday.description || "Aucune description renseignée."}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <p className="text-xs text-gray-500">Date début</p>
                <p className="mt-1 font-semibold text-white">{formatDate(selectedHoliday.startsAt)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <p className="text-xs text-gray-500">Date fin</p>
                <p className="mt-1 font-semibold text-white">{formatDate(selectedHoliday.endsAt)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <p className="text-xs text-gray-500">Durée</p>
                <p className="mt-1 font-semibold text-white">{selectedHoliday.durationDays} jour(s)</p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-white"><Users className="h-4 w-4 text-emerald-300" /> Public et établissement</p>
              <p className="text-sm text-gray-300">{holidayTargets(selectedHoliday)}</p>
              <p className="mt-2 flex items-center gap-1 text-xs text-gray-500"><MapPin className="h-3 w-3" /> Visible dans le Calendrier avec la même couleur et le même statut.</p>
            </div>
            {canManage && (
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button onClick={() => openEdit(selectedHoliday)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-200 transition hover:bg-white/[0.06]">
                  <Edit3 className="h-4 w-4" />
                  Modifier
                </button>
                <button onClick={() => cancelHoliday(selectedHoliday)} disabled={saving || selectedHoliday.status === "CANCELED"} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/15 disabled:opacity-50">
                  <CalendarOff className="h-4 w-4" />
                  Annuler
                </button>
                <button onClick={() => deleteHoliday(selectedHoliday)} disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/15 disabled:opacity-60">
                  <Trash2 className="h-4 w-4" />
                  Supprimer
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
