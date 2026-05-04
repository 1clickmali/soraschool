import PDFDocument from 'pdfkit'
import type { Response } from 'express'

interface ReportMeta {
  schoolName: string
  period: string
  generatedAt: string
  reportTitle: string
  logoUrl?: string
}

export type SectionData = Record<string, unknown>

function formatNum(n: unknown): string {
  if (typeof n !== 'number') return '—'
  return n.toLocaleString('fr-FR')
}

function formatMoney(n: unknown): string {
  if (typeof n !== 'number') return '—'
  return `${n.toLocaleString('fr-FR')} XOF`
}

export async function streamReportPdf(res: Response, meta: ReportMeta, sections: Record<string, unknown>) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' })

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${meta.reportTitle.replace(/\s+/g, '_')}.pdf"`)
  doc.pipe(res)

  // ── COVER PAGE ────────────────────────────────────────────────────────────
  const primary = '#064E3B'
  const accent = '#C89B3C'

  doc.rect(0, 0, doc.page.width, 120).fill(primary)
  doc.fillColor('white').fontSize(22).font('Helvetica-Bold').text(meta.schoolName, 50, 30, { align: 'center' })
  doc.fontSize(14).font('Helvetica').text(meta.reportTitle, 50, 65, { align: 'center' })
  doc.fillColor(accent).fontSize(11).text(meta.period, 50, 90, { align: 'center' })

  doc.fillColor('#333').fontSize(9).text(`Généré le ${meta.generatedAt}`, 50, 130, { align: 'right' })

  doc.moveDown(2)

  // ── HELPER: section title ────────────────────────────────────────────────
  const sectionTitle = (title: string) => {
    doc.moveDown(1)
    doc.rect(50, doc.y, doc.page.width - 100, 22).fill(primary)
    doc.fillColor('white').fontSize(11).font('Helvetica-Bold').text(title, 60, doc.y - 18)
    doc.fillColor('#333').font('Helvetica').moveDown(0.5)
  }

  const row = (label: string, value: string) => {
    const y = doc.y
    doc.fontSize(9).fillColor('#555').text(label, 60, y)
    doc.fillColor('#111').text(value, 300, y, { width: 200, align: 'right' })
    doc.moveDown(0.4)
  }

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  if (sections.summary) {
    const s = sections.summary as Record<string, unknown>
    sectionTitle('A. Résumé général')
    row('École', meta.schoolName)
    row("Période d'analyse", meta.period)
    row('Élèves actifs', formatNum(s.students))
    row('Enseignants actifs', formatNum(s.teachers))
    row('Classes', formatNum(s.classrooms))
    row('Utilisateurs actifs', formatNum(s.activeUsers))
    if (s.academicYear && typeof s.academicYear === 'object') {
      const ay = s.academicYear as Record<string, unknown>
      row('Année scolaire', String(ay.name ?? '—'))
    }
  }

  // ── FINANCE ───────────────────────────────────────────────────────────────
  if (sections.finance) {
    const f = sections.finance as Record<string, unknown>
    sectionTitle('B. Rapport financier')
    row('Frais encaissés (période)', formatMoney(f.collected))
    row('Total facturé', formatMoney(f.totalDue))
    row('Total payé', formatMoney(f.totalPaid))
    row('Reste à payer', formatMoney(f.remaining))
    row('Factures en retard', formatNum(f.lateInvoices))
    row('Factures générées', formatNum(f.invoicesGenerated))
  }

  // ── PEDAGOGY ──────────────────────────────────────────────────────────────
  if (sections.pedagogy) {
    const p = sections.pedagogy as Record<string, unknown>
    sectionTitle('C. Rapport pédagogique')
    row('Moyenne générale (/20)', typeof p.averageGrade === 'number' ? p.averageGrade.toFixed(2) : '—')
    row('Taux de réussite', typeof p.successRate === 'number' ? `${p.successRate.toFixed(1)}%` : '—')
    if (Array.isArray(p.bySubject) && p.bySubject.length) {
      doc.moveDown(0.5).fontSize(9).fillColor('#444').text('Moyennes par matière :', 60)
      doc.moveDown(0.3)
      for (const subj of (p.bySubject as Array<Record<string, unknown>>).slice(0, 15)) {
        row(String(subj.name ?? ''), typeof subj.average === 'number' ? subj.average.toFixed(2) : '—')
      }
    }
  }

  // ── ATTENDANCE ────────────────────────────────────────────────────────────
  if (sections.attendance) {
    const a = sections.attendance as Record<string, unknown>
    sectionTitle('D. Rapport de présence')
    row('Enregistrements valides', formatNum(a.total))
    row('Présents', formatNum(a.present))
    row('Absents', formatNum(a.absent))
    row('Retards', formatNum(a.late))
    row('Absences justifiées', formatNum(a.justified))
    row('Absences non justifiées', formatNum(a.unjustified))
  }

  // ── TEACHERS ──────────────────────────────────────────────────────────────
  if (sections.teachers) {
    const t = sections.teachers as Record<string, unknown>
    sectionTitle('E. Rapport enseignants')
    row('Total enseignants actifs', formatNum(t.totalTeachers))
    row('Créneaux programmés', formatNum(t.scheduledSlots))
    row('Badgeages enregistrés', formatNum(t.totalBadges))
  }

  // ── DISCIPLINE ────────────────────────────────────────────────────────────
  if (sections.discipline) {
    const d = sections.discipline as Record<string, unknown>
    sectionTitle('F. Rapport vie scolaire / discipline')
    row('Incidents enregistrés', formatNum(d.incidents))
    row('Sanctions', formatNum(d.sanctions))
    row('Récompenses', formatNum(d.rewards))
    row('Score discipline moyen', typeof d.averageScore === 'number' ? d.averageScore.toFixed(1) : '—')
    row('Élèves à risque', formatNum(d.atRiskStudents))
    row('Élèves score < 60', formatNum(d.lowScoreStudents))
  }

  // ── CALENDAR ─────────────────────────────────────────────────────────────
  if (sections.calendar) {
    const c = sections.calendar as Record<string, unknown>
    sectionTitle('H. Rapport calendrier')
    row('Événements validés', formatNum(c.total))
    if (c.byType && typeof c.byType === 'object') {
      for (const [type, count] of Object.entries(c.byType as Record<string, number>)) {
        row(type, formatNum(count))
      }
    }
  }

  // ── FOOTER ────────────────────────────────────────────────────────────────
  doc.moveDown(3)
  const footerY = doc.page.height - 70
  doc.rect(50, footerY, doc.page.width - 100, 1).fill(accent)
  doc.fillColor('#555').fontSize(8).text(
    `Rapport généré automatiquement par SoraSchool — ${meta.generatedAt}`,
    50,
    footerY + 8,
    { align: 'center' }
  )
  doc.text('Signature du Directeur : ______________________________', 50, footerY + 22, { align: 'right' })

  doc.end()
}
