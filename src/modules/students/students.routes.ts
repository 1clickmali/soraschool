import { Router, type Request } from 'express'
import ExcelJS from 'exceljs'
import multer from 'multer'
import { z } from 'zod'
import { EnrollmentStatus, Gender, InvoiceStatus, NotificationLevel, Prisma, StudentStatus, UserRole } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { getScopedEstablishmentId, resolveWritableEstablishmentId } from '../../lib/access-scope'
import { badRequest, forbidden, notFound } from '../../lib/errors'
import { getParentScope } from '../../lib/parent-access'
import { assertStudentCapacity } from '../../lib/plan-limits'
import { writeAuditLog } from '../../lib/audit'
import { authenticate } from '../../middlewares/auth'
import { requireRoles, requireTenantUser } from '../../middlewares/rbac'
import { validate } from '../../middlewares/validate'
import { renderEnrollmentFormPdf, renderStudentCardPdf } from '../pdf/pdf.service'

export const studentsRoutes = Router()
studentsRoutes.use(authenticate, requireTenantUser)

const writeRoles = [UserRole.CENTRAL_ADMIN, UserRole.DIRECTOR, UserRole.ADMINISTRATION, UserRole.SECRETARIAT] as const
const cardGeneratorRoles = [UserRole.SUPER_ADMIN, UserRole.CENTRAL_ADMIN, UserRole.DIRECTOR, UserRole.ADMINISTRATION, UserRole.SECRETARIAT] as const
const studentImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, cb) {
    const allowed = new Set([
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream'
    ])
    if (!allowed.has(file.mimetype) && !file.originalname.toLowerCase().endsWith('.xlsx')) {
      return cb(badRequest('Format non autorisé. Téléversez le modèle Excel .xlsx'))
    }
    cb(null, true)
  }
})

async function ensureStudentReadable(req: Request, studentId: string) {
  if (req.user!.role === UserRole.PARENT) {
    const scope = await getParentScope(req.institutionId!, req.user!.id)
    if (!scope.studentIds.includes(studentId)) throw forbidden('Élève non autorisé')
    return
  }

  const establishmentId = getScopedEstablishmentId(req)
  if (!establishmentId) return
  const student = await prisma.student.findFirst({
    where: { id: studentId, institutionId: req.institutionId! },
    select: { establishmentId: true }
  })
  if (student?.establishmentId !== establishmentId) throw forbidden('Élève non autorisé pour votre établissement')
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

function mapGender(value: unknown): Gender | undefined {
  if (value === 'M' || value === 'MALE' || value === 'Masculin') return Gender.MALE
  if (value === 'F' || value === 'FEMALE' || value === 'Féminin') return Gender.FEMALE
  return undefined
}

function splitPersonName(fullName?: string) {
  const parts = normalizeOptionalString(fullName)?.split(/\s+/) ?? []
  return {
    firstName: parts[0] ?? 'Parent',
    lastName: parts.slice(1).join(' ') || 'Tuteur'
  }
}

function displayName(user?: { firstName?: string | null; lastName?: string | null; phone?: string | null; role?: string | null; id?: string | null }) {
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.phone || user?.role || user?.id || 'Utilisateur'
}

async function notifyDirectors(institutionId: string, title: string, body: string, data?: Record<string, unknown>) {
  const directors = await prisma.user.findMany({
    where: { institutionId, role: { in: [UserRole.DIRECTOR, UserRole.CENTRAL_ADMIN] }, isActive: true },
    select: { id: true }
  })
  if (!directors.length) return
  await prisma.notification.createMany({
    data: directors.map((director) => ({
      institutionId,
      userId: director.id,
      level: NotificationLevel.INFO,
      title,
      body,
      data: data as Prisma.InputJsonValue | undefined
    }))
  })
}

const IMPORT_HEADERS = [
  'Prénom *',
  'Nom *',
  'Sexe (M/F)',
  'Date naissance (AAAA-MM-JJ)',
  'Lieu naissance',
  'Classe',
  'Nationalité',
  'Téléphone élève',
  'Email élève',
  'Cycle',
  'Filière / programme',
  'Régime (DAY/HALF_BOARDING/BOARDING)',
  'Nom père',
  'Téléphone père',
  'Nom mère',
  'Téléphone mère',
  'Nom tuteur',
  'Téléphone tuteur',
  'Lien tuteur',
  'Adresse',
  'Ville',
  'Allergies / notes médicales',
  'Montant scolarité',
  'Échéance scolarité (AAAA-MM-JJ)',
  'Libellé facture'
] as const

function normalizeImportHeader(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\*/g, '')
    .replace(/\(.+?\)/g, '')
    .trim()
    .toLowerCase()
}

function textCell(value: unknown) {
  if (value == null) return undefined
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object' && 'text' in value) return normalizeOptionalString((value as { text?: string }).text)
  if (typeof value === 'object' && 'result' in value) return textCell((value as { result?: unknown }).result)
  return normalizeOptionalString(String(value))
}

function numberCell(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : undefined
  const text = textCell(value)?.replace(/\s/g, '').replace(',', '.')
  if (!text) return undefined
  const parsed = Number(text)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined
}

