#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client'
import { formatWorkingHoursSummary } from '../lib/utils/working-hours-display'

const prisma = new PrismaClient()

async function main() {
  const biz = await prisma.business.findFirst({
    where: { telegramBotToken: { not: null }, isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      phone: true,
      address: true,
      location: true,
      workingHours: true,
      slogan: true,
      description: true,
    },
  })
  if (!biz) {
    console.log('No business with bot')
    return
  }
  const addr = (biz.address || biz.location || '').trim()
  const phone = (biz.phone || '').trim()
  const slogan = (biz.slogan || '').trim()
  const desc = (biz.description || '').trim().slice(0, 200)
  const scheduleText = formatWorkingHoursSummary(biz.workingHours)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://xbase.online'
  const bookingUrl = biz.slug ? `${baseUrl}/booking/${biz.slug}` : null

  console.log('Business:', biz.name)
  console.log('Address:', addr || '(empty)')
  console.log('Phone:', phone || '(empty)')
  console.log('Schedule:', scheduleText)
  console.log('Booking URL:', bookingUrl)
  console.log('\n--- Text that would be shown in Telegram ---')
  let text = `🏢 ${biz.name || 'Бізнес'}\n\n`
  if (slogan) text += `${slogan}\n\n`
  if (addr) text += `📍 ${addr}\n`
  if (phone) text += `📞 ${phone}\n`
  text += `🕐 Графік: ${scheduleText}\n`
  if (desc) text += `\n${desc}\n`
  if (bookingUrl) text += `\n🔗 Записатися онлайн: ${bookingUrl}\n`
  console.log(text)
}

main().finally(() => prisma.$disconnect())
