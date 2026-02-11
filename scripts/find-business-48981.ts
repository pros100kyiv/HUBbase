import { prisma } from '../lib/prisma'

async function main() {
  const byId = await prisma.business.findFirst({
    where: { id: '48981' },
    select: { id: true, email: true, name: true, businessIdentifier: true },
  })
  const byIdent = await prisma.business.findFirst({
    where: { businessIdentifier: '48981' },
    select: { id: true, email: true, name: true, businessIdentifier: true },
  })
  const mc = await prisma.managementCenter.findFirst({
    where: { businessIdentifier: '48981' },
    select: { businessId: true, email: true, name: true, businessIdentifier: true },
  })
  console.log('Business by id 48981:', JSON.stringify(byId, null, 2))
  console.log('Business by businessIdentifier 48981:', JSON.stringify(byIdent, null, 2))
  console.log('ManagementCenter by businessIdentifier 48981:', JSON.stringify(mc, null, 2))
  if (mc?.businessId) {
    const biz = await prisma.business.findUnique({
      where: { id: mc.businessId },
      select: { id: true, email: true, name: true, businessIdentifier: true },
    })
    console.log('Business by MC businessId:', JSON.stringify(biz, null, 2))
  }
  const recent = await prisma.business.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, email: true, name: true, businessIdentifier: true, createdAt: true },
    take: 5,
  })
  console.log('5 most recent businesses:', JSON.stringify(recent, null, 2))
  const some = await prisma.business.findMany({
    where: { businessIdentifier: { not: null } },
    select: { businessIdentifier: true, email: true },
    take: 20,
  })
  console.log('Sample businessIdentifiers in DB:', some.map((b) => b.businessIdentifier).join(', '))
  await prisma.$disconnect()
}
main()
