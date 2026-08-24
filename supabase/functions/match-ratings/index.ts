import { corsHeaders } from "npm:@supabase/supabase-js@^2/cors";

const NEWCASTLE_ID = 10261;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const matchId = url.searchParams.get("matchId");

    if (!matchId) {
      return jsonResponse(
        {
          error: "MATCH_ID_REQUIRED",
          message: "matchId가 필요합니다.",
        },
        400,
      );
    }

    const fotmobUrl =
      `https://www.fotmob.com/api/data/matchDetails?matchId=${matchId}`;

    const response = await fetch(fotmobUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!response.ok) {
      return jsonResponse(
        {
          error: "FOTMOB_ERROR",
          status: response.status,
        },
        502,
      );
    }

    const data = await response.json();

    const general = data?.general ?? {};
    const lineup = data?.content?.lineup ?? null;
    const playerStats = data?.content?.playerStats ?? {};

    const homeTeam = general?.homeTeam;
    const awayTeam = general?.awayTeam;

    const isNewcastleHome =
      Number(homeTeam?.id) === NEWCASTLE_ID;

    const isNewcastleAway =
      Number(awayTeam?.id) === NEWCASTLE_ID;

    if (!isNewcastleHome && !isNewcastleAway) {
      return jsonResponse(
        {
          error: "NOT_NEWCASTLE_MATCH",
          message: "Newcastle United 경기가 아닙니다.",
        },
        400,
      );
    }

    /*
     * FotMob lineup 구조
     */
    const newcastleLineup = isNewcastleHome
      ? lineup?.homeTeam
      : lineup?.awayTeam;

    /*
     * 디버깅할 때 매우 유용
     */
    console.log("matchId:", matchId);
    console.log(
      "lineup keys:",
      lineup ? Object.keys(lineup) : [],
    );
    console.log(
      "newcastle lineup keys:",
      newcastleLineup
        ? Object.keys(newcastleLineup)
        : [],
    );
    console.log(
      "playerStats count:",
      Object.keys(playerStats).length,
    );

    const lineupPlayers =
      extractLineupPlayers(newcastleLineup);

    const players = lineupPlayers
      .map((player: any) => {
        const playerId =
          player?.id ??
          player?.playerId ??
          player?.player?.id;

        if (!playerId) {
          return null;
        }

        /*
         * 경기별 상세 stats가 playerStats에 따로 있을 수도 있음
         */
        const stats =
          playerStats?.[String(playerId)] ??
          playerStats?.[playerId] ??
          {};

        const rating =
          extractRating(player, stats);

        return {
          playerId: Number(playerId),

          name:
            player?.name ??
            player?.player?.name ??
            stats?.name ??
            null,

          shirtNumber:
            player?.shirtNumber ??
            player?.player?.shirtNumber ??
            null,

          position:
            player?.position ??
            player?.positionStringShort ??
            player?.player?.position ??
            null,

          starter:
            player?.starter ??
            player?.isStarter ??
            null,

          minutesPlayed:
            stats?.minutesPlayed ??
            player?.minutesPlayed ??
            player?.minutes ??
            null,

          rating,

          /*
           * 당분간 디버깅할 때만 사용
           */
          hasPlayerStats:
            Object.keys(stats).length > 0,
        };
      })
      .filter(
        (player): player is NonNullable<typeof player> =>
          player !== null,
      );

    const ratedPlayers = players.filter(
      (player) => player.rating !== null,
    );

    return jsonResponse({
      match: {
        matchId: Number(matchId),
        name: general?.matchName ?? null,
        kickoffAt:
          general?.matchTimeUTCDate ?? null,

        home: {
          id: homeTeam?.id ?? null,
          name: homeTeam?.name ?? null,
        },

        away: {
          id: awayTeam?.id ?? null,
          name: awayTeam?.name ?? null,
        },

        score:
          data?.header?.status?.scoreStr ??
          null,
      },

      team: {
        id: NEWCASTLE_ID,
        name: "Newcastle United",

        formation:
          newcastleLineup?.formation ??
          null,
      },

      available:
        ratedPlayers.length > 0,

      playerCount:
        players.length,

      ratedPlayerCount:
        ratedPlayers.length,

      players: ratedPlayers,

      debug: {
        lineupExists: !!lineup,
        newcastleLineupExists: !!newcastleLineup,
        playerStatsCount:
          Object.keys(playerStats).length,
      },
    });
  } catch (error) {
    console.error(error);

    return jsonResponse(
      {
        error: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error
            ? error.message
            : String(error),
      },
      500,
    );
  }
});

function extractLineupPlayers(team: any): any[] {
  if (!team) {
    return [];
  }

  /*
   * FotMob 구조별 대응
   */

  if (Array.isArray(team.players)) {
    return team.players;
  }

  const starters =
    team?.starters ??
    team?.players?.starters ??
    [];

  const substitutes =
    team?.substitutes ??
    team?.subs ??
    team?.bench ??
    team?.players?.substitutes ??
    team?.players?.bench ??
    [];

  return [
    ...(Array.isArray(starters)
      ? starters
      : []),

    ...(Array.isArray(substitutes)
      ? substitutes
      : []),
  ];
}

function extractRating(
  player: any,
  stats: any,
): number | null {
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

    if (
      value !== undefined &&
      value !== null &&
      Number.isFinite(parsed)
    ) {
      return parsed;
    }
  }

  return null;
}

function jsonResponse(
  body: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(body, null, 2),
    {
      status,

      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json; charset=utf-8",
      },
    },
  );
}