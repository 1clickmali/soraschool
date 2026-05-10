import { Router } from 'express'
import QRCode from 'qrcode'
import { z } from 'zod'
import {
  ContractType,
  StaffAttendanceMethod,
  StaffAttendanceStatus,
  StaffContractStatus,
  StaffJustificationStatus,
  StaffPenaltyStatus,
  StaffPosition,
  StaffSalaryAdjustmentKind,
  StaffTabletLinkStatus,
  Prisma,
  TeacherStatus,
  UserRole
} from '@prisma/client'
import { prisma } from '../../config/prisma'
import { env } from '../../config/env'
import { asyncHandler } from '../../lib/async'
import { badRequest, forbidden, notFound } from '../../lib/errors'
import { authenticate } from '../../middlewares/auth'
import { requireRoles, requireTenantUser } from '../../middlewares/rbac'
import { validate } from '../../middlewares/validate'
import {
  buildStaffQrPayload,
  createStaffMember,
  dayKey,
  dayStart,
  expectedWindowForStaff,
  getStaffAttendanceSettings,
  salarySnapshot,
  scanStaffAttendance,
  secureToken,
  syncTeacherStaffForInstitution,
  tokenHash
} from './staff.service'
import {
  addFooterToBufferedPages,
  createProfessionalPdf,
  drawInfoRows,
  drawProfessionalHeader,
  drawSignatureBlock,
  safePdfFileName
} from '../pdf/pdf-layout'

export const staffRoutes = Router()
staffRoutes.use(authenticate, requireTenantUser)

const directorOnly = [UserRole.DIRECTOR] as const
const managementRoles = [UserRole.DIRECTOR, UserRole.CENTRAL_ADMIN, UserRole.ADMINISTRATION] as const
const payrollRoles = [UserRole.DIRECTOR, UserRole.ACCOUNTANT] as const
const manualScanRoles = new Set<UserRole>([UserRole.DIRECTOR, UserRole.CENTRAL_ADMIN, UserRole.ADMINISTRATION])

const staffCreateSchema = z.object({
  body: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    address: z.string().optional(),
    photoUrl: z.string().optional(),
    position: z.nativeEnum(StaffPosition),
    customPosition: z.string().optional(),
    baseSalary: z.number().int().nonnegative().optional(),
    hireDate: z.coerce.date().optional(),
    contractType: z.nativeEnum(ContractType).optional(),
    permissions: z.record(z.boolean()).optional(),
    roleTemplateId: z.string().optional(),
    createAccess: z.boolean().optional()
  })
})

const settingsSchema = z.object({
  body: z.object({
    defaultCheckInTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    defaultCheckOutTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    lateToleranceMinutes: z.number().int().min(0).max(180).optional(),
    earlyDepartureToleranceMinutes: z.number().int().min(0).max(180).optional(),
    latePenaltyAmount: z.number().int().min(0).optional(),
    absencePenaltyAmount: z.number().int().min(0).optional(),
    justificationDeadlineHours: z.number().int().min(1).max(720).optional(),
    autoApplyPenalties: z.boolean().optional(),
    policy: z.record(z.unknown()).optional()
  })
})

function unwrapNestedBody(value: unknown) {
  if (value && typeof value === 'object' && 'body' in value) {
    const candidate = value as { body?: unknown }
    if (candidate.body && typeof candidate.body === 'object') return candidate.body
  }
  return value
}

const staffContractCreateSchema = z.object({
  body: z.preprocess(unwrapNestedBody, z.object({
    staffId: z.string(),
    title: z.string().optional(),
    salary: z.number().int().nonnegative().optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date().optional(),
    scheduleText: z.string().optional(),
    generalClauses: z.string().min(10),
    specificClauses: z.string().optional(),
    penaltyClauses: z.string().optional(),
    obligations: z.string().optional(),
    status: z.nativeEnum(StaffContractStatus).optional()
  }))
})

function currentStaffWhere(req: { user?: { id: string }; institutionId?: string }) {
  return { institutionId: req.institutionId!, userId: req.user!.id }
}

