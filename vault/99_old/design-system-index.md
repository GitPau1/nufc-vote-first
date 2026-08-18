# 디자인 시스템 인덱스

> 전체 상세: `vault/99_old/specs/11-design-system.md`
> LDSG 원본 연구: `design.md`
> 와이어프레임 레퍼런스: `vault/99_old/prototypes/prototype.html`

---

## 핵심 토큰 요약

### 색상
```
Primary:        #41b6e6   (Newcastle 하늘색)
Primary dim:    rgba(65,182,230,0.12)
Primary dark:   #1a9fd4
Background:     #fafafa   (전체 배경)
Surface:        #ffffff   (카드·헤더)
Black:          #111111
Gray-2:         #666666   (설명 텍스트)
Gray-3:         #a8a8a8   (힌트·메타)
Gray-4:         #e1e7ef   (테두리)
Disabled:       #ebebeb
Positive:       #2e9e4f / dim: #e6f4ea
Negative:       #d93025 / dim: #fce8e6
```

### Radius
```
8px  — 스켈레톤 등 소형
10px — 버튼, 입력창, 옵션 버튼
12px — 작은 패널, 내부 그룹, 보조 컨테이너
16px — 카드 기본값, Bottom Sheet 상단, 모달
pill — Chip, dot 인디케이터, 플로팅 버튼
```

### 레이아웃 / 그리드
```
모바일 우선 기준:
Android minimum  360px
iOS baseline     375px
App shell max    480px

페이지 마진:
기본        16px
Comfort     20px  — 그리드 강조 화면, 넓은 호흡이 필요한 섹션
Full-bleed   0px  — 표지 이미지, 하단 고정 CTA, bottom nav

모바일 컬럼 그리드:
columns      2
gutter       16px 기본, 20px comfort 허용
max-width    480px 앱 셸

간격 스케일:
4, 8, 12, 16, 20, 24, 32, 40

1px/2px는 border, hairline divider, icon optical alignment 보정에만 사용한다.
3 columns는 season-stat-card처럼 반복 요약 컴포넌트 내부에서만 허용한다.
```

### Shadow (배경별 분리)
```
on-gray 배경(#fafafa) 위:
  g200: 0px 1px 4px rgba(0,0,0,.06)  ← 카드에 사용

on-white(#fff) 배경 위:
  w100: 0px 0px 2px rgba(0,0,0,.07), 0px 1px 2px rgba(0,0,0,.07)  ← 헤더
  w200: 0px 1px 6px rgba(0,0,0,.12)   ← contained 버튼
  w300: 0px 1px 20px rgba(0,0,0,.07)  ← Bottom Sheet
```

### 타이포그래피
```
폰트: 'Pretendard Variable', Pretendard, -apple-system, sans-serif

Wanted Design Library 기반 역할형 스케일:

display-1        56px / 72px  / -0.0319em — 가장 강한 히어로·프로모션 강조
display-2        40px / 52px  / -0.0282em — 두 번째 단계의 프로모션 헤드라인
title-1          36px / 48px  / -0.027em  — 큰 화면의 주요 타이틀
title-2          28px / 38px  / -0.0236em — 중간 화면의 주요 타이틀
title-3          24px / 32px  / -0.023em  — 작은 화면의 주요 타이틀
heading-1        22px / 30px  / -0.0194em — 섹션의 주요 제목
heading-2        20px / 28px  / -0.012em  — 작은 화면·좁은 영역 섹션 제목
headline-1       18px / 26px  / -0.002em  — 카드 내 큰 제목, 본문 상위 강조
headline-2       17px / 24px  / 0em       — 작은 화면의 본문 상위 강조
body-1-normal    16px / 24px  / 0.0057em  — 일반 본문, 짧은 설명
body-1-reading   16px / 26px  / 0.0057em  — 긴 문단, 댓글 본문
body-2-normal    15px / 22px  / 0.0096em  — 옵션 텍스트, 버튼 라벨
body-2-reading   15px / 24px  / 0.0096em  — 작은 크기의 긴 설명 문단
label-1-normal   14px / 20px  / 0.0145em  — 폼 라벨, 리스트 보조 제목
label-1-reading  14px / 22px  / 0.0145em  — 라벨 크기의 긴 안내 문구
label-2          13px / 18px  / 0.0194em  — 낮은 위계의 라벨
caption-1        12px / 16px  / 0.0252em  — 메타 정보, 작은 버튼 라벨
caption-2        11px / 14px  / 0.0311em  — 뱃지, section-label
```

