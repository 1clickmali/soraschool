import { Router, type Request } from 'express'
import { z } from 'zod'
import {
  CalendarEventPriority,
  CalendarEventType,
  CalendarItemStatus,
  HolidayLeaveType,
  NotificationLevel,
  Prisma,
  UserRole
} from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { badRequest, forbidden, notFound } from '../../lib/errors'
import { getParentScope } from '../../lib/parent-access'
import { authenticate } from '../../middlewares/auth'
import { validate } from '../../middlewares/validate'
import {
  addFooterToBufferedPages,
  createProfessionalPdf,
  drawKpiGrid,
  drawProfessionalHeader,
  drawSimpleTable
} from '../pdf/pdf-layout'

export const calendarRoutes = Router()
calendarRoutes.use(authenticate)

const managementRoles = new Set<UserRole>([
  UserRole.SUPER_ADMIN,
  UserRole.CENTRAL_ADMIN,
  UserRole.DIRECTOR,
  UserRole.ADMINISTRATION,
  UserRole.SECRETARIAT
])

const localScopedRoles = new Set<UserRole>([
  UserRole.DIRECTOR,
  UserRole.ADMINISTRATION,
  UserRole.SECRETARIAT,
  UserRole.ACCOUNTANT,
  UserRole.STOCK_MANAGER
])

const teacherEventTypes = new Set<CalendarEventType>([
  CalendarEventType.HOMEWORK,
  CalendarEventType.CONTROL,
  CalendarEventType.EXAM
])

const alertEventTypes = new Set<CalendarEventType>([
  CalendarEventType.EXAM,
  CalendarEventType.PAYMENT,
  CalendarEventType.IMPORTANT_DATE
])

const eventColors: Record<CalendarEventType, string> = {
  HOMEWORK: '#38BDF8',
  EXAM: '#A855F7',
  CONTROL: '#F97316',
  PUBLIC_HOLIDAY: '#22C55E',
  LEAVE: '#F59E0B',
  VACATION: '#EAB308',
  SCHOOL_EVENT: '#0F6BFF',
  MEETING: '#14B8A6',
  FIELD_TRIP: '#EC4899',
  IMPORTANT_DATE: '#EF4444',
  CEREMONY: '#F5B941',
  CLASS_COUNCIL: '#8B5CF6',
  REGISTRATION: '#06B6D4',
  PAYMENT: '#10B981',
  CLOSURE: '#64748B'
}

const holidayToEventType: Record<HolidayLeaveType, CalendarEventType> = {
  VACATION: CalendarEventType.VACATION,
  LEAVE: CalendarEventType.LEAVE,
  PUBLIC_HOLIDAY: CalendarEventType.PUBLIC_HOLIDAY,
  CLOSURE: CalendarEventType.CLOSURE,
  ADMINISTRATIVE_LEAVE: CalendarEventType.LEAVE,
  TEACHER_LEAVE: CalendarEventType.LEAVE,
  NO_CLASS_PERIOD: CalendarEventType.VACATION,
  STRIKE: CalendarEventType.CLOSURE
}

const eventSchema = z.object({
  body: z.object({
    institutionId: z.string().optional(),
    establishmentId: z.string().nullable().optional(),
    classroomIds: z.array(z.string()).default([]),
    gradeLevelIds: z.array(z.string()).default([]),
    title: z.string().min(2),
    type: z.nativeEnum(CalendarEventType),
    description: z.string().optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    priority: z.nativeEnum(CalendarEventPriority).default(CalendarEventPriority.NORMAL),
    attachmentUrl: z.string().url().optional().or(z.literal('')),
    status: z.nativeEnum(CalendarItemStatus).default(CalendarItemStatus.PUBLISHED),
    notifyApp: z.boolean().default(true),
    notifyEmail: z.boolean().default(false),
    notifySms: z.boolean().default(false),
    notifyPush: z.boolean().default(false)
  })
})

const eventUpdateSchema = z.object({
  body: eventSchema.shape.body.partial()
})

const holidaySchema = z.object({
  body: z.object({
    institutionId: z.string().optional(),
    establishmentId: z.string().nullable().optional(),
    title: z.string().min(2),
    type: z.nativeEnum(HolidayLeaveType),
    description: z.string().optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    classroomIds: z.array(z.string()).default([]),
    gradeLevelIds: z.array(z.string()).default([]),
    status: z.nativeEnum(CalendarItemStatus).default(CalendarItemStatus.PUBLISHED),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()
  })
})

const holidayUpdateSchema = z.object({
  body: holidaySchema.shape.body.partial()
})

function isLearnerAudienceRole(role: UserRole) {
  return role === UserRole.TEACHER || role === UserRole.PARENT || role === UserRole.STUDENT
}

function assertTenantOrSuperAdmin(req: Request) {
  if (req.user?.role === UserRole.SUPER_ADMIN) return
  if (!req.user?.institutionId) throw forbidden('Cette action nécessite un établissement')
  req.institutionId = req.user.institutionId
}

function getInstitutionScope(req: Request, requestedInstitutionId?: string | null) {
  if (req.user?.role === UserRole.SUPER_ADMIN) return requestedInstitutionId || undefined
  if (!req.institutionId) throw forbidden('Cette action nécessite un établissement')
  return req.institutionId
}

function requireWritableInstitution(req: Request, requestedInstitutionId?: string | null) {
  const institutionId = getInstitutionScope(req, requestedInstitutionId)
  if (!institutionId) throw badRequest("L'institution est obligatoire pour créer cet élément")
  return institutionId
}

function diffMinutes(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
}

function diffDaysInclusive(start: Date, end: Date) {
  const startDay = new Date(start)
  const endDay = new Date(end)
  startDay.setHours(0, 0, 0, 0)
  endDay.setHours(0, 0, 0, 0)
  return Math.max(1, Math.floor((endDay.getTime() - startDay.getTime()) / 86_400_000) + 1)
}

