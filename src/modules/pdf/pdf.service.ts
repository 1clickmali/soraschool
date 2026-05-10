import fs from 'node:fs'
import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import bwipjs from 'bwip-js'
import { InstitutionStatus } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { env } from '../../config/env'
import { notFound } from '../../lib/errors'
import { getPlatformBranding } from '../../lib/platform-branding'
import { resolveStoragePath } from '../../lib/storage'

const CARD_WIDTH = 242.65
const CARD_HEIGHT = 153.07
const GREEN = '#064E3B'
const CREAM = '#F7F1DE'
const GOLD = '#C89B3C'
const TEXT = '#12352B'
const MUTED = '#617066'
const BORDER = '#DED5BF'

type ImageSource = string | Buffer | undefined

function display(value: unknown, fallback = '-') {
  if (value === null || value === undefined) return fallback
  const text = String(value).trim()
  return text.length ? text : fallback
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return '-'
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('fr-FR')
}

function genderLabel(value: string | null | undefined) {
  if (value === 'MALE') return 'Masculin'
  if (value === 'FEMALE') return 'Féminin'
  return '-'
}

function enrollmentKindLabel(value: string | null | undefined) {
  if (value === 'NEW') return 'Nouvelle inscription'
  if (value === 'RENEWAL') return 'Réinscription'
  if (value === 'TRANSFER') return 'Transfert'
  return display(value)
}

function regimeLabel(value: string | null | undefined) {
  if (value === 'DAY') return 'Externe'
  if (value === 'BOARDING') return 'Internat'
  if (value === 'HALF_BOARDING') return 'Demi-pension'
  return display(value)
}

function studentStatusLabel(value: string | null | undefined) {
  if (value === 'ACTIVE') return 'Actif'
  if (value === 'SUSPENDED') return 'Suspendu'
  if (value === 'LEFT') return 'Sorti'
  if (value === 'GRADUATED') return 'Diplômé'
  return display(value)
}

function teacherStatusLabel(value: string | null | undefined) {
  if (value === 'ACTIVE') return 'Actif'
  if (value === 'ON_LEAVE') return 'En congé'
  if (value === 'SUSPENDED') return 'Suspendu'
  if (value === 'LEFT') return 'Sorti'
  return display(value)
}

function annualDecisionLabel(value: string | null | undefined) {
  if (value === 'PASSED') return 'Passe en classe supérieure'
  if (value === 'REPEATED') return 'Redouble la classe'
  if (value === 'GRADUATED') return 'Admis / Diplômé'
  return display(value, 'Décision non renseignée')
}

function contractTypeLabel(value: string | null | undefined) {
  if (value === 'CDI') return 'CDI'
  if (value === 'CDD') return 'CDD'
  if (value === 'VACATAIRE' || value === 'VACATION') return 'Vacataire'
  if (value === 'STAGE') return 'Stage'
  if (value === 'CONSULTANT') return 'Consultant'
  return display(value)
}

function formatMoney(value: number | null | undefined, currency = 'XOF') {
  if (value === null || value === undefined) return '-'
  return `${new Intl.NumberFormat('fr-FR').format(value)} ${currency}`
}

function planTierLabel(value: string | null | undefined) {
  if (value === 'BASIC') return 'Basic - école unique'
  if (value === 'PREMIUM') return 'Premium - école complète'
  if (value === 'ENTERPRISE') return 'Entreprise - groupe multi-écoles'
  return display(value)
}

function billingCycleLabel(value: string | null | undefined) {
  if (value === 'MONTHLY') return 'Mensuel'
  if (value === 'ANNUAL') return 'Annuel'
  return display(value)
}

function institutionKindLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    PRIMARY: 'Primaire',
    COLLEGE: 'Collège',
    LYCEE: 'Lycée',
    UNIVERSITY: 'Université',
    TRAINING_CENTER: 'Centre de formation',
    RELIGIOUS: 'Institut religieux',
    BILINGUAL: 'École bilingue',
    OTHER: 'Autre'
  }
  return value ? labels[value] ?? display(value) : '-'
}

function institutionStructureLabel(value: string | null | undefined) {
  if (value === 'CENTRAL_ADMINISTRATION') return 'Administration Centrale / Groupe scolaire'
  if (value === 'SINGLE_SCHOOL') return 'École unique'
  return display(value)
}

function statusLabel(value: string | null | undefined) {
  if (value === 'ACTIVE') return 'Actif'
  if (value === 'TRIAL') return 'Essai'
  if (value === 'SUSPENDED') return 'Suspendu'
  if (value === 'EXPIRED') return 'Expiré'
  if (value === 'DELETED') return 'Supprimé'
  return display(value)
}

function formatList(values: string[] | null | undefined, fallback = '-') {
  return values?.length ? values.join(', ') : fallback
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function normalizeColor(value: string | null | undefined, fallback: string) {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback
}

function collectPdf(doc: PDFKit.PDFDocument) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.end()
  })
}

async function qrBuffer(payload: string) {
  const dataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 180 })
  return Buffer.from(dataUrl.split(',')[1], 'base64')
}

async function barcodeBuffer(value: string) {
  return bwipjs.toBuffer({
    bcid: 'code128',
    text: value,
    scale: 2,
    height: 12,
    includetext: false,
    backgroundcolor: 'FFFFFF'
  })
}

function drawInitials(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, name: string) {
  const parts = name.split(/\s+/).filter(Boolean)
  const initials = parts.length === 1 && parts[0].length <= 5
    ? parts[0].slice(0, 3).toUpperCase()
    : parts
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('')
  doc.roundedRect(x, y, w, h, 8).fillAndStroke(CREAM, GOLD)
  doc.fillColor(GREEN).fontSize(18).font('Helvetica-Bold').text(initials || 'SS', x, y + h / 2 - 9, {
    width: w,
    align: 'center'
  })
}

function drawPhoto(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, photo: ImageSource, name: string) {
  doc.roundedRect(x, y, w, h, 8).strokeColor(GOLD).lineWidth(1.2).stroke()
  try {
    if (photo && (Buffer.isBuffer(photo) || fs.existsSync(photo))) {
      doc.save()
      doc.roundedRect(x + 1, y + 1, w - 2, h - 2, 7).clip()
      doc.image(photo, x + 1, y + 1, { fit: [w - 2, h - 2], align: 'center', valign: 'center' })
      doc.restore()
      return
    }
  } catch {
    // If the image file is missing or unreadable, keep the PDF usable with initials.
  }
  drawInitials(doc, x + 1, y + 1, w - 2, h - 2, name)
}

function drawLogoMark(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, logo: ImageSource, acronym: string, colors?: { primary: string; secondary: string; accent: string }) {
  const primary = colors?.primary ?? GREEN
  const secondary = colors?.secondary ?? CREAM
  const accent = colors?.accent ?? GOLD
  doc.roundedRect(x, y, w, h, 10).fillAndStroke(secondary, accent)
  try {
    if (logo && (Buffer.isBuffer(logo) || fs.existsSync(logo))) {
      doc.save()
      doc.roundedRect(x + 4, y + 4, w - 8, h - 8, 8).clip()
      doc.image(logo, x + 5, y + 5, { fit: [w - 10, h - 10], align: 'center', valign: 'center' })
      doc.restore()
      return
    }
  } catch {
    // Fallback to acronym when the configured logo cannot be loaded.
  }
  doc.fillColor(primary).font('Helvetica-Bold').fontSize(16).text(acronym.slice(0, 3).toUpperCase(), x, y + h / 2 - 8, {
    width: w,
    align: 'center'
  })
}

async function resolveImageSource(photoUrl: string | null | undefined, institutionId: string): Promise<ImageSource> {
  if (!photoUrl) return undefined
  const value = photoUrl.trim()
  const resolveStoredFile = (fileKey: string | null | undefined) => {
    if (!fileKey) return undefined
    try {
      const filePath = resolveStoragePath(fileKey)
      return fs.existsSync(filePath) ? filePath : undefined
    } catch {
      return undefined
    }
  }

  if (value.startsWith('/api/documents/')) {
    const id = value.split('/api/documents/')[1]?.split('/')[0]
    if (!id) return undefined
    const document = await prisma.document.findFirst({ where: { id, institutionId } })
    return resolveStoredFile(document?.fileKey)
  }

  if (value.startsWith('/api/platform/assets')) {
    try {
      const assetUrl = new URL(value, 'http://localhost')
      return resolveStoredFile(assetUrl.searchParams.get('key'))
    } catch {
      return undefined
    }
  }

  if (/^https?:\/\//.test(value)) return undefined

  return resolveStoredFile(value.replace(/^\//, '').replace(/^storage\//, ''))
}

function safeText(doc: PDFKit.PDFDocument, text: string, x: number, y: number, width: number, options: PDFKit.Mixins.TextOptions = {}) {
  doc.text(text, x, y, { width, ellipsis: true, lineGap: 1, ...options })
}

function drawTinyLabelValue(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, width: number) {
  doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(5.6).text(label.toUpperCase(), x, y, { width, height: 6, ellipsis: true })
  doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(6.35).text(value, x, y + 7, { width, height: 9, ellipsis: true })
}

function drawCardFront(doc: PDFKit.PDFDocument, params: {
  institutionName: string
  acronym: string
  motto?: string | null
  year?: string | null
  fullName: string
  roleLabel: string
  lineOneLabel?: string
  lineTwoLabel?: string
  lineOne: string
  lineTwo: string
  identifier: string
  qr: Buffer
  cardLabel: string
  logo?: ImageSource
  photo?: ImageSource
  primaryColor?: string | null
  secondaryColor?: string | null
  accentColor?: string | null
}) {
  const primary = normalizeColor(params.primaryColor, GREEN)
  const secondary = normalizeColor(params.secondaryColor, CREAM)
  const accent = normalizeColor(params.accentColor, GOLD)
  doc.rect(0, 0, CARD_WIDTH, CARD_HEIGHT).fill('#FFFFFF')
  doc.rect(0, 0, CARD_WIDTH, 48).fill(primary)
  doc.rect(0, 137, CARD_WIDTH, 16).fill(primary)
  doc.rect(0, 47, CARD_WIDTH, 2).fill(accent)
  doc.rect(0, 0, CARD_WIDTH, CARD_HEIGHT).strokeColor(BORDER).lineWidth(1).stroke()

  drawLogoMark(doc, 12, 9, 31, 31, params.logo, params.acronym, { primary, secondary, accent })
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.1)
  safeText(doc, params.institutionName.toUpperCase(), 49, 8, 122, { height: 27, lineGap: 0 })
  doc.fillColor(secondary).font('Helvetica').fontSize(6.6)
  safeText(doc, `Année scolaire : ${params.year ?? 'en cours'}`, 49, 36, 122, { height: 9 })

  drawPhoto(doc, 181, 12, 48, 58, params.photo, params.fullName)
  doc.roundedRect(184, 81, 42, 42, 6).fillAndStroke('#FFFFFF', GOLD)
  doc.image(params.qr, 188, 85, { width: 34, height: 34 })

  doc.roundedRect(13, 58, 158, 76, 10).fillAndStroke('#F9FAF5', '#E6DDC7')
  doc.roundedRect(22, 53, 68, 14, 7).fillAndStroke(accent, accent)
  doc.fillColor(primary).font('Helvetica-Bold').fontSize(6.7).text(params.roleLabel.toUpperCase(), 22, 57, { width: 68, align: 'center' })

  doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(11.4)
  safeText(doc, params.fullName.toUpperCase(), 23, 73, 136, { height: 27 })
  drawTinyLabelValue(doc, params.lineOneLabel ?? 'Classe / service', params.lineOne.replace(/^[^:]+:\s*/i, ''), 23, 103, 64)
  drawTinyLabelValue(doc, params.lineTwoLabel ?? 'Matricule', params.lineTwo.replace(/^[^:]+:\s*/i, ''), 92, 103, 66)
  drawTinyLabelValue(doc, 'Identifiant unique', params.identifier, 23, 119, 135)

  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(6.5)
  safeText(doc, params.cardLabel.toUpperCase(), 12, 141, 128, { height: 9 })
  doc.fillColor(accent).font('Helvetica-Bold').fontSize(6.3)
  safeText(doc, params.motto ?? 'Sincérité - Science - Pratique', 143, 141, 84, { align: 'right', height: 9 })
}

function drawCardBack(doc: PDFKit.PDFDocument, params: {
  institutionName: string
  motto?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  officialText: string
  statusLine: string
  identifier: string
  barcode: Buffer
  primaryColor?: string | null
  secondaryColor?: string | null
  accentColor?: string | null
}) {
  const primary = normalizeColor(params.primaryColor, GREEN)
  const secondary = normalizeColor(params.secondaryColor, CREAM)
  const accent = normalizeColor(params.accentColor, GOLD)
  doc.rect(0, 0, CARD_WIDTH, CARD_HEIGHT).fill(primary)
  doc.rect(0, 0, CARD_WIDTH, CARD_HEIGHT).strokeColor(accent).lineWidth(1).stroke()
  doc.opacity(0.08).strokeColor('#FFFFFF').lineWidth(0.4)
  for (let x = -30; x < CARD_WIDTH; x += 18) {
    doc.moveTo(x, 0).lineTo(x + 78, CARD_HEIGHT).stroke()
  }
  doc.opacity(1)

  doc.fillColor(accent).font('Helvetica-Bold').fontSize(8.5).text('INFORMATIONS OFFICIELLES', 23, 17, { width: 196, align: 'center' })
  doc.fillColor('#FFFFFF').fontSize(9.2)
  safeText(doc, params.institutionName.toUpperCase(), 26, 31, 190, { align: 'center', height: 24 })
  doc.fillColor(secondary).fontSize(6.8).font('Helvetica')
  safeText(doc, params.officialText, 27, 61, 188, { align: 'center', height: 30 })

  doc.roundedRect(14, 98, 214, 28, 7).fillAndStroke('#FFFFFF', accent)
  doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(6.2)
  safeText(doc, display(params.address), 21, 103, 86, { height: 9 })
  safeText(doc, display(params.phone), 114, 103, 44, { height: 9 })
  safeText(doc, display(params.email ?? params.website), 164, 103, 58, { height: 9 })
  doc.fillColor(MUTED).font('Helvetica').fontSize(5.5)
  safeText(doc, display(params.website), 21, 115, 200, { align: 'center', height: 8 })

  doc.roundedRect(14, 133, 48, 12, 4).fillAndStroke(accent, accent)
  doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(6.3).text(params.statusLine, 18, 137, { width: 40, ellipsis: true })
  doc.image(params.barcode, 78, 131, { width: 118, height: 14 })
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7).text(params.identifier, 78, 146, { width: 118, align: 'center' })
}

type EnrollmentItem = { label: string; value: unknown }

function drawEnrollmentSection(
  doc: PDFKit.PDFDocument,
  title: string,
  items: EnrollmentItem[],
  y: number,
  options: { columns?: number; minRows?: number } = {}
) {
  const margin = 36
  const width = doc.page.width - margin * 2
  const columns = options.columns ?? 2
  const rows = Math.max(Math.ceil(items.length / columns), options.minRows ?? 1)
  const titleHeight = 22
  const rowHeight = 25
  const height = titleHeight + rows * rowHeight + 12
  const bottomLimit = doc.page.height - 92
  let top = y

  if (top + height > bottomLimit) {
    doc.addPage({ size: 'A4', margin })
    top = margin
  }

  doc.roundedRect(margin, top, width, height, 10).fillAndStroke('#FFFFFF', BORDER)
  doc.rect(margin, top, width, titleHeight).fill(GREEN)
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9).text(title.toUpperCase(), margin + 12, top + 7, {
    width: width - 24,
    height: 10
  })

  const colWidth = width / columns
  items.forEach((item, index) => {
    const col = index % columns
    const row = Math.floor(index / columns)
    const itemX = margin + 12 + col * colWidth
    const itemY = top + titleHeight + 10 + row * rowHeight
    const itemWidth = colWidth - 22
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(6.8).text(item.label.toUpperCase(), itemX, itemY, {
      width: itemWidth,
      height: 8,
      ellipsis: true
    })
    doc.fillColor(TEXT).font('Helvetica').fontSize(8.6).text(display(item.value), itemX, itemY + 10, {
      width: itemWidth,
      height: 11,
      ellipsis: true
    })
  })

  return top + height + 10
}

