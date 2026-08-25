'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/primitives/button'
import { syncFixtureData, type SyncResult } from '@/lib/actions/sync-fixtures'
import { cn } from '@/lib/utils'

type SyncError = Extract<SyncResult, { error: string }>['error']

const ERROR_MESSAGE: Record<SyncError, string> = {
  mock_unsupported: '목 모드에서는 동기화할 수 없어요(실제 Supabase 연결이 필요해요)',
  forbidden: '관리자 권한이 없어요',
  config: 'Supabase 환경변수가 설정되지 않았어요',
  failed: '동기화에 실패했어요. 잠시 후 다시 시도해주세요.',
}

/**
 * 경기 결과·평점 즉시 동기화 버튼. 평상시엔 크론이 하루 한 번 같은 일을 하므로 예외 처리용이다.
 * 평점은 한 번에 5경기씩 처리되므로 남은 경기가 있으면 그 수를 알려준다.
 */
export function AdminSyncButton() {
  const router = useRouter()
  const [syncing, startTransition] = useTransition()
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  function handleSync() {
    setMessage(null)
    startTransition(async () => {
      const result = await syncFixtureData()

      if ('success' in result) {
        const remaining =
          result.remaining > 0 ? ` · 남은 경기 ${result.remaining}개(한 번 더 눌러주세요)` : ''
        setMessage({
          tone: 'ok',
          text: `경기 ${result.fixtures}건, 평점 ${result.ratings}행 동기화했어요${remaining}`,
        })
        router.refresh()
        return
      }

      setMessage({
        tone: 'error',
        text: result.detail
          ? `${ERROR_MESSAGE[result.error]} (${result.detail})`
          : ERROR_MESSAGE[result.error],
      })
    })
  }

  return (
    <div>
      <Button
        variant="outline"
        size="lg" className="w-full justify-start"
        onClick={handleSync}
        disabled={syncing}
      >
        <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
        {syncing ? '동기화 중…' : '경기 결과·평점 동기화'}
      </Button>

      {message && (
        <p
          className={cn(
            'mt-2 text-label-2',
            message.tone === 'ok' ? 'text-positive' : 'text-critical',
          )}
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
