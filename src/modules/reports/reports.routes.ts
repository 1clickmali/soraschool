import { Router } from 'express'
import { z } from 'zod'
import { UserRole, ExportFormat, ReportType } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { validate } from '../../middlewares/validate'
import { forbidden } from '../../lib/errors'
import { authenticate } from '../../middlewares/auth'
import { requireTenantUser } from '../../middlewares/rbac'
import { requireRoles } from '../../middlewares/rbac'
import {
  fetchSummarySection,
  fetchFinanceSection,
  fetchPedagogySection,
  fetchAttendanceSection,
  fetchTeachersSection,
  fetchDisciplineSection,
  fetchCalendarSection,
  fetchAdminSection,
  type ReportFilters
} from './report-data'
import { streamReportPdf } from './report-pdf'
import { streamReportExcel } from './report-excel'

export const reportsRoutes = Router()
reportsRoutes.use(authenticate, requireTenantUser)

const DIRECTOR_ROLES = [UserRole.DIRECTOR, UserRole.CENTRAL_ADMIN, UserRole.ADMINISTRATION] as const
const ACCOUNTANT_ROLES = [UserRole.ACCOUNTANT, ...DIRECTOR_ROLES] as const
const SECRETARIAT_ROLES = [UserRole.SECRETARIAT, ...DIRECTOR_ROLES] as const

const filtersSchema = z.object({
  query: z.object({
    startDate: z.string().datetime({ offset: true }).optional(),
    endDate: z.string().datetime({ offset: true }).optional(),
    reportType: z.nativeEnum(ReportType).optional().default('MONTHLY'),
    classroomId: z.string().optional(),
    teacherId: z.string().optional(),
    subjectId: z.string().optional(),
    academicYearId: z.string().optional(),
    sections: z.string().optional()
  })
})

function parseDateRange(query: { startDate?: string; endDate?: string; reportType?: ReportType }) {
  if (query.startDate && query.endDate) {
    return { startDate: new Date(query.startDate), endDate: new Date(query.endDate) }
  }
  const now = new Date()
  const type = query.reportType ?? 'MONTHLY'
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  let startDate: Date
  switch (type) {
    case 'DAILY':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      break
    case 'WEEKLY':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case 'MONTHLY':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case 'QUARTERLY': {
      const quarter = Math.floor(now.getMonth() / 3)
      startDate = new Date(now.getFullYear(), quarter * 3, 1)
      break
    }
    case 'SEMESTER': {
      startDate = now.getMonth() < 6
        ? new Date(now.getFullYear(), 0, 1)
        : new Date(now.getFullYear(), 6, 1)
      break
    }
    case 'ANNUAL':
    case 'SCHOOL_YEAR':
      startDate = new Date(now.getFullYear(), 0, 1)
      break
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
  }
  return { startDate, endDate }
}

function parseSections(sectionsParam: string | undefined): Set<string> {
  if (!sectionsParam) return new Set(['summary', 'finance', 'pedagogy', 'attendance', 'teachers', 'discipline', 'calendar', 'administrative'])
  return new Set(sectionsParam.split(',').map((s) => s.trim().toLowerCase()))
}

async function buildReportData(institutionId: string, filters: ReportFilters, sections: Set<string>, role: UserRole) {
  const result: Record<string, unknown> = {}

  const isDirector = DIRECTOR_ROLES.includes(role as (typeof DIRECTOR_ROLES)[number])
  const isAccountant = role === UserRole.ACCOUNTANT
  const isSecretariat = role === UserRole.SECRETARIAT
  const isTeacher = role === UserRole.TEACHER

  const canSeeAll = isDirector
  const canSeeFinance = isAccountant || isDirector
  const canSeeAdmin = isSecretariat || isDirector
  const canSeePedagogy = isTeacher || isDirector
  const canSeeAttendance = isTeacher || isDirector
  const canSeeDiscipline = isDirector
  const canSeeTeachers = isDirector

  if ((canSeeAll || sections.has('summary')) && isDirector) {
    result.summary = await fetchSummarySection(filters)
  }
  if (canSeeFinance && sections.has('finance')) {
    result.finance = await fetchFinanceSection(filters)
  }
  if (canSeePedagogy && sections.has('pedagogy')) {
    result.pedagogy = await fetchPedagogySection(filters)
  }
  if (canSeeAttendance && sections.has('attendance')) {
    result.attendance = await fetchAttendanceSection(filters)
  }
  if (canSeeTeachers && sections.has('teachers')) {
    result.teachers = await fetchTeachersSection(filters)
  }
  if (canSeeDiscipline && sections.has('discipline')) {
    result.discipline = await fetchDisciplineSection(filters)
  }
  if (isDirector && sections.has('calendar')) {
    result.calendar = await fetchCalendarSection(filters)
  }
  if (canSeeAdmin && sections.has('administrative')) {
    result.administrative = await fetchAdminSection(filters)
  }

  return result
}

