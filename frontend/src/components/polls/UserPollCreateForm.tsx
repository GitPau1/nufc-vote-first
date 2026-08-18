'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Plus, Search, Users, X } from 'lucide-react'
import { createUserPoll } from '@/lib/actions/polls'
import { uploadPollImage } from '@/lib/actions/images'
import { trackEvent } from '@/lib/analytics/mixpanel'
import { CroppedImageInput } from '@/components/images/BannerImageInput'
import type { PollFormPlayer } from '@/lib/queries/polls'
import type { PollType, Position } from '@/types/database'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

type FreeOption = { label: string; description: string; imageUrl: string }
type CreatePollType = Extract<PollType, 'subject_options' | 'question_targets' | 'free_choice' | 'overall_rating'>
type PlayerPickMode = 'single' | 'multiple'
type PlayerFilter = 'all' | 'first_team' | 'loan' | 'u21'

const POLL_TYPES: Array<{ type: CreatePollType; label: string; description: string }> = [
  { type: 'subject_options', label: '대상+선택지', description: '한 선수에 대해 여러 선택지를 붙입니다.' },
  { type: 'question_targets', label: '질문+선수', description: '질문 하나에 여러 선수를 후보로 둡니다.' },
  { type: 'free_choice', label: '자유 선택', description: '선수와 무관한 선택지를 직접 만듭니다.' },
  { type: 'overall_rating', label: '전체 평점', description: '여러 선수에게 각각 등급과 코멘트를 받습니다.' },
]

const POSITION_ORDER: Array<Position | 'ETC'> = ['GK', 'DEF', 'MID', 'FWD', 'MGR', 'ETC']
const POSITION_LABEL: Record<Position | 'ETC', string> = {
  GK: '골키퍼',
  DEF: '수비수',
  MID: '미드필더',
  FWD: '공격수',
  MGR: '감독',
  ETC: '기타',
}

const PLAYER_FILTERS: Array<{ id: PlayerFilter; label: string }> = [
  { id: 'all', label: '전체' },
  { id: 'first_team', label: '1군' },
  { id: 'loan', label: '임대' },
  { id: 'u21', label: 'U21' },
]

function isSelectablePlayer(player: PollFormPlayer): boolean {
  return player.is_active
}

function getPlayerMeta(player: PollFormPlayer): string {
  const number = player.squad_number ? `#${player.squad_number}` : '번호 없음'
  const status = !player.is_active ? '구단 외' : player.squad_status === 'loan' ? '임대' : player.squad_status === 'u21' ? 'U21' : '1군'
  return `${player.position ?? '기타'} · ${number} · ${status}`
}

