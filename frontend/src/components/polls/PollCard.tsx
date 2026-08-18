'use client'

import Link from 'next/link'
import { Users } from 'lucide-react'
import { usePathname } from 'next/navigation'
import type { PollListItem } from '@/lib/queries/polls'
import { getSourcePage, trackEvent } from '@/lib/analytics/mixpanel'
import { getEffectivePollStatus } from '@/lib/polls/status'
import { formatScheduled } from '@/lib/utils'

interface PollCardProps {
  poll: PollListItem
}

export function getThumbnailUrl(poll: PollListItem): string {
  if (poll.thumbnail_url) return poll.thumbnail_url
  if (poll.player?.photo_url) return poll.player.photo_url
  const optionImage = poll.poll_options.find(option => option.image_url)?.image_url
  if (optionImage) return optionImage
  return `https://placehold.co/96x96/0c2340/41b6e6?text=${encodeURIComponent(poll.title.slice(0, 2))}`
}

export function getStatusLabel(poll: PollListItem): string {
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

function PollFeedCard({ poll }: { poll: PollListItem }) {
  const pathname = usePathname()

  return (
    <Link
      href={`/polls/${poll.id}`}
      prefetch={false}
      onClick={() => trackEvent('poll_card_clicked', {
        source_page: getSourcePage(pathname),
        poll_id: poll.id,
        poll_type: poll.type,
        poll_status: poll.status,
        creator_type: poll.created_by && poll.creator_name ? 'user' : 'admin',
      })}
      className={`block bg-surface transition-colors active:bg-disabled ${poll.status === 'closed' ? 'opacity-75' : ''}`}
    >
      <div className="flex h-32 items-center gap-4 py-4 pl-3 pr-5">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-md bg-disabled">
          <img
            src={getThumbnailUrl(poll)}
            alt=""
            className={`h-full w-full object-cover ${poll.status === 'closed' ? 'grayscale-[.35]' : ''}`}
          />
        </div>

        <div className="flex min-w-0 flex-1 self-stretch">
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div className="min-w-0">
              <span className="inline-flex h-[21px] items-center rounded-pill bg-primary-dim px-[9px] text-caption-2 font-semibold text-primary-dark">
                {getStatusLabel(poll)}
              </span>
              <div className="pt-1.5">
                <p className="truncate text-body-2-normal font-bold text-foreground">{poll.title}</p>
                <p className="mt-0.5 line-clamp-1 text-caption-1 text-gray-2">
                  {poll.description || getOptionPreview(poll)}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-caption-2 text-gray-2">
              <Users className="h-3.5 w-3.5" />
              {poll.vote_count.toLocaleString()}명
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ── export ────────────────────────────────────────────────────
export function PollCard({ poll }: PollCardProps) {
  const effectivePoll = {
    ...poll,
    status: getEffectivePollStatus(poll),
  }
  return <PollFeedCard poll={effectivePoll} />
}
