import { getSchoolToken, getSchoolRefreshToken, setSchoolTokens, removeSchoolTokens } from "./school-auth";
import { getApiBaseUrl } from "./api-url";

const apiUrl = (endpoint: string) => `${getApiBaseUrl()}${endpoint}`;

type RequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ApiOptions {
  method?: RequestMethod;
  body?: unknown;
  headers?: Record<string, string>;
  skipAuth?: boolean;
  slug?: string; // for redirect on 401
}

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

async function refreshSchoolTokens(): Promise<boolean> {
  const refreshToken = getSchoolRefreshToken();
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
      setSchoolTokens(data.accessToken, data.refreshToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function schoolApiRequest<T>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> {
  const { method = "GET", body, headers = {}, skipAuth = false, slug } = options;

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (!skipAuth) {
    const token = getSchoolToken();
    if (token) {
      requestHeaders["Authorization"] = `Bearer ${token}`;
    }
  }

  const config: RequestInit = {
    method,
    headers: requestHeaders,
  };

  if (body !== undefined) {
    config.body = JSON.stringify(body);
  }

  try {
    let res = await fetch(apiUrl(endpoint), config);

    if (res.status === 401 && !skipAuth) {
      const refreshed = await refreshSchoolTokens();
      if (refreshed) {
        const newToken = getSchoolToken();
        if (newToken) {
          requestHeaders["Authorization"] = `Bearer ${newToken}`;
        }
        res = await fetch(apiUrl(endpoint), {
          ...config,
          headers: requestHeaders,
        });
      } else {
        removeSchoolTokens();
        if (typeof window !== "undefined") {
          const redirectSlug = slug || window.location.pathname.split("/")[1];
          window.location.href = `/${redirectSlug}/login`;
        }
        return { data: null, error: "Session expirée", status: 401 };
      }
    }

    if (!res.ok) {
      let errorMsg = `Erreur ${res.status}`;
      try {
        const errData = await res.json();
        // Backend returns { error: { code, message } } or { message }
        const e = errData.error;
        errorMsg = (e && typeof e === "object" ? e.message : e) || errData.message || errorMsg;
      } catch {
        // ignore
      }
      return { data: null, error: errorMsg, status: res.status };
    }

    const text = await res.text();
    if (!text) {
      return { data: null, error: null, status: res.status };
    }

    const data = JSON.parse(text) as T;
    return { data, error: null, status: res.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur réseau";
    return { data: null, error: message, status: 0 };
  }
}

const get = <T>(endpoint: string, options?: Omit<ApiOptions, "method" | "body">) =>
  schoolApiRequest<T>(endpoint, { ...options, method: "GET" });

const post = <T>(endpoint: string, body?: unknown, options?: Omit<ApiOptions, "method" | "body">) =>
  schoolApiRequest<T>(endpoint, { ...options, method: "POST", body });

const patch = <T>(endpoint: string, body?: unknown, options?: Omit<ApiOptions, "method" | "body">) =>
  schoolApiRequest<T>(endpoint, { ...options, method: "PATCH", body });

const del = <T>(endpoint: string, options?: Omit<ApiOptions, "method" | "body">) =>
  schoolApiRequest<T>(endpoint, { ...options, method: "DELETE" });

async function uploadForm<T>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
  const token = getSchoolToken();
  try {
    const res = await fetch(apiUrl(endpoint), {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      return { data: null, error: payload?.error?.message || `Erreur ${res.status}`, status: res.status };
    }
    const data = (await res.json()) as T;
    return { data, error: null, status: res.status };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Erreur réseau", status: 0 };
  }
}

export async function downloadProtectedFile(
  endpoint: string,
  filename: string,
  mode: "download" | "open" | "print" = "download"
): Promise<string | null> {
  const pendingWindow = mode === "download" ? null : window.open("about:blank", "_blank");
  if (mode !== "download" && !pendingWindow) {
    return "Le navigateur a bloqué l'ouverture. Autorisez les popups pour imprimer/ouvrir le PDF.";
  }
  if (pendingWindow) {
    pendingWindow.document.write("<!doctype html><title>Chargement du document...</title><body style='margin:0;background:#111;color:white;font-family:sans-serif;display:grid;place-items:center;height:100vh'>Chargement du document...</body>");
  }

  const token = getSchoolToken();
  const res = await fetch(apiUrl(endpoint), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    if (pendingWindow) {
      pendingWindow.document.body.innerHTML = `<div style="padding:24px;font-family:sans-serif;color:#b91c1c">Impossible d'ouvrir le document. Erreur ${res.status}</div>`;
    }
    return `Erreur ${res.status}`;
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  if (mode === "download") {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return null;
  }

  const win = pendingWindow!;
  win.document.open();
  win.document.write(`<!doctype html>
    <html>é
      <head>
        <title>${filename.replace(/</g, "&lt;")}</title>
        <style>
          html, body { margin: 0; height: 100%; background: #111827; }
          iframe { width: 100%; height: 100%; border: 0; background: white; }
          .bar { position: fixed; top: 12px; right: 12px; z-index: 2; display: flex; gap: 8px; }
          a, button { border: 0; border-radius: 10px; background: #059669; color: white; padding: 9px 12px; font: 600 13px sans-serif; text-decoration: none; cursor: pointer; }
        </style>
      </head>
      <body>
        <div class="bar">
          <a href="${url}" download="${filename.replace(/"/g, "&quot;")}">Télécharger</a>
          <button onclick="document.querySelector('iframe').contentWindow.print()">Imprimer</button>
        </div>
        <iframe src="${url}"></iframe>
        ${mode === "print" ? "<script>setTimeout(() => document.querySelector('iframe').contentWindow.print(), 900)</script>" : ""}
      </body>
    </html>`);
  win.document.close();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return null;
}

function mapGender(gender?: string) {
  if (gender === "M" || gender === "MALE") return "MALE";
  if (gender === "F" || gender === "FEMALE") return "FEMALE";
  return gender;
}

function mapContract(contract?: string) {
  if (contract === "VACATION") return "VACATAIRE";
  return contract || "CDI";
}

function mapProvider(method?: string) {
  if (!method) return "CASH";
  if (method === "MOBILE_MONEY") return "WAVE";
  if (method === "CHECK") return "CASH";
  return method;
}

// Auth (school-specific)
export const schoolAuthApi = {
  requestOtp: (phone: string, schoolSlug: string) =>
    post<{ message: string; mock?: boolean; debugCode?: string }>("/api/auth/request-otp", { phone, schoolSlug }, { skipAuth: true }),

  verifyOtp: (phone: string, code: string, schoolSlug: string) =>
    post<{ accessToken: string; refreshToken: string; user: SchoolUser }>(
      "/api/auth/verify-otp",
      { phone, code, schoolSlug },
      { skipAuth: true }
    ),

  me: async () => {
    const response = await get<{ user: SchoolUser }>("/api/auth/me");
    const user = response.data?.user;
    return {
      ...response,
      data: user
        ? {
            ...user,
            name: user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.phone,
          }
        : null,
    };
  },

  getInstitutionBySlug: (slug: string) =>
    get<{ institution: SchoolInstitution }>(`/api/institutions/slug/${slug}`, { skipAuth: true }),
};

export const schoolApi = {
  dashboard: () => get<SchoolDashboardData>("/api/dashboard"),
  centralSchools: () => get<{ schools: CentralSchool[] }>("/api/central-admin/schools"),
  createCentralSchool: (data: CreateCentralSchoolInput) =>
    post<{ school: CentralSchool }>("/api/central-admin/schools", data),
  assignSchoolDirector: (schoolId: string, data: AssignDirectorInput) =>
    post<{ user: SchoolUser }>(`/api/central-admin/schools/${schoolId}/director`, data),
  students: (search?: string, classroomId?: string, status?: string, gradeLevelId?: string) => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (classroomId) params.append("classroomId", classroomId);
    if (status) params.append("status", status);
    if (gradeLevelId) params.append("gradeLevelId", gradeLevelId);
    const qs = params.toString();
    return get<{ students: Student[] }>(`/api/students${qs ? `?${qs}` : ""}`);
  },
  createStudent: (data: CreateStudentInput) =>
    post<{ student: Student; pdfs: Record<string, string> }>("/api/students", {
      ...data,
      gender: mapGender(data.gender),
      birthDate: data.birthDate || data.dateOfBirth || undefined,
      fatherName: data.fatherName || undefined,
      fatherPhone: data.fatherPhone || undefined,
      motherName: data.motherName || undefined,
      motherPhone: data.motherPhone || undefined,
      guardianName: data.guardianName || data.parentName || undefined,
      guardianPhone: data.guardianPhone || data.parentPhone || undefined,
      guardianRelation: data.guardianRelation || data.parentRelation || undefined,
    }),
  getStudent: (id: string) =>
    get<{ student: Student }>(`/api/students/${id}`),
  updateStudent: (id: string, data: Partial<CreateStudentInput> & { status?: Student["status"] }) =>
    patch<{ student: Student }>(`/api/students/${id}`, {
      ...data,
      gender: mapGender(data.gender),
      birthDate: data.birthDate || data.dateOfBirth || undefined,
    }),
  deleteStudent: (id: string) => del<{ ok: boolean }>(`/api/students/${id}`),

  teachers: (search?: string, classroomId?: string, status?: string) => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (classroomId) params.append("classroomId", classroomId);
    if (status) params.append("status", status);
    const qs = params.toString();
    return get<{ teachers: Teacher[] }>(`/api/teachers${qs ? `?${qs}` : ""}`);
  },
  createTeacher: (data: CreateTeacherInput) =>
    post<{ teacher: Teacher; pdfs: Record<string, string> }>("/api/teachers", {
      ...data,
      specialization: data.specialization || data.speciality,
      contractType: mapContract(data.contractType),
      baseSalary: data.baseSalary ?? data.salary ?? 0,
    }),

  classes: (search?: string, gradeLevelId?: string) => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (gradeLevelId) params.append("gradeLevelId", gradeLevelId);
    const qs = params.toString();
    return get<{ classes: Classroom[] }>(`/api/academics/classes${qs ? `?${qs}` : ""}`);
  },
  createClass: (data: CreateClassInput) =>
    post<{ classroom: Classroom }>("/api/academics/classes", {
      ...data,
      gradeLevelId: data.gradeLevelId || data.levelId || undefined,
    }),

  academicYears: () => get<{ academicYears: AcademicYear[] }>("/api/academics/academic-years"),
  subjects: (options?: { includeInactive?: boolean }) =>
    get<{ subjects: Subject[] }>(`/api/academics/subjects${options?.includeInactive ? "?includeInactive=true" : ""}`),
  createSubject: (data: CreateSubjectInput) => post<{ subject: Subject }>("/api/academics/subjects", data),
  updateSubject: (id: string, data: UpdateSubjectInput) => patch<{ subject: Subject }>(`/api/academics/subjects/${id}`, data),
  archiveSubject: (id: string) => del<{ ok: boolean }>(`/api/academics/subjects/${id}`),
  levels: () => get<{ levels: Level[] }>("/api/academics/levels"),

  invoices: (search?: string, classroomId?: string, status?: string) => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (classroomId) params.append("classroomId", classroomId);
    if (status) params.append("status", status);
    const qs = params.toString();
    return get<{ invoices: Invoice[] }>(`/api/payments/invoices${qs ? `?${qs}` : ""}`);
  },
  createInvoice: (data: CreateInvoiceInput) =>
    post<{ invoice: Invoice; pdfs?: Record<string, string | undefined> }>("/api/payments/invoices", {
      ...data,
      title: data.title || data.description || data.type || "Frais scolaires",
      totalAmount: data.totalAmount ?? data.amount,
    }),
  recordPayment: (data: RecordPaymentInput) =>
    post<{ payment: Payment; pdfs?: Record<string, string | undefined> }>("/api/payments", {
      ...data,
      provider: mapProvider(data.provider || data.method),
    }),

  attendanceSlots: (date?: string) => {
    const qs = date ? `?date=${date}` : "";
    return get<{ slots: AttendanceSlot[]; date: string }>(`/api/attendance/slots${qs}`);
  },
  attendance: (date?: string, classroomId?: string, scheduleSlotId?: string) => {
    const params = new URLSearchParams();
    if (date) params.append("date", date);
    if (classroomId) params.append("classroomId", classroomId);
    if (scheduleSlotId) params.append("scheduleSlotId", scheduleSlotId);
    const qs = params.toString();
    return get<{ records: AttendanceRecord[] }>(`/api/attendance/students${qs ? `?${qs}` : ""}`);
  },
  saveAttendance: (scheduleSlotId: string, date: string, records: Array<{ studentId: string; status: string; reason?: string }>) =>
    post<{ session: AttendanceSession }>("/api/attendance/student-sessions", {
      scheduleSlotId,
      date,
      records,
    }),
  teacherAttendances: (date?: string, teacherId?: string, status?: string) => {
    const params = new URLSearchParams();
    if (date) params.append("date", date);
    if (teacherId) params.append("teacherId", teacherId);
    if (status) params.append("status", status);
    const qs = params.toString();
    return get<{ records: TeacherAttendanceRecord[] }>(`/api/attendance/teachers${qs ? `?${qs}` : ""}`);
  },
  myTeacherAttendances: (date?: string, status?: string) => {
    const params = new URLSearchParams();
    if (date) params.append("date", date);
    if (status) params.append("status", status);
    const qs = params.toString();
    return get<{ records: TeacherAttendanceRecord[] }>(`/api/attendance/teachers/me${qs ? `?${qs}` : ""}`);
  },
  saveTeacherAttendance: (data: { teacherId: string; date: string; status: string; checkInAt?: string; reason?: string; penaltyAmount?: number }) =>
    post<{ attendance: TeacherAttendanceRecord }>("/api/attendance/teachers", data),

  gradePeriods: () => get<{ periods: GradePeriod[] }>("/api/grades/periods"),
  grades: (filters?: { subjectId?: string; periodId?: string; classroomId?: string }) => {
    const params = new URLSearchParams();
    if (filters?.subjectId) params.append("subjectId", filters.subjectId);
    if (filters?.periodId) params.append("periodId", filters.periodId);
    if (filters?.classroomId) params.append("classroomId", filters.classroomId);
    const qs = params.toString();
    return get<{ grades: Grade[] }>(`/api/grades${qs ? `?${qs}` : ""}`);
  },
  createGrade: (data: CreateGradeInput) =>
    post<{ grade: Grade }>("/api/grades", {
      ...data,
      score: data.score ?? data.value,
      appreciation: data.appreciation ?? data.comment,
    }),
  saveAnnualDecision: (data: AnnualDecisionInput) =>
    post<{ student: Student; annualDecision: StudentAnnualDecision }>("/api/grades/annual-decisions", data),

  discipline: (search?: string, classroomId?: string, kind?: string) => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (classroomId) params.append("classroomId", classroomId);
    if (kind) params.append("kind", kind);
    const qs = params.toString();
    return get<{ records: DisciplineRecord[] }>(`/api/discipline${qs ? `?${qs}` : ""}`);
  },
  createDiscipline: (data: CreateDisciplineInput) =>
    post<{ record: DisciplineRecord }>("/api/discipline", {
      ...data,
      kind: data.kind || data.type,
      title: data.title || data.type || "Signalement",
      description: data.description || data.sanctions,
      points: data.points,
    }),
  disciplineScores: () =>
    get<{ scores: DisciplineScoreRecord[] }>("/api/discipline/scores"),

  documents: (filters?: { ownerType?: string; ownerId?: string; type?: string; search?: string }) => {
    const params = new URLSearchParams();
    if (filters?.ownerType) params.append("ownerType", filters.ownerType);
    if (filters?.ownerId) params.append("ownerId", filters.ownerId);
    if (filters?.type) params.append("type", filters.type);
    if (filters?.search) params.append("search", filters.search);
    const qs = params.toString();
    return get<{ documents: SchoolDocument[] }>(`/api/documents${qs ? `?${qs}` : ""}`);
  },
  uploadDocuments: (ownerType: string, ownerId: string, type: string, files: File[], title?: string) => {
    const form = new FormData();
    form.append("ownerType", ownerType);
    form.append("ownerId", ownerId);
    form.append("type", type);
    if (title) form.append("title", title);
    files.forEach((file) => form.append("files", file));
    return uploadForm<{ documents: SchoolDocument[] }>("/api/documents", form);
  },
  deleteDocument: (id: string) => del<{ ok: boolean }>(`/api/documents/${id}`),

  schedule: (filters?: { search?: string; classroomId?: string; teacherId?: string; subjectId?: string; dayOfWeek?: number }) => {
    const params = new URLSearchParams();
    if (filters?.search) params.append("search", filters.search);
    if (filters?.classroomId) params.append("classroomId", filters.classroomId);
    if (filters?.teacherId) params.append("teacherId", filters.teacherId);
    if (filters?.subjectId) params.append("subjectId", filters.subjectId);
    if (filters?.dayOfWeek) params.append("dayOfWeek", String(filters.dayOfWeek));
    const qs = params.toString();
    return get<{ slots: ScheduleSlot[] }>(`/api/schedule${qs ? `?${qs}` : ""}`);
  },
  createScheduleSlot: (data: CreateScheduleSlotInput) =>
    post<{ slot: ScheduleSlot }>("/api/schedule", data),
  deleteScheduleSlot: (id: string) => del<{ ok: boolean }>(`/api/schedule/${id}`),

  calendarEvents: (filters?: CalendarFilters) => {
    const params = new URLSearchParams();
    if (filters?.start) params.append("start", filters.start);
    if (filters?.end) params.append("end", filters.end);
    if (filters?.type) params.append("type", filters.type);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.classroomId) params.append("classroomId", filters.classroomId);
    if (filters?.gradeLevelId) params.append("gradeLevelId", filters.gradeLevelId);
    if (filters?.establishmentId) params.append("establishmentId", filters.establishmentId);
    if (filters?.search) params.append("search", filters.search);
    const qs = params.toString();
    return get<{ events: CalendarEvent[] }>(`/api/calendar/events${qs ? `?${qs}` : ""}`);
  },
  createCalendarEvent: (data: CreateCalendarEventInput) => post<{ event: CalendarEvent }>("/api/calendar/events", data),
  updateCalendarEvent: (id: string, data: Partial<CreateCalendarEventInput>) => patch<{ event: CalendarEvent }>(`/api/calendar/events/${id}`, data),
  deleteCalendarEvent: (id: string) => del<{ ok: boolean }>(`/api/calendar/events/${id}`),
  holidayLeaves: (filters?: CalendarFilters) => {
    const params = new URLSearchParams();
    if (filters?.start) params.append("start", filters.start);
    if (filters?.end) params.append("end", filters.end);
    if (filters?.type) params.append("type", filters.type);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.classroomId) params.append("classroomId", filters.classroomId);
    if (filters?.gradeLevelId) params.append("gradeLevelId", filters.gradeLevelId);
    if (filters?.establishmentId) params.append("establishmentId", filters.establishmentId);
    if (filters?.search) params.append("search", filters.search);
    const qs = params.toString();
    return get<{ holidays: HolidayLeave[] }>(`/api/calendar/holidays${qs ? `?${qs}` : ""}`);
  },
  createHolidayLeave: (data: CreateHolidayLeaveInput) => post<{ holiday: HolidayLeave }>("/api/calendar/holidays", data),
  updateHolidayLeave: (id: string, data: Partial<CreateHolidayLeaveInput>) => patch<{ holiday: HolidayLeave }>(`/api/calendar/holidays/${id}`, data),
  deleteHolidayLeave: (id: string) => del<{ ok: boolean }>(`/api/calendar/holidays/${id}`),

  messages: () => get<{ conversations: Conversation[] }>("/api/messages/conversations"),
  ensureGeneralConversation: () => post<{ conversation: Conversation }>("/api/messages/conversations/group/all"),
  ensureDirectionConversation: (body?: { title?: string; body?: string }) =>
    post<{ conversation: Conversation }>("/api/messages/conversations/direction", body || {}),
  assignments: () => get<{ assignments: Assignment[] }>("/api/academics/assignments"),
  createAssignment: (data: CreateAssignmentInput) =>
    post<{ assignment: Assignment }>("/api/academics/assignments", data),
  deleteAssignment: (id: string) => del<{ ok: boolean }>(`/api/academics/assignments/${id}`),

  homeworks: (filters?: { classroomId?: string; subjectId?: string; status?: HomeworkStatus }) => {
    const params = new URLSearchParams();
    if (filters?.classroomId) params.append("classroomId", filters.classroomId);
    if (filters?.subjectId) params.append("subjectId", filters.subjectId);
    if (filters?.status) params.append("status", filters.status);
    const qs = params.toString();
    return get<{ homeworks: Homework[] }>(`/api/homeworks${qs ? `?${qs}` : ""}`);
  },
  createHomework: (data: CreateHomeworkInput) => post<{ homework: Homework }>("/api/homeworks", data),
  updateHomework: (id: string, data: UpdateHomeworkInput) => patch<{ homework: Homework }>(`/api/homeworks/${id}`, data),
  saveHomeworkCorrections: (id: string, data: SaveHomeworkCorrectionsInput) =>
    schoolApiRequest<{ homework: Homework }>(`/api/homeworks/${id}/corrections`, { method: "PUT", body: data }),

  parentDashboard: () => get<ParentDashboardData>("/api/parents/dashboard"),
  parentReports: () => get<{ reports: ParentReport[] }>("/api/parents/reports"),
  createParentReport: (data: CreateParentReportInput) =>
    post<{ report: ParentReport }>("/api/parents/reports", data),

  shopProducts: () => get<{ products: Product[] }>("/api/shop/products"),
  shopLowStock: () => get<{ products: Product[] }>("/api/shop/low-stock"),
  shopCategories: () => get<{ categories: ProductCategory[] }>("/api/shop/categories"),
  createShopCategory: (data: { name: string; description?: string }) =>
    post<{ category: ProductCategory }>("/api/shop/categories", data),
  createShopProduct: (data: CreateProductInput) =>
    post<{ product: Product }>("/api/shop/products", data),
  createStockMovement: (data: CreateStockMovementInput) =>
    post<{ movement: StockMovement }>("/api/shop/movements", data),
  createShopSale: (data: CreateSaleInput) =>
    post<{ sale: Sale; pdfs?: Record<string, string | undefined> }>("/api/shop/sales", data),

  settings: () => get<{ institution: SchoolSettings }>("/api/institutions/settings"),
  updateSettings: (data: Partial<SchoolSettings>) =>
    patch<{ institution: SchoolSettings }>("/api/institutions/settings", data),

  mySubscription: () => get<SubscriptionData>("/api/institutions/my-subscription"),

  // Teacher badging
  teacherCheckIn: () => post<{ badge: TeacherBadge }>("/api/teacher-badges/check-in", {}),
  teacherCheckOut: () => post<{ badge: TeacherBadge }>("/api/teacher-badges/check-out", {}),
  teacherBadges: (params?: { teacherId?: string; date?: string; month?: string }) => {
    const qs = new URLSearchParams();
    if (params?.teacherId) qs.append("teacherId", params.teacherId);
    if (params?.date) qs.append("date", params.date);
    if (params?.month) qs.append("month", params.month);
    return get<{ badges: TeacherBadge[] }>(`/api/teacher-badges${qs.toString() ? `?${qs}` : ""}`);
  },
  myBadges: (month?: string) =>
    get<{ badges: TeacherBadge[] }>(`/api/teacher-badges/my${month ? `?month=${month}` : ""}`),

  // Notifications
  notifications: (unreadOnly?: boolean) =>
    get<{ notifications: AppNotification[]; unreadCount: number }>(
      `/api/notifications${unreadOnly ? "?unread=true" : ""}`
    ),
  markNotificationsRead: (ids?: string[]) =>
    post<{ ok: boolean }>("/api/notifications/mark-read", ids ? { ids } : {}),
};

