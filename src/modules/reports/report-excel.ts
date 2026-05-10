import ExcelJS from 'exceljs'
import type { Response } from 'express'

interface ReportMeta {
  schoolName: string
  period: string
  generatedAt: string
  reportTitle: string
}


const PRIMARY = '064E3B'
const ACCENT = 'C89B3C'
const LIGHT_BG = 'F0FDF4'
const HEADER_FONT = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
const CELL_FONT = { name: 'Calibri', size: 10 }

function headerFill(color = PRIMARY): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${color}` } }
}

function styleHeader(row: ExcelJS.Row, color = PRIMARY) {
  row.eachCell((cell) => {
    cell.font = HEADER_FONT
    cell.fill = headerFill(color)
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } } }
  })
  row.height = 24
}

function addKpiRow(sheet: ExcelJS.Worksheet, label: string, value: unknown, unit = '') {
  const row = sheet.addRow([label, `${value ?? '—'}${unit ? ' ' + unit : ''}`])
  row.getCell(1).font = { ...CELL_FONT, color: { argb: 'FF555555' } }
  row.getCell(2).font = { ...CELL_FONT, bold: true }
  row.getCell(2).alignment = { horizontal: 'right' }
  row.height = 18
}

function addSectionTitle(sheet: ExcelJS.Worksheet, title: string) {
  sheet.addRow([])
  const row = sheet.addRow([title])
  row.getCell(1).font = { name: 'Calibri', bold: true, size: 12, color: { argb: `FF${PRIMARY}` } }
  row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${LIGHT_BG}` } }
  sheet.mergeCells(row.number, 1, row.number, 6)
  row.height = 22
}

function autoWidth(sheet: ExcelJS.Worksheet, minWidth = 12) {
  sheet.columns.forEach((col) => {
    let max = minWidth
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = cell.value ? String(cell.value).length + 4 : minWidth
      if (len > max) max = len
    })
    col.width = Math.min(max, 50)
  })
}

function addChartBlock(sheet: ExcelJS.Worksheet, title: string, headers: string[], rows: Array<Array<string | number>>) {
  if (rows.length === 0) return
  sheet.addRow([])
  const titleRow = sheet.addRow([title])
  titleRow.getCell(1).font = { name: 'Calibri', bold: true, size: 12, color: { argb: `FF${PRIMARY}` } }
  sheet.mergeCells(titleRow.number, 1, titleRow.number, Math.max(3, headers.length + 1))
  const header = sheet.addRow([...headers, 'Barre'])
  styleHeader(header, ACCENT)
  for (const rowData of rows) {
    const row = sheet.addRow(rowData)
    const value = Number(rowData[1] ?? 0)
    row.getCell(headers.length + 1).value = '█'.repeat(Math.min(30, Math.max(1, Math.round(value / 10))))
    row.getCell(headers.length + 1).font = { name: 'Calibri', color: { argb: `FF${PRIMARY}` } }
  }
  const startRow = header.number
  const endRow = header.number + rows.length
  sheet.autoFilter = { from: { row: startRow, column: 1 }, to: { row: endRow, column: headers.length } }
}

