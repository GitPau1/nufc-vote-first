# 11 — 디자인 시스템

LDSG(LINE Design System for Global Family Service) 기반으로,
Newcastle United 브랜드 색상을 적용한 커스텀 디자인 시스템.

> 레퍼런스: `design.md` (LDSG 원본 연구 자료)
> 와이어프레임: `vault/99_old/prototypes/prototype.html`

---

## 브랜딩 결정사항

| 항목 | 결정 | 이유 |
|------|------|------|
| Primary 색 | `#41b6e6` (Newcastle 하늘색) | LDSG의 LINE Green 자리를 대체 |
| 테마 | 라이트 모드 우선 | 다크 모드는 MVP 이후 |
| 언어/폰트 | Pretendard Variable (한국어) | LDSG KR 폴백 권장 폰트 |
| 기본 배경 | `#fafafa` | LDSG on-gray 그룹 표면 |

---

## 색상 토큰

```css
/* Brand */
--c-primary:       #41b6e6;   /* Newcastle 하늘색 */
--c-primary-dim:   rgba(65,182,230,0.12);  /* 선택 배경, 강조 배경 */
--c-primary-dark:  #1a9fd4;   /* 텍스트·아이콘 위 primary */
--c-primary-on:    #ffffff;   /* primary 배경 위 텍스트 */

/* Neutral */
--c-black:         #111111;   /* 본문 텍스트 */
--c-gray-1:        #333333;
--c-gray-2:        #666666;   /* 부제, 설명 */
--c-gray-3:        #a8a8a8;   /* 힌트, 메타 */
--c-gray-4:        #e1e7ef;   /* 테두리, 구분선 */
--c-disabled:      #ebebeb;   /* 비활성 배경 */

/* Surface */
--c-bg:            #fafafa;   /* 전체 배경 (on-gray 표면) */
--c-surface:       #ffffff;   /* 카드, 입력창, 헤더 */

/* Role */
--c-positive:      #2e9e4f;
--c-positive-dim:  #e6f4ea;
--c-negative:      #d93025;
--c-negative-dim:  #fce8e6;
```

### 상태 처리 원칙 (LDSG)
색상을 바꾸지 않고 **opacity**로 표현:
- Normal: `opacity: 1`
- Hover: `opacity: 0.7`
- Pressed: `opacity: 0.5`
- Disabled: `--c-disabled` 배경 + `--c-gray-3` 텍스트

---

## 타이포그래피

폰트: `'Pretendard Variable', Pretendard, -apple-system, sans-serif`

Wanted Design Library의 역할 기반 타입 스케일을 따른다. 텍스트 토큰은 크기만이 아니라 **사용 맥락**을 포함한다.

| 토큰 | px | line-height | letter-spacing | 용도 |
|------|----|-------------|----------------|------|
| `display-1` | 56px | 72px | -0.0319em | 가장 강한 시각 강조. 큰 히어로·프로모션 전용 |
| `display-2` | 40px | 52px | -0.0282em | 두 번째 단계의 프로모션 헤드라인 |
| `title-1` | 36px | 48px | -0.027em | 큰 화면의 주요 타이틀 |
| `title-2` | 28px | 38px | -0.0236em | 중간 화면의 주요 타이틀 |
| `title-3` | 24px | 32px | -0.023em | 작은 화면의 주요 타이틀 |
| `heading-1` | 22px | 30px | -0.0194em | 섹션의 주요 제목 |
| `heading-2` | 20px | 28px | -0.012em | 작은 화면 또는 좁은 영역의 섹션 제목 |
| `headline-1` | 18px | 26px | -0.002em | 본문 상위 내용 강조, 카드 내 큰 제목 |
| `headline-2` | 17px | 24px | 0em | 작은 화면의 본문 상위 강조 |
| `body-1-normal` | 16px | 24px | 0.0057em | 일반 본문, 설정 항목, 짧은 설명 |
| `body-1-reading` | 16px | 26px | 0.0057em | 긴 문단, 댓글 본문처럼 읽기 밀도가 높은 텍스트 |
| `body-2-normal` | 15px | 22px | 0.0096em | 대체 본문, 옵션 텍스트, 버튼 라벨 |
| `body-2-reading` | 15px | 24px | 0.0096em | 작은 크기의 긴 설명 문단 |
| `label-1-normal` | 14px | 20px | 0.0145em | 폼 라벨, 리스트 보조 제목, 일반 라벨 |
| `label-1-reading` | 14px | 22px | 0.0145em | 라벨 크기의 긴 안내 문구 |
| `label-2` | 13px | 18px | 0.0194em | 낮은 위계의 라벨, 보조 UI 텍스트 |
| `caption-1` | 12px | 16px | 0.0252em | 메타 정보, 보조 설명, 작은 버튼 라벨 |
| `caption-2` | 11px | 14px | 0.0311em | 가장 낮은 위계의 메타, 뱃지, section-label |

