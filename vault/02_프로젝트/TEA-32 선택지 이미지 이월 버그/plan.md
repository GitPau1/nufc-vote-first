# TEA-32 선택지 이미지 이월 버그 — plan

간소 사이클(이슈 본문 = spec). 이 문서는 실측 근거 → 변경 계획 → 영향 테스트 → 검증 순서.

## 1. 실측 (2026-09-05 기준 코드)

`frontend/src/components/composition/polls/UserPollCreateForm.tsx`

- `UnifiedOption` 타입(16줄): `{ label, description, imageUrl, playerId }` — id 필드 없음.
- state 초기화(26-29줄): 옵션 2개를 배열 리터럴로 생성.
- `addOption`(60-62줄): `setOptions(prev => [...prev, { ... }])` — 새 옵션도 id 없이 push.
- `removeOption`(64-66줄): `setOptions(prev => prev.filter((_, itemIndex) => itemIndex !== index))` — 인덱스 기준 삭제. 이게 이월의 근본 원인: 삭제 시 뒤 옵션들이 배열에서 한 칸씩 앞으로 당겨지지만, React는 `key={index}`(294줄)를 보고 "같은 자리의 다른 옵션"이 아니라 "그 자리 컴포넌트가 그대로 있다"고 판단해 `CroppedImageInput` 인스턴스(및 그 내부 `useState` 크롭 상태)를 재사용한다.
- 렌더(291-353줄): `options.map((option, index) => ...)`, `key={index}`(294줄), 이미지 입력 `name={`option_image_${index}`}`(337-338줄).
- 제출(115-136줄): `cleaned`는 `options.map((option, index) => ({ ...option, imageField: `option_image_${index}` }))` 후 `label` 빈 값만 필터 — **필터링 후에도 각 옵션의 `imageField`는 필터 이전(원본 배열) 인덱스를 그대로 갖고 있다.** 즉 `imageField` 계산 시점이 필터보다 먼저라 인덱스가 밀리지 않는다는 점은 정합적이나, 문제는 여기가 아니라 렌더 단계의 `key`/`name`이 실제 DOM 인풋 인스턴스를 결정한다는 데 있다.
- 실제 파일 읽기(140-193줄, `startTransition` 내부): `fd.get(option.imageField)`로 브라우저가 들고 있는 `<input type=hidden>` 파일을 읽는다 — 즉 **서버가 아니라 클라이언트가 `option_image_${index}` 이름의 hidden input을 FormData에서 직접 읽는다.**

`frontend/src/lib/actions/polls.ts` (`createUserPoll`, 39-92줄 부근)

- `option_image_${index}` 문자열은 이 파일에 전혀 등장하지 않는다(전체 grep 확인). 서버 액션은 `options`(JSON 문자열, `label/description/player_id/image_url`만) 하나만 읽는다(39-59줄) — 이미지는 클라이언트가 업로드를 마치고 `image_url`을 채워 넣은 뒤에만 서버로 간다.
- 즉 **`option_image_${index}`는 순수 클라이언트-로컬 이름**이다. 서버 파싱 규약과 무관 — 이름을 id 기준으로 바꿔도 서버 쪽 변경이 필요 없다.

`CroppedImageInput.tsx` (33-34, 92줄)

- `name` prop 그대로 hidden `<input type="file" name={name}>`에 꽂힌다. 내부 크롭 상태(`sourceUrl`, `crop`, `imageRef`)는 컴포넌트 인스턴스에 종속된 `useState`/`useRef`이므로, React가 컴포넌트를 언마운트하지 않고 재사용하면(= 부모 리스트의 `key`가 안 바뀌면) 상태가 그대로 남는다. 이게 "삭제 후 이미지 이월"의 실제 메커니즘.

`UserPollEditForm.tsx` (전체 재확인)

- 옵션 배열이 **읽기 전용**이다: `poll.poll_options.map(option => <... key={option.id}>)`(130-134, 139-155줄) — DB에서 내려온 고정 옵션을 그대로 렌더만 하고, 추가/삭제/이미지 재업로드 UI가 없다("투표 신뢰성을 위해 수정할 수 없어요" 안내만 있음, 158줄). `key`도 이미 `option.id`(DB pk)라 인덱스 기반이 아니다.
- **결론: 수정 화면에는 같은 패턴이 없다. 대상은 `UserPollCreateForm.tsx` 하나.**

## 2. 변경 계획

### 2-1. 고유 id 생성 방식

리포 전체에 클라이언트 리스트 아이템용 id 생성 선례가 없다(grep 결과: `crypto.randomUUID`/`nanoid`/`uuid` 사용처 없음, `Date.now()`는 전부 스토리북 mock 타임스탬프 용도). 새 라이브러리 도입 없이 브라우저 내장 `crypto.randomUUID()`를 쓰는 편이 증가 카운터(`useRef` 기반)보다 구현이 짧고 충돌 가능성이 없어 이쪽을 채택한다(추천, 근거: 리포에 참고할 기존 관례가 없어 표준 Web API 우선).

- `UnifiedOption` 타입에 `id: string` 추가.
- 초기 state 2개, `addOption`에서 새 옵션 생성 시 `id: crypto.randomUUID()`.
- `options.map((option, index) => ...)`에서 `key={option.id}`로 교체(294줄). `index`는 `placeholder={`선택지 ${index + 1}`}` 등 표시용으로는 계속 사용 가능(순서 표시일 뿐 인스턴스 식별과 무관하므로 유지).