function dateCell(value: unknown) {
  if (typeof value === 'object' && value && 'result' in value) return dateCell((value as { result?: unknown }).result)
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'number' && Number.isFinite(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30)
    const date = new Date(excelEpoch + Math.round(value) * 24 * 60 * 60 * 1000)
    return Number.isNaN(date.getTime()) ? undefined : date
  }
  const text = textCell(value)
  if (!text) return undefined
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00.000Z`)
  const fr = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text)
  if (fr) return new Date(`${fr[3]}-${fr[2].padStart(2, '0')}-${fr[1].padStart(2, '0')}T00:00:00.000Z`)
  return undefined
}

function normalizeLookup(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

studentsRoutes.get(
  '/',
  asyncHandler(async (req, res) => {
    const search = String(req.query.search ?? '')
    const classroomId = req.query.classroomId ? String(req.query.classroomId) : undefined
    const status = req.query.status ? String(req.query.status) : undefined
    const gradeLevelId = req.query.gradeLevelId ? String(req.query.gradeLevelId) : undefined
    const parentScope = req.user!.role === UserRole.PARENT
      ? await getParentScope(req.institutionId!, req.user!.id)
      : null
    const establishmentId = getScopedEstablishmentId(req)
    let teacherClassroomIds: string[] | undefined
    if (req.user!.role === UserRole.TEACHER) {
      const teacher = await prisma.teacher.findFirst({ where: { institutionId: req.institutionId!, userId: req.user!.id } })
      const assignments = teacher
        ? await prisma.teacherAssignment.findMany({ where: { teacherId: teacher.id }, select: { classroomId: true } })
        : []
      teacherClassroomIds = assignments.map((assignment) => assignment.classroomId)
    }
    const students = await prisma.student.findMany({
      where: {
        institutionId: req.institutionId!,
        establishmentId,
        id: parentScope ? { in: parentScope.studentIds } : undefined,
        classroomId: teacherClassroomIds ? { in: classroomId ? teacherClassroomIds.filter((id) => id === classroomId) : teacherClassroomIds } : classroomId,
        status: status as never,
        classroom: gradeLevelId ? { gradeLevelId } : undefined,
        OR: search
          ? [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { matricule: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { fatherPhone: { contains: search, mode: 'insensitive' } },
              { motherPhone: { contains: search, mode: 'insensitive' } },
              { guardianPhone: { contains: search, mode: 'insensitive' } },
              { fatherName: { contains: search, mode: 'insensitive' } },
              { motherName: { contains: search, mode: 'insensitive' } },
              { guardianName: { contains: search, mode: 'insensitive' } },
              { classroom: { name: { contains: search, mode: 'insensitive' } } }
            ]
          : undefined
      },
      include: {
        classroom: { include: { gradeLevel: true } },
        parents: { include: { parent: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        validatedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        rejectedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        enrollments: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { invoices: true, grades: true, attendances: true, discipline: true } }
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    })
    res.json({ students })
  })
)

studentsRoutes.get(
  '/import-template',
  requireRoles(...writeRoles),
  asyncHandler(async (req, res) => {
    const institution = await prisma.institution.findUnique({
      where: { id: req.institutionId! },
      select: { name: true, activeAcademicYearName: true }
    })
    const establishmentId = getScopedEstablishmentId(req)
    const classrooms = await prisma.classroom.findMany({
      where: { institutionId: req.institutionId!, establishmentId },
      include: { gradeLevel: true },
      orderBy: [{ name: 'asc' }]
    })

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'SoraSchool'
    workbook.created = new Date()

    const sheet = workbook.addWorksheet('Élèves', {
      views: [{ state: 'frozen', ySplit: 1 }],
      properties: { tabColor: { argb: 'FF059669' } }
    })
    sheet.columns = IMPORT_HEADERS.map((header) => ({
      header,
      key: header,
      width: header.includes('Date') || header.includes('Téléphone') ? 22 : Math.min(Math.max(header.length + 4, 16), 32)
    }))
    sheet.getRow(1).height = 28
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } }
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    sheet.autoFilter = { from: 'A1', to: `${sheet.getColumn(IMPORT_HEADERS.length).letter}1` }

    for (let row = 2; row <= 501; row += 1) {
      sheet.getCell(`C${row}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"M,F"'] }
      sheet.getCell(`L${row}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"DAY,HALF_BOARDING,BOARDING"'] }
      sheet.getCell(`D${row}`).numFmt = 'yyyy-mm-dd'
      sheet.getCell(`X${row}`).numFmt = 'yyyy-mm-dd'
      sheet.getCell(`W${row}`).numFmt = '#,##0'
      if (classrooms.length > 0) {
        sheet.getCell(`F${row}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`'Références'!$A$2:$A$${classrooms.length + 1}`]
        }
      }
    }

    const instructions = workbook.addWorksheet('Instructions', {
      properties: { tabColor: { argb: 'FFF59E0B' } }
    })
    instructions.columns = [
      { width: 28 },
      { width: 88 }
    ]
    instructions.addRows([
      ['École', institution?.name ?? 'SoraSchool'],
      ['Année scolaire', institution?.activeAcademicYearName ?? 'Année active'],
      ['Objectif', 'Remplir la feuille “Élèves”, puis téléverser le fichier dans SoraSchool > Apprenants.'],
      ['Champs obligatoires', 'Prénom et Nom. La classe est recommandée mais peut rester vide.'],
      ['Dates', 'Utilisez le format AAAA-MM-JJ, par exemple 2014-09-25.'],
      ['Parents', 'Renseignez au moins un téléphone parent/tuteur pour pouvoir envoyer reçus, factures et bulletins.'],
      ['Validation Directeur', 'Si l’import est fait par la Secrétaire ou l’Administration, les inscriptions restent en attente de validation Directeur.'],
      ['Important', 'Ne renommez pas les colonnes de la feuille “Élèves”.']
    ])
    instructions.getColumn(1).font = { bold: true, color: { argb: 'FF064E3B' } }
    instructions.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    instructions.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } }

    const references = workbook.addWorksheet('Références', {
      properties: { tabColor: { argb: 'FF3B82F6' } }
    })
    references.columns = [
      { header: 'Classes disponibles', key: 'classroom', width: 32 },
      { header: 'Niveau', key: 'level', width: 24 },
      { header: 'ID technique', key: 'id', width: 30 }
    ]
    references.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    references.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } }
    classrooms.forEach((classroom) => references.addRow({
      classroom: classroom.name,
      level: classroom.gradeLevel?.name ?? '',
      id: classroom.id
    }))

    const example = workbook.addWorksheet('Exemple', {
      properties: { tabColor: { argb: 'FF64748B' } }
    })
    example.columns = sheet.columns.map((column) => ({ header: column.header as string, key: String(column.header), width: column.width }))
    example.addRow({
      'Prénom *': 'Awa',
      'Nom *': 'Kouassi',
      'Sexe (M/F)': 'F',
      'Date naissance (AAAA-MM-JJ)': '2014-09-25',
      'Classe': classrooms[0]?.name ?? 'CP1 A',
      'Nationalité': 'Ivoirienne',
      'Nom tuteur': 'Mariam Kouassi',
      'Téléphone tuteur': '+2250700000000',
      'Lien tuteur': 'Mère',
      'Adresse': 'Cocody',
      'Montant scolarité': 100000,
      'Échéance scolarité (AAAA-MM-JJ)': '2026-06-30',
      'Libellé facture': 'Frais de scolarité'
    })
    example.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    example.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } }

    await writeAuditLog({
      institutionId: req.institutionId,
      actorId: req.user!.id,
      action: 'STUDENT_IMPORT_TEMPLATE_DOWNLOADED',
      entity: 'Student',
      req
    })

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="modele-import-eleves-soraschool.xlsx"')
    await workbook.xlsx.write(res)
    res.end()
  })
)

