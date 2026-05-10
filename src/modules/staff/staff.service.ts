import crypto from 'node:crypto'
import {
  ContractType,
  StaffAttendanceMethod,
  StaffAttendanceStatus,
  StaffJustificationStatus,
  StaffPenaltyStatus,
  StaffPosition,
  TeacherStatus,
  UserRole,
  type Prisma,
  type StaffMember
} from '@prisma/client'
import { prisma } from '../../config/prisma'
import { env } from '../../config/env'
import { badRequest, forbidden, notFound } from '../../lib/errors'
import { generateMatricule, normalizePhone } from '../../lib/security'

const QR_PREFIX = 'SORA-STAFF'

type StaffForQr = Pick<StaffMember, 'id' | 'institutionId' | 'qrTokenVersion' | 'qrActive'>

function b64url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url')
}

function fromB64url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function hmac(value: string) {
  return crypto.createHmac('sha256', env.JWT_ACCESS_SECRET).update(value).digest('base64url')
}

function hash(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

export function secureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url')
}

export function tokenHash(token: string) {
  return hash(token)
}

export function buildStaffQrPayload(staff: StaffForQr) {
  const body = b64url(JSON.stringify({
    typ: 'staff_attendance',
    sid: staff.id,
    school: staff.institutionId,
    ver: staff.qrTokenVersion,
    iat: Date.now()
  }))
  return `${QR_PREFIX}.${body}.${hmac(body)}`
}

export async function resolveStaffQrPayload(payload: string, expectedInstitutionId?: string) {
  const [prefix, body, signature] = String(payload).split('.')
  if (prefix !== QR_PREFIX || !body || !signature || hmac(body) !== signature) {
    throw badRequest('QR code invalide')
  }

  let decoded: { sid?: string; school?: string; ver?: number }
  try {
    decoded = JSON.parse(fromB64url(body))
  } catch {
    throw badRequest('QR code invalide')
  }

  if (!decoded.sid || !decoded.school || !decoded.ver) throw badRequest('QR code incomplet')
  if (expectedInstitutionId && decoded.school !== expectedInstitutionId) {
    throw forbidden("Ce QR code n'appartient pas à cet établissement")
  }

  const staff = await prisma.staffMember.findFirst({
    where: {
      id: decoded.sid,
      institutionId: decoded.school,
      qrActive: true,
      qrTokenVersion: decoded.ver,
      status: TeacherStatus.ACTIVE
    },
    include: { teacher: true, user: true }
  })
  if (!staff) throw notFound('Personnel non reconnu ou QR code désactivé')
  return staff
}

export function dayStart(value = new Date()) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

export function dayKey(value = new Date()) {
  return dayStart(value).toISOString().slice(0, 10)
}

function dateAtTime(day: Date, time: string) {
  const [h = 0, m = 0] = time.split(':').map(Number)
  const date = dayStart(day)
  date.setHours(h, m, 0, 0)
  return date
}

function jsDayToSchoolDay(date: Date) {
  const d = date.getDay()
  return d === 0 ? 7 : d
}

export async function getStaffAttendanceSettings(institutionId: string) {
  return prisma.staffAttendanceSetting.upsert({
    where: { institutionId },
    update: {},
    create: { institutionId }
  })
}

export function systemRoleForPosition(position: StaffPosition): UserRole | null {
  if (position === StaffPosition.TEACHER) return UserRole.TEACHER
  if (position === StaffPosition.ACCOUNTANT || position === StaffPosition.CASHIER) return UserRole.ACCOUNTANT
  if (position === StaffPosition.SECRETARIAT || position === StaffPosition.ADMIN_AGENT || position === StaffPosition.LIBRARIAN) return UserRole.SECRETARIAT
  if (position === StaffPosition.STOCK_MANAGER) return UserRole.STOCK_MANAGER
  if (position === StaffPosition.ASSISTANT_DIRECTOR || position === StaffPosition.CENSOR || position === StaffPosition.EDUCATION_ADVISOR) return UserRole.ADMINISTRATION
  return null
}

