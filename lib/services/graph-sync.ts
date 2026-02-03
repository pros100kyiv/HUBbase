import { prisma } from '@/lib/prisma'
import { NodeType, RelationshipType } from '@prisma/client'

/**
 * Сервіс для синхронізації даних з графовою структурою Neo4j
 * Створює вузли (nodes) та зв'язки (relationships) для всіх сутностей
 */

/**
 * Створює або оновлює вузол в графі
 */
export async function syncNodeToGraph(
  nodeType: NodeType,
  originalId: string,
  businessId: string,
  properties: any,
  labels?: string[]
) {
  try {
    const node = await prisma.graphNode.upsert({
      where: { originalId },
      update: {
        properties: JSON.stringify(properties),
        labels: labels ? JSON.stringify(labels) : null,
        updatedAt: new Date(),
      },
      create: {
        nodeType,
        originalId,
        businessId,
        properties: JSON.stringify(properties),
        labels: labels ? JSON.stringify(labels) : null,
      },
    })

    return node
  } catch (error) {
    console.error('Error syncing node to graph:', error)
    return null
  }
}

/**
 * Створює зв'язок між вузлами
 */
export async function createRelationship(
  relationshipType: RelationshipType,
  fromNodeId: string,
  toNodeId: string,
  businessId: string,
  properties?: any
) {
  try {
    // Перевіряємо, чи існують вузли
    const fromNode = await prisma.graphNode.findUnique({
      where: { originalId: fromNodeId },
    })
    const toNode = await prisma.graphNode.findUnique({
      where: { originalId: toNodeId },
    })

    if (!fromNode || !toNode) {
      console.warn('Nodes not found for relationship:', { fromNodeId, toNodeId })
      return null
    }

    const relationship = await prisma.graphRelationship.upsert({
      where: {
        fromNodeId_toNodeId_relationshipType: {
          fromNodeId: fromNode.id,
          toNodeId: toNode.id,
          relationshipType,
        },
      },
      update: {
        properties: properties ? JSON.stringify(properties) : null,
        updatedAt: new Date(),
      },
      create: {
        relationshipType,
        fromNodeId: fromNode.id,
        toNodeId: toNode.id,
        businessId,
        properties: properties ? JSON.stringify(properties) : null,
      },
    })

    return relationship
  } catch (error) {
    console.error('Error creating relationship:', error)
    return null
  }
}

/**
 * Синхронізує Business в граф
 */
export async function syncBusinessToGraph(business: any) {
  try {
    // Створюємо вузол Business
    await syncNodeToGraph(
      NodeType.BUSINESS,
      business.id,
      business.id,
      {
        name: business.name,
        email: business.email,
        phone: business.phone,
        niche: business.niche,
        businessIdentifier: business.businessIdentifier,
      },
      ['Business', business.niche || 'OTHER']
    )
  } catch (error) {
    console.error('Error syncing business to graph:', error)
  }
}

/**
 * Синхронізує Client в граф
 */
export async function syncClientToGraph(client: any) {
  try {
    // Створюємо вузол Client
    await syncNodeToGraph(
      NodeType.CLIENT,
      client.id,
      client.businessId,
      {
        name: client.name,
        phone: client.phone,
        email: client.email,
        totalAppointments: client.totalAppointments,
        totalSpent: client.totalSpent,
      },
      ['Client']
    )

    // Створюємо зв'язок Business OWNS Client
    await createRelationship(
      RelationshipType.OWNS,
      client.businessId,
      client.id,
      client.businessId
    )
  } catch (error) {
    console.error('Error syncing client to graph:', error)
  }
}

/**
 * Синхронізує Master в граф
 */
export async function syncMasterToGraph(master: any) {
  try {
    // Створюємо вузол Master
    await syncNodeToGraph(
      NodeType.MASTER,
      master.id,
      master.businessId,
      {
        name: master.name,
        rating: master.rating,
        isActive: master.isActive,
      },
      ['Master']
    )

    // Створюємо зв'язок Business OWNS Master
    await createRelationship(
      RelationshipType.OWNS,
      master.businessId,
      master.id,
      master.businessId
    )
  } catch (error) {
    console.error('Error syncing master to graph:', error)
  }
}

/**
 * Синхронізує Service в граф
 */
export async function syncServiceToGraph(service: any) {
  try {
    // Створюємо вузол Service
    await syncNodeToGraph(
      NodeType.SERVICE,
      service.id,
      service.businessId,
      {
        name: service.name,
        price: service.price,
        duration: service.duration,
        category: service.category,
      },
      ['Service', service.category || 'Uncategorized']
    )

    // Створюємо зв'язок Business OWNS Service
    await createRelationship(
      RelationshipType.OWNS,
      service.businessId,
      service.id,
      service.businessId
    )
  } catch (error) {
    console.error('Error syncing service to graph:', error)
  }
}

/**
 * Синхронізує Appointment в граф
 */
export async function syncAppointmentToGraph(appointment: any) {
  try {
    // Створюємо вузол Appointment
    await syncNodeToGraph(
      NodeType.APPOINTMENT,
      appointment.id,
      appointment.businessId,
      {
        clientName: appointment.clientName,
        clientPhone: appointment.clientPhone,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        status: appointment.status,
      },
      ['Appointment', appointment.status]
    )

    // Створюємо зв'язки
    // Business HAS Appointment
    await createRelationship(
      RelationshipType.HAS,
      appointment.businessId,
      appointment.id,
      appointment.businessId
    )

    // Appointment BOOKED_BY Client (якщо є clientId)
    if (appointment.clientId) {
      await createRelationship(
        RelationshipType.BOOKED_BY,
        appointment.id,
        appointment.clientId,
        appointment.businessId
      )
    }

    // Appointment PERFORMED_BY Master
    if (appointment.masterId) {
      await createRelationship(
        RelationshipType.PERFORMED_BY,
        appointment.id,
        appointment.masterId,
        appointment.businessId
      )
    }
  } catch (error) {
    console.error('Error syncing appointment to graph:', error)
  }
}

