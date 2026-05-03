import { Router } from 'express'
import slugify from 'slugify'
import { z } from 'zod'
import { InstitutionKind, InstitutionStatus, PaymentStatus, UserRole } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { badRequest, notFound } from '../../lib/errors'
import { assertEstablishmentCapacity } from '../../lib/plan-limits'
import { normalizePhone } from '../../lib/security'
import { authenticate } from '../../middlewares/auth'
import { requireRoles, requireTenantUser } from '../../middlewares/rbac'
import { validate } from '../../middlewares/validate'
import { audit } from '../../middlewares/audit'

export const centralAdminRoutes = Router()

centralAdminRoutes.use(authenticate, requireTenantUser, requireRoles(UserRole.CENTRAL_ADMIN))

const schoolSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    slug: z.string().optional(),
    kind: z.nativeEnum(InstitutionKind).optional(),
    country: z.string().optional(),
    city: z.string().optional(),
    district: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    logoUrl: z.string().url().optional(),
    directorName: z.string().optional(),
    directorPhone: z.string().optional(),
    directorEmail: z.string().email().optional(),
    motto: z.string().optional(),
    levels: z.array(z.string()).default([]),
    activeAcademicYearName: z.string().optional()
  })
})

const directorSchema = z.object({
  params: z.object({ schoolId: z.string() }),
  body: z.object({
    name: z.string().min(2),
    phone: z.string().min(6),
    email: z.string().email().optional(),
    note: z.string().optional()
  })
})

function buildSlug(name: string, customSlug?: string) {
  return slugify(customSlug ?? name, { lower: true, strict: true })
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/)
  return {
    firstName: parts[0] ?? 'Directeur',
    lastName: parts.slice(1).join(' ') || 'Établissement'
  }
}