function drawSignatureArea(doc: PDFKit.PDFDocument, y: number, labels = ['Parent / tuteur', 'Administration', 'Cachet établissement']) {
  const margin = 36
  const width = doc.page.width - margin * 2
  const height = 82
  let top = y
  if (top + height > doc.page.height - 50) {
    doc.addPage({ size: 'A4', margin })
    top = margin
  }

  doc.roundedRect(margin, top, width, height, 10).strokeColor(BORDER).lineWidth(1).stroke()
  const colWidth = width / 3
  labels.forEach((label, index) => {
    const x = margin + index * colWidth
    if (index > 0) doc.moveTo(x, top).lineTo(x, top + height).strokeColor(BORDER).lineWidth(0.7).stroke()
    doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(8).text(label, x + 12, top + 12, {
      width: colWidth - 24,
      align: 'center'
    })
    doc.moveTo(x + 18, top + 56).lineTo(x + colWidth - 18, top + 56).strokeColor(MUTED).lineWidth(0.6).stroke()
  })
}

function drawClause(doc: PDFKit.PDFDocument, title: string, body: string, y: number) {
  const margin = 36
  const width = doc.page.width - margin * 2
  const bodyHeight = doc.heightOfString(body, { width: width - 28, lineGap: 2 })
  const height = Math.max(54, bodyHeight + 34)
  let top = y

  if (top + height > doc.page.height - 82) {
    doc.addPage({ size: 'A4', margin })
    top = margin
  }

  doc.roundedRect(margin, top, width, height, 9).fillAndStroke('#FFFFFF', BORDER)
  doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(9).text(title.toUpperCase(), margin + 14, top + 12, {
    width: width - 28,
    height: 11
  })
  doc.fillColor(TEXT).font('Helvetica').fontSize(8.8).text(body, margin + 14, top + 29, {
    width: width - 28,
    lineGap: 2
  })

  return top + height + 10
}

function drawInstallationSection(
  doc: PDFKit.PDFDocument,
  title: string,
  rows: Array<{ label: string; value: string }>,
  y: number,
  accent = GREEN
) {
  const margin = 36
  const width = doc.page.width - margin * 2
  const columns = 2
  const colWidth = (width - 28) / columns
  const rowHeight = 34
  const bodyRows = Math.ceil(rows.length / columns)
  const height = 40 + bodyRows * rowHeight
  let top = y

  if (top + height > doc.page.height - 72) {
    doc.addPage({ size: 'A4', margin })
    top = margin
  }

  doc.roundedRect(margin, top, width, height, 12).fillAndStroke('#FFFFFF', BORDER)
  doc.fillColor(accent).font('Helvetica-Bold').fontSize(10).text(title.toUpperCase(), margin + 14, top + 14, {
    width: width - 28,
    height: 12
  })

  rows.forEach((row, index) => {
    const col = index % columns
    const rowIndex = Math.floor(index / columns)
    const x = margin + 14 + col * colWidth
    const itemY = top + 38 + rowIndex * rowHeight
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7).text(row.label.toUpperCase(), x, itemY, {
      width: colWidth - 18,
      height: 9,
      ellipsis: true
    })
    doc.fillColor(TEXT).font('Helvetica').fontSize(9).text(display(row.value), x, itemY + 12, {
      width: colWidth - 18,
      height: 17,
      ellipsis: true
    })
  })

  return top + height + 12
}

function drawInstallationChecklist(doc: PDFKit.PDFDocument, title: string, items: string[], y: number) {
  const margin = 36
  const width = doc.page.width - margin * 2
  const height = 34 + items.length * 18
  let top = y

  if (top + height > doc.page.height - 72) {
    doc.addPage({ size: 'A4', margin })
    top = margin
  }

  doc.roundedRect(margin, top, width, height, 12).fillAndStroke('#FFFFFF', BORDER)
  doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(10).text(title.toUpperCase(), margin + 14, top + 13, {
    width: width - 28
  })

  items.forEach((item, index) => {
    const itemY = top + 34 + index * 18
    doc.circle(margin + 18, itemY + 5, 4).fill(GOLD)
    doc.fillColor(TEXT).font('Helvetica').fontSize(9).text(item, margin + 30, itemY, {
      width: width - 44,
      height: 13,
      ellipsis: true
    })
  })

  return top + height + 12
}

function normalizedGrade(score: number, maxScore: number) {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) return 0
  return Math.max(0, Math.min(20, (score / maxScore) * 20))
}

function formatAverage(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-'
  return value.toFixed(2).replace('.', ',')
}

type ReportGrade = {
  studentId: string
  subjectId: string
  score: number
  maxScore: number
  coefficient: number
  appreciation: string | null
  createdAt: Date
  subject: { name: string; coefficient: number }
  teacher: { firstName: string; lastName: string }
}

