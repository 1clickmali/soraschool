import { prisma } from '../../config/prisma'
import { PaymentStatus } from '@prisma/client'

export interface ReportFilters {
  institutionId: string
  startDate: Date
  endDate: Date
  classroomId?: string
  teacherId?: string
  subjectId?: string
  academicYearId?: string
}

export async function fetchSummarySection(filters: ReportFilters) {
  const { institutionId, startDate, endDate } = filters
  const [institution, students, teachers, classrooms, activeUsers, academicYear] = await Promise.all([
    prisma.institution.findUnique({ where: { id: institutionId } }),
    prisma.student.count({ where: { institutionId, status: 'ACTIVE' } }),
    prisma.teacher.count({ where: { institutionId, status: 'ACTIVE' } }),
    prisma.classroom.count({ where: { institutionId } }),
    prisma.user.count({ where: { institutionId, isActive: true, lastLoginAt: { gte: startDate } } }),
    filters.academicYearId
      ? prisma.academicYear.findUnique({ where: { id: filters.academicYearId } })
      : prisma.academicYear.findFirst({ where: { institutionId, isActive: true } })
  ])
  return { institution, students, teachers, classrooms, activeUsers, academicYear, startDate, endDate }
}

export async function fetchFinanceSection(filters: ReportFilters) {
  const { institutionId, startDate, endDate } = filters
  const paymentWhere = {
    institutionId,
    status: PaymentStatus.PAID,
    paidAt: { gte: startDate, lte: endDate }
  } as const
  const [collected, allInvoices, lateInvoices] = await Promise.all([
    prisma.payment.aggregate({ where: paymentWhere, _sum: { amount: true } }),
    prisma.invoice.findMany({
      where: { institutionId, createdAt: { gte: startDate, lte: endDate } },
      select: { totalAmount: true, paidAmount: true, status: true }
    }),
    prisma.invoice.count({
      where: { institutionId, status: 'OVERDUE', createdAt: { gte: startDate, lte: endDate } }
    })
  ])

  const totalDue = allInvoices.reduce((s, i) => s + i.totalAmount, 0)
  const totalPaid = allInvoices.reduce((s, i) => s + i.paidAmount, 0)
  const remaining = totalDue - totalPaid

  const byStatus: Record<string, number> = {}
  for (const inv of allInvoices) {
    byStatus[inv.status] = (byStatus[inv.status] ?? 0) + 1
  }

  return {
    collected: collected._sum.amount ?? 0,
    totalDue,
    totalPaid,
    remaining,
    lateInvoices,
    byStatus,
    invoicesGenerated: allInvoices.length
  }
}

export async function fetchPedagogySection(filters: ReportFilters) {
  const { institutionId, startDate, endDate, classroomId, subjectId } = filters
  const gradeWhere: Record<string, unknown> = {
    institutionId,
    createdAt: { gte: startDate, lte: endDate }
  }
  if (classroomId) gradeWhere['student'] = { classroomId }
  if (subjectId) gradeWhere['subjectId'] = subjectId

  const grades = await prisma.grade.findMany({
    where: gradeWhere,
    include: { subject: true, student: { include: { classroom: true } } }
  })

  if (grades.length === 0) {
    return { averageGrade: 0, bySubject: [], topStudents: [], weakStudents: [], missingGrades: 0, successRate: 0 }
  }

  const avg = grades.reduce((s, g) => s + (g.score / g.maxScore) * 20, 0) / grades.length

  const bySubjectMap: Record<string, { name: string; total: number; count: number }> = {}
  for (const g of grades) {
    const sId = g.subjectId
    if (!bySubjectMap[sId]) bySubjectMap[sId] = { name: g.subject.name, total: 0, count: 0 }
    bySubjectMap[sId].total += (g.score / g.maxScore) * 20
    bySubjectMap[sId].count++
  }
  const bySubject = Object.values(bySubjectMap).map((s) => ({ ...s, average: s.total / s.count }))

  const studentAvgs: Record<string, { name: string; total: number; count: number }> = {}
  for (const g of grades) {
    const sId = g.studentId
    if (!studentAvgs[sId]) {
      studentAvgs[sId] = { name: `${g.student.firstName} ${g.student.lastName}`, total: 0, count: 0 }
    }
    studentAvgs[sId].total += (g.score / g.maxScore) * 20
    studentAvgs[sId].count++
  }
  const ranked = Object.values(studentAvgs)
    .map((s) => ({ ...s, average: s.total / s.count }))
    .sort((a, b) => b.average - a.average)

  const successRate = ranked.length ? (ranked.filter((s) => s.average >= 10).length / ranked.length) * 100 : 0

  return {
    averageGrade: avg,
    bySubject,
    topStudents: ranked.slice(0, 10),
    weakStudents: ranked.slice(-10).reverse(),
    missingGrades: 0,
    successRate
  }
}

