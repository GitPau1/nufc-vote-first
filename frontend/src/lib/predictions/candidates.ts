/**
 * 선수 픽 후보 — 이번 단계에서는 고정 더미다.
 * players 테이블은 "역대 선수" 403명(사진·등번호 없음)이라 현재 스쿼드 후보로 그대로 쓸 수 없고,
 * 배당(multiplier) 산식도 아직 정해지지 않았다.
 * ponytail: 현재 스쿼드 소스와 배당 산식이 정해지면 lib/queries/ 로 옮긴다.
 */

export const POSITIONS = ['DEF', 'MID', 'FWD'] as const
export type Position = (typeof POSITIONS)[number]

export const POSITION_LABEL: Record<Position, string> = {
  DEF: '수비수',
  MID: '미드필더',
  FWD: '공격수',
}

export type Candidate = {
  id: string
  name: string
  position: Position
  multiplier: number
  squadNumber: number
  nationality: string
  age: number
  photoUrl: string | null
}

export const CANDIDATES: Record<Position, Candidate[]> = {
  DEF: [
    { id: 'def-botman',     name: '보터',      position: 'DEF', multiplier: 2.1, squadNumber: 4,  nationality: '네덜란드', age: 26, photoUrl: null },
    { id: 'def-trippier',   name: '트리피어',  position: 'DEF', multiplier: 1.4, squadNumber: 2,  nationality: '잉글랜드', age: 35, photoUrl: null },
    { id: 'def-schar',      name: '스카르',    position: 'DEF', multiplier: 1.9, squadNumber: 5,  nationality: '스위스',   age: 34, photoUrl: null },
    { id: 'def-livramento', name: '리브라멘투', position: 'DEF', multiplier: 2.6, squadNumber: 14, nationality: '잉글랜드', age: 23, photoUrl: null },
  ],
  MID: [
    { id: 'mid-guimaraes', name: '기마랑이스', position: 'MID', multiplier: 1.7, squadNumber: 39, nationality: '브라질',   age: 28, photoUrl: null },
    { id: 'mid-bruno',     name: '브루노',    position: 'MID', multiplier: 1.3, squadNumber: 7,  nationality: '포르투갈', age: 24, photoUrl: null },
    { id: 'mid-willock',   name: '윌록',      position: 'MID', multiplier: 1.5, squadNumber: 28, nationality: '잉글랜드', age: 26, photoUrl: null },
  ],
  FWD: [
    { id: 'fwd-isak',   name: '이삭',  position: 'FWD', multiplier: 2.6, squadNumber: 9,  nationality: '스웨덴',   age: 26, photoUrl: null },
    { id: 'fwd-gordon', name: '고든',  position: 'FWD', multiplier: 1.9, squadNumber: 10, nationality: '잉글랜드', age: 25, photoUrl: null },
    { id: 'fwd-barnes', name: '반스',  position: 'FWD', multiplier: 2.2, squadNumber: 11, nationality: '잉글랜드', age: 26, photoUrl: null },
  ],
}