function aggregateReportLines(grades: ReportGrade[]) {
  const bySubject = new Map<string, ReportGrade[]>()
  grades.forEach((grade) => {
    const list = bySubject.get(grade.subjectId) ?? []
    list.push(grade)
    bySubject.set(grade.subjectId, list)
  })

  return Array.from(bySubject.values())
    .map((items) => {
      const latest = [...items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
      const coefficient = latest.coefficient || latest.subject.coefficient || 1
      const note = items.reduce((sum, item) => sum + normalizedGrade(item.score, item.maxScore), 0) / items.length
      return {
        subject: latest.subject.name,
        teacher: `${latest.teacher.firstName} ${latest.teacher.lastName}`.trim(),
        coefficient,
        note,
        appreciation: latest.appreciation ?? ''
      }
    })
    .sort((a, b) => a.subject.localeCompare(b.subject, 'fr'))
}

function computeWeightedAverage(lines: Array<{ note: number; coefficient: number }>) {
  const coefficientTotal = lines.reduce((sum, line) => sum + line.coefficient, 0)
  if (coefficientTotal <= 0) return null
  return lines.reduce((sum, line) => sum + line.note * line.coefficient, 0) / coefficientTotal
}

export async function renderInstitutionInstallationContractPdf(institutionId: string, _lang = 'FR') {
  const institution = await prisma.institution.findFirst({
    where: { id: institutionId, status: { not: InstitutionStatus.DELETED } },
    include: {
      subscriptions: { include: { plan: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      establishments: { orderBy: { createdAt: 'asc' } }
    }
  })

  if (!institution) throw notFound('Institution introuvable')

  const platform = await getPlatformBranding()
  const subscription = institution.subscriptions[0]
  const plan = subscription?.plan
  const isEnterprise = institution.structure === 'CENTRAL_ADMINISTRATION' || plan?.tier === 'ENTERPRISE'
  const portalBase = (env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  const portalUrl = `${portalBase}/${institution.slug}/login`
  const contractNumber = `SCHOOL-${institution.slug.toUpperCase()}-${formatDate(new Date()).replace(/\//g, '')}`
  const logo = await resolveImageSource(institution.logoUrl, institution.id)
  const qr = await qrBuffer(portalUrl).catch(() => undefined)

  const featureLabels: Record<string, string> = {
    students: 'Gestion des élèves',
    classes: 'Classes et niveaux',
    teachers: 'Gestion des enseignants',
    attendance: 'Présences élèves et professeurs',
    grades: 'Notes, bulletins et décisions',
    payments: 'Frais scolaires, paiements et reçus',
    documents: 'Documents officiels et PDF',
    all_basic: 'Tout le plan Basic',
    parent_portal: 'Espace parents',
    pdf_cards: 'Cartes, fiches et bulletins PDF',
    shop: 'Boutique scolaire et stock',
    messages: 'Messagerie école-famille',
    advanced_exports: 'Exports avancés',
    all_premium: 'Tout le plan Premium',
    multi_establishment: 'Administration Centrale multi-écoles',
    unlimited_students: 'Élèves illimités',
    unlimited_teachers: 'Enseignants illimités',
    api_mobile: 'Application mobile et API',
    priority_support: 'Support prioritaire'
  }
  const rawFeatures = Array.isArray(plan?.features)
    ? plan?.features.map(String)
    : Object.entries(asRecord(plan?.features)).filter(([, enabled]) => Boolean(enabled)).map(([key]) => key)
  const features = rawFeatures.map((feature) => featureLabels[feature] ?? feature.replace(/_/g, ' '))

  const doc = new PDFDocument({
    size: 'A4',
    margin: 36,
    info: {
      Title: `Fiche contrat installation - ${institution.name}`,
      Author: platform.appName
    }
  })

  const margin = 36
  const pageWidth = doc.page.width
  const contentWidth = pageWidth - margin * 2
  const primary = normalizeColor(institution.primaryColor, GREEN)
  const accent = normalizeColor(institution.accentColor, GOLD)
  const secondary = normalizeColor(institution.secondaryColor, CREAM)

  doc.rect(0, 0, pageWidth, 150).fill(primary)
  doc.rect(0, 142, pageWidth, 8).fill(accent)
  drawLogoMark(doc, margin, 28, 62, 62, logo, institution.slug, { primary, secondary, accent })
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(18).text('FICHE D’INSTALLATION & CONTRAT CLIENT', 114, 32, {
    width: pageWidth - 250,
    height: 46,
    lineGap: 2
  })
  doc.fillColor(secondary).font('Helvetica').fontSize(9).text(
    'Document officiel généré après création du client SaaS. À conserver dans le dossier administratif du client.',
    114,
    82,
    { width: pageWidth - 250, height: 28 }
  )
  doc.roundedRect(pageWidth - 172, 32, 136, 80, 14).fill('#FFFFFF')
  doc.fillColor(primary).font('Helvetica-Bold').fontSize(8).text('RÉFÉRENCE CONTRAT', pageWidth - 158, 45, {
    width: 108,
    height: 10,
    align: 'center'
  })
  doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(9).text(contractNumber, pageWidth - 158, 61, {
    width: 108,
    height: 20,
    align: 'center'
  })
  doc.fillColor(MUTED).font('Helvetica').fontSize(7).text(`Généré le ${formatDate(new Date())}`, pageWidth - 158, 88, {
    width: 108,
    height: 10,
    align: 'center'
  })
  if (qr) {
    doc.image(qr, pageWidth - 80, 104, { fit: [36, 36], align: 'center', valign: 'center' })
  }

  let y = 176
  y = drawInstallationSection(doc, '1. Identification du client', [
    { label: 'Nom officiel', value: institution.name },
    { label: 'Slug / espace', value: `/${institution.slug}` },
    { label: 'Type', value: institutionKindLabel(institution.kind) },
    { label: 'Structure', value: institutionStructureLabel(institution.structure) },
    { label: 'Statut', value: statusLabel(institution.status) },
    { label: 'Année scolaire', value: display(institution.activeAcademicYearName) },
    { label: 'Ville', value: display(institution.city) },
    { label: 'Commune / quartier', value: display(institution.district) },
    { label: 'Adresse', value: display(institution.address) },
    { label: 'Devise / slogan', value: display(institution.motto) }
  ], y, primary)

  y = drawInstallationSection(doc, '2. Contacts et accès principal', [
    { label: 'Téléphone école/groupe', value: display(institution.phone) },
    { label: 'WhatsApp', value: display(institution.whatsapp) },
    { label: 'Email', value: display(institution.email) },
    { label: 'Site web', value: display(institution.website) },
    { label: isEnterprise ? 'Administrateur central' : 'Directeur', value: display(isEnterprise ? institution.centralAdminName : institution.directorName) },
    { label: 'Téléphone de connexion', value: display(isEnterprise ? institution.centralAdminPhone : institution.directorPhone) },
    { label: 'Email du compte', value: display(isEnterprise ? institution.centralAdminEmail : institution.directorEmail) },
    { label: 'Lien de connexion', value: portalUrl }
  ], y, accent)

  y = drawInstallationSection(doc, '3. Abonnement et capacité', [
    { label: 'Plan choisi', value: display(plan?.name) },
    { label: 'Niveau de plan', value: planTierLabel(plan?.tier) },
    { label: 'Cycle de paiement', value: billingCycleLabel(subscription?.cycle) },
    { label: 'Prix mensuel', value: formatMoney(plan?.monthlyPrice, institution.currency) },
    { label: 'Prix annuel', value: formatMoney(plan?.annualPrice, institution.currency) },
    { label: 'Début abonnement', value: formatDate(subscription?.startsAt) },
    { label: 'Fin abonnement', value: formatDate(subscription?.endsAt) },
    { label: 'Élèves maximum', value: plan?.maxStudents ? String(plan.maxStudents) : 'Illimité' },
    { label: 'Enseignants maximum', value: plan?.maxTeachers ? String(plan.maxTeachers) : 'Illimité' },
    { label: 'Établissements maximum', value: plan?.canCreateBranches ? String(plan.maxEstablishments || 'Illimité') : '1 école' }
  ], y, primary)

  y = drawInstallationSection(doc, '4. Paramètres configurés', [
    { label: 'Langues', value: formatList(institution.languages) },
    { label: 'Niveaux', value: formatList(institution.levels) },
    { label: 'Monnaie', value: institution.currency },
    { label: 'Couleur principale', value: institution.primaryColor },
    { label: 'Couleur secondaire', value: institution.secondaryColor },
    { label: 'Couleur accent', value: institution.accentColor },
    { label: 'Effectif estimé', value: institution.estimatedStudents ? `${institution.estimatedStudents} élèves` : '-' },
    { label: 'Enseignants estimés', value: institution.estimatedTeachers ? `${institution.estimatedTeachers} enseignants` : '-' }
  ], y, accent)

  y = drawInstallationChecklist(doc, '5. Modules inclus dans le plan', features.length ? features : [`Modules standards ${platform.appName} configurés selon le plan choisi.`], y)

  const establishments = institution.establishments.map((establishment, index) => {
    const location = [establishment.district, establishment.city].filter(Boolean).join(' - ')
    const director = establishment.directorName ? ` | Directeur : ${establishment.directorName}` : ''
    return `${index + 1}. ${establishment.name}${location ? ` (${location})` : ''}${director}`
  })
  y = drawInstallationChecklist(
    doc,
    isEnterprise ? '6. Écoles / annexes rattachées' : '6. Établissement principal',
    establishments.length ? establishments : ['Aucun établissement rattaché pour le moment. L’Administration Centrale pourra créer les écoles/campus depuis son espace.'],
    y
  )

  y = drawClause(
    doc,
    '7. Engagement de service',
    `${platform.appName} met à disposition du client un espace numérique sécurisé pour la gestion scolaire, administrative et financière. Les accès, modules et limites appliqués sont ceux du plan ${display(plan?.name)} indiqué dans cette fiche.`,
    y
  )
  y = drawClause(
    doc,
    '8. Responsabilités du client',
    'Le client s’engage à fournir des informations exactes, à protéger les numéros autorisés, à respecter la confidentialité des données élèves, parents et personnel, et à signaler toute demande de modification officielle.',
    y
  )
  y = drawClause(
    doc,
    '9. Facturation, support et validation',
    'Les paiements SaaS suivent le cycle choisi. Le support technique accompagne l’installation, la mise en route et les corrections nécessaires. La signature confirme la bonne création de l’espace client et l’acceptation des paramètres configurés.',
    y
  )

  const signatureHeight = 108
  if (y + signatureHeight > doc.page.height - 50) {
    doc.addPage({ size: 'A4', margin })
    y = margin
  }
  doc.roundedRect(margin, y, contentWidth, signatureHeight, 12).fillAndStroke('#FFFFFF', BORDER)
  const colWidth = contentWidth / 3
  ;['Client / Direction', platform.appName, 'Cachet & date'].forEach((label, index) => {
    const x = margin + index * colWidth
    if (index > 0) doc.moveTo(x, y).lineTo(x, y + signatureHeight).strokeColor(BORDER).lineWidth(0.7).stroke()
    doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(8.5).text(label, x + 12, y + 14, {
      width: colWidth - 24,
      align: 'center'
    })
    doc.moveTo(x + 18, y + 70).lineTo(x + colWidth - 18, y + 70).strokeColor(MUTED).lineWidth(0.6).stroke()
  })
  doc.fillColor(primary).font('Helvetica-Oblique').fontSize(13).text('Sissoko Abdoulaye', margin + colWidth + 18, y + 46, {
    width: colWidth - 36,
    align: 'center'
  })
  doc.fillColor(MUTED).font('Helvetica').fontSize(7.5).text(`Signature autorisée ${platform.appName}`, margin + colWidth + 18, y + 77, {
    width: colWidth - 36,
    align: 'center'
  })

  doc.fillColor(MUTED).font('Helvetica').fontSize(7).text(
    `${platform.appName} - Fiche générée automatiquement. Document interne de création client et de validation d’installation.`,
    margin,
    doc.page.height - 35,
    { width: contentWidth, align: 'center' }
  )

  return collectPdf(doc)
}

function drawAcademicDocumentHeader(
  doc: PDFKit.PDFDocument,
  institution: {
    name: string
    slug: string
    logoUrl: string | null
    primaryColor: string
    secondaryColor: string
    accentColor: string
    address: string | null
    city: string | null
    phone: string | null
    email: string | null
    motto: string | null
  },
  logo: ImageSource,
  title: string,
  subtitle: string
) {
  const primary = normalizeColor(institution.primaryColor, GREEN)
  const secondary = normalizeColor(institution.secondaryColor, CREAM)
  const accent = normalizeColor(institution.accentColor, GOLD)

  doc.rect(0, 0, doc.page.width, 118).fill(primary)
  doc.rect(0, 110, doc.page.width, 8).fill(accent)
  drawLogoMark(doc, 36, 26, 58, 58, logo, institution.slug, { primary, secondary, accent })
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(16).text(institution.name, 110, 28, {
    width: doc.page.width - 250,
    height: 22,
    ellipsis: true
  })
  doc.fillColor(secondary).font('Helvetica').fontSize(7.5).text(
    [institution.address, institution.city, institution.phone, institution.email].filter(Boolean).join(' | '),
    110,
    55,
    { width: doc.page.width - 250, height: 24, ellipsis: true }
  )
  if (institution.motto) {
    doc.fillColor('#FFFFFF').font('Helvetica-Oblique').fontSize(7.5).text(`"${institution.motto}"`, 110, 82, {
      width: doc.page.width - 250,
      height: 12,
      ellipsis: true
    })
  }

  doc.roundedRect(doc.page.width - 178, 30, 142, 52, 14).fill('#FFFFFF')
  doc.fillColor(primary).font('Helvetica-Bold').fontSize(10).text(title.toUpperCase(), doc.page.width - 166, 42, {
    width: 118,
    align: 'center',
    height: 12,
    ellipsis: true
  })
  doc.fillColor(MUTED).font('Helvetica').fontSize(7).text(subtitle, doc.page.width - 166, 60, {
    width: 118,
    align: 'center',
    height: 10,
    ellipsis: true
  })
}

function drawReportTableHeader(doc: PDFKit.PDFDocument, y: number, primary = GREEN) {
  doc.roundedRect(34, y, 528, 28, 8).fill(primary)
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.6)
  doc.text('MATIÈRE', 46, y + 10, { width: 152 })
  doc.text('COEF.', 210, y + 10, { width: 38, align: 'center' })
  doc.text('NOTE /20', 258, y + 10, { width: 62, align: 'center' })
  doc.text('APPRÉCIATION', 334, y + 10, { width: 118 })
  doc.text('PROFESSEUR', 462, y + 10, { width: 82 })
}

function certificateTitle(kind: string) {
  if (kind === 'DIPLOMA') return 'ATTESTATION / DIPLÔME DE CLASSE'
  if (kind === 'ENROLLMENT_CERTIFICATE') return "CERTIFICAT D'INSCRIPTION"
  if (kind === 'PRESENCE_CERTIFICATE') return 'CERTIFICAT DE PRÉSENCE'
  return 'CERTIFICAT DE SCOLARITÉ'
}

// ─── Card helpers ─────────────────────────────────────────────────────────────
//
// Layout budget (CARD_HEIGHT = 153.07pt):
//   0-38   : header (logo + institution name + year)
//   38-40  : accent separator
//   40-50  : card-type banner (primary bg, white text)
//   50-116 : content row  — photo left (w=60,h=66) | info rows right (6×11pt)
//   116-140: bottom strip — QR left (22×22) | signature right
//   140-153: footer (primary bg, 13pt)

function drawCardHeader(
  doc: PDFKit.PDFDocument,
  params: { institutionName: string; acronym: string; year?: string | null; logo?: ImageSource; primaryColor: string; accentColor: string }
) {
  const { primaryColor: primary, accentColor: accent } = params

  // Header background: primary left band + white right
  doc.rect(0, 0, 44, 38).fill(primary)
  doc.rect(44, 0, CARD_WIDTH - 44, 38).fill('#FFFFFF')
  // Accent top border
  doc.rect(0, 0, CARD_WIDTH, 3).fill(accent)

  // Circular logo inside left band
  const cx = 22, cy = 21, r = 16
  doc.save()
  doc.circle(cx, cy, r).clip()
  try {
    if (params.logo && (Buffer.isBuffer(params.logo) || fs.existsSync(params.logo as string))) {
      doc.image(params.logo, cx - r, cy - r, { width: r * 2, height: r * 2, align: 'center', valign: 'center' })
    } else {
      doc.rect(cx - r, cy - r, r * 2, r * 2).fill(accent)
      doc.fillColor(primary).font('Helvetica-Bold').fontSize(8).text(params.acronym.slice(0, 3), cx - r, cy - 5, { width: r * 2, align: 'center' })
    }
  } catch {
    doc.rect(cx - r, cy - r, r * 2, r * 2).fill(accent)
    doc.fillColor(primary).font('Helvetica-Bold').fontSize(8).text(params.acronym.slice(0, 3), cx - r, cy - 5, { width: r * 2, align: 'center' })
  }
  doc.restore()

  // Institution name + year (right of logo)
  doc.fillColor(primary).font('Helvetica-Bold').fontSize(7.8)
  safeText(doc, params.institutionName.toUpperCase(), 50, 7, CARD_WIDTH - 58, { height: 18, lineGap: 0 })
  doc.fillColor(accent).font('Helvetica').fontSize(6.5)
  safeText(doc, `Annee scolaire : ${params.year ?? 'en cours'}`, 50, 27, CARD_WIDTH - 58, { height: 9 })

  // Bottom accent line
  doc.rect(0, 37, CARD_WIDTH, 1.5).fill(accent)
}

function drawCardInfoRow(
  doc: PDFKit.PDFDocument,
  label: string, value: string,
  x: number, y: number, width: number,
  primary: string,
  last = false
) {
  doc.fillColor(primary).font('Helvetica-Bold').fontSize(5.5)
  safeText(doc, label.toUpperCase(), x, y, width * 0.40, { height: 7 })
  doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(6.3)
  safeText(doc, value, x + width * 0.42, y - 0.5, width * 0.58, { height: 8 })
  if (!last) {
    doc.moveTo(x, y + 9.5).lineTo(x + width, y + 9.5).strokeColor('#E5EBF3').lineWidth(0.4).stroke()
  }
}

function drawStudentCardFront(doc: PDFKit.PDFDocument, params: {
  institutionName: string; acronym: string; year?: string | null
  lastName: string; firstName: string; matricule: string
  className: string; birthDate?: string | null; status: string
  qr: Buffer; cardLabel: string
  logo?: ImageSource; photo?: ImageSource
  primaryColor?: string | null; secondaryColor?: string | null; accentColor?: string | null
}) {
  const primary = normalizeColor(params.primaryColor, GREEN)
  const accent = normalizeColor(params.accentColor, GOLD)

  doc.rect(0, 0, CARD_WIDTH, CARD_HEIGHT).fill('#FFFFFF')
  drawCardHeader(doc, { institutionName: params.institutionName, acronym: params.acronym, year: params.year, logo: params.logo, primaryColor: primary, accentColor: accent })

  // Card-type banner (y=38.5 to y=50)
  doc.rect(0, 38.5, CARD_WIDTH, 11.5).fill(primary)
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.5)
  safeText(doc, params.cardLabel.toUpperCase(), 8, 41.5, CARD_WIDTH - 16, { height: 9 })

  // Photo — left (x=6, y=52, w=60, h=60)
  drawPhoto(doc, 6, 52, 60, 60, params.photo, `${params.firstName} ${params.lastName}`)

  // Info rows — right of photo (6 rows × 10.5pt, starts at y=54)
  const infoX = 72, infoW = CARD_WIDTH - infoX - 6
  const rows = [
    { label: 'Nom', value: params.lastName },
    { label: 'Prenom', value: params.firstName },
    { label: 'Matricule', value: params.matricule },
    { label: 'Classe', value: params.className },
    { label: 'Ne(e) le', value: params.birthDate ?? '-' },
    { label: 'Statut', value: params.status },
  ]
  rows.forEach((row, i) => {
    drawCardInfoRow(doc, row.label, row.value, infoX, 54 + i * 10.5, infoW, primary, i === rows.length - 1)
  })

  // Separator line between content and bottom strip
  doc.moveTo(6, 116).lineTo(CARD_WIDTH - 6, 116).strokeColor('#E5EBF3').lineWidth(0.6).stroke()

  // Footer bar first (y=141 to 153) so QR sits above it
  doc.rect(0, 141, CARD_WIDTH, 12).fill(primary)
  doc.fillColor(accent).font('Helvetica-Bold').fontSize(5)
  safeText(doc, 'SORASCHOOL - GESTION SCOLAIRE INTELLIGENTE', 0, 145.5, CARD_WIDTH, { align: 'center', height: 6 })

  // QR code — bottom left (x=6, y=118, 21×21 → ends y=139)
  doc.roundedRect(6, 118, 21, 21, 3).fillAndStroke('#F0F5FF', accent)
  doc.image(params.qr, 8, 120, { width: 17, height: 17 })
  // "QR" label on the footer bar
  doc.fillColor(accent).font('Helvetica-Bold').fontSize(4.5)
  safeText(doc, 'QR', 6, 142.5, 21, { align: 'center', height: 5 })

  // Signature box — bottom right (y=118, h=20 → ends y=138)
  doc.roundedRect(CARD_WIDTH - 78, 118, 70, 20, 3).strokeColor(accent).lineWidth(0.8).stroke()
  doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(5.5)
  safeText(doc, 'Signature / Cachet', CARD_WIDTH - 78, 126, 70, { align: 'center', height: 8 })
}

function drawStudentCardBack(doc: PDFKit.PDFDocument, params: {
  institutionName: string
  address?: string | null; phone?: string | null; email?: string | null
  city?: string | null; country?: string | null
  parentName?: string | null; parentPhone?: string | null
  matricule: string
  primaryColor?: string | null; accentColor?: string | null
}) {
  const primary = normalizeColor(params.primaryColor, GREEN)
  const accent = normalizeColor(params.accentColor, GOLD)

  doc.rect(0, 0, CARD_WIDTH, CARD_HEIGHT).fill('#FFFFFF')

  // Header bar (0-26)
  doc.rect(0, 0, CARD_WIDTH, 26).fill(primary)
  doc.rect(0, 0, CARD_WIDTH, 3).fill(accent)
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7)
  safeText(doc, 'INFORMATIONS ETABLISSEMENT', 10, 10, CARD_WIDTH - 20, { height: 10 })

  // Institution name (y=28-40)
  doc.fillColor(primary).font('Helvetica-Bold').fontSize(7.5)
  safeText(doc, params.institutionName.toUpperCase(), 10, 29, CARD_WIDTH - 20, { height: 12 })

  // Thin accent line
  doc.rect(10, 40, CARD_WIDTH - 20, 0.8).fill(accent)

  // Contact rows (4 rows, 10pt each, y=43 to y=83)
  const contactRows = [
    { label: 'Adresse', value: display(params.address) },
    { label: 'Tel', value: display(params.phone) },
    { label: 'Email', value: display(params.email) },
    { label: 'Ville', value: [params.city, params.country].filter(Boolean).join(', ') || '-' },
  ]
  contactRows.forEach((row, i) => {
    const y = 43 + i * 10
    doc.fillColor(primary).font('Helvetica-Bold').fontSize(5.8).text(row.label.toUpperCase(), 10, y, { width: 36, height: 7 })
    doc.fillColor(TEXT).font('Helvetica').fontSize(6).text(row.value, 50, y - 0.5, { width: CARD_WIDTH - 62, height: 8, ellipsis: true })
    if (i < contactRows.length - 1) {
      doc.moveTo(10, y + 8).lineTo(CARD_WIDTH - 10, y + 8).strokeColor('#E5EBF3').lineWidth(0.4).stroke()
    }
  })

  // Parent section divider (y=86)
  doc.moveTo(10, 86).lineTo(CARD_WIDTH - 10, 86).strokeColor(accent).lineWidth(0.8).stroke()

  // Parent section header (y=89)
  doc.rect(10, 89, CARD_WIDTH - 20, 11).fill('#EAF3FF')
  doc.fillColor(primary).font('Helvetica-Bold').fontSize(6.5)
  safeText(doc, 'CONTACT PARENT / TUTEUR', 14, 92, CARD_WIDTH - 28, { height: 8 })

  // Parent info (y=103-121)
  doc.fillColor(primary).font('Helvetica-Bold').fontSize(5.8).text('Nom :', 10, 104, { width: 28, height: 7 })
  doc.fillColor(TEXT).font('Helvetica').fontSize(6.2).text(params.parentName ?? '-', 42, 104, { width: CARD_WIDTH - 54, height: 7, ellipsis: true })
  doc.moveTo(10, 113).lineTo(CARD_WIDTH - 10, 113).strokeColor('#E5EBF3').lineWidth(0.4).stroke()
  doc.fillColor(primary).font('Helvetica-Bold').fontSize(5.8).text('Tel :', 10, 115, { width: 28, height: 7 })
  doc.fillColor(TEXT).font('Helvetica').fontSize(6.2).text(params.parentPhone ?? '-', 42, 115, { width: CARD_WIDTH - 54, height: 7, ellipsis: true })

  // Notice box (y=125-138)
  doc.roundedRect(8, 125, CARD_WIDTH - 16, 13, 3).fill('#F0F5FF')
  doc.fillColor(primary).font('Helvetica').fontSize(5.5)
  safeText(doc, 'En cas de perte, merci de retourner cette carte a l\'etablissement.', 12, 129, CARD_WIDTH - 24, { align: 'center', height: 7 })

  // Footer
  doc.rect(0, 140, CARD_WIDTH, 13).fill(primary)
  doc.fillColor(accent).font('Helvetica-Bold').fontSize(5)
  safeText(doc, 'SORASCHOOL - GESTION SCOLAIRE INTELLIGENTE', 0, 145, CARD_WIDTH, { align: 'center', height: 7 })
}

function drawTeacherCardFront(doc: PDFKit.PDFDocument, params: {
  institutionName: string; acronym: string; year?: string | null
  lastName: string; firstName: string; matricule: string
  subject: string; contractType: string; status: string
  qr: Buffer; logo?: ImageSource; photo?: ImageSource
  primaryColor?: string | null; secondaryColor?: string | null; accentColor?: string | null
}) {
  const primary = normalizeColor(params.primaryColor, GREEN)
  const accent = normalizeColor(params.accentColor, GOLD)

  doc.rect(0, 0, CARD_WIDTH, CARD_HEIGHT).fill('#FFFFFF')
  drawCardHeader(doc, { institutionName: params.institutionName, acronym: params.acronym, year: params.year, logo: params.logo, primaryColor: primary, accentColor: accent })

  // Card-type banner
  doc.rect(0, 38.5, CARD_WIDTH, 11.5).fill(primary)
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.5)
  safeText(doc, 'CARTE PROFESSEUR', 8, 41.5, CARD_WIDTH - 16, { height: 9 })

  // Photo
  drawPhoto(doc, 6, 52, 60, 60, params.photo, `${params.firstName} ${params.lastName}`)

  // Info rows
  const infoX = 72, infoW = CARD_WIDTH - infoX - 6
  const rows = [
    { label: 'Nom', value: params.lastName },
    { label: 'Prenom', value: params.firstName },
    { label: 'ID Personnel', value: params.matricule },
    { label: 'Matiere', value: params.subject },
    { label: 'Contrat', value: params.contractType },
    { label: 'Statut', value: params.status },
  ]
  rows.forEach((row, i) => {
    drawCardInfoRow(doc, row.label, row.value, infoX, 54 + i * 10.5, infoW, primary, i === rows.length - 1)
  })

  // Separator
  doc.moveTo(6, 116).lineTo(CARD_WIDTH - 6, 116).strokeColor('#E5EBF3').lineWidth(0.6).stroke()

  // Footer bar first (y=141 to 153)
  doc.rect(0, 141, CARD_WIDTH, 12).fill(primary)
  doc.fillColor(accent).font('Helvetica-Bold').fontSize(5)
  safeText(doc, 'SORASCHOOL - GESTION SCOLAIRE INTELLIGENTE', 0, 145.5, CARD_WIDTH, { align: 'center', height: 6 })

  // QR code for attendance (y=118, 21×21 → ends y=139)
  doc.roundedRect(6, 118, 24, 24, 3).fillAndStroke('#F0F5FF', accent)
  doc.image(params.qr, 9, 121, { width: 18, height: 18 })
  // "QR POINTAGE" label on footer bar
  doc.fillColor(accent).font('Helvetica-Bold').fontSize(4.5)
  safeText(doc, 'QR POINTAGE', 6, 142.5, 24, { align: 'center', height: 5 })

  // Signature box (y=118, h=20 → ends y=138)
  doc.roundedRect(CARD_WIDTH - 78, 118, 70, 20, 3).strokeColor(accent).lineWidth(0.8).stroke()
  doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(5.5)
  safeText(doc, 'Signature Direction', CARD_WIDTH - 78, 126, 70, { align: 'center', height: 8 })
}