// Types
export interface SchoolUser {
  id: string;
  phone: string;
  role: "SUPER_ADMIN" | "CENTRAL_ADMIN" | "DIRECTOR" | "ADMINISTRATION" | "TEACHER" | "PARENT";
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  institutionId?: string;
  establishmentId?: string;
}

export interface SchoolInstitution {
  id: string;
  name: string;
  slug: string;
  kind?: string;
  type: string;
  status: "ACTIVE" | "TRIAL" | "SUSPENDED" | "EXPIRED";
  logo?: string;
  logoUrl?: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  motto?: string;
  activeAcademicYearName?: string;
}

export interface SchoolDashboardData {
  role?: SchoolUser["role"];
  centralAdministration?: boolean;
  totalSchools?: number;
  assignments?: number;
  totalStudents?: number;
  totalTeachers?: number;
  totalClasses?: number;
  paidInvoices?: number;
  pendingInvoices?: number;
  recentAbsences?: number;
  gradesCount?: number;
  urgentMessages?: number;
  todaySchedule?: ScheduleSlot[];
  recentStudents?: Student[];
  monthlyPayments?: { month: string; amount: number }[];
  institution?: SchoolInstitution;
  schools?: CentralSchool[];
  revenueBySchool?: { school: string; amount: number }[];
  effectifsBySchool?: { school: string; students: number; teachers: number }[];
  performanceBySchool?: { school: string; averageScore: number | null }[];
}

export interface CentralSchool {
  id: string;
  institutionId?: string;
  name: string;
  slug: string;
  kind?: string;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  directorName?: string | null;
  activeDirector?: Pick<SchoolUser, "id" | "firstName" | "lastName" | "phone" | "email">;
  students?: number;
  teachers?: number;
  classes?: number;
  revenue?: number;
  unpaidInvoices?: number;
  absences?: number;
  averageScore?: number | null;
  _count?: { students: number; teachers: number; classrooms: number };
}

export interface CreateCentralSchoolInput {
  name: string;
  slug?: string;
  kind?: string;
  country?: string;
  city?: string;
  district?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  directorName?: string;
  directorPhone?: string;
  directorEmail?: string;
  motto?: string;
  levels?: string[];
  activeAcademicYearName?: string;
}

export interface AssignDirectorInput {
  name: string;
  phone: string;
  email?: string;
  note?: string;
}

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  matricule?: string;
  gender?: "M" | "F" | "MALE" | "FEMALE";
  birthDate?: string;
  dateOfBirth?: string;
  birthPlace?: string;
  nationality?: string;
  status: "ACTIVE" | "INACTIVE" | "ENROLLED" | "PENDING" | "SUSPENDED" | "GRADUATED" | "TRANSFERRED";
  classroomId?: string;
  classroom?: { id: string; name: string; gradeLevel?: Level };
  phone?: string;
  email?: string;
  parentName?: string;
  parentPhone?: string;
  parentRelation?: string;
  fatherName?: string;
  fatherPhone?: string;
  fatherProfession?: string;
  fatherIdNumber?: string;
  motherName?: string;
  motherPhone?: string;
  motherProfession?: string;
  motherIdNumber?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianRelation?: string;
  guardianAddress?: string;
  address?: string;
  city?: string;
  medicalNotes?: string;
  photo?: string;
  photoUrl?: string;
  cycle?: string;
  program?: string;
  enrollmentKind?: string;
  boardingRegime?: string;
  bloodGroup?: string;
  allergies?: string;
  knownIllness?: string;
  currentTreatment?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  parents?: Array<{
    relationship: string;
    isPrimary?: boolean;
    canPickup?: boolean;
    emergencyContact?: boolean;
    parent: {
      id: string;
      firstName: string;
      lastName: string;
      phone: string;
      email?: string;
      profession?: string;
      idNumber?: string;
      address?: string;
    };
  }>;
  grades?: Grade[];
  attendances?: AttendanceRecord[];
  discipline?: DisciplineRecord[];
  invoices?: Invoice[];
  metadata?: {
    city?: string;
    annualDecision?: StudentAnnualDecision;
    documentsChecklist?: Record<string, string>;
  };
  createdAt: string;
}

