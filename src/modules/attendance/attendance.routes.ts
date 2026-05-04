import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { AttendanceStatus, JustifStatus, UserRole } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { badRequest, forbidden, notFound } from '../../lib/errors'
import { authenticate } from '../../middlewares/auth'
import { requireRoles, requireTenantUser } from '../../middlewares/rbac'
import { validate } from '../../middlewares/validate'
import { notifyAbsence } from '../../lib/notifications'
import { getPlatformBranding } from '../../lib/platform-branding'
import { getParentScope } from '../../lib/parent-access'

export const attendanceRoutes = Router()
attendanceRoutes.use(authenticate, requireTenantUser)

const teacherPresenceAdminRoles = [UserRole.DIRECTOR, UserRole.ADMINISTRATION] as const

const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

function dayRange(value: Date | string) {
  const date = value instanceof Date ? new Date(value) : new Date(value)
  if (Number.isNaN(date.getTime())) throw badRequest('Date invalide')
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end, date: start }
}

function csvValue(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function sendCsv(res: Response, filename: string, rows: unknown[][]) {
  const content = rows.map((row) => row.map(csvValue).join(',')).join('\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(`﻿${content}`)
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('fr-FR')
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('fr-FR')
}

async function teacherProfile(userId: string, institutionId: string) {
  return prisma.teacher.findFirst({ where: { userId, institutionId } })
}

async function teacherClassroomIds(userId: string, institutionId: string) {
  const teacher = await teacherProfile(userId, institutionId)
  if (!teacher) throw forbidden('Profil professeur introuvable')
  const assignments = await prisma.teacherAssignment.findMany({
    where: { institutionId, teacherId: teacher.id },
    select: { classroomId: true }
  })
  return { teacher, classroomIds: assignments.map((assignment) => assignment.classroomId) }
}

async function studentAttendanceWhere(req: Request) {
  const { start, end } = req.query.date ? dayRange(String(req.query.date)) : { start: undefined, end: undefined }
  const classroomId = req.query.classroomId ? String(req.query.classroomId) : undefined
  const scheduleSlotId = req.query.scheduleSlotId ? String(req.query.scheduleSlotId) : undefined
  let classroomFilter: string | { in: string[] } | undefined = classroomId

  if (req.user!.role === UserRole.TEACHER) {
    const { classroomIds } = await teacherClassroomIds(req.user!.id, req.institutionId!)
    if (classroomId && !classroomIds.includes(classroomId)) {
      throw forbidden('Vous ne pouvez consulter que vos classes')
    }
    classroomFilter = classroomId ?? { in: classroomIds }
  }

  return {
    institutionId: req.institutionId!,
    session: {
      ...(scheduleSlotId ? { scheduleSlotId } : { classroomId: classroomFilter }),
      date: start && end ? { gte: start, lt: end } : undefined
    },
    student: req.query.search
      ? {
          OR: [
            { firstName: { contains: String(req.query.search), mode: 'insensitive' as const } },
            { lastName: { contains: String(req.query.search), mode: 'insensitive' as const } },
            { matricule: { contains: String(req.query.search), mode: 'insensitive' as const } }
          ]
        }
      : undefined
  }
}

// Returns schedule slots for a given date with attendance status
attendanceRoutes.get(
  '/slots',
  asyncHandler(async (req, res) => {
    const institutionId = req.institutionId!
    const dateStr = req.query.date ? String(req.query.date) : new Date().toISOString().split('T')[0]
    const { start, end } = dayRange(dateStr)
    const dayOfWeek = new Date(dateStr).getDay()

    let teacherIdFilter: string | undefined
    if (req.user!.role === UserRole.TEACHER) {
      const teacher = await teacherProfile(req.user!.id, institutionId)
      if (!teacher) throw forbidden('Profil professeur introuvable')
      teacherIdFilter = teacher.id
    }

    const slots = await prisma.scheduleSlot.findMany({
      where: {
        institutionId,
        dayOfWeek,
        ...(teacherIdFilter ? { teacherId: teacherIdFilter } : {})
      },
      include: {
        classroom: true,
        teacher: true,
        subject: true,
        attendanceSessions: {
          where: { date: { gte: start, lt: end } },
          select: {
            id: true,
            records: { select: { studentId: true, status: true } }
          }
        }
      },
      orderBy: { startsAt: 'asc' }
    })

    res.json({ slots, date: dateStr })
  })
)

attendanceRoutes.post(
  '/student-sessions',
  requireRoles(UserRole.TEACHER, UserRole.DIRECTOR, UserRole.ADMINISTRATION),
  validate(
    z.object({
      body: z.object({
        scheduleSlotId: z.string(),
        date: z.coerce.date().default(() => new Date()),
        note: z.string().optional(),
        records: z.array(
          z.object({
            studentId: z.string(),
            status: z.nativeEnum(AttendanceStatus),
            reason: z.string().optional()
          })
        )
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const institutionId = req.institutionId!
    const scheduleSlotId = req.body.scheduleSlotId

    const slot = await prisma.scheduleSlot.findFirst({
      where: { id: scheduleSlotId, institutionId }
    })
    if (!slot) throw badRequest("Créneau d'emploi du temps introuvable")

    const { start, end, date } = dayRange(req.body.date)

    const dateDayOfWeek = date.getDay()
    if (slot.dayOfWeek !== dateDayOfWeek) {
      throw badRequest(
        `Ce créneau est prévu le ${DAY_NAMES[slot.dayOfWeek]}, pas le ${DAY_NAMES[dateDayOfWeek]}`
      )
    }

    let teacherId: string | undefined
    if (req.user!.role === UserRole.TEACHER) {
      const teacher = await teacherProfile(req.user!.id, institutionId)
      if (!teacher) throw forbidden('Profil professeur introuvable')
      if (slot.teacherId && slot.teacherId !== teacher.id) {
        throw forbidden("Ce créneau ne vous est pas assigné")
      }
      teacherId = teacher.id
    }

    const classroomId = slot.classroomId

    const session = await prisma.$transaction(async (tx) => {
      const sessions = await tx.attendanceSession.findMany({
        where: { institutionId, classroomId, scheduleSlotId, date: { gte: start, lt: end } },
        orderBy: { createdAt: 'desc' }
      })
      const records = req.body.records.map((record: { studentId: string; status: AttendanceStatus; reason?: string }) => ({
        institutionId,
        studentId: record.studentId,
        status: record.status,
        reason: record.reason
      }))

      if (sessions.length === 0) {
        return tx.attendanceSession.create({
          data: {
            institutionId,
            classroomId,
            teacherId,
            scheduleSlotId,
            date,
            note: req.body.note,
            records: { create: records }
          },
          include: { classroom: true, records: true }
        })
      }

      const [activeSession, ...duplicates] = sessions
      await tx.studentAttendance.deleteMany({ where: { sessionId: { in: sessions.map((s) => s.id) } } })
      if (duplicates.length > 0) {
        await tx.attendanceSession.deleteMany({ where: { id: { in: duplicates.map((s) => s.id) } } })
      }
      return tx.attendanceSession.update({
        where: { id: activeSession.id },
        data: {
          teacherId,
          scheduleSlotId,
          note: req.body.note,
          records: { create: records }
        },
        include: { classroom: true, records: true }
      })
    })

    const absentRecords = (session.records ?? []).filter(
      (r: { status: AttendanceStatus }) => r.status === AttendanceStatus.ABSENT
    )
    if (absentRecords.length > 0) {
      const branding = await getPlatformBranding()
      const dateStr = date.toLocaleDateString('fr-FR')
      const className = (session as { classroom?: { name?: string } }).classroom?.name ?? ''
      for (const rec of absentRecords as Array<{ studentId: string }>) {
        const student = await prisma.student.findUnique({ where: { id: rec.studentId } })
        if (!student) continue
        const parentLinks = await prisma.studentParent.findMany({
          where: { studentId: student.id },
          include: { parent: { select: { phone: true, userId: true } } }
        })
        for (const link of parentLinks) {
          notifyAbsence({
            institutionId,
            studentName: `${student.firstName} ${student.lastName}`,
            className,
            date: dateStr,
            parentUserId: link.parent.userId ?? undefined,
            parentPhone: link.parent.phone,
            appName: branding.appName
          }).catch(() => {})
        }
      }
    }

    res.status(201).json({ session })
  })
)

attendanceRoutes.get(
  '/students',
  asyncHandler(async (req, res) => {
    const records = await prisma.studentAttendance.findMany({
      where: await studentAttendanceWhere(req),
      include: { student: { include: { classroom: true } }, session: { include: { classroom: true, teacher: true } } },
      orderBy: { createdAt: 'desc' }
    })
    res.json({ records })
  })
)

attendanceRoutes.get(
  '/students/export',
  asyncHandler(async (req, res) => {
    const records = await prisma.studentAttendance.findMany({
      where: await studentAttendanceWhere(req),
      include: { student: { include: { classroom: true } }, session: { include: { classroom: true, teacher: true } } },
      orderBy: { createdAt: 'desc' }
    })
    sendCsv(res, `presence-eleves-${String(req.query.date ?? 'export')}.csv`, [
      ['Date', 'Classe', 'Matricule', 'Nom', 'Prénoms', 'Statut', 'Motif', 'Professeur'],
      ...records.map((record) => [
        formatDate(record.session.date),
        record.session.classroom.name,
        record.student.matricule,
        record.student.lastName,
        record.student.firstName,
        record.status,
        record.reason ?? '',
        record.session.teacher ? `${record.session.teacher.firstName} ${record.session.teacher.lastName}` : ''
      ])
    ])
  })
)

attendanceRoutes.get(
  '/teachers/me',
  requireRoles(UserRole.TEACHER),
  asyncHandler(async (req, res) => {
    const teacher = await teacherProfile(req.user!.id, req.institutionId!)
    if (!teacher) throw forbidden('Profil professeur introuvable')
    const { start, end } = req.query.date ? dayRange(String(req.query.date)) : { start: undefined, end: undefined }
    const records = await prisma.teacherAttendance.findMany({
      where: {
        institutionId: req.institutionId!,
        teacherId: teacher.id,
        status: req.query.status ? String(req.query.status) as AttendanceStatus : undefined,
        date: start && end ? { gte: start, lt: end } : undefined
      },
      include: { teacher: true },
      orderBy: { date: 'desc' }
    })
    res.json({ records })
  })
)

attendanceRoutes.post(
  '/teachers/me/justify',
  requireRoles(UserRole.TEACHER),
  validate(
    z.object({
      body: z.object({
        date: z.coerce.date(),
        status: z.nativeEnum(AttendanceStatus).default(AttendanceStatus.EXCUSED),
        reason: z.string().min(3),
        attachmentUrl: z.string().optional()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const teacher = await teacherProfile(req.user!.id, req.institutionId!)
    if (!teacher) throw forbidden('Profil professeur introuvable')
    const { start, end, date } = dayRange(req.body.date)
    const attendance = await prisma.$transaction(async (tx) => {
      const existing = await tx.teacherAttendance.findFirst({
        where: { institutionId: req.institutionId!, teacherId: teacher.id, date: { gte: start, lt: end } }
      })
      if (existing) {
        return tx.teacherAttendance.update({
          where: { id: existing.id },
          data: {
            status: req.body.status,
            reason: req.body.reason,
            attachmentUrl: req.body.attachmentUrl
          }
        })
      }
      return tx.teacherAttendance.create({
        data: {
          institutionId: req.institutionId!,
          teacherId: teacher.id,
          date,
          status: req.body.status,
          reason: req.body.reason,
          attachmentUrl: req.body.attachmentUrl
        }
      })
    })
    res.status(201).json({ attendance })
  })
)

attendanceRoutes.get(
  '/teachers/export',
  requireRoles(UserRole.TEACHER, ...teacherPresenceAdminRoles),
  asyncHandler(async (req, res) => {
    const { start, end } = req.query.date ? dayRange(String(req.query.date)) : { start: undefined, end: undefined }
    let teacherId = req.query.teacherId ? String(req.query.teacherId) : undefined
    if (req.user!.role === UserRole.TEACHER) {
      const teacher = await teacherProfile(req.user!.id, req.institutionId!)
      if (!teacher) throw forbidden('Profil professeur introuvable')
      teacherId = teacher.id
    }
    const records = await prisma.teacherAttendance.findMany({
      where: {
        institutionId: req.institutionId!,
        teacherId,
        status: req.query.status ? String(req.query.status) as AttendanceStatus : undefined,
        date: start && end ? { gte: start, lt: end } : undefined
      },
      include: { teacher: true },
      orderBy: { date: 'desc' }
    })
    sendCsv(res, `presence-profs-${String(req.query.date ?? 'export')}.csv`, [
      ['Date', 'Matricule', 'Professeur', 'Statut', 'Heure arrivée', 'Motif', 'Pénalité'],
      ...records.map((record) => [
        formatDate(record.date),
        record.teacher.matricule,
        `${record.teacher.firstName} ${record.teacher.lastName}`,
        record.status,
        formatDateTime(record.checkInAt),
        record.reason ?? '',
        record.penaltyAmount
      ])
    ])
  })
)

attendanceRoutes.get(
  '/teachers',
  requireRoles(...teacherPresenceAdminRoles),
  asyncHandler(async (req, res) => {
    const { start, end } = req.query.date ? dayRange(String(req.query.date)) : { start: undefined, end: undefined }
    const records = await prisma.teacherAttendance.findMany({
      where: {
        institutionId: req.institutionId!,
        teacherId: req.query.teacherId ? String(req.query.teacherId) : undefined,
        status: req.query.status ? String(req.query.status) as AttendanceStatus : undefined,
        date: start && end ? { gte: start, lt: end } : undefined
      },
      include: { teacher: true },
      orderBy: { date: 'desc' }
    })
    res.json({ records })
  })
)

attendanceRoutes.post(
  '/teachers',
  requireRoles(...teacherPresenceAdminRoles),
  validate(
    z.object({
      body: z.object({
        teacherId: z.string(),
        date: z.coerce.date().default(() => new Date()),
        status: z.nativeEnum(AttendanceStatus),
        checkInAt: z.coerce.date().optional(),
        reason: z.string().optional(),
        penaltyAmount: z.number().int().nonnegative().optional()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const teacher = await prisma.teacher.findFirst({ where: { id: req.body.teacherId, institutionId: req.institutionId! } })
    if (!teacher) throw badRequest('Professeur introuvable')
    const { start, end, date } = dayRange(req.body.date)
    const attendance = await prisma.$transaction(async (tx) => {
      const existing = await tx.teacherAttendance.findFirst({
        where: { institutionId: req.institutionId!, teacherId: teacher.id, date: { gte: start, lt: end } }
      })
      const payload = {
        status: req.body.status,
        checkInAt: req.body.checkInAt,
        reason: req.body.reason,
        penaltyAmount: req.body.penaltyAmount ?? 0
      }
      if (existing) {
        return tx.teacherAttendance.update({ where: { id: existing.id }, data: payload, include: { teacher: true } })
      }
      return tx.teacherAttendance.create({
        data: {
          institutionId: req.institutionId!,
          teacherId: teacher.id,
          date,
          ...payload
        },
        include: { teacher: true }
      })
    })
    res.status(201).json({ attendance })
  })
)

// ── Absence Justifications ─────────────────────────────────────────────────

attendanceRoutes.post(
  '/justifications',
  requireRoles(UserRole.PARENT),
  validate(
    z.object({
      body: z.object({
        attendanceId: z.string(),
        reason: z.string().min(3),
        attachmentUrl: z.string().url().optional()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const scope = await getParentScope(req.institutionId!, req.user!.id)
    if (!scope.parent) throw forbidden('Profil parent introuvable')

    const record = await prisma.studentAttendance.findFirst({
      where: {
        id: req.body.attendanceId,
        institutionId: req.institutionId!,
        studentId: { in: scope.studentIds }
      }
    })
    if (!record) throw notFound('Absence introuvable ou non liée à vos enfants')
    if (record.status !== AttendanceStatus.ABSENT && record.status !== AttendanceStatus.LATE) {
      throw badRequest("Seules les absences ou retards peuvent être justifiés")
    }

    const existing = await prisma.absenceJustification.findUnique({
      where: { attendanceId: req.body.attendanceId }
    })
    if (existing) throw badRequest('Une justification existe déjà pour cette absence')

    const justification = await prisma.absenceJustification.create({
      data: {
        institutionId: req.institutionId!,
        attendanceId: req.body.attendanceId,
        submittedBy: req.user!.id,
        reason: req.body.reason,
        attachmentUrl: req.body.attachmentUrl,
        status: JustifStatus.PENDING
      },
      include: {
        attendance: {
          include: {
            student: { select: { firstName: true, lastName: true, matricule: true } },
            session: { select: { date: true, classroom: { select: { name: true } } } }
          }
        }
      }
    })
    res.status(201).json({ justification })
  })
)

attendanceRoutes.get(
  '/justifications',
  requireRoles(UserRole.DIRECTOR, UserRole.ADMINISTRATION, UserRole.SECRETARIAT, UserRole.PARENT),
  asyncHandler(async (req, res) => {
    const statusFilter = req.query.status ? (String(req.query.status) as JustifStatus) : undefined

    if (req.user!.role === UserRole.PARENT) {
      const scope = await getParentScope(req.institutionId!, req.user!.id)
      if (!scope.parent) throw forbidden('Profil parent introuvable')
      const justifications = await prisma.absenceJustification.findMany({
        where: {
          institutionId: req.institutionId!,
          status: statusFilter,
          attendance: { studentId: { in: scope.studentIds } }
        },
        include: {
          attendance: {
            include: {
              student: { select: { firstName: true, lastName: true, matricule: true } },
              session: { select: { date: true, classroom: { select: { name: true } } } }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
      return res.json({ justifications })
    }

    const justifications = await prisma.absenceJustification.findMany({
      where: {
        institutionId: req.institutionId!,
        status: statusFilter
      },
      include: {
        attendance: {
          include: {
            student: { select: { firstName: true, lastName: true, matricule: true } },
            session: { select: { date: true, classroom: { select: { name: true } } } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    res.json({ justifications })
  })
)

attendanceRoutes.patch(
  '/justifications/:id',
  requireRoles(UserRole.DIRECTOR, UserRole.ADMINISTRATION, UserRole.SECRETARIAT),
  validate(
    z.object({
      params: z.object({ id: z.string() }),
      body: z.object({
        status: z.enum([JustifStatus.APPROVED, JustifStatus.REJECTED]),
        reviewNote: z.string().optional()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const existing = await prisma.absenceJustification.findFirst({
      where: { id: req.params.id, institutionId: req.institutionId! }
    })
    if (!existing) throw notFound('Justification introuvable')
    if (existing.status !== JustifStatus.PENDING) throw badRequest('Justification déjà traitée')

    const justification = await prisma.$transaction(async (tx) => {
      const updated = await tx.absenceJustification.update({
        where: { id: req.params.id },
        data: {
          status: req.body.status,
          reviewedBy: req.user!.id,
          reviewedAt: new Date(),
          reviewNote: req.body.reviewNote
        },
        include: {
          attendance: {
            include: {
              student: { select: { firstName: true, lastName: true, matricule: true } },
              session: { select: { date: true, classroom: { select: { name: true } } } }
            }
          }
        }
      })
      if (req.body.status === JustifStatus.APPROVED) {
        await tx.studentAttendance.update({
          where: { id: existing.attendanceId },
          data: { status: AttendanceStatus.EXCUSED }
        })
      }
      return updated
    })
    res.json({ justification })
  })
)
