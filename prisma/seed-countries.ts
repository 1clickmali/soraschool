import { PrismaClient, InstitutionKind, CurriculumCycle } from '@prisma/client'

const prisma = new PrismaClient()
const CONFIG_SOURCE_STATUS = 'CONFIGURABLE_DEFAULT_TO_VALIDATE_BY_SUPER_ADMIN'

const COUNTRIES = [
  {
    code: 'CI',
    name: "Côte d'Ivoire",
    nameFr: "Côte d'Ivoire",
    currency: 'XOF',
    schoolYearStartMonth: 9,
    schoolYearEndMonth: 6,
    passingThreshold: 10,
    maxScore: 20,
    termCount: 3,
    gradingSystem: 'numeric_20',
    educationCycles: {
      maternelle: { levels: ['PS', 'MS', 'GS'], years: 3 },
      primaire: { levels: ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2'], years: 6 },
      college: { levels: ['6ème', '5ème', '4ème', '3ème'], years: 4 },
      lycee: { levels: ['Seconde', 'Première', 'Terminale'], years: 3 },
      universite: { levels: ['L1', 'L2', 'L3', 'M1', 'M2', 'D1'], years: 6 }
    },
    promotionRules: {
      primaire: { passingAverage: 10, allowRepeat: true, maxRepeats: 2 },
      college: { passingAverage: 10, allowRepeat: true, maxRepeats: 2 },
      lycee: { passingAverage: 10, allowRepeat: true, maxRepeats: 2 }
    },
    officialHolidays: [
      { date: '01-01', name: 'Nouvel An' },
      { date: '05-01', name: 'Fête du Travail' },
      { date: '08-07', name: 'Fête Nationale' },
      { date: '11-15', name: "Jour de la Paix" },
      { date: '12-25', name: 'Noël' }
    ]
  },
  {
    code: 'ML',
    name: 'Mali',
    nameFr: 'Mali',
    currency: 'XOF',
    schoolYearStartMonth: 10,
    schoolYearEndMonth: 6,
    passingThreshold: 10,
    maxScore: 20,
    termCount: 3,
    gradingSystem: 'numeric_20',
    educationCycles: {
      primaire: { levels: ['1ère AF', '2ème AF', '3ème AF', '4ème AF', '5ème AF', '6ème AF'], years: 6 },
      college: { levels: ['7ème', '8ème', '9ème'], years: 3 },
      lycee: { levels: ['10ème', '11ème', '12ème'], years: 3 }
    },
    promotionRules: { passingAverage: 10, allowRepeat: true, maxRepeats: 2 },
    officialHolidays: [
      { date: '01-01', name: 'Nouvel An' },
      { date: '01-20', name: 'Fête de l\'Armée' },
      { date: '05-01', name: 'Fête du Travail' },
      { date: '09-22', name: 'Fête de l\'Indépendance' }
    ]
  },
  {
    code: 'SN',
    name: 'Sénégal',
    nameFr: 'Sénégal',
    currency: 'XOF',
    schoolYearStartMonth: 10,
    schoolYearEndMonth: 7,
    passingThreshold: 10,
    maxScore: 20,
    termCount: 3,
    gradingSystem: 'numeric_20',
    educationCycles: {
      primaire: { levels: ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'], years: 6 },
      college: { levels: ['6ème', '5ème', '4ème', '3ème'], years: 4 },
      lycee: { levels: ['Seconde', 'Première', 'Terminale'], years: 3 }
    },
    promotionRules: { passingAverage: 10, allowRepeat: true, maxRepeats: 2 },
    officialHolidays: [
      { date: '01-01', name: 'Nouvel An' },
      { date: '04-04', name: 'Fête de l\'Indépendance' },
      { date: '05-01', name: 'Fête du Travail' },
      { date: '12-25', name: 'Noël' }
    ]
  },
  {
    code: 'BF',
    name: 'Burkina Faso',
    nameFr: 'Burkina Faso',
    currency: 'XOF',
    schoolYearStartMonth: 10,
    schoolYearEndMonth: 6,
    passingThreshold: 10,
    maxScore: 20,
    termCount: 3,
    gradingSystem: 'numeric_20',
    educationCycles: {
      primaire: { levels: ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2'], years: 6 },
      college: { levels: ['6ème', '5ème', '4ème', '3ème'], years: 4 },
      lycee: { levels: ['Seconde', 'Première', 'Terminale'], years: 3 }
    },
    promotionRules: { passingAverage: 10, allowRepeat: true, maxRepeats: 2 },
    officialHolidays: [
      { date: '01-01', name: 'Nouvel An' },
      { date: '01-03', name: "Fête de la Révolution" },
      { date: '08-04', name: "Fête Nationale" },
      { date: '05-01', name: 'Fête du Travail' }
    ]
  },
  {
    code: 'BJ',
    name: 'Bénin',
    nameFr: 'Bénin',
    currency: 'XOF',
    schoolYearStartMonth: 10,
    schoolYearEndMonth: 7,
    passingThreshold: 10,
    maxScore: 20,
    termCount: 3,
    gradingSystem: 'numeric_20',
    educationCycles: {
      primaire: { levels: ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'], years: 6 },
      college: { levels: ['6ème', '5ème', '4ème', '3ème'], years: 4 },
      lycee: { levels: ['Seconde', 'Première', 'Terminale'], years: 3 }
    },
    promotionRules: { passingAverage: 10, allowRepeat: true, maxRepeats: 2 },
    officialHolidays: [
      { date: '01-01', name: 'Nouvel An' },
      { date: '05-01', name: 'Fête du Travail' },
      { date: '08-01', name: "Fête Nationale" }
    ]
  },
  {
    code: 'NE',
    name: 'Niger',
    nameFr: 'Niger',
    currency: 'XOF',
    schoolYearStartMonth: 10,
    schoolYearEndMonth: 6,
    passingThreshold: 10,
    maxScore: 20,
    termCount: 3,
    gradingSystem: 'numeric_20',
    educationCycles: {
      primaire: { levels: ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'], years: 6 },
      college: { levels: ['6ème', '5ème', '4ème', '3ème'], years: 4 },
      lycee: { levels: ['Seconde', 'Première', 'Terminale'], years: 3 }
    },
    promotionRules: { passingAverage: 10, allowRepeat: true, maxRepeats: 2 },
    officialHolidays: [
      { date: '01-01', name: 'Nouvel An' },
      { date: '04-24', name: "Fête Nationale" },
      { date: '05-01', name: 'Fête du Travail' }
    ]
  },
  {
    code: 'GN',
    name: 'Guinée',
    nameFr: 'Guinée',
    currency: 'GNF',
    schoolYearStartMonth: 10,
    schoolYearEndMonth: 6,
    passingThreshold: 10,
    maxScore: 20,
    termCount: 3,
    gradingSystem: 'numeric_20',
    educationCycles: {
      primaire: { levels: ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'], years: 6 },
      college: { levels: ['7ème', '8ème', '9ème', '10ème'], years: 4 },
      lycee: { levels: ['11ème', '12ème', '13ème'], years: 3 }
    },
    promotionRules: { passingAverage: 10, allowRepeat: true, maxRepeats: 2 },
    officialHolidays: [
      { date: '01-01', name: 'Nouvel An' },
      { date: '05-01', name: 'Fête du Travail' },
      { date: '10-02', name: "Fête Nationale" }
    ]
  },
  {
    code: 'TG',
    name: 'Togo',
    nameFr: 'Togo',
    currency: 'XOF',
    schoolYearStartMonth: 10,
    schoolYearEndMonth: 7,
    passingThreshold: 10,
    maxScore: 20,
    termCount: 3,
    gradingSystem: 'numeric_20',
    educationCycles: {
      primaire: { levels: ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'], years: 6 },
      college: { levels: ['6ème', '5ème', '4ème', '3ème'], years: 4 },
      lycee: { levels: ['Seconde', 'Première', 'Terminale'], years: 3 }
    },
    promotionRules: { passingAverage: 10, allowRepeat: true, maxRepeats: 2 },
    officialHolidays: [
      { date: '01-01', name: 'Nouvel An' },
      { date: '04-27', name: "Fête Nationale" },
      { date: '05-01', name: 'Fête du Travail' }
    ]
  },
  {
    code: 'GH',
    name: 'Ghana',
    nameFr: 'Ghana',
    currency: 'GHS',
    schoolYearStartMonth: 9,
    schoolYearEndMonth: 7,
    passingThreshold: 50,
    maxScore: 100,
    termCount: 3,
    gradingSystem: 'numeric_100',
    educationCycles: {
      primary: { levels: ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6'], years: 6 },
      jhs: { levels: ['JHS 1', 'JHS 2', 'JHS 3'], years: 3 },
      shs: { levels: ['SHS 1', 'SHS 2', 'SHS 3'], years: 3 }
    },
    promotionRules: { passingAverage: 50, allowRepeat: true, maxRepeats: 2 },
    officialHolidays: [
      { date: '01-01', name: 'New Year' },
      { date: '03-06', name: 'Independence Day' },
      { date: '05-01', name: 'May Day' },
      { date: '12-25', name: 'Christmas' }
    ]
  },
  {
    code: 'NG',
    name: 'Nigeria',
    nameFr: 'Nigeria',
    currency: 'NGN',
    schoolYearStartMonth: 9,
    schoolYearEndMonth: 7,
    passingThreshold: 50,
    maxScore: 100,
    termCount: 3,
    gradingSystem: 'numeric_100',
    educationCycles: {
      primary: { levels: ['Primary 1','Primary 2','Primary 3','Primary 4','Primary 5','Primary 6'], years: 6 },
      jss: { levels: ['JSS 1', 'JSS 2', 'JSS 3'], years: 3 },
      sss: { levels: ['SSS 1', 'SSS 2', 'SSS 3'], years: 3 }
    },
    promotionRules: { passingAverage: 50, allowRepeat: true, maxRepeats: 2 },
    officialHolidays: [
      { date: '01-01', name: 'New Year' },
      { date: '05-01', name: 'Workers Day' },
      { date: '10-01', name: 'Independence Day' },
      { date: '12-25', name: 'Christmas' }
    ]
  },
  {
    code: 'GM',
    name: 'Gambia',
    nameFr: 'Gambie',
    currency: 'GMD',
    schoolYearStartMonth: 9,
    schoolYearEndMonth: 6,
    passingThreshold: 50,
    maxScore: 100,
    termCount: 3,
    gradingSystem: 'numeric_100',
    educationCycles: {
      primary: { levels: ['Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6'], years: 6 },
      secondary: { levels: ['Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12'], years: 6 }
    },
    promotionRules: { passingAverage: 50, allowRepeat: true, maxRepeats: 2 },
    officialHolidays: [
      { date: '01-01', name: 'New Year' },
      { date: '02-18', name: 'Independence Day' },
      { date: '05-01', name: 'Labour Day' }
    ]
  },
  {
    code: 'SL',
    name: 'Sierra Leone',
    nameFr: 'Sierra Leone',
    currency: 'SLL',
    schoolYearStartMonth: 9,
    schoolYearEndMonth: 7,
    passingThreshold: 50,
    maxScore: 100,
    termCount: 3,
    gradingSystem: 'numeric_100',
    educationCycles: {
      primary: { levels: ['Class 1','Class 2','Class 3','Class 4','Class 5','Class 6'], years: 6 },
      jss: { levels: ['JSS 1','JSS 2','JSS 3'], years: 3 },
      sss: { levels: ['SSS 1','SSS 2','SSS 3'], years: 3 }
    },
    promotionRules: { passingAverage: 50, allowRepeat: true, maxRepeats: 2 },
    officialHolidays: [
      { date: '01-01', name: 'New Year' },
      { date: '04-27', name: 'Independence Day' },
      { date: '12-25', name: 'Christmas' }
    ]
  },
  {
    code: 'LR',
    name: 'Liberia',
    nameFr: 'Liberia',
    currency: 'LRD',
    schoolYearStartMonth: 9,
    schoolYearEndMonth: 7,
    passingThreshold: 50,
    maxScore: 100,
    termCount: 3,
    gradingSystem: 'numeric_100',
    educationCycles: {
      primary: { levels: ['Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6'], years: 6 },
      jhs: { levels: ['Grade 7','Grade 8','Grade 9'], years: 3 },
      shs: { levels: ['Grade 10','Grade 11','Grade 12'], years: 3 }
    },
    promotionRules: { passingAverage: 50, allowRepeat: true, maxRepeats: 2 },
    officialHolidays: [
      { date: '01-01', name: 'New Year' },
      { date: '07-26', name: 'Independence Day' },
      { date: '12-25', name: 'Christmas' }
    ]
  },
  {
    code: 'CV',
    name: 'Cape Verde',
    nameFr: 'Cap-Vert',
    currency: 'CVE',
    schoolYearStartMonth: 9,
    schoolYearEndMonth: 6,
    passingThreshold: 10,
    maxScore: 20,
    termCount: 3,
    gradingSystem: 'numeric_20',
    educationCycles: {
      primaire: { levels: ['1ère','2ème','3ème','4ème','5ème','6ème'], years: 6 },
      college: { levels: ['7ème','8ème','9ème','10ème'], years: 4 },
      lycee: { levels: ['11ème','12ème'], years: 2 }
    },
    promotionRules: { passingAverage: 10, allowRepeat: true, maxRepeats: 2 },
    officialHolidays: [
      { date: '01-01', name: 'Nouvel An' },
      { date: '07-05', name: 'Fête Nationale' },
      { date: '12-25', name: 'Noël' }
    ]
  },
  {
    code: 'GW',
    name: 'Guinea-Bissau',
    nameFr: 'Guinée-Bissau',
    currency: 'XOF',
    schoolYearStartMonth: 10,
    schoolYearEndMonth: 6,
    passingThreshold: 10,
    maxScore: 20,
    termCount: 3,
    gradingSystem: 'numeric_20',
    educationCycles: {
      primaire: { levels: ['1ère','2ème','3ème','4ème','5ème','6ème'], years: 6 },
      college: { levels: ['7ème','8ème','9ème'], years: 3 },
      lycee: { levels: ['10ème','11ème','12ème'], years: 3 }
    },
    promotionRules: { passingAverage: 10, allowRepeat: true, maxRepeats: 2 },
    officialHolidays: [
      { date: '01-01', name: 'Nouvel An' },
      { date: '09-24', name: 'Fête Nationale' },
      { date: '05-01', name: 'Fête du Travail' }
    ]
  },
  {
    code: 'MR',
    name: 'Mauritania',
    nameFr: 'Mauritanie',
    currency: 'MRU',
    schoolYearStartMonth: 10,
    schoolYearEndMonth: 6,
    passingThreshold: 10,
    maxScore: 20,
    termCount: 3,
    gradingSystem: 'numeric_20',
    educationCycles: {
      primaire: { levels: ['1ère','2ème','3ème','4ème','5ème','6ème'], years: 6 },
      college: { levels: ['7ème','8ème','9ème','10ème'], years: 4 },
      lycee: { levels: ['11ème','12ème'], years: 2 }
    },
    promotionRules: { passingAverage: 10, allowRepeat: true, maxRepeats: 2 },
    officialHolidays: [
      { date: '01-01', name: 'Nouvel An' },
      { date: '11-28', name: 'Fête Nationale' },
      { date: '05-01', name: 'Fête du Travail' }
    ]
  }
]

const CURRICULA = [
  // ── CÔTE D'IVOIRE - PRIMAIRE ─────────────────────────────────
  {
    countryCode: 'CI',
    institutionKind: InstitutionKind.PRIMARY,
    cycle: CurriculumCycle.PRIMAIRE,
    name: 'Programme Primaire - Côte d\'Ivoire',
    passingAverage: 10,
    maxScore: 20,
    termCount: 3,
    isOfficial: true,
    subjects: [
      { name: 'Français', coefficient: 3, weeklyHours: 9, isCompulsory: true, order: 1 },
      { name: 'Mathématiques', coefficient: 3, weeklyHours: 7, isCompulsory: true, order: 2 },
      { name: 'Sciences d\'Éveil', coefficient: 2, weeklyHours: 3, isCompulsory: true, order: 3 },
      { name: 'Histoire-Géographie', coefficient: 2, weeklyHours: 2, isCompulsory: true, order: 4 },
      { name: 'Éducation Civique', coefficient: 1, weeklyHours: 1, isCompulsory: true, order: 5 },
      { name: 'Anglais', coefficient: 1, weeklyHours: 2, isCompulsory: false, order: 6 },
      { name: 'Arts Plastiques', coefficient: 1, weeklyHours: 1, isCompulsory: false, order: 7 },
      { name: 'EPS', coefficient: 1, weeklyHours: 2, isCompulsory: true, order: 8 }
    ]
  },
  // ── CÔTE D'IVOIRE - COLLÈGE ───────────────────────────────────
  {
    countryCode: 'CI',
    institutionKind: InstitutionKind.COLLEGE,
    cycle: CurriculumCycle.COLLEGE,
    name: 'Programme Collège - Côte d\'Ivoire',
    passingAverage: 10,
    maxScore: 20,
    termCount: 3,
    isOfficial: true,
    subjects: [
      { name: 'Français', coefficient: 4, weeklyHours: 5, isCompulsory: true, order: 1 },
      { name: 'Mathématiques', coefficient: 4, weeklyHours: 5, isCompulsory: true, order: 2 },
      { name: 'Anglais', coefficient: 3, weeklyHours: 4, isCompulsory: true, order: 3 },
      { name: 'Sciences de la Vie et de la Terre', coefficient: 3, weeklyHours: 3, isCompulsory: true, order: 4 },
      { name: 'Physique-Chimie', coefficient: 3, weeklyHours: 3, isCompulsory: true, order: 5 },
      { name: 'Histoire-Géographie', coefficient: 3, weeklyHours: 3, isCompulsory: true, order: 6 },
      { name: 'Éducation Civique', coefficient: 2, weeklyHours: 1, isCompulsory: true, order: 7 },
      { name: 'Arts Plastiques', coefficient: 1, weeklyHours: 1, isCompulsory: false, order: 8 },
      { name: 'Musique', coefficient: 1, weeklyHours: 1, isCompulsory: false, order: 9 },
      { name: 'EPS', coefficient: 2, weeklyHours: 2, isCompulsory: true, order: 10 },
      { name: 'Informatique', coefficient: 1, weeklyHours: 1, isCompulsory: false, order: 11 }
    ]
  },
  // ── CÔTE D'IVOIRE - LYCÉE ─────────────────────────────────────
  {
    countryCode: 'CI',
    institutionKind: InstitutionKind.LYCEE,
    cycle: CurriculumCycle.LYCEE,
    name: 'Programme Lycée Série A - Côte d\'Ivoire',
    passingAverage: 10,
    maxScore: 20,
    termCount: 3,
    isOfficial: true,
    subjects: [
      { name: 'Français/Littérature', coefficient: 5, weeklyHours: 6, isCompulsory: true, order: 1 },
      { name: 'Philosophie', coefficient: 4, weeklyHours: 4, isCompulsory: true, order: 2 },
      { name: 'Histoire-Géographie', coefficient: 4, weeklyHours: 4, isCompulsory: true, order: 3 },
      { name: 'Mathématiques', coefficient: 2, weeklyHours: 3, isCompulsory: true, order: 4 },
      { name: 'Anglais', coefficient: 3, weeklyHours: 4, isCompulsory: true, order: 5 },
      { name: 'Espagnol/Allemand', coefficient: 2, weeklyHours: 3, isCompulsory: false, order: 6 },
      { name: 'SVT', coefficient: 1, weeklyHours: 2, isCompulsory: false, order: 7 },
      { name: 'EPS', coefficient: 2, weeklyHours: 2, isCompulsory: true, order: 8 }
    ]
  },
  // ── CÔTE D'IVOIRE - MATERNELLE ────────────────────────────────
  {
    countryCode: 'CI',
    institutionKind: InstitutionKind.MATERNELLE,
    cycle: CurriculumCycle.MATERNELLE,
    name: 'Programme Maternelle - Côte d\'Ivoire',
    passingAverage: 10,
    maxScore: 20,
    termCount: 3,
    isOfficial: true,
    subjects: [
      { name: 'Langage / Communication', coefficient: 3, weeklyHours: 6, isCompulsory: true, order: 1 },
      { name: 'Mathématiques / Logique', coefficient: 2, weeklyHours: 4, isCompulsory: true, order: 2 },
      { name: 'Découverte du Monde', coefficient: 2, weeklyHours: 3, isCompulsory: true, order: 3 },
      { name: 'Arts et Créativité', coefficient: 1, weeklyHours: 3, isCompulsory: true, order: 4 },
      { name: 'EPS / Motricité', coefficient: 1, weeklyHours: 3, isCompulsory: true, order: 5 },
      { name: 'Éducation Musicale', coefficient: 1, weeklyHours: 2, isCompulsory: false, order: 6 }
    ]
  },
  // ── CENTRE DE FORMATION (générique) ──────────────────────────
  {
    countryCode: null,
    institutionKind: InstitutionKind.TRAINING_CENTER,
    cycle: CurriculumCycle.FORMATION,
    name: 'Programme Centre de Formation - Générique',
    passingAverage: 12,
    maxScore: 20,
    termCount: 2,
    isOfficial: false,
    subjects: [
      { name: 'Module Théorique', coefficient: 3, weeklyHours: 10, isCompulsory: true, order: 1 },
      { name: 'Module Pratique', coefficient: 4, weeklyHours: 15, isCompulsory: true, order: 2 },
      { name: 'Projet de Fin de Formation', coefficient: 3, weeklyHours: 5, isCompulsory: true, order: 3 },
      { name: 'Communication Professionnelle', coefficient: 2, weeklyHours: 3, isCompulsory: false, order: 4 }
    ]
  },
  // ── UNIVERSITÉ (générique CEDEAO) ─────────────────────────────
  {
    countryCode: null,
    institutionKind: InstitutionKind.UNIVERSITY,
    cycle: CurriculumCycle.UNIVERSITE,
    name: 'Programme Licence - Générique CEDEAO',
    passingAverage: 10,
    maxScore: 20,
    termCount: 2,
    isOfficial: false,
    subjects: [
      { name: 'UE Fondamentale 1', coefficient: 4, weeklyHours: 4, isCompulsory: true, order: 1 },
      { name: 'UE Fondamentale 2', coefficient: 4, weeklyHours: 4, isCompulsory: true, order: 2 },
      { name: 'UE Complémentaire', coefficient: 2, weeklyHours: 2, isCompulsory: true, order: 3 },
      { name: 'UE Transversale', coefficient: 1, weeklyHours: 2, isCompulsory: true, order: 4 },
      { name: 'Langue Vivante', coefficient: 1, weeklyHours: 2, isCompulsory: false, order: 5 },
      { name: 'Stage / Projet', coefficient: 3, weeklyHours: 0, isCompulsory: false, order: 6 }
    ]
  }
]

export async function seedCountryConfigsAndCurricula(client: PrismaClient) {
  console.log('🌍 Seeding CountryConfig pour 16 pays CEDEAO...')
  for (const country of COUNTRIES) {
    const promotionRules = {
      ...(typeof country.promotionRules === 'object' ? country.promotionRules : {}),
      sourceStatus: CONFIG_SOURCE_STATUS
    }
    const gradingRules = {
      sourceStatus: CONFIG_SOURCE_STATUS,
      note: 'Configuration initiale modifiable. Validation officielle requise par pays avant usage réglementaire.'
    }
    await client.countryConfig.upsert({
      where: { code: country.code },
      update: {
        name: country.name,
        nameFr: country.nameFr,
        currency: country.currency,
        schoolYearStartMonth: country.schoolYearStartMonth,
        schoolYearEndMonth: country.schoolYearEndMonth,
        passingThreshold: country.passingThreshold,
        maxScore: country.maxScore,
        termCount: country.termCount,
        gradingSystem: country.gradingSystem,
        educationCycles: country.educationCycles,
        promotionRules,
        gradingRules,
        officialHolidays: []
      },
      create: {
        code: country.code,
        name: country.name,
        nameFr: country.nameFr,
        currency: country.currency,
        schoolYearStartMonth: country.schoolYearStartMonth,
        schoolYearEndMonth: country.schoolYearEndMonth,
        passingThreshold: country.passingThreshold,
        maxScore: country.maxScore,
        termCount: country.termCount,
        gradingSystem: country.gradingSystem,
        educationCycles: country.educationCycles,
        promotionRules,
        gradingRules,
        officialHolidays: []
      }
    })
  }
  console.log(`✅ ${COUNTRIES.length} pays configurés`)

  console.log('📚 Seeding Curriculum (programmes par niveau)...')
  for (const curriculum of CURRICULA) {
      const existing = await client.curriculum.findFirst({
        where: {
          countryCode: curriculum.countryCode,
          institutionKind: curriculum.institutionKind,
        cycle: curriculum.cycle,
        institutionId: null
      }
    })
    if (!existing) {
      await client.curriculum.create({
        data: {
          countryCode: curriculum.countryCode,
          institutionKind: curriculum.institutionKind,
          cycle: curriculum.cycle,
          name: curriculum.name,
          passingAverage: curriculum.passingAverage,
          maxScore: curriculum.maxScore,
          termCount: curriculum.termCount,
          isOfficial: curriculum.isOfficial,
          subjects: { create: curriculum.subjects }
        }
      })
    } else {
      console.log(`  ⏭  Curriculum déjà existant: ${curriculum.name}`)
    }
  }
  console.log(`✅ ${CURRICULA.length} curricula configurés`)
  console.log('🎉 Seed pays/curricula terminé')
}

async function main() {
  await seedCountryConfigsAndCurricula(prisma)
}

const entrypoint = process.argv[1] ?? ''
if (entrypoint.endsWith('seed-countries.ts') || entrypoint.endsWith('seed-countries.js')) {
  main()
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
    .finally(() => prisma.$disconnect())
}
