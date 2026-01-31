import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export async function createBusiness(data: {
  name: string
  email: string
  password?: string
  slug: string
  googleId?: string
}) {
  const hashedPassword = data.password ? await hashPassword(data.password) : null
  
  // Normalize email (lowercase, trim)
  const normalizedEmail = data.email.toLowerCase().trim()
  
  return prisma.business.create({
    data: {
      name: data.name,
      email: normalizedEmail,
      password: hashedPassword,
      slug: data.slug,
      googleId: data.googleId,
    },
  })
}

export async function authenticateBusiness(email: string, password: string) {
  // Normalize email (lowercase, trim)
  const normalizedEmail = email.toLowerCase().trim()
  
  const business = await prisma.business.findUnique({
    where: { email: normalizedEmail },
  })

  if (!business) {
    console.log('Business not found for email:', normalizedEmail)
    return null
  }

  // Check if password is set
  if (!business.password) {
    console.log('Business has no password set:', business.id)
    return null
  }

  const isValid = await verifyPassword(password, business.password)
  if (!isValid) {
    console.log('Password verification failed for business:', business.id)
    return null
  }

  // Не повертаємо пароль
  const { password: _, ...businessWithoutPassword } = business
  return businessWithoutPassword
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}