// ── PREVIEW ──────────────────────────────────────────────────────────────────
reportsRoutes.get(
  '/preview',
  validate(filtersSchema),
  asyncHandler(async (req, res) => {
    const { institutionId } = req
    const { query } = req as unknown as { query: z.infer<typeof filtersSchema>['query'] }
    const role = req.user!.role

    const { startDate, endDate } = parseDateRange(query as { startDate?: string; endDate?: string; reportType?: ReportType })
    const sections = parseSections(query.sections)

    const filters: ReportFilters = {
      institutionId: institutionId!,
      startDate,
      endDate,
      classroomId: query.classroomId,
      teacherId: query.teacherId,
      subjectId: query.subjectId,
      academicYearId: query.academicYearId
    }

    const data = await buildReportData(institutionId!, filters, sections, role)
    res.json({ ok: true, data, meta: { startDate, endDate, reportType: query.reportType } })
  })
)

// ── EXPORT PDF ────────────────────────────────────────────────────────────────
reportsRoutes.get(
  '/export/pdf',
  validate(filtersSchema),
  asyncHandler(async (req, res) => {
    const { institutionId } = req
    const query = req.query as z.infer<typeof filtersSchema>['query']
    const role = req.user!.role

    if (role === UserRole.PARENT || role === UserRole.STUDENT) {
      throw forbidden('Export non autorisé pour ce rôle')
    }

    const { startDate, endDate } = parseDateRange(query as { startDate?: string; endDate?: string; reportType?: ReportType })
    const sections = parseSections(query.sections)
    const reportType = (query.reportType ?? 'MONTHLY') as ReportType

    const filters: ReportFilters = {
      institutionId: institutionId!,
      startDate,
      endDate,
      classroomId: query.classroomId,
      teacherId: query.teacherId,
      subjectId: query.subjectId,
      academicYearId: query.academicYearId
    }

    const institution = await prisma.institution.findUnique({ where: { id: institutionId! } })
    const sectionData = await buildReportData(institutionId!, filters, sections, role)

    const reportTitle = `Rapport_${reportType}_${institution?.name ?? 'École'}`
    const period = `${startDate.toLocaleDateString('fr-FR')} – ${endDate.toLocaleDateString('fr-FR')}`
    const generatedAt = new Date().toLocaleString('fr-FR')

    await prisma.exportLog.create({
      data: {
        institutionId: institutionId!,
        userId: req.user!.id,
        userRole: role,
        reportType,
        sections: Array.from(sections),
        format: ExportFormat.PDF,
        filters: { classroomId: query.classroomId, teacherId: query.teacherId },
        fileName: `${reportTitle}.pdf`,
        ipAddress: req.ip
      }
    })

    await streamReportPdf(res, { schoolName: institution?.name ?? 'École', period, generatedAt, reportTitle }, sectionData)
  })
)

// ── EXPORT EXCEL ──────────────────────────────────────────────────────────────
reportsRoutes.get(
  '/export/excel',
  validate(filtersSchema),
  asyncHandler(async (req, res) => {
    const { institutionId } = req
    const query = req.query as z.infer<typeof filtersSchema>['query']
    const role = req.user!.role

    if (role === UserRole.PARENT || role === UserRole.STUDENT) {
      throw forbidden('Export non autorisé pour ce rôle')
    }

    const { startDate, endDate } = parseDateRange(query as { startDate?: string; endDate?: string; reportType?: ReportType })
    const sections = parseSections(query.sections)
    const reportType = (query.reportType ?? 'MONTHLY') as ReportType

    const filters: ReportFilters = {
      institutionId: institutionId!,
      startDate,
      endDate,
      classroomId: query.classroomId,
      teacherId: query.teacherId,
      subjectId: query.subjectId,
      academicYearId: query.academicYearId
    }

    const institution = await prisma.institution.findUnique({ where: { id: institutionId! } })
    const sectionData = await buildReportData(institutionId!, filters, sections, role)

    const reportTitle = `Rapport_${reportType}_${institution?.name ?? 'École'}`
    const period = `${startDate.toLocaleDateString('fr-FR')} – ${endDate.toLocaleDateString('fr-FR')}`
    const generatedAt = new Date().toLocaleString('fr-FR')

    await prisma.exportLog.create({
      data: {
        institutionId: institutionId!,
        userId: req.user!.id,
        userRole: role,
        reportType,
        sections: Array.from(sections),
        format: ExportFormat.EXCEL,
        filters: { classroomId: query.classroomId, teacherId: query.teacherId },
        fileName: `${reportTitle}.xlsx`,
        ipAddress: req.ip
      }
    })

    await streamReportExcel(res, { schoolName: institution?.name ?? 'École', period, generatedAt, reportTitle }, sectionData)
  })
)

