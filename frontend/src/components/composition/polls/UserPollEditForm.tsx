'use client'

import { useState, useTransition } from 'react'
import { useLoadingRouter } from '@/components/primitives/navigation-loading'
import { updateUserPoll } from '@/lib/actions/polls'
import { uploadPollImage } from '@/lib/actions/images'
import { CroppedImageInput } from '@/components/composition/common/CroppedImageInput'
import { Button } from '@/components/primitives/button'
import type { PollDetail } from '@/lib/queries/polls'
import type { EditablePollField } from '@/lib/polls/poll-edit-eligibility'
import type { PlayerRow } from '@/types/database'
import { getPlayerMeta } from '@/components/primitives/modal/contents/PollPicker'
import { formatPollDate, getOptionThumb } from './ResultView'

const POLL_TYPE_LABELS: Partial<Record<PollDetail['type'], string>> = {
  poll: '일반 투표',
  overall_rating: '전체 평점',
}

interface UserPollEditFormProps {
  poll: PollDetail
  editableFields: EditablePollField[]
}

export function UserPollEditForm({ poll, editableFields }: UserPollEditFormProps) {
  const router = useLoadingRouter()
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const canEditTitle = editableFields.includes('title')
  const canEditDescription = editableFields.includes('description')
  // poll.status(DB 원본)가 아니라 editableFields로 판정한다 — 마감 시각은 지났지만 DB status가
  // 아직 'active'인 구간(자동 마감 처리 전)에는 title이 이미 잠겨 있으므로, 같은 근거(effective
  // status)를 쓰는 edit page(page.tsx)의 서브카피와 배너 문구가 어긋나지 않게 한다.
  const isClosed = !canEditTitle

  // poll.player_id 유무로 판정.
  const showSubjectPlayer = !!poll.player_id

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMessage(null)
    const fd = new FormData(e.currentTarget)
    // title/description input 자체가 안 잠긴 필드만 렌더되므로(canEditTitle/canEditDescription이
    // false면 애초에 그 input이 없다) fd에 그 키가 안 담긴다 — 서버의 validatePollEditPayload가
    // 진짜 관문이고, 여기서 또 fd.delete()로 지울 필요는 없다.

    startTransition(async () => {
      const thumbnailFile = fd.get('thumbnail_image_file') as File | null
      fd.delete('thumbnail_image_file')
      const currentThumbnailUrl = String(fd.get('thumbnail_url') ?? '').trim()
      if (thumbnailFile && thumbnailFile.size > 0) {
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
      } else {
        fd.set('thumbnail_url', currentThumbnailUrl)
      }

      const result = await updateUserPoll(poll.id, fd)
      if (result.error) {
        setMessage(result.error)
        return
      }
      router.push(`/polls/${poll.id}`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <section className="rounded-lg border border-neutral-weak bg-surface p-4 shadow-g200">
        <p className="text-label-1-normal font-medium text-neutral">투표 유형</p>
        <p className="mt-3 text-label-2 font-medium text-neutral">
          {POLL_TYPE_LABELS[poll.type] ?? poll.type}
        </p>
        <p className="mt-2 text-caption-1 text-neutral-muted">투표 신뢰성을 위해 수정할 수 없어요.</p>
      </section>

      <section className="space-y-3 rounded-lg border border-neutral-weak bg-surface p-4 shadow-g200">
        <p className="text-label-1-normal font-medium text-neutral">기본 정보</p>

        {canEditTitle ? (
          <input name="title" required defaultValue={poll.title} className="input-field" placeholder="투표 제목" />
        ) : (
          <p className="text-label-2 font-medium text-neutral">{poll.title}</p>
        )}

        {canEditDescription ? (
          <textarea name="description" defaultValue={poll.description ?? ''} className="input-field min-h-[72px] resize-none py-2" placeholder="설명(선택)" />
        ) : (
          poll.description && <p className="text-label-1-reading text-neutral-muted">{poll.description}</p>
        )}

        {(!canEditTitle || !canEditDescription) && (
          <p className="text-caption-1 text-neutral-muted">투표 신뢰성을 위해 수정할 수 없어요.</p>
        )}

        {poll.thumbnail_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poll.thumbnail_url} alt="" className="aspect-[3/1] w-full rounded-lg object-cover" />
        )}
        <input name="thumbnail_url" defaultValue={poll.thumbnail_url ?? ''} className="input-field" placeholder="대표 이미지 URL(선택)" />
        <CroppedImageInput
          name="thumbnail_image_file"
          label="대표 이미지 크롭"
          outputWidth={1200}
          outputHeight={400}
          previewClassName="aspect-[3/1]"
          fileName="poll-thumbnail.webp"
        />
      </section>

      <section className="space-y-3 rounded-lg border border-neutral-weak bg-surface p-4 shadow-g200">
        <p className="text-label-1-normal font-medium text-neutral">
          {showSubjectPlayer ? '대상 선수' : poll.type === 'overall_rating' ? '평가 대상 선수' : '선택지'}
        </p>

        {showSubjectPlayer ? (
          <>
            {poll.player && <ReadonlyPlayerSummary player={poll.player} />}
            <div className="space-y-1.5 pt-1">
              {poll.poll_options.map(option => (
                <p key={option.id} className="input-field flex items-center text-neutral-muted">
                  {option.label}
                </p>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-1.5">
            {poll.poll_options.map(option => {
              const thumb = getOptionThumb(option, poll.option_players)
              return (
                <div key={option.id} className="flex items-center gap-3 rounded-md border border-neutral-weak bg-disabled px-3 py-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-pill bg-surface text-caption-1 font-medium text-brand">
                    {thumb?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb.url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      thumb?.fallback ?? option.label.slice(0, 1)
                    )}
                  </div>
                  <p className="min-w-0 truncate text-label-2 font-medium text-neutral">{option.label}</p>
                </div>
              )
            })}
          </div>
        )}

        <p className="text-caption-1 text-neutral-muted">투표 신뢰성을 위해 수정할 수 없어요.</p>
      </section>

      <section className="space-y-3 rounded-lg border border-neutral-weak bg-surface p-4 shadow-g200">
        <p className="text-label-1-normal font-medium text-neutral">마감일</p>
        <p className="text-label-2 font-medium text-neutral">{formatPollDate(poll.closes_at)}</p>
        <p className="text-caption-1 text-neutral-muted">투표 신뢰성을 위해 수정할 수 없어요.</p>
      </section>

      {isClosed && (
        <div className="rounded-lg bg-disabled p-5 text-label-1-normal font-medium text-neutral-muted">
          대표 이미지만 수정할 수 있어요.
        </div>
      )}

      {message && <p className="rounded-sm bg-critical-weak px-3 py-2 text-caption-1 font-medium text-critical">{message}</p>}
      <Button type="submit" disabled={isPending} size="lg" className="w-full">
        {isPending ? '저장 중…' : '저장'}
      </Button>
    </form>
  )
}

function ReadonlyPlayerSummary({ player }: { player: PlayerRow }) {
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
