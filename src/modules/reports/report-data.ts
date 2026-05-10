import { prisma } from '../../config/prisma'
import { PaymentStatus, StaffAttendanceStatus, StaffPenaltyStatus } from '@prisma/client'

export interface ReportFilters {
  institutionId: string
  startDate: Date
  endDate: Date
  classroomId?: string
  classroomIds?: string[]
  teacherId?: string
  subjectId?: string
  subjectIds?: string[]
  academicYearId?: string
}

function classScope(filters: ReportFilters) {
  if (filters.classroomId) return filters.classroomId
  if (filters.classroomIds?.length) return { in: filters.classroomIds }
  return undefined
}

function subjectScope(filters: ReportFilters) {
  if (filters.subjectId) return filters.subjectId
  if (filters.subjectIds?.length) return { in: filters.subjectIds }
  return undefined
}

function eachMonthBetween(start: Date, end: Date): { label: string; year: number; month: number }[] {
  const months: { label: string; year: number; month: number }[] = []
  const cur = new Date(start.getFullYear(), start.getMonth(), 1)
  while (cur <= end) {
    months.push({
      label: cur.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
      year: cur.getFullYear(),
      month: cur.getMonth()
    })
    cur.setMonth(cur.getMonth() + 1)
  }
  return months
}

export async function fetchSummarySection(filters: ReportFilters) {
  const { institutionId, startDate, endDate } = filters
  const [institution, students, teachers, classrooms, activeUsers, academicYear, newStudentsThisPeriod, payments] = await Promise.all([
    prisma.institution.findUnique({ where: { id: institutionId } }),
    prisma.student.count({ where: { institutionId, status: 'ACTIVE' } }),
    prisma.teacher.count({ where: { institutionId, status: 'ACTIVE' } }),
    prisma.classroom.count({ where: { institutionId } }),
    prisma.user.count({ where: { institutionId, isActive: true, lastLoginAt: { gte: startDate } } }),
    filters.academicYearId
      ? prisma.academicYear.findUnique({ where: { id: filters.academicYearId } })
      : prisma.academicYear.findFirst({ where: { institutionId, isActive: true } }),
    prisma.student.count({ where: { institutionId, createdAt: { gte: startDate, lte: endDate } } }),
    prisma.payment.aggregate({
      where: { institutionId, status: PaymentStatus.PAID, paidAt: { gte: startDate, lte: endDate } },
      _sum: { amount: true }
    })
  ])

  return {
    institution,
    students,
    teachers,
    classrooms,
    activeUsers,
    academicYear,
    startDate,
    endDate,
    newStudentsThisPeriod,
    totalCollected: payments._sum.amount ?? 0
  }
}

export async function fetchFinanceSection(filters: ReportFilters) {
  const { institutionId, startDate, endDate } = filters

  const [allPayments, allInvoices, lateInvoices] = await Promise.all([
    prisma.payment.findMany({
      where: { institutionId, status: PaymentStatus.PAID, paidAt: { gte: startDate, lte: endDate } },
      select: { amount: true, paidAt: true }
    }),
    prisma.invoice.findMany({
      where: { institutionId, createdAt: { gte: startDate, lte: endDate } },
      select: { totalAmount: true, paidAmount: true, status: true }
    }),
    prisma.invoice.count({
      where: { institutionId, status: 'OVERDUE', dueDate: { lte: new Date() } }
    })
  ])

  const totalDue = allInvoices.reduce((s, i) => s + i.totalAmount, 0)
  const totalPaid = allInvoices.reduce((s, i) => s + i.paidAmount, 0)
  const remaining = totalDue - totalPaid
  const collected = allPayments.reduce((s, p) => s + p.amount, 0)

  const byStatus: Record<string, number> = {}
  for (const inv of allInvoices) {
    byStatus[inv.status] = (byStatus[inv.status] ?? 0) + 1
  }

  const months = eachMonthBetween(startDate, endDate)
  const monthlyTrend = months.map(({ label, year, month }) => {
    const monthPayments = allPayments.filter(p => {
      if (!p.paidAt) return false
      const d = new Date(p.paidAt)
      return d.getFullYear() === year && d.getMonth() === month
    })
    return { label, collected: monthPayments.reduce((s, p) => s + p.amount, 0) }
  })

  const collectionRate = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0

  return {
    collected,
    totalDue,
    totalPaid,
    remaining,
    lateInvoices,
    byStatus,
    invoicesGenerated: allInvoices.length,
    monthlyTrend,
    collectionRate
  }
}