// ── EXPORT CSV ────────────────────────────────────────────────────────────────
reportsRoutes.get(
  '/export/csv',
  validate(filtersSchema),
  asyncHandler(async (req, res) => {
    const { institutionId } = req
    const query = req.query as z.infer<typeof filtersSchema>['query']
    const role = req.user!.role

    if (role === UserRole.PARENT || role === UserRole.STUDENT) {
      throw forbidden('Export non autorisé pour ce rôle')
    }

    const { startDate, endDate } = parseDateRange(query as { startDate?: string; endDate?: string; reportType?: ReportType })
    const reportType = (query.reportType ?? 'MONTHLY') as ReportType

    const filters: ReportFilters = {
      institutionId: institutionId!,
      startDate,
      endDate,
      classroomId: query.classroomId,
      teacherId: query.teacherId,
      subjectId: query.subjectId,
      academicYearId: query.academicYearId
    }

    const institution = await prisma.institution.findUnique({ where: { id: institutionId! } })
    const sections = new Set(['summary', 'finance', 'pedagogy', 'attendance', 'teachers', 'discipline'])
    const sectionData = await buildReportData(institutionId!, filters, sections, role)

    const reportTitle = `Rapport_${reportType}_${institution?.name ?? 'École'}`
    const lines: string[] = [`Rapport;${reportTitle}`, `Période;${startDate.toLocaleDateString('fr-FR')} - ${endDate.toLocaleDateString('fr-FR')}`, '']

    const addSection = (title: string, rows: Array<[string, string]>) => {
      lines.push(title)
      for (const [k, v] of rows) lines.push(`${k};${v}`)
      lines.push('')
    }

    if (sectionData.finance) {
      const f = sectionData.finance as Record<string, unknown>
      addSection('FINANCE', [
        ['Frais encaissés (XOF)', String(f.collected ?? 0)],
        ['Total facturé (XOF)', String(f.totalDue ?? 0)],
        ['Reste à payer (XOF)', String(f.remaining ?? 0)],
        ['Factures en retard', String(f.lateInvoices ?? 0)]
      ])
    }

    if (sectionData.attendance) {
      const a = sectionData.attendance as Record<string, unknown>
      addSection('PRÉSENCES', [
        ['Total', String(a.total ?? 0)],
        ['Présents', String(a.present ?? 0)],
        ['Absents', String(a.absent ?? 0)],
        ['Retards', String(a.late ?? 0)],
        ['Justifiées', String(a.justified ?? 0)],
        ['Non justifiées', String(a.unjustified ?? 0)]
      ])
    }

    if (sectionData.discipline) {
      const d = sectionData.discipline as Record<string, unknown>
      addSection('DISCIPLINE', [
        ['Incidents', String(d.incidents ?? 0)],
        ['Score moyen', String(d.averageScore ?? 0)],
        ['Élèves à risque', String(d.atRiskStudents ?? 0)]
      ])
    }

    await prisma.exportLog.create({
      data: {
        institutionId: institutionId!,
        userId: req.user!.id,
        userRole: role,
        reportType,
        sections: Array.from(sections),
        format: ExportFormat.CSV,
        fileName: `${reportTitle}.csv`,
        ipAddress: req.ip
      }
    })

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${reportTitle}.csv"`)
    res.send('﻿' + lines.join('\n'))
  })
)

// ── HISTORY ───────────────────────────────────────────────────────────────────
reportsRoutes.get(
  '/history',
  requireRoles(...DIRECTOR_ROLES, UserRole.ACCOUNTANT, UserRole.SECRETARIAT),
  asyncHandler(async (req, res) => {
    const { institutionId } = req
    const page = Math.max(1, Number(req.query.page ?? 1))
    const limit = Math.min(50, Number(req.query.limit ?? 20))

    const [logs, total] = await Promise.all([
      prisma.exportLog.findMany({
        where: { institutionId: institutionId! },
        include: { user: { select: { firstName: true, lastName: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.exportLog.count({ where: { institutionId: institutionId! } })
    ])

    res.json({ logs, total, page, limit })
  })
)
