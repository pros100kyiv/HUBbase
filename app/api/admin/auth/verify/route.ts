import { NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/middleware/admin-auth'

export async function GET(request: Request) {
  try {
    const auth = verifyAdminToken(request as any)
    
    if (!auth.valid) {
      return NextResponse.json(
        { valid: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      valid: true,
      email: auth.email,
      role: auth.role,
    })
  } catch (error: any) {
    console.error('Admin verify error:', error)
    return NextResponse.json(
      { valid: false, error: 'Помилка перевірки' },
      { status: 500 }
    )
  }
}