export interface ParentProfile {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  profession?: string;
  students?: Array<{
    relationship: string;
    isPrimary?: boolean;
    student: Student;
  }>;
}

export interface ParentDashboardData {
  parent: ParentProfile;
  documents: SchoolDocument[];
  reports: ParentReport[];
}

export interface CreateStudentInput {
  establishmentId?: string;
  firstName: string;
  lastName: string;
  gender?: "M" | "F" | "MALE" | "FEMALE";
  birthDate?: string;
  dateOfBirth?: string;
  birthPlace?: string;
  nationality?: string;
  phone?: string;
  email?: string;
  photoUrl?: string;
  classroomId?: string;
  parentName?: string;
  parentPhone?: string;
  parentRelation?: string;
  address?: string;
  city?: string;
  medicalNotes?: string;
  cycle?: string;
  program?: string;
  enrollmentKind?: string;
  boardingRegime?: string;
  bloodGroup?: string;
  allergies?: string;
  knownIllness?: string;
  currentTreatment?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  fatherName?: string;
  fatherPhone?: string;
  fatherProfession?: string;
  fatherIdNumber?: string;
  motherName?: string;
  motherPhone?: string;
  motherProfession?: string;
  motherIdNumber?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianRelation?: string;
  guardianAddress?: string;
  tuitionAmount?: number;
  schoolFeeAmount?: number;
  tuitionTitle?: string;
  tuitionDueDate?: string;
  documentsChecklist?: Record<string, string>;
}

