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
    if (f.byStatus && typeof f.byStatus === 'object') {
      sheetFin.addRow([])
      const sh = sheetFin.addRow(['Statut facture', 'Nombre'])
      styleHeader(sh, PRIMARY)
      for (const [status, count] of Object.entries(f.byStatus as Record<string, number>)) {
        sheetFin.addRow([status, count])
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

  // ── HISTORIQUE (placeholder for audit trail) ──────────────────────────────
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
