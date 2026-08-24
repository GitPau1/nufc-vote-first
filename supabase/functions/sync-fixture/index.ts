/*
 * sync-fixtures
 *
 * FotMob 팀 API에서 전 경기 일정을 가져와 public.fixtures 에 upsert 한다.
 * 크론에서 주기적으로 호출되는 수집 전용 엔드포인트이며, 조회 용도로 쓰지 않는다.
 * (조회는 클라이언트가 fixtures 테이블을 직접 select 한다)
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const NEWCASTLE_ID = 10261;
const COUNTRY_CODE = "KOR";

const FOTMOB_TEAM_API =
  `https://www.fotmob.com/api/data/teams?id=${NEWCASTLE_ID}&ccode3=${COUNTRY_CODE}`;

/*
 * 크론에서만 호출되므로 브라우저 프리플라이트는 발생하지 않는다.
 * 수동 호출 편의를 위해 최소한만 남긴다.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type FotmobFixture = {
  id: number;
  pageUrl?: string;

  opponent?: {
    id: number;
    name: string;
    score?: number;
  };

  home: {
    id: number;
    name: string;
    score?: number;
  };

  away: {
    id: number;
    name: string;
    score?: number;
  };

  result?: number;
  notStarted?: boolean;

  tournament?: {
    name?: string;
    stage?: string;
    leagueId?: number;
  };

  status?: {
    utcTime?: string;
    finished?: boolean;
    started?: boolean;
    cancelled?: boolean;
    awarded?: boolean;
    scoreStr?: string;

    reason?: {
      short?: string;
      long?: string;
    };
  };
};

/*
 * public.fixtures 컬럼과 1:1로 대응한다.
 * 컬럼명을 바꾸면 마이그레이션과 함께 고쳐야 한다.
 */
type FixtureRow = {
  fixture_id: number;

  competition_id: number | null;
  competition_name: string | null;
  stage: string | null;

  kickoff_at: string | null;

  home_id: number;
  home_name: string;
  home_score: number | null;

  away_id: number;
  away_name: string;
  away_score: number | null;

  score_str: string | null;
  result: "WIN" | "DRAW" | "LOSS" | null;

  started: boolean;
  finished: boolean;
  cancelled: boolean;
  status_code: string | null;
  status_description: string | null;

  synced_at: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse(
        {
          error: "METHOD_NOT_ALLOWED",
          message: "POST 요청만 지원합니다.",
        },
        405,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase environment variables");

      return jsonResponse(
        {
          error: "CONFIG_ERROR",
          message: "Supabase 환경변수가 설정되지 않았습니다.",
        },
        500,
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const response = await fetch(FOTMOB_TEAM_API, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();

      console.error(
        "FotMob team API error:",
        response.status,
        errorBody,
      );

      return jsonResponse(
        {
          error: "FOTMOB_ERROR",
          message: "FotMob 경기 데이터를 가져오지 못했습니다.",
        },
        502,
      );
    }

    const data = await response.json();

    const fixtures: FotmobFixture[] =
      data?.fixtures?.allFixtures?.fixtures ?? [];

    if (fixtures.length === 0) {
      /*
       * 빈 배열은 성공이 아니라 이상 신호로 다룬다.
       * 응답 구조가 바뀌어 경로가 어긋나도 fixtures 는 [] 가 되므로,
       * 여기서 조용히 통과시키면 수집이 멈춘 걸 아무도 모른다.
       */
      console.error("FotMob returned no fixtures");

      return jsonResponse(
        {
          error: "EMPTY_FIXTURES",
          message: "FotMob 응답에 경기가 없습니다. 응답 구조를 확인하세요.",
        },
        502,
      );
    }

    const syncedAt = new Date().toISOString();

    /*
     * 정렬은 하지 않는다. upsert 결과에 영향이 없고,
     * 순서가 필요한 쪽은 조회 시점에 kickoff_at 으로 정렬한다.
     */
    const mapped = fixtures.map((fixture) => toFixtureRow(fixture, syncedAt));

    const rows = mapped.filter((row): row is FixtureRow => row !== null);
    const skipped = mapped.length - rows.length;

    const deduped = dedupeByFixtureId(rows);
    const duplicates = rows.length - deduped.length;

    const { data: upserted, error } = await supabase
      .from("fixtures")
      .upsert(deduped, { onConflict: "fixture_id" })
      .select("fixture_id");

    if (error) {
      console.error("Upsert error:", error);

      return jsonResponse(
        {
          error: "UPSERT_FAILED",
          message: "경기 데이터 저장에 실패했습니다.",
          detail: error.message,
        },
        500,
      );
    }

    return jsonResponse({
      /*
       * FotMob 이 내려준 전체 경기 수
       */
      fetched: fixtures.length,

      /*
       * 필수 필드 누락으로 저장하지 않은 경기 수
       */
      skipped,

      /*
       * 같은 fixture_id 가 중복으로 내려와 제거한 수
       */
      duplicates,

      /*
       * 실제로 저장된 행 수.
       * PostgREST 는 INSERT 와 UPDATE 를 구분해 알려주지 않으므로
       * 신규/갱신을 나눠 세지 않는다.
       */
      upserted: upserted?.length ?? 0,

      syncedAt,
    });
  } catch (error) {
    console.error("Sync fixtures error:", error);

    return jsonResponse(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "경기 수집 중 오류가 발생했습니다.",
      },
      500,
    );
  }
});