### 타이포그래피 적용 원칙

- `display-*`와 `title-*`은 일반 앱 화면의 반복 UI에 쓰지 않고, 강한 마케팅·온보딩·상태 강조가 필요한 경우에만 쓴다.
- 카드 제목, 모달 제목, 섹션 제목은 우선 `heading-*` 또는 `headline-*`에서 고른다.
- 버튼 라벨과 투표 옵션처럼 짧고 조작 가능한 텍스트는 `body-2-normal`을 기본으로 한다.
- 댓글, 안내문, 투표 설명처럼 줄이 길어지는 텍스트는 `body-1-reading` 또는 `body-2-reading`을 쓴다.
- 폼 라벨과 보조 UI 텍스트는 `label-*`, 메타 정보와 뱃지는 `caption-*`을 쓴다.
- 새로운 임의 `text-[Npx]` 조합을 만들기 전에 위 토큰 중 가장 가까운 역할을 먼저 선택한다.

---

## 레이아웃 / 그리드

Wanted Design Library의 모바일 우선 그리드 원칙을 NUFC Vote 앱 셸에 맞게 적용한다. 데스크톱 12컬럼 그리드는 현재 MVP 범위 밖이며, 이 프로젝트의 기준은 `360px`부터 `480px`까지의 모바일 앱 화면이다.

### 화면 기준

| 기준 | 값 | 용도 |
|------|----|------|
| Android minimum | 360px | 최소 지원 폭 |
| iOS baseline | 375px | 기본 설계 폭 |
| App shell max | 480px | 현재 Next.js 앱의 최대 표시 폭 |

### 페이지 마진

| 토큰 | 값 | 용도 |
|------|----|------|
| `--layout-margin` | 16px | 일반 화면 좌우 기본 마진 |
| `--layout-margin-comfort` | 20px | 그리드가 강조되는 화면, 넓은 호흡이 필요한 섹션 |
| `--layout-full-bleed` | 0px | 표지 이미지, 하단 고정 CTA, bottom nav 같은 명확한 예외 |

기본 페이지 컨텐츠는 `16px` 좌우 마진을 쓴다. `20px`는 Wanted의 모바일 그리드 감각을 따르되, 현재 앱의 `480px` 셸 안에서 여백이 과해지는 화면에는 강제하지 않는다.

### 모바일 컬럼 그리드

```css
/* Mobile base grid */
grid-template-columns: repeat(2, minmax(0, 1fr));
column-gap: 16px;
padding-inline: 16px;
max-width: 480px;
```

- 모바일 기본 그리드는 2컬럼이다.
- 컬럼 간격은 기본 `16px`, 여유가 필요한 그리드형 화면은 `20px`까지 허용한다.
- `480px` 앱 셸 안에서도 기본은 2컬럼을 유지한다.
- 3컬럼은 `season-stat-card`처럼 반복 요약 정보가 명확한 컴포넌트 내부에서만 사용한다.
- 표지 이미지, 상세 상단 미디어, 하단 CTA처럼 화면의 가장자리까지 닿아야 하는 영역만 full-bleed를 허용한다.

