import PDFDocument from 'pdfkit'

export const PDF_PALETTE = {
  primary: '#064E3B',
  primarySoft: '#E7F3EE',
  accent: '#C89B3C',
  accentSoft: '#FBF2D8',
  ink: '#12352B',
  muted: '#617066',
  border: '#DED5BF',
  surface: '#FFFFFF',
  page: '#FBFAF5'
}

export type PdfBrand = {
  name?: string
  logo?: string | Buffer
  primaryColor?: string | null
  secondaryColor?: string | null
  accentColor?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  city?: string | null
  country?: string | null
}

export type PdfHeaderOptions = {
  title: string
  subtitle?: string
  documentNumber?: string
  brand?: PdfBrand
  generatedAt?: string
}

export type PdfFooterOptions = {
  generatedAt?: string
  generatorName?: string
  signatureLabel?: string
}

export type PdfTableColumn<T> = {
  header: string
  width: number
  align?: 'left' | 'center' | 'right'
  get: (row: T) => string | number | null | undefined
}

function normalizeColor(value: string | null | undefined, fallback: string) {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback
}

function initials(name: string | undefined) {
  const parts = (name || 'SoraSchool').split(/\s+/).filter(Boolean)
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'SS'
}

export function createProfessionalPdf(options: PDFKit.PDFDocumentOptions = {}) {
  return new PDFDocument({
    size: 'A4',
    margin: 36,
    bufferPages: true,
    ...options
  })
}

export function safePdfFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120) || 'document'
}

export function drawProfessionalHeader(doc: PDFKit.PDFDocument, options: PdfHeaderOptions) {
  const brand = options.brand ?? {}
  const primary = normalizeColor(brand.primaryColor, PDF_PALETTE.primary)
  const secondary = normalizeColor(brand.secondaryColor, PDF_PALETTE.primarySoft)
  const accent = normalizeColor(brand.accentColor, PDF_PALETTE.accent)
  const pageWidth = doc.page.width
  const margin = doc.page.margins.left

  doc.rect(0, 0, pageWidth, 122).fill(primary)
  doc.rect(0, 112, pageWidth, 10).fill(accent)
  doc.roundedRect(margin, 24, 62, 62, 16).fill('#FFFFFF')

  try {
    if (brand.logo) {
      doc.image(brand.logo, margin + 8, 32, { fit: [46, 46], align: 'center', valign: 'center' })
    } else {
      doc.fillColor(primary).font('Helvetica-Bold').fontSize(18).text(initials(brand.name), margin, 45, {
        width: 62,
        align: 'center'
      })
    }
  } catch {
    doc.fillColor(primary).font('Helvetica-Bold').fontSize(18).text(initials(brand.name), margin, 45, {
      width: 62,
      align: 'center'
    })
  }

  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(18).text(brand.name || 'SoraSchool', margin + 78, 28, {
    width: pageWidth - margin * 2 - 240,
    height: 24,
    ellipsis: true
  })
  doc.fillColor(secondary).font('Helvetica').fontSize(8).text(
    [brand.address, brand.city, brand.country, brand.phone, brand.email].filter(Boolean).join(' | '),
    margin + 78,
    58,
    { width: pageWidth - margin * 2 - 240, height: 28, ellipsis: true }
  )

  doc.roundedRect(pageWidth - margin - 160, 28, 160, 54, 14).fill('#FFFFFF')
  doc.fillColor(primary).font('Helvetica-Bold').fontSize(10).text(options.title.toUpperCase(), pageWidth - margin - 148, 42, {
    width: 136,
    align: 'center',
    ellipsis: true
  })
  doc.fillColor(PDF_PALETTE.muted).font('Helvetica').fontSize(7.2).text(
    options.documentNumber || options.subtitle || '',
    pageWidth - margin - 148,
    60,
    { width: 136, align: 'center', ellipsis: true }
  )

  if (options.subtitle) {
    doc.fillColor(PDF_PALETTE.ink).font('Helvetica-Bold').fontSize(13).text(options.subtitle, margin, 144, {
      width: pageWidth - margin * 2 - 150,
      ellipsis: true
    })
  }
  if (options.generatedAt) {
    doc.fillColor(PDF_PALETTE.muted).font('Helvetica').fontSize(8).text(`Généré le ${options.generatedAt}`, margin, 146, {
      width: pageWidth - margin * 2,
      align: 'right',
      ellipsis: true
    })
  }

  doc.y = 176
}

export function ensurePdfSpace(doc: PDFKit.PDFDocument, neededHeight: number, topY = 48) {
  const bottomLimit = doc.page.height - 84
  if (doc.y + neededHeight <= bottomLimit) return
  doc.addPage()
  doc.y = topY
}

