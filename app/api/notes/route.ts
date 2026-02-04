import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const date = searchParams.get('date')

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    const where: any = { businessId }
    
    if (date) {
      const dateObj = new Date(date)
      const startOfDay = new Date(dateObj.setHours(0, 0, 0, 0))
      const endOfDay = new Date(dateObj.setHours(23, 59, 59, 999))
      where.date = {
        gte: startOfDay,
        lte: endOfDay,
      }
    }

    const notes = await prisma.note.findMany({
      where,
      orderBy: [
        { order: 'asc' },
        { createdAt: 'asc' },
      ],
    })

    return NextResponse.json(notes)
  } catch (error) {
    console.error('Error fetching notes:', error)
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, text, date, order } = body

    if (!businessId || !text || !date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const dateObj = new Date(date)
    dateObj.setHours(0, 0, 0, 0)

    const note = await prisma.note.create({
      data: {
        businessId,
        text,
        date: dateObj,
        order: order || 0,
      },
    })

    return NextResponse.json(note)
  } catch (error) {
    console.error('Error creating note:', error)
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, text, completed, date, order } = body

    if (!id) {
      return NextResponse.json({ error: 'Note id is required' }, { status: 400 })
    }

    const updateData: any = {}
    if (text !== undefined) updateData.text = text
    if (completed !== undefined) updateData.completed = completed
    if (date !== undefined) {
      const dateObj = new Date(date)
      dateObj.setHours(0, 0, 0, 0)
      updateData.date = dateObj
    }
    if (order !== undefined) updateData.order = order

    const note = await prisma.note.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(note)
  } catch (error) {
    console.error('Error updating note:', error)
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Note id is required' }, { status: 400 })
    }

    await prisma.note.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting note:', error)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }
}

