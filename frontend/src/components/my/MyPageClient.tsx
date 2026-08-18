'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Trash2, ChevronRight, Pencil, Check, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import type { ParticipatedPoll } from '@/lib/mock/data'
import { cn } from '@/lib/utils'

interface MyPageClientProps {
  displayName: string
  email: string
  avatarUrl: string | null
  participatedPolls: ParticipatedPoll[]
  isMockMode: boolean
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

export function MyPageClient({
  displayName,
  email,
  avatarUrl,
  participatedPolls,
  isMockMode,
}: MyPageClientProps) {
  const [nameValue, setNameValue]         = useState(displayName)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editInput, setEditInput]         = useState(displayName)

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

  function handleDelete() {
    if (isMockMode) {
      alert('데모 모드에서는 지원하지 않습니다.')
      return
    }
    if (confirm('정말 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      // submitDeleteAccount()
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 pt-6 pb-10 flex flex-col gap-5">

        <div>
          <p className="text-caption-1 font-semibold text-muted-foreground uppercase mb-3">
            내 계정 정보
          </p>

          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={avatarUrl ?? undefined} />
                <AvatarFallback className="bg-primary-dim text-primary-dark text-heading-2 font-black">
                  {initial}
                </AvatarFallback>
              </Avatar>

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
                      className="text-body-1-normal font-black text-foreground bg-transparent border-b-2 border-primary outline-none w-32 pb-0.5"
                      autoFocus
                      maxLength={20}
                    />
                    <button
                      onClick={handleSaveName}
                      className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0"
                    >
                      <Check className="h-3.5 w-3.5 text-white" />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center flex-shrink-0"
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-headline-1 font-black text-foreground truncate">{nameValue}</p>
                      <button
                        onClick={startEdit}
                        className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="닉네임 수정"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                  </div>
                )}

                <p className="mt-1 text-label-1-normal text-muted-foreground">{email}</p>
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
          <p className="text-caption-1 font-semibold text-muted-foreground uppercase mb-3">
            참여한 투표 · {participatedPolls.length}개
          </p>

          {participatedPolls.length === 0 ? (
            <p className="text-label-1-normal text-muted-foreground py-4 text-center">
              아직 참여한 투표가 없습니다
            </p>
          ) : (
            <Card>
              <CardContent className="p-0">
                {participatedPolls.map((item, i) => (
                  <div key={item.pollId}>
                    {i > 0 && <Separator />}
                    <Link href={`/polls/${item.pollId}`} className="block active:bg-disabled transition-colors">
                      <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-label-1-reading font-semibold text-foreground line-clamp-1">
                            {item.pollTitle}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={cn('text-caption-1 font-medium text-primary')}>
                              {item.optionLabel}
                            </span>
                            <span className="text-caption-2 text-muted-foreground">
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
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
            className="w-full justify-start gap-2 h-12 text-negative hover:text-negative hover:bg-negative-dim"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
            회원 탈퇴
          </Button>
        </div>
      </div>
    </div>
  )
}