async function notifyDirectors(institutionId: string, title: string, body: string, data: Record<string, unknown>) {
  const directors = await prisma.user.findMany({
    where: { institutionId, isActive: true, role: { in: [UserRole.DIRECTOR, UserRole.CENTRAL_ADMIN] } },
    select: { id: true }
  })
  if (!directors.length) return
  await prisma.notification.createMany({
    data: directors.map((director) => ({
      institutionId,
      userId: director.id,
      level: 'WARNING',
      title,
      body,
      data: data as Prisma.InputJsonValue
    }))
  }).catch(() => undefined)
}

function collectPdf(doc: PDFKit.PDFDocument) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.end()
  })
}

async function staffQrResponse(staff: { id: string; institutionId: string; qrTokenVersion: number; qrActive: boolean }) {
  const qrPayload = buildStaffQrPayload(staff)
  const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 260 })
  return { qrPayload, qrDataUrl }
}

staffRoutes.get(
  '/settings',
  requireRoles(...managementRoles, UserRole.SECRETARIAT),
  asyncHandler(async (req, res) => {
    const settings = await getStaffAttendanceSettings(req.institutionId!)
    res.json({ settings })
  })
)

staffRoutes.patch(
  '/settings',
  requireRoles(...directorOnly),
  validate(settingsSchema),
  asyncHandler(async (req, res) => {
    const before = await getStaffAttendanceSettings(req.institutionId!)
    const settings = await prisma.staffAttendanceSetting.update({
      where: { institutionId: req.institutionId! },
      data: { ...req.body, updatedById: req.user!.id }
    })
    await prisma.auditLog.create({
      data: {
        institutionId: req.institutionId!,
        actorId: req.user!.id,
        action: 'STAFF_ATTENDANCE_SETTINGS_UPDATED',
        entity: 'StaffAttendanceSetting',
        entityId: settings.id,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        metadata: { before, after: settings, idempotencyKey: req.get('Idempotency-Key') }
      }
    })
    res.json({ settings })
  })
)