export async function ensureStaffForTeacher(teacherId: string, actorId?: string) {
  const existing = await prisma.staffMember.findFirst({ where: { teacherId } })
  if (existing) return existing

  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    include: { institution: { select: { slug: true } } }
  })
  if (!teacher) throw notFound('Enseignant introuvable')

  return prisma.staffMember.create({
    data: {
      institutionId: teacher.institutionId,
      establishmentId: teacher.establishmentId,
      userId: teacher.userId,
      teacherId: teacher.id,
      matricule: teacher.matricule,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      phone: teacher.phone,
      email: teacher.email,
      address: teacher.address,
      photoUrl: teacher.photoUrl,
      position: StaffPosition.TEACHER,
      systemRole: UserRole.TEACHER,
      contractType: teacher.contractType,
      baseSalary: teacher.baseSalary,
      hireDate: teacher.hireDate,
      createdById: actorId,
      metadata: {
        syncedFromTeacher: true,
        specialization: teacher.specialization
      }
    }
  })
}

export async function syncTeacherStaffForInstitution(institutionId: string, actorId?: string) {
  const teachers = await prisma.teacher.findMany({
    where: { institutionId },
    select: { id: true }
  })
  for (const teacher of teachers) {
    await ensureStaffForTeacher(teacher.id, actorId)
  }
}

export async function nextStaffMatricule(institutionId: string, prefix = 'STAFF') {
  const institution = await prisma.institution.findUnique({ where: { id: institutionId }, select: { slug: true } })
  const matriculePrefix = `${institution?.slug.toUpperCase() ?? 'SCHOOL'}-${prefix}`
  const last = await prisma.staffMember.findFirst({
    where: { institutionId, matricule: { startsWith: matriculePrefix } },
    orderBy: { matricule: 'desc' },
    select: { matricule: true }
  })
  const seq = last ? (parseInt(last.matricule.split('-').pop() || '0', 10) || 0) : 0
  return generateMatricule(matriculePrefix, seq)
}

export async function createStaffMember(input: {
  institutionId: string
  actorId?: string
  firstName: string
  lastName: string
  phone?: string
  email?: string
  address?: string
  photoUrl?: string
  position: StaffPosition
  customPosition?: string
  baseSalary?: number
  hireDate?: Date
  contractType?: ContractType
  permissions?: Prisma.InputJsonValue
  roleTemplateId?: string
  createAccess?: boolean
}) {
  const systemRole = systemRoleForPosition(input.position)
  const phone = input.phone ? normalizePhone(input.phone) : undefined
  const matricule = await nextStaffMatricule(input.institutionId, input.position === StaffPosition.TEACHER ? 'PR' : 'PE')

  return prisma.$transaction(async (tx) => {
    let userId: string | undefined
    if (input.createAccess !== false && phone && systemRole) {
      const user = await tx.user.upsert({
        where: { institutionId_phone: { institutionId: input.institutionId, phone } },
        update: {
          role: systemRole,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          isActive: true
        },
        create: {
          institutionId: input.institutionId,
          role: systemRole,
          firstName: input.firstName,
          lastName: input.lastName,
          phone,
          email: input.email,
          isActive: true
        }
      })
      userId = user.id
      await tx.allowedPhone.upsert({
        where: { institutionId_phone: { institutionId: input.institutionId, phone } },
        update: { role: systemRole, firstName: input.firstName, lastName: input.lastName, email: input.email },
        create: {
          institutionId: input.institutionId,
          phone,
          role: systemRole,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          createdById: input.actorId
        }
      })
    }

    const staff = await tx.staffMember.create({
      data: {
        institutionId: input.institutionId,
        userId,
        matricule,
        firstName: input.firstName,
        lastName: input.lastName,
        phone,
        email: input.email,
        address: input.address,
        photoUrl: input.photoUrl,
        position: input.position,
        customPosition: input.customPosition,
        systemRole,
        baseSalary: input.baseSalary ?? 0,
        hireDate: input.hireDate,
        contractType: input.contractType ?? ContractType.CDI,
        permissions: input.permissions,
        roleTemplateId: input.roleTemplateId,
        createdById: input.actorId
      }
    })

    await tx.auditLog.create({
      data: {
        institutionId: input.institutionId,
        actorId: input.actorId,
        action: 'STAFF_CREATED',
        entity: 'StaffMember',
        entityId: staff.id,
        metadata: { position: input.position, systemRole, matricule }
      }
    })

    return staff
  })
}

