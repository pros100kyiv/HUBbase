#!/usr/bin/env npx tsx
/**
 * Sets LM Studio config in SystemSetting for the AI chat.
 * Run: npx tsx scripts/setup-lm-studio.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const baseUrl = process.env.LM_STUDIO_URL || 'http://127.0.0.1:1234/v1'
  const model = process.env.LM_STUDIO_MODEL || ''

  await prisma.systemSetting.upsert({
    where: { key: 'ai_provider' },
    create: { key: 'ai_provider', value: 'lm_studio' },
    update: { value: 'lm_studio' },
  })
  await prisma.systemSetting.upsert({
    where: { key: 'lm_studio_base_url' },
    create: { key: 'lm_studio_base_url', value: baseUrl },
    update: { value: baseUrl },
  })
  await prisma.systemSetting.upsert({
    where: { key: 'lm_studio_model' },
    create: { key: 'lm_studio_model', value: model },
    update: { value: model },
  })

  console.log('LM Studio configured:')
  console.log('  ai_provider:', 'lm_studio')
  console.log('  lm_studio_base_url:', baseUrl)
  console.log('  lm_studio_model:', model || '(auto)')
  console.log('\nStart LM Studio, load a model, then the AI chat will work.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