### 간격 스케일

기본 간격은 4px 배수로 설계한다.

| 토큰 | 값 | 용도 |
|------|----|------|
| `space-1` | 4px | 아이콘과 텍스트의 아주 작은 간격 |
| `space-2` | 8px | 작은 컨트롤 내부 간격 |
| `space-3` | 12px | 리스트 아이템 내부 간격 |
| `space-4` | 16px | 페이지 기본 마진, 카드 내부 기본 padding |
| `space-5` | 20px | 모바일 컬럼 그리드 여유 간격 |
| `space-6` | 24px | 섹션 간격 |
| `space-8` | 32px | 큰 섹션 간격 |
| `space-10` | 40px | 화면 단위 상하 여백 |

- `1px`과 `2px`는 border, hairline divider, 아이콘 optical alignment 보정에만 사용한다.
- 임의의 `gap-[Npx]`, `px-[Npx]`는 새 컴포넌트 패턴으로 문서화하지 않는 한 만들지 않는다.
- 컴포넌트 내부의 고정 포맷 레이아웃은 예외를 둘 수 있지만, 예외 값은 해당 컴포넌트 섹션에 명시한다.

---

## Radius 토큰 (LDSG ldsg-radius-* 스케일)

| 토큰 | 값 | 사용처 |
|------|-----|--------|
| `--r-xs` | 8px | 스켈레톤 플레이스홀더, 작은 배지 |
| `--r-sm` | 10px | 버튼, 입력창, 옵션 버튼 |
| `--r-md` | 12px | 작은 패널, 내부 그룹, 보조 컨테이너 |
| `--r-lg` | 16px | 카드 기본값, Bottom Sheet, 모달 상단 |
| `--r-pill` | 9999px | Chip, Dot 인디케이터, 플로팅 버튼 |

---

## Shadow 토큰 (LDSG 배경별 분리)

배경색에 따라 그림자 그룹을 나눠 사용한다.

```css
/* On White (#ffffff) 배경 위 컴포넌트 */
--sh-w100: 0px 0px 2px rgba(0,0,0,.07), 0px 1px 2px rgba(0,0,0,.07);  /* 헤더, 소형 컴포넌트 */
--sh-w200: 0px 1px 6px rgba(0,0,0,.12);   /* 버튼 (contained), Google 로그인 버튼 */
--sh-w300: 0px 1px 20px rgba(0,0,0,.07);  /* Bottom Sheet, 대형 카드 */

/* On Gray (#fafafa) 배경 위 컴포넌트 */
--sh-g100: 0px 0px 1px rgba(0,0,0,.05), 0px 1px 1px rgba(0,0,0,.05);  /* 소형 */
--sh-g200: 0px 1px 4px rgba(0,0,0,.06);   /* 투표 카드, 결과 카드, 프로필 카드 */
--sh-g300: 0px 1px 15px rgba(0,0,0,.04);  /* 대형 시트 */
```

