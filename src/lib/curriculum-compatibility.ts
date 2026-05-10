import { CurriculumCycle, InstitutionKind } from '@prisma/client'
import { prisma } from '../config/prisma'
import { badRequest, notFound } from './errors'

function normalize(value: string | null | undefined) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

function compact(value: string | null | undefined) {
  return normalize(value).replace(/[^A-Z0-9]/g, '')
}

function subjectKeys(name: string | null | undefined, code: string | null | undefined) {
  const keys = new Set<string>()
  const normalizedName = normalize(name)
  const compactName = compact(name)
  const normalizedCode = normalize(code)
  const compactCode = compact(code)
  const candidates = new Set<string>()

  for (const value of [normalizedName, compactName, normalizedCode, compactCode]) {
    if (value) {
      keys.add(value)
      candidates.add(value)
    }
  }

  for (const value of [normalizedName, normalizedCode]) {
    value
      .replace(/[^A-Z0-9]+/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .forEach((token) => candidates.add(token))
  }

  const aliases: Record<string, string[]> = {
    MATH: ['MATH', 'MATHS', 'MATHEMATIQUE', 'MATHEMATIQUES'],
    FRANCAIS: ['FR', 'FRANCAIS', 'LITTERATURE'],
    ANGLAIS: ['ANG', 'ANGLAIS', 'ENGLISH'],
    EPS: ['EPS', 'SPORT', 'EDUCATION PHYSIQUE'],
    SVT: ['SVT', 'SCIENCES DE LA VIE', 'SCIENCES VIE TERRE'],
    PHYSIQUE_CHIMIE: ['PC', 'PHYSIQUE', 'CHIMIE', 'PHYSIQUE CHIMIE'],
    HISTOIRE_GEOGRAPHIE: ['HG', 'HISTOIRE', 'GEOGRAPHIE', 'HISTOIRE GEOGRAPHIE'],
    EDUCATION_CIVIQUE: ['ECM', 'EDUCATION CIVIQUE', 'CIVIQUE'],
    INFORMATIQUE: ['INFO', 'INFORMATIQUE', 'NUMERIQUE'],
    PHILOSOPHIE: ['PHILO', 'PHILOSOPHIE'],
    ARTS: ['ART', 'ARTS', 'ARTS PLASTIQUES']
  }

  for (const [canonical, values] of Object.entries(aliases)) {
    if (
      values.some((alias) => {
        const normalizedAlias = normalize(alias)
        const compactAlias = compact(alias)
        return (
          candidates.has(normalizedAlias) ||
          candidates.has(compactAlias) ||
          (compactAlias.length >= 4 && compactName.includes(compactAlias)) ||
          (compactAlias.length >= 4 && compactCode.includes(compactAlias))
        )
      })
    ) {
      keys.add(canonical)
    }
  }

  return keys
}

function subjectsMatch(
  subject: { name: string; code?: string | null },
  curriculumSubject: { name: string; code?: string | null }
) {
  const currentKeys = subjectKeys(subject.name, subject.code)
  const allowedKeys = subjectKeys(curriculumSubject.name, curriculumSubject.code)

  for (const key of currentKeys) {
    if (allowedKeys.has(key)) return true
  }

  return false
}

function cycleFromInstitutionKind(kind: InstitutionKind): CurriculumCycle | undefined {
  switch (kind) {
    case InstitutionKind.MATERNELLE:
      return CurriculumCycle.MATERNELLE
    case InstitutionKind.PRIMARY:
      return CurriculumCycle.PRIMAIRE
    case InstitutionKind.COLLEGE:
      return CurriculumCycle.COLLEGE
    case InstitutionKind.LYCEE:
      return CurriculumCycle.LYCEE
    case InstitutionKind.UNIVERSITY:
      return CurriculumCycle.UNIVERSITE
    case InstitutionKind.TRAINING_CENTER:
      return CurriculumCycle.FORMATION
    default:
      return undefined
  }
}

function cycleFromGradeLevelCode(code: string | null | undefined): CurriculumCycle | undefined {
  const normalized = normalize(code)
  if (!normalized) return undefined

  if (['PS', 'MS', 'GS'].includes(normalized)) return CurriculumCycle.MATERNELLE
  if (
    /^(CP|CE|CM)\d$/.test(normalized) ||
    /^P\d$/.test(normalized) ||
    /^AN[1-6]$/.test(normalized)
  ) {
    return CurriculumCycle.PRIMAIRE
  }
  if (
    ['6E', '5E', '4E', '3E', '6EME', '5EME', '4EME', '3EME', '7EME', '8EME', '9EME'].includes(normalized) ||
    /^JHS[1-3]$/.test(normalized) ||
    /^JSS[1-3]$/.test(normalized)
  ) {
    return CurriculumCycle.COLLEGE
  }
  if (
    ['2NDE', '2NDA', '2NDC', '1ERE', '1A', '1C', '1D', 'TLE', 'TA', 'TC', 'TD'].includes(normalized) ||
    /^SHS[1-3]$/.test(normalized) ||
    /^SSS[1-3]$/.test(normalized)
  ) {
    return CurriculumCycle.LYCEE
  }
  if (['G1', 'G2', 'BT'].includes(normalized)) return CurriculumCycle.FORMATION

  return undefined
}

export async function resolveCurriculumScopeForClassroom(institutionId: string, classroomId: string) {
  const classroom = await prisma.classroom.findFirst({
    where: { id: classroomId, institutionId },
    include: {
      gradeLevel: { select: { code: true, name: true } },
      institution: { select: { id: true, kind: true, countryCode: true, name: true } }
    }
  })

  if (!classroom) throw notFound('Classe introuvable')

  const cycle =
    cycleFromGradeLevelCode(classroom.gradeLevel?.code) ??
    cycleFromInstitutionKind(classroom.institution.kind)

  if (!cycle) {
    return {
      classroom,
      cycle: undefined,
      curricula: []
    }
  }

  const gradeLevelCode = classroom.gradeLevel?.code ?? null
  const institutionKindFilter =
    classroom.institution.kind === InstitutionKind.GROUPE_SCOLAIRE
      ? undefined
      : {
          institutionKind: {
            in: [classroom.institution.kind, InstitutionKind.GROUPE_SCOLAIRE]
          }
        }

  const curricula = await prisma.curriculum.findMany({
    where: {
      isActive: true,
      cycle,
      ...(institutionKindFilter ?? {}),
      AND: [
        {
          OR: [
            { institutionId },
            {
              institutionId: null,
              ...(classroom.institution.countryCode
                ? { countryCode: classroom.institution.countryCode }
                : {})
            }
          ]
        },
        gradeLevelCode
          ? {
              OR: [{ gradeLevelCode: null }, { gradeLevelCode }]
            }
          : {}
      ]
    },
    include: {
      subjects: {
        orderBy: [{ order: 'asc' }, { name: 'asc' }]
      }
    },
    orderBy: [{ institutionId: 'desc' }, { isOfficial: 'desc' }, { name: 'asc' }]
  })

  return { classroom, cycle, curricula }
}

export async function assertSubjectCompatibleWithClassroom(params: {
  institutionId: string
  classroomId: string
  subjectId?: string | null
}) {
  if (!params.subjectId) return

  const [subject, scope] = await Promise.all([
    prisma.subject.findFirst({
      where: { id: params.subjectId, institutionId: params.institutionId, isActive: true }
    }),
    resolveCurriculumScopeForClassroom(params.institutionId, params.classroomId)
  ])

  if (!subject) throw notFound('Matière introuvable ou archivée')

  const schoolCurricula = scope.curricula.filter(
    (curriculum) => curriculum.institutionId === params.institutionId
  )
  const restrictiveCurricula = schoolCurricula.filter(
    (curriculum) => curriculum.subjects.length > 0
  )

  // Les programmes officiels/pays sont des modèles de référence. Ils ne doivent pas bloquer
  // une matière créée localement tant que l'école n'a pas défini son propre programme restrictif.
  if (restrictiveCurricula.length === 0) return

  const allowedSubjects = restrictiveCurricula.flatMap((curriculum) => curriculum.subjects)
  if (allowedSubjects.length === 0) return

  const compatible = allowedSubjects.some((curriculumSubject) => subjectsMatch(subject, curriculumSubject))

  if (!compatible) {
    const gradeLabel = scope.classroom.gradeLevel?.name ?? scope.classroom.name
    throw badRequest(
      `La matière ${subject.name} n'est pas autorisée dans le programme interne configuré pour ${gradeLabel}. Ajoutez-la au programme scolaire de l'école ou choisissez une matière autorisée.`
    )
  }
}
