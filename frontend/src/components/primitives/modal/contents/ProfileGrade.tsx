'use client'

// 사용 도메인: 마이페이지 아바타 탭 — 시즌 누적 점수에 따른 등급 안내. 껍데기(Modal)는 호출부(MyPageClient)가 씌운다.

import { Avatar, AvatarImage, AvatarFallback } from '@/components/primitives/avatar'
import { SheetHeader, SheetTitle, SheetDescription } from '../sheet'
import { cn } from '@/lib/utils'

interface ProfileGradeContentProps {
  totalPoints: number
  /** 이름 없이 임계점수 + 아이콘만 (plan 6-2 결정). 신규 등급이 추가돼도 코드 변경이 필요 없다. */
  grades: { threshold: number; iconUrl: string }[]
}

/**
 * 등급 안내 모달의 **내용**. 현재 총점과 등급별 임계점수·아이콘을 나열하고,
 * 현재 도달한 등급은 테두리 강조로 구분한다. 등급 이름은 표시하지 않는다(plan 6-2).
 */
export function ProfileGradeContent({ totalPoints, grades }: ProfileGradeContentProps) {
  // grades는 오름차순(profile-icons.ts의 getProfileIconThresholds)이라고 가정하되, 방어적으로 다시 정렬한다.
  const sortedGrades = [...grades].sort((a, b) => a.threshold - b.threshold)

  const currentIndex = sortedGrades.reduce(
    (acc, grade, i) => (grade.threshold <= totalPoints ? i : acc),
    -1,
  )
  const nextGrade = sortedGrades[currentIndex + 1] ?? null
  const pointsToNext = nextGrade ? nextGrade.threshold - totalPoints : null

  return (
    <>
      <SheetHeader className="text-left mb-5">
        <SheetTitle className="text-headline-1">프로필 등급 안내</SheetTitle>
        <SheetDescription>
          시즌 누적 점수가 오를수록 프로필 아이콘이 바뀝니다
        </SheetDescription>
      </SheetHeader>

      <div className="rounded-sm bg-page px-4 py-4 mb-5">
        <p className="text-caption-2 text-neutral-muted mb-0.5">내 시즌 누적 점수</p>
        <p className="text-headline-2 font-semibold text-neutral">{totalPoints.toLocaleString()}점</p>
        {pointsToNext !== null && (
          <p className="mt-1 text-label-1-normal text-neutral-muted">
            다음 등급까지 {pointsToNext.toLocaleString()}점 남았어요
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {sortedGrades.map((grade, i) => {
          const isCurrent = i === currentIndex
          return (
            <div
              key={grade.threshold}
              className={cn(
                'flex items-center gap-3 rounded-sm px-3 py-2.5',
                isCurrent ? 'bg-brand-weak' : 'bg-page',
              )}
            >
              <Avatar className={cn('h-10 w-10', isCurrent && 'ring-2 ring-inset ring-brand-solid')}>
                <AvatarImage src={grade.iconUrl} />
                <AvatarFallback className="bg-disabled text-neutral-muted text-label-2 font-semibold">
                  {grade.threshold}
                </AvatarFallback>
              </Avatar>
              <p className="text-label-1-normal font-medium text-neutral">
                {grade.threshold.toLocaleString()}점 이상
              </p>
            </div>
          )
        })}
      </div>
    </>
  )
}
