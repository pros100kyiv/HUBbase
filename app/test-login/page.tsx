'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { getBusinessData } from '@/lib/business-storage'

export default function TestLoginPage() {
  const [result, setResult] = useState<any>(null)
  const [email, setEmail] = useState('admin@045barbershop.com')
  const [password, setPassword] = useState('password123')

  const testLogin = async () => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()
      setResult({
        status: response.status,
        ok: response.ok,
        data,
      })
    } catch (error: any) {
      setResult({
        error: error.message,
        stack: error.stack,
      })
    }
  }

  const checkLocalStorage = () => {
    const business = getBusinessData()
    setResult({
      localStorage: business ? JSON.parse(business) : null,
    })
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Card className="bg-surface border-primary/20">
          <CardContent className="p-6 space-y-4">
            <h1 className="text-2xl font-bold text-primary mb-4">Тест логіну</h1>
            
            <div>
              <label className="block text-sm mb-2">Email</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            
            <div>
              <label className="block text-sm mb-2">Password</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            
            <div className="flex gap-2">
              <Button onClick={testLogin}>Тест логіну</Button>
              <Button variant="outline" onClick={checkLocalStorage}>Перевірити localStorage</Button>
            </div>

            {result && (
              <div className="mt-4 p-4 bg-background rounded border border-surface">
                <pre className="text-xs text-gray-700 dark:text-gray-300 overflow-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}