function drawTeacherCardBack(doc: PDFKit.PDFDocument, params: {
  institutionName: string
  address?: string | null; phone?: string | null; email?: string | null
  qr: Buffer; matricule: string
  primaryColor?: string | null; accentColor?: string | null
}) {
  const primary = normalizeColor(params.primaryColor, GREEN)
  const accent = normalizeColor(params.accentColor, GOLD)

  doc.rect(0, 0, CARD_WIDTH, CARD_HEIGHT).fill('#FFFFFF')

  // Header (0-26)
  doc.rect(0, 0, CARD_WIDTH, 26).fill(primary)
  doc.rect(0, 0, CARD_WIDTH, 3).fill(accent)
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7)
  safeText(doc, 'POINTAGE DU PERSONNEL', 10, 10, CARD_WIDTH - 20, { height: 10 })

  // Two-column layout: QR left (64×64, x=10, y=30) | info right
  const qrSize = 64, qrX = 10, qrY = 30
  doc.roundedRect(qrX, qrY, qrSize, qrSize, 5).strokeColor(accent).lineWidth(1.2).stroke()
  doc.image(params.qr, qrX + 3, qrY + 3, { width: qrSize - 6, height: qrSize - 6 })
  doc.rect(qrX, qrY + qrSize + 2, qrSize, 8).fill(primary)
  doc.fillColor(accent).font('Helvetica-Bold').fontSize(5)
  safeText(doc, 'QR CODE POINTAGE', qrX, qrY + qrSize + 3.5, qrSize, { align: 'center', height: 7 })

  // Right column (x=82)
  const infoX = 82, infoW = CARD_WIDTH - infoX - 8
  doc.fillColor(TEXT).font('Helvetica').fontSize(5.8)
  safeText(doc, 'Ce QR code permet le pointage electronique des entrees et sorties.', infoX, 33, infoW, { height: 20 })

  doc.moveTo(infoX, 57).lineTo(CARD_WIDTH - 8, 57).strokeColor(accent).lineWidth(0.6).stroke()

  doc.fillColor(primary).font('Helvetica-Bold').fontSize(6)
  safeText(doc, 'INFORMATIONS', infoX, 60, infoW, { height: 8 })

  const contact = [
    { label: 'Adresse', value: display(params.address) },
    { label: 'Tel', value: display(params.phone) },
    { label: 'Email', value: display(params.email) },
  ]
  contact.forEach((row, i) => {
    const y = 71 + i * 10
    doc.fillColor(primary).font('Helvetica-Bold').fontSize(5.5).text(row.label + ':', infoX, y, { width: 28, height: 7 })
    doc.fillColor(TEXT).font('Helvetica').fontSize(5.8).text(row.value, infoX + 30, y - 0.5, { width: infoW - 30, height: 8, ellipsis: true })
  })

  // Notice box (y=110-123)
  doc.roundedRect(8, 110, CARD_WIDTH - 16, 12, 3).fill('#F0F5FF')
  doc.fillColor(primary).font('Helvetica').fontSize(5.5)
  safeText(doc, 'En cas de perte, contactez la Direction.', 12, 114, CARD_WIDTH - 24, { align: 'center', height: 7 })

  // Matricule bar (y=125-138)
  doc.rect(8, 125, CARD_WIDTH - 16, 13).fill(primary)
  doc.fillColor(accent).font('Helvetica-Bold').fontSize(7)
  safeText(doc, params.matricule, 12, 129, CARD_WIDTH - 24, { align: 'center', height: 9 })

  // Footer
  doc.rect(0, 140, CARD_WIDTH, 13).fill(primary)
  doc.fillColor(accent).font('Helvetica-Bold').fontSize(5)
  safeText(doc, 'SORASCHOOL - GESTION SCOLAIRE INTELLIGENTE', 0, 145, CARD_WIDTH, { align: 'center', height: 7 })
}

