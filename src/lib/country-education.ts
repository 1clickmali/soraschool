import { LanguageCode } from '@prisma/client'
import { prisma } from '../config/prisma'

export interface EducationGrade {
  code: string
  name: string
  order: number
}

export interface EducationCycle {
  code: string
  name: string
  kind: string
  grades: EducationGrade[]
}

export interface CountryConfigData {
  code: string
  name: string
  nameFr: string
  currency: string
  language: LanguageCode
  schoolYearStartMonth: number
  schoolYearEndMonth: number
  educationCycles: EducationCycle[]
}

// Francophone Africa cycles (Ivorian model)
const FRANCOPHONE_CYCLES: EducationCycle[] = [
  {
    code: 'MATERNELLE',
    name: 'Maternelle',
    kind: 'MATERNELLE',
    grades: [
      { code: 'PS', name: 'Petite Section', order: 1 },
      { code: 'MS', name: 'Moyenne Section', order: 2 },
      { code: 'GS', name: 'Grande Section', order: 3 }
    ]
  },
  {
    code: 'PRIMAIRE',
    name: 'Enseignement Primaire',
    kind: 'PRIMARY',
    grades: [
      { code: 'CP1', name: 'Cours Préparatoire 1', order: 1 },
      { code: 'CP2', name: 'Cours Préparatoire 2', order: 2 },
      { code: 'CE1', name: 'Cours Élémentaire 1', order: 3 },
      { code: 'CE2', name: 'Cours Élémentaire 2', order: 4 },
      { code: 'CM1', name: 'Cours Moyen 1', order: 5 },
      { code: 'CM2', name: 'Cours Moyen 2', order: 6 }
    ]
  },
  {
    code: 'COLLEGE',
    name: 'Enseignement Secondaire 1er Cycle',
    kind: 'COLLEGE',
    grades: [
      { code: '6EME', name: '6ème', order: 1 },
      { code: '5EME', name: '5ème', order: 2 },
      { code: '4EME', name: '4ème', order: 3 },
      { code: '3EME', name: '3ème', order: 4 }
    ]
  },
  {
    code: 'LYCEE',
    name: 'Enseignement Secondaire 2nd Cycle',
    kind: 'LYCEE',
    grades: [
      { code: '2NDE', name: 'Seconde', order: 1 },
      { code: '1ERE', name: 'Première', order: 2 },
      { code: 'TLE', name: 'Terminale', order: 3 }
    ]
  }
]

// Anglophone Africa cycles
const ANGLOPHONE_CYCLES: EducationCycle[] = [
  {
    code: 'PRIMARY',
    name: 'Primary School',
    kind: 'PRIMARY',
    grades: [
      { code: 'P1', name: 'Primary 1', order: 1 },
      { code: 'P2', name: 'Primary 2', order: 2 },
      { code: 'P3', name: 'Primary 3', order: 3 },
      { code: 'P4', name: 'Primary 4', order: 4 },
      { code: 'P5', name: 'Primary 5', order: 5 },
      { code: 'P6', name: 'Primary 6', order: 6 }
    ]
  },
  {
    code: 'JUNIOR_HIGH',
    name: 'Junior High School',
    kind: 'COLLEGE',
    grades: [
      { code: 'JHS1', name: 'Junior High 1', order: 1 },
      { code: 'JHS2', name: 'Junior High 2', order: 2 },
      { code: 'JHS3', name: 'Junior High 3', order: 3 }
    ]
  },
  {
    code: 'SENIOR_HIGH',
    name: 'Senior High School',
    kind: 'LYCEE',
    grades: [
      { code: 'SHS1', name: 'Senior High 1', order: 1 },
      { code: 'SHS2', name: 'Senior High 2', order: 2 },
      { code: 'SHS3', name: 'Senior High 3', order: 3 }
    ]
  }
]

