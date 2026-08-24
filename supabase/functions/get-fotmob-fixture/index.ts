import { corsHeaders } from "npm:@supabase/supabase-js@^2/cors";

const NEWCASTLE_ID = 10261;
const COUNTRY_CODE = "KOR";

const FOTMOB_TEAM_API =
  `https://www.fotmob.com/api/data/teams?id=${NEWCASTLE_ID}&ccode3=${COUNTRY_CODE}`;

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "GET") {
      return jsonResponse(
        {
          error: "METHOD_NOT_ALLOWED",
          message: "GET 요청만 지원합니다.",
        },
        405,
      );
    }

    const requestUrl = new URL(req.url);

    const statusParam =
      requestUrl.searchParams.get("status") ?? "all";

    if (!["all", "finished", "upcoming"].includes(statusParam)) {
      return jsonResponse(
        {
          error: "INVALID_STATUS",
          message:
            "status는 all, finished, upcoming 중 하나여야 합니다.",
        },
        400,
      );
    }

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

    /*
     * FotMob 팀 API에서 제공하는 전체 경기 목록
     */
    const fixtures: FotmobFixture[] =
      data?.fixtures?.allFixtures?.fixtures ?? [];

    let filteredFixtures = fixtures;

    /*
     * 종료된 경기만 조회
     */
    if (statusParam === "finished") {
      filteredFixtures = fixtures.filter(
        (fixture) => fixture.status?.finished === true,
      );
    }

    /*
     * 예정 경기만 조회
     */
    if (statusParam === "upcoming") {
      filteredFixtures = fixtures.filter(
        (fixture) =>
          fixture.status?.finished !== true &&
          fixture.notStarted === true,
      );
    }

    /*
     * 경기 정렬
     *
     * upcoming:
     *   가장 가까운 미래 경기부터
     *
     * finished / all:
     *   가장 최신 날짜부터
     */
    filteredFixtures.sort((a, b) => {
      const dateA = new Date(
        a.status?.utcTime ?? 0,
      ).getTime();

      const dateB = new Date(
        b.status?.utcTime ?? 0,
      ).getTime();

      if (statusParam === "upcoming") {
        return dateA - dateB;
      }

      return dateB - dateA;
    });

    /*
     * slice 없이 전체 경기 반환
     */
    const matches = filteredFixtures.map((fixture) => ({
      matchId: fixture.id,

      competition: {
        id: fixture.tournament?.leagueId ?? null,
        name: fixture.tournament?.name ?? null,
        stage: fixture.tournament?.stage ?? null,
      },

      kickoffAt: fixture.status?.utcTime ?? null,

      home: {
        id: fixture.home.id,
        name: fixture.home.name,
        score: fixture.home.score ?? null,
      },

      away: {
        id: fixture.away.id,
        name: fixture.away.name,
        score: fixture.away.score ?? null,
      },

      opponent: fixture.opponent
        ? {
            id: fixture.opponent.id,
            name: fixture.opponent.name,
          }
        : null,

      score: fixture.status?.scoreStr ?? null,

      result: convertResult(fixture.result),

      status: {
        started: fixture.status?.started ?? false,
        finished: fixture.status?.finished ?? false,
        cancelled: fixture.status?.cancelled ?? false,
        code: fixture.status?.reason?.short ?? null,
        description: fixture.status?.reason?.long ?? null,
      },
    }));

    return jsonResponse({
      team: {
        id: NEWCASTLE_ID,
        name: "Newcastle United",
      },

      /*
       * FotMob에서 실제 내려온 전체 경기 수
       */
      totalFromFotmob: fixtures.length,

      /*
       * status 필터 적용 후 반환 경기 수
       */
      count: matches.length,

      filter: {
        status: statusParam,
      },

      matches,
    });
  } catch (error) {
    console.error(
      "Match list error:",
      error,
    );

    return jsonResponse(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "경기 목록 조회 중 오류가 발생했습니다.",
      },
      500,
    );
  }
});

function convertResult(result?: number) {
  switch (result) {
    case 1:
      return "WIN";

    case 0:
      return "DRAW";

    case -1:
      return "LOSS";

    default:
      return null;
  }
}

function jsonResponse(
  body: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json; charset=utf-8",

        /*
         * FotMob 요청 감소용 짧은 캐싱
         */
        "Cache-Control":
          "public, max-age=60",
      },
    },
  );
}