export async function fetchAttendanceSection(filters: ReportFilters) {
  const { institutionId, startDate, endDate, classroomId } = filters

  // StudentAttendance is linked via session → scheduleSlot (strict schedule link)
  const sessionWhere: Record<string, unknown> = {
    institutionId,
    scheduleSlotId: { not: null },
    date: { gte: startDate, lte: endDate }
  }
  if (classroomId) sessionWhere['classroomId'] = classroomId

  const sessions = await prisma.attendanceSession.findMany({
    where: sessionWhere,
    include: {
      scheduleSlot: { include: { subject: true } },
      classroom: true,
      records: { include: { student: true } }
    }
  })

  const totals = { present: 0, absent: 0, late: 0, justified: 0, unjustified: 0, total: 0 }
  const byClassroom: Record<string, { name: string; absent: number; late: number }> = {}
  const bySubject: Record<string, { name: string; absent: number; late: number }> = {}
  const byStudent: Record<string, { name: string; count: number }> = {}

  for (const session of sessions) {
    const clsId = session.classroomId
    const clsName = session.classroom.name
    const subjectName = session.scheduleSlot?.subject?.name ?? 'Inconnue'
    const subjectId = session.scheduleSlot?.subjectId ?? 'unknown'

    for (const r of session.records) {
      totals.total++
      if (r.status === 'PRESENT') {
        totals.present++
      } else if (r.status === 'ABSENT') {
        totals.absent++
        if (!byClassroom[clsId]) byClassroom[clsId] = { name: clsName, absent: 0, late: 0 }
        byClassroom[clsId].absent++
        if (!bySubject[subjectId]) bySubject[subjectId] = { name: subjectName, absent: 0, late: 0 }
        bySubject[subjectId].absent++
        const stName = `${r.student.firstName} ${r.student.lastName}`
        if (!byStudent[r.studentId]) byStudent[r.studentId] = { name: stName, count: 0 }
        byStudent[r.studentId].count++
      } else if (r.status === 'LATE') {
        totals.late++
        if (!byClassroom[clsId]) byClassroom[clsId] = { name: clsName, absent: 0, late: 0 }
        byClassroom[clsId].late++
      }
    }
  }

  const justifications = await prisma.absenceJustification.count({
    where: {
      attendance: {
        session: { institutionId, date: { gte: startDate, lte: endDate } }
      },
      status: 'APPROVED'
    }
  })
  totals.justified = Math.min(justifications, totals.absent)
  totals.unjustified = Math.max(0, totals.absent - totals.justified)

  const mostAbsent = Object.values(byStudent).sort((a, b) => b.count - a.count).slice(0, 10)

  return {
    ...totals,
    byClassroom: Object.values(byClassroom),
    bySubject: Object.values(bySubject),
    mostAbsentStudents: mostAbsent
  }
}