// Nigeria uses its own system
const NIGERIA_CYCLES: EducationCycle[] = [
  {
    code: 'PRIMARY',
    name: 'Primary School',
    kind: 'PRIMARY',
    grades: [
      { code: 'P1', name: 'Primary 1', order: 1 },
      { code: 'P2', name: 'Primary 2', order: 2 },
      { code: 'P3', name: 'Primary 3', order: 3 },
      { code: 'P4', name: 'Primary 4', order: 4 },
      { code: 'P5', name: 'Primary 5', order: 5 },
      { code: 'P6', name: 'Primary 6', order: 6 }
    ]
  },
  {
    code: 'JUNIOR_SECONDARY',
    name: 'Junior Secondary School',
    kind: 'COLLEGE',
    grades: [
      { code: 'JSS1', name: 'JSS 1', order: 1 },
      { code: 'JSS2', name: 'JSS 2', order: 2 },
      { code: 'JSS3', name: 'JSS 3', order: 3 }
    ]
  },
  {
    code: 'SENIOR_SECONDARY',
    name: 'Senior Secondary School',
    kind: 'LYCEE',
    grades: [
      { code: 'SSS1', name: 'SSS 1', order: 1 },
      { code: 'SSS2', name: 'SSS 2', order: 2 },
      { code: 'SSS3', name: 'SSS 3', order: 3 }
    ]
  }
]

// Mauritanian system (Arabic/French bilingual)
const MAURITANIA_CYCLES: EducationCycle[] = [
  {
    code: 'FONDAMENTAL',
    name: 'Enseignement Fondamental',
    kind: 'PRIMARY',
    grades: [
      { code: 'AN1', name: '1ère Année Fondamentale', order: 1 },
      { code: 'AN2', name: '2ème Année Fondamentale', order: 2 },
      { code: 'AN3', name: '3ème Année Fondamentale', order: 3 },
      { code: 'AN4', name: '4ème Année Fondamentale', order: 4 },
      { code: 'AN5', name: '5ème Année Fondamentale', order: 5 },
      { code: 'AN6', name: '6ème Année Fondamentale', order: 6 }
    ]
  },
  {
    code: 'COLLEGE',
    name: 'Enseignement Secondaire 1er Cycle',
    kind: 'COLLEGE',
    grades: [
      { code: '7EME', name: '7ème', order: 1 },
      { code: '8EME', name: '8ème', order: 2 },
      { code: '9EME', name: '9ème', order: 3 }
    ]
  },
  {
    code: 'LYCEE',
    name: 'Enseignement Secondaire 2nd Cycle',
    kind: 'LYCEE',
    grades: [
      { code: '2NDE', name: 'Seconde', order: 1 },
      { code: '1ERE', name: 'Première', order: 2 },
      { code: 'TLE', name: 'Terminale', order: 3 }
    ]
  }
]

