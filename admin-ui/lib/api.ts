import { getAccessToken, getRefreshToken, setTokens, removeTokens } from "./auth";
import { getApiBaseUrl } from "./api-url";
import type {
  CalendarEvent,
  CalendarFilters,
  CreateCalendarEventInput,
  CreateHolidayLeaveInput,
  HolidayLeave,
} from "./school-api";

const apiUrl = (endpoint: string) => `${getApiBaseUrl()}${endpoint}`;

type RequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type InstitutionStatusApi = "TRIAL" | "ACTIVE" | "SUSPENDED" | "EXPIRED" | "DELETED";

interface ApiOptions {
  method?: RequestMethod;
  body?: unknown;
  headers?: Record<string, string>;
  skipAuth?: boolean;
}

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

interface BackendUser {
  id: string;
  phone: string;
  role: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  institutionId?: string | null;
  establishmentId?: string | null;
  avatarUrl?: string | null;
  preferredLanguage?: string;
}

interface BackendInstitution {
  id: string;
  name: string;
  slug: string;
  kind?: string;
  structure?: "SINGLE_SCHOOL" | "CENTRAL_ADMINISTRATION";
  status: InstitutionStatusApi;
  logoUrl?: string | null;
  country?: string;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  whatsapp?: string | null;
  directorName?: string | null;
  directorPhone?: string | null;
  directorEmail?: string | null;
  centralAdminName?: string | null;
  centralAdminPhone?: string | null;
  centralAdminEmail?: string | null;
  motto?: string | null;
  languages?: string[];
  levels?: string[];
  activeAcademicYearName?: string | null;
  currency?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  createdAt: string;
  subscriptions?: Array<{
    endsAt?: string;
    plan?: BackendPlan;
  }>;
}

interface BackendPlan {
  id: string;
  name: string;
  code?: string;
  tier: Plan["tier"];
  monthlyPrice: number;
  annualPrice: number;
  maxStudents: number | null;
  maxTeachers: number | null;
  maxEstablishments?: number;
  canCreateBranches?: boolean;
  features?: unknown;
  createdAt: string;
}

const STATUS_TO_FRONT: Record<InstitutionStatusApi, Institution["status"]> = {
  TRIAL: "trial",
  ACTIVE: "active",
  SUSPENDED: "suspended",
  EXPIRED: "expired",
  DELETED: "deleted",
};

const STATUS_TO_API: Record<string, InstitutionStatusApi> = {
  trial: "TRIAL",
  active: "ACTIVE",
  suspended: "SUSPENDED",
  expired: "EXPIRED",
  deleted: "DELETED",
  TRIAL: "TRIAL",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  EXPIRED: "EXPIRED",
  DELETED: "DELETED",
};

const KIND_LABELS: Record<string, string> = {
  PRIMARY: "Primaire",
  COLLEGE: "Collège",
  LYCEE: "Lycée",
  UNIVERSITY: "Université",
  TRAINING_CENTER: "Centre de formation",
  RELIGIOUS: "Institut religieux",
  BILINGUAL: "Bilingue",
  OTHER: "Autre",
};

function normalizeUser(user: BackendUser): UserProfile {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return {
    ...user,
    institutionId: user.institutionId ?? undefined,
    establishmentId: user.establishmentId ?? undefined,
    avatarUrl: user.avatarUrl ?? undefined,
    name: name || user.phone,
  };
}

function normalizeFeatures(features: unknown): string[] {
  if (Array.isArray(features)) return features.map(String);
  if (typeof features === "string") return [features];
  if (features && typeof features === "object") {
    return Object.entries(features as Record<string, unknown>)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([feature]) => feature);
  }
  return [];
}

function normalizePlan(plan: BackendPlan): Plan {
  return {
    ...plan,
    maxStudents: plan.maxStudents ?? Number.POSITIVE_INFINITY,
    maxTeachers: plan.maxTeachers ?? Number.POSITIVE_INFINITY,
    features: normalizeFeatures(plan.features),
  };
}