export async function renderStudentCardPdf(institutionId: string, studentId: string, _lang = 'FR') {
  const student = await prisma.student.findFirst({
    where: { id: studentId, institutionId },
    include: {
      classroom: true,
      institution: true,
      parents: { include: { parent: true }, take: 1 },
    }
  })
  if (!student) throw notFound('Élève introuvable')

  const doc = new PDFDocument({ size: [CARD_WIDTH, CARD_HEIGHT], margin: 0 })
  const qr = await qrBuffer(`${env.PUBLIC_API_URL}/verify/student/${student.id}`)
  const photo = await resolveImageSource(student.photoUrl, institutionId)
  const logo = await resolveImageSource(student.institution.logoUrl, institutionId)
  const parent = student.parents[0]?.parent

  drawStudentCardFront(doc, {
    institutionName: student.institution.name,
    acronym: student.institution.slug.toUpperCase(),
    year: student.institution.activeAcademicYearName,
    lastName: student.lastName,
    firstName: student.firstName,
    matricule: student.matricule,
    className: student.classroom?.name ?? 'Non affecté',
    birthDate: student.birthDate ? formatDate(student.birthDate) : null,
    status: studentStatusLabel(student.status),
    qr,
    cardLabel: "CARTE SCOLAIRE",
    logo,
    photo,
    primaryColor: student.institution.primaryColor,
    secondaryColor: student.institution.secondaryColor,
    accentColor: student.institution.accentColor,
  })
  doc.addPage({ size: [CARD_WIDTH, CARD_HEIGHT], margin: 0 })
  drawStudentCardBack(doc, {
    institutionName: student.institution.name,
    address: student.institution.address,
    phone: student.institution.phone,
    email: student.institution.email,
    city: student.institution.city,
    country: student.institution.country,
    parentName: parent ? `${parent.firstName} ${parent.lastName}` : null,
    parentPhone: parent?.phone ?? null,
    matricule: student.matricule,
    primaryColor: student.institution.primaryColor,
    accentColor: student.institution.accentColor,
  })
  return collectPdf(doc)
}

export async function renderTeacherCardPdf(institutionId: string, teacherId: string, _lang = 'FR') {
  const teacher = await prisma.teacher.findFirst({
    where: { id: teacherId, institutionId },
    include: { institution: true, assignments: { include: { subject: true } } }
  })
  if (!teacher) throw notFound('Professeur introuvable')

  const doc = new PDFDocument({ size: [CARD_WIDTH, CARD_HEIGHT], margin: 0 })
  const qr = await qrBuffer(`${env.PUBLIC_API_URL}/api/staff/tablet-checkin/${teacher.id}`)
  const photo = await resolveImageSource(teacher.photoUrl, institutionId)
  const logo = await resolveImageSource(teacher.institution.logoUrl, institutionId)
  const subject = teacher.assignments[0]?.subject.name ?? teacher.specialization ?? 'Général'

  drawTeacherCardFront(doc, {
    institutionName: teacher.institution.name,
    acronym: teacher.institution.slug.toUpperCase(),
    year: teacher.institution.activeAcademicYearName,
    lastName: teacher.lastName,
    firstName: teacher.firstName,
    matricule: teacher.matricule,
    subject,
    contractType: contractTypeLabel(teacher.contractType),
    status: teacherStatusLabel(teacher.status),
    qr,
    logo,
    photo,
    primaryColor: teacher.institution.primaryColor,
    secondaryColor: teacher.institution.secondaryColor,
    accentColor: teacher.institution.accentColor,
  })
  doc.addPage({ size: [CARD_WIDTH, CARD_HEIGHT], margin: 0 })
  drawTeacherCardBack(doc, {
    institutionName: teacher.institution.name,
    address: teacher.institution.address,
    phone: teacher.institution.phone,
    email: teacher.institution.email,
    qr,
    matricule: teacher.matricule,
    primaryColor: teacher.institution.primaryColor,
    accentColor: teacher.institution.accentColor,
  })
  return collectPdf(doc)
}

export async function renderEnrollmentFormPdf(institutionId: string, studentId: string, _lang = 'FR') {
  const student = await prisma.student.findFirst({
    where: { id: studentId, institutionId },
    include: {
      institution: true,
      establishment: true,
      classroom: { include: { academicYear: true, gradeLevel: true } },
      parents: { include: { parent: true } }
    }
  })
  if (!student) throw notFound('Élève introuvable')

  const doc = new PDFDocument({ size: 'A4', margin: 36 })
  const margin = 36
  const contentWidth = doc.page.width - margin * 2
  const metadata = asRecord(student.metadata)
  const checklist = asRecord(metadata.documentsChecklist)
  const photo = await resolveImageSource(student.photoUrl, institutionId)
  const fullName = `${student.firstName} ${student.lastName}`
  const schoolYear = student.classroom?.academicYear?.name ?? student.institution.activeAcademicYearName ?? 'Année en cours'

  doc.rect(0, 0, doc.page.width, 112).fill(GREEN)
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(18).text(student.institution.name, margin, 25, {
    width: 360,
    height: 44
  })
  doc.fillColor(CREAM).font('Helvetica').fontSize(8.5)
  safeText(
    doc,
    [student.institution.address, student.institution.phone, student.institution.email].filter(Boolean).join(' | '),
    margin,
    72,
    360,
    { height: 22 }
  )
  drawPhoto(doc, doc.page.width - margin - 88, 20, 78, 92, photo, fullName)

  doc.roundedRect(margin, 128, contentWidth, 54, 12).fillAndStroke('#FFFFFF', BORDER)
  doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(16).text("FICHE D'INSCRIPTION SCOLAIRE", margin + 16, 144, {
    width: 300,
    height: 20
  })
  doc.fillColor(MUTED).font('Helvetica').fontSize(8.2)
  safeText(doc, `Document officiel | ${schoolYear} | Généré le ${formatDate(new Date())}`, margin + 16, 165, 300, { height: 10 })
  doc.roundedRect(doc.page.width - margin - 150, 143, 130, 23, 11).fillAndStroke(CREAM, GOLD)
  doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(9).text(student.matricule, doc.page.width - margin - 143, 150, {
    width: 116,
    align: 'center',
    height: 11
  })

  let y = 198
  y = drawEnrollmentSection(doc, "Identité de l'élève", [
    { label: 'Matricule', value: student.matricule },
    { label: 'Statut', value: studentStatusLabel(student.status) },
    { label: 'Nom', value: student.lastName },
    { label: 'Prénom(s)', value: student.firstName },
    { label: 'Genre', value: genderLabel(student.gender) },
    { label: 'Date de naissance', value: formatDate(student.birthDate) },
    { label: 'Lieu de naissance', value: student.birthPlace },
    { label: 'Nationalité', value: student.nationality },
    { label: 'Téléphone élève', value: student.phone },
    { label: 'Email élève', value: student.email },
    { label: 'Adresse', value: student.address },
    { label: 'Ville / commune', value: metadata.city }
  ], y)

  y = drawEnrollmentSection(doc, 'Scolarité et inscription', [
    { label: 'Établissement', value: student.establishment?.name },
    { label: 'Année scolaire', value: schoolYear },
    { label: 'Classe', value: student.classroom?.name ?? 'Non affecté' },
    { label: 'Niveau', value: student.classroom?.gradeLevel?.name },
    { label: 'Cycle', value: student.cycle },
    { label: 'Programme', value: student.program },
    { label: "Type d'inscription", value: enrollmentKindLabel(student.enrollmentKind) },
    { label: 'Régime', value: regimeLabel(student.boardingRegime) },
    { label: "Date d'inscription", value: formatDate(student.enrollmentDate) },
    { label: 'Date dossier créé', value: formatDate(student.createdAt) }
  ], y)

  y = drawEnrollmentSection(doc, 'Parents et tuteurs', [
    { label: 'Père', value: student.fatherName },
    { label: 'Téléphone père', value: student.fatherPhone },
    { label: 'Profession père', value: student.fatherProfession },
    { label: "N° pièce père", value: student.fatherIdNumber },
    { label: 'Mère', value: student.motherName },
    { label: 'Téléphone mère', value: student.motherPhone },
    { label: 'Profession mère', value: student.motherProfession },
    { label: "N° pièce mère", value: student.motherIdNumber },
    { label: 'Tuteur principal', value: student.guardianName },
    { label: 'Téléphone tuteur', value: student.guardianPhone },
    { label: 'Lien tuteur', value: student.guardianRelation },
    { label: 'Adresse tuteur', value: student.guardianAddress }
  ], y)

  const linkedParents = student.parents.map((link) => ({
    label: link.relationship,
    value: `${link.parent.firstName} ${link.parent.lastName} | ${link.parent.phone}${link.parent.profession ? ` | ${link.parent.profession}` : ''}`
  }))
  if (linkedParents.length) {
    y = drawEnrollmentSection(doc, 'Contacts parents enregistrés', linkedParents, y, { columns: 1 })
  }

  y = drawEnrollmentSection(doc, 'Santé et urgence', [
    { label: 'Groupe sanguin', value: student.bloodGroup },
    { label: "Contact d'urgence", value: student.emergencyContactName },
    { label: "Téléphone d'urgence", value: student.emergencyContactPhone },
    { label: 'Allergies', value: student.allergies },
    { label: 'Maladie connue', value: student.knownIllness },
    { label: 'Traitement en cours', value: student.currentTreatment }
  ], y)

  const checklistItems = Object.entries(checklist).map(([label, value]) => ({ label, value }))
  y = drawEnrollmentSection(
    doc,
    'Pièces du dossier',
    checklistItems.length ? checklistItems : [{ label: 'Documents', value: 'Aucune pièce renseignée' }],
    y,
    { columns: checklistItems.length > 1 ? 2 : 1 }
  )

  drawSignatureArea(doc, y + 2)
  return collectPdf(doc)
}

