import { prisma } from './prisma'

export async function getBusinessBySlug(slug: string) {
  return prisma.business.findUnique({
    where: { slug, isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      logo: true,
      primaryColor: true,
      secondaryColor: true,
      backgroundColor: true,
      surfaceColor: true,
    },
  })
}

export async function getBusinessById(id: string) {
  return prisma.business.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      email: true,
      phone: true,
      address: true,
      description: true,
      logo: true,
      primaryColor: true,
      secondaryColor: true,
      backgroundColor: true,
      surfaceColor: true,
      isActive: true,
    },
  })
}