function normalizeInstitution(institution: BackendInstitution): Institution {
  const subscription = institution.subscriptions?.[0];
  return {
    id: institution.id,
    name: institution.name,
    slug: institution.slug,
    kind: institution.kind,
    structure: institution.structure,
    type: KIND_LABELS[institution.kind || ""] || institution.kind || "Autre",
    status: STATUS_TO_FRONT[institution.status] || "trial",
    plan: subscription?.plan ? normalizePlan(subscription.plan) : undefined,
    expiresAt: subscription?.endsAt,
    createdAt: institution.createdAt,
    logo: institution.logoUrl ?? undefined,
    country: institution.country,
    city: institution.city ?? undefined,
    district: institution.district ?? undefined,
    address: institution.address ?? undefined,
    phone: institution.phone ?? undefined,
    email: institution.email ?? undefined,
    website: institution.website ?? undefined,
    whatsapp: institution.whatsapp ?? undefined,
    directorName: institution.directorName ?? undefined,
    directorPhone: institution.directorPhone ?? undefined,
    directorEmail: institution.directorEmail ?? undefined,
    centralAdminName: institution.centralAdminName ?? undefined,
    centralAdminPhone: institution.centralAdminPhone ?? undefined,
    centralAdminEmail: institution.centralAdminEmail ?? undefined,
    motto: institution.motto ?? undefined,
    languages: institution.languages ?? [],
    levels: institution.levels ?? [],
    activeAcademicYearName: institution.activeAcademicYearName ?? undefined,
    currency: institution.currency,
    primaryColor: institution.primaryColor,
    secondaryColor: institution.secondaryColor,
    accentColor: institution.accentColor,
  };
}