export async function buildCentralDashboard(institutionId: string) {
  const seriesStart = new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1)
  const schools = await prisma.establishment.findMany({
    where: { institutionId },
    include: {
      _count: { select: { students: true, teachers: true, classrooms: true } },
      directorAssignments: {
        where: { isActive: true },
        include: { director: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } } },
        take: 1,
        orderBy: { startsAt: 'desc' }
      }
    },
    orderBy: [{ createdAt: 'asc' }, { name: 'asc' }]
  })

  const [institution, invoices, payments, attendance, grades, monthlyPayments, paymentStudents] = await Promise.all([
    prisma.institution.findUnique({ where: { id: institutionId } }),
    prisma.invoice.findMany({
      where: { institutionId },
      include: { student: { select: { establishmentId: true } } }
    }),
    prisma.payment.findMany({
      where: { institutionId, status: PaymentStatus.PAID },
      include: { invoice: { include: { student: { select: { establishmentId: true } } } } }
    }),
    prisma.studentAttendance.findMany({
      where: { institutionId, status: { in: ['ABSENT', 'LATE'] } },
      include: { student: { select: { establishmentId: true } } }
    }),
    prisma.grade.findMany({
      where: { institutionId },
      include: { student: { select: { establishmentId: true } } }
    }),
    prisma.payment.findMany({
      where: { institutionId, status: PaymentStatus.PAID, paidAt: { gte: seriesStart } },
      select: { amount: true, paidAt: true }
    }),
    prisma.student.findMany({
      where: { institutionId },
      select: { id: true, establishmentId: true }
    })
  ])
  const establishmentByStudentId = new Map(paymentStudents.map((student) => [student.id, student.establishmentId]))

  const monthFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'short' })
  const monthlySeries = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(new Date().getFullYear(), new Date().getMonth() - (5 - index), 1)
    const monthPayments = monthlyPayments.filter((payment) => {
      const paidAt = payment.paidAt
      return paidAt && paidAt.getFullYear() === date.getFullYear() && paidAt.getMonth() === date.getMonth()
    })
    return {
      month: monthFormatter.format(date).replace('.', ''),
      amount: monthPayments.reduce((sum, payment) => sum + payment.amount, 0)
    }
  })

  const schoolsSummary = schools.map((school) => {
    const schoolInvoices = invoices.filter((invoice) => invoice.student.establishmentId === school.id)
    const schoolPayments = payments.filter((payment) => {
      const establishmentId = payment.invoice?.student.establishmentId ?? (payment.studentId ? establishmentByStudentId.get(payment.studentId) : null)
      return establishmentId === school.id
    })
    const schoolAttendance = attendance.filter((record) => record.student.establishmentId === school.id)
    const schoolGrades = grades.filter((grade) => grade.student.establishmentId === school.id)
    const averageScore = schoolGrades.length
      ? Math.round((schoolGrades.reduce((sum, grade) => sum + grade.score, 0) / schoolGrades.length) * 100) / 100
      : null
    const activeDirector = school.directorAssignments[0]?.director

    return {
      id: school.id,
      name: school.name,
      slug: school.slug,
      kind: school.kind,
      city: school.city,
      district: school.district,
      directorName: school.directorName,
      activeDirector,
      students: school._count.students,
      teachers: school._count.teachers,
      classes: school._count.classrooms,
      revenue: schoolPayments.reduce((sum, payment) => sum + payment.amount, 0),
      unpaidInvoices: schoolInvoices.filter((invoice) => ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status)).length,
      absences: schoolAttendance.length,
      averageScore
    }
  })

  return {
    role: UserRole.CENTRAL_ADMIN,
    centralAdministration: true,
    institution,
    totalSchools: schools.length,
    totalStudents: schools.reduce((sum, school) => sum + school._count.students, 0),
    totalTeachers: schools.reduce((sum, school) => sum + school._count.teachers, 0),
    totalClasses: schools.reduce((sum, school) => sum + school._count.classrooms, 0),
    paidInvoices: payments.reduce((sum, payment) => sum + payment.amount, 0),
    pendingInvoices: invoices.filter((invoice) => ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status)).length,
    recentAbsences: attendance.length,
    urgentMessages: 0,
    monthlyPayments: monthlySeries,
    schools: schoolsSummary,
    revenueBySchool: schoolsSummary.map((school) => ({ school: school.name, amount: school.revenue })),
    effectifsBySchool: schoolsSummary.map((school) => ({ school: school.name, students: school.students, teachers: school.teachers })),
    performanceBySchool: schoolsSummary.map((school) => ({ school: school.name, averageScore: school.averageScore }))
  }
}

async function assignDirector({
  institutionId,
  establishmentId,
  assignedById,
  name,
  phone,
  email,
  note
}: {
  institutionId: string
  establishmentId: string
  assignedById: string
  name: string
  phone: string
  email?: string
  note?: string
}) {
  const normalizedPhone = normalizePhone(phone)
  const director = splitName(name)

  return prisma.$transaction(async (tx) => {
    const establishment = await tx.establishment.findFirst({ where: { id: establishmentId, institutionId } })
    if (!establishment) throw notFound('École introuvable')

    await tx.establishmentDirectorAssignment.updateMany({
      where: { institutionId, establishmentId, isActive: true },
      data: { isActive: false, endsAt: new Date() }
    })

    await tx.user.updateMany({
      where: { institutionId, establishmentId, role: UserRole.DIRECTOR },
      data: { isActive: false }
    })

    const user = await tx.user.upsert({
      where: { institutionId_phone: { institutionId, phone: normalizedPhone } },
      update: {
        establishmentId,
        role: UserRole.DIRECTOR,
        firstName: director.firstName,
        lastName: director.lastName,
        email,
        isActive: true
      },
      create: {
        institutionId,
        establishmentId,
        role: UserRole.DIRECTOR,
        firstName: director.firstName,
        lastName: director.lastName,
        phone: normalizedPhone,
        email,
        isActive: true
      }
    })

    await tx.allowedPhone.upsert({
      where: { institutionId_phone: { institutionId, phone: normalizedPhone } },
      update: { role: UserRole.DIRECTOR, firstName: director.firstName, lastName: director.lastName, email },
      create: {
        institutionId,
        phone: normalizedPhone,
        role: UserRole.DIRECTOR,
        firstName: director.firstName,
        lastName: director.lastName,
        email,
        createdById: assignedById
      }
    })

    await tx.establishment.update({
      where: { id: establishmentId },
      data: { directorName: name, directorPhone: normalizedPhone, directorEmail: email }
    })

    const assignment = await tx.establishmentDirectorAssignment.create({
      data: { institutionId, establishmentId, directorUserId: user.id, assignedById, note }
    })

    return { user, assignment }
  })
}

