import type { Response } from 'express'
import {
  addFooterToBufferedPages,
  createProfessionalPdf,
  drawInfoRows,
  drawKpiGrid,
  drawMiniBarChart,
  drawProfessionalHeader,
  drawSectionTitle,
  drawSignatureBlock,
  drawSimpleTable,
  safePdfFileName
} from '../pdf/pdf-layout'

interface ReportMeta {
  schoolName: string
  period: string
  generatedAt: string
  reportTitle: string
  country?: string | null
  city?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
}

export type SectionData = Record<string, unknown>

function formatNum(n: unknown): string {
  if (typeof n !== 'number') return '0'
  return n.toLocaleString('fr-FR')
}

function formatMoney(n: unknown): string {
  if (typeof n !== 'number') return '0 XOF'
  return `${n.toLocaleString('fr-FR')} XOF`
}

function percent(n: unknown): string {
  if (typeof n !== 'number') return '—'
  return `${n.toFixed(n % 1 === 0 ? 0 : 1)}%`
}

function shortDate(value: unknown) {
  const date = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('fr-FR') : '—'
}

function objectEntries(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value as Record<string, number>)
    .map(([label, count]) => ({ label, value: Number(count) || 0 }))
    .filter((row) => row.value > 0)
}

function numericRows(value: unknown, labelKey = 'label', valueKey = 'value') {
  if (!Array.isArray(value)) return []
  return (value as Array<Record<string, unknown>>)
    .map((row) => ({
      label: String(row[labelKey] ?? row.name ?? '—'),
      value: Number(row[valueKey] ?? row.count ?? row.average ?? row.collected ?? row.incidents ?? 0)
    }))
    .filter((row) => row.label !== '—')
}

