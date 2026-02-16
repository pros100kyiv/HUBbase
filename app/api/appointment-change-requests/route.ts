import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const url = new URL(request.url)
  const businessId = url.searchParams.get('businessId')?.trim() || ''
  const status = (url.searchParams.get('status')?.trim().toUpperCase() || 'PENDING') as any

  if (!businessId) return NextResponse.json({ error: 'businessId is required' }, { status: 400 })

  const allowed = new Set(['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'ALL'])
  const statusFilter = allowed.has(status) ? status : 'PENDING'

  const rows = await prisma.appointmentChangeRequest.findMany({
    where: {
      businessId,
      ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      type: true,
      status: true,
      requestedStartTime: true,
      requestedEndTime: true,
      clientNote: true,
      createdAt: true,
      appointment: {
        select: {
          id: true,
          clientName: true,
          startTime: true,
          endTime: true,
          status: true,
          master: { select: { id: true, name: true } },
        },
      },
    },
  })

  return NextResponse.json(rows)
}