export async function expectedWindowForStaff(staff: Pick<StaffMember, 'id' | 'teacherId' | 'institutionId'>, day = new Date()) {
  const settings = await getStaffAttendanceSettings(staff.institutionId)
  const baseDay = dayStart(day)

  if (staff.teacherId) {
    const slots = await prisma.scheduleSlot.findMany({
      where: {
        institutionId: staff.institutionId,
        teacherId: staff.teacherId,
        dayOfWeek: jsDayToSchoolDay(baseDay)
      },
      orderBy: { startsAt: 'asc' }
    })
    if (slots.length) {
      return {
        checkIn: dateAtTime(baseDay, slots[0].startsAt),
        checkOut: dateAtTime(baseDay, slots[slots.length - 1].endsAt),
        scheduleSlotId: slots[0].id,
        hasSchedule: true,
        settings
      }
    }
  }

  return {
    checkIn: dateAtTime(baseDay, settings.defaultCheckInTime),
    checkOut: dateAtTime(baseDay, settings.defaultCheckOutTime),
    scheduleSlotId: undefined,
    hasSchedule: false,
    settings
  }
}

async function upsertPenaltyForAttendance(
  tx: Prisma.TransactionClient,
  attendance: { id: string; institutionId: string; staffId: string },
  amount: number,
  reason: string,
  status: StaffPenaltyStatus
) {
  if (amount <= 0) return null
  return tx.staffPenalty.upsert({
    where: {
      institutionId_eventType_eventId: {
        institutionId: attendance.institutionId,
        eventType: 'STAFF_ATTENDANCE',
        eventId: attendance.id
      }
    },
    update: { amount, reason, status, appliedAt: status === StaffPenaltyStatus.APPLIED ? new Date() : undefined },
    create: {
      institutionId: attendance.institutionId,
      staffId: attendance.staffId,
      attendanceId: attendance.id,
      eventType: 'STAFF_ATTENDANCE',
      eventId: attendance.id,
      amount,
      reason,
      status,
      appliedAt: status === StaffPenaltyStatus.APPLIED ? new Date() : undefined
    }
  })
}