export async function renderTeacherProfilePdf(institutionId: string, teacherId: string, _lang = 'FR') {
  const teacher = await prisma.teacher.findFirst({
    where: { id: teacherId, institutionId },
    include: { institution: true, assignments: { include: { classroom: true, subject: true, academicYear: true } }, diplomas: true, experiences: true }
  })
  if (!teacher) throw notFound('Professeur introuvable')

  const platform = await getPlatformBranding()
  const doc = new PDFDocument({ size: 'A4', margin: 36 })
  const margin = 36
  const contentWidth = doc.page.width - margin * 2
  const metadata = asRecord(teacher.metadata)
  const checklist = asRecord(metadata.documentsChecklist)
  const photo = await resolveImageSource(teacher.photoUrl, institutionId)
  const fullName = `${teacher.firstName} ${teacher.lastName}`

  doc.rect(0, 0, doc.page.width, 112).fill(GREEN)
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(18).text(teacher.institution.name, margin, 25, {
    width: 360,
    height: 44
  })
  doc.fillColor(CREAM).font('Helvetica').fontSize(8.5)
  safeText(
    doc,
    [teacher.institution.address, teacher.institution.phone, teacher.institution.email].filter(Boolean).join(' | '),
    margin,
    72,
    360,
    { height: 22 }
  )
  drawPhoto(doc, doc.page.width - margin - 88, 20, 78, 92, photo, fullName)

  doc.roundedRect(margin, 128, contentWidth, 54, 12).fillAndStroke('#FFFFFF', BORDER)
  doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(16).text('FICHE ENSEIGNANT', margin + 16, 144, {
    width: 300,
    height: 20
  })
  doc.fillColor(MUTED).font('Helvetica').fontSize(8.2)
  safeText(doc, `Document RH officiel | Généré le ${formatDate(new Date())}`, margin + 16, 165, 300, { height: 10 })
  doc.roundedRect(doc.page.width - margin - 150, 143, 130, 23, 11).fillAndStroke(CREAM, GOLD)
  doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(9).text(teacher.matricule, doc.page.width - margin - 143, 150, {
    width: 116,
    align: 'center',
    height: 11
  })

  let y = 198
  y = drawEnrollmentSection(doc, "Identité de l'enseignant", [
    { label: 'Matricule', value: teacher.matricule },
    { label: 'Statut', value: teacherStatusLabel(teacher.status) },
    { label: 'Nom', value: teacher.lastName },
    { label: 'Prénom(s)', value: teacher.firstName },
    { label: 'Téléphone', value: teacher.phone },
    { label: 'Email', value: teacher.email },
    { label: 'Adresse', value: teacher.address },
    { label: 'Spécialité', value: teacher.specialization }
  ], y)

  y = drawEnrollmentSection(doc, 'Contrat et rémunération', [
    { label: 'Type de contrat', value: contractTypeLabel(teacher.contractType) },
    { label: "Date d'embauche", value: formatDate(teacher.hireDate) },
    { label: 'Salaire mensuel brut', value: formatMoney(teacher.baseSalary, teacher.institution.currency) },
    { label: 'Année scolaire', value: teacher.institution.activeAcademicYearName },
    { label: 'Document contrat', value: teacher.contractUrl ? 'Contrat importé au dossier' : 'Contrat générable depuis la fiche' },
    { label: 'Pièce identité', value: teacher.idDocumentUrl ? 'Importée' : 'Non renseignée' },
    { label: 'CV', value: teacher.cvUrl ? 'Importé' : 'Non renseigné' }
  ], y)

  const assignments = teacher.assignments.map((assignment) => ({
    label: assignment.subject.name,
    value: `${assignment.classroom.name}${assignment.academicYear ? ` | ${assignment.academicYear.name}` : ''}`
  }))
  y = drawEnrollmentSection(
    doc,
    'Matières et classes assignées',
    assignments.length ? assignments : [{ label: 'Affectation', value: 'Aucune affectation renseignée' }],
    y,
    { columns: assignments.length > 1 ? 2 : 1 }
  )

  const diplomas = teacher.diplomas.map((diploma) => ({
    label: diploma.title,
    value: [diploma.institution, diploma.year].filter(Boolean).join(' | ')
  }))
  if (diplomas.length) y = drawEnrollmentSection(doc, 'Diplômes', diplomas, y, { columns: 1 })

  const experiences = teacher.experiences.map((experience) => ({
    label: experience.position,
    value: [experience.institution, `${formatDate(experience.startDate)} - ${formatDate(experience.endDate)}`].filter(Boolean).join(' | ')
  }))
  if (experiences.length) y = drawEnrollmentSection(doc, 'Expériences professionnelles', experiences, y, { columns: 1 })

  const checklistItems = Object.entries(checklist).map(([label, value]) => ({ label, value }))
  y = drawEnrollmentSection(
    doc,
    'Pièces du dossier',
    checklistItems.length ? checklistItems : [{ label: 'Documents', value: 'Aucune pièce renseignée' }],
    y,
    { columns: checklistItems.length > 1 ? 2 : 1 }
  )

  drawSignatureArea(doc, y + 2, ['Enseignant', 'Direction', 'Cachet établissement'])
  return collectPdf(doc)
}

export async function renderTeacherContractPdf(institutionId: string, teacherId: string, _lang = 'FR') {
  const [platform, teacher] = await Promise.all([
    getPlatformBranding(),
    prisma.teacher.findFirst({
      where: { id: teacherId, institutionId },
      include: { institution: true, assignments: { include: { classroom: true, subject: true, academicYear: true } } }
    })
  ])
  if (!teacher) throw notFound('Professeur introuvable')

  const doc = new PDFDocument({ size: 'A4', margin: 36 })
  const margin = 36
  const contentWidth = doc.page.width - margin * 2
  const fullName = `${teacher.firstName} ${teacher.lastName}`
  const assignmentText = teacher.assignments.length
    ? teacher.assignments
        .map((assignment) => `${assignment.subject.name} - ${assignment.classroom.name}`)
        .join(', ')
    : teacher.specialization ?? 'Enseignement general'

  doc.rect(0, 0, doc.page.width, 118).fill(GREEN)
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(18).text(teacher.institution.name, margin, 24, {
    width: 360,
    height: 42
  })
  doc.fillColor(CREAM).font('Helvetica').fontSize(8.4)
  safeText(
    doc,
    [teacher.institution.address, teacher.institution.phone, teacher.institution.email].filter(Boolean).join(' | '),
    margin,
    70,
    420,
    { height: 20 }
  )
  doc.roundedRect(doc.page.width - margin - 112, 28, 96, 54, 12).fillAndStroke(CREAM, GOLD)
  doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(12).text('CONTRAT', doc.page.width - margin - 103, 43, {
    width: 78,
    align: 'center'
  })

  doc.roundedRect(margin, 134, contentWidth, 62, 12).fillAndStroke('#FFFFFF', BORDER)
  doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(16).text("CONTRAT D'ENSEIGNEMENT", margin + 16, 151, {
    width: 300,
    height: 20
  })
  doc.fillColor(MUTED).font('Helvetica').fontSize(8.2)
  safeText(doc, `Référence : ${teacher.matricule} | Type : ${contractTypeLabel(teacher.contractType)} | Généré le ${formatDate(new Date())}`, margin + 16, 173, 370, { height: 10 })
  doc.roundedRect(doc.page.width - margin - 150, 153, 130, 23, 11).fillAndStroke(CREAM, GOLD)
  doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(8.2).text(teacher.matricule, doc.page.width - margin - 143, 160, {
    width: 116,
    align: 'center',
    height: 11
  })

  let y = 214
  y = drawEnrollmentSection(doc, 'Parties au contrat', [
    { label: 'Employeur', value: teacher.institution.name },
    { label: 'Représentant', value: teacher.institution.directorName },
    { label: 'Enseignant', value: fullName },
    { label: 'Téléphone', value: teacher.phone },
    { label: 'Email', value: teacher.email },
    { label: 'Adresse', value: teacher.address },
    { label: 'Matricule', value: teacher.matricule },
    { label: 'Spécialité', value: teacher.specialization }
  ], y)

  y = drawEnrollmentSection(doc, 'Conditions principales', [
    { label: 'Type de contrat', value: contractTypeLabel(teacher.contractType) },
    { label: "Date d'embauche", value: formatDate(teacher.hireDate) },
    { label: 'Rémunération mensuelle brute', value: formatMoney(teacher.baseSalary, teacher.institution.currency) },
    { label: 'Année scolaire', value: teacher.institution.activeAcademicYearName },
    { label: 'Affectations', value: assignmentText },
    { label: 'Lieu de travail', value: teacher.institution.address ?? teacher.institution.city }
  ], y)

  y = drawClause(
    doc,
    'Article 1 - Objet',
    `Le present contrat formalise la collaboration entre ${teacher.institution.name} et ${fullName}, en qualite d'enseignant. L'enseignant s'engage a assurer les cours, evaluations, suivis pedagogiques et activites educatives confies par l'etablissement.`,
    y
  )
  y = drawClause(
    doc,
    'Article 2 - Missions et responsabilites',
    `Les missions principales couvrent : preparation des cours, tenue des cahiers pedagogiques, evaluation des apprenants, participation aux reunions, respect du reglement interieur et accompagnement des eleves. Affectations actuelles : ${assignmentText}.`,
    y
  )
  y = drawClause(
    doc,
    'Article 3 - Remuneration',
    `La remuneration mensuelle brute convenue est de ${formatMoney(teacher.baseSalary, teacher.institution.currency)}. Les paiements, retenues, primes et penalites eventuelles sont traites selon les procedures RH et comptables de l'etablissement.`,
    y
  )
  y = drawClause(
    doc,
    'Article 4 - Discipline, confidentialite et documents',
    "L'enseignant s'engage a respecter la confidentialite des donnees des eleves, familles, collegues et de l'etablissement. Tout document pedagogique, administratif ou numerique doit etre conserve et transmis selon les regles internes.",
    y
  )
  y = drawClause(
    doc,
    'Article 5 - Validation',
    `Ce document est genere par ${platform.appName} pour servir de base administrative. Il doit etre relu, complete si necessaire, puis signe par les parties habilitees avant archivage.`,
    y
  )

  drawSignatureArea(doc, y + 4, ['Enseignant', 'Direction', 'Cachet établissement'])
  return collectPdf(doc)
}

export async function renderReportCardPdf(institutionId: string, studentId: string, periodId: string, _lang = 'FR') {
  const [student, period] = await Promise.all([
    prisma.student.findFirst({
      where: { id: studentId, institutionId },
      include: {
        institution: true,
        classroom: { include: { academicYear: true, gradeLevel: true } },
        parents: { include: { parent: true } }
      }
    }),
    prisma.gradePeriod.findFirst({
      where: { id: periodId, institutionId },
      include: { academicYear: true }
    })
  ])
  if (!student) throw notFound('Élève introuvable')
  if (!period) throw notFound('Période introuvable')

  const grades = await prisma.grade.findMany({
    where: { institutionId, studentId, periodId },
    include: {
      subject: true,
      teacher: { select: { firstName: true, lastName: true } }
    },
    orderBy: [{ subject: { name: 'asc' } }, { createdAt: 'desc' }]
  })
  const lines = aggregateReportLines(grades)
  const average = computeWeightedAverage(lines)
  const coefficientTotal = lines.reduce((sum, line) => sum + line.coefficient, 0)
  const metadata = asRecord(student.metadata)
  const decision = asRecord(metadata.annualDecision)
  const decisionText = annualDecisionLabel(String(decision.decision ?? ''))
  const nextClassroomName = display(decision.nextClassroomName)
  const decisionComment = display(decision.comment, '')

  let rank: number | null = null
  let classSize = 0
  if (student.classroomId) {
    const classGrades = await prisma.grade.findMany({
      where: { institutionId, periodId, student: { classroomId: student.classroomId } },
      include: {
        subject: true,
        teacher: { select: { firstName: true, lastName: true } }
      }
    })
    const byStudent = new Map<string, ReportGrade[]>()
    classGrades.forEach((grade) => {
      const list = byStudent.get(grade.studentId) ?? []
      list.push(grade)
      byStudent.set(grade.studentId, list)
    })
    const ranking = Array.from(byStudent.entries())
      .map(([id, studentGrades]) => ({ id, average: computeWeightedAverage(aggregateReportLines(studentGrades)) }))
      .filter((item): item is { id: string; average: number } => item.average !== null)
      .sort((a, b) => b.average - a.average)
    classSize = ranking.length
    const index = ranking.findIndex((item) => item.id === studentId)
    rank = index >= 0 ? index + 1 : null
  }

  const logo = await resolveImageSource(student.institution.logoUrl, institutionId)
  const doc = new PDFDocument({ size: 'A4', margin: 34 })
  const primary = normalizeColor(student.institution.primaryColor, GREEN)
  const secondary = normalizeColor(student.institution.secondaryColor, CREAM)
  const accent = normalizeColor(student.institution.accentColor, GOLD)
  const fullName = `${student.firstName} ${student.lastName}`.trim()
  const schoolYear = period.academicYear?.name ?? student.classroom?.academicYear?.name ?? student.institution.activeAcademicYearName ?? 'Année scolaire'

  drawAcademicDocumentHeader(doc, student.institution, logo, 'Bulletin', period.name)

  doc.roundedRect(34, 138, 528, 92, 16).fillAndStroke('#FFFFFF', BORDER)
  doc.fillColor(primary).font('Helvetica-Bold').fontSize(13).text(fullName, 54, 155, { width: 260, height: 18, ellipsis: true })
  doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(`Matricule : ${student.matricule}`, 54, 177, { width: 210 })
  doc.fillColor(TEXT).font('Helvetica').fontSize(8.2).text(`Classe : ${display(student.classroom?.name)} | Niveau : ${display(student.classroom?.gradeLevel?.name)}`, 54, 195, {
    width: 330,
    height: 12,
    ellipsis: true
  })
  doc.fillColor(TEXT).font('Helvetica').fontSize(8.2).text(`Année scolaire : ${schoolYear}`, 54, 213, { width: 260 })
  doc.roundedRect(390, 154, 142, 52, 14).fillAndStroke(secondary, accent)
  doc.fillColor(primary).font('Helvetica-Bold').fontSize(8).text('MOYENNE GÉNÉRALE', 406, 166, { width: 110, align: 'center' })
  doc.fillColor(primary).font('Helvetica-Bold').fontSize(18).text(`${formatAverage(average)}/20`, 406, 181, { width: 110, align: 'center' })

  const summaryRows = [
    { label: 'Total coefficients', value: coefficientTotal ? String(coefficientTotal) : '-' },
    { label: 'Rang', value: rank ? `${rank}${rank === 1 ? 'er' : 'e'} / ${classSize}` : '-' },
    { label: 'Décision annuelle', value: decisionText },
    { label: 'Classe suivante', value: nextClassroomName }
  ]
  drawEnrollmentSection(doc, 'Synthèse pédagogique', summaryRows, 248, { columns: 2 })

  let y = 348
  drawReportTableHeader(doc, y, primary)
  y += 28
  if (lines.length === 0) {
    doc.roundedRect(34, y, 528, 54, 8).fillAndStroke('#FFFFFF', BORDER)
    doc.fillColor(MUTED).font('Helvetica').fontSize(9).text('Aucune note enregistrée pour cette période.', 54, y + 20, {
      width: 488,
      align: 'center'
    })
    y += 68
  } else {
    lines.forEach((line, index) => {
      if (y > doc.page.height - 150) {
        doc.addPage({ size: 'A4', margin: 34 })
        y = 54
        drawReportTableHeader(doc, y, primary)
        y += 28
      }
      doc.rect(34, y, 528, 34).fill(index % 2 === 0 ? '#FFFFFF' : '#F8FAF7')
      doc.strokeColor(BORDER).lineWidth(0.4).rect(34, y, 528, 34).stroke()
      doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(8).text(line.subject, 46, y + 9, { width: 150, height: 16, ellipsis: true })
      doc.fillColor(TEXT).font('Helvetica').fontSize(8).text(String(line.coefficient), 210, y + 10, { width: 38, align: 'center' })
      doc.fillColor(primary).font('Helvetica-Bold').fontSize(9).text(formatAverage(line.note), 258, y + 9, { width: 62, align: 'center' })
      doc.fillColor(TEXT).font('Helvetica').fontSize(7.4).text(display(line.appreciation, '-'), 334, y + 8, { width: 118, height: 18, ellipsis: true })
      doc.fillColor(MUTED).font('Helvetica').fontSize(7.2).text(display(line.teacher, '-'), 462, y + 8, { width: 82, height: 18, ellipsis: true })
      y += 34
    })
  }

  y += 18
  y = drawEnrollmentSection(doc, 'Observation et décision de fin d’année', [
    { label: 'Décision', value: decisionText },
    { label: 'Prochaine classe', value: nextClassroomName },
    { label: 'Observation', value: decisionComment || (average !== null && average >= 10 ? 'Travail satisfaisant, poursuivre les efforts.' : 'Suivi pédagogique recommandé.') }
  ], y, { columns: 1 })
  drawSignatureArea(doc, y + 4, ['Professeur principal', 'Direction', 'Parent / tuteur'])
  return collectPdf(doc)
}