export const COUNTRY_CONFIGS: CountryConfigData[] = [
  {
    code: 'CI',
    name: "Côte d'Ivoire",
    nameFr: "Côte d'Ivoire",
    currency: 'XOF',
    language: LanguageCode.FR,
    schoolYearStartMonth: 9,
    schoolYearEndMonth: 6,
    educationCycles: FRANCOPHONE_CYCLES
  },
  {
    code: 'SN',
    name: 'Sénégal',
    nameFr: 'Sénégal',
    currency: 'XOF',
    language: LanguageCode.FR,
    schoolYearStartMonth: 10,
    schoolYearEndMonth: 6,
    educationCycles: FRANCOPHONE_CYCLES
  },
  {
    code: 'ML',
    name: 'Mali',
    nameFr: 'Mali',
    currency: 'XOF',
    language: LanguageCode.FR,
    schoolYearStartMonth: 10,
    schoolYearEndMonth: 6,
    educationCycles: FRANCOPHONE_CYCLES
  },
  {
    code: 'BF',
    name: 'Burkina Faso',
    nameFr: 'Burkina Faso',
    currency: 'XOF',
    language: LanguageCode.FR,
    schoolYearStartMonth: 10,
    schoolYearEndMonth: 6,
    educationCycles: FRANCOPHONE_CYCLES
  },
  {
    code: 'BJ',
    name: 'Bénin',
    nameFr: 'Bénin',
    currency: 'XOF',
    language: LanguageCode.FR,
    schoolYearStartMonth: 10,
    schoolYearEndMonth: 6,
    educationCycles: FRANCOPHONE_CYCLES
  },
  {
    code: 'NE',
    name: 'Niger',
    nameFr: 'Niger',
    currency: 'XOF',
    language: LanguageCode.FR,
    schoolYearStartMonth: 10,
    schoolYearEndMonth: 6,
    educationCycles: FRANCOPHONE_CYCLES
  },
  {
    code: 'GN',
    name: 'Guinée',
    nameFr: 'Guinée',
    currency: 'GNF',
    language: LanguageCode.FR,
    schoolYearStartMonth: 10,
    schoolYearEndMonth: 6,
    educationCycles: FRANCOPHONE_CYCLES
  },
  {
    code: 'TG',
    name: 'Togo',
    nameFr: 'Togo',
    currency: 'XOF',
    language: LanguageCode.FR,
    schoolYearStartMonth: 10,
    schoolYearEndMonth: 6,
    educationCycles: FRANCOPHONE_CYCLES
  },
  {
    code: 'GH',
    name: 'Ghana',
    nameFr: 'Ghana',
    currency: 'GHS',
    language: LanguageCode.EN,
    schoolYearStartMonth: 9,
    schoolYearEndMonth: 7,
    educationCycles: ANGLOPHONE_CYCLES
  },
  {
    code: 'NG',
    name: 'Nigeria',
    nameFr: 'Nigeria',
    currency: 'NGN',
    language: LanguageCode.EN,
    schoolYearStartMonth: 9,
    schoolYearEndMonth: 7,
    educationCycles: NIGERIA_CYCLES
  },
  {
    code: 'GM',
    name: 'Gambie',
    nameFr: 'Gambie',
    currency: 'GMD',
    language: LanguageCode.EN,
    schoolYearStartMonth: 9,
    schoolYearEndMonth: 7,
    educationCycles: ANGLOPHONE_CYCLES
  },
  {
    code: 'SL',
    name: 'Sierra Leone',
    nameFr: 'Sierra Leone',
    currency: 'SLL',
    language: LanguageCode.EN,
    schoolYearStartMonth: 9,
    schoolYearEndMonth: 7,
    educationCycles: ANGLOPHONE_CYCLES
  },
  {
    code: 'LR',
    name: 'Liberia',
    nameFr: 'Liberia',
    currency: 'LRD',
    language: LanguageCode.EN,
    schoolYearStartMonth: 9,
    schoolYearEndMonth: 6,
    educationCycles: ANGLOPHONE_CYCLES
  },
  {
    code: 'CV',
    name: 'Cap-Vert',
    nameFr: 'Cap-Vert',
    currency: 'CVE',
    language: LanguageCode.FR,
    schoolYearStartMonth: 9,
    schoolYearEndMonth: 6,
    educationCycles: FRANCOPHONE_CYCLES
  },
  {
    code: 'GW',
    name: 'Guinée-Bissau',
    nameFr: 'Guinée-Bissau',
    currency: 'XOF',
    language: LanguageCode.FR,
    schoolYearStartMonth: 10,
    schoolYearEndMonth: 6,
    educationCycles: FRANCOPHONE_CYCLES
  },
  {
    code: 'MR',
    name: 'Mauritanie',
    nameFr: 'Mauritanie',
    currency: 'MRO',
    language: LanguageCode.AR,
    schoolYearStartMonth: 10,
    schoolYearEndMonth: 6,
    educationCycles: MAURITANIA_CYCLES
  }
]

export function getCountryByCode(code: string): CountryConfigData | undefined {
  return COUNTRY_CONFIGS.find((c) => c.code === code)
}

export async function seedCountryConfigs() {
  const results = []
  for (const country of COUNTRY_CONFIGS) {
    const record = await prisma.countryConfig.upsert({
      where: { code: country.code },
      update: {
        name: country.name,
        nameFr: country.nameFr,
        currency: country.currency,
        language: country.language,
        schoolYearStartMonth: country.schoolYearStartMonth,
        schoolYearEndMonth: country.schoolYearEndMonth,
        educationCycles: country.educationCycles as unknown as import('@prisma/client').Prisma.JsonArray
      },
      create: {
        code: country.code,
        name: country.name,
        nameFr: country.nameFr,
        currency: country.currency,
        language: country.language,
        schoolYearStartMonth: country.schoolYearStartMonth,
        schoolYearEndMonth: country.schoolYearEndMonth,
        educationCycles: country.educationCycles as unknown as import('@prisma/client').Prisma.JsonArray
      }
    })
    results.push(record)
  }
  return results
}