export interface Teacher {
  id: string;
  establishmentId?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  speciality?: string;
  specialization?: string;
  address?: string;
  photoUrl?: string;
  contractType?: "CDI" | "CDD" | "VACATION" | "VACATAIRE" | "STAGE";
  baseSalary?: number;
  hireDate?: string;
  matricule?: string;
  status?: string;
  subjects?: Subject[];
  assignments?: Array<{ classroom?: Classroom; subject?: Subject }>;
  createdAt: string;
}

export interface Assignment {
  id: string;
  teacherId?: string;
  classroomId?: string;
  subjectId?: string;
  academicYearId?: string;
  classroom?: Classroom;
  subject?: Subject;
  teacher?: Teacher;
  academicYear?: AcademicYear;
  createdAt?: string;
}

export interface CreateAssignmentInput {
  teacherId: string;
  classroomId: string;
  subjectId: string;
  academicYearId?: string;
}

export interface CreateTeacherInput {
  firstName: string;
  lastName: string;
  establishmentId?: string;
  phone?: string;
  email?: string;
  speciality?: string;
  specialization?: string;
  address?: string;
  photoUrl?: string;
  contractType?: "CDI" | "CDD" | "VACATION" | "VACATAIRE" | "STAGE";
  baseSalary?: number;
  salary?: number;
  hireDate?: string;
  subjectIds?: string[];
  classIds?: string[];
  idDocumentUrl?: string;
  cvUrl?: string;
  contractUrl?: string;
  documentsChecklist?: Record<string, string>;
}

