import { prisma } from '../lib/prisma'

async function main() {
  const byId = await prisma.business.findFirst({
    where: { id: '56836' },
    select: { id: true, email: true, name: true, businessIdentifier: true },
  })
  const byIdent = await prisma.business.findFirst({
    where: { businessIdentifier: '56836' },
    select: { id: true, email: true, name: true, businessIdentifier: true },
  })
  console.log('By id 56836:', JSON.stringify(byId, null, 2))
  console.log('By businessIdentifier 56836:', JSON.stringify(byIdent, null, 2))
  await prisma.$disconnect()
}
main()
