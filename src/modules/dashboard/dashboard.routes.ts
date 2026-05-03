import { Router } from 'express'
import { PaymentStatus, UserRole } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { getScopedEstablishmentId } from '../../lib/access-scope'
import { authenticate } from '../../middlewares/auth'
import { requireTenantUser } from '../../middlewares/rbac'
import { buildCentralDashboard } from '../central-admin/central-admin.routes'

export const dashboardRoutes = Router()
dashboardRoutes.use(authenticate, requireTenantUser)

function buildMonthlyPayments(payments: Array<{ amount: number; paidAt: Date | null }>) {
  const now = new Date()
  const monthFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'short' })
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
    const monthPayments = payments.filter((payment) => {
      const paidAt = payment.paidAt
      return paidAt && paidAt.getFullYear() === date.getFullYear() && paidAt.getMonth() === date.getMonth()
    })
    return {
      month: monthFormatter.format(date).replace('.', ''),
      amount: monthPayments.reduce((sum, payment) => sum + payment.amount, 0)
    }
  })
}

dashboardRoutes.get(
  '/',
  asyncHandler(async (req, res) => {
    if (req.user!.role === UserRole.TEACHER) {
      const teacher = await prisma.teacher.findFirst({ where: { userId: req.user!.id, institutionId: req.institutionId! } })
      const today = new Date().getDay() || 7
      const assignmentsRows = teacher
        ? await prisma.teacherAssignment.findMany({
            where: { teacherId: teacher.id },
            include: { classroom: true, subject: true }
          })
        : []
      const classroomIds = [...new Set(assignmentsRows.map((assignment) => assignment.classroomId))]
      const [students, gradesCount, recentAbsences, todaySchedule, urgentMessages, penalties, salaries] = await Promise.all([
        classroomIds.length ? prisma.student.count({ where: { institutionId: req.institutionId!, classroomId: { in: classroomIds } } }) : 0,
        teacher ? prisma.grade.count({ where: { teacherId: teacher.id } }) : 0,
        classroomIds.length
          ? prisma.studentAttendance.count({
              where: {
                institutionId: req.institutionId!,
                status: { in: ['ABSENT', 'LATE'] },
                createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
                student: { classroomId: { in: classroomIds } }
              }
            })
          : 0,
        teacher
          ? prisma.scheduleSlot.findMany({
              where: { institutionId: req.institutionId!, teacherId: teacher.id, dayOfWeek: today },
              include: { classroom: true, subject: true },
              orderBy: { startsAt: 'asc' }
            })
          : [],
        prisma.conversation.count({ where: { institutionId: req.institutionId!, members: { some: { userId: req.user!.id } } } }),
        teacher ? prisma.teacherPenalty.aggregate({ where: { teacherId: teacher.id }, _sum: { amount: true } }) : null,
        teacher ? prisma.teacherSalary.findMany({ where: { teacherId: teacher.id }, orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 1 }) : []
      ])
      return res.json({
        role: req.user!.role,
        assignments: assignmentsRows.length,
        totalStudents: students,
        gradesCount,
        recentAbsences,
        todaySchedule,
        urgentMessages,
        penalties: penalties?._sum.amount ?? 0,
        salary: salaries[0] ?? null
      })
    }

    if (req.user!.role === UserRole.PARENT) {
      const parent = await prisma.parent.findFirst({ where: { userId: req.user!.id, institutionId: req.institutionId! } })
      const children = parent ? await prisma.studentParent.count({ where: { parentId: parent.id } }) : 0
      return res.json({ role: req.user!.role, children })
    }

    if (req.user!.role === UserRole.CENTRAL_ADMIN) {
      return res.json(await buildCentralDashboard(req.institutionId!))
    }

    const seriesStart = new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1)
    const establishmentId = getScopedEstablishmentId(req)
    const studentScope = establishmentId ? { establishmentId } : undefined
    const paymentScope = establishmentId ? { invoice: { student: { establishmentId } } } : undefined
    const [students, teachers, classes, unpaidInvoices, paidInvoices, recentAbsences, institution, lowStock, urgentMessages, monthlyPayments] = await Promise.all([
      prisma.student.count({ where: { institutionId: req.institutionId!, ...studentScope } }),
      prisma.teacher.count({ where: { institutionId: req.institutionId!, ...studentScope } }),
      prisma.classroom.count({ where: { institutionId: req.institutionId!, ...studentScope } }),
      prisma.invoice.count({
        where: {
          institutionId: req.institutionId!,
          status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
          student: studentScope
        }
      }),
      prisma.payment.aggregate({ where: { institutionId: req.institutionId!, status: PaymentStatus.PAID, ...paymentScope }, _sum: { amount: true } }),
      prisma.studentAttendance.count({
        where: {
          institutionId: req.institutionId!,
          status: { in: ['ABSENT', 'LATE'] },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          student: studentScope
        }
      }),
      prisma.institution.findUnique({ where: { id: req.institutionId! } }),
      prisma.product.findMany({ where: { institutionId: req.institutionId!, isActive: true } }),
      prisma.conversation.count({ where: { institutionId: req.institutionId!, type: 'SUPPORT' } }),
      prisma.payment.findMany({
        where: { institutionId: req.institutionId!, status: PaymentStatus.PAID, paidAt: { gte: seriesStart }, ...paymentScope },
        select: { amount: true, paidAt: true }
      })
    ])

    res.json({
      role: req.user!.role,
      students,
      teachers,
      classes,
      unpaidInvoices,
      totalStudents: students,
      totalTeachers: teachers,
      totalClasses: classes,
      pendingInvoices: unpaidInvoices,
      paidInvoices: paidInvoices._sum.amount ?? 0,
      recentAbsences,
      institution,
      lowStock: lowStock.filter((product) => product.quantity <= product.lowStockAlert).length,
      urgentMessages,
      monthlyPayments: buildMonthlyPayments(monthlyPayments)
    })
  })
)
