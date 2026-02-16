export const dynamic = 'force-dynamic'
export const revalidate = 0

import ManageAppointmentClient from './ManageAppointmentClient'

export default async function ManageAppointmentPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>
}) {
  const p = await params
  const slug = String(p?.slug ?? '').trim()
  const token = String(p?.token ?? '').trim()

  return <ManageAppointmentClient slug={slug} token={token} />
}

