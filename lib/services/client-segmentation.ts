import { prisma } from '@/lib/prisma'

export class ClientSegmentationService {
  static async updateSegments(businessId: string) {
    const clients = await prisma.client.findMany({
      where: { businessId },
      include: { appointments: true }
    })
    
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    
    for (const client of clients) {
      const totalSpent = Number(client.totalSpent) / 100
      const visits = client.appointments.filter(a => a.status === 'Done').length
      const lastVisit = client.lastAppointmentDate ? new Date(client.lastAppointmentDate) : null
      
      let segment = 'Звичайні'
      
      // VIP: витрати >= 5000 грн або візитів >= 10
      if (totalSpent >= 5000 || visits >= 10) {
        segment = 'VIP'
      }
      // Активні: візит за останні 30 днів
      else if (lastVisit && lastVisit >= thirtyDaysAgo) {
        segment = 'Активні'
      }
      // Неактивні: без візитів > 90 днів
      else if (!lastVisit || lastVisit < ninetyDaysAgo) {
        segment = 'Неактивні'
      }
      
      // Оновлюємо теги клієнта
      const tags = JSON.parse(client.tags || '[]')
      if (!tags.includes(segment)) {
        tags.push(segment)
      }
      
      await prisma.client.update({
        where: { id: client.id },
        data: { tags: JSON.stringify(tags) }
      })
    }
  }
}