export async function streamReportExcel(res: Response, meta: ReportMeta, sections: Record<string, unknown>) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'SoraSchool'
  wb.created = new Date()
  wb.title = meta.reportTitle

  // ── RÉSUMÉ ────────────────────────────────────────────────────────────────
  const sheetSummary = wb.addWorksheet('Résumé', { properties: { tabColor: { argb: `FF${PRIMARY}` } } })
  sheetSummary.columns = [{ width: 35 }, { width: 25 }]

  const titleRow = sheetSummary.addRow([meta.schoolName])
  titleRow.getCell(1).font = { name: 'Calibri', bold: true, size: 16, color: { argb: `FF${PRIMARY}` } }
  sheetSummary.mergeCells(1, 1, 1, 2)
  titleRow.height = 30

  sheetSummary.addRow([meta.reportTitle]).getCell(1).font = { name: 'Calibri', italic: true, size: 12, color: { argb: `FF${ACCENT}` } }
  sheetSummary.addRow([`Période : ${meta.period}`])
  sheetSummary.addRow([`Généré le : ${meta.generatedAt}`])

  if (sections.summary) {
    const s = sections.summary as Record<string, unknown>
    addSectionTitle(sheetSummary, '📋 Indicateurs généraux')
    addKpiRow(sheetSummary, 'Élèves actifs', s.students)
    addKpiRow(sheetSummary, 'Enseignants actifs', s.teachers)
    addKpiRow(sheetSummary, 'Classes', s.classrooms)
    addKpiRow(sheetSummary, 'Utilisateurs actifs (période)', s.activeUsers)
    if (s.academicYear && typeof s.academicYear === 'object') {
      const ay = s.academicYear as Record<string, unknown>
      addKpiRow(sheetSummary, 'Année scolaire', ay.name)
    }
  }

  if (sections.finance) {
    const f = sections.finance as Record<string, unknown>
    addSectionTitle(sheetSummary, '💰 Finance (résumé)')
    addKpiRow(sheetSummary, 'Frais encaissés', f.collected, 'XOF')
    addKpiRow(sheetSummary, 'Total facturé', f.totalDue, 'XOF')
    addKpiRow(sheetSummary, 'Reste à payer', f.remaining, 'XOF')
    addKpiRow(sheetSummary, 'Factures en retard', f.lateInvoices)
  }

  if (sections.discipline) {
    const d = sections.discipline as Record<string, unknown>
    addSectionTitle(sheetSummary, '🏫 Discipline (résumé)')
    addKpiRow(sheetSummary, 'Score discipline moyen', typeof d.averageScore === 'number' ? d.averageScore.toFixed(1) : '—', '/100')
    addKpiRow(sheetSummary, 'Élèves à risque', d.atRiskStudents)
  }

  // ── FINANCE ───────────────────────────────────────────────────────────────
  if (sections.finance) {
    const f = sections.finance as Record<string, unknown>
    const sheetFin = wb.addWorksheet('Finance', { properties: { tabColor: { argb: `FF${ACCENT}` } } })
    sheetFin.columns = [{ width: 35 }, { width: 20 }]
    const h = sheetFin.addRow(['Indicateur', 'Valeur (XOF)'])
    styleHeader(h, ACCENT)
    const rows: Array<[string, unknown]> = [
      ['Frais scolaires encaissés', f.collected],
      ['Total montant facturé', f.totalDue],
      ['Total montant payé', f.totalPaid],
      ['Reste à payer', f.remaining],
      ['Factures en retard', f.lateInvoices],
      ['Total factures générées', f.invoicesGenerated]
    ]
    rows.forEach(([label, val]) => {
      const row = sheetFin.addRow([label, val ?? 0])
      row.getCell(2).numFmt = '#,##0'
      row.height = 18
    })
    sheetFin.addRow(['Taux de recouvrement', f.collectionRate ?? 0]).getCell(2).numFmt = '0"%"'
    sheetFin.addRow(['Contrôle solde', { formula: 'B3-B4', result: f.remaining ?? 0 }])
    if (f.byStatus && typeof f.byStatus === 'object') {
      sheetFin.addRow([])
      const sh = sheetFin.addRow(['Statut facture', 'Nombre'])
      styleHeader(sh, PRIMARY)
      for (const [status, count] of Object.entries(f.byStatus as Record<string, number>)) {
        sheetFin.addRow([status, count])
      }
    }
    if (Array.isArray(f.monthlyTrend) && f.monthlyTrend.length) {
      sheetFin.addRow([])
      const hm = sheetFin.addRow(['Mois', 'Encaissements'])
      styleHeader(hm, ACCENT)
      for (const item of f.monthlyTrend as Array<Record<string, unknown>>) {
        sheetFin.addRow([item.label, item.collected ?? 0]).getCell(2).numFmt = '#,##0'
      }
    }
    autoWidth(sheetFin)
  }

  // ── ÉLÈVES / PÉDAGOGIE ────────────────────────────────────────────────────
  if (sections.pedagogy) {
    const p = sections.pedagogy as Record<string, unknown>
    const sheetPed = wb.addWorksheet('Pédagogie', { properties: { tabColor: { argb: 'FF3B82F6' } } })
    sheetPed.columns = [{ width: 30 }, { width: 20 }, { width: 15 }]
    const hKpi = sheetPed.addRow(['Indicateur', 'Valeur'])
    styleHeader(hKpi, PRIMARY)
    sheetPed.addRow(['Moyenne générale (/20)', typeof p.averageGrade === 'number' ? Number(p.averageGrade.toFixed(2)) : 0])
    sheetPed.addRow(['Taux de réussite (%)', typeof p.successRate === 'number' ? Number(p.successRate.toFixed(1)) : 0])
    sheetPed.addRow([])

    if (Array.isArray(p.bySubject) && p.bySubject.length) {
      const hs = sheetPed.addRow(['Matière', 'Moyenne /20', 'Nb notes'])
      styleHeader(hs, ACCENT)
      for (const subj of p.bySubject as Array<Record<string, unknown>>) {
        const r = sheetPed.addRow([subj.name, Number((subj.average as number).toFixed(2)), subj.count])
        r.getCell(2).numFmt = '0.00'
      }
    }

    if (Array.isArray(p.topStudents) && p.topStudents.length) {
      sheetPed.addRow([])
      const ht = sheetPed.addRow(['Top élèves', 'Moyenne /20'])
      styleHeader(ht, '10B981')
      for (const st of p.topStudents as Array<Record<string, unknown>>) {
        sheetPed.addRow([st.name, Number((st.average as number).toFixed(2))]).getCell(2).numFmt = '0.00'
      }
    }
    autoWidth(sheetPed)
  }

  // ── PRÉSENCES ─────────────────────────────────────────────────────────────
  if (sections.attendance) {
    const a = sections.attendance as Record<string, unknown>
    const sheetAtt = wb.addWorksheet('Présences', { properties: { tabColor: { argb: 'FFEF4444' } } })
    sheetAtt.columns = [{ width: 30 }, { width: 15 }]
    const hAtt = sheetAtt.addRow(['Indicateur', 'Valeur'])
    styleHeader(hAtt, PRIMARY)
    const attRows: Array<[string, unknown]> = [
      ['Total enregistrements valides', a.total],
      ['Présents', a.present],
      ['Absents', a.absent],
      ['Retards', a.late],
      ['Absences justifiées', a.justified],
      ['Absences non justifiées', a.unjustified]
    ]
    attRows.forEach(([label, val]) => sheetAtt.addRow([label, val ?? 0]))

    if (Array.isArray(a.byClassroom) && a.byClassroom.length) {
      sheetAtt.addRow([])
      const hCls = sheetAtt.addRow(['Classe', 'Absents', 'Retards'])
      styleHeader(hCls, ACCENT)
      for (const cls of a.byClassroom as Array<Record<string, unknown>>) {
        sheetAtt.addRow([cls.name, cls.absent ?? 0, cls.late ?? 0])
      }
    }

    if (Array.isArray(a.bySubject) && a.bySubject.length) {
      sheetAtt.addRow([])
      const hSub = sheetAtt.addRow(['Matière', 'Absents', 'Retards'])
      styleHeader(hSub, PRIMARY)
      for (const subj of a.bySubject as Array<Record<string, unknown>>) {
        sheetAtt.addRow([subj.name, subj.absent ?? 0, subj.late ?? 0])
      }
    }

    if (Array.isArray(a.mostAbsentStudents) && a.mostAbsentStudents.length) {
      sheetAtt.addRow([])
      const hMost = sheetAtt.addRow(['Élèves les plus absents', 'Nb absences'])
      styleHeader(hMost, 'EF4444')
      for (const st of a.mostAbsentStudents as Array<Record<string, unknown>>) {
        sheetAtt.addRow([st.name, st.count ?? 0])
      }
    }
    autoWidth(sheetAtt)
  }

  // ── ENSEIGNANTS ───────────────────────────────────────────────────────────
  if (sections.teachers) {
    const t = sections.teachers as Record<string, unknown>
    const sheetTeach = wb.addWorksheet('Enseignants', { properties: { tabColor: { argb: 'FF8B5CF6' } } })
    sheetTeach.columns = [{ width: 30 }, { width: 15 }]
    const hT = sheetTeach.addRow(['Indicateur', 'Valeur'])
    styleHeader(hT, PRIMARY)
    sheetTeach.addRow(['Total enseignants actifs', t.totalTeachers ?? 0])
    sheetTeach.addRow(['Créneaux programmés', t.scheduledSlots ?? 0])
    sheetTeach.addRow(['Badgeages enregistrés', t.totalBadges ?? 0])

    if (Array.isArray(t.teacherStats) && t.teacherStats.length) {
      sheetTeach.addRow([])
      const hStats = sheetTeach.addRow(['Enseignant', 'Présent', 'Absent', 'Retard'])
      styleHeader(hStats, ACCENT)
      for (const ts of t.teacherStats as Array<Record<string, unknown>>) {
        sheetTeach.addRow([ts.name, ts.present ?? 0, ts.absent ?? 0, ts.late ?? 0])
      }
    }

    if (Array.isArray(t.badgeStats) && t.badgeStats.length) {
      sheetTeach.addRow([])
      const hBadge = sheetTeach.addRow(['Enseignant', 'Check-ins', 'Minutes de retard'])
      styleHeader(hBadge, '8B5CF6')
      for (const b of t.badgeStats as Array<Record<string, unknown>>) {
        sheetTeach.addRow([b.name, b.checkIns ?? 0, b.lateMinutes ?? 0])
      }
    }
    autoWidth(sheetTeach)
  }

  // ── PERSONNEL RH ──────────────────────────────────────────────────────────
  if (sections.staff) {
    const s = sections.staff as Record<string, unknown>
    const sheetStaff = wb.addWorksheet('Personnel RH', { properties: { tabColor: { argb: 'FF0EA5E9' } } })
    sheetStaff.columns = [{ width: 32 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }]
    const hStaff = sheetStaff.addRow(['Indicateur', 'Valeur'])
    styleHeader(hStaff, PRIMARY)
    ;[
      ['Personnel actif', s.totalStaff],
      ['Présences', s.present],
      ['Retards', s.late],
      ['Absences', s.absent],
      ['Départs anticipés', s.earlyDeparture],
      ['Taux ponctualité (%)', s.punctualityRate],
      ['Pénalités appliquées', s.penaltiesApplied],
      ['Montant pénalités XOF', s.penaltyAmount],
      ['Contrats actifs', s.contractsActive],
      ['Masse brute XOF', s.grossSalary],
      ['Masse nette estimée XOF', s.netSalary]
    ].forEach(([label, value]) => sheetStaff.addRow([label, value ?? 0]))

    if (s.byRole && typeof s.byRole === 'object') {
      sheetStaff.addRow([])
      const hRole = sheetStaff.addRow(['Rôle', 'Nombre'])
      styleHeader(hRole, ACCENT)
      for (const [role, count] of Object.entries(s.byRole as Record<string, number>)) {
        sheetStaff.addRow([role, count])
      }
    }

    if (Array.isArray(s.attendanceByStaff) && s.attendanceByStaff.length) {
      sheetStaff.addRow([])
      const hRows = sheetStaff.addRow(['Personnel', 'Présences', 'Retards', 'Absences', 'Départs anticipés', 'Pénalités XOF'])
      styleHeader(hRows, '0EA5E9')
      for (const row of s.attendanceByStaff as Array<Record<string, unknown>>) {
        sheetStaff.addRow([row.name, row.present ?? 0, row.late ?? 0, row.absent ?? 0, row.earlyDeparture ?? 0, row.penalties ?? 0])
      }
    }

    if (Array.isArray(s.salaryByStaff) && s.salaryByStaff.length) {
      sheetStaff.addRow([])
      const hSalary = sheetStaff.addRow(['Personnel', 'Salaire base', 'Pénalités', 'Net estimé'])
      styleHeader(hSalary, '10B981')
      for (const row of s.salaryByStaff as Array<Record<string, unknown>>) {
        sheetStaff.addRow([row.name, row.baseSalary ?? 0, row.penalties ?? 0, row.netSalary ?? 0])
      }
    }
    autoWidth(sheetStaff)
  }

  // ── DISCIPLINE ────────────────────────────────────────────────────────────
  if (sections.discipline) {
    const d = sections.discipline as Record<string, unknown>
    const sheetDisc = wb.addWorksheet('Discipline', { properties: { tabColor: { argb: 'FFF59E0B' } } })
    sheetDisc.columns = [{ width: 30 }, { width: 15 }]
    const hD = sheetDisc.addRow(['Indicateur', 'Valeur'])
    styleHeader(hD, PRIMARY)
    sheetDisc.addRow(['Incidents enregistrés', d.incidents ?? 0])
    sheetDisc.addRow(['Sanctions', d.sanctions ?? 0])
    sheetDisc.addRow(['Récompenses', d.rewards ?? 0])
    sheetDisc.addRow(['Score discipline moyen (/100)', typeof d.averageScore === 'number' ? Number(d.averageScore.toFixed(1)) : 0])
    sheetDisc.addRow(['Élèves à risque', d.atRiskStudents ?? 0])
    sheetDisc.addRow(['Élèves score < 60', d.lowScoreStudents ?? 0])

    if (d.byKind && typeof d.byKind === 'object') {
      sheetDisc.addRow([])
      const hK = sheetDisc.addRow(['Type incident', 'Nombre'])
      styleHeader(hK, ACCENT)
      for (const [kind, count] of Object.entries(d.byKind as Record<string, number>)) {
        sheetDisc.addRow([kind, count])
      }
    }
    autoWidth(sheetDisc)
  }

  // ── CALENDRIER ────────────────────────────────────────────────────────────
  if (sections.calendar) {
    const c = sections.calendar as Record<string, unknown>
    const sheetCal = wb.addWorksheet('Calendrier', { properties: { tabColor: { argb: 'FF06B6D4' } } })
    sheetCal.columns = [{ width: 30 }, { width: 15 }]
    const hCal = sheetCal.addRow(['Type', 'Nombre'])
    styleHeader(hCal, PRIMARY)
    sheetCal.addRow(['Total événements validés', c.total ?? 0])
    if (c.byType && typeof c.byType === 'object') {
      for (const [type, count] of Object.entries(c.byType as Record<string, number>)) {
        sheetCal.addRow([type, count])
      }
    }
    autoWidth(sheetCal)
  }

  // ── ADMINISTRATIF ────────────────────────────────────────────────────────
  if (sections.administrative) {
    const a = sections.administrative as Record<string, unknown>
    const sheetAdmin = wb.addWorksheet('Administratif', { properties: { tabColor: { argb: 'FF14B8A6' } } })
    sheetAdmin.columns = [{ width: 34 }, { width: 18 }]
    const hAdmin = sheetAdmin.addRow(['Indicateur', 'Valeur'])
    styleHeader(hAdmin, PRIMARY)
    ;[
      ['Nouvelles inscriptions', a.newStudents],
      ['Admissions', a.admissions],
      ['Réinscriptions', a.reEnrollments],
      ['Transferts entrants', a.transfersIn],
      ['Départs / sorties', a.departures],
      ['Documents chargés', a.documents],
      ['Documents officiels générés', a.officialDocuments],
      ['Attestations générées', a.attestationsGenerated],
      ['Certificats générés', a.certificatesGenerated],
      ['Classes suivies', a.totalClassrooms]
    ].forEach(([label, value]) => sheetAdmin.addRow([label, value ?? 0]))

    if (a.byOfficialDocumentType && typeof a.byOfficialDocumentType === 'object') {
      sheetAdmin.addRow([])
      const hDocs = sheetAdmin.addRow(['Type document officiel', 'Nombre'])
      styleHeader(hDocs, ACCENT)
      for (const [type, count] of Object.entries(a.byOfficialDocumentType as Record<string, number>)) {
        sheetAdmin.addRow([type, count])
      }
    }

    if (Array.isArray(a.classroomEnrollments) && a.classroomEnrollments.length) {
      sheetAdmin.addRow([])
      const hCls = sheetAdmin.addRow(['Classe', 'Inscrits', 'Capacité', 'Taux remplissage'])
      styleHeader(hCls, '14B8A6')
      for (const cls of a.classroomEnrollments as Array<Record<string, unknown>>) {
        const row = sheetAdmin.addRow([cls.name, cls.enrolled ?? 0, cls.capacity ?? 0, cls.fillRate ?? 0])
        row.getCell(4).numFmt = '0"%"'
      }
    }
    autoWidth(sheetAdmin)
  }

  // ── GRAPHIQUES / DONNÉES DE PILOTAGE ────────────────────────────────────
  const sheetCharts = wb.addWorksheet('Graphiques', { properties: { tabColor: { argb: 'FF0F172A' } } })
  sheetCharts.columns = [{ width: 28 }, { width: 18 }, { width: 18 }, { width: 36 }]
  sheetCharts.addRow(['Graphiques professionnels - données prêtes pour tableaux croisés et filtres'])
  sheetCharts.getRow(1).font = { name: 'Calibri', bold: true, size: 14, color: { argb: `FF${PRIMARY}` } }
  if (sections.finance && Array.isArray((sections.finance as Record<string, unknown>).monthlyTrend)) {
    addChartBlock(
      sheetCharts,
      'Finance - revenus par mois',
      ['Mois', 'Montant XOF'],
      ((sections.finance as Record<string, unknown>).monthlyTrend as Array<Record<string, unknown>>).map((item) => [String(item.label), Number(item.collected ?? 0)])
    )
  }
  if (sections.pedagogy && Array.isArray((sections.pedagogy as Record<string, unknown>).byClassroom)) {
    addChartBlock(
      sheetCharts,
      'Pédagogie - moyennes par classe',
      ['Classe', 'Moyenne'],
      ((sections.pedagogy as Record<string, unknown>).byClassroom as Array<Record<string, unknown>>).map((item) => [String(item.name), Number(item.average ?? 0)])
    )
  }
  if (sections.attendance && Array.isArray((sections.attendance as Record<string, unknown>).byClassroom)) {
    addChartBlock(
      sheetCharts,
      'Présence - absences par classe',
      ['Classe', 'Absences', 'Retards'],
      ((sections.attendance as Record<string, unknown>).byClassroom as Array<Record<string, unknown>>).map((item) => [String(item.name), Number(item.absent ?? 0), Number(item.late ?? 0)])
    )
  }
  if (sections.discipline && (sections.discipline as Record<string, unknown>).byKind) {
    addChartBlock(
      sheetCharts,
      'Discipline - incidents par type',
      ['Type', 'Nombre'],
      Object.entries((sections.discipline as Record<string, unknown>).byKind as Record<string, number>).map(([kind, count]) => [kind, count])
    )
  }
  if (sections.staff && Array.isArray((sections.staff as Record<string, unknown>).attendanceByStaff)) {
    addChartBlock(
      sheetCharts,
      'Personnel - retards et absences',
      ['Personnel', 'Retards', 'Absences'],
      ((sections.staff as Record<string, unknown>).attendanceByStaff as Array<Record<string, unknown>>).map((item) => [String(item.name), Number(item.late ?? 0), Number(item.absent ?? 0)])
    )
  }
  if (sections.staff && Array.isArray((sections.staff as Record<string, unknown>).salaryByStaff)) {
    addChartBlock(
      sheetCharts,
      'Personnel - salaires nets estimés',
      ['Personnel', 'Net XOF'],
      ((sections.staff as Record<string, unknown>).salaryByStaff as Array<Record<string, unknown>>).map((item) => [String(item.name), Number(item.netSalary ?? 0)])
    )
  }
  autoWidth(sheetCharts)

  // ── TRAÇABILITÉ ──────────────────────────────────────────────────────────
  const sheetInfo = wb.addWorksheet('Infos export', { properties: { tabColor: { argb: 'FF64748B' } } })
  sheetInfo.addRow(['Champ', 'Valeur'])
  sheetInfo.addRow(['École', meta.schoolName])
  sheetInfo.addRow(['Rapport', meta.reportTitle])
  sheetInfo.addRow(['Période', meta.period])
  sheetInfo.addRow(['Date de génération', meta.generatedAt])
  sheetInfo.addRow(['Généré par', 'SoraSchool'])
  autoWidth(sheetInfo)

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${meta.reportTitle.replace(/\s+/g, '_')}.xlsx"`)
  await wb.xlsx.write(res)
  res.end()
}
