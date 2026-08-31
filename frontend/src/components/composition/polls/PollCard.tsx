'use client'

import Link from 'next/link'
import { Users } from 'lucide-react'
import { usePathname } from 'next/navigation'
import type { PollListItem } from '@/lib/queries/polls'
import { getSourcePage, trackEvent } from '@/lib/analytics/mixpanel'
import { getEffectivePollStatus } from '@/lib/polls/status'
import { formatScheduled, formatDate } from '@/lib/utils'
import { Badge, type BadgeProps } from '@/components/primitives/badge'

interface PollCardProps {
  poll: PollListItem
  /**
   * horizontal: 썸네일 왼쪽 + 정보 오른쪽, 여러 장이 세로로 쌓이는 목록용(모바일 기본).
   * vertical: 썸네일이 카드 폭 전체를 채우고 정보가 아래, 여러 장이 그리드로 가로 배치되는
   * 데스크탑 2~3단 그리드용(화면 폭에 따라 가변).
   */
  variant?: 'horizontal' | 'vertical'
}

export function getThumbnailUrl(poll: PollListItem): string {
  if (poll.thumbnail_url) return poll.thumbnail_url
  if (poll.player?.photo_url) return poll.player.photo_url
  const optionImage = poll.poll_options.find(option => option.image_url)?.image_url
  if (optionImage) return optionImage
  return `https://placehold.co/96x96/0c2340/41b6e6?text=${encodeURIComponent(poll.title.slice(0, 2))}`
}

/**
 * 상태 라벨/톤이 실제로 읽는 건 status·scheduled_at·closes_at 셋뿐이라 그만큼만 요구한다.
 * PollListItem(목록)뿐 아니라 PollDetail(상세)도 그대로 넘길 수 있어야 하기 때문 —
 * PollDetail은 scheduled_at이 optional이고 vote_count가 없다.
 */
type PollStatusSource = Pick<PollListItem, 'status' | 'closes_at'> & {
  scheduled_at?: string | null
}

export function getStatusLabel(poll: PollStatusSource): string {
  if (poll.status === 'scheduled') return poll.scheduled_at ? formatScheduled(poll.scheduled_at) : '공개 예정'
  if (poll.status === 'closed') return '종료됨'
  return poll.closes_at ? formatTimeLeft(poll.closes_at) : '진행중'
}

export function formatTimeLeft(closesAt: string): string {
  const diff = new Date(closesAt).getTime() - Date.now()
  if (diff <= 0) return '마감 임박'
  const days = Math.ceil(diff / 86_400_000)
  if (days > 0) return `D-${days}`
  return 'D-Day'
}

/**
 * 상태 뱃지 톤. components/primitives/badge.tsx의 기존 variant를 그대로 재사용한다(새 색 안 만듦) —
 * 공개 전/종료는 "지금 참여 못 함"으로 묶어 중립(outline), 진행중은 마감까지 1일 이하로
 * 남았을 때만 긴급(destructive)으로 올리고 그 외엔 기본(default) 톤을 쓴다.
 */
export function getStatusTone(poll: PollStatusSource): NonNullable<BadgeProps['variant']> {
  if (poll.status !== 'active') return 'outline'
  const diff = new Date(poll.closes_at).getTime() - Date.now()
  if (diff <= 0) return 'destructive'
  const days = Math.ceil(diff / 86_400_000)
  return days <= 1 ? 'destructive' : 'default'
}

function getOptionPreview(poll: PollListItem): string {
  if (poll.poll_options.length === 0) return '후보 공개 전'
  const preview = poll.poll_options
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .slice(0, 3)
    .map(option => option.label)
    .join(' · ')
  const rest = poll.poll_options.length - 3
  return rest > 0 ? `${preview} 외 ${rest}개` : preview
}

function useCardClickTracker(poll: PollListItem) {
  const pathname = usePathname()
  return () => trackEvent('poll_card_clicked', {
    source_page: getSourcePage(pathname),
    poll_id: poll.id,
    poll_type: poll.type,
    poll_status: poll.status,
    creator_type: poll.created_by && poll.creator_name ? 'user' : 'admin',
  })
}

