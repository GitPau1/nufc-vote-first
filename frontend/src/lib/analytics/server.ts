type ServerAnalyticsProperties = Record<string, string | number | boolean | null | undefined>

export async function trackServerEvent(
  eventName: string,
  distinctId: string,
  properties: ServerAnalyticsProperties = {},
) {
  const token = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN
  if (!token) return

  try {
    await fetch('https://api.mixpanel.com/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{
        event: eventName,
        properties: {
          token,
          distinct_id: distinctId,
          time: Math.floor(Date.now() / 1000),
          ...properties,
        },
      }]),
    })
  } catch (error) {
    console.error('[analytics] server track failed:', error)
  }
}