export interface Classroom {
  id: string;
  name: string;
  levelId?: string;
  gradeLevelId?: string;
  level?: Level;
  gradeLevel?: Level;
  capacity?: number;
  description?: string;
  teacherCount?: number;
  studentCount?: number;
  _count?: { students: number; assignments?: number };
  createdAt: string;
}

export interface CreateClassInput {
  name: string;
  levelId?: string;
  gradeLevelId?: string;
  capacity?: number;
  description?: string;
}

export interface Subject {
  id: string;
  name: string;
  code?: string;
  coefficient?: number;
  isActive?: boolean;
  createdAt?: string;
}

export interface CreateSubjectInput {
  name: string;
  code?: string;
  coefficient?: number;
}

export interface UpdateSubjectInput {
  name?: string;
  code?: string | null;
  coefficient?: number;
  isActive?: boolean;
}

export interface AcademicYear {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  isActive?: boolean;
}

export interface Level {
  id: string;
  name: string;
  order?: number;
}

export interface GradePeriod {
  id: string;
  academicYearId: string;
  name: string;
  startsAt: string;
  endsAt: string;
  isClosed?: boolean;
}

export interface Invoice {
  id: string;
  studentId: string;
  number?: string;
  student?: { firstName: string; lastName: string; matricule?: string; classroom?: Classroom };
  amount?: number;
  totalAmount?: number;
  paidAmount?: number;
  title?: string;
  type?: "TUITION" | "ACTIVITY" | "TRANSPORT" | "CANTEEN" | "OTHER";
  status: "PAID" | "PENDING" | "OVERDUE" | "PARTIAL" | "ISSUED" | "PARTIALLY_PAID" | "CANCELED" | "DRAFT";
  dueDate?: string;
  description?: string;
  paidAt?: string;
  payments?: Payment[];
  createdAt: string;
}

export interface CreateInvoiceInput {
  studentId: string;
  amount?: number;
  totalAmount?: number;
  title?: string;
  type: string;
  dueDate?: string;
  description?: string;
}

export interface RecordPaymentInput {
  invoiceId: string;
  studentId?: string;
  amount: number;
  method?: string;
  provider?: string;
  payerName?: string;
  note?: string;
}

export interface Payment {
  id: string;
  invoiceId?: string;
  amount: number;
  currency?: string;
  method?: string;
  provider?: string;
  status?: string;
  receiptNumber?: string;
  receiptUrl?: string;
  paidAt?: string;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  student?: { firstName: string; lastName: string; matricule?: string; photo?: string; photoUrl?: string; classroom?: Classroom };
  date: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  reason?: string;
  classroomId?: string;
  session?: { id: string; date: string; classroom?: Classroom };
}

export interface TeacherAttendanceRecord {
  id: string;
  teacherId: string;
  teacher?: Teacher;
  date: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  checkInAt?: string;
  reason?: string;
  attachmentUrl?: string;
  penaltyAmount?: number;
  createdAt?: string;
}

export interface Grade {
  id: string;
  studentId: string;
  student?: { id?: string; firstName: string; lastName: string; matricule?: string; classroom?: Classroom };
  subjectId: string;
  subject?: Subject;
  value?: number;
  score?: number;
  period?: string | GradePeriod;
  periodId?: string;
  comment?: string;
  appreciation?: string;
  coefficient?: number;
  maxScore?: number;
  createdAt: string;
}