studentsRoutes.post(
  '/',
  requireRoles(...writeRoles),
  validate(
    z.object({
      body: z.object({
        establishmentId: z.string().optional(),
        classroomId: z.string().optional(),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        gender: z.union([z.nativeEnum(Gender), z.enum(['M', 'F', 'Masculin', 'Féminin'])]).optional(),
        birthDate: z.coerce.date().optional(),
        dateOfBirth: z.coerce.date().optional(),
        birthPlace: z.string().optional(),
        nationality: z.string().default('Ivoirienne'),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        photoUrl: z.string().optional(),
        address: z.string().optional(),
        cycle: z.string().optional(),
        program: z.string().optional(),
        enrollmentKind: z.string().optional(),
        boardingRegime: z.string().optional(),
        bloodGroup: z.string().optional(),
        allergies: z.string().optional(),
        knownIllness: z.string().optional(),
        currentTreatment: z.string().optional(),
        emergencyContactName: z.string().optional(),
        emergencyContactPhone: z.string().optional(),
        fatherName: z.string().optional(),
        fatherPhone: z.string().optional(),
        fatherProfession: z.string().optional(),
        fatherIdNumber: z.string().optional(),
        motherName: z.string().optional(),
        motherPhone: z.string().optional(),
        motherProfession: z.string().optional(),
        motherIdNumber: z.string().optional(),
        guardianName: z.string().optional(),
        guardianPhone: z.string().optional(),
        guardianRelation: z.string().optional(),
        guardianAddress: z.string().optional(),
        parentName: z.string().optional(),
        parentPhone: z.string().optional(),
        parentRelation: z.string().optional(),
        city: z.string().optional(),
        medicalNotes: z.string().optional(),
        tuitionAmount: z.number().int().positive().optional(),
        schoolFeeAmount: z.number().int().positive().optional(),
        tuitionTitle: z.string().optional(),
        tuitionDueDate: z.coerce.date().optional(),
        documentsChecklist: z.record(z.string()).optional()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    await assertStudentCapacity(req.institutionId!)
    const institution = await prisma.institution.findUnique({ where: { id: req.institutionId! } })
    const prefix = `${institution?.slug.toUpperCase() ?? 'SCHOOL'}-EL`
    const lastStudent = await prisma.student.findFirst({
      where: { institutionId: req.institutionId!, matricule: { startsWith: prefix } },
      orderBy: { matricule: 'desc' },
      select: { matricule: true }
    })
    const lastSeq = lastStudent ? (parseInt(lastStudent.matricule.slice(prefix.length + 1), 10) || 0) : 0
    const matricule = `${prefix}-${String(lastSeq + 1).padStart(5, '0')}`
    const gender = mapGender(req.body.gender)
    const birthDate = req.body.birthDate ?? req.body.dateOfBirth
    const parentName = normalizeOptionalString(req.body.parentName)
    const parentPhone = normalizeOptionalString(req.body.parentPhone)
    const establishmentId = resolveWritableEstablishmentId(req, req.body.establishmentId)
    const isDirector = req.user!.role === UserRole.DIRECTOR
    const activeAcademicYear = await prisma.academicYear.findFirst({
      where: { institutionId: req.institutionId!, isActive: true },
      select: { id: true, name: true }
    })
    const academicYearLabel = activeAcademicYear?.name ?? institution?.activeAcademicYearName ?? new Date().getFullYear().toString()
    const enrollmentStatus = isDirector ? EnrollmentStatus.VALIDATED : EnrollmentStatus.PENDING_VALIDATION
    const studentStatus = isDirector ? StudentStatus.ACTIVE : StudentStatus.PENDING

    const student = await prisma.$transaction(async (tx) => {
      const created = await tx.student.create({
        data: {
          institutionId: req.institutionId!,
          matricule,
          establishmentId,
          classroomId: req.body.classroomId,
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          gender,
          birthDate,
          birthPlace: normalizeOptionalString(req.body.birthPlace),
          nationality: req.body.nationality ?? 'Ivoirienne',
          phone: normalizeOptionalString(req.body.phone),
          email: normalizeOptionalString(req.body.email),
          photoUrl: normalizeOptionalString(req.body.photoUrl),
          address: normalizeOptionalString(req.body.address),
          cycle: normalizeOptionalString(req.body.cycle),
          program: normalizeOptionalString(req.body.program),
          enrollmentKind: normalizeOptionalString(req.body.enrollmentKind) ?? 'NEW',
          boardingRegime: normalizeOptionalString(req.body.boardingRegime) ?? 'DAY',
          bloodGroup: normalizeOptionalString(req.body.bloodGroup),
          allergies: normalizeOptionalString(req.body.allergies ?? req.body.medicalNotes),
          knownIllness: normalizeOptionalString(req.body.knownIllness),
          currentTreatment: normalizeOptionalString(req.body.currentTreatment),
          emergencyContactName: normalizeOptionalString(req.body.emergencyContactName),
          emergencyContactPhone: normalizeOptionalString(req.body.emergencyContactPhone),
          fatherName: normalizeOptionalString(req.body.fatherName),
          fatherPhone: normalizeOptionalString(req.body.fatherPhone),
          fatherProfession: normalizeOptionalString(req.body.fatherProfession),
          fatherIdNumber: normalizeOptionalString(req.body.fatherIdNumber),
          motherName: normalizeOptionalString(req.body.motherName),
          motherPhone: normalizeOptionalString(req.body.motherPhone),
          motherProfession: normalizeOptionalString(req.body.motherProfession),
          motherIdNumber: normalizeOptionalString(req.body.motherIdNumber),
          guardianName: normalizeOptionalString(req.body.guardianName ?? parentName),
          guardianPhone: normalizeOptionalString(req.body.guardianPhone ?? parentPhone),
          guardianRelation: normalizeOptionalString(req.body.guardianRelation ?? req.body.parentRelation),
          guardianAddress: normalizeOptionalString(req.body.guardianAddress),
          status: studentStatus,
          enrollmentStatus,
          createdById: req.user!.id,
          validatedById: isDirector ? req.user!.id : null,
          validatedAt: isDirector ? new Date() : null,
          metadata: {
            city: normalizeOptionalString(req.body.city),
            documentsChecklist: req.body.documentsChecklist ?? {}
          }
        }
      })

      await tx.enrollment.create({
        data: {
          institutionId: req.institutionId!,
          studentId: created.id,
          academicYearId: activeAcademicYear?.id,
          academicYearLabel,
          status: enrollmentStatus,
          createdById: req.user!.id,
          validatedById: isDirector ? req.user!.id : null,
          validatedAt: isDirector ? new Date() : null
        }
      })

      const parentInputs = [
        { name: req.body.fatherName, phone: req.body.fatherPhone, profession: req.body.fatherProfession, idNumber: req.body.fatherIdNumber, relationship: 'Père' },
        { name: req.body.motherName, phone: req.body.motherPhone, profession: req.body.motherProfession, idNumber: req.body.motherIdNumber, relationship: 'Mère' },
        { name: req.body.guardianName ?? parentName, phone: req.body.guardianPhone ?? parentPhone, profession: undefined, idNumber: undefined, relationship: req.body.guardianRelation ?? req.body.parentRelation ?? 'Tuteur' }
      ].filter((item) => normalizeOptionalString(item.name) && normalizeOptionalString(item.phone))

      for (const parentInput of parentInputs) {
        const phone = normalizeOptionalString(parentInput.phone)!
        const name = splitPersonName(parentInput.name)
        const parent = await tx.parent.upsert({
          where: { institutionId_phone: { institutionId: req.institutionId!, phone } },
          update: {
            firstName: name.firstName,
            lastName: name.lastName,
            profession: normalizeOptionalString(parentInput.profession),
            idNumber: normalizeOptionalString(parentInput.idNumber),
            address: normalizeOptionalString(req.body.guardianAddress ?? req.body.address)
          },
          create: {
            institutionId: req.institutionId!,
            firstName: name.firstName,
            lastName: name.lastName,
            phone,
            profession: normalizeOptionalString(parentInput.profession),
            idNumber: normalizeOptionalString(parentInput.idNumber),
            address: normalizeOptionalString(req.body.guardianAddress ?? req.body.address)
          }
        })
        await tx.studentParent.upsert({
          where: { studentId_parentId: { studentId: created.id, parentId: parent.id } },
          update: {},
          create: {
            institutionId: req.institutionId!,
            studentId: created.id,
            parentId: parent.id,
            relationship: parentInput.relationship,
            isPrimary: parentInput.relationship !== 'Père'
          }
        })
      }

      await tx.pdfDocument.createMany({
        data: [
          {
            institutionId: req.institutionId!,
            ownerType: 'STUDENT',
            ownerId: created.id,
            type: 'ENROLLMENT_FORM',
            number: `INS-${matricule}`,
            url: `/api/students/${created.id}/enrollment-form`,
            qrPayload: `/verify/student/${created.id}`,
            generatedById: req.user!.id
          },
          {
            institutionId: req.institutionId!,
            ownerType: 'STUDENT',
            ownerId: created.id,
            type: 'STUDENT_CARD',
            number: `CARD-${matricule}`,
            url: `/api/students/${created.id}/card`,
            qrPayload: `/verify/student/${created.id}`,
            generatedById: req.user!.id
          }
        ]
      })
      const tuitionAmount = req.body.tuitionAmount ?? req.body.schoolFeeAmount
      if (tuitionAmount && isDirector) {
        const lastInv = await tx.invoice.findFirst({
          where: { institutionId: req.institutionId! },
          orderBy: { number: 'desc' },
          select: { number: true }
        })
        const lastInvSeq = lastInv ? (parseInt(lastInv.number.split('-').pop() ?? '0', 10) || 0) : 0
        await tx.invoice.create({
          data: {
            institutionId: req.institutionId!,
            studentId: created.id,
            number: `INV-${new Date().getFullYear()}-${String(lastInvSeq + 1).padStart(5, '0')}`,
            title: normalizeOptionalString(req.body.tuitionTitle) ?? `Frais de scolarité ${institution?.activeAcademicYearName ?? new Date().getFullYear()}`,
            totalAmount: tuitionAmount,
            status: InvoiceStatus.ISSUED,
            dueDate: req.body.tuitionDueDate
          }
        })
      }
      return tx.student.findUnique({
        where: { id: created.id },
        include: {
          classroom: { include: { gradeLevel: true } },
          parents: { include: { parent: true } },
          invoices: true,
          createdBy: { select: { id: true, firstName: true, lastName: true, role: true } },
          validatedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
          enrollments: { orderBy: { createdAt: 'desc' }, take: 1 }
        }
      })
    })

    await writeAuditLog({
      institutionId: req.institutionId,
      actorId: req.user!.id,
      action: isDirector ? 'STUDENT_ENROLLMENT_CREATED_VALIDATED' : 'STUDENT_ENROLLMENT_CREATED_PENDING',
      entity: 'Student',
      entityId: student!.id,
      metadata: { enrollmentStatus, createdBy: displayName(req.user), idempotencyKey: req.get('Idempotency-Key') },
      req
    })
    if (!isDirector) {
      await notifyDirectors(
        req.institutionId!,
        'Inscription en attente',
        `${displayName(req.user)} a créé une inscription à valider.`,
        { studentId: student!.id, enrollmentStatus }
      )
    }

    res.status(201).json({
      student,
      pdfs: {
        enrollmentForm: `/api/students/${student!.id}/enrollment-form`,
        studentCard: `/api/students/${student!.id}/card`,
        dossier: `/api/students/${student!.id}/dossier`
      }
    })
  })
)

studentsRoutes.post(
  '/import-excel',
  requireRoles(...writeRoles),
  studentImportUpload.single('file'),
  asyncHandler(async (req, res) => {
    const file = req.file
    if (!file) throw badRequest('Fichier Excel requis')

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(file.buffer as unknown as ArrayBuffer)
    const sheet = workbook.getWorksheet('Élèves') ?? workbook.worksheets[0]
    if (!sheet) throw badRequest('Le fichier ne contient aucune feuille')

    const headerRow = sheet.getRow(1)
    const headerIndex = new Map<string, number>()
    headerRow.eachCell((cell, colNumber) => {
      headerIndex.set(normalizeImportHeader(cell.value), colNumber)
    })

    const getValue = (row: ExcelJS.Row, header: string) => {
      const index = headerIndex.get(header)
      return index ? row.getCell(index).value : undefined
    }
    const getText = (row: ExcelJS.Row, header: string) => textCell(getValue(row, header))
    const getNumber = (row: ExcelJS.Row, header: string) => numberCell(getValue(row, header))
    const getDate = (row: ExcelJS.Row, header: string) => dateCell(getValue(row, header))

    if (!headerIndex.has('prenom') || !headerIndex.has('nom')) {
      throw badRequest('Modèle invalide : colonnes “Prénom *” et “Nom *” requises')
    }

    const institution = await prisma.institution.findUnique({ where: { id: req.institutionId! } })
    const prefix = `${institution?.slug.toUpperCase() ?? 'SCHOOL'}-EL`
    const activeAcademicYear = await prisma.academicYear.findFirst({
      where: { institutionId: req.institutionId!, isActive: true },
      select: { id: true, name: true }
    })
    const academicYearLabel = activeAcademicYear?.name ?? institution?.activeAcademicYearName ?? new Date().getFullYear().toString()
    const establishmentId = resolveWritableEstablishmentId(req, undefined)
    const isDirector = req.user!.role === UserRole.DIRECTOR
    const enrollmentStatus = isDirector ? EnrollmentStatus.VALIDATED : EnrollmentStatus.PENDING_VALIDATION
    const studentStatus = isDirector ? StudentStatus.ACTIVE : StudentStatus.PENDING

    const classrooms = await prisma.classroom.findMany({
      where: { institutionId: req.institutionId!, establishmentId },
      select: { id: true, name: true }
    })
    const classroomByName = new Map(classrooms.map((classroom) => [normalizeLookup(classroom.name), classroom]))

    const lastStudent = await prisma.student.findFirst({
      where: { institutionId: req.institutionId!, matricule: { startsWith: prefix } },
      orderBy: { matricule: 'desc' },
      select: { matricule: true }
    })
    let nextStudentSeq = lastStudent ? (parseInt(lastStudent.matricule.slice(prefix.length + 1), 10) || 0) + 1 : 1

    const errors: Array<{ row: number; message: string }> = []
    const createdStudents: Array<{ id: string; matricule: string; firstName: string; lastName: string; enrollmentStatus: EnrollmentStatus }> = []
    let processedRows = 0

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber)
      const hasAnyValue = [...headerIndex.values()].some((column) => textCell(row.getCell(column).value))
      if (!hasAnyValue) continue
      processedRows += 1

      if (processedRows > 500) {
        errors.push({ row: rowNumber, message: 'Limite de 500 lignes par import atteinte' })
        break
      }

      const firstName = getText(row, 'prenom')
      const lastName = getText(row, 'nom')
      if (!firstName || !lastName) {
        errors.push({ row: rowNumber, message: 'Prénom et nom sont obligatoires' })
        continue
      }

      const classroomName = getText(row, 'classe')
      const classroom = classroomName ? classroomByName.get(normalizeLookup(classroomName)) : undefined
      if (classroomName && !classroom) {
        errors.push({ row: rowNumber, message: `Classe introuvable : ${classroomName}` })
        continue
      }

      const birthDate = getDate(row, 'date naissance')
      if (getText(row, 'date naissance') && !birthDate) {
        errors.push({ row: rowNumber, message: 'Date de naissance invalide. Format attendu : AAAA-MM-JJ' })
        continue
      }

      const tuitionDueDate = getDate(row, 'echeance scolarite')
      if (getText(row, 'echeance scolarite') && !tuitionDueDate) {
        errors.push({ row: rowNumber, message: 'Échéance scolarité invalide. Format attendu : AAAA-MM-JJ' })
        continue
      }

      if (birthDate) {
        const duplicate = await prisma.student.findFirst({
          where: {
            institutionId: req.institutionId!,
            firstName: { equals: firstName, mode: 'insensitive' },
            lastName: { equals: lastName, mode: 'insensitive' },
            birthDate,
            classroomId: classroom?.id
          },
          select: { matricule: true }
        })
        if (duplicate) {
          errors.push({ row: rowNumber, message: `Élève déjà existant (${duplicate.matricule})` })
          continue
        }
      }

      try {
        await assertStudentCapacity(req.institutionId!)
        const matricule = `${prefix}-${String(nextStudentSeq).padStart(5, '0')}`
        nextStudentSeq += 1

        const created = await prisma.$transaction(async (tx) => {
          const student = await tx.student.create({
            data: {
              institutionId: req.institutionId!,
              matricule,
              establishmentId,
              classroomId: classroom?.id,
              firstName,
              lastName,
              gender: mapGender(getText(row, 'sexe')),
              birthDate,
              birthPlace: getText(row, 'lieu naissance'),
              nationality: getText(row, 'nationalite') ?? 'Ivoirienne',
              phone: getText(row, 'telephone eleve'),
              email: getText(row, 'email eleve'),
              cycle: getText(row, 'cycle'),
              program: getText(row, 'filiere / programme'),
              boardingRegime: getText(row, 'regime') ?? 'DAY',
              address: getText(row, 'adresse'),
              fatherName: getText(row, 'nom pere'),
              fatherPhone: getText(row, 'telephone pere'),
              motherName: getText(row, 'nom mere'),
              motherPhone: getText(row, 'telephone mere'),
              guardianName: getText(row, 'nom tuteur'),
              guardianPhone: getText(row, 'telephone tuteur'),
              guardianRelation: getText(row, 'lien tuteur'),
              allergies: getText(row, 'allergies / notes medicales'),
              status: studentStatus,
              enrollmentStatus,
              createdById: req.user!.id,
              validatedById: isDirector ? req.user!.id : null,
              validatedAt: isDirector ? new Date() : null,
              metadata: {
                city: getText(row, 'ville'),
                importedFromExcel: true,
                importFileName: file.originalname,
                documentsChecklist: {}
              }
            }
          })

          await tx.enrollment.create({
            data: {
              institutionId: req.institutionId!,
              studentId: student.id,
              academicYearId: activeAcademicYear?.id,
              academicYearLabel,
              status: enrollmentStatus,
              createdById: req.user!.id,
              validatedById: isDirector ? req.user!.id : null,
              validatedAt: isDirector ? new Date() : null
            }
          })

          const parentInputs = [
            { name: getText(row, 'nom pere'), phone: getText(row, 'telephone pere'), relationship: 'Père' },
            { name: getText(row, 'nom mere'), phone: getText(row, 'telephone mere'), relationship: 'Mère' },
            { name: getText(row, 'nom tuteur'), phone: getText(row, 'telephone tuteur'), relationship: getText(row, 'lien tuteur') ?? 'Tuteur' }
          ].filter((item) => item.name && item.phone)

          for (const parentInput of parentInputs) {
            const name = splitPersonName(parentInput.name)
            const parent = await tx.parent.upsert({
              where: { institutionId_phone: { institutionId: req.institutionId!, phone: parentInput.phone! } },
              update: {
                firstName: name.firstName,
                lastName: name.lastName,
                address: getText(row, 'adresse')
              },
              create: {
                institutionId: req.institutionId!,
                firstName: name.firstName,
                lastName: name.lastName,
                phone: parentInput.phone!,
                address: getText(row, 'adresse')
              }
            })
            await tx.studentParent.upsert({
              where: { studentId_parentId: { studentId: student.id, parentId: parent.id } },
              update: {},
              create: {
                institutionId: req.institutionId!,
                studentId: student.id,
                parentId: parent.id,
                relationship: parentInput.relationship,
                isPrimary: parentInput.relationship !== 'Père'
              }
            })
          }

          await tx.pdfDocument.createMany({
            data: [
              {
                institutionId: req.institutionId!,
                ownerType: 'STUDENT',
                ownerId: student.id,
                type: 'ENROLLMENT_FORM',
                number: `INS-${matricule}`,
                url: `/api/students/${student.id}/enrollment-form`,
                qrPayload: `/verify/student/${student.id}`,
                generatedById: req.user!.id
              },
              {
                institutionId: req.institutionId!,
                ownerType: 'STUDENT',
                ownerId: student.id,
                type: 'STUDENT_CARD',
                number: `CARD-${matricule}`,
                url: `/api/students/${student.id}/card`,
                qrPayload: `/verify/student/${student.id}`,
                generatedById: req.user!.id
              }
            ]
          })

          const tuitionAmount = getNumber(row, 'montant scolarite')
          if (tuitionAmount && isDirector) {
            const lastInv = await tx.invoice.findFirst({
              where: { institutionId: req.institutionId! },
              orderBy: { number: 'desc' },
              select: { number: true }
            })
            const lastInvSeq = lastInv ? (parseInt(lastInv.number.split('-').pop() ?? '0', 10) || 0) : 0
            await tx.invoice.create({
              data: {
                institutionId: req.institutionId!,
                studentId: student.id,
                number: `INV-${new Date().getFullYear()}-${String(lastInvSeq + 1).padStart(5, '0')}`,
                title: getText(row, 'libelle facture') ?? `Frais de scolarité ${institution?.activeAcademicYearName ?? new Date().getFullYear()}`,
                totalAmount: tuitionAmount,
                status: InvoiceStatus.ISSUED,
                dueDate: tuitionDueDate
              }
            })
          }

          return student
        })

        createdStudents.push({
          id: created.id,
          matricule: created.matricule,
          firstName: created.firstName,
          lastName: created.lastName,
          enrollmentStatus
        })
      } catch (error) {
        errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : 'Erreur lors de la création'
        })
      }
    }

    await writeAuditLog({
      institutionId: req.institutionId,
      actorId: req.user!.id,
      action: isDirector ? 'STUDENTS_IMPORTED_VALIDATED' : 'STUDENTS_IMPORTED_PENDING',
      entity: 'Student',
      req,
      metadata: {
        fileName: file.originalname,
        processedRows,
        createdCount: createdStudents.length,
        errorCount: errors.length,
        enrollmentStatus,
        createdStudentIds: createdStudents.map((student) => student.id),
        idempotencyKey: req.get('Idempotency-Key')
      }
    })

    if (!isDirector && createdStudents.length > 0) {
      await notifyDirectors(
        req.institutionId!,
        'Inscriptions importées en attente',
        `${displayName(req.user)} a importé ${createdStudents.length} inscription(s) à valider.`,
        { createdStudentIds: createdStudents.map((student) => student.id), enrollmentStatus }
      )
    }

    res.status(createdStudents.length > 0 ? 201 : 400).json({
      summary: {
        processedRows,
        created: createdStudents.length,
        failed: errors.length,
        pendingValidation: isDirector ? 0 : createdStudents.length,
        validated: isDirector ? createdStudents.length : 0
      },
      students: createdStudents,
      errors
    })
  })
)

