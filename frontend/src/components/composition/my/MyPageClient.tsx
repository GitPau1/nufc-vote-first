'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Trash2, ChevronRight, Pencil, Check, X } from 'lucide-react'
import { useLoadingRouter } from '@/components/primitives/navigation-loading'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/primitives/avatar'
import { Button } from '@/components/primitives/button'
import { Card, CardContent } from '@/components/primitives/card'
import { Separator } from '@/components/primitives/separator'
import { Badge } from '@/components/primitives/badge'
import { Modal } from '@/components/primitives/modal/Modal'
import { ProfileGradeContent } from '@/components/primitives/modal/contents/ProfileGrade'
import type { ParticipatedPoll } from '@/lib/mock/data'
import { cn } from '@/lib/utils'

interface MyPageClientProps {
  displayName: string
  email: string
  avatarUrl: string | null
  participatedPolls: ParticipatedPoll[]
  isMockMode: boolean
  totalPoints: number
  profileGrades: { threshold: number; iconUrl: string }[]
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul',
  })
}

export function MyPageClient({
  displayName,
  email,
  avatarUrl,
  participatedPolls,
  isMockMode,
  totalPoints,
  profileGrades,
}: MyPageClientProps) {
  const router = useLoadingRouter()
  const [nameValue, setNameValue]         = useState(displayName)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editInput, setEditInput]         = useState(displayName)
  const [showGradeModal, setShowGradeModal] = useState(false)

  const initial = nameValue[0]?.toUpperCase() ?? 'U'

  function startEdit() {
    setEditInput(nameValue)
    setIsEditingName(true)
  }

  function cancelEdit() {
    setIsEditingName(false)
    setEditInput(nameValue)
  }

  async function handleSaveName() {
    const trimmed = editInput.trim()
    if (!trimmed) return
    // 낙관적 UI 업데이트
    setNameValue(trimmed)
    setIsEditingName(false)
    // public.users.display_name 저장
    const { updateNickname } = await import('@/lib/actions/onboarding')
    const result = await updateNickname(trimmed)
    if (result.error) {
      // 저장 실패 시 원래 값으로 복원
      setNameValue(displayName)
      alert(result.error)
    }
  }

  async function handleDelete() {
    if (isMockMode) {
      alert('데모 모드에서는 지원하지 않습니다.')
      return
    }
    if (!confirm('정말 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return

    const { submitDeleteAccount } = await import('@/lib/actions/auth')
    const result = await submitDeleteAccount()
    if (result.error) {
      alert(result.error)
      return
    }

    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-page">
      <div className="mx-auto max-w-shell px-4 pt-6 pb-10 flex flex-col gap-5">

        <div>
          <p className="text-caption-1 font-medium text-neutral-muted uppercase mb-3">
            내 계정 정보
          </p>

          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <button
                type="button"
                onClick={() => setShowGradeModal(true)}
                aria-label="프로필 등급 안내 보기"
                className="rounded-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-solid"
              >
                <Avatar className="h-16 w-16">
                  <AvatarImage src={avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-brand-weak text-brand text-heading-2 font-semibold">
                    {initial}
                  </AvatarFallback>
                </Avatar>
              </button>

              <div className="flex-1 min-w-0">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={editInput}
                      onChange={e => setEditInput(e.target.value.slice(0, 20))}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveName()
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      className="text-body-1-normal font-semibold text-neutral bg-transparent border-b-2 border-brand-solid outline-none w-32 pb-0.5"
                      autoFocus
                      maxLength={20}
                    />
                    <button
                      onClick={handleSaveName}
                      className="w-6 h-6 rounded-pill bg-brand-solid flex items-center justify-center flex-shrink-0"
                      aria-label="닉네임 저장"
                    >
                      <Check className="h-3.5 w-3.5 text-white" />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="w-6 h-6 rounded-pill bg-disabled flex items-center justify-center flex-shrink-0"
                      aria-label="닉네임 수정 취소"
                    >
                      <X className="h-3.5 w-3.5 text-neutral-muted" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-headline-2 font-semibold text-neutral truncate">{nameValue}</p>
                      <button
                        onClick={startEdit}
                        className="flex-shrink-0 text-neutral-muted hover:text-neutral transition-colors"
                        aria-label="닉네임 수정"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                  </div>
                )}

                <p className="mt-1 text-label-1-normal text-neutral-muted">{email}</p>
                {isMockMode && (
                  <Badge variant="secondary" className="text-caption-2 mt-1">데모 프로필</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* 참여한 투표 */}
        <div>
          <p className="text-caption-1 font-medium text-neutral-muted uppercase mb-3">
            참여한 투표 · {participatedPolls.length}개
          </p>

          {participatedPolls.length === 0 ? (
            <p className="text-label-1-normal text-neutral-muted py-4 text-center">
              아직 참여한 투표가 없습니다
            </p>
          ) : (
            <Card>
              <CardContent className="p-0">
                {participatedPolls.map((item, i) => (
                  <div key={item.pollId}>
                    {i > 0 && <Separator />}
                    <Link href={`/polls/${item.pollId}`} className="block active:bg-disabled transition-colors">
                      <div className="flex items-center gap-3 px-4 py-4 hover:bg-disabled/50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-label-1-normal font-medium text-neutral line-clamp-1">
                            {item.pollTitle}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={cn('text-caption-1 font-medium text-brand')}>
                              {item.optionLabel}
                            </span>
                            <span className="text-caption-2 text-neutral-muted">
                              · {formatDate(item.votedAt)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge
                            variant={item.pollStatus === 'closed' ? 'outline' : 'secondary'}
                            className="text-caption-2 pointer-events-none"
                          >
                            {item.pollStatus === 'closed' ? '종료' : '진행 중'}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-neutral-muted" />
                        </div>
                      </div>
                    </Link>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <Separator />

        {/* 계정 삭제 */}
        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            size="lg" className="w-full justify-start text-critical hover:text-critical hover:bg-critical-weak"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
            회원 탈퇴
          </Button>
        </div>
      </div>

      <Modal open={showGradeModal} onOpenChange={setShowGradeModal}>
        <ProfileGradeContent totalPoints={totalPoints} grades={profileGrades} />
      </Modal>
    </div>
  )
}
