'use client'

import { useState, useTransition } from 'react'
import { useLoadingRouter } from '@/components/primitives/navigation-loading'
import { Plus, Users, X } from 'lucide-react'
import { createUserPoll } from '@/lib/actions/polls'
import { uploadPollImage } from '@/lib/actions/images'
import { trackEvent } from '@/lib/analytics/mixpanel'
import { CroppedImageInput } from '@/components/composition/common/CroppedImageInput'
import type { PollFormPlayer } from '@/lib/queries/polls'
import { Button } from '@/components/primitives/button'
import { Modal } from '@/components/primitives/modal/Modal'
import { PollPickerContent, getPlayerMeta, type PlayerPickMode } from '@/components/primitives/modal/contents/PollPicker'

type PollFormat = 'poll' | 'overall_rating'
type UnifiedOption = { id: string; label: string; description: string; imageUrl: string; playerId: string | null }

const POLL_FORMATS: Array<{ format: PollFormat; label: string; description: string }> = [
  { format: 'poll', label: '일반 투표', description: '선택지를 만들어 팬들의 의견을 모읍니다.' },
  { format: 'overall_rating', label: '전체 평점', description: '여러 선수에게 각각 등급과 코멘트를 받습니다.' },
]

export function UserPollCreateForm({ players }: { players: PollFormPlayer[] }) {
  const router = useLoadingRouter()
  const [format, setFormat] = useState<PollFormat>(POLL_FORMATS[0].format)
  const [options, setOptions] = useState<UnifiedOption[]>([
    { id: crypto.randomUUID(), label: '', description: '', imageUrl: '', playerId: null },
    { id: crypto.randomUUID(), label: '', description: '', imageUrl: '', playerId: null },
  ])
  const [showSubjectPlayer, setShowSubjectPlayer] = useState(false)
  const [selectedSubjectPlayerId, setSelectedSubjectPlayerId] = useState<string | null>(null)
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([])
  const [editingOptionIndex, setEditingOptionIndex] = useState<number | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerMode, setPickerMode] = useState<PlayerPickMode>('single')
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const selectedSubjectPlayer = players.find(player => player.id === selectedSubjectPlayerId) ?? null
  const selectedPlayers = selectedPlayerIds
    .map(id => players.find(player => player.id === id))
    .filter((player): player is PollFormPlayer => Boolean(player))

  // 선택지 선수 픽커를 열 때만 적용 — 다른 선택지가 이미 연결한 선수는 목록에서 빼서
  // 옵션 간 중복 연결을 막는다(대상 선수는 다른 슬롯이라 제외 대상이 아니다).
  const otherOptionPlayerIds = editingOptionIndex !== null
    ? options
        .filter((_, index) => index !== editingOptionIndex)
        .map(option => option.playerId)
        .filter((id): id is string => Boolean(id))
    : []
  const pickerPlayers = otherOptionPlayerIds.length > 0
    ? players.filter(player => !otherOptionPlayerIds.includes(player.id))
    : players

  function updateOption(index: number, patch: Partial<UnifiedOption>) {
    setOptions(prev => prev.map((option, itemIndex) => itemIndex === index ? { ...option, ...patch } : option))
  }

  function addOption() {
    setOptions(prev => [...prev, { id: crypto.randomUUID(), label: '', description: '', imageUrl: '', playerId: null }])
  }

  function removeOption(index: number) {
    setOptions(prev => prev.filter((_, itemIndex) => itemIndex !== index))
  }

  function openPlayerPicker(mode: PlayerPickMode, optionIndex?: number) {
    setPickerMode(mode)
    setEditingOptionIndex(optionIndex ?? null)
    setPickerOpen(true)
  }

  function togglePlayer(playerId: string) {
    if (editingOptionIndex !== null) {
      updateOption(editingOptionIndex, { playerId, imageUrl: '' })
      setPickerOpen(false)
      setEditingOptionIndex(null)
      return
    }

    if (pickerMode === 'single') {
      setSelectedSubjectPlayerId(playerId)
      setPickerOpen(false)
      return
    }

    setSelectedPlayerIds(prev => (
      prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId]
    ))
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMessage(null)
    const fd = new FormData(e.currentTarget)
    trackEvent('create_poll_clicked', {
      source_page: 'create',
      poll_type: format,
    })

    if (format === 'overall_rating') {
      const targetPlayerIds = selectedPlayerIds

      if (targetPlayerIds.length < 2) {
        setMessage('선수를 최소 2명 선택해주세요.')
        return
      }
      fd.set('options', JSON.stringify(targetPlayerIds.map(id => {
        const player = players.find(item => item.id === id)
        return { label: player?.name ?? id, player_id: id }
      })))
      fd.delete('player_id')
    } else {
      const cleaned = options
        .map((option, index) => ({ ...option, label: option.label.trim(), imageField: `option_image_${index}` }))
        .filter(option => option.label)
      if (cleaned.length < 2) {
        setMessage('선택지를 최소 2개 입력해주세요.')
        return
      }
      if (showSubjectPlayer && !selectedSubjectPlayerId) {
        setMessage('대상 선수를 선택해주세요.')
        return
      }

      fd.set('options', JSON.stringify(cleaned.map(option => ({
        label: option.label,
        description: option.description.trim() || null,
        image_url: option.playerId ? null : (option.imageUrl.trim() || null),
        player_id: option.playerId,
        imageField: option.playerId ? null : option.imageField,
      }))))
      if (showSubjectPlayer && selectedSubjectPlayerId) fd.set('player_id', selectedSubjectPlayerId)
      else fd.delete('player_id')
    }

    fd.set('type', format)

    startTransition(async () => {
      const thumbnailFile = fd.get('thumbnail_image_file') as File | null
      fd.delete('thumbnail_image_file')
      if (!String(fd.get('thumbnail_url') ?? '').trim() && thumbnailFile && thumbnailFile.size > 0) {
        const thumbnailForm = new FormData()
        thumbnailForm.set('file', thumbnailFile)
        thumbnailForm.set('folder', 'poll-thumbnails')
        thumbnailForm.set('preset', 'poll-thumbnail')
        const uploadResult = await uploadPollImage(thumbnailForm)
        if (uploadResult.error || !uploadResult.url) {
          setMessage(uploadResult.error ?? '대표 이미지 업로드에 실패했습니다.')
          return
        }
        fd.set('thumbnail_url', uploadResult.url)
      }

      if (format === 'poll') {
        const parsedOptions = JSON.parse(String(fd.get('options') ?? '[]')) as Array<{
          label: string
          description: string | null
          image_url: string | null
          player_id: string | null
          imageField: string | null
        }>
        const uploadedOptions = []
        for (const option of parsedOptions) {
          const imageFile = option.imageField ? (fd.get(option.imageField) as File | null) : null
          if (option.imageField) fd.delete(option.imageField)
          if (!option.image_url && imageFile && imageFile.size > 0) {
            const imageForm = new FormData()
            imageForm.set('file', imageFile)
            imageForm.set('folder', 'poll-options')
            imageForm.set('preset', 'poll-option')
            const uploadResult = await uploadPollImage(imageForm)
            if (uploadResult.error || !uploadResult.url) {
              setMessage(uploadResult.error ?? '선택지 이미지 업로드에 실패했습니다.')
              return
            }
            uploadedOptions.push({
              label: option.label,
              description: option.description,
              image_url: uploadResult.url,
              player_id: option.player_id,
            })
          } else {
            uploadedOptions.push({
              label: option.label,
              description: option.description,
              image_url: option.image_url,
              player_id: option.player_id,
            })
          }
        }
        fd.set('options', JSON.stringify(uploadedOptions))
      }

      const result = await createUserPoll(fd)
      if (result.error) {
        setMessage(result.error)
        return
      }
      const optionCount = JSON.parse(String(fd.get('options') ?? '[]')).length as number
      trackEvent('poll_published', {
        source_page: 'create',
        poll_id: result.pollId ?? null,
        poll_type: format,
        option_count: optionCount,
        has_thumbnail: Boolean(String(fd.get('thumbnail_url') ?? '').trim()),
        creator_type: 'user',
      })
      router.push(result.pollId ? `/polls/${result.pollId}` : '/polls')
      router.refresh()
    })
  }

  return (
    <>
      <form onSubmit={submit} className="space-y-3">
        <section className="rounded-lg border border-neutral-weak bg-surface p-4 shadow-g200">
          <p className="text-label-1-normal font-medium text-neutral">투표 형식</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {POLL_FORMATS.map(item => {
              const selected = item.format === format
              return (
                <button
                  key={item.format}
                  type="button"
                  onClick={() => setFormat(item.format)}
                  className={`rounded-sm border px-3 py-3 text-left transition-opacity hover:opacity-70 ${selected ? 'border-brand-solid bg-brand-weak' : 'border-neutral-weak bg-surface'}`}
                >
                  <span className={`block text-label-2 font-medium ${selected ? 'text-brand' : 'text-neutral'}`}>{item.label}</span>
                  <span className="mt-1 block text-caption-1 text-neutral-muted">{item.description}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-neutral-weak bg-surface p-4 shadow-g200">
          <p className="text-label-1-normal font-medium text-neutral">기본 정보</p>
          <input name="title" required className="input-field" placeholder="투표 제목" />
          <textarea name="description" className="input-field min-h-[72px] resize-none py-2" placeholder="설명(선택)" />
          <input name="thumbnail_url" className="input-field" placeholder="대표 이미지 URL(선택)" />
          <CroppedImageInput
            name="thumbnail_image_file"
            label="대표 이미지 크롭"
            outputWidth={1200}
            outputHeight={400}
            previewClassName="aspect-[3/1]"
            fileName="poll-thumbnail.webp"
          />
          <input name="closes_at" type="datetime-local" required className="input-field" aria-label="투표 종료일" />
        </section>

        {format === 'poll' ? (
          <>
            <section className="rounded-lg border border-neutral-weak bg-surface p-4 shadow-g200">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-label-1-normal font-medium text-neutral">특정 선수 한 명에 대한 투표인가요?</p>
                  <p className="mt-0.5 text-caption-1 text-neutral-muted">선택 — 켜면 표지에 대표 선수 카드가 함께 표시돼요.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showSubjectPlayer}
                  onClick={() => {
                    setShowSubjectPlayer(prev => !prev)
                    if (showSubjectPlayer) setSelectedSubjectPlayerId(null)
                  }}
                  className={`inline-flex h-8 shrink-0 items-center rounded-sm px-2.5 text-caption-1 font-medium transition-opacity hover:opacity-70 ${showSubjectPlayer ? 'bg-brand-weak text-brand' : 'bg-disabled text-neutral'}`}
                >
                  {showSubjectPlayer ? '켜짐' : '꺼짐'}
                </button>
              </div>
              {showSubjectPlayer && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-label-2 font-medium text-neutral-muted">대상 선수</p>
                    <button type="button" onClick={() => openPlayerPicker('single')} className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-disabled px-2.5 text-caption-1 font-medium text-neutral">
                      <Users className="h-3.5 w-3.5" /> 선택
                    </button>
                  </div>
                  {selectedSubjectPlayer ? <PlayerSummary player={selectedSubjectPlayer} /> : <EmptySelection label="선수를 선택해주세요." />}
                </div>
              )}
            </section>

            <section className="space-y-3 rounded-lg border border-neutral-weak bg-surface p-4 shadow-g200">
              <p className="text-label-1-normal font-medium text-neutral">선택지</p>
              <div className="space-y-1.5">
                {options.map((option, index) => {
                  const connectedPlayer = option.playerId ? players.find(player => player.id === option.playerId) ?? null : null
                  return (
                    <div key={option.id} className="grid grid-cols-[1fr_32px] gap-1.5 rounded-md border border-neutral-weak p-2">
                      <div className="space-y-1.5">
                        <input
                          value={option.label}
                          onChange={event => updateOption(index, { label: event.target.value })}
                          className="input-field"
                          placeholder={`선택지 ${index + 1}`}
                        />
                        <textarea
                          value={option.description}
                          onChange={event => updateOption(index, { description: event.target.value })}
                          className="input-field min-h-[72px] resize-none py-2"
                          placeholder="세부 설명(선택)"
                        />
                        {connectedPlayer ? (
                          <div className="flex items-center justify-between gap-2 rounded-md border border-neutral-weak bg-disabled px-3 py-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-pill bg-surface text-caption-2 font-medium text-brand">
                                {connectedPlayer.photo_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={connectedPlayer.photo_url} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  connectedPlayer.name.slice(0, 2)
                                )}
                              </div>
                              <p className="truncate text-caption-1 font-medium text-neutral">{connectedPlayer.name}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <button type="button" onClick={() => openPlayerPicker('single', index)} className="text-caption-2 font-medium text-brand">변경</button>
                              <button type="button" onClick={() => updateOption(index, { playerId: null })} className="text-caption-2 font-medium text-neutral-muted">연결 해제</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button type="button" onClick={() => openPlayerPicker('single', index)} className="inline-flex items-center gap-1 text-caption-1 font-medium text-brand">
                              <Users className="h-3.5 w-3.5" /> 선수 연결
                            </button>
                            <input
                              value={option.imageUrl}
                              onChange={event => updateOption(index, { imageUrl: event.target.value })}
                              className="input-field"
                              placeholder="이미지 URL"
                            />
                            <CroppedImageInput
                              name={`option_image_${index}`}
                              label="선택지 카드 이미지 크롭"
                              outputWidth={1000}
                              outputHeight={1300}
                              previewClassName="aspect-[10/13]"
                              fileName="poll-option.webp"
                            />
                          </>
                        )}
                      </div>
                      <button type="button" onClick={() => removeOption(index)} className="rounded-sm border border-neutral-weak text-neutral-muted" aria-label="선택지 삭제">
                        <X className="mx-auto h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
              {options.length < 8 && (
                <button type="button" onClick={addOption} className="inline-flex items-center gap-1 text-caption-1 font-medium text-brand">
                  <Plus className="h-3.5 w-3.5" /> 선택지 추가
                </button>
              )}
            </section>
          </>
        ) : (
          <section className="space-y-3 rounded-lg border border-neutral-weak bg-surface p-4 shadow-g200">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-label-1-normal font-medium text-neutral">평가 대상 선수</p>
                <p className="mt-0.5 text-caption-1 text-neutral-muted">{selectedPlayers.length}명 선택됨</p>
              </div>
              <button type="button" onClick={() => openPlayerPicker('multiple')} className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-disabled px-2.5 text-caption-1 font-medium text-neutral">
                <Users className="h-3.5 w-3.5" /> 선택
              </button>
            </div>
            {selectedPlayers.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {selectedPlayers.map(player => (
                  <span key={player.id} className="rounded-pill bg-disabled px-2 py-1 text-caption-2 font-medium text-neutral">
                    {player.name}
                  </span>
                ))}
              </div>
            ) : (
              <EmptySelection label="선수들을 선택해주세요." />
            )}
          </section>
        )}

        {message && <p className="rounded-sm bg-critical-weak px-3 py-2 text-caption-1 font-medium text-critical">{message}</p>}
        <Button type="submit" disabled={isPending} size="lg" className="w-full">
          {isPending ? '생성 중...' : '투표 생성'}
        </Button>
      </form>

      {/* 좌우 패딩은 0이어야 한다 — 검색블록의 border-b와 목록 행이 시트 폭 끝까지 닿는 구조다.
          다만 상단 패딩은 껍데기의 드래그 핸들이 쓰는 여백이라 다른 시트와 같은 pt-5로 남긴다
          (`p-0`이면 핸들이 시트 최상단에 붙는다). 하단은 콘텐츠의 완료 버튼 블록이 직접 채운다. */}
      <Modal
        open={pickerOpen}
        onOpenChange={open => {
          setPickerOpen(open)
          if (!open) setEditingOptionIndex(null)
        }}
        className="flex h-[82vh] max-h-[82vh] flex-col overflow-hidden px-0 pb-0 pt-5"
      >
        <PollPickerContent
          mode={pickerMode}
          players={pickerPlayers}
          selectedIds={
            editingOptionIndex !== null
              ? (options[editingOptionIndex]?.playerId ? [options[editingOptionIndex].playerId as string] : [])
              : pickerMode === 'single'
                ? (selectedSubjectPlayerId ? [selectedSubjectPlayerId] : [])
                : selectedPlayerIds
          }
          onToggle={togglePlayer}
          onDone={() => setPickerOpen(false)}
        />
      </Modal>
    </>
  )
}

function EmptySelection({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-neutral-weak px-3 py-4 text-center text-caption-1 font-medium text-neutral-muted">
      {label}
    </div>
  )
}

function PlayerSummary({ player }: { player: PollFormPlayer }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-neutral-weak bg-disabled px-3 py-2">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-pill bg-surface text-caption-1 font-medium text-brand">
        {player.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={player.photo_url} alt="" className="h-full w-full object-cover" />
        ) : (
          player.name.slice(0, 2)
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-label-2 font-medium text-neutral">{player.name}</p>
        <p className="mt-0.5 text-caption-2 font-medium text-neutral-muted">{getPlayerMeta(player)}</p>
      </div>
    </div>
  )
}
