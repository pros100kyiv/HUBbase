import { prisma } from '@/lib/prisma'

export interface BusinessModuleConfig {
  moduleKey: string
  moduleName: string
  description?: string
  icon?: string
  category?: string
  defaultSettings?: any
  requiredPermissions?: string[]
}

/**
 * Перевіряє чи модуль активований для бізнесу
 */
export async function isModuleEnabled(businessId: string, moduleKey: string): Promise<boolean> {
  const moduleRow = await prisma.businessModule.findUnique({
    where: {
      businessId_moduleKey: {
        businessId,
        moduleKey,
      },
    },
    select: { isEnabled: true },
  })

  return moduleRow?.isEnabled ?? false
}

/**
 * Отримує налаштування модуля
 */
export async function getModuleSettings(businessId: string, moduleKey: string): Promise<any> {
  const moduleRow = await prisma.businessModule.findUnique({
    where: {
      businessId_moduleKey: {
        businessId,
        moduleKey,
      },
    },
    select: { settings: true },
  })

  if (!moduleRow?.settings) return null

  try {
    return JSON.parse(moduleRow.settings)
  } catch {
    return null
  }
}

/**
 * Активація модуля для бізнесу
 */
export async function activateModule(
  businessId: string,
  config: BusinessModuleConfig
): Promise<void> {
  await prisma.businessModule.upsert({
    where: {
      businessId_moduleKey: {
        businessId,
        moduleKey: config.moduleKey,
      },
    },
    update: {
      isEnabled: true,
      activatedAt: new Date(),
    },
    create: {
      businessId,
      moduleKey: config.moduleKey,
      moduleName: config.moduleName,
      isEnabled: true,
      settings: config.defaultSettings ? JSON.stringify(config.defaultSettings) : null,
      metadata: JSON.stringify({
        description: config.description,
        icon: config.icon,
        category: config.category,
        activatedAt: new Date().toISOString(),
      }),
      activatedAt: new Date(),
    },
  })
}

/**
 * Деактивація модуля
 */
export async function deactivateModule(businessId: string, moduleKey: string): Promise<void> {
  await prisma.businessModule.update({
    where: {
      businessId_moduleKey: {
        businessId,
        moduleKey,
      },
    },
    data: {
      isEnabled: false,
    },
  })
}

/**
 * Отримує всі активні модулі бізнесу
 */
export async function getActiveModules(businessId: string) {
  return prisma.businessModule.findMany({
    where: {
      businessId,
      isEnabled: true,
    },
    orderBy: { activatedAt: 'desc' },
  })
}

