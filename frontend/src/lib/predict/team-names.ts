/**
 * fixtures 테이블의 home_name/away_name은 FotMob 원본(영문) 그대로 들어온다.
 * 이 앱은 팀명을 한글로 쓰는 게 관례라(예: MatchWeekList 프리뷰 mock의 "리버풀", "아스날")
 * 실제로 마주친 팀 ID만 한글 매핑해두고, 없는 팀은 원본 영문 이름을 그대로 보여준다 —
 * 안 써본 팀 ID를 추측해서 매핑하지 않는다(오역 위험).
 *
 * ID는 FotMob 팀 ID(fixtures.home_id/away_id와 동일 체계)다.
 */
const KOREAN_TEAM_NAMES: Record<number, string> = {
  6189: '게이츠헤드',
  8178: '레버쿠젠',
  8427: '브리스톨시티',
  8455: '첼시',
  8456: '맨체스터시티',
  8463: '리즈',
  8472: '선더랜드',
  8586: '토트넘',
  8650: '리버풀',
  8659: '웨스트브롬위치',
  8667: '헐시티',
  8668: '에버튼',
  8669: '코번트리',
  8678: '본머스',
  9825: '아스날',
  9826: '크리스탈팰리스',
  9848: '스트라스부르',
  9879: '풀럼',
  9902: '입스위치',
  9937: '브렌트포드',
  10203: '노팅엄포레스트',
  10204: '브라이튼',
  10252: '아스톤빌라',
  10260: '맨체스터유나이티드',
  10261: '뉴캐슬',
  10267: '발렌시아',
}

/** 매핑에 없는 팀은 FotMob 원본 이름을 그대로 반환한다. */
export function koreanTeamName(teamId: number, fallbackName: string): string {
  return KOREAN_TEAM_NAMES[teamId] ?? fallbackName
}