centralAdminRoutes.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    res.json(await buildCentralDashboard(req.institutionId!))
  })
)

centralAdminRoutes.get(
  '/schools',
  asyncHandler(async (req, res) => {
    const schools = await prisma.establishment.findMany({
      where: { institutionId: req.institutionId! },
      include: {
        _count: { select: { students: true, teachers: true, classrooms: true } },
        directorAssignments: {
          where: { isActive: true },
          include: { director: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } } },
          take: 1,
          orderBy: { startsAt: 'desc' }
        }
      },
      orderBy: [{ createdAt: 'asc' }, { name: 'asc' }]
    })
    res.json({ schools })
  })
)

centralAdminRoutes.post(
  '/schools',
  validate(schoolSchema),
  audit('CREATE', 'Establishment'),
  asyncHandler(async (req, res) => {
    await assertEstablishmentCapacity(req.institutionId!)
    const institution = await prisma.institution.findUnique({ where: { id: req.institutionId! } })
    if (!institution) throw badRequest('Administration Centrale introuvable')
    const slug = buildSlug(req.body.name, req.body.slug)

    const school = await prisma.establishment.create({
      data: {
        institutionId: req.institutionId!,
        name: req.body.name,
        slug,
        kind: req.body.kind ?? institution.kind,
        status: InstitutionStatus.ACTIVE,
        logoUrl: req.body.logoUrl,
        country: req.body.country ?? institution.country,
        city: req.body.city ?? institution.city,
        district: req.body.district ?? institution.district,
        address: req.body.address,
        phone: req.body.phone,
        email: req.body.email,
        directorName: req.body.directorName,
        directorPhone: req.body.directorPhone ? normalizePhone(req.body.directorPhone) : undefined,
        directorEmail: req.body.directorEmail,
        motto: req.body.motto,
        levels: req.body.levels,
        activeAcademicYearName: req.body.activeAcademicYearName
      }
    })

    let directorAssignment = null
    if (req.body.directorName && req.body.directorPhone) {
      directorAssignment = await assignDirector({
        institutionId: req.institutionId!,
        establishmentId: school.id,
        assignedById: req.user!.id,
        name: req.body.directorName,
        phone: req.body.directorPhone,
        email: req.body.directorEmail,
        note: 'Directeur nommé à la création de l’école'
      })
    }

    res.status(201).json({ school, directorAssignment })
  })
)

centralAdminRoutes.post(
  '/schools/:schoolId/director',
  validate(directorSchema),
  audit('ASSIGN_DIRECTOR', 'Establishment'),
  asyncHandler(async (req, res) => {
    const result = await assignDirector({
      institutionId: req.institutionId!,
      establishmentId: req.params.schoolId,
      assignedById: req.user!.id,
      name: req.body.name,
      phone: req.body.phone,
      email: req.body.email,
      note: req.body.note
    })
    res.json(result)
  })
)

centralAdminRoutes.get(
  '/schools/:schoolId/directors/history',
  asyncHandler(async (req, res) => {
    const school = await prisma.establishment.findFirst({ where: { id: req.params.schoolId, institutionId: req.institutionId! } })
    if (!school) throw notFound('École introuvable')
    const history = await prisma.establishmentDirectorAssignment.findMany({
      where: { institutionId: req.institutionId!, establishmentId: school.id },
      include: {
        director: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
        assignedBy: { select: { id: true, firstName: true, lastName: true, role: true } }
      },
      orderBy: { startsAt: 'desc' }
    })
    res.json({ history })
  })
)