export async function scanStaffAttendance(input: {
  institutionId: string
  staffId: string
  method: StaffAttendanceMethod
  tabletLinkId?: string
  now?: Date
  ip?: string
  userAgent?: string
  actorId?: string
  idempotencyKey?: string
  noScheduleReason?: string
}) {
  const now = input.now ?? new Date()
  const staff = await prisma.staffMember.findFirst({
    where: { id: input.staffId, institutionId: input.institutionId, status: TeacherStatus.ACTIVE },
    include: { user: true }
  })
  if (!staff) throw notFound('Personnel introuvable')

  const expected = await expectedWindowForStaff(staff, now)
  const noScheduleReason = input.noScheduleReason?.trim()
  const requiresNoScheduleReason = Boolean(staff.teacherId && !expected.hasSchedule)
  if (requiresNoScheduleReason && !noScheduleReason) {
    throw badRequest("Vous n’avez aucun cours programmé. Veuillez justifier votre présence.")
  }
  const toleranceMs = expected.settings.lateToleranceMinutes * 60_000
  const earlyToleranceMs = expected.settings.earlyDepartureToleranceMinutes * 60_000
  const attendanceKey = `${staff.id}:${dayKey(now)}:${expected.scheduleSlotId ?? 'daily'}`

  return prisma.$transaction(async (tx) => {
    const existing = await tx.staffAttendance.findUnique({
      where: { institutionId_attendanceKey: { institutionId: input.institutionId, attendanceKey } }
    })

    if (existing?.actualCheckInAt && existing.actualCheckOutAt) {
      await tx.auditLog.create({
        data: {
          institutionId: input.institutionId,
          actorId: input.actorId,
          action: 'STAFF_ATTENDANCE_DOUBLE_SCAN_BLOCKED',
          entity: 'StaffAttendance',
          entityId: existing.id,
          ip: input.ip,
          userAgent: input.userAgent,
          metadata: { staffId: staff.id, idempotencyKey: input.idempotencyKey }
        }
      })
      return { attendance: existing, staff, result: 'ALREADY_COMPLETE', message: "Pointage déjà complet aujourd'hui" }
    }

    if (!existing?.actualCheckInAt) {
      const lateMinutes = Math.max(0, Math.ceil((now.getTime() - expected.checkIn.getTime() - toleranceMs) / 60_000))
      const isLate = lateMinutes > 0
      const status = requiresNoScheduleReason
        ? StaffAttendanceStatus.OFF_SCHEDULE_JUSTIFIED
        : isLate
          ? StaffAttendanceStatus.LATE
          : StaffAttendanceStatus.PRESENT
      const penaltyAmount = isLate && !requiresNoScheduleReason ? expected.settings.latePenaltyAmount : 0
      const penaltyStatus = expected.settings.autoApplyPenalties ? StaffPenaltyStatus.APPLIED : StaffPenaltyStatus.PENDING
      const attendance = existing
        ? await tx.staffAttendance.update({
            where: { id: existing.id },
            data: {
              actualCheckInAt: now,
              expectedCheckInAt: expected.checkIn,
              expectedCheckOutAt: expected.checkOut,
              scheduleSlotId: expected.scheduleSlotId,
              status,
              method: input.method,
              lateMinutes: requiresNoScheduleReason ? 0 : lateMinutes,
              penaltyAmount,
              penaltyApplied: penaltyStatus === StaffPenaltyStatus.APPLIED,
              sourceTabletLinkId: input.tabletLinkId,
              noScheduleReason,
              note: noScheduleReason ?? undefined
            }
          })
        : await tx.staffAttendance.create({
            data: {
              institutionId: input.institutionId,
              staffId: staff.id,
              attendanceKey,
              date: dayStart(now),
              actualCheckInAt: now,
              expectedCheckInAt: expected.checkIn,
              expectedCheckOutAt: expected.checkOut,
              scheduleSlotId: expected.scheduleSlotId,
              status,
              method: input.method,
              lateMinutes: requiresNoScheduleReason ? 0 : lateMinutes,
              penaltyAmount,
              penaltyApplied: penaltyStatus === StaffPenaltyStatus.APPLIED,
              sourceTabletLinkId: input.tabletLinkId,
              noScheduleReason,
              note: noScheduleReason ?? undefined
            }
          })

      if (isLate && !requiresNoScheduleReason) {
        await upsertPenaltyForAttendance(tx, attendance, penaltyAmount, `Retard non justifié (${lateMinutes} min)`, penaltyStatus)
      }

      await tx.auditLog.create({
        data: {
          institutionId: input.institutionId,
          actorId: input.actorId,
          action: requiresNoScheduleReason ? 'STAFF_CHECK_IN_OFF_SCHEDULE_JUSTIFIED' : isLate ? 'STAFF_CHECK_IN_LATE' : 'STAFF_CHECK_IN',
          entity: 'StaffAttendance',
          entityId: attendance.id,
          ip: input.ip,
          userAgent: input.userAgent,
          metadata: { staffId: staff.id, lateMinutes: requiresNoScheduleReason ? 0 : lateMinutes, penaltyAmount, noScheduleReason, idempotencyKey: input.idempotencyKey }
        }
      })
      if (isLate && !requiresNoScheduleReason) {
        await tx.notification.create({
          data: {
            institutionId: input.institutionId,
            userId: staff.userId,
            level: 'WARNING',
            title: 'Retard détecté',
            body: `Votre pointage indique ${lateMinutes} minute(s) de retard. Vous pouvez soumettre une justification.`,
            data: { attendanceId: attendance.id, penaltyAmount }
          }
        }).catch(() => undefined)
      }
      return {
        attendance,
        staff,
        result: requiresNoScheduleReason ? 'OFF_SCHEDULE_JUSTIFIED' : isLate ? 'LATE' : 'CHECK_IN',
        message: requiresNoScheduleReason ? 'Pointage hors planning enregistré avec justification' : isLate ? 'Pointage arrivée enregistré avec retard' : 'Pointage arrivée enregistré'
      }
    }

    const earlyDepartureMinutes = Math.max(0, Math.ceil((expected.checkOut.getTime() - now.getTime() - earlyToleranceMs) / 60_000))
    const status = earlyDepartureMinutes > 0 && existing.status !== StaffAttendanceStatus.LATE
      ? StaffAttendanceStatus.EARLY_DEPARTURE
      : existing.status
    const attendance = await tx.staffAttendance.update({
      where: { id: existing.id },
      data: {
        actualCheckOutAt: now,
        expectedCheckOutAt: expected.checkOut,
        earlyDepartureMinutes,
        status,
        method: input.method,
        sourceTabletLinkId: input.tabletLinkId
      }
    })
    await tx.auditLog.create({
      data: {
        institutionId: input.institutionId,
        actorId: input.actorId,
        action: earlyDepartureMinutes > 0 ? 'STAFF_CHECK_OUT_EARLY' : 'STAFF_CHECK_OUT',
        entity: 'StaffAttendance',
        entityId: attendance.id,
        ip: input.ip,
        userAgent: input.userAgent,
        metadata: { staffId: staff.id, earlyDepartureMinutes, idempotencyKey: input.idempotencyKey }
      }
    })
    return { attendance, staff, result: earlyDepartureMinutes > 0 ? 'EARLY_DEPARTURE' : 'CHECK_OUT', message: earlyDepartureMinutes > 0 ? 'Départ enregistré avec sortie anticipée' : 'Pointage départ enregistré' }
  })
}

