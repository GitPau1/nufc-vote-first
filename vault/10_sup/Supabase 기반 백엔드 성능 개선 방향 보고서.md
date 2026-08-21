## 1. 개요

Supabase는 PostgreSQL을 중심으로 Auth, Storage, Realtime, Edge Function 등을 제공하는 **BaaS(Backend as a Service)** 플랫폼이다.

따라서 성능 개선 시 모든 요청을 Edge Function을 통해 처리하기보다는, **DB가 잘하는 일과 Edge Function이 잘하는 일을 분리해서 설계하는 것**이 중요하다.

핵심 원칙은 다음과 같다.

> **DB가 잘하는 일은 DB에 맡기고, Edge Function은 서버에서 처리해야 하는 로직에 집중한다.**

---

## 2. 단순 조회성 API 개선 방향

단순 조회성 기능은 가능하면 Edge Function을 거치지 않고 Supabase가 제공하는 DB API를 직접 사용하는 것이 효율적이다.

```text
Frontend
   ↓
Supabase DB API
   ↓
PostgreSQL
```

다음과 같은 단순 조회가 대표적이다.

- 뉴스 목록 조회
    
- 최근 데이터 조회
    
- 특정 조건의 게시물 조회
    
- 사용자에게 공개된 데이터 조회
    

이 경우 주요 성능 개선 대상은 **Edge Function이 아니라 PostgreSQL 쿼리**가 된다.

### 주요 개선 항목

- 필요한 컬럼만 조회
    
- 적절한 `WHERE` 조건 사용
    
- `LIMIT`과 Pagination 적용
    
- 조회 조건에 맞는 Index 구성
    
- 정렬 컬럼 Index 검토
    
- 불필요한 JOIN 제거
    
- 데이터 모델링 개선
    

예를 들어 다음과 같은 조회가 반복된다면,

```sql
SELECT
    id,
    title,
    image_url,
    published_at
FROM news
WHERE team_id = 1
ORDER BY published_at DESC
LIMIT 20;
```

다음과 같은 복합 인덱스를 고려할 수 있다.

```sql
CREATE INDEX idx_news_team_published
ON news(team_id, published_at DESC);
```

즉,

> **조회 API의 성능 개선은 SQL과 Index를 중심으로 접근한다.**

---

## 3. Edge Function의 역할

Edge Function을 단순히 **외부 API 호출용 함수**라고 보는 것은 다소 좁은 정의다.

보다 정확하게는 다음과 같이 정의할 수 있다.

> **클라이언트에서 직접 수행하기 어렵거나 부적절한 서버 로직을 처리하는 영역**

대표적인 사용 사례는 다음과 같다.

- 외부 API 호출
    
- API Key 등 Secret 보호
    
- 외부 데이터 정제 및 가공
    
- 여러 API 데이터 조합
    
- Webhook 처리
    
- 결제 처리
    
- AI API 호출
    
- 복잡한 비즈니스 로직
    
- 배치 작업
    
- 권한 검증
    

따라서 다음 구조가 자연스럽다.

```text
Frontend
   ↓
Edge Function
   ↓
외부 서비스
```

또는

```text
Cron
   ↓
Edge Function
   ↓
외부 API
   ↓
데이터 가공
   ↓
PostgreSQL
```

---

## 4. Edge Function 내부 DB 접근 시 주의점

Edge Function에서 PostgreSQL에 접근하는 것 자체는 문제가 아니다.

중요한 것은 **DB 접근 횟수와 네트워크 Round Trip을 최소화하는 것**이다.

### 좋지 않은 구조

예를 들어 외부 API에서 뉴스 100개를 받아온 뒤 각각 중복 여부를 확인하는 경우이다.

```text
뉴스 1
 → SELECT
 → INSERT

뉴스 2
 → SELECT
 → INSERT

...

뉴스 100
 → SELECT
 → INSERT
```

최악의 경우:

```text
SELECT 100회
INSERT 100회
```

즉 최대 200번의 DB 요청이 발생할 수 있다.

이는 전형적인 반복 DB 접근 문제이며, 데이터가 증가할수록 성능이 빠르게 악화될 수 있다.