staffRoutes.get(
  '/',
  requireRoles(...managementRoles, UserRole.SECRETARIAT, UserRole.ACCOUNTANT),
  asyncHandler(async (req, res) => {
    await syncTeacherStaffForInstitution(req.institutionId!, req.user!.id)
    const staff = await prisma.staffMember.findMany({
      where: {
        institutionId: req.institutionId!,
        position: req.query.position ? String(req.query.position) as StaffPosition : undefined,
        status: req.query.status ? String(req.query.status) as TeacherStatus : undefined
      },
      include: { user: { select: { id: true, role: true, isActive: true, lastLoginAt: true } }, roleTemplate: true, teacher: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    })
    res.json({ staff })
  })
)

staffRoutes.post(
  '/',
  requireRoles(...directorOnly),
  validate(staffCreateSchema),
  asyncHandler(async (req, res) => {
    const staff = await createStaffMember({
      institutionId: req.institutionId!,
      actorId: req.user!.id,
      ...req.body
    })
    res.status(201).json({ staff, ...(await staffQrResponse(staff)) })
  })
)

staffRoutes.get(
  '/me',
  asyncHandler(async (req, res) => {
    const staff = await prisma.staffMember.findFirst({ where: currentStaffWhere(req), include: { contracts: { orderBy: { createdAt: 'desc' } } } })
    if (!staff && req.user!.role === UserRole.TEACHER) {
      const teacher = await prisma.teacher.findFirst({ where: { institutionId: req.institutionId!, userId: req.user!.id } })
      if (teacher) {
        await syncTeacherStaffForInstitution(req.institutionId!, req.user!.id)
      }
    }
    const resolved = await prisma.staffMember.findFirst({ where: currentStaffWhere(req), include: { contracts: { orderBy: { createdAt: 'desc' } } } })
    if (!resolved) throw notFound('Profil personnel introuvable')
    res.json({ staff: resolved })
  })
)

staffRoutes.get(
  '/me/salary',
  asyncHandler(async (req, res) => {
    const staff = await prisma.staffMember.findFirst({ where: currentStaffWhere(req) })
    if (!staff) throw notFound('Profil personnel introuvable')
    res.json(await salarySnapshot(req.institutionId!, staff.id))
  })
)

staffRoutes.get(
  '/me/qr',
  asyncHandler(async (req, res) => {
    const staff = await prisma.staffMember.findFirst({ where: currentStaffWhere(req) })
    if (!staff) throw notFound('Profil personnel introuvable')
    res.json({ staff, ...(await staffQrResponse(staff)) })
  })
)

staffRoutes.get(
  '/:id/qr',
  requireRoles(...managementRoles),
  asyncHandler(async (req, res) => {
    const staff = await prisma.staffMember.findFirst({ where: { id: req.params.id, institutionId: req.institutionId! } })
    if (!staff) throw notFound('Personnel introuvable')
    res.json({ staff, ...(await staffQrResponse(staff)) })
  })
)

staffRoutes.post(
  '/:id/regenerate-qr',
  requireRoles(...directorOnly),
  asyncHandler(async (req, res) => {
    const staff = await prisma.staffMember.findFirst({ where: { id: req.params.id, institutionId: req.institutionId! } })
    if (!staff) throw notFound('Personnel introuvable')
    const updated = await prisma.staffMember.update({
      where: { id: staff.id },
      data: { qrTokenVersion: { increment: 1 }, qrActive: true, qrGeneratedAt: new Date() }
    })
    await prisma.auditLog.create({
      data: {
        institutionId: req.institutionId!,
        actorId: req.user!.id,
        action: 'STAFF_QR_REGENERATED',
        entity: 'StaffMember',
        entityId: staff.id,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        metadata: { previousVersion: staff.qrTokenVersion, nextVersion: updated.qrTokenVersion, idempotencyKey: req.get('Idempotency-Key') }
      }
    })
    res.json({ staff: updated, ...(await staffQrResponse(updated)) })
  })
)

staffRoutes.post(
  '/attendance/scan',
  asyncHandler(async (req, res) => {
    let staffId: string | undefined
    if (req.user!.role === UserRole.TEACHER) {
      staffId = (await prisma.staffMember.findFirst({ where: currentStaffWhere(req), select: { id: true } }))?.id
    } else {
      if (!manualScanRoles.has(req.user!.role)) throw forbidden('Seule la Direction peut corriger ou valider un pointage manuel')
      staffId = String(req.body.staffId ?? '')
    }
    if (!staffId) throw badRequest('Personnel requis')
    const result = await scanStaffAttendance({
      institutionId: req.institutionId!,
      staffId,
      method: req.user!.role === UserRole.TEACHER ? StaffAttendanceMethod.QR_CODE : StaffAttendanceMethod.MANUAL_DIRECTOR,
      actorId: req.user!.id,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      idempotencyKey: req.get('Idempotency-Key') ?? undefined,
      noScheduleReason: typeof req.body.noScheduleReason === 'string' ? req.body.noScheduleReason : undefined
    })
    if (result.result === 'LATE') {
      await notifyDirectors(req.institutionId!, 'Personnel en retard', `${result.staff.firstName} ${result.staff.lastName} est en retard.`, { attendanceId: result.attendance.id })
    }
    res.status(201).json(result)
  })
)

staffRoutes.get(
  '/attendance/me',
  asyncHandler(async (req, res) => {
    const staff = await prisma.staffMember.findFirst({ where: currentStaffWhere(req) })
    if (!staff) throw notFound('Profil personnel introuvable')
    const records = await prisma.staffAttendance.findMany({
      where: { institutionId: req.institutionId!, staffId: staff.id },
      include: { penalties: true, justification: true },
      orderBy: { date: 'desc' },
      take: 90
    })
    res.json({ records })
  })
)

staffRoutes.get(
  '/attendance',
  requireRoles(...managementRoles, UserRole.SECRETARIAT, UserRole.ACCOUNTANT),
  asyncHandler(async (req, res) => {
    const records = await prisma.staffAttendance.findMany({
      where: {
        institutionId: req.institutionId!,
        staffId: req.query.staffId ? String(req.query.staffId) : undefined,
        status: req.query.status ? String(req.query.status) as StaffAttendanceStatus : undefined
      },
      include: { staff: true, penalties: true, justification: true },
      orderBy: [{ date: 'desc' }, { actualCheckInAt: 'desc' }],
      take: 300
    })
    res.json({ records })
  })
)

staffRoutes.post(
  '/attendance/detect-absences',
  requireRoles(...directorOnly),
  asyncHandler(async (req, res) => {
    const now = new Date()
    const staff = await prisma.staffMember.findMany({ where: { institutionId: req.institutionId!, status: TeacherStatus.ACTIVE } })
    const created = []
    for (const member of staff) {
      const expected = await expectedWindowForStaff(member, now)
      if (member.teacherId && !expected.hasSchedule) continue
      if (now < expected.checkIn) continue
      const attendanceKey = `${member.id}:${dayKey(now)}:${expected.scheduleSlotId ?? 'daily'}`
      const existing = await prisma.staffAttendance.findUnique({ where: { institutionId_attendanceKey: { institutionId: req.institutionId!, attendanceKey } } })
      if (existing) continue
      const attendance = await prisma.staffAttendance.create({
        data: {
          institutionId: req.institutionId!,
          staffId: member.id,
          attendanceKey,
          date: dayStart(now),
          expectedCheckInAt: expected.checkIn,
          expectedCheckOutAt: expected.checkOut,
          scheduleSlotId: expected.scheduleSlotId,
          status: StaffAttendanceStatus.ABSENT,
          method: StaffAttendanceMethod.SYSTEM_DETECTION,
          penaltyAmount: expected.settings.absencePenaltyAmount,
          penaltyApplied: expected.settings.autoApplyPenalties
        }
      })
      await prisma.staffPenalty.upsert({
        where: { institutionId_eventType_eventId: { institutionId: req.institutionId!, eventType: 'STAFF_ATTENDANCE', eventId: attendance.id } },
        update: {},
        create: {
          institutionId: req.institutionId!,
          staffId: member.id,
          attendanceId: attendance.id,
          eventType: 'STAFF_ATTENDANCE',
          eventId: attendance.id,
          amount: expected.settings.absencePenaltyAmount,
          reason: 'Absence non justifiée',
          status: expected.settings.autoApplyPenalties ? StaffPenaltyStatus.APPLIED : StaffPenaltyStatus.PENDING,
          appliedAt: expected.settings.autoApplyPenalties ? new Date() : undefined
        }
      })
      created.push(attendance)
    }
    await prisma.auditLog.create({
      data: {
        institutionId: req.institutionId!,
        actorId: req.user!.id,
        action: 'STAFF_ABSENCE_DETECTION_RUN',
        entity: 'StaffAttendance',
        ip: req.ip,
        userAgent: req.get('user-agent'),
        metadata: { created: created.length, idempotencyKey: req.get('Idempotency-Key') }
      }
    })
    res.status(201).json({ created })
  })
)

staffRoutes.get(
  '/justifications/me',
  asyncHandler(async (req, res) => {
    const staff = await prisma.staffMember.findFirst({ where: currentStaffWhere(req) })
    if (!staff) throw notFound('Profil personnel introuvable')
    const justifications = await prisma.staffJustification.findMany({
      where: { institutionId: req.institutionId!, staffId: staff.id },
      include: { attendance: true },
      orderBy: { createdAt: 'desc' }
    })
    res.json({ justifications })
  })
)

staffRoutes.post(
  '/justifications',
  validate(z.object({ body: z.object({ attendanceId: z.string(), reason: z.string().min(3), attachmentUrl: z.string().optional() }) })),
  asyncHandler(async (req, res) => {
    const staff = await prisma.staffMember.findFirst({ where: currentStaffWhere(req) })
    if (!staff) throw notFound('Profil personnel introuvable')
    const attendance = await prisma.staffAttendance.findFirst({ where: { id: req.body.attendanceId, institutionId: req.institutionId!, staffId: staff.id } })
    if (!attendance) throw notFound('Pointage introuvable')
    const justification = await prisma.staffJustification.upsert({
      where: { attendanceId: attendance.id },
      update: { reason: req.body.reason, attachmentUrl: req.body.attachmentUrl, status: StaffJustificationStatus.PENDING, submittedById: req.user!.id },
      create: {
        institutionId: req.institutionId!,
        staffId: staff.id,
        attendanceId: attendance.id,
        reason: req.body.reason,
        attachmentUrl: req.body.attachmentUrl,
        submittedById: req.user!.id
      }
    })
    await prisma.staffAttendance.update({ where: { id: attendance.id }, data: { justificationStatus: StaffJustificationStatus.PENDING } })
    await notifyDirectors(req.institutionId!, 'Justification en attente', `${staff.firstName} ${staff.lastName} a envoyé une justification.`, { justificationId: justification.id })
    res.status(201).json({ justification })
  })
)

staffRoutes.get(
  '/justifications',
  requireRoles(...managementRoles),
  asyncHandler(async (req, res) => {
    const justifications = await prisma.staffJustification.findMany({
      where: { institutionId: req.institutionId!, status: req.query.status ? String(req.query.status) as StaffJustificationStatus : undefined },
      include: { staff: true, attendance: true },
      orderBy: { createdAt: 'desc' }
    })
    res.json({ justifications })
  })
)

staffRoutes.patch(
  '/justifications/:id/review',
  requireRoles(...directorOnly),
  validate(z.object({ body: z.object({ status: z.enum(['ACCEPTED', 'REFUSED', 'NEEDS_MORE_INFO']), directorComment: z.string().optional() }) })),
  asyncHandler(async (req, res) => {
    const existing = await prisma.staffJustification.findFirst({ where: { id: req.params.id, institutionId: req.institutionId! }, include: { staff: true, attendance: true } })
    if (!existing) throw notFound('Justification introuvable')
    const status = req.body.status as StaffJustificationStatus
    const justification = await prisma.$transaction(async (tx) => {
      const updated = await tx.staffJustification.update({
        where: { id: existing.id },
        data: { status, directorComment: req.body.directorComment, reviewedById: req.user!.id, reviewedAt: new Date() }
      })
      if (status === StaffJustificationStatus.ACCEPTED) {
        await tx.staffPenalty.updateMany({ where: { attendanceId: existing.attendanceId }, data: { status: StaffPenaltyStatus.CANCELED, canceledAt: new Date(), validatedById: req.user!.id } })
        await tx.staffAttendance.update({ where: { id: existing.attendanceId }, data: { justificationStatus: status, penaltyApplied: false } })
      } else if (status === StaffJustificationStatus.REFUSED) {
        await tx.staffPenalty.updateMany({ where: { attendanceId: existing.attendanceId }, data: { status: StaffPenaltyStatus.APPLIED, appliedAt: new Date(), validatedById: req.user!.id } })
        await tx.staffAttendance.update({ where: { id: existing.attendanceId }, data: { justificationStatus: status, penaltyApplied: true } })
      } else {
        await tx.staffAttendance.update({ where: { id: existing.attendanceId }, data: { justificationStatus: status } })
      }
      await tx.auditLog.create({
        data: {
          institutionId: req.institutionId!,
          actorId: req.user!.id,
          action: `STAFF_JUSTIFICATION_${status}`,
          entity: 'StaffJustification',
          entityId: existing.id,
          ip: req.ip,
          userAgent: req.get('user-agent'),
          metadata: { staffId: existing.staffId, idempotencyKey: req.get('Idempotency-Key') }
        }
      })
      return updated
    })
    if (existing.staff.userId) {
      await prisma.notification.create({
        data: {
          institutionId: req.institutionId!,
          userId: existing.staff.userId,
          level: status === StaffJustificationStatus.ACCEPTED ? 'SUCCESS' : status === StaffJustificationStatus.REFUSED ? 'WARNING' : 'INFO',
          title: status === StaffJustificationStatus.ACCEPTED ? 'Justification acceptée' : status === StaffJustificationStatus.REFUSED ? 'Justification refusée' : 'Complément demandé',
          body: req.body.directorComment,
          data: { justificationId: existing.id }
        }
      }).catch(() => undefined)
    }
    res.json({ justification })
  })
)

staffRoutes.get(
  '/payroll',
  requireRoles(...payrollRoles),
  asyncHandler(async (req, res) => {
    const staff = await prisma.staffMember.findMany({ where: { institutionId: req.institutionId!, status: TeacherStatus.ACTIVE }, orderBy: [{ lastName: 'asc' }] })
    const snapshots = await Promise.all(staff.map((member) => salarySnapshot(req.institutionId!, member.id)))
    res.json({ payroll: snapshots })
  })
)

staffRoutes.get(
  '/payroll/:staffId',
  requireRoles(...payrollRoles),
  asyncHandler(async (req, res) => {
    res.json(await salarySnapshot(req.institutionId!, req.params.staffId))
  })
)

staffRoutes.post(
  '/salary-adjustments',
  requireRoles(...directorOnly),
  validate(z.object({ body: z.object({ staffId: z.string(), kind: z.nativeEnum(StaffSalaryAdjustmentKind), title: z.string().min(2), amount: z.number().int().positive(), month: z.number().int().min(1).max(12), year: z.number().int().min(2020).max(2100) }) })),
  asyncHandler(async (req, res) => {
    const staff = await prisma.staffMember.findFirst({ where: { id: req.body.staffId, institutionId: req.institutionId! } })
    if (!staff) throw notFound('Personnel introuvable')
    const adjustment = await prisma.staffSalaryAdjustment.create({ data: { institutionId: req.institutionId!, createdById: req.user!.id, ...req.body } })
    await prisma.auditLog.create({ data: { institutionId: req.institutionId!, actorId: req.user!.id, action: 'STAFF_SALARY_ADJUSTMENT_CREATED', entity: 'StaffSalaryAdjustment', entityId: adjustment.id, metadata: { idempotencyKey: req.get('Idempotency-Key') } } })
    res.status(201).json({ adjustment, salary: await salarySnapshot(req.institutionId!, staff.id, new Date(req.body.year, req.body.month - 1, 1)) })
  })
)

staffRoutes.get('/roles', requireRoles(...managementRoles), asyncHandler(async (req, res) => {
  const roles = await prisma.staffRoleTemplate.findMany({ where: { institutionId: req.institutionId! }, orderBy: { name: 'asc' } })
  res.json({ roles })
}))

staffRoutes.post(
  '/roles',
  requireRoles(...directorOnly),
  validate(z.object({ body: z.object({ name: z.string().min(2), description: z.string().optional(), permissions: z.record(z.boolean()) }) })),
  asyncHandler(async (req, res) => {
    const role = await prisma.staffRoleTemplate.create({ data: { institutionId: req.institutionId!, createdById: req.user!.id, ...req.body } })
    await prisma.auditLog.create({ data: { institutionId: req.institutionId!, actorId: req.user!.id, action: 'STAFF_ROLE_CREATED', entity: 'StaffRoleTemplate', entityId: role.id, metadata: { idempotencyKey: req.get('Idempotency-Key') } } })
    res.status(201).json({ role })
  })
)

staffRoutes.patch(
  '/:id/permissions',
  requireRoles(...directorOnly),
  validate(z.object({ body: z.object({ roleTemplateId: z.string().nullable().optional(), permissions: z.record(z.boolean()).optional(), systemRole: z.nativeEnum(UserRole).nullable().optional(), isActive: z.boolean().optional() }) })),
  asyncHandler(async (req, res) => {
    const staff = await prisma.staffMember.findFirst({ where: { id: req.params.id, institutionId: req.institutionId! } })
    if (!staff) throw notFound('Personnel introuvable')
    if (req.body.systemRole === UserRole.SUPER_ADMIN || req.body.systemRole === UserRole.DIRECTOR) throw forbidden('Rôle non assignable au personnel')
    const updated = await prisma.staffMember.update({
      where: { id: staff.id },
      data: {
        roleTemplateId: req.body.roleTemplateId,
        permissions: req.body.permissions,
        systemRole: req.body.systemRole,
        status: req.body.isActive === false ? TeacherStatus.SUSPENDED : req.body.isActive === true ? TeacherStatus.ACTIVE : undefined
      }
    })
    if (staff.userId && req.body.systemRole) {
      await prisma.user.update({ where: { id: staff.userId }, data: { role: req.body.systemRole, isActive: req.body.isActive ?? true } })
    }
    await prisma.auditLog.create({ data: { institutionId: req.institutionId!, actorId: req.user!.id, action: 'STAFF_PERMISSIONS_UPDATED', entity: 'StaffMember', entityId: staff.id, ip: req.ip, userAgent: req.get('user-agent'), metadata: { before: staff, after: updated, idempotencyKey: req.get('Idempotency-Key') } } })
    res.json({ staff: updated })
  })
)

staffRoutes.get('/contracts', requireRoles(...managementRoles, UserRole.ACCOUNTANT), asyncHandler(async (req, res) => {
  const contracts = await prisma.staffContract.findMany({ where: { institutionId: req.institutionId!, staffId: req.query.staffId ? String(req.query.staffId) : undefined }, include: { staff: true }, orderBy: { createdAt: 'desc' } })
  res.json({ contracts })
}))

staffRoutes.post(
  '/contracts',
  requireRoles(...directorOnly),
  validate(staffContractCreateSchema),
  asyncHandler(async (req, res) => {
    const staff = await prisma.staffMember.findFirst({ where: { id: req.body.staffId, institutionId: req.institutionId! } })
    if (!staff) throw notFound('Personnel introuvable')
    const number = `RH-${staff.matricule}-${Date.now()}`
    const status = req.body.status ?? StaffContractStatus.ACTIVE
    const contract = await prisma.$transaction(async (tx) => {
      if (status === StaffContractStatus.ACTIVE || status === StaffContractStatus.SIGNED) {
        await tx.staffContract.updateMany({ where: { institutionId: req.institutionId!, staffId: staff.id, activeKey: staff.id }, data: { activeKey: null, status: StaffContractStatus.ARCHIVED, archivedAt: new Date() } })
      }
      return tx.staffContract.create({
        data: {
          institutionId: req.institutionId!,
          staffId: staff.id,
          activeKey: status === StaffContractStatus.ACTIVE || status === StaffContractStatus.SIGNED ? staff.id : null,
          number,
          createdById: req.user!.id,
          salary: req.body.salary ?? staff.baseSalary,
          status,
          title: req.body.title ?? 'Contrat du personnel',
          startsAt: req.body.startsAt,
          endsAt: req.body.endsAt,
          scheduleText: req.body.scheduleText,
          generalClauses: req.body.generalClauses,
          specificClauses: req.body.specificClauses,
          penaltyClauses: req.body.penaltyClauses,
          obligations: req.body.obligations
        }
      })
    })
    await prisma.auditLog.create({ data: { institutionId: req.institutionId!, actorId: req.user!.id, action: 'STAFF_CONTRACT_CREATED', entity: 'StaffContract', entityId: contract.id, metadata: { idempotencyKey: req.get('Idempotency-Key') } } })
    res.status(201).json({ contract })
  })
)

staffRoutes.get('/contracts/:id/pdf', requireRoles(...managementRoles, UserRole.ACCOUNTANT, UserRole.TEACHER), asyncHandler(async (req, res) => {
  const contract = await prisma.staffContract.findFirst({ where: { id: req.params.id, institutionId: req.institutionId! }, include: { staff: true, institution: true } })
  if (!contract) throw notFound('Contrat introuvable')
  if (req.user!.role === UserRole.TEACHER && contract.staff.userId !== req.user!.id) throw forbidden('Accès refusé')
  const generatedAt = new Date().toLocaleString('fr-FR')
  const doc = createProfessionalPdf({ size: 'A4', margin: 36 })
  drawProfessionalHeader(doc, {
    title: 'Contrat RH',
    subtitle: contract.title,
    documentNumber: contract.number,
    generatedAt,
    brand: { name: contract.institution.name, address: contract.institution.address, city: contract.institution.city, country: contract.institution.country, phone: contract.institution.phone, email: contract.institution.email }
  })
  drawInfoRows(doc, [
    { label: 'Personnel', value: `${contract.staff.firstName} ${contract.staff.lastName}` },
    { label: 'Poste', value: contract.staff.customPosition ?? contract.staff.position },
    { label: 'Salaire convenu', value: `${contract.salary.toLocaleString('fr-FR')} ${contract.institution.currency}` },
    { label: 'Début / fin', value: `${contract.startsAt.toLocaleDateString('fr-FR')} - ${contract.endsAt?.toLocaleDateString('fr-FR') ?? 'Indéterminée'}` },
    { label: 'Statut', value: contract.status }
  ])
  drawInfoRows(doc, [
    { label: 'Clauses générales', value: contract.generalClauses },
    { label: 'Clauses spécifiques', value: contract.specificClauses ?? '—' },
    { label: 'Horaires', value: contract.scheduleText ?? 'Selon planning validé par la Direction' },
    { label: 'Retards / absences', value: contract.penaltyClauses ?? 'Selon règlement intérieur et paramètres RH de l’établissement' },
    { label: 'Obligations', value: contract.obligations ?? 'Respect du règlement intérieur, confidentialité, ponctualité et suivi des missions confiées.' }
  ])
  drawSignatureBlock(doc, ['Le personnel', 'La Direction', 'Cachet établissement'])
  addFooterToBufferedPages(doc, { generatedAt, generatorName: 'SoraSchool' })
  const buffer = await collectPdf(doc)
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename="${safePdfFileName(`contrat-${contract.staff.matricule}`)}.pdf"`)
  res.send(buffer)
}))

staffRoutes.get('/tablet-links', requireRoles(...managementRoles), asyncHandler(async (req, res) => {
  const links = await prisma.staffTabletLink.findMany({ where: { institutionId: req.institutionId! }, include: { scanLogs: { orderBy: { createdAt: 'desc' }, take: 20 } }, orderBy: { createdAt: 'desc' } })
  res.json({ links })
}))

staffRoutes.post(
  '/tablet-links',
  requireRoles(...directorOnly),
  validate(z.object({ body: z.object({ validity: z.enum(['1d', '7d', '1m', 'school_year']).default('7d'), label: z.string().optional(), deviceHint: z.string().optional() }) })),
  asyncHandler(async (req, res) => {
    const token = secureToken(36)
    const now = new Date()
    const expiresAt = new Date(now)
    if (req.body.validity === '1d') expiresAt.setDate(now.getDate() + 1)
    else if (req.body.validity === '7d') expiresAt.setDate(now.getDate() + 7)
    else if (req.body.validity === '1m') expiresAt.setMonth(now.getMonth() + 1)
    else {
      const activeYear = await prisma.academicYear.findFirst({ where: { institutionId: req.institutionId!, isActive: true } })
      expiresAt.setTime(activeYear?.endsAt?.getTime() ?? new Date(now.getFullYear(), 6, 31).getTime())
    }
    const link = await prisma.staffTabletLink.create({
      data: {
        institutionId: req.institutionId!,
        tokenHash: tokenHash(token),
        expiresAt,
        label: req.body.label,
        deviceHint: req.body.deviceHint,
        createdById: req.user!.id
      }
    })
    await prisma.auditLog.create({ data: { institutionId: req.institutionId!, actorId: req.user!.id, action: 'STAFF_TABLET_LINK_CREATED', entity: 'StaffTabletLink', entityId: link.id, ip: req.ip, userAgent: req.get('user-agent'), metadata: { expiresAt, idempotencyKey: req.get('Idempotency-Key') } } })
    const origin = (req.get('origin') || env.FRONTEND_URL).replace(/\/$/, '')
    const url = `${origin}/pointage/tablette/${token}`
    const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 260 })
    res.status(201).json({ link, token, url, qrDataUrl })
  })
)

staffRoutes.patch('/tablet-links/:id/disable', requireRoles(...directorOnly), asyncHandler(async (req, res) => {
  const link = await prisma.staffTabletLink.findFirst({ where: { id: req.params.id, institutionId: req.institutionId! } })
  if (!link) throw notFound('Lien tablette introuvable')
  const updated = await prisma.staffTabletLink.update({ where: { id: link.id }, data: { status: StaffTabletLinkStatus.INACTIVE } })
  await prisma.auditLog.create({ data: { institutionId: req.institutionId!, actorId: req.user!.id, action: 'STAFF_TABLET_LINK_DISABLED', entity: 'StaffTabletLink', entityId: link.id, ip: req.ip, userAgent: req.get('user-agent'), metadata: { idempotencyKey: req.get('Idempotency-Key') } } })
  res.json({ link: updated })
}))
