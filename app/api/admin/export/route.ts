import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
import { verifyAdminToken } from '@/lib/middleware/admin-auth'
import { jsonSafe } from '@/lib/utils/json'

export async function GET(request: Request) {
  // Перевірка доступу
  const auth = verifyAdminToken(request as any)
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv'
    const type = searchParams.get('type') || 'businesses'

    const EXPORT_LIMIT = 10_000
    let data: any[] = []

    switch (type) {
      case 'businesses':
        data = await prisma.managementCenter.findMany({ take: EXPORT_LIMIT })
        break
      case 'clients':
        data = await prisma.client.findMany({
          take: EXPORT_LIMIT,
          include: {
            business: { select: { name: true } },
          },
        })
        break
      case 'phones':
        data = await prisma.phoneDirectory.findMany({ take: EXPORT_LIMIT })
        break
      case 'all':
        data = await prisma.managementCenter.findMany({ take: EXPORT_LIMIT })
        break
    }

    if (format === 'csv') {
      const csv = convertToCSV(data)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="export-${type}.csv"`,
        },
      })
    } else if (format === 'json') {
      return NextResponse.json(jsonSafe(data), {
        headers: {
          'Content-Disposition': `attachment; filename="export-${type}.json"`,
        },
      })
    }

    return NextResponse.json({ error: 'Unsupported format' }, { status: 400 })
  } catch (error: any) {
    console.error('Error exporting:', error)
    return NextResponse.json({ error: 'Помилка експорту' }, { status: 500 })
  }
}

function convertToCSV(data: any[]): string {
  if (data.length === 0) return ''
  
  const headers = Object.keys(data[0]).join(',')
  const rows = data.map(row => 
    Object.values(row).map(val => {
      if (val === null || val === undefined) return ''
      const str = String(val)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }).join(',')
  )
  
  return [headers, ...rows].join('\n')
}