### 2-2. 이미지 입력 name 규약 — 두 안 비교

**안 (a) name은 인덱스 유지, key만 id로 교체**
- `CroppedImageInput name={`option_image_${index}`}`는 그대로 두고 `key={option.id}`만 바꾼다.
- 실측 근거: 이월 버그의 원인은 React가 "몇 번째 자리에 어떤 컴포넌트 인스턴스가 있는가"를 `key`로만 판단하는 데 있다(`name`은 렌더링된 DOM에 붙는 attribute일 뿐 재조정(reconciliation) 식별자가 아니다). `key`를 안정된 id로 바꾸면 삭제 시 React가 정확히 삭제된 옵션의 `CroppedImageInput` 인스턴스를 언마운트하고 나머지는 그대로 유지 — 뒤 옵션의 이미지 상태가 앞으로 안 밀린다. `name`은 매 렌더마다 그 인스턴스가 현재 위치한 인덱스로 다시 계산되고, 제출 시점의 `cleaned`/`imageField` 계산도 같은 렌더 결과의 인덱스를 쓰므로 `fd.get(option.imageField)`가 항상 "그 순간 그 자리에 실제로 마운트된 인스턴스"의 파일을 올바르게 가리킨다. 즉 **name은 인덱스로 남아도 버그가 해결된다.**
- 서버 액션 변경 불필요(이미 1절에서 확인).

**안 (b) name도 id 기준으로 교체**
- `name={`option_image_${option.id}`}`, `imageField: `option_image_${option.id}`` 로 변경.
- 서버는 이 이름을 안 읽으므로(1절) 서버 파싱 변경은 이 안에서도 불필요 — 순수 클라이언트 로컬 키 변경.
- 장점: `name`과 `key`가 항상 같은 값(id)이라 "왜 name은 인덱스인데 key는 id인가"라는 코드 가독성 혼란이 없다. 다만 동작 변화는 안 (a)와 동일(고치는 근본 원인이 key이기 때문).

**추천: 안 (a).** 근거 — 버그의 근본 원인은 `key`뿐이고(위 실측), `name`을 안 바꿔도 재현 절차(4절)로 검증 가능한 동작 변화가 없다. spec 지시("이미지 입력 name도 id 기준으로 바꾼다")와는 다른 결론이라 **확인 필요**: spec 문구대로 안 (b)를 원하면(가독성·일관성 목적으로) 그렇게 진행 가능하나, 버그 수정 자체에는 안 (a)만으로 충분하다는 점을 사람이 판단해달라.

**확인 완료(2026-09-05, 사용자 확정): 안 (a) 채택.** `key`만 `option.id`로 교체하고 이미지 입력 `name`(`option_image_${index}`)은 인덱스 유지로 구현.

## 3. 영향받는 테스트

- 전체 grep 결과 `key={index}`·`option_image_${index}`·`UnifiedOption` 문자열을 직접 검사하는 `*.test.mjs`는 없음.
- `UserPollCreateForm.tsx`/`CroppedImageInput.tsx`를 source()로 읽는 테스트: `src/components/design-foundation.test.mjs` (76번째 줄 `source('components/composition/polls/UserPollCreateForm.tsx')`, 292번째 줄 `CroppedImageInput.tsx` 파일 목록) — 둘 다 스타일 클래스(`rounded-lg`, `text-caption-1`, 하드코딩 색상 금지 등) 정규식만 검사, `key`/`name`/id 로직과 무관 → **재작성 불필요**.
- `option_image_` 문자열이 등장하는 다른 파일은 `src/storybook/selection-and-input/ImageInput.stories.tsx`(정적 스토리북 데모용 이름, 폼 로직과 무관) 뿐 — 영향 없음.
- 결론: 기존 테스트 중 이 변경으로 깨질 것은 없어 보임(실측 grep 기준). `npm test` 전체 실행으로 재확인 필요.

## 4. 검증

```
cd frontend && npm test && npm run lint && npm run build
```

수동 재현 절차(자동 테스트로 커버되지 않는 리그레션이므로 필수):
1. `/polls/create`에서 "일반 투표" 선택, 선택지 3개로 늘림(선택지 추가 버튼 2회).
2. 선택지 1: 라벨 "A", 이미지 크롭 입력에 이미지1 업로드.
3. 선택지 2: 라벨 "B", 이미지 크롭 입력에 이미지2 업로드.
4. 선택지 3: 라벨 "C", 이미지 크롭 입력에 이미지3 업로드.
5. 선택지 2를 삭제(X 버튼).
6. 남은 두 선택지(A, C)의 이미지 미리보기가 각각 이미지1·이미지3 그대로인지 확인(수정 전에는 C 자리에 이미지2가 나타나는 게 재현된 버그).
7. 폼 제출 후 생성된 투표 상세 페이지에서 두 선택지 카드 이미지가 업로드한 것과 일치하는지 확인.

## 5. 불변 제약 영향

옵션 리스트의 `key`/이미지 input `name`만 바꾸는 클라이언트 렌더링 수정이며 제출 로직·DB 스키마·투표 수정 가능 여부·결과 공개 시점·댓글 참여자 제한 어느 것도 건드리지 않는다.
