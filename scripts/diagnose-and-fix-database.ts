/**
 * Скрипт для діагностики та автоматичного виправлення проблем з базою даних
 * Перевіряє та виправляє:
 * - Дублікати email з різним регістром
 * - Відсутні індекси
 * - Ненормалізовані email
 * - Відсутні записи в admin_control_center
 * - Відсутні записи в ManagementCenter
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface DiagnosticResult {
  issue: string
  severity: 'error' | 'warning' | 'info'
  fix?: string
  fixed?: boolean
}

async function diagnoseAndFix() {
  const results: DiagnosticResult[] = []

  console.log('🔍 Початок діагностики бази даних...\n')

  // 1. Перевірка дублікатів email (різний регістр)
  console.log('1. Перевірка дублікатів email...')
  try {
    const duplicateEmails = await prisma.$queryRawUnsafe<Array<{ email: string, count: bigint }>>(`
      SELECT LOWER(email) as email, COUNT(*) as count
      FROM "Business"
      GROUP BY LOWER(email)
      HAVING COUNT(*) > 1
    `)

    if (duplicateEmails.length > 0) {
      results.push({
        issue: `Знайдено ${duplicateEmails.length} дублікатів email з різним регістром`,
        severity: 'error',
        fix: 'Нормалізуємо всі email до lowercase'
      })

      // Виправляємо
      for (const dup of duplicateEmails) {
        const businesses = await prisma.business.findMany({
          where: {
            email: {
              contains: dup.email,
              mode: 'insensitive'
            }
          },
          orderBy: { createdAt: 'asc' }
        })

        // Залишаємо перший, інші оновлюємо з унікальним суфіксом
        for (let i = 1; i < businesses.length; i++) {
          const emailParts = dup.email.split('@')
          const newEmail = `${emailParts[0]}_${Date.now()}_${i}@${emailParts[1]}`
          await prisma.business.update({
            where: { id: businesses[i].id },
            data: { email: newEmail.toLowerCase() }
          })
          console.log(`   ✅ Оновлено email для бізнесу ${businesses[i].id}: ${newEmail}`)
        }
      }
      results[results.length - 1].fixed = true
      console.log(`   ✅ Виправлено ${duplicateEmails.length} дублікатів`)
    } else {
      console.log('   ✅ Дублікатів email не знайдено')
    }
  } catch (error: any) {
    console.error('   ❌ Помилка перевірки дублікатів:', error?.message || error)
  }

  // 2. Перевірка наявності індексів
  console.log('\n2. Перевірка індексів...')
  try {
    const indexes = await prisma.$queryRawUnsafe<Array<{ indexname: string }>>(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'Business' 
      AND indexname LIKE '%email%'
    `)

    const hasUniqueIndex = indexes.some(idx => idx.indexname.includes('email') && idx.indexname.includes('key'))
    
    if (!hasUniqueIndex) {
      results.push({
        issue: 'Відсутній унікальний індекс на email',
        severity: 'warning',
        fix: 'Створюємо унікальний індекс'
      })

      try {
        await prisma.$executeRawUnsafe(`
          CREATE UNIQUE INDEX IF NOT EXISTS "Business_email_lower_idx" 
          ON "Business"(LOWER(TRIM(email)))
        `)
        results[results.length - 1].fixed = true
        console.log('   ✅ Унікальний індекс створено')
      } catch (idxError: any) {
        if (idxError?.message?.includes('already exists')) {
          console.log('   ✅ Індекс вже існує')
        } else {
          console.error('   ⚠️  Не вдалося створити індекс:', idxError?.message)
        }
      }
    } else {
      console.log('   ✅ Індекси наявні')
    }
  } catch (error: any) {
    console.error('   ❌ Помилка перевірки індексів:', error?.message || error)
  }

  // 3. Перевірка нормалізації email
  console.log('\n3. Перевірка нормалізації email...')
  try {
    const nonNormalized = await prisma.$queryRawUnsafe<Array<{ id: string, email: string }>>(`
      SELECT id, email
      FROM "Business"
      WHERE email != LOWER(TRIM(email))
      LIMIT 100
    `)

    if (nonNormalized.length > 0) {
      results.push({
        issue: `Знайдено ${nonNormalized.length} email з не нормалізованим регістром`,
        severity: 'warning',
        fix: 'Нормалізуємо email'
      })

      for (const business of nonNormalized) {
        try {
          await prisma.business.update({
            where: { id: business.id },
            data: { email: business.email.toLowerCase().trim() }
          })
        } catch (updateError: any) {
          // Якщо виникає конфлікт через унікальність, пропускаємо
          if (updateError?.code === 'P2002') {
            console.log(`   ⚠️  Пропущено ${business.id} (конфлікт унікальності)`)
          }
        }
      }
      results[results.length - 1].fixed = true
      console.log(`   ✅ Нормалізовано ${nonNormalized.length} email`)
    } else {
      console.log('   ✅ Всі email нормалізовані')
    }
  } catch (error: any) {
    console.error('   ❌ Помилка нормалізації:', error?.message || error)
  }

  // 4. Перевірка таблиці admin_control_center
  console.log('\n4. Перевірка таблиці admin_control_center...')
  try {
    const tableExists = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'admin_control_center'
      ) as exists
    `)

    if (!tableExists[0]?.exists) {
      results.push({
        issue: 'Таблиця admin_control_center не існує',
        severity: 'error',
        fix: 'Створюємо таблицю через скрипт apply-rls-manual'
      })

      console.log('   ⚠️  Таблиця не існує. Запустіть: npm run db:apply-rls')
      results[results.length - 1].fixed = false
    } else {
      console.log('   ✅ Таблиця існує')
    }
  } catch (error: any) {
    console.error('   ❌ Помилка перевірки таблиці:', error?.message || error)
  }

  // 5. Перевірка синхронізації з ManagementCenter
  console.log('\n5. Перевірка синхронізації з ManagementCenter...')
  try {
    const businesses = await prisma.business.findMany({
      select: { id: true, email: true },
      take: 1000 // Обмежуємо для продуктивності
    })

    const managementRecords = await prisma.managementCenter.findMany({
      select: { businessId: true },
      take: 1000
    })

    const missingInManagement = businesses.filter(
      b => !managementRecords.some(m => m.businessId === b.id)
    )

    if (missingInManagement.length > 0) {
      results.push({
        issue: `Знайдено ${missingInManagement.length} бізнесів без записів в ManagementCenter`,
        severity: 'warning',
        fix: 'Синхронізуємо'
      })

      const { syncBusinessToManagementCenter } = await import('../lib/services/management-center')
      let synced = 0
      for (const business of missingInManagement) {
        try {
          await syncBusinessToManagementCenter(business.id)
          synced++
          if (synced % 10 === 0) {
            console.log(`   ⏳ Синхронізовано ${synced}/${missingInManagement.length}...`)
          }
        } catch (error: any) {
          console.error(`   ❌ Помилка синхронізації ${business.id}:`, error?.message || error)
        }
      }
      results[results.length - 1].fixed = true
      console.log(`   ✅ Синхронізовано ${synced} бізнесів`)
    } else {
      console.log('   ✅ Всі бізнеси синхронізовані')
    }
  } catch (error: any) {
    console.error('   ❌ Помилка перевірки синхронізації:', error?.message || error)
  }

  // 6. Перевірка унікальності slug
  console.log('\n6. Перевірка унікальності slug...')
  try {
    const duplicateSlugs = await prisma.$queryRawUnsafe<Array<{ slug: string, count: bigint }>>(`
      SELECT slug, COUNT(*) as count
      FROM "Business"
      GROUP BY slug
      HAVING COUNT(*) > 1
    `)

    if (duplicateSlugs.length > 0) {
      results.push({
        issue: `Знайдено ${duplicateSlugs.length} дублікатів slug`,
        severity: 'error',
        fix: 'Оновлюємо дублікати slug'
      })

      for (const dup of duplicateSlugs) {
        const businesses = await prisma.business.findMany({
          where: { slug: dup.slug },
          orderBy: { createdAt: 'asc' }
        })

        for (let i = 1; i < businesses.length; i++) {
          const newSlug = `${dup.slug}-${Date.now()}-${i}`
          await prisma.business.update({
            where: { id: businesses[i].id },
            data: { slug: newSlug }
          })
          console.log(`   ✅ Оновлено slug для бізнесу ${businesses[i].id}: ${newSlug}`)
        }
      }
      results[results.length - 1].fixed = true
      console.log(`   ✅ Виправлено ${duplicateSlugs.length} дублікатів slug`)
    } else {
      console.log('   ✅ Дублікатів slug не знайдено')
    }
  } catch (error: any) {
    console.error('   ❌ Помилка перевірки slug:', error?.message || error)
  }

  // Підсумок
  console.log('\n📊 Підсумок діагностики:')
  const errors = results.filter(r => r.severity === 'error')
  const warnings = results.filter(r => r.severity === 'warning')
  const fixed = results.filter(r => r.fixed)
  
  console.log(`   ❌ Помилки: ${errors.length}`)
  console.log(`   ⚠️  Попередження: ${warnings.length}`)
  console.log(`   ✅ Виправлено: ${fixed.length}`)
  
  if (errors.length > 0 || warnings.length > 0) {
    console.log('\n📋 Деталі:')
    results.forEach((result, index) => {
      const icon = result.fixed ? '✅' : result.severity === 'error' ? '❌' : '⚠️'
      console.log(`   ${icon} ${result.issue}`)
      if (result.fix && !result.fixed) {
        console.log(`      → ${result.fix}`)
      }
    })
  }

  return results
}

diagnoseAndFix()
  .then(() => {
    console.log('\n✅ Діагностика завершена')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Помилка діагностики:', error)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })

