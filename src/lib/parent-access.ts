import { prisma } from '../config/prisma'

export async function getParentScope(institutionId: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, phone: true }
  })

  const parent = await prisma.parent.findFirst({
    where: {
      institutionId,
      OR: [
        { userId },
        ...(user?.phone ? [{ phone: user.phone }] : [])
      ]
    },
    include: {
      students: {
        select: {
          studentId: true,
          relationship: true,
          isPrimary: true
        }
      }
    }
  })

  return {
    parent,
    studentIds: parent?.students.map((link) => link.studentId) ?? []
  }
}

export async function parentCanAccessStudent(institutionId: string, userId: string, studentId: string) {
  const { studentIds } = await getParentScope(institutionId, userId)
  return studentIds.includes(studentId)
}
