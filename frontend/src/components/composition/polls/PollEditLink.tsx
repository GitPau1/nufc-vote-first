import Link from 'next/link'

/**
 * 투표 상세 화면(PollClient, OverallRatingPollClient, ResultView,
 * OverallRatingResultView)이 모바일 헤더 action과 데스크탑 본문 블록에서 공통으로 쓰는
 * "수정" 링크. canEdit 여부 판단과 반응형 wrapper(모바일 헤더의 absolute right-4,
 * 데스크탑 본문의 hidden justify-end sm:flex)는 호출부 몫이다 — 이 컴포넌트는 링크 자체만.
 */
export function PollEditLink({ pollId }: { pollId: string }) {
  return (
    <Link
      href={`/polls/${pollId}/edit`}
      className="text-label-2 font-medium text-neutral-muted hover:text-neutral"
    >
      수정
    </Link>
  )
}
