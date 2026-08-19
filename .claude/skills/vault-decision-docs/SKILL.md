---
name: vault-decision-docs
description: Classify raw input (messy meeting notes, Slack/chat pastes, Claude Code conversation transcripts) into a personal Obsidian+GitHub vault under 00_의사결정사항. The original raw note is archived completely unmodified (verbatim, no restructuring) under 회의록/, while decisions/directions extracted from it are written as separate derived Feature Brief / ADR / Decision Log entries that link back to the archived original. Use this skill whenever the user pastes raw unstructured content and asks to "정리해줘", "분류해줘", "문서로 만들어줘", or references Feature Brief / ADR / Decision Log / 회의록 / vault by name, or asks to summarize a Claude Code conversation into documentation. Also use this skill (with no pasted input) when the user asks to find and process meeting notes under 회의록/ that haven't been reflected in derived docs yet ("미반영 회의록 찾아줘/정리해줘" etc.) — see "미반영 회의록 찾기" workflow. Always use this skill instead of freeform formatting when the target is this vault.
---

# Vault Decision Docs

이 스킬은 2인 팀(개발자+디자이너)이 Obsidian vault + GitHub로 운영하는 의사결정 문서 체계를 위한 것입니다. 대충 써둔 raw 회의록/메모/대화록을 받아서:

1. **원본을 한 글자도 바꾸지 않고 그대로 `회의록/`에 아카이브**하고
2. 그 안에서 실제 결정/기능 방향을 뽑아 **Feature Brief / ADR / Decision Log**로 별도 문서에 분류·반영합니다 (원본 대신 파생 문서만 수정/갱신됨).

## 폴더 구조

```
vault/00_의사결정사항/
├── 00-templates/
│   ├── feature-brief.md
│   └── adr.md
├── 01-features/
│   └── YYYY-MM-title-slug.md
├── 02-adr/
│   └── 00X-title-slug.md
├── decision-log-YYYY-QN.md   (분기별로 새 파일 생성, 예: decision-log-2026-Q3.md)
└── 회의록/
    └── YYYY-MM-DD.md          (원본을 한 글자도 바꾸지 않고 그대로 저장한 아카이브)
```

- Feature Brief 파일명: `YYYY-MM-title-slug.md`
- ADR 파일명: `00X-title-slug.md` (3자리 zero-padded)
- Decision Log: 분기별로 파일을 나눈다.
- 회의록: 날짜별로 하나씩. 같은 날 여러 개면 `YYYY-MM-DD-2.md`처럼 뒤에 번호.

## 미반영 회의록 찾기 (raw 입력 없이 호출된 경우)

사용자가 텍스트를 붙여넣지 않고 "회의록 폴더에서 미반영 문서 찾아서 정리해줘"처럼 요청하면, 아래 절차로 대상을 먼저 찾는다.

1. `vault/00_의사결정사항/회의록/` 안의 `.md` 파일 목록을 전부 가져온다 (이미지 등 첨부파일 제외).
2. `01-features/`, `02-adr/`, `decision-log-*.md` 전체에서 `[[../회의록/` 로 시작하는 위키링크를 grep해서, 어떤 회의록 파일이 이미 하나 이상의 파생 문서에 링크되어 있는지 확인한다.
3. 한 번도 링크되지 않은 회의록 파일 = **미반영**. 여러 개면 날짜순으로 나열해 어느 것부터 처리할지 사용자에게 확인한다 (하나뿐이면 바로 진행).
4. 대상 파일을 찾았으면 그 파일을 읽어서, 아래 "회의록 처리 워크플로우"의 **1단계는 건너뛰고 2단계(결정/방향 추출 및 분류)부터** 그대로 진행한다 — 원본은 이미 아카이브되어 있으므로 다시 저장하지 않으며, 계속해서 절대 수정하지 않는다.

## 회의록 처리 워크플로우 (가장 우선 적용)