export async function streamReportPdf(res: Response, meta: ReportMeta, sections: Record<string, unknown>) {
  const doc = createProfessionalPdf({ margin: 36, size: 'A4' })

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${safePdfFileName(meta.reportTitle)}.pdf"`)
  doc.pipe(res)

  drawProfessionalHeader(doc, {
    title: 'Rapport',
    subtitle: meta.reportTitle.replace(/_/g, ' '),
    generatedAt: meta.generatedAt,
    brand: {
      name: meta.schoolName,
      address: meta.address,
      city: meta.city,
      country: meta.country,
      phone: meta.phone,
      email: meta.email
    }
  })

  drawInfoRows(doc, [
    { label: 'Période du rapport', value: meta.period },
    { label: 'Établissement', value: meta.schoolName },
    { label: 'Pays / ville', value: [meta.country, meta.city].filter(Boolean).join(' / ') || '—' }
  ])

  if (sections.summary) {
    const s = sections.summary as Record<string, unknown>
    const ay = s.academicYear && typeof s.academicYear === 'object' ? (s.academicYear as Record<string, unknown>) : null
    drawSectionTitle(doc, 'A. Résumé général')
    drawKpiGrid(doc, [
      { label: 'Apprenants', value: formatNum(s.students) },
      { label: 'Enseignants', value: formatNum(s.teachers) },
      { label: 'Classes', value: formatNum(s.classrooms) },
      { label: 'Utilisateurs actifs', value: formatNum(s.activeUsers) },
      { label: 'Nouvelles inscriptions', value: formatNum(s.newStudentsThisPeriod) },
      { label: 'Encaissements période', value: formatMoney(s.totalCollected) },
      { label: 'Année scolaire', value: String(ay?.name ?? '—') }
    ])
  }

  if (sections.finance) {
    const f = sections.finance as Record<string, unknown>
    drawSectionTitle(doc, 'B. Rapport financier')
    drawKpiGrid(doc, [
      { label: 'Frais encaissés', value: formatMoney(f.collected) },
      { label: 'Total dû', value: formatMoney(f.totalDue) },
      { label: 'Total payé', value: formatMoney(f.totalPaid) },
      { label: 'Reste à payer', value: formatMoney(f.remaining) },
      { label: 'Paiements en retard', value: formatNum(f.lateInvoices) },
      { label: 'Factures générées', value: formatNum(f.invoicesGenerated) },
      { label: 'Taux recouvrement', value: percent(f.collectionRate) }
    ])
    drawMiniBarChart(doc, 'Courbe des revenus mensuels', numericRows(f.monthlyTrend, 'label', 'collected'))
    drawMiniBarChart(doc, 'Statut des factures', objectEntries(f.byStatus))
  }

  if (sections.pedagogy) {
    const p = sections.pedagogy as Record<string, unknown>
    drawSectionTitle(doc, 'C. Rapport pédagogique')
    drawKpiGrid(doc, [
      { label: 'Moyenne générale', value: typeof p.averageGrade === 'number' ? `${p.averageGrade.toFixed(2)} / 20` : '—' },
      { label: 'Taux de réussite', value: percent(p.successRate) },
      { label: 'Évaluations', value: formatNum(p.totalEvaluations) }
    ])
    drawMiniBarChart(doc, 'Moyennes par classe', numericRows(p.byClassroom, 'name', 'average'))
    drawMiniBarChart(doc, 'Performances par matière', numericRows(p.bySubject, 'name', 'average'))
    drawSimpleTable(doc, 'Meilleurs apprenants', (Array.isArray(p.topStudents) ? p.topStudents : []) as Array<Record<string, unknown>>, [
      { header: 'Apprenant', width: 320, get: (row) => row.name as string },
      { header: 'Moyenne', width: 160, align: 'right', get: (row) => typeof row.average === 'number' ? row.average.toFixed(2) : '—' }
    ])
    drawSimpleTable(doc, 'Apprenants à soutenir', (Array.isArray(p.weakStudents) ? p.weakStudents : []) as Array<Record<string, unknown>>, [
      { header: 'Apprenant', width: 320, get: (row) => row.name as string },
      { header: 'Moyenne', width: 160, align: 'right', get: (row) => typeof row.average === 'number' ? row.average.toFixed(2) : '—' }
    ])
  }

  if (sections.attendance) {
    const a = sections.attendance as Record<string, unknown>
    drawSectionTitle(doc, 'D. Rapport assiduité')
    drawKpiGrid(doc, [
      { label: 'Cours avec appel valide', value: formatNum(a.totalSessions) },
      { label: 'Présences', value: formatNum(a.present) },
      { label: 'Absences', value: formatNum(a.absent) },
      { label: 'Retards', value: formatNum(a.late) },
      { label: 'Justifiées', value: formatNum(a.justified) },
      { label: 'Non justifiées', value: formatNum(a.unjustified) },
      { label: "Taux d'assiduité", value: percent(a.attendanceRate) }
    ])
    drawMiniBarChart(doc, 'Absences par classe', numericRows(a.byClassroom, 'name', 'absent'))
    drawMiniBarChart(doc, 'Absences par matière', numericRows(a.bySubject, 'name', 'absent'))
    drawSimpleTable(doc, 'Apprenants les plus absents', (Array.isArray(a.mostAbsentStudents) ? a.mostAbsentStudents : []) as Array<Record<string, unknown>>, [
      { header: 'Apprenant', width: 340, get: (row) => row.name as string },
      { header: 'Absences', width: 140, align: 'right', get: (row) => row.count as number }
    ])
  }

  if (sections.teachers) {
    const t = sections.teachers as Record<string, unknown>
    drawSectionTitle(doc, 'E. Rapport enseignants')
    drawKpiGrid(doc, [
      { label: 'Enseignants actifs', value: formatNum(t.totalTeachers) },
      { label: 'Cours programmés', value: formatNum(t.scheduledSlots) },
      { label: 'Badgeages', value: formatNum(t.totalBadges) },
      { label: 'Taux ponctualité', value: percent(t.punctualityRate) }
    ])
    drawMiniBarChart(doc, 'Retards enseignants', numericRows(t.badgeStats, 'name', 'lateMinutes'))
    drawMiniBarChart(doc, 'Volume de charges pédagogiques', numericRows(t.teacherLoad, 'name', 'assignmentsCount'))
  }

  if (sections.staff) {
    const s = sections.staff as Record<string, unknown>
    drawSectionTitle(doc, 'I. Rapport personnel')
    drawKpiGrid(doc, [
      { label: 'Personnel actif', value: formatNum(s.totalStaff) },
      { label: 'Présences', value: formatNum(s.present) },
      { label: 'Retards', value: formatNum(s.late) },
      { label: 'Absences', value: formatNum(s.absent) },
      { label: 'Départs anticipés', value: formatNum(s.earlyDeparture) },
      { label: 'Ponctualité', value: percent(s.punctualityRate) },
      { label: 'Pénalités appliquées', value: formatNum(s.penaltiesApplied) },
      { label: 'Montant pénalités', value: formatMoney(s.penaltyAmount) },
      { label: 'Contrats actifs', value: formatNum(s.contractsActive) }
    ])
    drawMiniBarChart(doc, 'Personnel par rôle', objectEntries(s.byRole))
    drawMiniBarChart(doc, 'Retards par personnel', numericRows(s.attendanceByStaff, 'name', 'late'))
    drawMiniBarChart(doc, 'Absences par personnel', numericRows(s.attendanceByStaff, 'name', 'absent'))
    if (s.payrollVisible) {
      drawMiniBarChart(doc, 'Salaires nets estimés', numericRows(s.salaryByStaff, 'name', 'netSalary'))
    }
    drawSimpleTable(doc, 'Synthèse personnel', (Array.isArray(s.attendanceByStaff) ? s.attendanceByStaff : []) as Array<Record<string, unknown>>, [
      { header: 'Personnel', width: 210, get: (row) => row.name as string },
      { header: 'Prés.', width: 55, align: 'right', get: (row) => row.present as number },
      { header: 'Ret.', width: 55, align: 'right', get: (row) => row.late as number },
      { header: 'Abs.', width: 55, align: 'right', get: (row) => row.absent as number },
      { header: 'Pénalités', width: 100, align: 'right', get: (row) => formatMoney(row.penalties) }
    ])
  }

  if (sections.discipline) {
    const d = sections.discipline as Record<string, unknown>
    drawSectionTitle(doc, 'F. Rapport vie scolaire')
    drawKpiGrid(doc, [
      { label: 'Incidents', value: formatNum(d.incidents) },
      { label: 'Sanctions', value: formatNum(d.sanctions) },
      { label: 'Récompenses', value: formatNum(d.rewards) },
      { label: 'Score moyen', value: typeof d.averageScore === 'number' ? d.averageScore.toFixed(1) : '—' },
      { label: 'Apprenants à risque', value: formatNum(d.atRiskStudents) },
      { label: 'Score < 60', value: formatNum(d.lowScoreStudents) }
    ])
    drawMiniBarChart(doc, 'Incidents par type', objectEntries(d.byKind))
    drawMiniBarChart(doc, 'Évolution des incidents', numericRows(d.monthlyTrend, 'label', 'incidents'))
  }

  if (sections.administrative) {
    const a = sections.administrative as Record<string, unknown>
    drawSectionTitle(doc, 'G. Rapport administratif')
    drawKpiGrid(doc, [
      { label: 'Nouvelles inscriptions', value: formatNum(a.newStudents) },
      { label: 'Admissions', value: formatNum(a.admissions) },
      { label: 'Réinscriptions', value: formatNum(a.reEnrollments) },
      { label: 'Transferts entrants', value: formatNum(a.transfersIn) },
      { label: 'Départs / sorties', value: formatNum(a.departures) },
      { label: 'Documents officiels', value: formatNum(a.officialDocuments) },
      { label: 'Attestations', value: formatNum(a.attestationsGenerated) },
      { label: 'Certificats', value: formatNum(a.certificatesGenerated) }
    ])
    drawMiniBarChart(doc, 'Documents officiels par type', objectEntries(a.byOfficialDocumentType))
    drawSimpleTable(doc, 'Remplissage des classes', (Array.isArray(a.classroomEnrollments) ? a.classroomEnrollments : []) as Array<Record<string, unknown>>, [
      { header: 'Classe', width: 250, get: (row) => row.name as string },
      { header: 'Inscrits', width: 90, align: 'right', get: (row) => row.enrolled as number },
      { header: 'Capacité', width: 90, align: 'right', get: (row) => row.capacity as number },
      { header: 'Taux', width: 80, align: 'right', get: (row) => percent(row.fillRate) }
    ])
  }

  if (sections.calendar) {
    const c = sections.calendar as Record<string, unknown>
    drawSectionTitle(doc, 'H. Rapport calendrier scolaire')
    drawKpiGrid(doc, [
      { label: 'Événements validés', value: formatNum(c.total) },
      { label: 'Jours concernés', value: formatNum(c.daysLost) }
    ])
    drawMiniBarChart(doc, 'Événements par type', objectEntries(c.byType))
    drawSimpleTable(doc, 'Événements principaux', (Array.isArray(c.events) ? c.events : []) as Array<Record<string, unknown>>, [
      { header: 'Titre', width: 220, get: (row) => row.title as string },
      { header: 'Type', width: 100, get: (row) => row.type as string },
      { header: 'Début', width: 95, get: (row) => shortDate(row.startsAt) },
      { header: 'Fin', width: 95, get: (row) => shortDate(row.endsAt) }
    ])
  }

  drawSignatureBlock(doc, ['Visa Direction', 'Administration', 'Cachet établissement'])
  addFooterToBufferedPages(doc, {
    generatedAt: meta.generatedAt,
    generatorName: 'SoraSchool',
    signatureLabel: 'Rapport officiel à conserver dans les archives de l’établissement.'
  })
  doc.end()
}