export function UserPollCreateForm({ players }: { players: PollFormPlayer[] }) {
  const router = useRouter()
  const [pollType, setPollType] = useState<CreatePollType>(POLL_TYPES[0].type)
  const [textOptions, setTextOptions] = useState(['', ''])
  const [freeOptions, setFreeOptions] = useState<FreeOption[]>([
    { label: '', description: '', imageUrl: '' },
    { label: '', description: '', imageUrl: '' },
  ])
  const [selectedSubjectPlayerId, setSelectedSubjectPlayerId] = useState<string | null>(null)
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerMode, setPickerMode] = useState<PlayerPickMode>('single')
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const selectedSubjectPlayer = players.find(player => player.id === selectedSubjectPlayerId) ?? null
  const selectedPlayers = selectedPlayerIds
    .map(id => players.find(player => player.id === id))
    .filter((player): player is PollFormPlayer => Boolean(player))

  function openPlayerPicker(mode: PlayerPickMode) {
    setPickerMode(mode)
    setPickerOpen(true)
  }

  function togglePlayer(playerId: string) {
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
      poll_type: pollType,
    })

    if (pollType === 'subject_options') {
      const options = textOptions.map(option => option.trim()).filter(Boolean)
      if (!selectedSubjectPlayerId) {
        setMessage('대상 선수를 선택해주세요.')
        return
      }
      if (options.length < 2) {
        setMessage('선택지를 최소 2개 입력해주세요.')
        return
      }
      fd.set('player_id', selectedSubjectPlayerId)
      fd.set('options', JSON.stringify(options.map(label => ({ label }))))
    } else if (pollType === 'free_choice') {
      const options = freeOptions
        .map((option, index) => ({
          label: option.label.trim(),
          description: option.description.trim() || null,
          image_url: option.imageUrl.trim() || null,
          imageField: `free_option_image_${index}`,
        }))
        .filter(option => option.label)
      if (options.length < 2) {
        setMessage('선택지를 최소 2개 입력해주세요.')
        return
      }
      fd.set('options', JSON.stringify(options.map(option => ({
        label: option.label,
        description: option.description,
        image_url: option.image_url,
        imageField: option.imageField,
      }))))
      fd.delete('player_id')
    } else {
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
    }

    fd.set('type', pollType)

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

      if (pollType === 'free_choice') {
        const parsedOptions = JSON.parse(String(fd.get('options') ?? '[]')) as Array<{
          label: string
          description: string | null
          image_url: string | null
          imageField: string
        }>
        const uploadedOptions = []
        for (const option of parsedOptions) {
          const imageFile = fd.get(option.imageField) as File | null
          fd.delete(option.imageField)
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
            })
          } else {
            uploadedOptions.push({
              label: option.label,
              description: option.description,
              image_url: option.image_url,
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
        poll_type: pollType,
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
        <section className="rounded-lg border border-border bg-surface p-4 shadow-g200">
          <p className="text-label-2 font-bold text-foreground">투표 유형</p>
          <div className="mt-3 grid gap-2">
            {POLL_TYPES.map(item => {
              const selected = item.type === pollType
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setPollType(item.type)}
                  className={`rounded-sm border px-3 py-3 text-left transition-opacity hover:opacity-70 ${selected ? 'border-primary bg-primary-dim' : 'border-border bg-surface'}`}
                >
                  <span className={`block text-label-2 font-black ${selected ? 'text-primary' : 'text-foreground'}`}>{item.label}</span>
                  <span className="mt-1 block text-caption-1 text-muted-foreground">{item.description}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="space-y-2.5 rounded-lg border border-border bg-surface p-4 shadow-g200">
          <p className="text-label-2 font-bold text-foreground">기본 정보</p>
          <input name="title" required className="input-field" placeholder="투표 제목" />
          <input name="description" className="input-field" placeholder="설명(선택)" />
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

        {pollType === 'subject_options' ? (
          <section className="space-y-2.5 rounded-lg border border-border bg-surface p-4 shadow-g200">
            <div className="flex items-center justify-between gap-3">
              <p className="text-label-2 font-bold text-foreground">대상 선수</p>
              <button type="button" onClick={() => openPlayerPicker('single')} className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-disabled px-2.5 text-caption-1 font-bold text-foreground">
                <Users className="h-3.5 w-3.5" /> 선택
              </button>
            </div>
            {selectedSubjectPlayer ? <PlayerSummary player={selectedSubjectPlayer} /> : <EmptySelection label="선수를 선택해주세요." />}
            <div className="space-y-1.5 pt-1">
              {textOptions.map((option, index) => (
                <input
                  key={index}
                  value={option}
                  onChange={event => setTextOptions(prev => prev.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
                  className="input-field"
                  placeholder={`선택지 ${index + 1}`}
                />
              ))}
            </div>
            {textOptions.length < 5 && (
              <button type="button" onClick={() => setTextOptions(prev => [...prev, ''])} className="inline-flex items-center gap-1 text-caption-1 font-bold text-primary">
                <Plus className="h-3.5 w-3.5" /> 선택지 추가
              </button>
            )}
          </section>
        ) : pollType === 'free_choice' ? (
          <section className="space-y-2.5 rounded-lg border border-border bg-surface p-4 shadow-g200">
            <p className="text-label-2 font-bold text-foreground">선택지</p>
            <div className="space-y-1.5">
              {freeOptions.map((option, index) => (
                <div key={index} className="grid grid-cols-[1fr_32px] gap-1.5 rounded-md border border-border p-2">
                  <div className="space-y-1.5">
                    <input
                      value={option.label}
                      onChange={event => setFreeOptions(prev => prev.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))}
                      className="input-field"
                      placeholder={`선택지 ${index + 1}`}
                    />
                    <textarea
                      value={option.description}
                      onChange={event => setFreeOptions(prev => prev.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))}
                      className="input-field min-h-[72px] resize-none py-2"
                      placeholder="세부 설명(선택)"
                    />
                    <input
                      value={option.imageUrl}
                      onChange={event => setFreeOptions(prev => prev.map((item, itemIndex) => itemIndex === index ? { ...item, imageUrl: event.target.value } : item))}
                      className="input-field"
                      placeholder="이미지 URL"
                    />
                    <CroppedImageInput
                      name={`free_option_image_${index}`}
                      label="선택지 카드 이미지 크롭"
                      outputWidth={1000}
                      outputHeight={1300}
                      previewClassName="aspect-[10/13]"
                      fileName="poll-option.webp"
                    />
                  </div>
                  <button type="button" onClick={() => setFreeOptions(prev => prev.filter((_, itemIndex) => itemIndex !== index))} className="rounded-sm border border-border text-muted-foreground" aria-label="선택지 삭제">
                    <X className="mx-auto h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            {freeOptions.length < 8 && (
              <button type="button" onClick={() => setFreeOptions(prev => [...prev, { label: '', description: '', imageUrl: '' }])} className="inline-flex items-center gap-1 text-caption-1 font-bold text-primary">
                <Plus className="h-3.5 w-3.5" /> 선택지 추가
              </button>
            )}
          </section>
        ) : (
          <section className="space-y-2.5 rounded-lg border border-border bg-surface p-4 shadow-g200">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-label-2 font-bold text-foreground">{pollType === 'overall_rating' ? '평가 대상 선수' : '후보 선수'}</p>
                <p className="mt-0.5 text-caption-1 text-muted-foreground">{selectedPlayers.length}명 선택됨</p>
              </div>
              <button type="button" onClick={() => openPlayerPicker('multiple')} className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-disabled px-2.5 text-caption-1 font-bold text-foreground">
                <Users className="h-3.5 w-3.5" /> 선택
              </button>
            </div>
            {selectedPlayers.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {selectedPlayers.map(player => (
                  <span key={player.id} className="rounded-pill bg-disabled px-2 py-1 text-caption-2 font-bold text-foreground">
                    {player.name}
                  </span>
                ))}
              </div>
            ) : (
              <EmptySelection label="선수들을 선택해주세요." />
            )}
          </section>
        )}

        {message && <p className="rounded-sm bg-negative-dim px-3 py-2 text-caption-1 font-semibold text-negative">{message}</p>}
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? '생성 중...' : '투표 생성'}
        </button>
      </form>

      <PlayerPickerSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        mode={pickerMode}
        players={players}
        selectedIds={pickerMode === 'single' ? (selectedSubjectPlayerId ? [selectedSubjectPlayerId] : []) : selectedPlayerIds}
        onToggle={togglePlayer}
        onDone={() => setPickerOpen(false)}
      />
    </>
  )
}

function EmptySelection({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-caption-1 font-semibold text-muted-foreground">
      {label}
    </div>
  )
}

function PlayerSummary({ player }: { player: PollFormPlayer }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-disabled px-3 py-2">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface text-caption-1 font-black text-primary">
        {player.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={player.photo_url} alt="" className="h-full w-full object-cover" />
        ) : (
          player.name.slice(0, 2)
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-label-2 font-black text-foreground">{player.name}</p>
        <p className="mt-0.5 text-caption-2 font-semibold text-muted-foreground">{getPlayerMeta(player)}</p>
      </div>
    </div>
  )
}

function PlayerPickerSheet({
  open,
  onOpenChange,
  mode,
  players,
  selectedIds,
  onToggle,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: PlayerPickMode
  players: PollFormPlayer[]
  selectedIds: string[]
  onToggle: (playerId: string) => void
  onDone: () => void
}) {
  const [query, setQuery] = useState('')
  const [playerFilter, setPlayerFilter] = useState<PlayerFilter>('all')
  const normalizedQuery = query.trim().toLowerCase()

  const positionGroups = useMemo(() => {
    const filtered = players.filter(player => {
      if (!normalizedQuery) return true
      const haystack = `${player.name} ${player.position ?? ''} ${player.squad_number ?? ''}`.toLowerCase()
      return haystack.includes(normalizedQuery)
    }).filter(player => {
      if (!isSelectablePlayer(player)) return false
      if (playerFilter === 'all') return true
      return player.squad_status === playerFilter
    })

    return POSITION_ORDER.map(position => ({
      key: position,
      label: POSITION_LABEL[position],
      players: filtered.filter(player => (player.position ?? 'ETC') === position),
    })).filter(positionGroup => positionGroup.players.length > 0)
  }, [players, normalizedQuery, playerFilter])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        style={{ left: 'max(0px, calc(50% - 240px))' }}
        className="right-auto flex h-[82vh] max-h-[82vh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-lg p-0"
      >
        <SheetHeader className="sr-only">
          <SheetTitle className="text-body-1-normal font-black">선수 선택</SheetTitle>
          <SheetDescription className="text-caption-1">
            {mode === 'single' ? '투표 대상 선수 1명을 선택합니다.' : '투표 후보로 올릴 선수를 선택합니다.'}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 border-b border-border px-4 py-3">
          <div className="mr-10 flex h-10 items-center gap-2 rounded-sm border border-border bg-surface px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-label-2 font-semibold outline-none"
              placeholder="선수 검색"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
            {PLAYER_FILTERS.map(filter => {
              const selected = filter.id === playerFilter
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setPlayerFilter(filter.id)}
                  className={`shrink-0 rounded-pill border px-2.5 py-1 text-caption-2 font-black transition-opacity hover:opacity-70 ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-surface text-muted-foreground'}`}
                >
                  {filter.label}
                </button>
              )
            })}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {positionGroups.length === 0 ? (
            <p className="py-12 text-center text-label-2 font-semibold text-muted-foreground">검색 결과가 없습니다.</p>
          ) : (
            <div className="space-y-4">
              {positionGroups.map(positionGroup => (
                <section key={positionGroup.key} className="space-y-1.5">
                  <p className="px-0.5 text-caption-1 font-bold text-muted-foreground">{positionGroup.label}</p>
                  {positionGroup.players.map(player => {
                    const selected = selectedIds.includes(player.id)
                    return (
                      <button
                        key={player.id}
                        type="button"
                        onClick={() => onToggle(player.id)}
                        className={`flex w-full items-center gap-3 rounded-sm border px-3 py-2 text-left transition-opacity hover:opacity-70 ${selected ? 'border-primary bg-primary-dim' : 'border-border bg-surface'}`}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-caption-1 font-black text-primary">
                          {player.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={player.photo_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            player.name.slice(0, 2)
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-label-2 font-black text-foreground">{player.name}</p>
                          <p className="mt-0.5 text-caption-2 font-semibold text-muted-foreground">{getPlayerMeta(player)}</p>
                        </div>
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-transparent'}`}>
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      </button>
                    )
                  })}
                </section>
              ))}
            </div>
          )}
        </div>
        {mode === 'multiple' && (
          <div className="border-t border-border bg-surface px-4 py-3">
            <button type="button" onClick={onDone} className="btn-primary">
              {selectedIds.length}명 선택 완료
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
