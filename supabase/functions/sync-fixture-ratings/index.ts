/*
 * sync-fixture-ratings
 *
 * 종료된 경기의 FotMob 선수 평점을 public.fixture_player_ratings 에 upsert 한다.
 * 크론에서 sync-fixture 다음에 호출되는 수집 전용 엔드포인트이며, 조회 용도로 쓰지 않는다.
 * (조회는 클라이언트가 fixture_player_ratings 테이블 / prediction_results view 를 직접 읽는다)
 *
 * 이 함수는 조회 전용이던 match-ratings 를 대체한다 — 파싱 로직(extractLineupPlayers,
 * extractRating)은 그대로 가져왔고, 응답을 돌려주던 껍데기만 배치 수집으로 바뀌었다.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const NEWCASTLE_ID = 10261;

/*
 * 한 번에 처리할 경기 수.
 *
 * 무료 플랜 Edge Function 은 호출당 CPU 2초 제한이 있고, matchDetails 응답이 경기당
 * 수백 KB~1MB 라 파싱만으로 경기당 수십 ms 를 쓴다. 시즌 전체(약 40경기)를 한 번에 돌면
 * 제한에 걸려 중간에 죽고, 앞쪽만 적재된 채 성공한 것처럼 보인다.
 * 남은 경기는 다음 실행이 이어받는다(응답의 remaining 참고).
 */
const BATCH_SIZE = 5;

/*
 * 적재 완료 판정 기준.
 *
 * "평점 행이 하나라도 있으면 완료"로 두면 안 된다 — FotMob 평점은 경기 종료 시점에
 * 확정되지 않고 종료 직후에는 일부 선수만 채워져 내려올 수 있다. 그 상태로 굳으면
 * 나머지 선수는 prediction_pick_points 에서 영구히 0점이 된다.
 * 선발 11명을 기준선으로 두면 부분 적재가 다음 실행에서 자동으로 재시도된다.
 */
const MIN_RATED_PLAYERS = 11;

/*
 * 크론에서만 호출되므로 브라우저 프리플라이트는 발생하지 않는다.
 * 수동 호출 편의를 위해 최소한만 남긴다.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/*
 * public.fixture_player_ratings 컬럼과 1:1로 대응한다.
 * player_id 는 season_squads.fotmob_player_id 와 같은 값이다.
 */
type RatingRow = {
  fixture_id: number;
  player_id: number;
  rating: number;
};

/*
 * 경기 하나의 처리 결과. 실패해도 배치 전체를 중단하지 않고 여기에 사유를 남긴다 —
 * 한 경기의 응답 구조가 어긋났다고 나머지 경기 적재를 막을 이유가 없다.
 */
type FixtureOutcome = {
  fixtureId: number;
  upserted: number;
  status: "ok" | "no_ratings" | "fotmob_error" | "not_newcastle" | "upsert_failed";
  detail?: string;
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

    /*
     * 디버깅용 단일 경기 지정. 붙어 있으면 완료 판정을 건너뛰고 그 경기만 다시 적재한다
     * (평점이 늦게 확정된 경기를 손으로 다시 긁을 때 쓴다).
     */
    const url = new URL(req.url);
    const matchIdParam = url.searchParams.get("matchId");

    let targets: number[];
    let remaining: number;

    if (matchIdParam) {
      const parsed = Number(matchIdParam);

      if (!Number.isFinite(parsed)) {
        return jsonResponse(
          {
            error: "INVALID_MATCH_ID",
            message: "matchId 가 숫자가 아닙니다.",
          },
          400,
        );
      }

      targets = [parsed];
      remaining = 0;
    } else {
      const pending = await findPendingFixtures(supabase);

      if ("error" in pending) {
        return jsonResponse(pending.error, 500);
      }

      targets = pending.fixtureIds.slice(0, BATCH_SIZE);
      remaining = pending.fixtureIds.length - targets.length;
    }

    /*
     * 순차 처리다. 병렬로 돌리면 FotMob 을 한 번에 5번 때리고 응답 5개를 동시에 메모리에
     * 들고 있게 되는데, BATCH_SIZE 가 작아 얻는 시간이 없다.
     */
    const outcomes: FixtureOutcome[] = [];

    for (const fixtureId of targets) {
      outcomes.push(await syncOneFixture(supabase, fixtureId));
    }

    return jsonResponse({
      /*
       * 이번 호출에서 처리한 경기 수
       */
      processed: outcomes.length,

      /*
       * 저장된 평점 행 수 합계
       */
      upserted: outcomes.reduce((sum, outcome) => sum + outcome.upserted, 0),

      /*
       * 아직 적재가 남은 경기 수. 0 이 아니면 다음 실행이 이어받는다.
       */
      remaining,

      fixtures: outcomes,

      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Sync fixture ratings error:", error);

    return jsonResponse(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "평점 수집 중 오류가 발생했습니다.",
      },
      500,
    );
  }
});

/*
 * 적재가 필요한 경기 = 종료됐고 평점 행이 MIN_RATED_PLAYERS 개 미만인 경기.
 * 임베디드 count 는 fixture_player_ratings.fixture_id → fixtures FK 로 동작한다.
 * 막 끝난 경기를 먼저 처리하도록 최신순으로 정렬한다.
 */