async function refreshTokens(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(apiUrl("/api/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    if (data.accessToken) {
      setTokens(data.accessToken, data.refreshToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> {
  const { method = "GET", body, headers = {}, skipAuth = false } = options;

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) requestHeaders.Authorization = `Bearer ${token}`;
  }

  const config: RequestInit = {
    method,
    headers: requestHeaders,
  };

  if (body !== undefined) config.body = JSON.stringify(body);

  try {
    let res = await fetch(apiUrl(endpoint), config);

    if (res.status === 401 && !skipAuth) {
      const refreshed = await refreshTokens();
      if (refreshed) {
        const newToken = getAccessToken();
        if (newToken) requestHeaders.Authorization = `Bearer ${newToken}`;
        res = await fetch(apiUrl(endpoint), { ...config, headers: requestHeaders });
      } else {
        removeTokens();
        if (typeof window !== "undefined") window.location.href = "/login";
        return { data: null, error: "Session expirée", status: 401 };
      }
    }

    if (!res.ok) {
      let errorMsg = `Erreur ${res.status}`;
      try {
        const errData = await res.json();
        const e = errData.error;
        errorMsg = (e && typeof e === "object" ? e.message : e) || errData.message || errorMsg;
      } catch {
        // The response body is optional for errors.
      }
      return { data: null, error: errorMsg, status: res.status };
    }

    const text = await res.text();
    if (!text) return { data: null, error: null, status: res.status };

    return { data: JSON.parse(text) as T, error: null, status: res.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur réseau";
    return { data: null, error: message, status: 0 };
  }
}

export const api = {
  get: <T>(endpoint: string, options?: Omit<ApiOptions, "method" | "body">) =>
    apiRequest<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(endpoint: string, body?: unknown, options?: Omit<ApiOptions, "method" | "body">) =>
    apiRequest<T>(endpoint, { ...options, method: "POST", body }),

  patch: <T>(endpoint: string, body?: unknown, options?: Omit<ApiOptions, "method" | "body">) =>
    apiRequest<T>(endpoint, { ...options, method: "PATCH", body }),

  delete: <T>(endpoint: string, options?: Omit<ApiOptions, "method" | "body">) =>
    apiRequest<T>(endpoint, { ...options, method: "DELETE" }),
};

export async function downloadProtectedFile(endpoint: string, filename: string): Promise<string | null> {
  const token = getAccessToken();
  const res = await fetch(apiUrl(endpoint), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: "no-store",
  });
  if (!res.ok) return `Erreur ${res.status}`;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return null;
}

export async function uploadProtectedFile<T>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
  const token = getAccessToken();
  try {
    const res = await fetch(apiUrl(endpoint), {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    });

    if (!res.ok) {
      let errorMsg = `Erreur ${res.status}`;
      try {
        const errData = await res.json();
        const e = errData.error;
        errorMsg = (e && typeof e === "object" ? e.message : e) || errData.message || errorMsg;
      } catch {
        // Ignore non-JSON upload errors.
      }
      return { data: null, error: errorMsg, status: res.status };
    }

    const text = await res.text();
    return { data: text ? JSON.parse(text) as T : null, error: null, status: res.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur réseau";
    return { data: null, error: message, status: 0 };
  }
}

export interface PlatformBranding {
  appName: string;
  slogan?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  supportEmail: string;
  supportPhone: string;
  supportAddress?: string | null;
  website?: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

export const platformApi = {
  branding: () => api.get<{ branding: PlatformBranding }>("/api/platform/branding", { skipAuth: true }),
};

export const authApi = {
  requestOtp: (phone: string) =>
    api.post<{ message: string; mock?: boolean; debugCode?: string }>("/api/auth/request-otp", { phone }, { skipAuth: true }),

  verifyOtp: (phone: string, code: string) =>
    api.post<{ accessToken: string; refreshToken: string; user: UserProfile }>(
      "/api/auth/verify-otp",
      { phone, code },
      { skipAuth: true }
    ),

  me: async () => {
    const response = await api.get<{ user: BackendUser }>("/api/auth/me");
    return {
      ...response,
      data: response.data?.user ? normalizeUser(response.data.user) : null,
    };
  },

  refresh: () =>
    api.post<{ accessToken: string; refreshToken: string }>("/api/auth/refresh"),
};

export const superAdminApi = {
  dashboard: async () => {
    const response = await api.get<Omit<DashboardData, "recentInstitutions"> & { recentInstitutions?: BackendInstitution[] }>("/api/super-admin/dashboard");
    return {
      ...response,
      data: response.data
        ? {
            ...response.data,
            recentInstitutions: response.data.recentInstitutions?.map(normalizeInstitution) || [],
          }
        : null,
    };
  },
  plans: async () => {
    const response = await api.get<{ plans: BackendPlan[] }>("/api/super-admin/plans");
    return {
      ...response,
      data: response.data ? { plans: response.data.plans.map(normalizePlan) } : null,
    };
  },
  createPlan: async (data: CreatePlanInput) => {
    const response = await api.post<{ plan: BackendPlan }>("/api/super-admin/plans", data);
    return {
      ...response,
      data: response.data ? { plan: normalizePlan(response.data.plan) } : null,
    };
  },
  institutions: async () => {
    const response = await api.get<{ institutions: BackendInstitution[] }>("/api/super-admin/institutions");
    return {
      ...response,
      data: response.data ? { institutions: response.data.institutions.map(normalizeInstitution) } : null,
    };
  },
  createInstitution: async (data: CreateInstitutionInput) => {
    const response = await api.post<{ institution: BackendInstitution }>("/api/super-admin/institutions", data);
    return {
      ...response,
      data: response.data ? { institution: normalizeInstitution(response.data.institution) } : null,
    };
  },
  updateInstitutionStatus: (id: string, status: string) =>
    api.patch<{ institution: BackendInstitution }>(`/api/super-admin/institutions/${id}/status`, {
      status: STATUS_TO_API[status] || status,
    }),
  updateInstitution: async (id: string, data: Partial<CreateInstitutionInput> & Partial<Institution>) => {
    const response = await api.patch<{ institution: BackendInstitution }>(`/api/super-admin/institutions/${id}`, data);
    return {
      ...response,
      data: response.data ? { institution: normalizeInstitution(response.data.institution) } : null,
    };
  },
  deleteInstitution: (id: string) =>
    api.delete<void>(`/api/super-admin/institutions/${id}`),
  updateInstitutionSubscription: (id: string, data: { planId: string; billingCycle: string; status?: string; schoolYears?: number; generateInvoice?: boolean }) =>
    api.patch<{ ok: boolean; subscriptionId: string }>(`/api/super-admin/institutions/${id}/subscription`, data),
  establishments: (institutionId: string) =>
    api.get<{ institution: BackendInstitution; establishments: Establishment[] }>(`/api/super-admin/institutions/${institutionId}/establishments`),
  createEstablishment: (institutionId: string, data: CreateEstablishmentInput) =>
    api.post<{ establishment: Establishment }>(`/api/super-admin/institutions/${institutionId}/establishments`, data),
  payments: (institutionId?: string) =>
    api.get<{ payments: SaaSPayment[] }>(`/api/super-admin/payments${institutionId ? `?institutionId=${institutionId}` : ""}`),
  allowedPhones: (institutionId?: string) =>
    api.get<{ allowedPhones: AllowedAccess[] }>(`/api/super-admin/allowed-phones${institutionId ? `?institutionId=${institutionId}` : ""}`),
  createAllowedPhone: (data: CreateAllowedAccessInput) =>
    api.post<{ allowedPhone: AllowedAccess }>("/api/super-admin/allowed-phones", data),
  revokeAllowedPhone: (id: string) =>
    api.delete<{ ok: boolean }>(`/api/super-admin/allowed-phones/${id}`),
  auditLogs: (institutionId?: string) =>
    api.get<{ logs: AuditLog[] }>(`/api/super-admin/audit-logs${institutionId ? `?institutionId=${institutionId}` : ""}`),
  documents: (institutionId?: string) =>
    api.get<{ documents: OfficialDocument[] }>(`/api/super-admin/documents${institutionId ? `?institutionId=${institutionId}` : ""}`),
  deleteDocument: (id: string) => api.delete<{ ok: boolean }>(`/api/super-admin/documents/${id}`),
  systemHealth: () => api.get<{ uptime: number; services: SystemService[] }>("/api/super-admin/system-health"),
  notifications: () => api.get<{ notifications: SuperAdminNotification[] }>("/api/super-admin/notifications"),
  usersSummary: (institutionId?: string) =>
    api.get<UserSummary>(`/api/super-admin/users-summary${institutionId ? `?institutionId=${institutionId}` : ""}`),
  suspendExpiredSubscriptions: () =>
    api.post<{ suspended: number }>("/api/super-admin/subscriptions/suspend-expired"),
  countryConfigs: () =>
    api.get<{ countries: Array<{ code: string; name: string; nameFr: string; currency: string; language: string; schoolYearStartMonth: number; schoolYearEndMonth: number; educationCycles: unknown[] }> }>("/api/super-admin/country-configs"),
  createSuperAdmin: (data: CreateSuperAdminInput) =>
    api.post<{ user: UserProfile }>("/api/super-admin/super-admins", data),
  syncDefaultPlans: () => api.post<{ plans: BackendPlan[] }>("/api/super-admin/plans/sync-defaults"),
  platformBranding: () => api.get<{ branding: PlatformBranding }>("/api/super-admin/platform-branding"),
  updatePlatformBranding: (data: Partial<PlatformBranding>) =>
    api.patch<{ branding: PlatformBranding }>("/api/super-admin/platform-branding", data),
  uploadPlatformBrandingAsset: (field: "logo" | "favicon", file: File) => {
    const form = new FormData();
    form.append("file", file);
    return uploadProtectedFile<{ branding: PlatformBranding; url: string }>(`/api/super-admin/platform-branding/${field}`, form);
  },
  calendarEvents: (filters?: CalendarFilters) => {
    const params = new URLSearchParams();
    if (filters?.start) params.append("start", filters.start);
    if (filters?.end) params.append("end", filters.end);
    if (filters?.type) params.append("type", filters.type);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.classroomId) params.append("classroomId", filters.classroomId);
    if (filters?.gradeLevelId) params.append("gradeLevelId", filters.gradeLevelId);
    if (filters?.establishmentId) params.append("establishmentId", filters.establishmentId);
    if (filters?.institutionId) params.append("institutionId", filters.institutionId);
    if (filters?.search) params.append("search", filters.search);
    const qs = params.toString();
    return api.get<{ events: CalendarEvent[] }>(`/api/calendar/events${qs ? `?${qs}` : ""}`);
  },
  createCalendarEvent: (data: CreateCalendarEventInput) => api.post<{ event: CalendarEvent }>("/api/calendar/events", data),
  updateCalendarEvent: (id: string, data: Partial<CreateCalendarEventInput>) => api.patch<{ event: CalendarEvent }>(`/api/calendar/events/${id}`, data),
  deleteCalendarEvent: (id: string) => api.delete<{ ok: boolean }>(`/api/calendar/events/${id}`),
  holidayLeaves: (filters?: CalendarFilters) => {
    const params = new URLSearchParams();
    if (filters?.start) params.append("start", filters.start);
    if (filters?.end) params.append("end", filters.end);
    if (filters?.type) params.append("type", filters.type);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.classroomId) params.append("classroomId", filters.classroomId);
    if (filters?.gradeLevelId) params.append("gradeLevelId", filters.gradeLevelId);
    if (filters?.establishmentId) params.append("establishmentId", filters.establishmentId);
    if (filters?.institutionId) params.append("institutionId", filters.institutionId);
    if (filters?.search) params.append("search", filters.search);
    const qs = params.toString();
    return api.get<{ holidays: HolidayLeave[] }>(`/api/calendar/holidays${qs ? `?${qs}` : ""}`);
  },
  createHolidayLeave: (data: CreateHolidayLeaveInput) => api.post<{ holiday: HolidayLeave }>("/api/calendar/holidays", data),
  updateHolidayLeave: (id: string, data: Partial<CreateHolidayLeaveInput>) => api.patch<{ holiday: HolidayLeave }>(`/api/calendar/holidays/${id}`, data),
  deleteHolidayLeave: (id: string) => api.delete<{ ok: boolean }>(`/api/calendar/holidays/${id}`),
};

export interface UserProfile {
  id: string;
  phone: string;
  role: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  institutionId?: string;
  establishmentId?: string;
  avatarUrl?: string;
  preferredLanguage?: string;
}

export interface DashboardData {
  totalInstitutions: number;
  activeInstitutions: number;
  suspendedInstitutions: number;
  expiredSubscriptions: number;
  totalStudents: number;
  totalTeachers: number;
  monthlyRevenue: number;
  annualRevenue: number;
  pendingSaaSPayments?: number;
  recentInstitutions?: Institution[];
  institutionsByStatus?: { status: string; count: number }[];
  monthlyRevenueSeries?: { month: string; revenue: number; subscriptions: number }[];
}

export interface Plan {
  id: string;
  name: string;
  code?: string;
  tier: "BASIC" | "PREMIUM" | "ENTERPRISE";
  monthlyPrice: number;
  annualPrice: number;
  maxStudents: number;
  maxTeachers: number;
  maxEstablishments?: number;
  canCreateBranches?: boolean;
  features: string[];
  createdAt: string;
}

export interface Institution {
  id: string;
  name: string;
  slug: string;
  kind?: string;
  structure?: "SINGLE_SCHOOL" | "CENTRAL_ADMINISTRATION";
  type: string;
  status: "active" | "trial" | "suspended" | "expired" | "deleted";
  plan?: Plan;
  expiresAt?: string;
  createdAt: string;
  logo?: string;
  country?: string;
  city?: string;
  district?: string;
  address?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  directorName?: string;
  directorPhone?: string;
  directorEmail?: string;
  centralAdminName?: string;
  centralAdminPhone?: string;
  centralAdminEmail?: string;
  motto?: string;
  languages?: string[];
  levels?: string[];
  activeAcademicYearName?: string;
  currency?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
}

export interface CreatePlanInput {
  name: string;
  code?: string;
  tier: Plan["tier"];
  monthlyPrice: number;
  annualPrice: number;
  maxStudents: number;
  maxTeachers: number;
  features: string[];
}

export interface CreateInstitutionInput {
  name: string;
  slug?: string;
  kind: string;
  city?: string;
  country?: string;
  address?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  motto?: string;
  languages?: string[];
  levels?: string[];
  activeAcademicYearName?: string;
  currency?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  directorName?: string;
  directorPhone?: string;
  directorEmail?: string;
  centralAdminName?: string;
  centralAdminPhone?: string;
  centralAdminEmail?: string;
  planId: string;
  billingCycle: "MONTHLY" | "ANNUAL" | "SCHOOL_YEAR" | "MULTI_YEAR";
  status: "TRIAL" | "ACTIVE";
  schoolYears?: number;
  estimatedStudents?: number;
  estimatedTeachers?: number;
}

export interface Establishment {
  id: string;
  institutionId: string;
  name: string;
  slug: string;
  kind: string;
  status: string;
  country?: string | null;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  directorName?: string | null;
  createdAt: string;
}

export interface CreateEstablishmentInput {
  name: string;
  slug?: string;
  kind?: string;
  country?: string;
  city?: string;
  district?: string;
  address?: string;
  phone?: string;
  email?: string;
  directorName?: string;
  directorPhone?: string;
  directorEmail?: string;
}

export interface CreateSuperAdminInput {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
}

export interface SaaSPayment {
  id: string;
  amount: number;
  currency: string;
  provider: string;
  transactionRef?: string | null;
  status: "PENDING" | "PROCESSING" | "PAID" | "FAILED" | "CANCELED" | "REFUNDED";
  paidAt?: string | null;
  createdAt: string;
  institution?: { id: string; name: string; slug: string };
  subscription?: { plan?: Plan };
}

export interface AllowedAccess {
  id: string;
  institutionId: string;
  phone: string;
  role: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  usedAt?: string | null;
  createdAt: string;
  active?: boolean;
  institution?: { id: string; name: string; slug: string };
}

export interface CreateAllowedAccessInput {
  institutionId: string;
  phone: string;
  role: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId?: string | null;
  createdAt: string;
  actor?: { firstName?: string; lastName?: string; phone?: string; role?: string } | null;
  institution?: { name: string; slug: string } | null;
}

export interface OfficialDocument {
  id: string;
  ownerType: string;
  ownerId: string;
  type: string;
  title: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  institution?: { id: string; name: string; slug: string };
}

export interface SystemService {
  name: string;
  status: "ok" | "configured" | "warning" | "error";
  latency: string;
}

export interface UserRoleCount {
  role: string;
  count: number;
}

export interface UserSummary {
  totalUsers: number;
  activeUsers: number;
  activeToday: number;
  institutions: number;
  allowedPhones: number;
  roles: UserRoleCount[];
}

export interface SuperAdminNotification {
  id: string;
  title: string;
  desc: string;
  time: string;
  unread: boolean;
  level: "INFO" | "WARNING" | "DANGER";
}