function parseRange(req: Request) {
  const start = typeof req.query.start === 'string' ? new Date(req.query.start) : new Date(new Date().getFullYear(), 0, 1)
  const end = typeof req.query.end === 'string' ? new Date(req.query.end) : new Date(new Date().getFullYear(), 11, 31, 23, 59, 59)
  return { start, end }
}

async function teacherScope(institutionId: string, userId: string) {
  const teacher = await prisma.teacher.findFirst({
    where: { institutionId, userId },
    include: { assignments: { include: { classroom: true, subject: true } } }
  })
  if (!teacher) return { teacher: null, classroomIds: [], gradeLevelIds: [] }
  const classroomIds = teacher.assignments.map((assignment) => assignment.classroomId)
  const gradeLevelIds = teacher.assignments.map((assignment) => assignment.classroom.gradeLevelId).filter(Boolean) as string[]
  return { teacher, classroomIds: [...new Set(classroomIds)], gradeLevelIds: [...new Set(gradeLevelIds)] }
}

async function studentScope(institutionId: string, userId: string) {
  const student = await prisma.student.findFirst({ where: { institutionId, userId }, select: { id: true, classroomId: true, establishmentId: true } })
  return {
    studentIds: student ? [student.id] : [],
    classroomIds: student?.classroomId ? [student.classroomId] : [],
    establishmentId: student?.establishmentId ?? null
  }
}

async function visibleClassScope(req: Request, institutionId: string) {
  if (req.user!.role === UserRole.PARENT) {
    const scope = await getParentScope(institutionId, req.user!.id)
    const students = await prisma.student.findMany({
      where: { id: { in: scope.studentIds }, institutionId },
      select: { classroomId: true, establishmentId: true }
    })
    return {
      classroomIds: [...new Set(students.map((student) => student.classroomId).filter(Boolean) as string[])],
      establishmentId: students.find((student) => student.establishmentId)?.establishmentId ?? null
    }
  }
  if (req.user!.role === UserRole.STUDENT) return studentScope(institutionId, req.user!.id)
  if (req.user!.role === UserRole.TEACHER) return teacherScope(institutionId, req.user!.id)
  return { classroomIds: [] as string[], gradeLevelIds: [] as string[], establishmentId: req.user!.establishmentId ?? null }
}

