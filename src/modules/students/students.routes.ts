import { Router, type Request } from 'express'
import { z } from 'zod'
import { Gender, InvoiceStatus, UserRole } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { getScopedEstablishmentId, resolveWritableEstablishmentId } from '../../lib/access-scope'
import { forbidden, notFound } from '../../lib/errors'
import { getParentScope } from '../../lib/parent-access'
import { assertStudentCapacity } from '../../lib/plan-limits'
import { authenticate } from '../../middlewares/auth'
import { requireRoles, requireTenantUser } from '../../middlewares/rbac'
import { validate } from '../../middlewares/validate'
import { renderEnrollmentFormPdf, renderStudentCardPdf } from '../pdf/pdf.service'

export const studentsRoutes = Router()
studentsRoutes.use(authenticate, requireTenantUser)

const writeRoles = [UserRole.CENTRAL_ADMIN, UserRole.DIRECTOR, UserRole.ADMINISTRATION, UserRole.SECRETARIAT] as const

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
      include: { classroom: { include: { gradeLevel: true } }, parents: { include: { parent: true } }, _count: { select: { invoices: true, grades: true, attendances: true, discipline: true } } },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    })
    res.json({ students })
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
          metadata: {
            city: normalizeOptionalString(req.body.city),
            documentsChecklist: req.body.documentsChecklist ?? {}
          }
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
      if (tuitionAmount) {
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
        include: { classroom: { include: { gradeLevel: true } }, parents: { include: { parent: true } }, invoices: true }
      })
    })

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
        birthDate: data.birthDate ? new Date(String(data.birthDate)) : undefined
      },
      include: {
        classroom: { include: { gradeLevel: true } },
        parents: { include: { parent: true } },
        grades: { include: { subject: true, period: true } },
        attendances: true,
        discipline: true,
        invoices: true
      }
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