export async function fetchPedagogySection(filters: ReportFilters) {
  const { institutionId, startDate, endDate } = filters

  // Use GradePeriod to scope grade periods in date range
  const periods = await prisma.gradePeriod.findMany({
    where: {
      institutionId,
      startsAt: { gte: startDate },
      endsAt: { lte: endDate },
      ...(filters.academicYearId ? { academicYearId: filters.academicYearId } : {})
    },
    select: { id: true }
  })
  const periodIds = periods.map(p => p.id)

  const gradeWhere: Record<string, unknown> = {
    institutionId,
    ...(periodIds.length > 0 ? { periodId: { in: periodIds } } : { createdAt: { gte: startDate, lte: endDate } }),
    ...(subjectScope(filters) ? { subjectId: subjectScope(filters) } : {}),
    ...(classScope(filters) ? { student: { classroomId: classScope(filters) } } : {})
  }

  const grades = await prisma.grade.findMany({
    where: gradeWhere,
    include: {
      subject: { select: { id: true, name: true, coefficient: true } },
      student: { select: { id: true, firstName: true, lastName: true, classroomId: true } }
    }
  })

  if (grades.length === 0) {
    return {
      averageGrade: 0,
      bySubject: [],
      byClassroom: [],
      topStudents: [],
      weakStudents: [],
      gradeDistribution: [],
      successRate: 0,
      totalEvaluations: 0
    }
  }

  const passingScore = 10

  const bySubjectMap: Record<string, { name: string; total: number; count: number }> = {}
  for (const g of grades) {
    const sId = g.subjectId
    if (!bySubjectMap[sId]) bySubjectMap[sId] = { name: g.subject.name, total: 0, count: 0 }
    bySubjectMap[sId].total += (g.score / g.maxScore) * 20
    bySubjectMap[sId].count++
  }
  const bySubject = Object.values(bySubjectMap).map(s => ({
    ...s,
    average: Math.round((s.total / s.count) * 10) / 10
  }))

  const studentAvgs: Record<string, { name: string; weightedSum: number; totalCoef: number; classroomId: string | null }> = {}
  for (const g of grades) {
    const sId = g.studentId
    if (!studentAvgs[sId]) {
      studentAvgs[sId] = {
        name: `${g.student.firstName} ${g.student.lastName}`,
        weightedSum: 0,
        totalCoef: 0,
        classroomId: g.student.classroomId
      }
    }
    const coef = g.subject.coefficient ?? 1
    studentAvgs[sId].weightedSum += (g.score / g.maxScore) * 20 * coef
    studentAvgs[sId].totalCoef += coef
  }

  const ranked = Object.values(studentAvgs)
    .map(s => ({ ...s, average: s.totalCoef > 0 ? Math.round((s.weightedSum / s.totalCoef) * 10) / 10 : 0 }))
    .sort((a, b) => b.average - a.average)

  const overallAvg = ranked.length > 0
    ? Math.round((ranked.reduce((s, r) => s + r.average, 0) / ranked.length) * 10) / 10
    : 0

  const successRate = ranked.length ? Math.round((ranked.filter(s => s.average >= passingScore).length / ranked.length) * 100) : 0

  const buckets = [
    { label: '0-4', min: 0, max: 4, count: 0 },
    { label: '5-9', min: 5, max: 9, count: 0 },
    { label: '10-11', min: 10, max: 11, count: 0 },
    { label: '12-13', min: 12, max: 13, count: 0 },
    { label: '14-15', min: 14, max: 15, count: 0 },
    { label: '16-17', min: 16, max: 17, count: 0 },
    { label: '18-20', min: 18, max: 20, count: 0 },
  ]
  for (const s of ranked) {
    const bucket = buckets.find(b => s.average >= b.min && s.average <= b.max)
    if (bucket) bucket.count++
  }

  const classrooms = await prisma.classroom.findMany({ where: { institutionId }, select: { id: true, name: true } })
  const clsMap = Object.fromEntries(classrooms.map(c => [c.id, c.name]))
  const byClassroomMap: Record<string, { name: string; total: number; count: number }> = {}
  for (const s of ranked) {
    const cId = s.classroomId ?? 'unknown'
    if (!byClassroomMap[cId]) byClassroomMap[cId] = { name: clsMap[cId] ?? 'Inconnue', total: 0, count: 0 }
    byClassroomMap[cId].total += s.average
    byClassroomMap[cId].count++
  }
  const byClassroom = Object.entries(byClassroomMap).map(([id, v]) => ({
    classroomId: id,
    name: v.name,
    average: Math.round((v.total / v.count) * 10) / 10,
    count: v.count
  }))

  return {
    averageGrade: overallAvg,
    bySubject,
    byClassroom,
    topStudents: ranked.slice(0, 10),
    weakStudents: ranked.slice(-10).reverse(),
    gradeDistribution: buckets,
    successRate,
    totalEvaluations: grades.length
  }
}

