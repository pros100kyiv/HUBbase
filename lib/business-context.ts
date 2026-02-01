import { prisma } from './prisma'

export async function getBusinessBySlug(slug: string) {
  try {
    return await prisma.business.findUnique({
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
        // Нові поля візитівки (можуть бути відсутні в старій БД)
        businessCardBackgroundImage: true,
        slogan: true,
        additionalInfo: true,
        socialMedia: true,
        workingHours: true,
        location: true,
      },
    })
  } catch (error: any) {
    // Якщо поля відсутні в БД, використовуємо базовий select
    if (error?.message?.includes('does not exist')) {
      console.warn('Business card fields not found in database, using basic select')
      return await prisma.business.findUnique({
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
    throw error
  }
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