export type HomeworkStatus = "ASSIGNED" | "POSTPONED" | "CORRECTING" | "GRADED" | "CANCELED";

export interface HomeworkCorrection {
  id: string;
  homeworkId: string;
  studentId: string;
  gradeId?: string | null;
  score?: number | null;
  appreciation?: string | null;
  comment?: string | null;
  correctedAt?: string | null;
  student: Student;
  grade?: Grade | null;
}

export interface Homework {
  id: string;
  classroomId: string;
  classroom?: Classroom;
  subjectId: string;
  subject?: Subject;
  teacherId: string;
  teacher?: Teacher;
  kind?: "DEVOIR" | "EXAMEN" | "INTERROGATION" | "PROJET";
  title: string;
  description?: string | null;
  dueDate: string;
  maxScore: number;
  status: HomeworkStatus;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  corrections?: HomeworkCorrection[];
}

export interface CreateHomeworkInput {
  classroomId: string;
  subjectId: string;
  kind?: "DEVOIR" | "EXAMEN" | "INTERROGATION" | "PROJET";
  title: string;
  description?: string;
  dueDate: string;
  maxScore: number;
}

export interface UpdateHomeworkInput {
  title?: string;
  kind?: "DEVOIR" | "EXAMEN" | "INTERROGATION" | "PROJET";
  description?: string | null;
  dueDate?: string;
  maxScore?: number;
  status?: HomeworkStatus;
}

export interface SaveHomeworkCorrectionsInput {
  periodId?: string;
  corrections: Array<{
    studentId: string;
    score?: number | null;
    appreciation?: string;
    comment?: string;
  }>;
}

export interface CreateGradeInput {
  studentId: string;
  subjectId: string;
  periodId?: string;
  value: number;
  score?: number;
  period?: string;
  comment?: string;
  appreciation?: string;
}

export type AnnualDecisionValue = "PASSED" | "REPEATED" | "GRADUATED";

export interface StudentAnnualDecision {
  decision: AnnualDecisionValue;
  academicYearId?: string | null;
  nextClassroomId?: string | null;
  nextClassroomName?: string | null;
  comment?: string | null;
  decidedAt?: string;
  decidedById?: string;
}

export interface AnnualDecisionInput {
  studentId: string;
  decision: AnnualDecisionValue;
  academicYearId?: string;
  nextClassroomId?: string;
  comment?: string;
  applyToStudent?: boolean;
}

export interface DisciplineRecord {
  id: string;
  studentId: string;
  student?: { firstName: string; lastName: string; photo?: string; photoUrl?: string; matricule?: string; classroom?: Classroom };
  type: "WARNING" | "SUSPENSION" | "EXPULSION" | "OBSERVATION" | "DETENTION";
  kind?: string;
  title?: string;
  description: string;
  sanctions?: string;
  date: string;
  createdAt: string;
}

export interface CreateDisciplineInput {
  studentId: string;
  type: string;
  kind?: string;
  title?: string;
  description: string;
  sanctions?: string;
  points?: number;
  date?: string;
}

export interface TeacherBadge {
  id: string;
  institutionId: string;
  teacherId: string;
  date: string;
  checkInAt?: string;
  checkOutAt?: string;
  lateMinutes?: number;
  note?: string;
  createdAt: string;
  teacher?: { id: string; firstName: string; lastName: string; matricule: string };
}

export interface DisciplineScoreRecord {
  id: string;
  institutionId: string;
  studentId: string;
  score: number;
  student?: { id: string; firstName: string; lastName: string; matricule: string; classroom?: { name: string } };
}

export interface AppNotification {
  id: string;
  institutionId: string;
  userId?: string;
  level: "INFO" | "SUCCESS" | "WARNING" | "DANGER";
  channel: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  readAt?: string;
  sentAt?: string;
  createdAt: string;
}

export interface SchoolSettings {
  institutionId: string;
  id?: string;
  name?: string;
  logoUrl?: string;
  sealUrl?: string;
  signatureUrl?: string;
  motto?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  website?: string;
  directorName?: string;
  schoolYear?: string;
  activeAcademicYearName?: string;
  currency?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  languages?: string[];
  gradingScale?: number;
  language?: string;
}

export interface SaaSPlan {
  id: string;
  name: string;
  code: string;
  tier: string;
  monthlyPrice: number;
  annualPrice: number;
  maxStudents: number | null;
  maxTeachers: number | null;
  maxEstablishments: number;
  features?: Record<string, boolean>;
}

export interface SaaSSubscription {
  id: string;
  status: string;
  cycle: string;
  startsAt: string;
  endsAt: string;
  trialEndsAt?: string;
  schoolYears: number;
  plan: SaaSPlan;
}

export interface SaaSInvoice {
  id: string;
  number: string;
  amount: number;
  status: string;
  createdAt: string;
  dueAt?: string;
}

export interface SaaSPayment {
  id: string;
  amount: number;
  status: string;
  transactionRef?: string;
  createdAt: string;
}

export interface SubscriptionData {
  institution: { id: string; name: string; status: string; trialEndsAt?: string };
  subscription: SaaSSubscription | null;
  invoices: SaaSInvoice[];
  payments: SaaSPayment[];
  summary: { totalBilled: number; totalPaid: number; remaining: number };
}

