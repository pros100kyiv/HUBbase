import { prisma } from '@/lib/prisma'

/**
 * Створює або оновлює клієнта для бізнесу
 * Використовується при створенні записів для автоматичного структурування даних
 */
export async function upsertClient(
  businessId: string,
  clientData: {
    name: string
    phone: string
    email?: string | null
  }
) {
  try {
    // Нормалізуємо телефон (видаляємо пробіли, дефіси тощо)
    const normalizedPhone = clientData.phone.replace(/\s+/g, '').trim()

    // Шукаємо існуючого клієнта
    const existingClient = await prisma.client.findUnique({
      where: {
        businessId_phone: {
          businessId,
          phone: normalizedPhone,
        },
      },
    })

    if (existingClient) {
      // Оновлюємо існуючого клієнта
      return await prisma.client.update({
        where: { id: existingClient.id },
        data: {
          name: clientData.name.trim(),
          email: clientData.email?.trim() || null,
          lastAppointmentDate: new Date(),
          isActive: true,
        },
      })
    } else {
      // Створюємо нового клієнта
      return await prisma.client.create({
        data: {
          businessId,
          name: clientData.name.trim(),
          phone: normalizedPhone,
          email: clientData.email?.trim() || null,
          firstAppointmentDate: new Date(),
          lastAppointmentDate: new Date(),
          isActive: true,
          totalAppointments: 0,
          totalSpent: BigInt(0),
          averageOrderValue: BigInt(0),
          lifetimeValue: BigInt(0),
          retentionRate: 0,
        },
      })
    }
  } catch (error) {
    console.error('Error upserting client:', error)
    // Не викидаємо помилку, щоб не зламати створення запису
    return null
  }
}

/**
 * Оновлює метрики клієнта після завершення запису
 */
export async function updateClientMetrics(
  clientId: string,
  appointmentData: {
    price: number // в копійках
    completed: boolean
  }
) {
  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    })

    if (!client) return

    const price = BigInt(appointmentData.price)
    const newTotalSpent = client.totalSpent + price
    const newTotalAppointments = appointmentData.completed
      ? client.totalAppointments + 1
      : client.totalAppointments
    const newAverageOrderValue =
      newTotalAppointments > 0
        ? newTotalSpent / BigInt(newTotalAppointments)
        : BigInt(0)

    await prisma.client.update({
      where: { id: clientId },
      data: {
        totalSpent: newTotalSpent,
        totalAppointments: newTotalAppointments,
        averageOrderValue: newAverageOrderValue,
        lifetimeValue: newTotalSpent, // LTV = загальна сума витрат
        lastAppointmentDate: new Date(),
      },
    })
  } catch (error) {
    console.error('Error updating client metrics:', error)
  }
}

