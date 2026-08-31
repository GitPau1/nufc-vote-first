'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/primitives/button'
import { POSITIONS, POSITION_LABEL } from '@/lib/predictions/candidates'
import { saveFixtureRatings, type SaveRatingsResult } from '@/lib/actions/fixture-ratings'
import type { PickCandidates } from '@/lib/queries/squads'

type SaveError = Extract<SaveRatingsResult, { error: string }>['error']

const ERROR_MESSAGE: Record<SaveError, string> = {
  mock_unsupported: '목 모드에서는 평점을 저장할 수 없어요(실제 Supabase 연결이 필요해요)',
  invalid_rating: '평점은 0~10 사이로 입력해주세요',
  empty: '입력한 평점이 없어요',
  forbidden: '관리자 권한이 없어요',
  failed: '저장에 실패했어요. 잠시 후 다시 시도해주세요.',
}

export function AdminRatingsForm({
  fixtures,
  selectedFixtureId,
  candidates,
  ratings,
}: {
  fixtures: { id: string; label: string }[]
  selectedFixtureId: string
  candidates: PickCandidates
  /** player_id → 이미 저장된 평점 */
  ratings: Record<string, number>
}) {
  const router = useRouter()
  const [saving, startTransition] = useTransition()
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  // 저장된 값을 초기값으로 깔고, 빈 칸은 "미집계"로 남긴다.
  const [inputs, setInputs] = useState<Record<string, string>>(() => toInputs(ratings))

  // 다른 경기를 고르면 서버가 그 경기 평점을 다시 내려준다 — 입력칸도 거기에 맞춰 갈아끼운다.
  useEffect(() => {
    setInputs(toInputs(ratings))
    setMessage(null)
  }, [selectedFixtureId, ratings])

  function handleSave() {
    const entries = Object.entries(inputs)
      .filter(([, value]) => value.trim() !== '')
      .map(([playerId, value]) => ({ playerId: Number(playerId), rating: Number(value) }))

    startTransition(async () => {
      const result = await saveFixtureRatings(selectedFixtureId, entries)
      if ('success' in result) {
        setMessage({ tone: 'ok', text: `${result.saved}명 평점을 저장했어요` })
        router.refresh()
        return
      }
      setMessage({ tone: 'error', text: ERROR_MESSAGE[result.error] })
    })
  }

  return (
    <div>
      <label className="block text-label-2 font-medium text-neutral-muted" htmlFor="fixture">
        경기
      </label>
      <select
        id="fixture"
        value={selectedFixtureId}
        onChange={event => router.push(`/admin/ratings?fixture=${event.target.value}`)}
        className="mt-1.5 h-11 w-full rounded-md border border-neutral-weak bg-surface px-3 text-label-1-normal"
      >
        {fixtures.map(fixture => (
          <option key={fixture.id} value={fixture.id}>
            {fixture.label}
          </option>
        ))}
      </select>

      <div className="mt-6 flex flex-col gap-5">
        {POSITIONS.map(position => (
          <div key={position}>
            <p className="mb-2 text-caption-1 font-medium text-neutral">{POSITION_LABEL[position]}</p>
            <div className="overflow-hidden rounded-lg border border-neutral-weak">
              {candidates[position].map((candidate, i) => (
                <div
                  key={candidate.id}
                  className={`flex items-center gap-3 bg-surface p-3 ${
                    i < candidates[position].length - 1 ? 'border-b border-neutral-weak' : ''
                  }`}
                >
                  <span className="w-7 shrink-0 text-center text-label-2 font-medium text-neutral-muted">
                    {candidate.squadNumber ?? '-'}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-label-1-normal font-medium text-neutral">
                    {candidate.name}
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={10}
                    step={0.1}
                    placeholder="미집계"
                    aria-label={`${candidate.name} 평점`}
                    value={inputs[candidate.id] ?? ''}
                    onChange={event =>
                      setInputs(prev => ({ ...prev, [candidate.id]: event.target.value }))
                    }
                    className="h-10 w-20 rounded-md border border-neutral-weak bg-surface px-2 text-center text-label-1-normal"
                  />
                </div>
              ))}
              {candidates[position].length === 0 && (
                <p className="bg-surface p-3 text-label-2 text-neutral-muted">스쿼드 데이터가 없어요</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {message && (
        <p
          role="status"
          className={`mt-4 text-center text-label-2 font-medium ${
            message.tone === 'ok' ? 'text-positive' : 'text-critical'
          }`}
        >
          {message.text}
        </p>
      )}

      <Button className="mt-5 w-full" disabled={saving} onClick={handleSave}>
        {saving ? '저장 중…' : '평점 저장'}
      </Button>
    </div>
  )
}

function toInputs(ratings: Record<string, number>): Record<string, string> {
  return Object.fromEntries(Object.entries(ratings).map(([playerId, rating]) => [playerId, String(rating)]))
}