/*
 * FotMob fixture 를 fixtures 행으로 변환한다.
 * 필수 컬럼(fixture_id, home, away)이 없으면 null 을 반환해 호출부가 건너뛰게 한다.
 */
function toFixtureRow(
  fixture: FotmobFixture,
  syncedAt: string,
): FixtureRow | null {
  if (
    fixture.id == null ||
    fixture.home?.id == null ||
    fixture.away?.id == null
  ) {
    console.warn("Skipping fixture with missing keys:", fixture.id);
    return null;
  }

  return {
    fixture_id: fixture.id,

    competition_id: fixture.tournament?.leagueId ?? null,
    competition_name: fixture.tournament?.name ?? null,
    stage: fixture.tournament?.stage ?? null,

    kickoff_at: fixture.status?.utcTime ?? null,

    home_id: fixture.home.id,
    home_name: fixture.home.name,
    home_score: fixture.home.score ?? null,

    away_id: fixture.away.id,
    away_name: fixture.away.name,
    away_score: fixture.away.score ?? null,

    score_str: fixture.status?.scoreStr ?? null,

    result: convertResult(fixture.result),

    started: fixture.status?.started ?? false,
    finished: fixture.status?.finished ?? false,
    cancelled: fixture.status?.cancelled ?? false,
    status_code: fixture.status?.reason?.short ?? null,
    status_description: fixture.status?.reason?.long ?? null,

    synced_at: syncedAt,
  };
}

/*
 * 같은 배치 안에 중복 fixture_id 가 있으면 Postgres 가
 * "ON CONFLICT DO UPDATE command cannot affect row a second time" 로 실패한다.
 * 뒤에 나온 값을 최신으로 보고 남긴다.
 */
function dedupeByFixtureId(rows: FixtureRow[]): FixtureRow[] {
  const byId = new Map<number, FixtureRow>();

  for (const row of rows) {
    byId.set(row.fixture_id, row);
  }

  return [...byId.values()];
}

function convertResult(result?: number) {
  switch (result) {
    case 1:
      return "WIN" as const;

    case 0:
      return "DRAW" as const;

    case -1:
      return "LOSS" as const;

    default:
      return null;
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",

      /*
       * 수집 엔드포인트는 캐싱하지 않는다.
       */
      "Cache-Control": "no-store",
    },
  });
}