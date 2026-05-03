import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { AttendanceStatus, UserRole } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { badRequest, forbidden } from '../../lib/errors'
import { authenticate } from '../../middlewares/auth'
import { requireRoles, requireTenantUser } from '../../middlewares/rbac'
import { validate } from '../../middlewares/validate'

export const attendanceRoutes = Router()
attendanceRoutes.use(authenticate, requireTenantUser)

const teacherPresenceAdminRoles = [UserRole.DIRECTOR, UserRole.ADMINISTRATION] as const

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
  res.send(`\uFEFF${content}`)
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

async function assertTeacherClassroomAccess(req: Request, classroomId: string) {
  if (req.user!.role !== UserRole.TEACHER) return undefined
  const { teacher, classroomIds } = await teacherClassroomIds(req.user!.id, req.institutionId!)
  if (!classroomIds.includes(classroomId)) throw forbidden('Vous pouvez faire l’appel uniquement dans vos classes')
  return teacher.id
}

async function studentAttendanceWhere(req: Request) {
  const { start, end } = req.query.date ? dayRange(String(req.query.date)) : { start: undefined, end: undefined }
  const classroomId = req.query.classroomId ? String(req.query.classroomId) : undefined
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
      classroomId: classroomFilter,
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

attendanceRoutes.post(
  '/student-sessions',
  requireRoles(UserRole.TEACHER, UserRole.DIRECTOR, UserRole.ADMINISTRATION),
  validate(
    z.object({
      body: z.object({
        classroomId: z.string(),
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
    const teacherId = await assertTeacherClassroomAccess(req, req.body.classroomId)
    const { start, end, date } = dayRange(req.body.date)
    const session = await prisma.$transaction(async (tx) => {
      const sessions = await tx.attendanceSession.findMany({
        where: {
          institutionId: req.institutionId!,
          classroomId: req.body.classroomId,
          date: { gte: start, lt: end }
        },
        orderBy: { createdAt: 'desc' }
      })
      const records = req.body.records.map((record: { studentId: string; status: AttendanceStatus; reason?: string }) => ({
        institutionId: req.institutionId!,
        studentId: record.studentId,
        status: record.status,
        reason: record.reason
      }))

      if (sessions.length === 0) {
        return tx.attendanceSession.create({
          data: {
            institutionId: req.institutionId!,
            classroomId: req.body.classroomId,
            teacherId,
            date,
            note: req.body.note,
            records: { create: records }
          },
          include: { classroom: true, records: true }
        })
      }

      const [activeSession, ...duplicates] = sessions
      await tx.studentAttendance.deleteMany({ where: { sessionId: { in: sessions.map((item) => item.id) } } })
      if (duplicates.length > 0) {
        await tx.attendanceSession.deleteMany({ where: { id: { in: duplicates.map((item) => item.id) } } })
      }
      return tx.attendanceSession.update({
        where: { id: activeSession.id },
        data: {
          teacherId,
          date,
          note: req.body.note,
          records: { create: records }
        },
        include: { classroom: true, records: true }
      })
    })
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
