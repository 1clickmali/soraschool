"use client";

import { useEffect, useMemo, useState } from "react";
import type { ElementType } from "react";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  Filter,
  GraduationCap,
  Loader2,
  MapPin,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import {
  downloadProtectedFile as schoolDownloadProtectedFile,
  schoolApi,
  type Assignment,
  type CalendarEvent,
  type CalendarEventType,
  type CalendarFilters,
  type CalendarItemStatus,
  type CalendarPriority,
  type CentralSchool,
  type Classroom,
  type CreateCalendarEventInput,
  type Level,
} from "@/lib/school-api";
import {
  downloadProtectedFile as superDownloadProtectedFile,
  superAdminApi,
  type Institution,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type CalendarWorkspaceMode = "school" | "teacher" | "parent" | "super";
type CalendarView = "month" | "week" | "day" | "list";

type EventTypeMeta = {
  value: CalendarEventType;
  label: string;
  short: string;
  color: string;
  accent: string;
};

const EVENT_TYPES: EventTypeMeta[] = [
  { value: "HOMEWORK", label: "Devoir", short: "Devoir", color: "#3B82F6", accent: "bg-blue-500/15 text-blue-300 border-blue-500/25" },
  { value: "EXAM", label: "Examen", short: "Examen", color: "#EF4444", accent: "bg-red-500/15 text-red-300 border-red-500/25" },
  { value: "CONTROL", label: "Contrôle", short: "Contrôle", color: "#8B5CF6", accent: "bg-violet-500/15 text-violet-300 border-violet-500/25" },
  { value: "PUBLIC_HOLIDAY", label: "Jour férié", short: "Férié", color: "#F59E0B", accent: "bg-amber-500/15 text-amber-300 border-amber-500/25" },
  { value: "LEAVE", label: "Congé", short: "Congé", color: "#06B6D4", accent: "bg-cyan-500/15 text-cyan-300 border-cyan-500/25" },
  { value: "VACATION", label: "Vacances", short: "Vacances", color: "#10B981", accent: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" },
  { value: "SCHOOL_EVENT", label: "Événement scolaire", short: "Événement", color: "#14B8A6", accent: "bg-teal-500/15 text-teal-300 border-teal-500/25" },
  { value: "MEETING", label: "Réunion", short: "Réunion", color: "#EC4899", accent: "bg-pink-500/15 text-pink-300 border-pink-500/25" },
  { value: "FIELD_TRIP", label: "Sortie scolaire", short: "Sortie", color: "#84CC16", accent: "bg-lime-500/15 text-lime-300 border-lime-500/25" },
  { value: "IMPORTANT_DATE", label: "Date importante", short: "Important", color: "#F97316", accent: "bg-orange-500/15 text-orange-300 border-orange-500/25" },
  { value: "CEREMONY", label: "Cérémonie", short: "Cérémonie", color: "#EAB308", accent: "bg-yellow-500/15 text-yellow-300 border-yellow-500/25" },
  { value: "CLASS_COUNCIL", label: "Conseil de classe", short: "Conseil", color: "#6366F1", accent: "bg-indigo-500/15 text-indigo-300 border-indigo-500/25" },
  { value: "REGISTRATION", label: "Inscription", short: "Inscription", color: "#0EA5E9", accent: "bg-sky-500/15 text-sky-300 border-sky-500/25" },
  { value: "PAYMENT", label: "Paiement important", short: "Paiement", color: "#22C55E", accent: "bg-green-500/15 text-green-300 border-green-500/25" },
  { value: "CLOSURE", label: "Fermeture", short: "Fermeture", color: "#64748B", accent: "bg-slate-500/15 text-slate-300 border-slate-500/25" },
];

const TEACHER_EVENT_TYPES = EVENT_TYPES.filter((type) => ["HOMEWORK", "CONTROL", "EXAM"].includes(type.value));
const READONLY_EVENT_TYPES = new Set<CalendarEventType>(["PUBLIC_HOLIDAY", "LEAVE", "VACATION", "CLOSURE"]);

const STATUS_LABELS: Record<CalendarItemStatus, string> = {
  DRAFT: "Brouillon",
  PUBLISHED: "Publié",
  CANCELED: "Annulé",
};

const PRIORITY_LABELS: Record<CalendarPriority, string> = {
  LOW: "Basse",
  NORMAL: "Normale",
  HIGH: "Haute",
  URGENT: "Urgente",
};

const PRIORITY_STYLES: Record<CalendarPriority, string> = {
  LOW: "bg-slate-500/10 text-slate-300 border-slate-500/20",
  NORMAL: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  HIGH: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  URGENT: "bg-red-500/10 text-red-300 border-red-500/20",
};

const VIEW_LABELS: Array<{ value: CalendarView; label: string }> = [
  { value: "month", label: "Mois" },
  { value: "week", label: "Semaine" },
  { value: "day", label: "Jour" },
  { value: "list", label: "Liste" },
];

const fieldClass = "min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-[16px] text-white outline-none transition placeholder:text-gray-600 focus:border-emerald-500/50 sm:text-sm [&>option]:bg-soraDark";

function eventMeta(type: CalendarEventType) {
  return EVENT_TYPES.find((item) => item.value === type) || EVENT_TYPES[0];
}

function toLocalDateInput(date: Date) {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
}

function toLocalTimeInput(date: Date) {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(11, 16);
}

function parseLocalDate(date: string, time: string) {
  return new Date(`${date}T${time || "00:00"}:00`);
}

function isoFromLocal(date: string, time: string) {
  return parseLocalDate(date, time).toISOString();
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfWeek(date: Date) {
  const day = date.getDay() || 7;
  return startOfDay(addDays(date, 1 - day));
}

function endOfWeek(date: Date) {
  return endOfDay(addDays(startOfWeek(date), 6));
}

function startOfMonthGrid(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  return startOfWeek(first);
}

function endOfMonthGrid(date: Date) {
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return endOfWeek(last);
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function overlapsDay(event: CalendarEvent, day: Date) {
  const startsAt = new Date(event.startsAt);
  const endsAt = new Date(event.endsAt);
  return startsAt <= endOfDay(day) && endsAt >= startOfDay(day);
}

function formatDate(value: string | Date, options?: Intl.DateTimeFormatOptions) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("fr-CI", options || { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formatTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("fr-CI", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatDuration(minutes: number) {
  if (!minutes || minutes < 1) return "Toute la journée";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours && rest) return `${hours}h ${rest}min`;
  if (hours) return `${hours}h`;
  return `${rest}min`;
}

function eventTargets(event: CalendarEvent) {
  const classes = event.classrooms?.map((item) => item.name).filter(Boolean) || [];
  const levels = event.gradeLevels?.map((item) => item.name).filter(Boolean) || [];
  if (classes.length) return classes.join(", ");
  if (levels.length) return levels.join(", ");
  if (event.establishment?.name) return event.establishment.name;
  if (event.institution?.name) return event.institution.name;
  return "Toute l'école";
}

function getRange(view: CalendarView, currentDate: Date) {
  if (view === "month") {
    return { start: startOfMonthGrid(currentDate), end: endOfMonthGrid(currentDate) };
  }
  if (view === "week") {
    return { start: startOfWeek(currentDate), end: endOfWeek(currentDate) };
  }
  if (view === "day") {
    return { start: startOfDay(currentDate), end: endOfDay(currentDate) };
  }
  const start = startOfDay(addDays(currentDate, -45));
  const end = endOfDay(addDays(currentDate, 120));
  return { start, end };
}

function buildExportQuery(filters: CalendarFilters, format: "pdf" | "excel" | "csv") {
  const params = new URLSearchParams();
  params.set("format", format);
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, String(value));
  });
  return params.toString();
}

type EventForm = {
  institutionId: string;
  establishmentId: string;
  classroomId: string;
  gradeLevelId: string;
  title: string;
  type: CalendarEventType;
  description: string;
  startsDate: string;
  startsTime: string;
  endsDate: string;
  endsTime: string;
  color: string;
  priority: CalendarPriority;
  status: CalendarItemStatus;
  attachmentUrl: string;
  notifyApp: boolean;
  notifyEmail: boolean;
  notifySms: boolean;
};

function createEmptyForm(mode: CalendarWorkspaceMode, date: Date): EventForm {
  const startsAt = new Date(date);
  startsAt.setHours(8, 0, 0, 0);
  const endsAt = new Date(date);
  endsAt.setHours(9, 0, 0, 0);
  const defaultType: CalendarEventType = mode === "teacher" ? "HOMEWORK" : "SCHOOL_EVENT";
  const meta = eventMeta(defaultType);
  return {
    institutionId: "",
    establishmentId: "",
    classroomId: "",
    gradeLevelId: "",
    title: "",
    type: defaultType,
    description: "",
    startsDate: toLocalDateInput(startsAt),
    startsTime: toLocalTimeInput(startsAt),
    endsDate: toLocalDateInput(endsAt),
    endsTime: toLocalTimeInput(endsAt),
    color: meta.color,
    priority: "NORMAL",
    status: "PUBLISHED",
    attachmentUrl: "",
    notifyApp: true,
    notifyEmail: false,
    notifySms: false,
  };
}

function formFromEvent(event: CalendarEvent): EventForm {
  const startsAt = new Date(event.startsAt);
  const endsAt = new Date(event.endsAt);
  return {
    institutionId: event.institutionId || "",
    establishmentId: event.establishmentId || "",
    classroomId: event.classroomIds?.[0] || "",
    gradeLevelId: event.gradeLevelIds?.[0] || "",
    title: event.title,
    type: event.type,
    description: event.description || "",
    startsDate: toLocalDateInput(startsAt),
    startsTime: toLocalTimeInput(startsAt),
    endsDate: toLocalDateInput(endsAt),
    endsTime: toLocalTimeInput(endsAt),
    color: event.color || eventMeta(event.type).color,
    priority: event.priority || "NORMAL",
    status: event.status || "PUBLISHED",
    attachmentUrl: event.attachmentUrl || "",
    notifyApp: true,
    notifyEmail: false,
    notifySms: false,
  };
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

function EventPill({
  event,
  compact = false,
  onClick,
}: {
  event: CalendarEvent;
  compact?: boolean;
  onClick: (event: CalendarEvent) => void;
}) {
  const meta = eventMeta(event.type);
  return (
    <button
      onClick={() => onClick(event)}
      className={cn(
        "group w-full rounded-xl border border-white/10 bg-white/[0.04] text-left transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07]",
        compact ? "px-2 py-1.5" : "min-h-12 p-3"
      )}
    >
      <div className="flex items-start gap-2">
        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_12px_currentColor]" style={{ backgroundColor: event.color || meta.color, color: event.color || meta.color }} />
        <div className="min-w-0 flex-1">
          <p className={cn("truncate font-semibold leading-snug text-white", compact ? "text-xs" : "text-sm")}>{event.title}</p>
          {!compact && (
            <p className="mt-1 truncate text-xs text-gray-500">
              {formatTime(event.startsAt)} - {formatTime(event.endsAt)} · {eventTargets(event)}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

export function CalendarWorkspace({ mode }: { mode: CalendarWorkspaceMode }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [schools, setSchools] = useState<CentralSchool[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [view, setView] = useState<CalendarView>("month");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [classroomFilter, setClassroomFilter] = useState("");
  const [establishmentFilter, setEstablishmentFilter] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState<EventForm>(() => createEmptyForm(mode, new Date()));

  const isSuper = mode === "super";
  const isTeacher = mode === "teacher";
  const isParent = mode === "parent";
  const canManageEvents = !isParent;
  const availableTypes = isTeacher ? TEACHER_EVENT_TYPES : EVENT_TYPES;
  const api = isSuper ? superAdminApi : schoolApi;
  const downloadFile = isSuper ? superDownloadProtectedFile : schoolDownloadProtectedFile;
  const accent = isSuper ? "from-blue-500/25 via-sky-500/10 to-transparent" : isTeacher ? "from-violet-500/25 via-fuchsia-500/10 to-transparent" : isParent ? "from-amber-500/25 via-emerald-500/10 to-transparent" : "from-emerald-500/25 via-cyan-500/10 to-transparent";

  const filters = useMemo<CalendarFilters>(() => {
    const range = getRange(view, currentDate);
    return {
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      type: typeFilter || undefined,
      classroomId: classroomFilter || undefined,
      establishmentId: establishmentFilter || undefined,
      institutionId: institutionFilter || undefined,
      search: search.trim() || undefined,
    };
  }, [classroomFilter, currentDate, establishmentFilter, institutionFilter, search, typeFilter, view]);

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

  const loadEvents = async () => {
    setLoading(true);
    const { data, error } = await api.calendarEvents(filters);
    if (error) setMessage(error);
    setEvents(data?.events || []);
    setLoading(false);
  };

  useEffect(() => {
    void loadReferences();
  }, [mode]);

  useEffect(() => {
    void loadEvents();
  }, [filters]);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [events]
  );

  const rangeEvents = useMemo(() => {
    const range = getRange(view, currentDate);
    return sortedEvents.filter((event) => new Date(event.startsAt) <= range.end && new Date(event.endsAt) >= range.start);
  }, [currentDate, sortedEvents, view]);

  const stats = useMemo(() => {
    const today = events.filter((event) => overlapsDay(event, new Date())).length;
    const exams = events.filter((event) => event.type === "EXAM" || event.type === "CONTROL").length;
    const holidays = events.filter((event) => READONLY_EVENT_TYPES.has(event.type)).length;
    const urgent = events.filter((event) => event.priority === "URGENT" || event.priority === "HIGH").length;
    return { today, exams, holidays, urgent };
  }, [events]);

  const monthDays = useMemo(() => {
    const range = getRange("month", currentDate);
    const days: Date[] = [];
    let day = range.start;
    while (day <= range.end) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentDate]);

  const currentMonthDays = useMemo(() => {
    const first = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const last = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    return Array.from({ length: last.getDate() }, (_, index) => addDays(first, index));
  }, [currentDate]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [currentDate]);

  const movePeriod = (direction: number) => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (view === "month") next.setMonth(next.getMonth() + direction);
      if (view === "week") next.setDate(next.getDate() + direction * 7);
      if (view === "day") next.setDate(next.getDate() + direction);
      if (view === "list") next.setMonth(next.getMonth() + direction);
      return next;
    });
  };

  const openCreate = (date?: Date) => {
    if (!canManageEvents) return;
    setEditingEvent(null);
    setForm(createEmptyForm(mode, date || currentDate));
    setEventModalOpen(true);
  };

  const openEdit = (event: CalendarEvent) => {
    if (!canManageEvents || event.readonly) return;
    setEditingEvent(event);
    setForm(formFromEvent(event));
    setDetailModalOpen(false);
    setEventModalOpen(true);
  };

  const openDetail = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setDetailModalOpen(true);
  };

  const saveEvent = async () => {
    if (!form.title.trim()) {
      setMessage("Ajoutez un titre à l'événement.");
      return;
    }
    if (isSuper && !form.institutionId) {
      setMessage("Choisissez l'école ou le groupe concerné.");
      return;
    }
    const startsAt = parseLocalDate(form.startsDate, form.startsTime);
    const endsAt = parseLocalDate(form.endsDate, form.endsTime);
    if (endsAt < startsAt) {
      setMessage("La date de fin doit être après la date de début.");
      return;
    }
    setSaving(true);
    setMessage(null);
    const payload: CreateCalendarEventInput = {
      institutionId: form.institutionId || undefined,
      establishmentId: form.establishmentId || undefined,
      classroomIds: form.classroomId ? [form.classroomId] : [],
      gradeLevelIds: form.gradeLevelId ? [form.gradeLevelId] : [],
      title: form.title.trim(),
      type: form.type,
      description: form.description.trim() || undefined,
      startsAt: isoFromLocal(form.startsDate, form.startsTime),
      endsAt: isoFromLocal(form.endsDate, form.endsTime),
      color: form.color,
      priority: form.priority,
      status: form.status,
      attachmentUrl: form.attachmentUrl.trim() || undefined,
      notifyApp: form.notifyApp,
      notifyEmail: form.notifyEmail,
      notifySms: form.notifySms,
    };
    const result = editingEvent
      ? await api.updateCalendarEvent(editingEvent.id, payload)
      : await api.createCalendarEvent(payload);
    setSaving(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setEventModalOpen(false);
    setEditingEvent(null);
    setMessage(editingEvent ? "Événement mis à jour." : "Événement publié dans le calendrier.");
    await loadEvents();
  };

  const deleteEvent = async (event: CalendarEvent) => {
    if (!canManageEvents || event.readonly) return;
    setSaving(true);
    const { error } = await api.deleteCalendarEvent(event.id);
    setSaving(false);
    if (error) {
      setMessage(error);
      return;
    }
    setDetailModalOpen(false);
    setSelectedEvent(null);
    setMessage("Événement supprimé du calendrier.");
    await loadEvents();
  };

  const exportCalendar = async (format: "pdf" | "excel" | "csv") => {
    const query = buildExportQuery(filters, format);
    const ext = format === "excel" ? "xls" : format;
    const error = await downloadFile(`/api/calendar/events/export?${query}`, `calendrier-soraschool.${ext}`);
    if (error) setMessage(error);
  };

  const renderMobileMonthAgenda = () => (
    <div className="space-y-2 sm:hidden">
      {currentMonthDays.map((day) => {
        const dayEvents = rangeEvents.filter((event) => overlapsDay(event, day));
        const today = isSameDay(day, new Date());
        return (
          <div
            key={day.toISOString()}
            className={cn(
              "w-full rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-left transition active:scale-[0.99]",
              today && "border-emerald-500/35 bg-emerald-500/[0.06]"
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn("flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/15", today && "border-emerald-500/40 bg-emerald-500/15")}>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{formatDate(day, { weekday: "short" })}</span>
                <span className="font-heading text-lg font-bold leading-none text-white">{day.getDate()}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-white">{formatDate(day, { day: "2-digit", month: "long" })}</p>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-semibold text-gray-400">
                    {dayEvents.length} élément(s)
                  </span>
                </div>
                <div className="space-y-1.5">
                  {dayEvents.slice(0, 2).map((event) => (
                    <EventPill key={event.id} event={event} compact onClick={openDetail} />
                  ))}
                  {dayEvents.length === 0 && canManageEvents && (
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentDate(day);
                        openCreate(day);
                      }}
                      className="w-full rounded-xl border border-dashed border-emerald-500/25 px-3 py-2 text-left text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/10"
                    >
                      Créer un événement
                    </button>
                  )}
                  {dayEvents.length === 0 && !canManageEvents && (
                    <p className="rounded-xl border border-dashed border-white/10 px-3 py-2 text-xs text-gray-600">
                      Aucun événement
                    </p>
                  )}
                  {dayEvents.length > 2 && <p className="text-xs font-semibold text-emerald-300">+{dayEvents.length - 2} autre(s)</p>}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderMonthView = () => (
    <div className="hidden overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] sm:block">
      <div className="grid grid-cols-7 border-b border-white/10 bg-white/[0.03]">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => (
          <div key={day} className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-7">
        {monthDays.map((day) => {
          const dayEvents = rangeEvents.filter((event) => overlapsDay(event, day));
          const outside = day.getMonth() !== currentDate.getMonth();
          const today = isSameDay(day, new Date());
          return (
            <div
              key={day.toISOString()}
              onDoubleClick={() => openCreate(day)}
              className={cn(
                "min-h-[142px] border-b border-r border-white/10 p-3 text-left transition hover:bg-white/[0.05]",
                outside && "bg-black/10 text-gray-600",
                today && "bg-emerald-500/[0.06]"
              )}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold", today ? "bg-emerald-500 text-white" : "text-gray-300")}>
                  {day.getDate()}
                </span>
                {dayEvents.length > 3 && <span className="text-[11px] text-gray-500">+{dayEvents.length - 3}</span>}
              </div>
              <div className="space-y-1.5">
                {dayEvents.slice(0, 3).map((event) => (
                  <EventPill key={event.id} event={event} compact onClick={openDetail} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderWeekView = () => (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-7 lg:gap-4">
      {weekDays.map((day) => {
        const dayEvents = rangeEvents.filter((event) => overlapsDay(event, day));
        return (
          <div key={day.toISOString()} className={cn("rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:rounded-3xl sm:p-4", isSameDay(day, new Date()) && "border-emerald-500/30 bg-emerald-500/[0.05]")}>
            <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4 lg:block">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{formatDate(day, { weekday: "long" })}</p>
                <p className="font-heading text-2xl font-bold leading-none text-white">{day.getDate()}</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-semibold text-gray-400 lg:hidden">
                {dayEvents.length} élément(s)
              </span>
            </div>
            <div className="space-y-2">
              {dayEvents.map((event) => <EventPill key={event.id} event={event} onClick={openDetail} />)}
              {!dayEvents.length && <p className="rounded-2xl border border-dashed border-white/10 px-3 py-8 text-center text-xs text-gray-600">Aucun événement</p>}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderDayView = () => {
    const dayEvents = rangeEvents.filter((event) => overlapsDay(event, currentDate));
    return (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[220px_1fr] xl:gap-5">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-4 sm:rounded-3xl sm:p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Aujourd'hui</p>
          <p className="mt-3 font-heading text-4xl font-bold leading-none text-white">{formatDate(currentDate, { day: "2-digit" })}</p>
          <p className="text-sm text-gray-400">{formatDate(currentDate, { weekday: "long", month: "long", year: "numeric" })}</p>
          <button onClick={() => openCreate(currentDate)} className={cn("mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400", !canManageEvents && "hidden")}>
            <Plus className="h-4 w-4" />
            Ajouter
          </button>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:rounded-3xl sm:p-4">
          <div className="space-y-3">
            {dayEvents.map((event) => (
              <button key={event.id} onClick={() => openDetail(event)} className="group flex w-full items-stretch overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] text-left transition hover:-translate-y-0.5 hover:bg-white/[0.07]">
                <div className="w-1.5 shrink-0" style={{ backgroundColor: event.color || eventMeta(event.type).color }} />
                <div className="flex w-full flex-col gap-3 p-3 sm:p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", eventMeta(event.type).accent)}>{eventMeta(event.type).label}</span>
                      <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", PRIORITY_STYLES[event.priority])}>{PRIORITY_LABELS[event.priority]}</span>
                    </div>
                    <p className="mt-2 font-heading text-base font-bold leading-snug text-white sm:text-lg">{event.title}</p>
                    <p className="mt-1 text-sm text-gray-400">{event.description || eventTargets(event)}</p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="font-semibold text-white">{formatTime(event.startsAt)} - {formatTime(event.endsAt)}</p>
                    <p className="text-xs text-gray-500">{formatDuration(event.durationMinutes)}</p>
                  </div>
                </div>
              </button>
            ))}
            {!dayEvents.length && (
              <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center sm:rounded-3xl sm:p-12">
                <CalendarDays className="mx-auto mb-4 h-10 w-10 text-gray-600 sm:h-12 sm:w-12" />
                <p className="font-semibold text-white">Rien de planifié ce jour</p>
                <p className="mt-1 text-sm text-gray-500">Double-cliquez sur une date du calendrier ou utilisez le bouton Ajouter.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderListView = () => (
    <div className="space-y-3">
      {rangeEvents.map((event) => (
        <button key={event.id} onClick={() => openDetail(event)} className="group grid min-h-20 w-full grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07] sm:rounded-3xl sm:p-4 lg:grid-cols-[180px_1fr_210px] lg:gap-4">
          <div>
            <p className="font-heading text-base font-bold text-white sm:text-lg">{formatDate(event.startsAt, { day: "2-digit", month: "short" })}</p>
            <p className="text-sm text-gray-500">{formatTime(event.startsAt)} - {formatTime(event.endsAt)}</p>
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", eventMeta(event.type).accent)}>{eventMeta(event.type).label}</span>
              <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", PRIORITY_STYLES[event.priority])}>{PRIORITY_LABELS[event.priority]}</span>
            </div>
            <p className="font-heading text-base font-bold leading-snug text-white sm:text-lg">{event.title}</p>
            <p className="mt-1 line-clamp-2 text-sm text-gray-400">{event.description || "Aucune description renseignée."}</p>
          </div>
          <div className="flex items-center justify-between gap-3 lg:justify-end">
            <p className="text-sm text-gray-500">{eventTargets(event)}</p>
            <Eye className="h-4 w-4 text-gray-500 transition group-hover:text-white" />
          </div>
        </button>
      ))}
      {!rangeEvents.length && (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center sm:rounded-3xl sm:p-12">
          <Search className="mx-auto mb-4 h-10 w-10 text-gray-600 sm:h-12 sm:w-12" />
          <p className="font-semibold text-white">Aucun événement trouvé</p>
          <p className="mt-1 text-sm text-gray-500">Essayez de modifier la période, les filtres ou la recherche.</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:space-y-6">
      <div className={cn("relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-soraCard p-4 shadow-2xl sm:rounded-[2rem] sm:p-6")}>
        <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", accent)} />
        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="mb-3 inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold text-gray-300 sm:mb-4 sm:text-xs">
              <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
              <span className="truncate">Calendrier scolaire intelligent</span>
            </div>
            <h1 className="font-heading text-[clamp(1.85rem,8vw,2.75rem)] font-bold leading-[1.05] tracking-tight text-white">Calendrier</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400 sm:text-[15px]">
              Devoirs, examens, vacances, réunions, conseils de classe, paiements importants et événements officiels synchronisés dans une seule vue.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <button onClick={() => loadEvents()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-gray-200 transition hover:bg-white/[0.08]">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Actualiser
            </button>
            {canManageEvents && (
              <button onClick={() => openCreate()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white shadow-[0_0_24px_rgba(16,185,129,0.25)] transition hover:bg-emerald-400">
                <Plus className="h-4 w-4" />
                Nouvel événement
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <StatCard icon={CalendarDays} label="Événements chargés" value={events.length} tone="bg-blue-500/15 text-blue-300" />
        <StatCard icon={Clock} label="Aujourd'hui" value={stats.today} tone="bg-emerald-500/15 text-emerald-300" />
        <StatCard icon={GraduationCap} label="Examens / contrôles" value={stats.exams} tone="bg-violet-500/15 text-violet-300" />
        <StatCard icon={AlertTriangle} label="Priorités hautes" value={stats.urgent + stats.holidays} tone="bg-amber-500/15 text-amber-300" />
      </div>

      <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-3 sm:rounded-[2rem] sm:p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
          <div className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 sm:col-span-2 xl:col-span-1">
            <Search className="h-4 w-4 text-emerald-300" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un événement, une classe..." className="min-w-0 flex-1 bg-transparent text-[16px] text-white outline-none placeholder:text-gray-600 sm:text-sm" />
          </div>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className={fieldClass}>
            <option value="">Tous les types</option>
            {EVENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
          {!isParent && (
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
          <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
            <Filter className="hidden h-4 w-4 text-gray-500 xl:block" />
            <button onClick={() => exportCalendar("pdf")} className="flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] p-2.5 text-gray-300 transition hover:bg-white/[0.08]" title="Exporter PDF">
              <Download className="h-4 w-4" />
            </button>
            <button onClick={() => exportCalendar("excel")} className="flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] p-2.5 text-gray-300 transition hover:bg-white/[0.08]" title="Exporter Excel">
              <FileSpreadsheet className="h-4 w-4" />
            </button>
            <button onClick={() => window.print()} className="flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] p-2.5 text-gray-300 transition hover:bg-white/[0.08]" title="Imprimer">
              <Printer className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {message && (
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-gray-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          {message}
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-3 sm:rounded-[2rem] sm:p-4 md:flex-row md:items-center md:justify-between">
        <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2 sm:flex">
          <button onClick={() => movePeriod(-1)} className="flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] p-2 text-gray-300 transition hover:bg-white/[0.08]">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => setCurrentDate(new Date())} className="min-h-11 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-gray-200 transition hover:bg-white/[0.08]">
            Aujourd'hui
          </button>
          <button onClick={() => movePeriod(1)} className="flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] p-2 text-gray-300 transition hover:bg-white/[0.08]">
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="col-span-3 mt-1 min-w-0 text-center sm:ml-2 sm:mt-0 sm:text-left">
            <p className="truncate font-heading text-lg font-bold capitalize text-white sm:text-xl">{formatDate(currentDate, { month: "long", year: "numeric" })}</p>
            <p className="text-xs text-gray-500">{rangeEvents.length} élément(s) dans la période</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1 rounded-2xl border border-white/10 bg-black/15 p-1 sm:gap-2">
          {VIEW_LABELS.map((item) => (
            <button key={item.value} onClick={() => setView(item.value)} className={cn("min-h-10 rounded-xl px-2 py-2 text-xs font-semibold transition sm:px-3", view === item.value ? "bg-white text-soraDark" : "text-gray-400 hover:bg-white/[0.06] hover:text-white")}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[360px] items-center justify-center rounded-[2rem] border border-white/10 bg-white/[0.03]">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-300" />
        </div>
      ) : view === "month" ? (
        <>
          {renderMobileMonthAgenda()}
          {renderMonthView()}
        </>
      ) : view === "week" ? (
        renderWeekView()
      ) : view === "day" ? (
        renderDayView()
      ) : (
        renderListView()
      )}

      <Modal isOpen={eventModalOpen} onClose={() => setEventModalOpen(false)} title={editingEvent ? "Modifier l'événement" : "Nouvel événement calendrier"} size="xl">
        <div className="space-y-5">
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
              <input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Ex : Composition de mathématiques, réunion parents, paiement 2e tranche..." className={fieldClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Type</label>
              <select value={form.type} onChange={(event) => {
                const type = event.target.value as CalendarEventType;
                setForm((prev) => ({ ...prev, type, color: eventMeta(type).color }));
              }} className={fieldClass}>
                {availableTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Priorité</label>
              <select value={form.priority} onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value as CalendarPriority }))} className={fieldClass}>
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Début</label>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={form.startsDate} onChange={(event) => setForm((prev) => ({ ...prev, startsDate: event.target.value }))} className={fieldClass} />
                <input type="time" value={form.startsTime} onChange={(event) => setForm((prev) => ({ ...prev, startsTime: event.target.value }))} className={fieldClass} />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Fin</label>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={form.endsDate} onChange={(event) => setForm((prev) => ({ ...prev, endsDate: event.target.value }))} className={fieldClass} />
                <input type="time" value={form.endsTime} onChange={(event) => setForm((prev) => ({ ...prev, endsTime: event.target.value }))} className={fieldClass} />
              </div>
            </div>
            {!isParent && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Classe concernée</label>
                  <select value={form.classroomId} onChange={(event) => setForm((prev) => ({ ...prev, classroomId: event.target.value }))} className={fieldClass}>
                    <option value="">Toutes les classes autorisées</option>
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
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Couleur</label>
              <input type="color" value={form.color} onChange={(event) => setForm((prev) => ({ ...prev, color: event.target.value }))} className="h-12 min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.05] p-1" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Statut</label>
              <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as CalendarItemStatus }))} className={fieldClass}>
                {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Pièce jointe ou lien utile</label>
              <input value={form.attachmentUrl} onChange={(event) => setForm((prev) => ({ ...prev, attachmentUrl: event.target.value }))} placeholder="https://..." className={fieldClass} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Description</label>
              <textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} rows={4} placeholder="Détails, consignes, documents à apporter, classes concernées..." className={fieldClass} />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <Bell className="h-4 w-4 text-emerald-300" />
              Notifications automatiques
            </p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {[
                ["notifyApp", "Application"],
                ["notifyEmail", "Email"],
                ["notifySms", "SMS si disponible"],
              ].map(([key, label]) => (
                <label key={key} className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-gray-300">
                  <input type="checkbox" checked={Boolean(form[key as keyof EventForm])} onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.checked }))} className="accent-emerald-500" />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button onClick={() => setEventModalOpen(false)} className="min-h-11 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-300 transition hover:bg-white/[0.06]">
              Annuler
            </button>
            <button onClick={saveEvent} disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-400 disabled:opacity-60">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingEvent ? "Enregistrer" : "Publier"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)} title="Détail calendrier" size="lg">
        {selectedEvent && (
          <div className="space-y-5">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", eventMeta(selectedEvent.type).accent)}>{eventMeta(selectedEvent.type).label}</span>
                <span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", PRIORITY_STYLES[selectedEvent.priority])}>{PRIORITY_LABELS[selectedEvent.priority]}</span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-gray-300">{STATUS_LABELS[selectedEvent.status]}</span>
              </div>
              <h2 className="font-heading text-xl font-bold leading-tight text-white sm:text-2xl">{selectedEvent.title}</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-400">{selectedEvent.description || "Aucune description renseignée."}</p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-white"><Clock className="h-4 w-4 text-emerald-300" /> Période</p>
                <p className="text-sm text-gray-300">{formatDate(selectedEvent.startsAt)} · {formatTime(selectedEvent.startsAt)}</p>
                <p className="text-sm text-gray-500">jusqu'au {formatDate(selectedEvent.endsAt)} · {formatTime(selectedEvent.endsAt)}</p>
                <p className="mt-2 text-xs text-gray-500">Durée : {formatDuration(selectedEvent.durationMinutes)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-white"><Users className="h-4 w-4 text-emerald-300" /> Public concerné</p>
                <p className="text-sm text-gray-300">{eventTargets(selectedEvent)}</p>
                <p className="mt-2 flex items-center gap-1 text-xs text-gray-500"><MapPin className="h-3 w-3" /> {selectedEvent.establishment?.name || selectedEvent.institution?.name || "Établissement courant"}</p>
              </div>
            </div>

            {selectedEvent.attachmentUrl && (
              <a href={selectedEvent.attachmentUrl} target="_blank" rel="noreferrer" className="block rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm font-semibold text-emerald-300 transition hover:bg-white/[0.06]">
                Ouvrir la pièce jointe
              </a>
            )}

            {canManageEvents && !selectedEvent.readonly && (
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button onClick={() => openEdit(selectedEvent)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-200 transition hover:bg-white/[0.06]">
                  <Edit3 className="h-4 w-4" />
                  Modifier
                </button>
                <button onClick={() => deleteEvent(selectedEvent)} disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/15 disabled:opacity-60">
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