---

## 5. DB 기능을 활용한 개선

중복 여부 판단처럼 PostgreSQL이 직접 처리할 수 있는 작업은 애플리케이션 코드에서 반복적으로 검사하지 않는 것이 좋다.

예를 들어 뉴스 URL을 중복 기준으로 사용할 경우 다음과 같이 설정한다.

```sql
ALTER TABLE news
ADD CONSTRAINT news_url_unique UNIQUE (url);
```

이후 Edge Function에서는 데이터를 모아서 한 번에 처리한다.

```ts
await supabase
  .from("news")
  .upsert(articles, {
    onConflict: "url"
  })
```

구조는 다음과 같이 단순해진다.

```text
외부 API
   ↓
뉴스 100건
   ↓
Batch UPSERT 1회
   ↓
PostgreSQL
```

기존:

```text
API 1회
+
DB 요청 최대 200회
```

개선 후:

```text
API 1회
+
DB 요청 1회
```

즉, 성능 최적화 시 중요한 원칙은 다음과 같다.

> **SELECT 자체를 피하는 것이 아니라 불필요한 반복 SELECT와 DB Round Trip을 줄여야 한다.**

---

## 6. 성능 개선 우선순위

초기 단계에서는 복잡한 캐시 시스템을 도입하기보다 병목이 발생할 가능성이 높은 부분부터 개선하는 것이 좋다.

권장 순서는 다음과 같다.

### 1단계 — 불필요한 네트워크 요청 제거

```text
Frontend
 → Edge Function
 → DB
```

가 반드시 필요한지 검토한다.

단순 조회라면:

```text
Frontend
 → DB API
 → DB
```

로 단순화한다.

### 2단계 — DB Round Trip 감소

다수의 요청을 반복하는 대신 Batch 처리한다.

```text
100 × INSERT
```

보다:

```text
1 × Batch INSERT
```

를 우선한다.

### 3단계 — SQL 및 Index 최적화

- `SELECT *` 최소화
    
- Index 설정
    
- Pagination
    
- JOIN 최적화
    
- 정렬 조건 검토
    

### 4단계 — 데이터 구조 개선

반복 계산이 발생한다면 다음을 검토한다.

- 집계 테이블
    
- Materialized View
    
- 비정규화
    

### 5단계 — 캐싱

실제 DB 부하가 발생하기 시작하면 다음 단계에서 캐시를 검토한다.

```text
HTTP Cache
CDN
Application Cache
Redis
```

작은 규모의 서비스에서는 처음부터 Redis를 추가하는 것보다 DB 구조와 쿼리를 먼저 최적화하는 것이 일반적으로 효율적이다.

---

## 7. 최종 정리

Supabase 환경에서는 역할을 다음과 같이 구분하는 것이 좋다.

|영역|주요 역할|주요 최적화 방법|
|---|---|---|
|Frontend|화면 표시, 사용자 요청|불필요한 API 호출 감소|
|DB API|단순 CRUD|요청 구조 단순화|
|PostgreSQL|조회, 필터링, 정렬, 중복 처리|SQL, Index, Constraint|
|Edge Function|서버 로직|외부 API, 데이터 가공, Batch 처리|
|Cron|주기적 작업 실행|호출 주기 최적화|

이를 한 문장으로 정리하면 다음과 같다.

> **단순 조회는 PostgreSQL 쿼리와 Index를 중심으로 최적화하고, Edge Function은 외부 API 호출이나 서버 로직을 담당하도록 하되, 내부 DB와의 반복적인 Round Trip을 최소화하도록 설계한다.**

특히 뉴스 수집 서비스에서는 다음 구조가 적합하다.

```text
수집
Cron → Edge Function → 외부 API → Batch Upsert → DB

조회
Frontend → Supabase DB API → DB
```

이 구조는 구현이 단순하면서도 불필요한 서버 호출과 외부 API 의존성을 줄이고, 이후 트래픽이 증가했을 때도 Index, Pagination, Cache 등의 방식으로 단계적인 확장이 가능하다.