export async function renderStudentCertificatePdf(institutionId: string, studentId: string, kind = 'SCHOOL_CERTIFICATE', _lang = 'FR') {
  const student = await prisma.student.findFirst({
    where: { id: studentId, institutionId },
    include: {
      institution: true,
      classroom: { include: { academicYear: true, gradeLevel: true } }
    }
  })
  if (!student) throw notFound('Élève introuvable')

  const logo = await resolveImageSource(student.institution.logoUrl, institutionId)
  const doc = new PDFDocument({ size: 'A4', margin: 42 })
  const primary = normalizeColor(student.institution.primaryColor, GREEN)
  const accent = normalizeColor(student.institution.accentColor, GOLD)
  const title = certificateTitle(kind)
  const fullName = `${student.firstName} ${student.lastName}`.trim()
  const schoolYear = student.classroom?.academicYear?.name ?? student.institution.activeAcademicYearName ?? 'Année scolaire en cours'
  const metadata = asRecord(student.metadata)
  const decision = asRecord(metadata.annualDecision)
  const decisionText = annualDecisionLabel(String(decision.decision ?? ''))

  drawAcademicDocumentHeader(doc, student.institution, logo, title, schoolYear)
  doc.roundedRect(62, 158, 472, 470, 20).fillAndStroke('#FFFFFF', BORDER)
  doc.fillColor(primary).font('Helvetica-Bold').fontSize(20).text(title, 82, 194, {
    width: 432,
    align: 'center',
    height: 28
  })
  doc.moveTo(180, 232).lineTo(416, 232).strokeColor(accent).lineWidth(1.2).stroke()

  const director = display(student.institution.directorName, 'Le Directeur / La Directrice')
  const className = display(student.classroom?.name)
  const gradeName = display(student.classroom?.gradeLevel?.name)
  const birthLine = student.birthDate
    ? `, né(e) le ${formatDate(student.birthDate)}${student.birthPlace ? ` à ${student.birthPlace}` : ''}`
    : ''

  const body = kind === 'DIPLOMA'
    ? `Nous certifions que l'élève ${fullName}${birthLine}, matricule ${student.matricule}, a suivi la classe de ${className} (${gradeName}) au titre de l'année scolaire ${schoolYear}. La décision enregistrée est : ${decisionText}.`
    : `Je soussigné(e), ${director}, certifie que l'élève ${fullName}${birthLine}, matricule ${student.matricule}, est régulièrement inscrit(e) dans notre établissement en classe de ${className} (${gradeName}) pour l'année scolaire ${schoolYear}.`

  doc.fillColor(TEXT).font('Helvetica').fontSize(12.5).text(body, 100, 278, {
    width: 396,
    align: 'justify',
    lineGap: 7
  })
  doc.fillColor(TEXT).font('Helvetica').fontSize(11).text(
    `La présente attestation est délivrée pour servir et valoir ce que de droit.`,
    100,
    410,
    { width: 396, align: 'center' }
  )
  doc.roundedRect(124, 460, 348, 68, 14).fillAndStroke(CREAM, accent)
  doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8).text('INFORMATIONS SCOLAIRES', 146, 478, { width: 304, align: 'center' })
  doc.fillColor(primary).font('Helvetica-Bold').fontSize(10).text(`${className} | ${schoolYear}`, 146, 498, {
    width: 304,
    align: 'center',
    height: 16,
    ellipsis: true
  })
  doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(`Matricule : ${student.matricule}`, 146, 516, { width: 304, align: 'center' })

  doc.fillColor(TEXT).font('Helvetica').fontSize(10).text(`Fait à ${display(student.institution.city, 'Abidjan')}, le ${formatDate(new Date())}`, 314, 560, {
    width: 180,
    align: 'center'
  })
  doc.moveTo(326, 606).lineTo(494, 606).strokeColor(MUTED).lineWidth(0.8).stroke()
  doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(8.8).text('Signature et cachet', 326, 616, { width: 168, align: 'center' })
  return collectPdf(doc)
}

function drawFinancialHeader(doc: PDFKit.PDFDocument, institution: {
  name: string
  slug: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  accentColor: string
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
}, logo: ImageSource, title: string, number: string) {
  const primary = normalizeColor(institution.primaryColor, GREEN)
  const secondary = normalizeColor(institution.secondaryColor, CREAM)
  const accent = normalizeColor(institution.accentColor, GOLD)

  doc.rect(0, 0, doc.page.width, 112).fill(primary)
  doc.rect(0, 104, doc.page.width, 8).fill(accent)
  drawLogoMark(doc, 34, 28, 54, 54, logo, institution.slug, { primary, secondary, accent })
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(15).text(institution.name, 104, 29, {
    width: doc.page.width - 250,
    height: 22,
    ellipsis: true
  })
  doc.fillColor(secondary).font('Helvetica').fontSize(7.3).text(
    [institution.address, institution.city, institution.phone, institution.email].filter(Boolean).join(' | '),
    104,
    56,
    { width: doc.page.width - 250, height: 30, ellipsis: true }
  )
  doc.roundedRect(doc.page.width - 158, 30, 124, 48, 12).fill('#FFFFFF')
  doc.fillColor(primary).font('Helvetica-Bold').fontSize(10).text(title.toUpperCase(), doc.page.width - 146, 42, {
    width: 100,
    align: 'center'
  })
  doc.fillColor(MUTED).font('Helvetica').fontSize(7).text(number, doc.page.width - 146, 60, {
    width: 100,
    align: 'center',
    ellipsis: true
  })
}

function drawFinancialBox(doc: PDFKit.PDFDocument, x: number, y: number, w: number, title: string, rows: Array<{ label: string; value: string }>) {
  const rowHeight = 22
  const height = 38 + rows.length * rowHeight
  doc.roundedRect(x, y, w, height, 12).fillAndStroke('#FFFFFF', BORDER)
  doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(8.5).text(title.toUpperCase(), x + 14, y + 12, {
    width: w - 28,
    height: 10,
    ellipsis: true
  })
  let rowY = y + 34
  for (const row of rows) {
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(6.3).text(row.label.toUpperCase(), x + 14, rowY, {
      width: 88,
      height: 9,
      ellipsis: true
    })
    doc.fillColor(TEXT).font('Helvetica').fontSize(7.8).text(row.value, x + 108, rowY - 1, {
      width: w - 122,
      height: 12,
      ellipsis: true
    })
    rowY += rowHeight
  }
  return y + height
}

function drawMoneySummary(doc: PDFKit.PDFDocument, x: number, y: number, w: number, rows: Array<{ label: string; value: string; strong?: boolean }>) {
  let rowY = y
  for (const row of rows) {
    doc.fillColor(row.strong ? GREEN : MUTED).font(row.strong ? 'Helvetica-Bold' : 'Helvetica').fontSize(row.strong ? 11 : 8.5)
      .text(row.label, x, rowY, { width: w / 2 })
    doc.fillColor(row.strong ? GREEN : TEXT).font('Helvetica-Bold').fontSize(row.strong ? 12 : 9)
      .text(row.value, x + w / 2, rowY, { width: w / 2, align: 'right' })
    rowY += row.strong ? 24 : 18
  }
}

function paymentProviderLabel(value: string | null | undefined) {
  if (value === 'CASH') return 'Espèces'
  if (value === 'WAVE') return 'Wave'
  if (value === 'ORANGE_MONEY') return 'Orange Money'
  if (value === 'MTN_MONEY') return 'MTN Money'
  if (value === 'MOOV_MONEY') return 'Moov Money'
  if (value === 'BANK_TRANSFER') return 'Virement bancaire'
  if (value === 'CARD') return 'Carte bancaire'
  return display(value)
}

function paymentStatusLabel(value: string | null | undefined) {
  if (value === 'PAID') return 'Payé'
  if (value === 'PARTIALLY_PAID') return 'Partiellement payé'
  if (value === 'ISSUED') return 'Emise'
  if (value === 'OVERDUE') return 'En retard'
  if (value === 'DRAFT') return 'Brouillon'
  if (value === 'CANCELED') return 'Annulée'
  if (value === 'PENDING') return 'En attente'
  if (value === 'FAILED') return 'Echoué'
  if (value === 'REFUNDED') return 'Remboursé'
  return display(value)
}

export async function renderInvoicePdf(institutionId: string, invoiceId: string, _lang = 'FR') {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, institutionId },
    include: {
      institution: true,
      student: { include: { classroom: true } },
      payments: { orderBy: { createdAt: 'desc' } }
    }
  })
  if (!invoice) throw notFound('Facture introuvable')

  const platform = await getPlatformBranding()
  const logo = await resolveImageSource(invoice.institution.logoUrl, institutionId)
  const doc = new PDFDocument({ size: 'A4', margin: 34 })
  drawFinancialHeader(doc, invoice.institution, logo, 'Facture', invoice.number)

  const total = invoice.totalAmount
  const paid = invoice.paidAmount
  const balance = Math.max(total - paid, 0)
  const studentName = `${invoice.student.firstName} ${invoice.student.lastName}`.trim()

  drawFinancialBox(doc, 34, 140, 252, 'Elève', [
    { label: 'Nom', value: studentName },
    { label: 'Matricule', value: display(invoice.student.matricule) },
    { label: 'Classe', value: display(invoice.student.classroom?.name) }
  ])
  drawFinancialBox(doc, 310, 140, 252, 'Facturation', [
    { label: 'Objet', value: invoice.title },
    { label: 'Date', value: formatDate(invoice.createdAt) },
    { label: 'Echéance', value: formatDate(invoice.dueDate) },
    { label: 'Statut', value: paymentStatusLabel(invoice.status) }
  ])

  const tableTop = 268
  doc.roundedRect(34, tableTop, 528, 108, 14).fillAndStroke('#FFFFFF', BORDER)
  doc.rect(34, tableTop, 528, 34).fill(GREEN)
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9)
  doc.text('DESCRIPTION', 52, tableTop + 12, { width: 270 })
  doc.text('MONTANT', 408, tableTop + 12, { width: 130, align: 'right' })
  doc.fillColor(TEXT).font('Helvetica').fontSize(9)
  doc.text(invoice.title, 52, tableTop + 53, { width: 300, height: 28 })
  doc.font('Helvetica-Bold').text(formatMoney(total, invoice.institution.currency), 408, tableTop + 53, {
    width: 130,
    align: 'right'
  })

  drawMoneySummary(doc, 346, 410, 216, [
    { label: 'Total facture', value: formatMoney(total, invoice.institution.currency) },
    { label: 'Déjà payé', value: formatMoney(paid, invoice.institution.currency) },
    { label: 'Reste à payer', value: formatMoney(balance, invoice.institution.currency), strong: true }
  ])

  doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(10).text('Historique des paiements', 34, 424)
  if (invoice.payments.length === 0) {
    doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text('Aucun paiement enregistré pour cette facture.', 34, 445)
  } else {
    let y = 448
    for (const payment of invoice.payments.slice(0, 8)) {
      doc.fillColor(TEXT).font('Helvetica').fontSize(8.3).text(
        `${formatDate(payment.paidAt ?? payment.createdAt)} - ${payment.receiptNumber ?? payment.id} - ${paymentProviderLabel(payment.provider)}${payment.transactionRef ? ` - ${payment.transactionRef}` : ''}`,
        34,
        y,
        { width: 318, ellipsis: true }
      )
      doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(8.5).text(formatMoney(payment.amount, payment.currency), 356, y, {
        width: 110,
        align: 'right'
      })
      y += 18
    }
  }

  doc.moveTo(34, 728).lineTo(562, 728).strokeColor(BORDER).lineWidth(0.8).stroke()
  doc.fillColor(MUTED).font('Helvetica').fontSize(7.8).text(
    `Facture générée automatiquement par ${platform.appName}. Merci de conserver ce document pour votre comptabilité.`,
    34,
    742,
    { width: 528, align: 'center' }
  )

  return collectPdf(doc)
}

