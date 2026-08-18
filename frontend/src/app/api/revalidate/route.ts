import { revalidatePath, revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

  if (!secret || token !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  revalidatePath('/players')
  revalidatePath('/players/changes')
  revalidateTag('player-pick-one-rating-changes')

  return NextResponse.json({ revalidated: true })
}