export async function salarySnapshot(institutionId: string, staffId: string, date = new Date()) {
  const staff = await prisma.staffMember.findFirst({ where: { id: staffId, institutionId } })
  if (!staff) throw notFound('Personnel introuvable')
  const month = date.getMonth() + 1
  const year = date.getFullYear()
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)

  const [penalties, adjustments, attendances, justifications, contracts] = await Promise.all([
    prisma.staffPenalty.findMany({
      where: { institutionId, staffId, status: StaffPenaltyStatus.APPLIED, createdAt: { gte: start, lt: end } }
    }),
    prisma.staffSalaryAdjustment.findMany({ where: { institutionId, staffId, month, year } }),
    prisma.staffAttendance.findMany({ where: { institutionId, staffId, date: { gte: start, lt: end } } }),
    prisma.staffJustification.findMany({ where: { institutionId, staffId, createdAt: { gte: start, lt: end } } }),
    prisma.staffContract.findMany({ where: { institutionId, staffId }, orderBy: { createdAt: 'desc' }, take: 12 })
  ])

  const bonuses = adjustments.filter((item) => item.kind === 'BONUS').reduce((sum, item) => sum + item.amount, 0)
  const deductions = adjustments.filter((item) => item.kind === 'DEDUCTION').reduce((sum, item) => sum + item.amount, 0)
  const penaltyTotal = penalties.reduce((sum, item) => sum + item.amount, 0)
  const netAmount = staff.baseSalary + bonuses - deductions - penaltyTotal

  return {
    staff,
    month,
    year,
    baseSalary: staff.baseSalary,
    bonuses,
    deductions,
    penalties: penaltyTotal,
    netAmount,
    netSalary: netAmount,
    lateCount: attendances.filter((item) => item.status === StaffAttendanceStatus.LATE).length,
    absentCount: attendances.filter((item) => item.status === StaffAttendanceStatus.ABSENT).length,
    absenceCount: attendances.filter((item) => item.status === StaffAttendanceStatus.ABSENT).length,
    pendingJustifications: justifications.filter((item) => item.status === StaffJustificationStatus.PENDING).length,
    acceptedJustifications: justifications.filter((item) => item.status === StaffJustificationStatus.ACCEPTED).length,
    refusedJustifications: justifications.filter((item) => item.status === StaffJustificationStatus.REFUSED).length,
    adjustments,
    penaltyItems: penalties,
    attendances,
    contracts
  }
}