입력이 "대충 써둔 회의 메모"인 경우, 아래 순서로 처리한다. (위 "미반영 회의록 찾기"로 대상을 찾은 경우는 1단계를 건너뛴다.)

### 1단계: 회의록 원본 그대로 저장 (수정 절대 금지)
- **원본 문서는 절대 수정하지 않는다.** 구조 재정리, 섹션 재배치, 문장 다시 쓰기, 요약, 어투 변경, 없는 내용 추론 — 전부 하지 않는다.
- 사용자가 준 raw 텍스트를 **한 글자도 바꾸지 않고 그대로** `회의록/YYYY-MM-DD.md`로 저장한다. 프론트매터도 원문에 있는 그대로 유지한다 (원문에 없으면 새로 추가하지 않고, 파일명에 쓸 날짜만 사용자에게 확인).
- 이 파일은 "정리된 결과물"이 아니라 "원본 아카이브"다. 정리/분류는 여기서 하지 않고 2단계에서 별도 문서로 만든다.
- 회의록 파일 안에 링크를 추가하는 것도 원본 수정에 해당하므로, 파생 문서와의 연결은 회의록 파일이 아니라 **파생 문서(Feature Brief/ADR) 쪽에서 회의록을 향해 링크**하는 방식으로만 한다 (일방향).

### 2단계: 결정/방향 추출 및 분류
저장된 원본 회의록을 보고 아래 기준으로 하나씩 분류한다.

| 신호 | 분류 |
|---|---|
| "왜 만드는지" 문제 정의 + 요구사항 + 방향(디자인 포함)이 섞여 있고, 아직 확정 아니거나 신규 기능/방향인 것 | **Feature Brief** |
| 되돌리기 어려운 기술 선택(DB, 라이브러리, 아키텍처 등) + 이유 + 트레이드오프 | **ADR** |
| 이미 확정/승인/완료된 자잘한 실행성 결정 (한두 줄로 끝나는 것) | **Decision Log**에 한 줄 추가 |
| 아직 결론 안 나고 여러 옵션만 나열된 것 (예: "구조 방향 옵션 1~4") | 관련 Feature Brief 안에 "검토 중인 옵션"으로 같이 적음 (별도 문서 만들지 않음) |
| 회의록에 여러 종류가 섞여 있음 (대부분의 경우) | 문서별로 나눠서 각각 반영 |

분류가 애매하면 바로 만들지 말고 분류 근거를 먼저 보여주고 확인받는다. 명확하면 바로 생성한다.

**파생 문서 내용은 반드시 지금 처리 중인 회의록 원본에서만 추출한다.** 같은 vault 안에 관련되어 보이는 다른 문서(예: `vault/10_sup/*` 같은 별도 메모·검토 문서)가 있더라도, 그 내용을 가져와 파생 문서에 반영하지 않는다 — 그건 이번 입력이 아니라 별도 자료다. 회의록 내용만으로 근거(왜/트레이드오프 등)가 부족하면 지어내지 말고 "다음 회의에서 확인 필요"로 남기거나, 해당 항목의 문서화 자체를 보류하고 사용자에게 알린다. 관련 있어 보이는 별도 문서를 발견하면, 반영 여부를 사용자에게 먼저 물어본다.

### 3단계: 회의록 링크 (일방향)
회의록 원본은 수정하지 않으므로, 링크는 **파생 문서 → 회의록** 방향으로만 만든다. 회의록 파일 자체에는 아무것도 추가하지 않는다.

```markdown
## Related
- 회의록: [[../회의록/YYYY-MM-DD]]
```

## 시작하기 전에 반드시 확인할 것

Claude는 이전 대화의 vault 상태를 기억하지 못한다. 아래가 없으면 파일 생성 전 반드시 물어본다:

