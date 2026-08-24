import { AppHeader } from '@/components/composition/common/AppHeader'

// 얇은 래퍼 — 실제 헤더 구현은 AppHeader로 통합됐다(모바일 돌아가기 + 데스크탑 GNB).
// 기존 호출부(TypeA/TypeB/OverallRating*, /polls/create, /my/feedback)를 그대로 두기 위해 이름만 유지.
export function PollPageHeader() {
  return <AppHeader mobileBack />
}