async function buildEventWhere(req: Request): Promise<Prisma.CalendarEventWhereInput> {
  assertTenantOrSuperAdmin(req)
  const { start, end } = parseRange(req)
  const institutionId = getInstitutionScope(req, typeof req.query.institutionId === 'string' ? req.query.institutionId : undefined)
  const search = typeof req.query.search === 'string' ? req.query.search : undefined
  const type = typeof req.query.type === 'string' ? req.query.type as CalendarEventType : undefined
  const status = typeof req.query.status === 'string' ? req.query.status as CalendarItemStatus : undefined
  const classroomId = typeof req.query.classroomId === 'string' ? req.query.classroomId : undefined
  const gradeLevelId = typeof req.query.gradeLevelId === 'string' ? req.query.gradeLevelId : undefined
  const establishmentId = typeof req.query.establishmentId === 'string' ? req.query.establishmentId : undefined

  const where: Prisma.CalendarEventWhereInput = {
    institutionId,
    type,
    status: status ?? (managementRoles.has(req.user!.role) ? undefined : CalendarItemStatus.PUBLISHED),
    startsAt: { lte: end },
    endsAt: { gte: start },
    OR: search
      ? [
          { title: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { description: { contains: search, mode: Prisma.QueryMode.insensitive } }
        ]
      : undefined
  }

  if (classroomId) where.classroomIds = { has: classroomId }
  if (gradeLevelId) where.gradeLevelIds = { has: gradeLevelId }
  if (establishmentId) where.establishmentId = establishmentId

  if (req.user!.role === UserRole.SUPER_ADMIN) return where

  if (localScopedRoles.has(req.user!.role) && req.user!.establishmentId && !establishmentId) {
    where.AND = [{ OR: [{ establishmentId: req.user!.establishmentId }, { establishmentId: null }] }]
  }

  if (isLearnerAudienceRole(req.user!.role)) {
    const scope = await visibleClassScope(req, institutionId!)
    const classIds = 'classroomIds' in scope ? scope.classroomIds : []
    const gradeIds = 'gradeLevelIds' in scope ? scope.gradeLevelIds ?? [] : []
    const readableOr: Prisma.CalendarEventWhereInput[] = [
      { classroomIds: { isEmpty: true }, gradeLevelIds: { isEmpty: true } },
      ...(classIds.length ? [{ classroomIds: { hasSome: classIds } }] : []),
      ...(gradeIds.length ? [{ gradeLevelIds: { hasSome: gradeIds } }] : [])
    ]
    if ('teacher' in scope && scope.teacher) readableOr.push({ teacherId: scope.teacher.id })
    where.AND = [...(Array.isArray(where.AND) ? where.AND : []), { OR: readableOr }]
  }

  return where
}

async function assertTeacherCanTarget(req: Request, institutionId: string, type: CalendarEventType, classroomIds: string[]) {
  if (req.user!.role !== UserRole.TEACHER) return null
  if (!teacherEventTypes.has(type)) throw forbidden("Un professeur peut créer uniquement des devoirs, contrôles ou examens")
  if (!classroomIds.length) throw badRequest('Veuillez choisir au moins une classe')
  const { teacher, classroomIds: allowedClassIds } = await teacherScope(institutionId, req.user!.id)
  if (!teacher) throw forbidden('Profil professeur introuvable')
  const unauthorized = classroomIds.some((id) => !allowedClassIds.includes(id))
  if (unauthorized) throw forbidden('Vous pouvez cibler uniquement vos classes')
  return teacher
}

async function assertWritableTarget(req: Request, institutionId: string, establishmentId?: string | null, classroomIds: string[] = []) {
  if (req.user!.role === UserRole.SUPER_ADMIN || req.user!.role === UserRole.CENTRAL_ADMIN) return establishmentId ?? undefined
  if (localScopedRoles.has(req.user!.role)) {
    if (req.user!.establishmentId && establishmentId && establishmentId !== req.user!.establishmentId) {
      throw forbidden("Vous ne pouvez gérer que votre établissement")
    }
    return req.user!.establishmentId ?? establishmentId ?? undefined
  }
  if (req.user!.role === UserRole.TEACHER) return undefined
  throw forbidden('Votre rôle ne permet pas cette action')
}

async function enrichEvents(events: Array<any>) {
  const institutionIds = [...new Set(events.map((event) => event.institutionId).filter(Boolean))]
  const establishmentIds = [...new Set(events.map((event) => event.establishmentId).filter(Boolean))]
  const classroomIds = [...new Set(events.flatMap((event) => event.classroomIds ?? []))]
  const gradeLevelIds = [...new Set(events.flatMap((event) => event.gradeLevelIds ?? []))]
  const [institutions, establishments, classrooms, levels] = await Promise.all([
    institutionIds.length ? prisma.institution.findMany({ where: { id: { in: institutionIds } }, select: { id: true, name: true, slug: true } }) : [],
    establishmentIds.length ? prisma.establishment.findMany({ where: { id: { in: establishmentIds } }, select: { id: true, name: true, slug: true } }) : [],
    classroomIds.length ? prisma.classroom.findMany({ where: { id: { in: classroomIds } }, select: { id: true, name: true } }) : [],
    gradeLevelIds.length ? prisma.gradeLevel.findMany({ where: { id: { in: gradeLevelIds } }, select: { id: true, name: true, code: true } }) : []
  ])
  const institutionById = new Map(institutions.map((item) => [item.id, item]))
  const establishmentById = new Map(establishments.map((item) => [item.id, item]))
  const classroomById = new Map(classrooms.map((item) => [item.id, item]))
  const levelById = new Map(levels.map((item) => [item.id, item]))
  return events.map((event) => ({
    ...event,
    institution: event.institution ?? institutionById.get(event.institutionId) ?? null,
    establishment: event.establishment ?? (event.establishmentId ? establishmentById.get(event.establishmentId) ?? null : null),
    classrooms: (event.classroomIds ?? []).map((id: string) => classroomById.get(id)).filter(Boolean),
    gradeLevels: (event.gradeLevelIds ?? []).map((id: string) => levelById.get(id)).filter(Boolean)
  }))
}

async function homeworkEvents(req: Request) {
  assertTenantOrSuperAdmin(req)
  const { start, end } = parseRange(req)
  const institutionId = getInstitutionScope(req, typeof req.query.institutionId === 'string' ? req.query.institutionId : undefined)
  const classroomId = typeof req.query.classroomId === 'string' ? req.query.classroomId : undefined
  const type = typeof req.query.type === 'string' ? req.query.type : undefined
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
  const includeHomework = !type || ['HOMEWORK', 'EXAM', 'CONTROL'].includes(type)
  if (!includeHomework) return []

  const where: Prisma.HomeworkWhereInput = {
    institutionId,
    dueDate: { gte: start, lte: end },
    classroomId
  }

  if (type === 'EXAM') where.kind = 'EXAMEN'
  if (type === 'CONTROL') where.kind = 'INTERROGATION'
  if (type === 'HOMEWORK') where.kind = { in: ['DEVOIR', 'PROJET'] }
  if (search) {
    where.OR = [
      { title: { contains: search, mode: Prisma.QueryMode.insensitive } },
      { description: { contains: search, mode: Prisma.QueryMode.insensitive } },
      { subject: { name: { contains: search, mode: Prisma.QueryMode.insensitive } } },
      { classroom: { name: { contains: search, mode: Prisma.QueryMode.insensitive } } }
    ]
  }

  if (req.user!.role === UserRole.TEACHER && institutionId) {
    const { teacher } = await teacherScope(institutionId, req.user!.id)
    where.teacherId = teacher?.id ?? '__none__'
  } else if ((req.user!.role === UserRole.PARENT || req.user!.role === UserRole.STUDENT) && institutionId) {
    const scope = await visibleClassScope(req, institutionId)
    const classIds = 'classroomIds' in scope ? scope.classroomIds : []
    where.classroomId = classroomId ? classroomId : classIds.length ? { in: classIds } : '__none__'
  } else if (localScopedRoles.has(req.user!.role) && req.user!.establishmentId) {
    where.classroom = { establishmentId: req.user!.establishmentId }
  }

  const homeworks = await prisma.homework.findMany({
    where,
    include: { classroom: { include: { gradeLevel: true, establishment: true } }, subject: true, teacher: true, institution: { select: { id: true, name: true, slug: true } } },
    orderBy: { dueDate: 'asc' }
  })

  return homeworks.map((homework) => {
    const eventType = homework.kind === 'EXAMEN' ? CalendarEventType.EXAM : homework.kind === 'INTERROGATION' ? CalendarEventType.CONTROL : CalendarEventType.HOMEWORK
    return {
      id: `homework:${homework.id}`,
      sourceType: 'HOMEWORK',
      sourceId: homework.id,
      institutionId: homework.institutionId,
      institution: homework.institution,
      establishmentId: homework.classroom.establishmentId,
      establishment: homework.classroom.establishment,
      teacherId: homework.teacherId,
      teacher: homework.teacher,
      holidayLeaveId: null,
      title: homework.title,
      type: eventType,
      description: homework.description,
      startsAt: homework.dueDate,
      endsAt: homework.dueDate,
      durationMinutes: 0,
      classroomIds: [homework.classroomId],
      gradeLevelIds: homework.classroom.gradeLevelId ? [homework.classroom.gradeLevelId] : [],
      classrooms: [homework.classroom],
      gradeLevels: homework.classroom.gradeLevel ? [homework.classroom.gradeLevel] : [],
      color: eventColors[eventType],
      priority: eventType === CalendarEventType.EXAM ? CalendarEventPriority.HIGH : CalendarEventPriority.NORMAL,
      attachmentUrl: null,
      status: CalendarItemStatus.PUBLISHED,
      createdAt: homework.createdAt,
      updatedAt: homework.updatedAt,
      readonly: true
    }
  })
}

async function listCalendarEvents(req: Request) {
  const where = await buildEventWhere(req)
  const [stored, homeworkItems] = await Promise.all([
    prisma.calendarEvent.findMany({
      where,
      include: {
        institution: { select: { id: true, name: true, slug: true } },
        establishment: { select: { id: true, name: true, slug: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, role: true } }
      },
      orderBy: [{ startsAt: 'asc' }, { priority: 'desc' }]
    }),
    homeworkEvents(req)
  ])
  const enriched = await enrichEvents(stored)
  return [...enriched, ...homeworkItems].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
}

async function notifyUsersForEvent(event: {
  institutionId: string
  establishmentId?: string | null
  classroomIds: string[]
  title: string
  type: CalendarEventType
  startsAt: Date
  status: CalendarItemStatus
  notifyApp: boolean
}) {
  if (!event.notifyApp || event.status !== CalendarItemStatus.PUBLISHED) return
  const userIds = new Set<string>()

  if (event.classroomIds.length) {
    const [students, parents, teachers] = await Promise.all([
      prisma.student.findMany({ where: { institutionId: event.institutionId, classroomId: { in: event.classroomIds }, userId: { not: null } }, select: { userId: true } }),
      prisma.parent.findMany({
        where: {
          institutionId: event.institutionId,
          userId: { not: null },
          students: { some: { student: { classroomId: { in: event.classroomIds } } } }
        },
        select: { userId: true }
      }),
      prisma.teacher.findMany({
        where: {
          institutionId: event.institutionId,
          userId: { not: null },
          assignments: { some: { classroomId: { in: event.classroomIds } } }
        },
        select: { userId: true }
      })
    ])
    ;[...students, ...parents, ...teachers].forEach((item) => item.userId && userIds.add(item.userId))
  } else {
    const users = await prisma.user.findMany({
      where: {
        institutionId: event.institutionId,
        isActive: true,
        OR: event.establishmentId ? [{ establishmentId: event.establishmentId }, { establishmentId: null }] : undefined
      },
      select: { id: true }
    })
    users.forEach((user) => userIds.add(user.id))
  }

  const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short' }).format(event.startsAt)
  const titlePrefix = event.type === CalendarEventType.EXAM ? 'Rappel examen' : event.type === CalendarEventType.HOMEWORK ? 'Rappel devoir' : 'Agenda scolaire'
  if (userIds.size) {
    await prisma.notification.createMany({
      data: [...userIds].slice(0, 500).map((userId) => ({
        institutionId: event.institutionId,
        userId,
        level: alertEventTypes.has(event.type) ? NotificationLevel.WARNING : NotificationLevel.INFO,
        title: `${titlePrefix} : ${event.title}`,
        body: `${event.title} est prévu le ${date}.`
      }))
    })
  }
}

function escapeCsv(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function formatEventDate(date: Date | string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))
}