---

## 컴포넌트 목록

| 컴포넌트 | 설명 | 상세 위치 |
|---------|------|----------|
| `radio-button` | 투표 옵션 선택. 왼쪽 원형 인디케이터 + 라벨. 선택 시 primary-dim 배경 + dot 표시 | 11-design-system.md |
| `btn-contained` | 1차 CTA. primary 배경, radius 10px, shadow w200 | 11-design-system.md |
| `btn-outlined` | 취소·로그아웃. 투명 배경, gray-4 테두리 | 11-design-system.md |
| `btn-ghost` | 닫기 등 서브 액션 | 11-design-system.md |
| `btn-destructive` | 탈퇴·삭제. negative-dim 배경 | 11-design-system.md |
| `btn-full-bleed` | 투표 상세 하단 고정 제출 버튼. border-radius 0, 전체 너비 | 11-design-system.md |
| `chip` | 뱃지·태그. pill radius. 9종 (eval/select/closed/deadline/primary/done/vote/vote-neg/vote-neutral) | 11-design-system.md |
| `poll-card` | 투표 목록 카드. surface 배경, radius 16px, shadow g200 | 11-design-system.md |
| `poll-carousel-card` | 투표 상세 캐러셀 카드. 1:1 이미지 + 하단 정보 패널. 선수형/자유 입력형 분리 | 11-design-system.md |
| `list-group` / `list-item` | 마이페이지·댓글 목록. 0.5px divider | 11-design-system.md |
| `post-feed` / `post-card` | 소식 탭 독립 피드. filter tabs + sort select + surface feed shell + post-card item | 11-design-system.md |
| `post-fab` | 소식 작성 전용 FAB. 54px pill, primary 배경, elevated primary shadow | 11-design-system.md |
| `post-composer-sheet` | 소식 작성 Bottom Sheet. segmented type control + textarea + URL input + submit | 11-design-system.md |
| `post-reaction-chip` | 소식 카드 내 이모지 반응. pill, bg surface/bg, active primary-dim | 11-design-system.md |
| `modal-sheet` | Bottom Sheet. radius 16px top, shadow w300 | 11-design-system.md |
| `text-input` | 댓글 입력창. 1px gray-4 테두리, focus 시 primary border | 11-design-system.md |
| `progress` | 결과 분포와 진행률. 8px height, pill radius, disabled track + primary indicator | 11-design-system.md |
| `separator` | 섹션/목록 구분선. gray-4 또는 disabled 사용 | 11-design-system.md |
| `app-header` / `bottom-nav` | 공통 내비게이션. surface 배경, thin border, active primary | 11-design-system.md |
| `avatar` | 32px 원형, primary 배경 | 11-design-system.md |
| `section-label` | 섹션 구분 레이블. 11px / 600 / uppercase / gray-3 | 11-design-system.md |
| `transfer-item` | 이적 탭 선수 카드. 방향 라벨 + 원형 썸네일 + 클럽 메타 | 11-design-system.md |
| `farewell-card` | 영입/이탈 카드. 방향 chip + 선수/클럽 요약 | 11-design-system.md |
| `season-stat-card` | 구단 정보 시즌 스탯 3열 카드. label + 64px 선수 이미지 + 이름 + 수치 | 11-design-system.md |
| `club-status-card` | 구단 현황 요약. 클럽 네이비 예외 배경 + 내부 opacity 패널 | 11-design-system.md |
| `squad-list` | feed-style underline tab + position group + player row | 11-design-system.md |
| `rating-matrix` | 전체 평가 투표의 선수별 점수 선택 매트릭스 | 11-design-system.md |
| `form-section` / `picker` | 투표 생성·관리자 폼의 surface 섹션과 dashed picker | 11-design-system.md |

---

## 상태 처리 원칙

색상 변경 없이 **opacity**로만 처리:
- Hover: `opacity: 0.7`
- Pressed: `opacity: 0.5`
- Disabled: `--c-disabled` 배경 + `--c-gray-3` 텍스트

---

## Tailwind 설정 포인트

```js
// tailwind.config.js 핵심 override
colors: { primary: '#41b6e6', 'primary-dark': '#1a9fd4', ... }
borderRadius: { 'xs': '8px', 'sm': '10px', 'md': '12px', 'lg': '16px' } // cards use lg
boxShadow: { 'g200': '0px 1px 4px rgba(0,0,0,.06)', ... }
fontFamily: { sans: ['Pretendard Variable', 'Pretendard', ...] }
```
