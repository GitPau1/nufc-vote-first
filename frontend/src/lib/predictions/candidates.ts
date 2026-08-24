/**
 * 선수 픽/평점 표시용 헬퍼.
 *
 * lib/predictions/week.ts와 같은 이유로 origin/main 승부예측 백엔드(PR #7 이후)의
 * `lib/predictions/candidates.ts`에서 이 브랜치가 당장 필요한 함수 하나만 옮겨왔다 —
 * 이 파일 전체(포지션 픽 후보 타입 등)가 아니라 `playerPhotoUrl`만. 두 브랜치가 합쳐지면
 * 원본 파일로 대체하면 된다.
 */

/** fixtures 엠블럼과 같은 FotMob CDN. 없는 선수는 404라 <img> onError 폴백에 맡긴다. */
export function playerPhotoUrl(fotmobPlayerId: number): string {
  return `https://images.fotmob.com/image_resources/playerimages/${fotmobPlayerId}.png`
}