> 원칙: `--c-bg` (#fafafa) 배경이면 `sh-g*`, `--c-surface` (#ffffff) 배경이면 `sh-w*`

---

## 컴포넌트 패턴

### radio-button (투표 옵션 선택)

```
( ) 재계약    ← 미선택: 회색 테두리 원 + 회색 border
(●) 보류     ← 선택: primary 원 dot + primary border + primary-dim 배경
( ) 방출
```

```css
/* 컨테이너 */
border: 1px solid var(--c-gray-4);
border-radius: var(--r-sm);    /* 10px */
padding: 14px 16px;
background: var(--c-surface);

/* 선택 시 */
border-color: var(--c-primary);
background: var(--c-primary-dim);

/* 인디케이터 (20px 원) */
/* 선택 시: ::after { 9px dot, background: primary } */
```

### action-button 3종

| 타입 | 배경 | 텍스트 | 테두리 | 사용처 |
|------|------|--------|--------|--------|
| contained | `--c-primary` | `--c-primary-on` | 없음 | 1차 CTA |
| outlined | transparent | `--c-black` | `1px --c-gray-4` | 취소, 로그아웃 |
| ghost | transparent | `--c-gray-2` | 없음 | 닫기, 서브 액션 |
| destructive | `--c-negative-dim` | `--c-negative` | `1px rgba(negative,.2)` | 탈퇴, 삭제 |

공통: `border-radius: 10px`, `font-weight: 700`, `font-size: 15px`, `padding: 14px`

### action-button-full-bleed

```css
border-radius: 0;           /* LDSG full-bleed 규칙 */
width: 100%;
padding: 17px;
position: absolute;
bottom: 0; left: 0; right: 0;
background: var(--c-primary);
```

투표 상세 페이지 하단 고정 제출 버튼 전용. 화면 최하단 1차 액션에만 사용.

### chip (뱃지·태그)

```css
border-radius: var(--r-pill);
padding: 3px 9px;
font-size: 11px; font-weight: 600;
```

| 종류 | 배경 | 텍스트 | 사용처 |
|------|------|--------|--------|
| `chip-eval` | `#fff3e0` | `#d46a00` | Type A 투표 |
| `chip-select` | `positive-dim` | `positive` | Type B 투표 |
| `chip-closed` | `disabled` | `gray-3` | 마감 투표 |
| `chip-deadline` | `negative-dim` | `negative` | 마감 D-day |
| `chip-primary` | `primary-dim` | `primary-dark` | 내 선택, 강조 |
| `chip-done` | `positive-dim` | `positive` | 투표 완료 |
| `chip-vote` | `primary-dim` | `primary-dark` | 댓글 투표 뱃지 (재계약 계열) |
| `chip-vote-neg` | `negative-dim` | `negative` | 댓글 투표 뱃지 (방출 계열) |
| `chip-vote-neutral` | `disabled` | `gray-2` | 댓글 투표 뱃지 (보류 계열) |
| `chip-post-official` | `primary-dim` | `primary-dark` | 소식 게시글 유형 (오피셜) |
| `chip-post-info` | `positive-dim` | `positive` | 소식 게시글 유형 (정보) |
| `chip-post-free` | `disabled` | `gray-2` | 소식 게시글 유형 (자유) |

### list-group / list-item

```css
/* list-group */
background: var(--c-surface);
border-radius: var(--r-lg);    /* 16px */
overflow: hidden;
box-shadow: var(--sh-g200);    /* on-gray 배경 위 */

/* list-item */
padding: 16px;
display: flex; align-items: center; gap: 12px;

/* 구분선 */
list-item + list-item {
  border-top: 0.5px solid var(--c-disabled);
}
```

마이페이지 참여 투표 목록, 댓글 목록에 사용.

### post-feed / post-card

소식 탭 전용 독립 피드 컴포넌트. 일반 `list-group`의 단순 확장이 아니라, 필터·정렬·작성 진입·임베드·반응을 포함하는 별도 패턴으로 관리한다.

```css
/* feed controls */
background: rgba(250,250,250,.96);
border-bottom: 1px solid rgba(225,231,239,.78);
backdrop-filter: blur(10px);

/* filter tab */
height: 44px;
font-size: 14px;
font-weight: 900;
color: var(--c-gray-2);

/* active filter tab */
color: var(--c-primary-dark);
border-bottom: 3px solid var(--c-primary);

/* sort select */
height: 32px;
border: 1px solid var(--c-gray-4);
border-radius: var(--r-pill);
background: var(--c-surface);

/* feed shell */
background: var(--c-surface);
border: 1px solid var(--c-gray-4);
border-radius: var(--r-lg);
box-shadow: var(--sh-g200);

/* post-card */
padding: 16px;
border-bottom: 1px solid var(--c-gray-4);
background: var(--c-surface);
```

`post-card`는 작성자 라인, inline post type chip, 본문, URL 임베드, 반응 행, 작성자 전용 수정/삭제 컨트롤 순서로 배치한다. 작성자 표시는 카드 내부 전용 `post-avatar`를 사용하며, 일반 `avatar`보다 작은 20px 크기를 허용한다. 작성 시각과 수정됨 표시는 작성자 이름 오른쪽의 같은 줄에 둔다.

### post-composer-sheet

소식 작성 전용 Bottom Sheet. `modal-sheet`의 overlay, handle, top radius, shadow 규칙을 따른다.

```css
/* type segmented control */
display: inline-flex;
border: 1px solid var(--c-gray-4);
border-radius: var(--r-sm);
background: var(--c-bg);
padding: 3px;

/* segment */
height: 32px;
border-radius: var(--r-xs);
padding: 0 12px;
font-size: 12px;
font-weight: 700;

/* active segment */
background: var(--c-primary);
color: var(--c-primary-on);

/* textarea / url input */
border: 1px solid var(--c-gray-4);
border-radius: var(--r-sm);
background: var(--c-bg);

/* focus */
border-color: var(--c-primary);
background: var(--c-surface);
```

### post-reaction-chip

소식 카드 내 이모지 반응 버튼. 선택 상태는 contained 버튼처럼 강하게 채우지 않고 chip 계열의 낮은 강조 톤을 사용한다.

```css
height: 32px;
border: 1px solid var(--c-gray-4);
border-radius: var(--r-pill);
background: var(--c-bg);
color: var(--c-gray-2);
font-size: 12px;
font-weight: 900;

/* active */
border-color: rgba(65,182,230,.4);
background: var(--c-primary-dim);
color: var(--c-primary-dark);
```

### post-embed-card

소식 카드에 첨부된 URL 미리보기. 일반 링크, X, YouTube를 지원하되, 실패 시 일반 링크 카드로 대체한다.

```css
margin-top: 12px;
border: 1px solid var(--c-gray-4);
border-radius: var(--r-sm);
background: var(--c-bg);

/* YouTube */
aspect-ratio: 16 / 9;
background: #0c2340;
```

### post-fab

소식 작성 전용 플로팅 버튼. 화면 하단 내비게이션 위에 위치하며, 일반 contained button이나 Bottom Sheet shadow를 재사용하지 않고 FAB 전용 elevation을 사용한다.

```css
width: 54px;
height: 54px;
border-radius: var(--r-pill);
background: var(--c-primary);
color: var(--c-primary-on);
box-shadow: 0 8px 22px rgba(26,159,212,.36);
```

### modal-sheet (Bottom Sheet)

```css
border-radius: 16px 16px 0 0;   /* --r-lg top only */
padding: 20px 20px 40px;
box-shadow: var(--sh-w300);

/* handle bar */
width: 36px; height: 4px;
background: var(--c-gray-4);
border-radius: var(--r-pill);
```

딤드 오버레이 (`rgba(0,0,0,.46)`) + 하단 슬라이드업. 확인 모달, 로그인 유도, 탈퇴 확인에 공통 사용.

### text-input

```css
border: 1px solid var(--c-gray-4);
border-radius: var(--r-sm);    /* 10px */
padding: 11px 13px;
font-size: 14px;

/* focus */
border-color: var(--c-primary);   /* 테두리 색만 변경, glow 없음 */
outline: none;
```

### poll-card (목록 카드)

```css
background: var(--c-surface);
border-radius: var(--r-lg);    /* 16px */
overflow: hidden;
box-shadow: var(--sh-g200);    /* on-gray 배경 위 */
```

### poll-carousel-card (투표 상세 캐러셀 카드)

`selection`, `question_targets`, `free_choice`처럼 카드를 넘겨 하나를 선택하는 투표 상세 화면에 사용한다.
사진 위 텍스트 오버레이를 금지하고, 텍스트는 항상 하단 `surface` 정보 패널에 배치한다.

공통 규칙:
- 이미지 영역은 항상 `1:1` 정사각형이다.
- 카드 표면은 `--c-surface`, `border: 1px solid --c-gray-4`, `border-radius: --r-lg`, `box-shadow: --sh-g200`.
- 선택 상태는 `border-color: --c-primary` + `3px` inset ring + 우상단 primary check로 표시한다.
- 사이드 카드는 같은 구조를 유지하고 opacity/scale만 낮춘다.
- 이미지가 없으면 클럽 네이비 계열 fallback 배경과 2글자 이니셜을 사용한다.

선수 카드:
```css
/* image */
aspect-ratio: 1 / 1;

/* info */
min-height: 62px;
padding: 10px 12px;

/* title */
font-size: 15px;
font-weight: 900;
line-height: 1.22;
line-clamp: 1;

/* meta */
font-size: 12px;
font-weight: 700;
color: var(--c-gray-2);
```

- 표시 정보는 선수 이름과 포지션만 둔다.
- 등번호는 이미지 좌상단 pill chip에서 1회만 표시한다.
- 선수 후보에는 사용자가 추가로 작성하는 설명 문구가 없으므로 설명 영역을 만들지 않는다.

자유 입력 카드:
```css
/* image */
aspect-ratio: 1 / 1;

/* info */
min-height: 92px;
padding: 10px 12px;

/* title */
font-size: 15px;
font-weight: 900;
line-height: 1.22;
line-clamp: 2;

/* description */
margin-top: 6px;
font-size: 12px;
font-weight: 500;
line-height: 1.36;
line-clamp: 2;
color: var(--c-gray-2);
```

- `자유 선택` 같은 유형 라벨은 카드 내부에 노출하지 않는다.
- 사용자가 입력한 제목과 설명만 보여준다.

### progress

투표 결과 분포, 평점 진행률 등 비율을 표시할 때 사용한다.

```css
height: 8px;
border-radius: var(--r-pill);
background: var(--c-disabled);

/* indicator */
background: var(--c-primary);
transition: transform .2s;
```

### separator

목록 내부 또는 섹션 사이의 구분선. 새 색상을 만들지 않고 `--c-gray-4` 또는 `--c-disabled`를 사용한다.

```css
height: 1px;       /* 필요 시 0.5px border로 대체 */
background: var(--c-gray-4);
```

### app-header / bottom-nav

서비스 공통 내비게이션.

```css
/* app-header */
background: rgba(255,255,255,.95);
border-bottom: 1px solid var(--c-gray-4);
box-shadow: var(--sh-w100);

/* bottom-nav */
background: var(--c-surface);
border-top: 1px solid var(--c-gray-4);

/* active item */
color: var(--c-primary);
```

### transfer-item

이적 탭의 선수 카드. 방향 라벨, 선수 썸네일, 이름, 클럽 정보를 중앙 정렬로 표시한다.

```css
background: var(--c-surface);
border: 1px solid var(--c-gray-4);
border-radius: var(--r-lg);
box-shadow: var(--sh-g200);
```

### farewell-card

작별/영입 카드. 이적 방향은 `chip` 톤으로 표현하고, 카드 자체는 `poll-card`와 같은 표면 규칙을 따른다.

```css
background: var(--c-surface);
border-radius: var(--r-lg);
box-shadow: var(--sh-g200);
```

### season-stat-card

구단 정보 페이지의 시즌 대표 기록 3열 카드. `최다 출전`, `최다 득점`, `최다 어시`처럼 같은 구조의 요약 지표를 나란히 보여준다.

```css
/* grid */
display: grid;
grid-template-columns: repeat(3, minmax(0, 1fr));
gap: 8px;

/* card */
background: var(--c-surface);
border: 1px solid var(--c-gray-4);
border-radius: var(--r-lg);
box-shadow: var(--sh-g200);
padding: 12px 10px;
text-align: center;

/* player image */
width: 64px;
height: 64px;
border-radius: var(--r-pill);
background: var(--c-primary-dim);
```

카드 내부 순서는 label, 선수 이미지, 선수 이름, 수치, 단위로 고정한다. 이름은 한 줄로 줄이고, 수치는 `primary` 색과 강한 weight를 사용한다.

### club-status-card

구단 현황처럼 브랜드가 강한 요약 카드. 예외적으로 클럽 네이비 배경 또는 `#0c2340 → #1a3a60` 그라디언트를 허용하되, 내부 보조 카드는 흰색 opacity 표면을 사용한다.

```css
background: #0c2340; /* or linear-gradient(135deg, #0c2340 0%, #1a3a60 100%) */
border-radius: var(--r-lg);
box-shadow: var(--sh-g200);
color: #fff;

/* inner panel */
background: rgba(255,255,255,.08);
border-radius: var(--r-lg);
```

### squad-list

스쿼드 목록은 소식 피드와 같은 underline tab, position header, player row로 구성한다.

```css
/* status tab row */
display: flex;
gap: 16px;
overflow-x: auto;
border-bottom: 1px solid var(--c-gray-4);

/* tab */
height: 44px;
font-size: 14px;
font-weight: 900;
color: var(--c-gray-2);

/* active tab */
color: var(--c-primary-dark);
border-bottom: 3px solid var(--c-primary);

/* group */
background: var(--c-surface);
border: 1px solid var(--c-gray-4);
border-radius: var(--r-lg);
```

선수 행 hover/pressed는 색을 바꾸지 않고 opacity로만 표현한다.

### rating-matrix

전체 평가 투표의 반복 입력 패턴. 선수 행과 1-10점 선택 버튼을 묶는다.

```css
/* score option */
border: 1px solid var(--c-gray-4);
border-radius: var(--r-sm);

/* selected */
border-color: var(--c-primary);
background: var(--c-primary-dim);
color: var(--c-primary-dark);
```

### form-section / picker

투표 생성·관리자 폼의 기본 섹션. 선택형 picker는 dashed border를 사용한다.

```css
background: var(--c-surface);
border: 1px solid var(--c-gray-4);
border-radius: var(--r-lg);
box-shadow: var(--sh-g200);

/* picker */
border-style: dashed;
```

---

## 아이콘

- LDSG 공식: LAICON 라이브러리 (Next.js 앱에서는 미적용)
- MVP 대체: Lucide React (shadcn/ui 번들 포함)
- 아이콘 크기 기준: 16px(인라인), 18px(버튼), 20px(헤더·강조)

---

## Tailwind 설정 방향

```js
// tailwind.config.js
theme: {
  extend: {
    colors: {
      primary: '#41b6e6',
      'primary-dark': '#1a9fd4',
      disabled: '#ebebeb',
      surface: '#ffffff',
      positive: '#2e9e4f',
      negative: '#d93025',
      // ... 위 토큰 그대로 매핑
    },
    borderRadius: {
      'xs': '8px', 'sm': '10px', 'md': '12px', 'lg': '16px', // cards use lg
    },
    boxShadow: {
      'w100': '0px 0px 2px rgba(0,0,0,.07), 0px 1px 2px rgba(0,0,0,.07)',
      'w200': '0px 1px 6px rgba(0,0,0,.12)',
      'g200': '0px 1px 4px rgba(0,0,0,.06)',
      // ...
    },
    fontFamily: {
      sans: ['Pretendard Variable', 'Pretendard', '-apple-system', 'sans-serif'],
    },
  },
}
```

shadcn/ui 컴포넌트는 이 토큰을 기반으로 커스터마이징하여 사용.