export async function renderPaymentReceiptPdf(institutionId: string, paymentId: string, _lang = 'FR') {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, institutionId },
    include: {
      institution: true,
      parent: true,
      invoice: { include: { student: { include: { classroom: true } } } }
    }
  })
  if (!payment) throw notFound('Paiement introuvable')

  const student = payment.invoice?.student ?? (payment.studentId
    ? await prisma.student.findFirst({ where: { id: payment.studentId, institutionId }, include: { classroom: true } })
    : null)
  const logo = await resolveImageSource(payment.institution.logoUrl, institutionId)
  const doc = new PDFDocument({ size: 'A5', margin: 30 })
  drawFinancialHeader(doc, payment.institution, logo, 'Reçu', payment.receiptNumber ?? payment.id)

  drawFinancialBox(doc, 30, 132, 360, 'Paiement', [
    { label: 'Reçu', value: payment.receiptNumber ?? payment.id },
    { label: 'Date', value: formatDate(payment.paidAt ?? payment.createdAt) },
    { label: 'Mode', value: paymentProviderLabel(payment.provider) },
    { label: 'Statut', value: paymentStatusLabel(payment.status) },
    { label: 'Payeur / Réf.', value: display(payment.transactionRef) }
  ])

  drawFinancialBox(doc, 30, 292, 360, 'Bénéficiaire', [
    { label: 'Elève', value: student ? `${student.firstName} ${student.lastName}` : '-' },
    { label: 'Matricule', value: display(student?.matricule) },
    { label: 'Classe', value: display(student?.classroom?.name) },
    { label: 'Facture', value: display(payment.invoice?.number) }
  ])

  const balance = payment.invoice ? Math.max(payment.invoice.totalAmount - payment.invoice.paidAmount, 0) : 0
  doc.roundedRect(30, 428, 360, 76, 16).fillAndStroke(CREAM, GOLD)
  doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7.5).text('MONTANT ENCAISSÉ', 50, 443, { width: 140, height: 10 })
  doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(18).text(formatMoney(payment.amount, payment.currency), 50, 458, {
    width: 320,
    height: 22,
    align: 'center',
    ellipsis: true
  })
  if (payment.invoice) {
    doc.fillColor(TEXT).font('Helvetica').fontSize(7.5).text(`Reste sur facture : ${formatMoney(balance, payment.currency)}`, 50, 485, {
      width: 320,
      height: 10,
      align: 'center',
      ellipsis: true
    })
  }

  doc.moveTo(40, 548).lineTo(190, 548).strokeColor(MUTED).lineWidth(0.7).stroke()
  doc.moveTo(230, 548).lineTo(380, 548).strokeColor(MUTED).lineWidth(0.7).stroke()
  doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(7.5).text('Signature caisse', 40, 558, { width: 150, height: 10, align: 'center' })
  doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(7.5).text('Cachet établissement', 230, 558, { width: 150, height: 10, align: 'center' })
  return collectPdf(doc)
}

export async function renderSaleReceiptPdf(institutionId: string, saleId: string, _lang = 'FR') {
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, institutionId },
    include: {
      institution: true,
      items: { include: { product: true } }
    }
  })
  if (!sale) throw notFound('Vente introuvable')

  const [student, parent, logo] = await Promise.all([
    sale.studentId ? prisma.student.findFirst({ where: { id: sale.studentId, institutionId }, include: { classroom: true } }) : Promise.resolve(null),
    sale.parentId ? prisma.parent.findFirst({ where: { id: sale.parentId, institutionId } }) : Promise.resolve(null),
    resolveImageSource(sale.institution.logoUrl, institutionId)
  ])
  const doc = new PDFDocument({ size: 'A5', margin: 30 })
  drawFinancialHeader(doc, sale.institution, logo, 'Reçu boutique', sale.number)

  drawFinancialBox(doc, 30, 132, 360, 'Client', [
    { label: 'Elève', value: student ? `${student.firstName} ${student.lastName}` : '-' },
    { label: 'Classe', value: display(student?.classroom?.name) },
    { label: 'Parent', value: parent ? `${parent.firstName} ${parent.lastName}` : '-' },
    { label: 'Date', value: formatDate(sale.createdAt) }
  ])

  const tableY = 256
  doc.roundedRect(30, tableY, 360, 190, 12).fillAndStroke('#FFFFFF', BORDER)
  doc.rect(30, tableY, 360, 30).fill(GREEN)
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8)
  doc.text('ARTICLE', 44, tableY + 11, { width: 150 })
  doc.text('QTE', 218, tableY + 11, { width: 34, align: 'right' })
  doc.text('TOTAL', 276, tableY + 11, { width: 86, align: 'right' })
  let y = tableY + 44
  for (const item of sale.items.slice(0, 8)) {
    doc.fillColor(TEXT).font('Helvetica').fontSize(8.2).text(item.product.name, 44, y, { width: 158, ellipsis: true })
    doc.text(String(item.quantity), 218, y, { width: 34, align: 'right' })
    doc.font('Helvetica-Bold').text(formatMoney(item.total, sale.institution.currency), 276, y, { width: 86, align: 'right' })
    y += 18
  }

  drawMoneySummary(doc, 174, 468, 216, [
    { label: 'Total vente', value: formatMoney(sale.totalAmount, sale.institution.currency) },
    { label: 'Montant payé', value: formatMoney(sale.paidAmount, sale.institution.currency), strong: true }
  ])

  doc.fillColor(MUTED).font('Helvetica').fontSize(7.5).text(
    'Reçu généré automatiquement après validation de la vente boutique.',
    30,
    560,
    { width: 360, align: 'center' }
  )
  return collectPdf(doc)
}

export async function renderSaaSInvoicePdf(invoiceId: string, _lang = 'FR') {
  const invoice = await prisma.saaSInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      institution: true,
      plan: true,
      subscription: true,
      payments: { orderBy: { createdAt: 'desc' } }
    }
  })
  if (!invoice) throw notFound('Facture SaaS introuvable')

  const platform = await getPlatformBranding()
  const PLATFORM_PRIMARY = normalizeColor(platform.primaryColor, '#0F6BFF')
  const PLATFORM_SECONDARY = normalizeColor(platform.secondaryColor, '#07111F')
  const PLATFORM_ACCENT = normalizeColor(platform.accentColor, '#F5B941')

  const doc = new PDFDocument({ size: 'A4', margin: 34 })

  // Header: use platform branding as issuer
  doc.rect(0, 0, doc.page.width, 112).fill(PLATFORM_PRIMARY)
  doc.rect(0, 104, doc.page.width, 8).fill(PLATFORM_ACCENT)
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(16).text(platform.appName, 34, 30, { width: 340, height: 24 })
  doc.fillColor(PLATFORM_SECONDARY === '#07111F' ? '#CBD5E1' : PLATFORM_SECONDARY).font('Helvetica').fontSize(7.5).text(
    [platform.supportEmail, platform.supportPhone, platform.website].filter(Boolean).join('  |  '),
    34, 60, { width: 340 }
  )
  doc.roundedRect(doc.page.width - 158, 30, 124, 48, 12).fill('#FFFFFF')
  doc.fillColor(PLATFORM_PRIMARY).font('Helvetica-Bold').fontSize(10).text('FACTURE SAAS', doc.page.width - 146, 42, { width: 100, align: 'center' })
  doc.fillColor(MUTED).font('Helvetica').fontSize(7).text(invoice.number, doc.page.width - 146, 60, { width: 100, align: 'center', ellipsis: true })

  const saasStatusLabel = (s: string) => {
    if (s === 'ISSUED') return 'Émise'
    if (s === 'PAID') return 'Payée'
    if (s === 'OVERDUE') return 'En retard'
    if (s === 'CANCELED') return 'Annulée'
    return s
  }
  const cycleLabel = (c: string | null | undefined) => {
    if (c === 'MONTHLY') return 'Mensuel'
    if (c === 'ANNUAL') return 'Annuel'
    if (c === 'SCHOOL_YEAR') return 'Année scolaire'
    if (c === 'MULTI_YEAR') return 'Multi-années'
    return c ?? '-'
  }

  drawFinancialBox(doc, 34, 140, 252, 'École cliente', [
    { label: 'Nom', value: invoice.institution.name },
    { label: 'Slug', value: invoice.institution.slug },
    { label: 'Email', value: display(invoice.institution.email) },
    { label: 'Téléphone', value: display(invoice.institution.phone) },
    { label: 'Adresse', value: [invoice.institution.city, invoice.institution.country].filter(Boolean).join(', ') || '-' }
  ])
  drawFinancialBox(doc, 310, 140, 252, 'Abonnement', [
    { label: 'Plan', value: display(invoice.plan?.name) },
    { label: 'Cycle', value: cycleLabel(invoice.subscription?.cycle) },
    { label: 'Date', value: formatDate(invoice.createdAt) },
    { label: 'Échéance', value: formatDate(invoice.dueDate) },
    { label: 'Statut', value: saasStatusLabel(invoice.status) }
  ])

  const tableTop = 310
  doc.roundedRect(34, tableTop, 528, 80, 14).fillAndStroke('#FFFFFF', BORDER)
  doc.rect(34, tableTop, 528, 34).fill(PLATFORM_PRIMARY)
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9)
  doc.text('DESCRIPTION', 52, tableTop + 12, { width: 300 })
  doc.text('MONTANT', 408, tableTop + 12, { width: 130, align: 'right' })
  doc.fillColor(TEXT).font('Helvetica').fontSize(9)
  doc.text(`Abonnement ${display(invoice.plan?.name)} — ${cycleLabel(invoice.subscription?.cycle)}`, 52, tableTop + 53, { width: 340 })
  doc.font('Helvetica-Bold').text(formatMoney(invoice.amount, invoice.currency), 408, tableTop + 53, { width: 130, align: 'right' })

  const paid = invoice.payments.reduce((s, p) => s + p.amount, 0)
  const balance = Math.max(invoice.amount - paid, 0)

  drawMoneySummary(doc, 346, 424, 216, [
    { label: 'Total facture', value: formatMoney(invoice.amount, invoice.currency) },
    { label: 'Déjà payé', value: formatMoney(paid, invoice.currency) },
    { label: 'Reste à payer', value: formatMoney(balance, invoice.currency), strong: true }
  ])

  if (invoice.payments.length > 0) {
    doc.fillColor(PLATFORM_PRIMARY).font('Helvetica-Bold').fontSize(10).text('Historique des règlements', 34, 470)
    let y = 492
    for (const payment of invoice.payments.slice(0, 6)) {
      doc.fillColor(TEXT).font('Helvetica').fontSize(8.3).text(
        `${formatDate(payment.paidAt ?? payment.createdAt)} — ${payment.provider}${payment.transactionRef ? ' — ' + payment.transactionRef : ''}`,
        34, y, { width: 340 }
      )
      doc.fillColor(PLATFORM_PRIMARY).font('Helvetica-Bold').fontSize(8.5).text(
        formatMoney(payment.amount, payment.currency), 356, y, { width: 168, align: 'right' }
      )
      y += 18
    }
  }

  doc.moveTo(34, 728).lineTo(562, 728).strokeColor(BORDER).lineWidth(0.8).stroke()
  doc.fillColor(MUTED).font('Helvetica').fontSize(7.8).text(
    `Facture SaaS générée par ${platform.appName}. Contact : ${platform.supportEmail} — ${platform.supportPhone}`,
    34, 742, { width: 528, align: 'center' }
  )

  return collectPdf(doc)
}
