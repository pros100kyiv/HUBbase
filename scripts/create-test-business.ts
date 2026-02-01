import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function createTestBusiness() {
  const email = 'admin@045barbershop.com'
  const password = 'password123'
  const name = '5 Barbershop'
  const slug = '045-barbershop'

  try {
    // Check if business already exists
    const existing = await prisma.business.findUnique({
      where: { email },
    })

    if (existing) {
      console.log('✅ Test business already exists')
      // Update password in case it was changed
      const hashedPassword = await bcrypt.hash(password, 10)
      await prisma.business.update({
        where: { email },
        data: { password: hashedPassword },
      })
      console.log('✅ Password updated for test business')
      return
    }

    // Create test business
    const hashedPassword = await bcrypt.hash(password, 10)
    const business = await prisma.business.create({
      data: {
        name,
        email,
        password: hashedPassword,
        slug,
        isActive: true,
      },
    })

    console.log('✅ Test business created successfully!')
    console.log('Email:', email)
    console.log('Password:', password)
    console.log('Business ID:', business.id)
  } catch (error) {
    console.error('❌ Error creating test business:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

createTestBusiness()