export function drawSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  ensurePdfSpace(doc, 42)
  const margin = doc.page.margins.left
  const width = doc.page.width - margin * 2
  const y = doc.y

  doc.roundedRect(margin, y, width, 28, 8).fill(PDF_PALETTE.primary)
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10).text(title.toUpperCase(), margin + 12, y + 9, {
    width: width - 24,
    ellipsis: true
  })
  doc.y = y + 42
}

export function drawKpiGrid(doc: PDFKit.PDFDocument, items: Array<{ label: string; value: string; hint?: string }>) {
  if (!items.length) return
  const margin = doc.page.margins.left
  const gap = 10
  const perRow = 4
  const width = (doc.page.width - margin * 2 - gap * (perRow - 1)) / perRow
  const height = 62

  for (let i = 0; i < items.length; i += perRow) {
    ensurePdfSpace(doc, height + 16)
    const y = doc.y
    items.slice(i, i + perRow).forEach((item, index) => {
      const x = margin + index * (width + gap)
      doc.roundedRect(x, y, width, height, 12).fillAndStroke(PDF_PALETTE.surface, PDF_PALETTE.border)
      doc.fillColor(PDF_PALETTE.muted).font('Helvetica-Bold').fontSize(6.8).text(item.label.toUpperCase(), x + 10, y + 12, {
        width: width - 20,
        height: 10,
        ellipsis: true
      })
      doc.fillColor(PDF_PALETTE.primary).font('Helvetica-Bold').fontSize(15).text(item.value, x + 10, y + 28, {
        width: width - 20,
        height: 18,
        ellipsis: true
      })
      if (item.hint) {
        doc.fillColor(PDF_PALETTE.muted).font('Helvetica').fontSize(6.6).text(item.hint, x + 10, y + 48, {
          width: width - 20,
          height: 8,
          ellipsis: true
        })
      }
    })
    doc.y = y + height + 14
  }
}

export function drawInfoRows(doc: PDFKit.PDFDocument, rows: Array<{ label: string; value: string }>) {
  const margin = doc.page.margins.left
  const width = doc.page.width - margin * 2
  const rowHeight = 24
  ensurePdfSpace(doc, rows.length * rowHeight + 18)
  const y = doc.y

  doc.roundedRect(margin, y, width, rows.length * rowHeight + 16, 12).fillAndStroke(PDF_PALETTE.surface, PDF_PALETTE.border)
  rows.forEach((row, index) => {
    const rowY = y + 12 + index * rowHeight
    doc.fillColor(PDF_PALETTE.muted).font('Helvetica-Bold').fontSize(7).text(row.label.toUpperCase(), margin + 14, rowY, {
      width: 185,
      ellipsis: true
    })
    doc.fillColor(PDF_PALETTE.ink).font('Helvetica').fontSize(8.5).text(row.value, margin + 210, rowY - 1, {
      width: width - 224,
      align: 'right',
      ellipsis: true
    })
  })
  doc.y = y + rows.length * rowHeight + 28
}

export function drawMiniBarChart(doc: PDFKit.PDFDocument, title: string, rows: Array<{ label: string; value: number }>) {
  if (!rows.length) return
  ensurePdfSpace(doc, 120)
  const margin = doc.page.margins.left
  const width = doc.page.width - margin * 2
  const y = doc.y
  const chartRows = rows.slice(0, 8)
  const max = Math.max(...chartRows.map((row) => Math.abs(row.value)), 1)

  doc.roundedRect(margin, y, width, 110, 12).fillAndStroke(PDF_PALETTE.surface, PDF_PALETTE.border)
  doc.fillColor(PDF_PALETTE.primary).font('Helvetica-Bold').fontSize(9).text(title, margin + 14, y + 12, {
    width: width - 28,
    ellipsis: true
  })
  chartRows.forEach((row, index) => {
    const rowY = y + 34 + index * 9
    const barW = Math.max(2, Math.round((Math.abs(row.value) / max) * (width - 178)))
    doc.fillColor(PDF_PALETTE.muted).font('Helvetica').fontSize(6.8).text(row.label, margin + 14, rowY - 1, {
      width: 78,
      ellipsis: true
    })
    doc.roundedRect(margin + 98, rowY, width - 178, 5, 2.5).fill(PDF_PALETTE.accentSoft)
    doc.roundedRect(margin + 98, rowY, barW, 5, 2.5).fill(PDF_PALETTE.accent)
    doc.fillColor(PDF_PALETTE.ink).font('Helvetica-Bold').fontSize(6.8).text(String(row.value), margin + width - 66, rowY - 1, {
      width: 52,
      align: 'right'
    })
  })
  doc.y = y + 124
}

