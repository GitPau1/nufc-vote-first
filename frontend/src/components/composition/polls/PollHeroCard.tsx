'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users } from 'lucide-react'
import type { PollListItem } from '@/lib/queries/polls'
import { getSourcePage, trackEvent } from '@/lib/analytics/mixpanel'
import { getThumbnailUrl, getStatusLabel, formatTimeLeft } from './PollCard'

/** 목록 상단에 크게 보여주는 히어로 배너. `/polls`(PollListClient)와 `/`(HomeClient) 둘 다 재사용한다. */
export function PollHeroCard({ poll }: { poll: PollListItem }) {
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
      className="relative block h-[252px] overflow-hidden rounded-lg bg-disabled"
    >
      <img src={getThumbnailUrl(poll)} alt="" className="h-full w-full object-cover" />
      <div className="banner-text-overlay absolute inset-0" />
      <div className="absolute inset-x-4 bottom-4 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-[21px] items-center rounded-pill bg-brand-solid/55 px-[9px] text-caption-2 font-medium text-white backdrop-blur-[2px]">
            {poll.status === 'active' ? formatTimeLeft(poll.closes_at) : getStatusLabel(poll)}
          </span>
          <span className="inline-flex items-center gap-1 text-caption-1 text-white">
            <Users className="h-3.5 w-3.5" />
            {poll.vote_count.toLocaleString()}명
          </span>
        </div>
        <p className="truncate text-headline-2 sm:text-headline-1 font-semibold text-white">{poll.title}</p>
        {poll.description && (
          <p className="mt-1 truncate text-label-1-normal text-white/75">{poll.description}</p>
        )}
      </div>
    </Link>
  )
}