export interface SchoolDocument {
  id: string;
  ownerType: string;
  ownerId: string;
  type: string;
  title: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface AttendanceSession {
  id: string;
  records: AttendanceRecord[];
}

export interface AttendanceSlot extends ScheduleSlot {
  classroom: Classroom;
  teacher?: Teacher | null;
  subject?: Subject | null;
  attendanceSessions: Array<{
    id: string;
    records: Array<{ studentId: string; status: string }>;
  }>;
}

export interface ScheduleSlot {
  id: string;
  classroomId: string;
  classroom?: Classroom;
  teacherId?: string;
  teacher?: Teacher;
  subjectId?: string;
  subject?: Subject;
  room?: string;
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
  notes?: string;
}

export interface CreateScheduleSlotInput {
  classroomId: string;
  teacherId?: string;
  subjectId?: string;
  room?: string;
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
  notes?: string;
}

export type CalendarEventType =
  | "HOMEWORK"
  | "EXAM"
  | "CONTROL"
  | "PUBLIC_HOLIDAY"
  | "LEAVE"
  | "VACATION"
  | "SCHOOL_EVENT"
  | "MEETING"
  | "FIELD_TRIP"
  | "IMPORTANT_DATE"
  | "CEREMONY"
  | "CLASS_COUNCIL"
  | "REGISTRATION"
  | "PAYMENT"
  | "CLOSURE";

export type HolidayLeaveType =
  | "VACATION"
  | "LEAVE"
  | "PUBLIC_HOLIDAY"
  | "CLOSURE"
  | "ADMINISTRATIVE_LEAVE"
  | "TEACHER_LEAVE"
  | "NO_CLASS_PERIOD";

export type CalendarItemStatus = "DRAFT" | "PUBLISHED" | "CANCELED";
export type CalendarPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export interface CalendarFilters {
  start?: string;
  end?: string;
  type?: string;
  status?: string;
  classroomId?: string;
  gradeLevelId?: string;
  establishmentId?: string;
  institutionId?: string;
  search?: string;
}

export interface CalendarEvent {
  id: string;
  institutionId: string;
  establishmentId?: string | null;
  teacherId?: string | null;
  holidayLeaveId?: string | null;
  sourceType?: string;
  sourceId?: string | null;
  title: string;
  type: CalendarEventType;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  classroomIds: string[];
  gradeLevelIds: string[];
  classrooms?: Array<{ id: string; name: string }>;
  gradeLevels?: Array<{ id: string; name: string; code?: string }>;
  establishment?: { id: string; name: string; slug?: string } | null;
  institution?: { id: string; name: string; slug?: string } | null;
  teacher?: { id: string; firstName: string; lastName: string } | null;
  color: string;
  priority: CalendarPriority;
  attachmentUrl?: string | null;
  status: CalendarItemStatus;
  readonly?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCalendarEventInput {
  institutionId?: string;
  establishmentId?: string | null;
  classroomIds: string[];
  gradeLevelIds?: string[];
  title: string;
  type: CalendarEventType;
  description?: string;
  startsAt: string;
  endsAt: string;
  color?: string;
  priority?: CalendarPriority;
  attachmentUrl?: string;
  status?: CalendarItemStatus;
  notifyApp?: boolean;
  notifyEmail?: boolean;
  notifySms?: boolean;
  notifyPush?: boolean;
}

export interface HolidayLeave {
  id: string;
  institutionId: string;
  establishmentId?: string | null;
  title: string;
  type: HolidayLeaveType;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  durationDays: number;
  classroomIds: string[];
  gradeLevelIds: string[];
  classrooms?: Array<{ id: string; name: string }>;
  gradeLevels?: Array<{ id: string; name: string; code?: string }>;
  establishment?: { id: string; name: string; slug?: string } | null;
  institution?: { id: string; name: string; slug?: string } | null;
  status: CalendarItemStatus;
  color: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateHolidayLeaveInput {
  institutionId?: string;
  establishmentId?: string | null;
  title: string;
  type: HolidayLeaveType;
  description?: string;
  startsAt: string;
  endsAt: string;
  classroomIds?: string[];
  gradeLevelIds?: string[];
  status?: CalendarItemStatus;
  color?: string;
}

export interface Conversation {
  id: string;
  type: string;
  title?: string;
  updatedAt?: string;
  messages?: Array<{ body: string; createdAt: string }>;
}

export interface ParentReport {
  id: string;
  type: string;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
  members?: Array<{
    user: {
      id: string;
      firstName: string;
      lastName: string;
      role: string;
    };
  }>;
  messages?: Array<{
    body: string;
    createdAt: string;
    sender?: {
      id: string;
      firstName: string;
      lastName: string;
      role: string;
    };
  }>;
}

export interface CreateParentReportInput {
  type: "MALADIE" | "ABSENCE" | "PLAINTE" | "URGENCE";
  childId?: string;
  message: string;
  attachmentUrl?: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
}

export interface Product {
  id: string;
  categoryId?: string;
  supplierId?: string;
  code: string;
  name: string;
  photoUrl?: string;
  purchasePrice: number;
  salePrice: number;
  quantity: number;
  lowStockAlert: number;
  isActive: boolean;
  category?: ProductCategory;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductInput {
  categoryId?: string;
  supplierId?: string;
  code: string;
  name: string;
  photoUrl?: string;
  purchasePrice?: number;
  salePrice: number;
  quantity?: number;
  lowStockAlert?: number;
}

export interface StockMovement {
  id: string;
  productId: string;
  type: "IN" | "OUT" | "SALE" | "RETURN" | "ADJUSTMENT";
  quantity: number;
  unitPrice?: number;
  reason?: string;
  createdAt: string;
}

export interface CreateStockMovementInput {
  productId: string;
  type: "IN" | "OUT" | "RETURN" | "ADJUSTMENT";
  quantity: number;
  unitPrice?: number;
  reason?: string;
}

export interface CreateSaleInput {
  studentId?: string;
  parentId?: string;
  items: Array<{ productId: string; quantity: number }>;
}

export interface Sale {
  id: string;
  number: string;
  studentId?: string;
  parentId?: string;
  totalAmount: number;
  paidAmount: number;
  status: string;
  receiptUrl?: string;
  createdAt: string;
  items?: Array<{ id: string; productId: string; quantity: number; unitPrice: number; total: number; product?: Product }>;
}