1. **다음 ADR 번호** (ADR을 만들어야 하는 경우만)
2. **관련 기존 Feature Brief 존재 여부** — 이번 raw 내용이 기존 진행 중인 기능과 관련된 것 같으면 확인. 있다면 새로 만들지 않고 업데이트한다.

이미 대화 중에 제공됐다면 다시 묻지 않는다.

## 각 문서 형식

템플릿(`assets/feature-brief.md`, `assets/adr.md`)을 기반으로 채운다. 프론트매터는 항상 포함한다. (회의록은 템플릿을 쓰지 않는다 — 원본 그대로 저장하기 때문)

### Feature Brief
필수 섹션: 왜 / 무엇(검토 중인 옵션 포함 가능) / 어떻게(기술 방향) / 디자인 방향 / 범위 밖 / 완료 기준 / Related
프론트매터: `type: feature`, `status`(draft/in-progress/done), `date`, `related_adr: []`, `tags: []`

아직 방향이 여러 개 검토 중이면 `status: draft`로 두고, "검토 중인 옵션" 섹션에 후보들을 나열한다. 기각된 대안이 있으면 왜 기각했는지도 남긴다(회의록에 이유가 없으면 "다음 회의에서 확인 필요"라고 명시).

**기존 Feature Brief 업데이트 시**: 덮어쓰지 않고 하단에 추가:
```markdown
## Update (YYYY-MM-DD)
<!-- 무엇이 바뀌었는지, 왜 -->
```

### ADR
필수 섹션: Status / Context / Decision / Consequences / Related
프론트매터: `type: adr`, `id`, `status`(proposed/accepted/deprecated/superseded), `date`, `tags: []`, `related_feature: []`

결정이 바뀌면 기존 ADR을 고치지 않고 새 ADR을 만든 뒤, 기존 ADR의 status를 `superseded`로 바꾸고 새 ADR을 링크한다.

### Decision Log
해당 분기 파일 표에 한 줄 추가:
```markdown
| 날짜 | 결정 | 배경 | 담당 |
```
"담당"이 회의록에 없으면 빈 값(`-`)으로 두고 비워둔다. 임의로 지어내지 않는다.

## 상호 링크 규칙
- Feature Brief ↔ ADR은 항상 양방향 위키링크(`[[ ]]`)로 연결한다
- 회의록은 예외: **파생 문서 → 회의록 방향으로만** 링크한다 (회의록 원본은 절대 수정하지 않으므로 역링크 없음)
- 프론트매터의 `related_adr` / `related_feature` 배열도 동일하게 채운다 (Dataview 집계용)

## 클로드 코드 대화록을 정리하는 경우
대화록 전체를 옮기지 않는다. 시행착오/중간에 버린 방법/디버깅 과정은 제외하고 최종 반영된 것만 추출한다.
- 최종 결정이 기술 선택 → ADR
- 최종 결정이 기능 범위/방향 → Feature Brief
- 코드 세부사항(파일 경로, 함수명, diff)은 넣지 않는다. 필요하면 PR/커밋 링크만.

## 작업 순서
0. raw 입력 없이 "미반영 문서 찾아줘"류로 호출됐으면 "미반영 회의록 찾기"로 대상 파일부터 특정한다
1. 입력이 회의록 형태면 "회의록 처리 워크플로우"부터 시작 (원본 그대로 저장, 수정 없음). 0번으로 이미 대상을 찾았다면 1단계(저장)는 건너뛴다
2. 회의록/대화록/메모에서 결정·방향을 분류 기준에 따라 판단
3. 애매하면 분류 근거를 먼저 보여주고 확인, 명확하면 바로 진행
4. "시작하기 전에 반드시 확인할 것" 항목 확인 — 없으면 질문
5. 템플릿 기반으로 각 문서 작성 (프론트매터 포함)
6. 파생 문서 간(Feature Brief ↔ ADR) 양방향 링크, 회의록으로는 일방향 링크 연결
7. 생성된 파일 목록과 저장 경로 안내
