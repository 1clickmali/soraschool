import {
  PrismaClient,
  BillingCycle,
  ContractType,
  Gender,
  InstitutionKind,
  InstitutionStructure,
  InstitutionStatus,
  PaymentProvider,
  PaymentStatus,
  PlanTier,
  SubscriptionStatus,
  UserRole
} from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.platformBranding.upsert({
    where: { id: 'default' },
    update: {
      appName: 'SoraSchool',
      supportEmail: 'contact@soratech.ci',
      supportPhone: '0704928068'
    },
    create: {
      id: 'default',
      appName: 'SoraSchool',
      slogan: 'La plateforme scolaire intelligente',
      supportEmail: 'contact@soratech.ci',
      supportPhone: '0704928068',
      primaryColor: '#0F6BFF',
      secondaryColor: '#07111F',
      accentColor: '#F5B941'
    }
  })

  const [basic, premium, enterprise] = await Promise.all([
    prisma.plan.upsert({
      where: { code: 'BASIC' },
      update: {
        name: 'Basic',
        tier: PlanTier.BASIC,
        monthlyPrice: 55000,
        annualPrice: 550000,
        maxStudents: 300,
        maxTeachers: 25,
        maxEstablishments: 1,
        canCreateBranches: false,
        features: ['students', 'teachers', 'payments', 'documents'],
        isActive: true
      },
      create: {
        name: 'Basic',
        code: 'BASIC',
        tier: PlanTier.BASIC,
        monthlyPrice: 55000,
        annualPrice: 550000,
        maxStudents: 300,
        maxTeachers: 25,
        maxEstablishments: 1,
        features: ['students', 'teachers', 'payments', 'documents']
      }
    }),
    prisma.plan.upsert({
      where: { code: 'PREMIUM' },
      update: {
        name: 'Premium',
        tier: PlanTier.PREMIUM,
        monthlyPrice: 125000,
        annualPrice: 1250000,
        maxStudents: 1200,
        maxTeachers: 80,
        maxEstablishments: 1,
        canCreateBranches: false,
        features: ['all_basic', 'pdf', 'cards', 'shop', 'messages', 'parent_portal'],
        isActive: true
      },
      create: {
        name: 'Premium',
        code: 'PREMIUM',
        tier: PlanTier.PREMIUM,
        monthlyPrice: 125000,
        annualPrice: 1250000,
        maxStudents: 1200,
        maxTeachers: 80,
        maxEstablishments: 1,
        features: ['all_basic', 'pdf', 'cards', 'shop', 'messages', 'parent_portal']
      }
    }),
    prisma.plan.upsert({
      where: { code: 'ENTERPRISE' },
      update: {
        name: 'Enterprise',
        tier: PlanTier.ENTERPRISE,
        monthlyPrice: 200000,
        annualPrice: 2000000,
        maxStudents: null,
        maxTeachers: null,
        maxEstablishments: 20,
        canCreateBranches: true,
        features: ['unlimited', 'multi_branch', 'advanced_security', 'api_mobile'],
        isActive: true
      },
      create: {
        name: 'Enterprise',
        code: 'ENTERPRISE',
        tier: PlanTier.ENTERPRISE,
        monthlyPrice: 200000,
        annualPrice: 2000000,
        maxStudents: null,
        maxTeachers: null,
        maxEstablishments: 20,
        canCreateBranches: true,
        features: ['unlimited', 'multi_branch', 'advanced_security', 'api_mobile']
      }
    })
  ])

  await prisma.user.updateMany({
    where: { phone: '+22507000000001', role: UserRole.SUPER_ADMIN },
    data: { phone: '+2250700000001' }
  })
  const existingOwner = await prisma.user.findFirst({ where: { phone: '+2250700000001', role: UserRole.SUPER_ADMIN } })
  if (!existingOwner) {
    await prisma.user.create({
      data: {
        role: UserRole.SUPER_ADMIN,
        firstName: 'Super',
        lastName: 'Admin',
        phone: '+2250700000001',
        email: 'owner@soraschool.local'
      }
    })
  }

  const institution = await prisma.institution.upsert({
    where: { slug: 'iscf' },
    update: {
      structure: InstitutionStructure.CENTRAL_ADMINISTRATION,
      centralAdminName: 'Sissoko Établissement',
      centralAdminPhone: '+2250704928068',
      centralAdminEmail: 'groupe@iscf.ci',
      status: InstitutionStatus.ACTIVE
    },
    create: {
      name: 'Institut des Sciences du Coran et de la Formation',
      slug: 'iscf',
      kind: InstitutionKind.RELIGIOUS,
      structure: InstitutionStructure.CENTRAL_ADMINISTRATION,
      status: InstitutionStatus.ACTIVE,
      country: "Côte d'Ivoire",
      city: 'Abidjan',
      district: 'Cocody Riviera 2',
      address: 'Cocody Riviera 2, Abidjan',
      phone: '+22527204050',
      whatsapp: '+22507597799139',
      email: 'direction@iscf.ci',
      website: 'https://iscf.ci',
      directorName: 'Aminata Koné',
      directorPhone: '+22507597799139',
      directorEmail: 'direction@iscf.ci',
      centralAdminName: 'Sissoko Établissement',
      centralAdminPhone: '+2250704928068',
      centralAdminEmail: 'groupe@iscf.ci',
      motto: 'Sincérité - Science - Pratique',
      languages: ['FR', 'AR'],
      levels: ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2', '6e', '5e', '4e', '3e'],
      estimatedStudents: 450,
      estimatedTeachers: 32,
      activeAcademicYearName: '2025-2026',
      currency: 'XOF',
      primaryColor: '#064E3B',
      secondaryColor: '#F7F1DE',
      accentColor: '#C89B3C'
    }
  })

  await prisma.subscription.upsert({
    where: { id: 'seed-iscf-subscription' },
    update: {},
    create: {
      id: 'seed-iscf-subscription',
      institutionId: institution.id,
      planId: enterprise.id,
      status: SubscriptionStatus.ACTIVE,
      cycle: BillingCycle.ANNUAL,
      startsAt: new Date('2025-09-01'),
      endsAt: new Date('2026-08-31')
    }
  })

  await prisma.saaSPayment.upsert({
    where: { id: 'seed-iscf-saas-payment-2026' },
    update: {},
    create: {
      id: 'seed-iscf-saas-payment-2026',
      institutionId: institution.id,
      subscriptionId: 'seed-iscf-subscription',
      amount: enterprise.annualPrice,
      currency: 'XOF',
      provider: PaymentProvider.BANK_TRANSFER,
      transactionRef: 'SEED-SCHOOL-2026-0001',
      status: PaymentStatus.PAID,
      paidAt: new Date('2026-04-20')
    }
  })

  const establishment = await prisma.establishment.upsert({
    where: { institutionId_slug: { institutionId: institution.id, slug: 'principal' } },
    update: {
      directorName: institution.directorName,
      directorPhone: institution.directorPhone,
      directorEmail: institution.directorEmail,
      logoUrl: institution.logoUrl,
      motto: institution.motto,
      levels: institution.levels,
      activeAcademicYearName: institution.activeAcademicYearName
    },
    create: {
      institutionId: institution.id,
      name: institution.name,
      slug: 'principal',
      kind: InstitutionKind.RELIGIOUS,
      status: InstitutionStatus.ACTIVE,
      country: institution.country,
      city: institution.city,
      district: institution.district,
      address: institution.address,
      phone: institution.phone,
      email: institution.email,
      directorName: institution.directorName,
      directorPhone: institution.directorPhone,
      directorEmail: institution.directorEmail,
      logoUrl: institution.logoUrl,
      motto: institution.motto,
      levels: institution.levels,
      activeAcademicYearName: institution.activeAcademicYearName
    }
  })

  const centralAdmin = await prisma.user.upsert({
    where: { institutionId_phone: { institutionId: institution.id, phone: '+2250704928068' } },
    update: { role: UserRole.CENTRAL_ADMIN, firstName: 'Sissoko', lastName: 'Établissement', isActive: true },
    create: {
      institutionId: institution.id,
      role: UserRole.CENTRAL_ADMIN,
      firstName: 'Sissoko',
      lastName: 'Établissement',
      phone: '+2250704928068',
      email: 'groupe@iscf.ci'
    }
  })

  const director = await prisma.user.upsert({
    where: { institutionId_phone: { institutionId: institution.id, phone: '+22507597799139' } },
    update: { establishmentId: establishment.id, role: UserRole.DIRECTOR, isActive: true },
    create: {
      institutionId: institution.id,
      establishmentId: establishment.id,
      role: UserRole.DIRECTOR,
      firstName: 'Aminata',
      lastName: 'Koné',
      phone: '+22507597799139',
      email: 'direction@iscf.ci'
    }
  })

  const activeDirectorAssignment = await prisma.establishmentDirectorAssignment.findFirst({
    where: { institutionId: institution.id, establishmentId: establishment.id, directorUserId: director.id, isActive: true }
  })
  if (!activeDirectorAssignment) {
    await prisma.establishmentDirectorAssignment.updateMany({
      where: { institutionId: institution.id, establishmentId: establishment.id, isActive: true },
      data: { isActive: false, endsAt: new Date() }
    })
    await prisma.establishmentDirectorAssignment.create({
      data: {
        institutionId: institution.id,
        establishmentId: establishment.id,
        directorUserId: director.id,
        assignedById: centralAdmin.id,
        note: 'Direction principale ISCF'
      }
    })
  }

  for (const allowed of [
    { phone: '+2250704928068', role: UserRole.CENTRAL_ADMIN, firstName: 'Sissoko', lastName: 'Établissement' },
    { phone: '+22507597799139', role: UserRole.DIRECTOR, firstName: 'Aminata', lastName: 'Koné' },
    { phone: '+22507123456789', role: UserRole.TEACHER, firstName: 'Konan', lastName: 'Yao' },
    { phone: '+2250701020304', role: UserRole.PARENT, firstName: 'Adèle', lastName: 'Beugré' }
  ]) {
    await prisma.allowedPhone.upsert({
      where: { institutionId_phone: { institutionId: institution.id, phone: allowed.phone } },
      update: allowed,
      create: { institutionId: institution.id, ...allowed, createdById: director.id }
    })
  }

  const academicYear = await prisma.academicYear.upsert({
    where: { institutionId_name: { institutionId: institution.id, name: '2025-2026' } },
    update: {},
    create: {
      institutionId: institution.id,
      name: '2025-2026',
      startsAt: new Date('2025-09-01'),
      endsAt: new Date('2026-07-31'),
      isActive: true
    }
  })

  const level = await prisma.gradeLevel.upsert({
    where: { institutionId_code: { institutionId: institution.id, code: '6E' } },
    update: {},
    create: { institutionId: institution.id, code: '6E', name: 'Sixième', order: 6 }
  })

  const classroom = await prisma.classroom.upsert({
    where: { institutionId_academicYearId_name: { institutionId: institution.id, academicYearId: academicYear.id, name: '6e A' } },
    update: {},
    create: {
      institutionId: institution.id,
      establishmentId: establishment.id,
      academicYearId: academicYear.id,
      gradeLevelId: level.id,
      name: '6e A',
      capacity: 40
    }
  })

  const subject = await prisma.subject.upsert({
    where: { institutionId_name: { institutionId: institution.id, name: 'Sciences islamiques' } },
    update: {},
    create: { institutionId: institution.id, name: 'Sciences islamiques', code: 'SCI-ISL', coefficient: 3 }
  })

  const teacherUser = await prisma.user.upsert({
    where: { institutionId_phone: { institutionId: institution.id, phone: '+22507123456789' } },
    update: {},
    create: {
      institutionId: institution.id,
      establishmentId: establishment.id,
      role: UserRole.TEACHER,
      firstName: 'Konan',
      lastName: 'Yao',
      phone: '+22507123456789',
      email: 'konan.yao@iscf.ci'
    }
  })

  const teacher = await prisma.teacher.upsert({
    where: { institutionId_matricule: { institutionId: institution.id, matricule: 'ISCF-PR-00001' } },
    update: { establishmentId: establishment.id, userId: teacherUser.id },
    create: {
      institutionId: institution.id,
      establishmentId: establishment.id,
      userId: teacherUser.id,
      matricule: 'ISCF-PR-00001',
      firstName: 'Konan',
      lastName: 'Yao',
      phone: '+22507123456789',
      email: 'konan.yao@iscf.ci',
      contractType: ContractType.CDI,
      baseSalary: 180000,
      hireDate: new Date('2024-09-01'),
      specialization: 'Sciences islamiques'
    }
  })

  await prisma.teacherAssignment.upsert({
    where: {
      teacherId_classroomId_subjectId_academicYearId: {
        teacherId: teacher.id,
        classroomId: classroom.id,
        subjectId: subject.id,
        academicYearId: academicYear.id
      }
    },
    update: {},
    create: {
      institutionId: institution.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      subjectId: subject.id,
      academicYearId: academicYear.id
    }
  })

  const student = await prisma.student.upsert({
    where: { institutionId_matricule: { institutionId: institution.id, matricule: 'ISCF-EL-00001' } },
    update: {},
    create: {
      institutionId: institution.id,
      establishmentId: establishment.id,
      classroomId: classroom.id,
      matricule: 'ISCF-EL-00001',
      firstName: 'Mariam',
      lastName: 'Coulibaly',
      gender: Gender.FEMALE,
      birthDate: new Date('2013-03-12'),
      birthPlace: 'Abidjan',
      nationality: 'Ivoirienne',
      address: 'Cocody, Abidjan',
      status: 'ACTIVE'
    }
  })

  const parentUser = await prisma.user.upsert({
    where: { institutionId_phone: { institutionId: institution.id, phone: '+2250701020304' } },
    update: {},
    create: {
      institutionId: institution.id,
      establishmentId: establishment.id,
      role: UserRole.PARENT,
      firstName: 'Adèle',
      lastName: 'Beugré',
      phone: '+2250701020304',
      email: 'parent@iscf.ci'
    }
  })

  const parent = await prisma.parent.upsert({
    where: { institutionId_phone: { institutionId: institution.id, phone: '+2250701020304' } },
    update: {},
    create: {
      institutionId: institution.id,
      userId: parentUser.id,
      firstName: 'Adèle',
      lastName: 'Beugré',
      phone: '+2250701020304',
      email: 'parent@iscf.ci',
      profession: 'Commerçante'
    }
  })

  await prisma.studentParent.upsert({
    where: { studentId_parentId: { studentId: student.id, parentId: parent.id } },
    update: {},
    create: {
      institutionId: institution.id,
      studentId: student.id,
      parentId: parent.id,
      relationship: 'Mère',
      isPrimary: true,
      canPickup: true,
      emergencyContact: true
    }
  })

  const category = await prisma.productCategory.upsert({
    where: { institutionId_name: { institutionId: institution.id, name: 'Fournitures' } },
    update: {},
    create: { institutionId: institution.id, name: 'Fournitures' }
  })

  await prisma.product.upsert({
    where: { institutionId_code: { institutionId: institution.id, code: 'CAH-100P' } },
    update: {},
    create: {
      institutionId: institution.id,
      categoryId: category.id,
      code: 'CAH-100P',
      name: 'Cahier 100 pages',
      purchasePrice: 300,
      salePrice: 500,
      quantity: 120,
      lowStockAlert: 20
    }
  })

  console.log('Seed SoraSchool terminé')
  console.log('Super Admin: +2250700000001')
  console.log('Administration Centrale ISCF: +2250704928068')
  console.log('Directeur ISCF: +22507597799139')
  console.log('Professeur ISCF: +22507123456789')
  console.log('Parent ISCF: +2250701020304')
  void basic
  void premium
  void centralAdmin
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