async function findPendingFixtures(
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<{ fixtureIds: number[] } | { error: Record<string, string> }> {
  const { data, error } = await supabase
    .from("fixtures")
    .select("fixture_id, fixture_player_ratings(count)")
    .eq("finished", true)
    .order("kickoff_at", { ascending: false });

  if (error) {
    console.error("Pending fixtures query error:", error);

    return {
      error: {
        error: "QUERY_FAILED",
        message: "적재 대상 경기를 조회하지 못했습니다.",
        detail: error.message,
      },
    };
  }

  const fixtureIds = (data ?? [])
    // deno-lint-ignore no-explicit-any
    .filter((row: any) => ratedCount(row) < MIN_RATED_PLAYERS)
    // deno-lint-ignore no-explicit-any
    .map((row: any) => Number(row.fixture_id));

  return { fixtureIds };
}

/*
 * 임베디드 count 는 [{ count: n }] 형태로 내려온다. 평점 행이 없으면 빈 배열이다.
 */
// deno-lint-ignore no-explicit-any
function ratedCount(row: any): number {
  const embedded = row?.fixture_player_ratings;

  if (Array.isArray(embedded)) {
    return Number(embedded[0]?.count ?? 0);
  }

  return Number(embedded?.count ?? 0);
}

/*
 * 경기 하나의 평점을 가져와 upsert 한다. 던지지 않고 사유를 담은 결과를 돌려준다.
 */
async function syncOneFixture(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  fixtureId: number,
): Promise<FixtureOutcome> {
  const fotmobUrl =
    `https://www.fotmob.com/api/data/matchDetails?matchId=${fixtureId}`;

  const response = await fetch(fotmobUrl, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0",
    },
  });

  if (!response.ok) {
    console.error("FotMob matchDetails error:", fixtureId, response.status);

    return {
      fixtureId,
      upserted: 0,
      status: "fotmob_error",
      detail: String(response.status),
    };
  }

  const data = await response.json();

  const general = data?.general ?? {};
  const lineup = data?.content?.lineup ?? null;
  const playerStats = data?.content?.playerStats ?? {};

  const isNewcastleHome = Number(general?.homeTeam?.id) === NEWCASTLE_ID;
  const isNewcastleAway = Number(general?.awayTeam?.id) === NEWCASTLE_ID;

  if (!isNewcastleHome && !isNewcastleAway) {
    /*
     * fixtures 는 뉴캐슬 경기만 담으므로 여기 걸리면 fixture_id 가 잘못된 것이다.
     */
    return { fixtureId, upserted: 0, status: "not_newcastle" };
  }

  const newcastleLineup = isNewcastleHome ? lineup?.homeTeam : lineup?.awayTeam;
  const lineupPlayers = extractLineupPlayers(newcastleLineup);

  const rows: RatingRow[] = [];
  const seen = new Set<number>();

  for (const player of lineupPlayers) {
    const playerId = Number(
      player?.id ?? player?.playerId ?? player?.player?.id,
    );

    if (!Number.isFinite(playerId) || seen.has(playerId)) {
      continue;
    }

    const stats = playerStats?.[String(playerId)] ?? playerStats?.[playerId] ??
      {};

    const rating = extractRating(player, stats);

    /*
     * 평점이 없는 선수는 행을 만들지 않는다 — 미출전/미집계는 "행 없음 = 0점"으로
     * 계산된다(prediction_pick_points, FR-015).
     */
    if (rating === null) {
      continue;
    }

    seen.add(playerId);
    rows.push({ fixture_id: fixtureId, player_id: playerId, rating });
  }

  if (rows.length === 0) {
    /*
     * 평점이 아직 안 붙은 경기다. 적재하지 않고 남겨두면 다음 실행이 다시 시도한다.
     */
    console.warn("No ratings available yet:", fixtureId);

    return { fixtureId, upserted: 0, status: "no_ratings" };
  }

  const { error } = await supabase
    .from("fixture_player_ratings")
    .upsert(rows, { onConflict: "fixture_id,player_id" });

  if (error) {
    console.error("Upsert error:", fixtureId, error);

    return {
      fixtureId,
      upserted: 0,
      status: "upsert_failed",
      detail: error.message,
    };
  }

  return { fixtureId, upserted: rows.length, status: "ok" };
}

/*
 * FotMob lineup 구조별 대응 (match-ratings 에서 그대로 가져옴).
 */
// deno-lint-ignore no-explicit-any
function extractLineupPlayers(team: any): any[] {
  if (!team) {
    return [];
  }

  if (Array.isArray(team.players)) {
    return team.players;
  }

  const starters = team?.starters ?? team?.players?.starters ?? [];

  const substitutes = team?.substitutes ??
    team?.subs ??
    team?.bench ??
    team?.players?.substitutes ??
    team?.players?.bench ??
    [];

  return [
    ...(Array.isArray(starters) ? starters : []),
    ...(Array.isArray(substitutes) ? substitutes : []),
  ];
}

/*
 * 평점이 어느 경로로 내려올지 응답 구조에 따라 갈린다 (match-ratings 에서 그대로 가져옴).
 */
// deno-lint-ignore no-explicit-any
function extractRating(player: any, stats: any): number | null {
  const candidates = [
    /*
     * playerStats 쪽 우선
     */
    stats?.rating,
    stats?.stats?.rating,

    /*
     * lineup 쪽
     */
    player?.rating,
    player?.performance?.rating,
    player?.stats?.rating,

    player?.player?.rating,
    player?.player?.performance?.rating,
  ];

  for (const value of candidates) {
    const parsed = Number(value);

    if (value !== undefined && value !== null && Number.isFinite(parsed)) {
      /*
       * fixture_player_ratings.rating 의 check (0~10) 를 넘는 값은 버린다 —
       * 넣으면 배치 전체가 실패한다.
       */
      if (parsed < 0 || parsed > 10) {
        continue;
      }

      return parsed;
    }
  }

  return null;
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