export async function fetchTeachersSection(filters: ReportFilters) {
  const { institutionId, startDate, endDate } = filters
  const [badges, salaries, teachers, scheduledSlots, teacherAttendance] = await Promise.all([
    prisma.teacherBadge.findMany({
      where: { institutionId, date: { gte: startDate, lte: endDate } },
      include: { teacher: true }
    }),
    prisma.teacherSalary.findMany({
      where: { teacher: { institutionId } },
      include: { teacher: true }
    }),
    prisma.teacher.findMany({
      where: { institutionId, status: 'ACTIVE' },
      include: { assignments: { include: { subject: true, classroom: true } } }
    }),
    prisma.scheduleSlot.count({ where: { institutionId } }),
    prisma.teacherAttendance.findMany({
      where: { institutionId, createdAt: { gte: startDate, lte: endDate } },
      include: { teacher: true }
    })
  ])

  const byTeacher: Record<string, { name: string; present: number; absent: number; late: number }> = {}
  for (const ta of teacherAttendance) {
    const tId = ta.teacherId
    if (!byTeacher[tId]) {
      byTeacher[tId] = { name: `${ta.teacher.firstName} ${ta.teacher.lastName}`, present: 0, absent: 0, late: 0 }
    }
    if (ta.status === 'PRESENT') byTeacher[tId].present++
    else if (ta.status === 'ABSENT') byTeacher[tId].absent++
    else if (ta.status === 'LATE') byTeacher[tId].late++
  }

  const badgesByTeacher: Record<string, { name: string; lateMinutes: number; checkIns: number }> = {}
  for (const b of badges) {
    const tId = b.teacherId
    if (!badgesByTeacher[tId]) {
      badgesByTeacher[tId] = { name: `${b.teacher.firstName} ${b.teacher.lastName}`, lateMinutes: 0, checkIns: 0 }
    }
    badgesByTeacher[tId].lateMinutes += b.lateMinutes
    badgesByTeacher[tId].checkIns++
  }

  return {
    totalTeachers: teachers.length,
    scheduledSlots,
    teacherStats: Object.values(byTeacher),
    badgeStats: Object.values(badgesByTeacher),
    totalBadges: badges.length,
    salaries: salaries.length
  }
}

export async function fetchDisciplineSection(filters: ReportFilters) {
  const { institutionId, startDate, endDate } = filters
  const [records, scores, atRiskStudents] = await Promise.all([
    prisma.disciplineRecord.findMany({
      where: { institutionId, createdAt: { gte: startDate, lte: endDate } },
      include: { student: true }
    }),
    prisma.disciplineScore.findMany({
      where: { institutionId },
      include: { student: true }
    }),
    prisma.disciplineScore.count({ where: { institutionId, atRisk: true } })
  ])

  const avgScore = scores.length ? scores.reduce((s, d) => s + d.score, 0) / scores.length : 100

  const byKind: Record<string, number> = {}
  for (const r of records) {
    byKind[r.kind] = (byKind[r.kind] ?? 0) + 1
  }

  return {
    incidents: records.length,
    sanctions: records.filter((r) => r.kind === 'SANCTION' || r.kind === 'WARNING').length,
    rewards: records.filter((r) => r.kind === 'GOOD_POINT').length,
    averageScore: avgScore,
    atRiskStudents,
    lowScoreStudents: scores.filter((s) => s.score < 60).length,
    byKind
  }
}

export async function fetchCalendarSection(filters: ReportFilters) {
  const { institutionId, startDate, endDate } = filters
  const events = await prisma.holidayLeave.findMany({
    where: { institutionId, startsAt: { gte: startDate }, endsAt: { lte: endDate } }
  })

  const byType: Record<string, number> = {}
  for (const e of events) {
    byType[e.type] = (byType[e.type] ?? 0) + 1
  }

  return { total: events.length, byType }
}

export async function fetchAdminSection(filters: ReportFilters) {
  const { institutionId, startDate, endDate } = filters
  const [newStudents, documents] = await Promise.all([
    prisma.student.count({ where: { institutionId, createdAt: { gte: startDate, lte: endDate } } }),
    prisma.document.count({ where: { institutionId, createdAt: { gte: startDate, lte: endDate } } })
  ])
  return { newStudents, documents }
}