export function drawSimpleTable<T>(doc: PDFKit.PDFDocument, title: string, rows: T[], columns: Array<PdfTableColumn<T>>) {
  if (!rows.length) return
  drawSectionTitle(doc, title)

  const margin = doc.page.margins.left
  const rowHeight = 24
  const headerHeight = 28
  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0)

  const drawHeader = () => {
    ensurePdfSpace(doc, headerHeight + rowHeight)
    const y = doc.y
    doc.roundedRect(margin, y, totalWidth, headerHeight, 8).fill(PDF_PALETTE.primary)
    let x = margin
    for (const column of columns) {
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.2).text(column.header.toUpperCase(), x + 8, y + 10, {
        width: column.width - 16,
        align: column.align ?? 'left',
        ellipsis: true
      })
      x += column.width
    }
    doc.y = y + headerHeight
  }

  drawHeader()
  rows.slice(0, 24).forEach((row, index) => {
    if (doc.y + rowHeight > doc.page.height - 84) {
      doc.addPage()
      doc.y = 48
      drawHeader()
    }
    const y = doc.y
    doc.rect(margin, y, totalWidth, rowHeight).fill(index % 2 === 0 ? '#FFFFFF' : '#F8FAF7')
    doc.moveTo(margin, y + rowHeight).lineTo(margin + totalWidth, y + rowHeight).strokeColor(PDF_PALETTE.border).lineWidth(0.5).stroke()
    let x = margin
    for (const column of columns) {
      doc.fillColor(PDF_PALETTE.ink).font('Helvetica').fontSize(7.4).text(String(column.get(row) ?? '-'), x + 8, y + 8, {
        width: column.width - 16,
        align: column.align ?? 'left',
        height: 10,
        ellipsis: true
      })
      x += column.width
    }
    doc.y = y + rowHeight
  })
  if (rows.length > 24) {
    doc.moveDown(0.4)
    doc.fillColor(PDF_PALETTE.muted).font('Helvetica-Oblique').fontSize(7.5).text(`${rows.length - 24} ligne(s) supplémentaire(s) disponibles dans l'export Excel.`, margin, doc.y, {
      width: totalWidth,
      align: 'right'
    })
  }
  doc.moveDown(1)
}

export function drawSignatureBlock(doc: PDFKit.PDFDocument, labels = ['Direction', 'Administration', 'Cachet']) {
  ensurePdfSpace(doc, 104)
  const margin = doc.page.margins.left
  const width = doc.page.width - margin * 2
  const y = doc.y
  const colWidth = width / labels.length

  doc.roundedRect(margin, y, width, 86, 12).fillAndStroke(PDF_PALETTE.surface, PDF_PALETTE.border)
  labels.forEach((label, index) => {
    const x = margin + index * colWidth
    if (index > 0) doc.moveTo(x, y).lineTo(x, y + 86).strokeColor(PDF_PALETTE.border).lineWidth(0.6).stroke()
    doc.fillColor(PDF_PALETTE.ink).font('Helvetica-Bold').fontSize(8).text(label, x + 12, y + 14, {
      width: colWidth - 24,
      align: 'center',
      ellipsis: true
    })
    doc.moveTo(x + 18, y + 58).lineTo(x + colWidth - 18, y + 58).strokeColor(PDF_PALETTE.muted).lineWidth(0.6).stroke()
  })
  doc.y = y + 104
}

export function addFooterToBufferedPages(doc: PDFKit.PDFDocument, options: PdfFooterOptions = {}) {
  const range = doc.bufferedPageRange()
  const margin = doc.page.margins.left
  const total = range.count
  const generatedAt = options.generatedAt ?? new Date().toLocaleString('fr-FR')
  const generatorName = options.generatorName ?? 'SoraSchool'

  for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex++) {
    doc.switchToPage(pageIndex)
    const y = doc.page.height - 50
    const width = doc.page.width - margin * 2
    doc.save()
    doc.moveTo(margin, y - 10).lineTo(margin + width, y - 10).strokeColor(PDF_PALETTE.border).lineWidth(0.7).stroke()
    doc.fillColor(PDF_PALETTE.muted).font('Helvetica').fontSize(7.2).text(
      `Document généré par ${generatorName} - ${generatedAt}`,
      margin,
      y,
      { width: width * 0.72, ellipsis: true }
    )
    doc.fillColor(PDF_PALETTE.muted).font('Helvetica-Bold').fontSize(7.2).text(
      `Page ${pageIndex - range.start + 1} / ${total}`,
      margin,
      y,
      { width, align: 'right' }
    )
    if (options.signatureLabel) {
      doc.fillColor(PDF_PALETTE.muted).font('Helvetica').fontSize(6.8).text(options.signatureLabel, margin, y + 14, {
        width,
        align: 'center',
        ellipsis: true
      })
    }
    doc.restore()
  }
}