export async function fetchAttendanceSection(filters: ReportFilters) {
  const { institutionId, startDate, endDate } = filters

  const sessionWhere: Record<string, unknown> = {
    institutionId,
    scheduleSlotId: { not: null },
    date: { gte: startDate, lte: endDate }
  }
  if (classScope(filters)) sessionWhere['classroomId'] = classScope(filters)
  if (subjectScope(filters)) {
    sessionWhere['scheduleSlot'] = { subjectId: subjectScope(filters) }
  }

  const sessions = await prisma.attendanceSession.findMany({
    where: sessionWhere,
    include: {
      scheduleSlot: { include: { subject: true } },
      classroom: true,
      records: { include: { student: true } }
    }
  })

  const totals = { present: 0, absent: 0, late: 0, justified: 0, unjustified: 0, total: 0 }
  const byClassroom: Record<string, { name: string; absent: number; late: number; present: number }> = {}
  const bySubject: Record<string, { name: string; absent: number; late: number }> = {}
  const byStudent: Record<string, { name: string; count: number }> = {}
  const dailyMap: Record<string, { date: string; present: number; absent: number; late: number }> = {}

  for (const session of sessions) {
    const clsId = session.classroomId
    const clsName = session.classroom.name
    const subjectName = session.scheduleSlot?.subject?.name ?? 'Inconnue'
    const subjectId = session.scheduleSlot?.subjectId ?? 'unknown'
    const dateKey = new Date(session.date).toLocaleDateString('fr-FR')

    if (!byClassroom[clsId]) byClassroom[clsId] = { name: clsName, absent: 0, late: 0, present: 0 }
    if (!dailyMap[dateKey]) dailyMap[dateKey] = { date: dateKey, present: 0, absent: 0, late: 0 }

    for (const r of session.records) {
      totals.total++
      if (r.status === 'PRESENT') {
        totals.present++
        byClassroom[clsId].present++
        dailyMap[dateKey].present++
      } else if (r.status === 'ABSENT') {
        totals.absent++
        byClassroom[clsId].absent++
        dailyMap[dateKey].absent++
        if (!bySubject[subjectId]) bySubject[subjectId] = { name: subjectName, absent: 0, late: 0 }
        bySubject[subjectId].absent++
        const stName = `${r.student.firstName} ${r.student.lastName}`
        if (!byStudent[r.studentId]) byStudent[r.studentId] = { name: stName, count: 0 }
        byStudent[r.studentId].count++
      } else if (r.status === 'LATE') {
        totals.late++
        byClassroom[clsId].late++
        dailyMap[dateKey].late++
        if (!bySubject[subjectId]) bySubject[subjectId] = { name: subjectName, absent: 0, late: 0 }
        bySubject[subjectId].late++
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

  const attendanceRate = totals.total > 0 ? Math.round((totals.present / totals.total) * 100) : 100
  const mostAbsent = Object.values(byStudent).sort((a, b) => b.count - a.count).slice(0, 10)
  const dailyTrend = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date))

  return {
    ...totals,
    attendanceRate,
    byClassroom: Object.values(byClassroom),
    bySubject: Object.values(bySubject),
    mostAbsentStudents: mostAbsent,
    dailyTrend,
    totalSessions: sessions.length
  }
}

export async function fetchTeachersSection(filters: ReportFilters) {
  const { institutionId, startDate, endDate } = filters

  const [badges, salaries, teachers, scheduledSlots, teacherAttendance, assignments] = await Promise.all([
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
      select: { id: true, firstName: true, lastName: true }
    }),
    prisma.scheduleSlot.count({ where: { institutionId } }),
    prisma.teacherAttendance.findMany({
      where: { institutionId, createdAt: { gte: startDate, lte: endDate } },
      include: { teacher: true }
    }),
    prisma.teacherAssignment.findMany({
      where: { institutionId },
      select: { teacherId: true, subjectId: true, classroomId: true }
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

  const loadByTeacher: Record<string, number> = {}
  for (const a of assignments) {
    loadByTeacher[a.teacherId] = (loadByTeacher[a.teacherId] ?? 0) + 1
  }
  const teacherLoad = teachers.map(t => ({
    id: t.id,
    name: `${t.firstName} ${t.lastName}`,
    assignmentsCount: loadByTeacher[t.id] ?? 0
  })).sort((a, b) => b.assignmentsCount - a.assignmentsCount)

  const punctualityRate = teacherAttendance.length > 0
    ? Math.round((teacherAttendance.filter(ta => ta.status === 'PRESENT').length / teacherAttendance.length) * 100)
    : 100

  return {
    totalTeachers: teachers.length,
    scheduledSlots,
    teacherStats: Object.values(byTeacher),
    badgeStats: Object.values(badgesByTeacher).sort((a, b) => b.lateMinutes - a.lateMinutes),
    totalBadges: badges.length,
    salaries: salaries.length,
    teacherLoad,
    punctualityRate
  }
}

export async function fetchStaffSection(filters: ReportFilters, includePayroll = false) {
  const { institutionId, startDate, endDate } = filters

  const [staff, attendance, penalties, justifications, contracts, adjustments] = await Promise.all([
    prisma.staffMember.findMany({
      where: { institutionId, status: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true, matricule: true, position: true, customPosition: true, baseSalary: true }
    }),
    prisma.staffAttendance.findMany({
      where: { institutionId, date: { gte: startDate, lte: endDate } },
      include: { staff: { select: { id: true, firstName: true, lastName: true, position: true, customPosition: true, baseSalary: true } } }
    }),
    prisma.staffPenalty.findMany({
      where: { institutionId, createdAt: { gte: startDate, lte: endDate } },
      include: { staff: { select: { id: true, firstName: true, lastName: true } } }
    }),
    prisma.staffJustification.findMany({
      where: { institutionId, createdAt: { gte: startDate, lte: endDate } },
      select: { status: true }
    }),
    prisma.staffContract.count({ where: { institutionId, status: { in: ['ACTIVE', 'SIGNED'] } } }),
    includePayroll
      ? prisma.staffSalaryAdjustment.findMany({ where: { institutionId, createdAt: { gte: startDate, lte: endDate } } })
      : Promise.resolve([])
  ])

  const byRole: Record<string, number> = {}
  for (const member of staff) {
    const role = member.customPosition ?? member.position
    byRole[role] = (byRole[role] ?? 0) + 1
  }

  const byStaff: Record<string, {
    name: string
    present: number
    late: number
    absent: number
    earlyDeparture: number
    penalties: number
    baseSalary: number
    netSalary: number
  }> = {}
  for (const member of staff) {
    byStaff[member.id] = {
      name: `${member.firstName} ${member.lastName}`,
      present: 0,
      late: 0,
      absent: 0,
      earlyDeparture: 0,
      penalties: 0,
      baseSalary: includePayroll ? member.baseSalary : 0,
      netSalary: includePayroll ? member.baseSalary : 0
    }
  }

  for (const row of attendance) {
    if (!byStaff[row.staffId] && row.staff) {
      byStaff[row.staffId] = {
        name: `${row.staff.firstName} ${row.staff.lastName}`,
        present: 0,
        late: 0,
        absent: 0,
        earlyDeparture: 0,
        penalties: 0,
        baseSalary: includePayroll ? row.staff.baseSalary : 0,
        netSalary: includePayroll ? row.staff.baseSalary : 0
      }
    }
    if (row.status === StaffAttendanceStatus.PRESENT) byStaff[row.staffId].present++
    if (row.status === StaffAttendanceStatus.LATE) byStaff[row.staffId].late++
    if (row.status === StaffAttendanceStatus.ABSENT) byStaff[row.staffId].absent++
    if (row.status === StaffAttendanceStatus.EARLY_DEPARTURE) byStaff[row.staffId].earlyDeparture++
  }

  const appliedPenalties = penalties.filter((penalty) => penalty.status === StaffPenaltyStatus.APPLIED)
  if (includePayroll) {
    for (const penalty of appliedPenalties) {
      if (byStaff[penalty.staffId]) {
        byStaff[penalty.staffId].penalties += penalty.amount
        byStaff[penalty.staffId].netSalary -= penalty.amount
      }
    }
    for (const adjustment of adjustments) {
      if (!byStaff[adjustment.staffId]) continue
      byStaff[adjustment.staffId].netSalary += adjustment.kind === 'BONUS' ? adjustment.amount : -adjustment.amount
    }
  }

  const totals = {
    present: attendance.filter((row) => row.status === StaffAttendanceStatus.PRESENT).length,
    late: attendance.filter((row) => row.status === StaffAttendanceStatus.LATE).length,
    absent: attendance.filter((row) => row.status === StaffAttendanceStatus.ABSENT).length,
    earlyDeparture: attendance.filter((row) => row.status === StaffAttendanceStatus.EARLY_DEPARTURE).length
  }
  const controlled = totals.present + totals.late + totals.absent + totals.earlyDeparture
  const punctualityRate = controlled > 0 ? Math.round((totals.present / controlled) * 100) : 100

  const justificationStats = justifications.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1
    return acc
  }, {})

  const staffRows = Object.values(byStaff)
  return {
    totalStaff: staff.length,
    ...totals,
    punctualityRate,
    penaltiesApplied: appliedPenalties.length,
    penaltyAmount: includePayroll ? appliedPenalties.reduce((sum, item) => sum + item.amount, 0) : 0,
    grossSalary: includePayroll ? staffRows.reduce((sum, item) => sum + item.baseSalary, 0) : 0,
    netSalary: includePayroll ? staffRows.reduce((sum, item) => sum + item.netSalary, 0) : 0,
    contractsActive: contracts,
    byRole,
    justificationStats,
    attendanceByStaff: staffRows.sort((a, b) => (b.late + b.absent) - (a.late + a.absent)).slice(0, 20),
    salaryByStaff: includePayroll ? staffRows.sort((a, b) => b.netSalary - a.netSalary).slice(0, 20) : [],
    payrollVisible: includePayroll
  }
}

export async function fetchDisciplineSection(filters: ReportFilters) {
  const { institutionId, startDate, endDate } = filters

  const [records, scores, atRiskCount] = await Promise.all([
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

  const avgScore = scores.length ? Math.round(scores.reduce((s, d) => s + d.score, 0) / scores.length) : 100

  const byKind: Record<string, number> = {}
  for (const r of records) {
    byKind[r.kind] = (byKind[r.kind] ?? 0) + 1
  }

  const months = eachMonthBetween(startDate, endDate)
  const monthlyTrend = months.map(({ label, year, month }) => ({
    label,
    incidents: records.filter(r => {
      const d = new Date(r.createdAt)
      return d.getFullYear() === year && d.getMonth() === month
    }).length
  }))

  const scoreBuckets = [
    { label: '0-19', count: 0 },
    { label: '20-39', count: 0 },
    { label: '40-59', count: 0 },
    { label: '60-79', count: 0 },
    { label: '80-100', count: 0 },
  ]
  for (const s of scores) {
    const idx = Math.min(Math.floor(s.score / 20), 4)
    scoreBuckets[idx].count++
  }

  return {
    incidents: records.length,
    sanctions: records.filter(r => r.kind === 'SANCTION' || r.kind === 'WARNING').length,
    rewards: records.filter(r => r.kind === 'GOOD_POINT').length,
    averageScore: avgScore,
    atRiskStudents: atRiskCount,
    lowScoreStudents: scores.filter(s => s.score < 60).length,
    byKind,
    monthlyTrend,
    scoreDistribution: scoreBuckets
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

  const daysLost = events.reduce((sum, e) => {
    const diff = Math.ceil((e.endsAt.getTime() - e.startsAt.getTime()) / (1000 * 60 * 60 * 24)) + 1
    return sum + diff
  }, 0)

  return {
    total: events.length,
    byType,
    daysLost,
    events: events.map(e => ({ title: e.title, type: e.type, startsAt: e.startsAt, endsAt: e.endsAt }))
  }
}

export async function fetchAdminSection(filters: ReportFilters) {
  const { institutionId, startDate, endDate } = filters

  const [newStudents, admissions, reEnrollments, transfersIn, departures, documents, officialDocuments, classrooms] = await Promise.all([
    prisma.student.count({ where: { institutionId, createdAt: { gte: startDate, lte: endDate } } }),
    prisma.student.count({ where: { institutionId, enrollmentKind: 'NEW', createdAt: { gte: startDate, lte: endDate } } }),
    prisma.student.count({ where: { institutionId, enrollmentKind: 'RENEWAL', createdAt: { gte: startDate, lte: endDate } } }),
    prisma.student.count({ where: { institutionId, enrollmentKind: 'TRANSFER', createdAt: { gte: startDate, lte: endDate } } }),
    prisma.student.count({ where: { institutionId, status: { in: ['INACTIVE', 'TRANSFERRED', 'SUSPENDED', 'GRADUATED'] }, updatedAt: { gte: startDate, lte: endDate } } }),
    prisma.document.count({ where: { institutionId, createdAt: { gte: startDate, lte: endDate } } }),
    prisma.pdfDocument.findMany({
      where: { institutionId, createdAt: { gte: startDate, lte: endDate } },
      select: { type: true }
    }),
    prisma.classroom.findMany({
      where: { institutionId },
      select: {
        id: true,
        name: true,
        capacity: true,
        _count: { select: { students: true } }
      }
    })
  ])

  const byOfficialDocumentType: Record<string, number> = {}
  for (const doc of officialDocuments) {
    byOfficialDocumentType[doc.type] = (byOfficialDocumentType[doc.type] ?? 0) + 1
  }

  const classroomEnrollments = classrooms.map(c => ({
    classroomId: c.id,
    name: c.name,
    enrolled: c._count.students,
    capacity: c.capacity ?? 0,
    fillRate: c.capacity ? Math.round((c._count.students / c.capacity) * 100) : 0
  }))

  return {
    newStudents,
    admissions,
    reEnrollments,
    transfersIn,
    departures,
    documents,
    officialDocuments: officialDocuments.length,
    byOfficialDocumentType,
    certificatesGenerated:
      (byOfficialDocumentType.SCHOOL_CERTIFICATE ?? 0) +
      (byOfficialDocumentType.ENROLLMENT_CERTIFICATE ?? 0) +
      (byOfficialDocumentType.PRESENCE_CERTIFICATE ?? 0),
    attestationsGenerated:
      (byOfficialDocumentType.SCHOOL_CERTIFICATE ?? 0) +
      (byOfficialDocumentType.PRESENCE_CERTIFICATE ?? 0),
    classroomEnrollments,
    totalClassrooms: classrooms.length
  }
}