studentsRoutes.get(
  '/enrollments/pending',
  requireRoles(UserRole.DIRECTOR, UserRole.CENTRAL_ADMIN, UserRole.ADMINISTRATION),
  asyncHandler(async (req, res) => {
    const enrollments = await prisma.enrollment.findMany({
      where: {
        institutionId: req.institutionId!,
        status: { in: [EnrollmentStatus.PENDING_VALIDATION, EnrollmentStatus.CORRECTION_REQUESTED, EnrollmentStatus.DRAFT] }
      },
      include: {
        student: {
          include: {
            classroom: { include: { gradeLevel: true } },
            parents: { include: { parent: true } },
            createdBy: { select: { id: true, firstName: true, lastName: true, role: true } },
            validatedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
            rejectedBy: { select: { id: true, firstName: true, lastName: true, role: true } }
          }
        },
        createdBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        validatedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        rejectedBy: { select: { id: true, firstName: true, lastName: true, role: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    })
    res.json({ enrollments })
  })
)

studentsRoutes.patch(
  '/:id/enrollment-review',
  requireRoles(UserRole.DIRECTOR),
  validate(
    z.object({
      body: z.object({
        decision: z.enum(['VALIDATED', 'REFUSED', 'CORRECTION_REQUESTED']),
        comment: z.string().optional()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const student = await prisma.student.findFirst({ where: { id: req.params.id, institutionId: req.institutionId! } })
    if (!student) throw notFound('Élève introuvable')
    const decision = req.body.decision as 'VALIDATED' | 'REFUSED' | 'CORRECTION_REQUESTED'
    const nextStatus =
      decision === 'VALIDATED'
        ? EnrollmentStatus.VALIDATED
        : decision === 'REFUSED'
          ? EnrollmentStatus.REFUSED
          : EnrollmentStatus.CORRECTION_REQUESTED
    const updated = await prisma.$transaction(async (tx) => {
      await tx.enrollment.updateMany({
        where: { institutionId: req.institutionId!, studentId: student.id, status: { not: EnrollmentStatus.CANCELED } },
        data: {
          status: nextStatus,
          validatedById: decision === 'VALIDATED' ? req.user!.id : undefined,
          validatedAt: decision === 'VALIDATED' ? new Date() : undefined,
          rejectedById: decision !== 'VALIDATED' ? req.user!.id : undefined,
          rejectedAt: decision !== 'VALIDATED' ? new Date() : undefined,
          directorComment: req.body.comment?.trim() || null
        }
      })
      return tx.student.update({
        where: { id: student.id },
        data: {
          status: decision === 'VALIDATED' ? StudentStatus.ACTIVE : StudentStatus.PENDING,
          enrollmentStatus: nextStatus,
          validatedById: decision === 'VALIDATED' ? req.user!.id : student.validatedById,
          validatedAt: decision === 'VALIDATED' ? new Date() : student.validatedAt,
          rejectedById: decision !== 'VALIDATED' ? req.user!.id : null,
          rejectedAt: decision !== 'VALIDATED' ? new Date() : null,
          validationComment: req.body.comment?.trim() || null
        },
        include: {
          classroom: { include: { gradeLevel: true } },
          parents: { include: { parent: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true, role: true } },
          validatedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
          rejectedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
          enrollments: { orderBy: { createdAt: 'desc' }, take: 1 }
        }
      })
    })
    await writeAuditLog({
      institutionId: req.institutionId,
      actorId: req.user!.id,
      action: decision === 'VALIDATED' ? 'STUDENT_ENROLLMENT_VALIDATED' : decision === 'REFUSED' ? 'STUDENT_ENROLLMENT_REFUSED' : 'STUDENT_ENROLLMENT_CORRECTION_REQUESTED',
      entity: 'Student',
      entityId: updated.id,
      metadata: { previousStatus: student.enrollmentStatus, nextStatus, comment: req.body.comment, idempotencyKey: req.get('Idempotency-Key') },
      req
    })
    if (updated.createdById) {
      await prisma.notification.create({
        data: {
          institutionId: req.institutionId!,
          userId: updated.createdById,
          level: decision === 'VALIDATED' ? NotificationLevel.SUCCESS : decision === 'REFUSED' ? NotificationLevel.DANGER : NotificationLevel.WARNING,
          title: decision === 'VALIDATED' ? 'Inscription validée' : decision === 'REFUSED' ? 'Inscription refusée' : 'Correction demandée',
          body: req.body.comment?.trim() || `${updated.firstName} ${updated.lastName}`,
          data: { studentId: updated.id, status: nextStatus }
        }
      }).catch(() => undefined)
    }
    res.json({ student: updated })
  })
)

studentsRoutes.get(
  '/:id',
  asyncHandler(async (req, res) => {
    await ensureStudentReadable(req, req.params.id)
    const establishmentId = getScopedEstablishmentId(req)
    const student = await prisma.student.findFirst({
      where: { id: req.params.id, institutionId: req.institutionId!, establishmentId },
      include: {
        classroom: { include: { academicYear: true, gradeLevel: true } },
        parents: { include: { parent: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        validatedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        rejectedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        enrollments: { orderBy: { createdAt: 'desc' } },
        grades: { include: { subject: true, period: true } },
        attendances: true,
        discipline: true,
        invoices: { include: { payments: true }, orderBy: { createdAt: 'desc' } }
      }
    })
    res.json({ student })
  })
)

studentsRoutes.patch(
  '/:id',
  requireRoles(...writeRoles),
  asyncHandler(async (req, res) => {
    const existing = await prisma.student.findFirst({
      where: { id: req.params.id, institutionId: req.institutionId!, establishmentId: getScopedEstablishmentId(req) }
    })
    if (!existing) throw notFound('Élève introuvable')

    const allowed = [
      'classroomId',
      'firstName',
      'lastName',
      'gender',
      'birthDate',
      'birthPlace',
      'nationality',
      'phone',
      'email',
      'photoUrl',
      'address',
      'cycle',
      'program',
      'enrollmentKind',
      'boardingRegime',
      'bloodGroup',
      'allergies',
      'knownIllness',
      'currentTreatment',
      'emergencyContactName',
      'emergencyContactPhone',
      'fatherName',
      'fatherPhone',
      'fatherProfession',
      'fatherIdNumber',
      'motherName',
      'motherPhone',
      'motherProfession',
      'motherIdNumber',
      'guardianName',
      'guardianPhone',
      'guardianRelation',
      'guardianAddress',
      'status'
    ]
    const data = Object.fromEntries(
      Object.entries(req.body)
        .filter(([key]) => allowed.includes(key))
        .map(([key, value]) => [key, value === '' ? null : value])
    )

    const student = await prisma.student.update({
      where: { id: existing.id },
      data: {
        ...data,
        gender: mapGender(data.gender) ?? undefined,
        birthDate: data.birthDate ? new Date(String(data.birthDate)) : undefined,
        updatedById: req.user!.id
      },
      include: {
        classroom: { include: { gradeLevel: true } },
        parents: { include: { parent: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        validatedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        rejectedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        grades: { include: { subject: true, period: true } },
        attendances: true,
        discipline: true,
        invoices: true
      }
    })
    await writeAuditLog({
      institutionId: req.institutionId,
      actorId: req.user!.id,
      action: 'STUDENT_UPDATED',
      entity: 'Student',
      entityId: student.id,
      metadata: { changedFields: Object.keys(data), idempotencyKey: req.get('Idempotency-Key') },
      req
    })
    res.json({ student })
  })
)

studentsRoutes.delete(
  '/:id',
  requireRoles(...writeRoles),
  asyncHandler(async (req, res) => {
    const student = await prisma.student.findFirst({
      where: { id: req.params.id, institutionId: req.institutionId!, establishmentId: getScopedEstablishmentId(req) }
    })
    if (!student) throw notFound('Élève introuvable')
    await prisma.$transaction([
      prisma.document.deleteMany({ where: { institutionId: req.institutionId!, ownerType: 'STUDENT', ownerId: student.id } }),
      prisma.pdfDocument.deleteMany({ where: { institutionId: req.institutionId!, ownerType: 'STUDENT', ownerId: student.id } }),
      prisma.student.delete({ where: { id: student.id } })
    ])
    res.json({ ok: true })
  })
)

studentsRoutes.get(
  '/:id/enrollment-form',
  asyncHandler(async (req, res) => {
    await ensureStudentReadable(req, req.params.id)
    const buffer = await renderEnrollmentFormPdf(req.institutionId!, req.params.id, String(req.query.lang ?? 'FR'))
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="fiche-inscription-${req.params.id}.pdf"`)
    res.send(buffer)
  })
)

studentsRoutes.get(
  '/:id/card',
  requireRoles(...cardGeneratorRoles),
  asyncHandler(async (req, res) => {
    await ensureStudentReadable(req, req.params.id)
    const buffer = await renderStudentCardPdf(req.institutionId!, req.params.id, String(req.query.lang ?? 'FR'))
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="carte-eleve-${req.params.id}.pdf"`)
    res.send(buffer)
  })
)

studentsRoutes.get(
  '/:id/dossier',
  asyncHandler(async (req, res) => {
    await ensureStudentReadable(req, req.params.id)
    const buffer = await renderEnrollmentFormPdf(req.institutionId!, req.params.id, String(req.query.lang ?? 'FR'))
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="dossier-eleve-${req.params.id}.pdf"`)
    res.send(buffer)
  })
)