function exportRows(events: Array<any>) {
  return events.map((event) => ({
    titre: event.title,
    type: event.type,
    statut: event.status,
    priorité: event.priority,
    début: formatEventDate(event.startsAt),
    fin: formatEventDate(event.endsAt),
    durée: event.durationMinutes ? `${event.durationMinutes} min` : '',
    établissement: event.establishment?.name ?? event.institution?.name ?? '',
    classes: (event.classrooms ?? []).map((item: any) => item.name).join(', '),
    niveaux: (event.gradeLevels ?? []).map((item: any) => item.name).join(', '),
    description: event.description ?? ''
  }))
}

calendarRoutes.get(
  '/events',
  asyncHandler(async (req, res) => {
    const events = await listCalendarEvents(req)
    res.json({ events })
  })
)

calendarRoutes.get(
  '/events/export',
  asyncHandler(async (req, res) => {
    const events = await listCalendarEvents(req)
    const rows = exportRows(events)
    const format = String(req.query.format ?? 'csv')

    if (format === 'pdf') {
      const exportInstitutionId = req.institutionId
        ?? (typeof req.query.institutionId === 'string' ? req.query.institutionId : undefined)
        ?? events.find((event: any) => event.institutionId)?.institutionId
      const institution = exportInstitutionId
        ? await prisma.institution.findUnique({
            where: { id: exportInstitutionId },
            select: { name: true, country: true, city: true, address: true, phone: true, email: true }
          })
        : null
      const generatedAt = new Date().toLocaleString('fr-FR')
      const doc = createProfessionalPdf({ size: 'A4', margin: 36 })
      const chunks: Buffer[] = []
      doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))))

      drawProfessionalHeader(doc, {
        title: 'Calendrier scolaire',
        subtitle: `${rows.length} élément(s) exporté(s)`,
        generatedAt,
        brand: {
          name: institution?.name ?? 'SoraSchool',
          country: institution?.country,
          city: institution?.city,
          address: institution?.address,
          phone: institution?.phone,
          email: institution?.email
        }
      })
      drawKpiGrid(doc, [
        { label: 'Événements', value: String(rows.length) },
        { label: 'Export', value: 'PDF' },
        { label: 'Périmètre', value: req.user?.role === UserRole.SUPER_ADMIN ? 'Support' : 'École' }
      ])
      drawSimpleTable(doc, 'Liste des événements', rows, [
        { header: 'Titre', width: 154, get: (row) => row.titre },
        { header: 'Type', width: 80, get: (row) => row.type },
        { header: 'Statut', width: 68, get: (row) => row.statut },
        { header: 'Début', width: 74, get: (row) => row.début },
        { header: 'Fin', width: 74, get: (row) => row.fin },
        { header: 'Cible', width: 78, get: (row) => row.classes || row.établissement || '—' }
      ])
      addFooterToBufferedPages(doc, {
        generatedAt,
        generatorName: 'SoraSchool',
        signatureLabel: 'Calendrier scolaire validé selon les informations disponibles.'
      })
      doc.end()
      const buffer = await done
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', 'attachment; filename="calendrier-scolaire.pdf"')
      return res.send(buffer)
    }

    const headers = Object.keys(rows[0] ?? { titre: '', type: '', statut: '', priorité: '', début: '', fin: '', durée: '', établissement: '', classes: '', niveaux: '', description: '' })
    const csv = [headers.map(escapeCsv).join(';'), ...rows.map((row) => headers.map((header) => escapeCsv((row as any)[header])).join(';'))].join('\n')
    res.setHeader('Content-Type', format === 'excel' ? 'application/vnd.ms-excel; charset=utf-8' : 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="calendrier-scolaire.${format === 'excel' ? 'xls' : 'csv'}"`)
    res.send(`\uFEFF${csv}`)
  })
)

calendarRoutes.post(
  '/events',
  validate(eventSchema),
  asyncHandler(async (req, res) => {
    assertTenantOrSuperAdmin(req)
    if (!managementRoles.has(req.user!.role) && req.user!.role !== UserRole.TEACHER) throw forbidden('Votre rôle ne permet pas cette action')
    if (req.body.endsAt < req.body.startsAt) throw badRequest('La date de fin doit être après la date de début')
    const institutionId = requireWritableInstitution(req, req.body.institutionId)
    const teacher = await assertTeacherCanTarget(req, institutionId, req.body.type, req.body.classroomIds)
    const establishmentId = await assertWritableTarget(req, institutionId, req.body.establishmentId, req.body.classroomIds)

    const event = await prisma.calendarEvent.create({
      data: {
        institutionId,
        establishmentId,
        teacherId: teacher?.id,
        createdById: req.user!.id,
        title: req.body.title,
        type: req.body.type,
        description: req.body.description?.trim() || null,
        startsAt: req.body.startsAt,
        endsAt: req.body.endsAt,
        durationMinutes: diffMinutes(req.body.startsAt, req.body.endsAt),
        classroomIds: req.body.classroomIds,
        gradeLevelIds: req.body.gradeLevelIds,
        color: req.body.color ?? eventColors[req.body.type as CalendarEventType],
        priority: req.body.priority,
        attachmentUrl: req.body.attachmentUrl || null,
        status: req.body.status,
        notifyApp: req.body.notifyApp,
        notifyEmail: req.body.notifyEmail,
        notifySms: req.body.notifySms,
        notifyPush: req.body.notifyPush
      },
      include: { institution: true, establishment: true, teacher: true, createdBy: true }
    })
    await notifyUsersForEvent(event)
    res.status(201).json({ event: (await enrichEvents([event]))[0] })
  })
)

calendarRoutes.patch(
  '/events/:id',
  validate(eventUpdateSchema),
  asyncHandler(async (req, res) => {
    assertTenantOrSuperAdmin(req)
    const existing = await prisma.calendarEvent.findFirst({ where: { id: req.params.id } })
    if (!existing) throw notFound('Événement introuvable')
    if (req.user!.role !== UserRole.SUPER_ADMIN && existing.institutionId !== req.institutionId) throw forbidden('Accès refusé')
    if (!managementRoles.has(req.user!.role) && req.user!.role !== UserRole.TEACHER) throw forbidden('Votre rôle ne permet pas cette action')
    if (req.user!.role === UserRole.TEACHER) {
      const teacher = await assertTeacherCanTarget(req, existing.institutionId, req.body.type ?? existing.type, req.body.classroomIds ?? existing.classroomIds)
      if (existing.teacherId && existing.teacherId !== teacher?.id) throw forbidden('Vous pouvez modifier uniquement vos événements')
    }
    if ((req.body.startsAt ?? existing.startsAt) > (req.body.endsAt ?? existing.endsAt)) throw badRequest('La date de fin doit être après la date de début')
    const establishmentId = req.body.establishmentId === undefined
      ? existing.establishmentId
      : await assertWritableTarget(req, existing.institutionId, req.body.establishmentId, req.body.classroomIds ?? existing.classroomIds)

    const event = await prisma.calendarEvent.update({
      where: { id: existing.id },
      data: {
        establishmentId,
        title: req.body.title,
        type: req.body.type,
        description: req.body.description === undefined ? undefined : req.body.description?.trim() || null,
        startsAt: req.body.startsAt,
        endsAt: req.body.endsAt,
        durationMinutes: req.body.startsAt || req.body.endsAt ? diffMinutes(req.body.startsAt ?? existing.startsAt, req.body.endsAt ?? existing.endsAt) : undefined,
        classroomIds: req.body.classroomIds,
        gradeLevelIds: req.body.gradeLevelIds,
        color: req.body.color,
        priority: req.body.priority,
        attachmentUrl: req.body.attachmentUrl === undefined ? undefined : req.body.attachmentUrl || null,
        status: req.body.status,
        notifyApp: req.body.notifyApp,
        notifyEmail: req.body.notifyEmail,
        notifySms: req.body.notifySms,
        notifyPush: req.body.notifyPush
      },
      include: { institution: true, establishment: true, teacher: true, createdBy: true }
    })
    if (req.body.status === CalendarItemStatus.PUBLISHED) await notifyUsersForEvent(event)
    res.json({ event: (await enrichEvents([event]))[0] })
  })
)

calendarRoutes.delete(
  '/events/:id',
  asyncHandler(async (req, res) => {
    assertTenantOrSuperAdmin(req)
    const existing = await prisma.calendarEvent.findFirst({ where: { id: req.params.id } })
    if (!existing) throw notFound('Événement introuvable')
    if (req.user!.role !== UserRole.SUPER_ADMIN && existing.institutionId !== req.institutionId) throw forbidden('Accès refusé')
    if (!managementRoles.has(req.user!.role) && req.user!.role !== UserRole.TEACHER) throw forbidden('Votre rôle ne permet pas cette action')
    if (req.user!.role === UserRole.TEACHER) {
      const { teacher } = await teacherScope(existing.institutionId, req.user!.id)
      if (!teacher || existing.teacherId !== teacher.id) throw forbidden('Vous pouvez supprimer uniquement vos événements')
    }
    await prisma.calendarEvent.delete({ where: { id: existing.id } })
    res.json({ ok: true })
  })
)

async function buildHolidayWhere(req: Request): Promise<Prisma.HolidayLeaveWhereInput> {
  assertTenantOrSuperAdmin(req)
  const { start, end } = parseRange(req)
  const institutionId = getInstitutionScope(req, typeof req.query.institutionId === 'string' ? req.query.institutionId : undefined)
  const search = typeof req.query.search === 'string' ? req.query.search : undefined
  const type = typeof req.query.type === 'string' ? req.query.type as HolidayLeaveType : undefined
  const status = typeof req.query.status === 'string' ? req.query.status as CalendarItemStatus : undefined
  const classroomId = typeof req.query.classroomId === 'string' ? req.query.classroomId : undefined
  const establishmentId = typeof req.query.establishmentId === 'string' ? req.query.establishmentId : undefined
  const where: Prisma.HolidayLeaveWhereInput = {
    institutionId,
    type,
    status: status ?? (managementRoles.has(req.user!.role) ? undefined : CalendarItemStatus.PUBLISHED),
    startsAt: { lte: end },
    endsAt: { gte: start },
    classroomIds: classroomId ? { has: classroomId } : undefined,
    establishmentId,
    OR: search
      ? [
          { title: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { description: { contains: search, mode: Prisma.QueryMode.insensitive } }
        ]
      : undefined
  }
  if (localScopedRoles.has(req.user!.role) && req.user!.establishmentId && !establishmentId) {
    where.AND = [{ OR: [{ establishmentId: req.user!.establishmentId }, { establishmentId: null }] }]
  }
  if (isLearnerAudienceRole(req.user!.role) && institutionId) {
    const scope = await visibleClassScope(req, institutionId)
    const classIds = 'classroomIds' in scope ? scope.classroomIds : []
    where.AND = [...(Array.isArray(where.AND) ? where.AND : []), {
      OR: [
        { classroomIds: { isEmpty: true } },
        ...(classIds.length ? [{ classroomIds: { hasSome: classIds } }] : [])
      ]
    }]
  }
  return where
}

calendarRoutes.get(
  '/holidays',
  asyncHandler(async (req, res) => {
    const holidays = await prisma.holidayLeave.findMany({
      where: await buildHolidayWhere(req),
      include: {
        institution: { select: { id: true, name: true, slug: true } },
        establishment: { select: { id: true, name: true, slug: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, role: true } }
      },
      orderBy: [{ startsAt: 'asc' }, { createdAt: 'desc' }]
    })
    res.json({ holidays: await enrichEvents(holidays) })
  })
)

calendarRoutes.post(
  '/holidays',
  validate(holidaySchema),
  asyncHandler(async (req, res) => {
    assertTenantOrSuperAdmin(req)
    if (!managementRoles.has(req.user!.role)) throw forbidden('Votre rôle ne permet pas de créer des vacances ou congés officiels')
    if (req.body.endsAt < req.body.startsAt) throw badRequest('La date de fin doit être après la date de début')
    const institutionId = requireWritableInstitution(req, req.body.institutionId)
    const establishmentId = await assertWritableTarget(req, institutionId, req.body.establishmentId, req.body.classroomIds)
    const eventType = holidayToEventType[req.body.type as HolidayLeaveType]
    const color = req.body.color ?? eventColors[eventType]
    const holiday = await prisma.$transaction(async (tx) => {
      const created = await tx.holidayLeave.create({
        data: {
          institutionId,
          establishmentId,
          createdById: req.user!.id,
          title: req.body.title,
          type: req.body.type,
          description: req.body.description?.trim() || null,
          startsAt: req.body.startsAt,
          endsAt: req.body.endsAt,
          durationDays: diffDaysInclusive(req.body.startsAt, req.body.endsAt),
          classroomIds: req.body.classroomIds,
          gradeLevelIds: req.body.gradeLevelIds,
          status: req.body.status,
          color
        }
      })
      await tx.calendarEvent.create({
        data: {
          institutionId,
          establishmentId,
          holidayLeaveId: created.id,
          createdById: req.user!.id,
          sourceType: 'HOLIDAY_LEAVE',
          sourceId: created.id,
          title: req.body.title,
          type: eventType,
          description: req.body.description?.trim() || null,
          startsAt: req.body.startsAt,
          endsAt: req.body.endsAt,
          durationMinutes: diffMinutes(req.body.startsAt, req.body.endsAt),
          classroomIds: req.body.classroomIds,
          gradeLevelIds: req.body.gradeLevelIds,
          color,
          priority: eventType === CalendarEventType.PUBLIC_HOLIDAY ? CalendarEventPriority.HIGH : CalendarEventPriority.NORMAL,
          status: req.body.status,
          notifyApp: true
        }
      })
      return created
    })
    if (holiday.status === CalendarItemStatus.PUBLISHED) {
      await notifyUsersForEvent({
        institutionId,
        establishmentId,
        classroomIds: holiday.classroomIds,
        title: holiday.title,
        type: eventType,
        startsAt: holiday.startsAt,
        status: holiday.status,
        notifyApp: true
      })
    }
    res.status(201).json({ holiday: (await enrichEvents([holiday]))[0] })
  })
)

calendarRoutes.patch(
  '/holidays/:id',
  validate(holidayUpdateSchema),
  asyncHandler(async (req, res) => {
    assertTenantOrSuperAdmin(req)
    if (!managementRoles.has(req.user!.role)) throw forbidden('Votre rôle ne permet pas cette action')
    const existing = await prisma.holidayLeave.findFirst({ where: { id: req.params.id } })
    if (!existing) throw notFound('Vacance ou congé introuvable')
    if (req.user!.role !== UserRole.SUPER_ADMIN && existing.institutionId !== req.institutionId) throw forbidden('Accès refusé')
    const startsAt = req.body.startsAt ?? existing.startsAt
    const endsAt = req.body.endsAt ?? existing.endsAt
    if (endsAt < startsAt) throw badRequest('La date de fin doit être après la date de début')
    const establishmentId = req.body.establishmentId === undefined
      ? existing.establishmentId
      : await assertWritableTarget(req, existing.institutionId, req.body.establishmentId, req.body.classroomIds ?? existing.classroomIds)
    const type = req.body.type ?? existing.type
    const eventType = holidayToEventType[type as HolidayLeaveType]
    const color = req.body.color ?? existing.color
    const holiday = await prisma.$transaction(async (tx) => {
      const updated = await tx.holidayLeave.update({
        where: { id: existing.id },
        data: {
          establishmentId,
          title: req.body.title,
          type: req.body.type,
          description: req.body.description === undefined ? undefined : req.body.description?.trim() || null,
          startsAt: req.body.startsAt,
          endsAt: req.body.endsAt,
          durationDays: req.body.startsAt || req.body.endsAt ? diffDaysInclusive(startsAt, endsAt) : undefined,
          classroomIds: req.body.classroomIds,
          gradeLevelIds: req.body.gradeLevelIds,
          status: req.body.status,
          color
        }
      })
      await tx.calendarEvent.updateMany({
        where: { holidayLeaveId: updated.id },
        data: {
          establishmentId,
          title: updated.title,
          type: eventType,
          description: updated.description,
          startsAt: updated.startsAt,
          endsAt: updated.endsAt,
          durationMinutes: diffMinutes(updated.startsAt, updated.endsAt),
          classroomIds: updated.classroomIds,
          gradeLevelIds: updated.gradeLevelIds,
          status: updated.status,
          color
        }
      })
      return updated
    })
    res.json({ holiday: (await enrichEvents([holiday]))[0] })
  })
)

calendarRoutes.delete(
  '/holidays/:id',
  asyncHandler(async (req, res) => {
    assertTenantOrSuperAdmin(req)
    if (!managementRoles.has(req.user!.role)) throw forbidden('Votre rôle ne permet pas cette action')
    const existing = await prisma.holidayLeave.findFirst({ where: { id: req.params.id } })
    if (!existing) throw notFound('Vacance ou congé introuvable')
    if (req.user!.role !== UserRole.SUPER_ADMIN && existing.institutionId !== req.institutionId) throw forbidden('Accès refusé')
    // Only DIRECTOR (or SUPER_ADMIN) can delete validated/published holidays
    if (existing.status === CalendarItemStatus.VALIDATED || existing.status === CalendarItemStatus.PUBLISHED) {
      if (req.user!.role !== UserRole.DIRECTOR && req.user!.role !== UserRole.SUPER_ADMIN) {
        throw forbidden('Seul le Directeur peut supprimer une période validée ou publiée')
      }
    }
    await prisma.holidayLeave.delete({ where: { id: existing.id } })
    res.json({ ok: true })
  })
)

// ─── WORKFLOW VALIDATION CALENDRIER ──────────────────────────────────────────

// Soumettre pour validation par le Directeur
calendarRoutes.post(
  '/holidays/:id/submit',
  asyncHandler(async (req, res) => {
    assertTenantOrSuperAdmin(req)
    if (!managementRoles.has(req.user!.role)) throw forbidden('Accès refusé')
    const holiday = await prisma.holidayLeave.findFirst({ where: { id: req.params.id } })
    if (!holiday) throw notFound('Période introuvable')
    if (holiday.institutionId !== req.institutionId && req.user!.role !== UserRole.SUPER_ADMIN) throw forbidden('Accès refusé')
    if (holiday.status !== CalendarItemStatus.DRAFT) throw badRequest('Seul un brouillon peut être soumis pour validation')
    const updated = await prisma.holidayLeave.update({
      where: { id: holiday.id },
      data: { status: CalendarItemStatus.PENDING_VALIDATION }
    })
    // Notification au directeur
    const directors = await prisma.user.findMany({
      where: { institutionId: holiday.institutionId, role: UserRole.DIRECTOR, isActive: true },
      select: { id: true }
    })
    if (directors.length > 0) {
      await prisma.notification.createMany({
        data: directors.map((d) => ({
          institutionId: holiday.institutionId,
          userId: d.id,
          title: 'Période à valider',
          body: `"${holiday.title}" est en attente de votre validation.`,
          level: 'WARNING' as const,
          link: `/validation-calendrier`
        }))
      })
    }
    res.json({ holiday: updated })
  })
)

// Valider une période (DIRECTOR uniquement)
calendarRoutes.post(
  '/holidays/:id/validate',
  asyncHandler(async (req, res) => {
    assertTenantOrSuperAdmin(req)
    if (req.user!.role !== UserRole.DIRECTOR && req.user!.role !== UserRole.SUPER_ADMIN) {
      throw forbidden('Seul le Directeur peut valider les périodes du calendrier')
    }
    const holiday = await prisma.holidayLeave.findFirst({ where: { id: req.params.id } })
    if (!holiday) throw notFound('Période introuvable')
    if (holiday.institutionId !== req.institutionId && req.user!.role !== UserRole.SUPER_ADMIN) throw forbidden('Accès refusé')
    if (holiday.status !== CalendarItemStatus.PENDING_VALIDATION && holiday.status !== CalendarItemStatus.DRAFT) {
      throw badRequest('Cette période ne peut plus être validée')
    }
    const updated = await prisma.holidayLeave.update({
      where: { id: holiday.id },
      data: {
        status: CalendarItemStatus.PUBLISHED,
        validatedById: req.user!.id,
        validatedAt: new Date(),
        rejectionReason: null
      }
    })
    // Mettre à jour les CalendarEvents liés
    await prisma.calendarEvent.updateMany({
      where: { holidayLeaveId: holiday.id },
      data: { status: CalendarItemStatus.PUBLISHED }
    })
    res.json({ holiday: updated })
  })
)

// Rejeter une période (DIRECTOR uniquement)
calendarRoutes.post(
  '/holidays/:id/reject',
  asyncHandler(async (req, res) => {
    assertTenantOrSuperAdmin(req)
    if (req.user!.role !== UserRole.DIRECTOR && req.user!.role !== UserRole.SUPER_ADMIN) {
      throw forbidden('Seul le Directeur peut rejeter les périodes du calendrier')
    }
    const { reason } = req.body as { reason?: string }
    const holiday = await prisma.holidayLeave.findFirst({ where: { id: req.params.id } })
    if (!holiday) throw notFound('Période introuvable')
    if (holiday.institutionId !== req.institutionId && req.user!.role !== UserRole.SUPER_ADMIN) throw forbidden('Accès refusé')
    const updated = await prisma.holidayLeave.update({
      where: { id: holiday.id },
      data: {
        status: CalendarItemStatus.REJECTED,
        rejectionReason: reason || 'Rejeté par le Directeur',
        validatedById: req.user!.id,
        validatedAt: new Date()
      }
    })
    res.json({ holiday: updated })
  })
)

// Lister les périodes en attente de validation (pour le Directeur)
calendarRoutes.get(
  '/holidays/pending-validation',
  asyncHandler(async (req, res) => {
    assertTenantOrSuperAdmin(req)
    if (req.user!.role !== UserRole.DIRECTOR && req.user!.role !== UserRole.SUPER_ADMIN) {
      throw forbidden('Accès réservé au Directeur')
    }
    const institutionId = req.user!.role === UserRole.SUPER_ADMIN
      ? (req.query.institutionId as string | undefined)
      : req.institutionId!
    const holidays = await prisma.holidayLeave.findMany({
      where: {
        ...(institutionId ? { institutionId } : {}),
        status: { in: [CalendarItemStatus.PENDING_VALIDATION, CalendarItemStatus.DRAFT] }
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, role: true } }
      },
      orderBy: { startsAt: 'asc' }
    })
    res.json({ holidays })
  })
)

// ─── TEMPLATES CALENDRIER PAR PAYS ──────────────────────────────────────────

calendarRoutes.get(
  '/country-templates',
  asyncHandler(async (req, res) => {
    const countryCode = req.query.countryCode as string | undefined
    const templates = await prisma.countryHolidayTemplate.findMany({
      where: countryCode ? { countryCode } : undefined,
      orderBy: [{ countryCode: 'asc' }, { startMonth: 'asc' }, { startDay: 'asc' }]
    })
    res.json({ templates })
  })
)

// Appliquer les templates d'un pays à l'institution (génère des brouillons)
calendarRoutes.post(
  '/country-templates/apply',
  asyncHandler(async (req, res) => {
    assertTenantOrSuperAdmin(req)
    if (req.user!.role !== UserRole.DIRECTOR && req.user!.role !== UserRole.SUPER_ADMIN) {
      throw forbidden('Seul le Directeur ou Super Admin peut appliquer des templates')
    }
    const { countryCode, year } = req.body as { countryCode: string; year?: number }
    if (!countryCode) throw badRequest('countryCode requis')
    const institutionId = req.institutionId!
    const targetYear = year ?? new Date().getFullYear()
    const templates = await prisma.countryHolidayTemplate.findMany({ where: { countryCode } })
    if (templates.length === 0) throw badRequest(`Aucun template pour le pays ${countryCode}`)
    const created = await Promise.all(
      templates.map((t) => {
        const startsAt = new Date(targetYear, t.startMonth - 1, t.startDay)
        const endsAt = new Date(
          t.endMonth < t.startMonth ? targetYear + 1 : targetYear,
          t.endMonth - 1,
          t.endDay,
          23, 59, 59
        )
        const durationDays = Math.max(1, Math.round((endsAt.getTime() - startsAt.getTime()) / 86400000) + 1)
        return prisma.holidayLeave.create({
          data: {
            institutionId,
            title: t.title,
            type: t.type,
            description: t.description,
            startsAt,
            endsAt,
            durationDays,
            color: t.color,
            status: CalendarItemStatus.DRAFT,
            isSystemProposed: true,
            createdById: req.user!.id
          }
        })
      })
    )
    res.status(201).json({ count: created.length, holidays: created })
  })
)