/** 모바일 기본 — 썸네일(14:11) 왼쪽 + 정보 오른쪽, 세로로 쌓이는 한 줄짜리 리스트 행. */
function PollFeedCard({ poll }: { poll: PollListItem }) {
  const onClick = useCardClickTracker(poll)

  return (
    <Link
      href={`/polls/${poll.id}`}
      prefetch={false}
      onClick={onClick}
      // neutral-weak-pressed(neutral-300)는 text-neutral-muted와 4.06:1로 AA 미달이라 안 쓴다.
      // neutral-weak(값은 기존 bg-disabled와 동일, neutral-200)을 press 색으로 써서 대비는 유지하고
      // "disabled 색을 press 피드백으로 재사용"하던 이름만 바로잡는다.
      className={`block bg-surface transition-colors active:bg-neutral-weak ${poll.status === 'closed' ? 'opacity-70' : ''}`}
    >
      <div className="flex items-center gap-4 py-4 pl-3 pr-5">
        <div className="relative w-28 shrink-0 overflow-hidden rounded-md bg-disabled">
          <img
            src={getThumbnailUrl(poll)}
            alt=""
            className={`aspect-[14/11] w-full object-cover ${poll.status === 'closed' ? 'grayscale' : ''}`}
          />
          <Badge variant={getStatusTone(poll)} className="absolute left-2 top-2 whitespace-nowrap">
            {getStatusLabel(poll)}
          </Badge>
        </div>

        {/* self-stretch: 썸네일(14:11)보다 텍스트가 더 짧을 때도 이 컬럼이 row 높이를 다
            채우도록 늘어난다 — 그래야 justify-between이 메타 줄을 바닥까지 밀어낼 여백을 갖는다.
            gap-3: justify-between이 만드는 여백은 row가 다른 카드보다 안 길면 0에 가까워질 수
            있어서, 제목/부제 묶음과 메타 줄 사이 최소 간격을 gap으로 따로 보장한다. */}
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 self-stretch">
          <p className="min-w-0 line-clamp-2 text-headline-2 font-semibold text-neutral">{poll.title}</p>
          <div className="flex items-center justify-between text-caption-1 text-neutral-muted">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {poll.vote_count.toLocaleString()}명
            </span>
            <span>{formatDate(poll.created_at)}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

/** 데스크탑 2~3단 그리드(화면 폭에 따라 가변) — 썸네일이 카드 폭 전체(높이만 고정, 너비는 그리드 칸을 따라 가변) + 정보 아래. */
function PollGridCard({ poll }: { poll: PollListItem }) {
  const onClick = useCardClickTracker(poll)

  return (
    <Link
      href={`/polls/${poll.id}`}
      prefetch={false}
      onClick={onClick}
      // flex flex-col: 그리드가 이 Link를 같은 행의 가장 큰 카드 높이만큼 stretch시켜도(기본
      // align-items: stretch), 아래 정보 패널이 flex-1로 그 남는 높이를 실제로 가져다 쓰게 한다.
      className={`flex flex-col overflow-hidden rounded-lg border border-neutral-weak bg-surface transition-colors active:bg-neutral-weak ${poll.status === 'closed' ? 'opacity-70' : ''}`}
    >
      <div className="relative shrink-0">
        <img
          src={getThumbnailUrl(poll)}
          alt=""
          className={`h-[168px] w-full object-cover ${poll.status === 'closed' ? 'grayscale' : ''}`}
        />
        <Badge variant={getStatusTone(poll)} className="absolute left-2 top-2 whitespace-nowrap">
          {getStatusLabel(poll)}
        </Badge>
      </div>

      {/* flex-1 + justify-between: 제목·부제는 위에서 바짝 붙어 한 덩어리로 보이게 하고,
          메타 줄만 패널 바닥까지 밀어내 남는 세로 공간을 전부 쓴다.
          gap-3: 같은 행 카드들 높이가 다 비슷하면 justify-between의 여백이 0에 가까워져
          텍스트끼리 붙어 보일 수 있어서, 최소 간격을 gap으로 따로 보장한다. */}
      <div className="flex flex-1 flex-col justify-between gap-3 p-3.5">
        <div>
          <p className="truncate text-headline-2 font-semibold text-neutral">{poll.title}</p>
          <p className="mt-0.5 line-clamp-2 text-label-1-normal text-neutral-muted">
            {poll.description || getOptionPreview(poll)}
          </p>
        </div>
        <div className="flex items-center justify-between text-caption-1 text-neutral-muted">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {poll.vote_count.toLocaleString()}명
          </span>
          <span>{formatDate(poll.created_at)}</span>
        </div>
      </div>
    </Link>
  )
}

// ── export ────────────────────────────────────────────────────
export function PollCard({ poll, variant = 'horizontal' }: PollCardProps) {
  const effectivePoll = {
    ...poll,
    status: getEffectivePollStatus(poll),
  }
  return variant === 'vertical' ? <PollGridCard poll={effectivePoll} /> : <PollFeedCard poll={effectivePoll} />
}
