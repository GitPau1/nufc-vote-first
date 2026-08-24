import { createClient } from "npm:@supabase/supabase-js@2";

const TEAM_ID = 10261;

const FOTMOB_API =
  `https://www.fotmob.com/api/data/teams?id=${TEAM_ID}&ccode3=KOR`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Position = "GK" | "DEF" | "MID" | "FWD";

interface FotmobPlayer {
  id: number;
  name: string;
  shirtNumber?: number | null;

  ccode?: string | null;
  cname?: string | null;

  role?: {
    key?: string;
    fallback?: string;
  };

  positionIdsDesc?: string | null;

  dateOfBirth?: string | null;

  transferValue?: number | null;
}

interface FotmobSquadGroup {
  title: string;
  members: FotmobPlayer[];
}

interface FotmobResponse {
  details?: {
    id?: number;
    name?: string;
    latestSeason?: string;
  };

  squad?: {
    squad?: FotmobSquadGroup[];
  };
}

interface Season {
  id: string;
  name: string;
  is_current: boolean;
}

interface ExistingSquad {
  fotmob_player_id: number;
  player_id: string | null;
  name_ko: string | null;
  prediction_multiplier: number;
}

// ------------------------------------------------------------
// Response
// ------------------------------------------------------------

function jsonResponse(
  data: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(data, null, 2),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    },
  );
}

// ------------------------------------------------------------
// Season
// ------------------------------------------------------------

function normalizeSeason(
  season: string,
): string | null {
  const value = season.trim();

  // 2026-27
  let match = value.match(
    /^(\d{4})-(\d{2})$/,
  );

  if (match) {
    return `${match[1]}-${match[2]}`;
  }

  // 2026/2027
  match = value.match(
    /^(\d{4})\/(\d{4})$/,
  );

  if (match) {
    return `${match[1]}-${match[2].slice(2)}`;
  }

  // 2026-2027
  match = value.match(
    /^(\d{4})-(\d{4})$/,
  );

  if (match) {
    return `${match[1]}-${match[2].slice(2)}`;
  }

  return null;
}

function getSeasonStartYear(
  season: string,
): number | null {
  const match =
    season.match(/^(\d{4})/);

  if (!match) {
    return null;
  }

  return Number(match[1]);
}

// ------------------------------------------------------------
// Position
// ------------------------------------------------------------

function convertPosition(
  roleKey?: string,
): Position | null {
  if (!roleKey) {
    return null;
  }

  switch (roleKey) {
    case "keeper":
    case "keeper_long":
    case "goalkeeper":
    case "goalkeeper_long":
      return "GK";

    case "defender":
    case "defender_long":
      return "DEF";

    case "midfielder":
    case "midfielder_long":
      return "MID";

    case "attacker":
    case "attacker_long":
    case "forward":
    case "forward_long":
      return "FWD";

    default:
      return null;
  }
}

// ------------------------------------------------------------
// Validation
// ------------------------------------------------------------

function getShirtNumber(
  value?: number | null,
): number | null {
  if (
    typeof value !== "number" ||
    value < 1 ||
    value > 99
  ) {
    return null;
  }

  return value;
}

function getTransferValue(
  value?: number | null,
): number | null {
  if (
    typeof value !== "number" ||
    value < 0
  ) {
    return null;
  }

  return Math.trunc(value);
}

function getDateOfBirth(
  value?: string | null,
): string | null {
  if (!value) {
    return null;
  }

  const match =
    value.match(/^\d{4}-\d{2}-\d{2}$/);

  if (!match) {
    return null;
  }

  return value;
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(
      "ok",
      {
        headers: corsHeaders,
      },
    );
  }

  try {
    // ========================================================
    // 1. Supabase Client
    // ========================================================

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
      );

    if (!supabaseUrl) {
      throw new Error(
        "SUPABASE_URL is missing",
      );
    }

    if (!serviceRoleKey) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is missing",
      );
    }

    const supabase =
      createClient(
        supabaseUrl,
        serviceRoleKey,
      );

    // ========================================================
    // 2. 현재 시즌 조회
    // ========================================================

    const {
      data: currentSeasonData,
      error: currentSeasonError,
    } = await supabase
      .from("seasons")
      .select(
        "id, name, is_current",
      )
      .eq("is_current", true)
      .single();

    if (currentSeasonError) {
      throw new Error(
        `Failed to get current season: ${currentSeasonError.message}`,
      );
    }

    const currentSeason =
      currentSeasonData as Season;

    // ========================================================
    // 3. FotMob API 호출
    // ========================================================

    const fotmobResponse =
      await fetch(FOTMOB_API, {
        headers: {
          Accept: "application/json",
        },
      });

    if (!fotmobResponse.ok) {
      throw new Error(
        `FotMob API failed: ${fotmobResponse.status}`,
      );
    }

    const fotmobData =
      await fotmobResponse.json() as FotmobResponse;

    // ========================================================
    // 4. 시즌 확인
    // ========================================================

    const fotmobSeason =
      fotmobData.details?.latestSeason;

    if (!fotmobSeason) {
      throw new Error(
        "FotMob latestSeason is missing",
      );
    }

    const dbNormalized =
      normalizeSeason(
        currentSeason.name,
      );

    const fotmobNormalized =
      normalizeSeason(
        fotmobSeason,
      );

    if (
      !dbNormalized ||
      !fotmobNormalized
    ) {
      throw new Error(
        `Invalid season format: DB=${currentSeason.name}, FotMob=${fotmobSeason}`,
      );
    }

    if (
      dbNormalized !==
      fotmobNormalized
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "SEASON_MISMATCH",

          databaseSeason:
            currentSeason.name,

          fotmobSeason,
        },
        409,
      );
    }

    // ========================================================
    // 5. Squad 가져오기
    // ========================================================

    const groups =
      fotmobData.squad?.squad;

    if (
      !groups ||
      !Array.isArray(groups)
    ) {
      throw new Error(
        "FotMob squad.squad is missing",
      );
    }

    // coach 제외
    const players =
      groups
        .filter(
          (group) =>
            group.title !== "coach",
        )
        .flatMap(
          (group) =>
            group.members ?? [],
        );

    if (players.length === 0) {
      throw new Error(
        "No players found in FotMob squad",
      );
    }

    // ========================================================
    // 6. 유효 선수만
    // ========================================================

    const validPlayers =
      players.filter(
        (player) => {
          if (
            !player.id ||
            !player.name
          ) {
            return false;
          }

          const position =
            convertPosition(
              player.role?.key,
            );

          return position !== null;
        },
      );

    const fotmobPlayerIds =
      validPlayers.map(
        (player) => player.id,
      );

    // ========================================================
    // 7. 현재 시즌 기존 데이터
    //
    // 관리자 입력 컬럼 보존
    // ========================================================

    const {
      data: existingData,
      error: existingError,
    } = await supabase
      .from("season_squads")
      .select(
        `
        fotmob_player_id,
        player_id,
        name_ko,
        prediction_multiplier
        `,
      )
      .eq(
        "season_id",
        currentSeason.id,
      )
      .in(
        "fotmob_player_id",
        fotmobPlayerIds,
      );

    if (existingError) {
      throw new Error(
        `Failed to get existing squad: ${existingError.message}`,
      );
    }

    const existingMap =
      new Map<
        number,
        ExistingSquad
      >();

    for (
      const row of
        (existingData ??
          []) as ExistingSquad[]
    ) {
      existingMap.set(
        Number(
          row.fotmob_player_id,
        ),
        row,
      );
    }

    // ========================================================
    // 8. 직전 시즌 조회
    // ========================================================

    const {
      data: seasonsData,
      error: seasonsError,
    } = await supabase
      .from("seasons")
      .select(
        "id, name, is_current",
      );

    if (seasonsError) {
      throw new Error(
        `Failed to get seasons: ${seasonsError.message}`,
      );
    }

    const allSeasons =
      (seasonsData ??
        []) as Season[];

    const currentYear =
      getSeasonStartYear(
        currentSeason.name,
      );

    let previousSeason:
      Season | null = null;

    if (currentYear !== null) {
      const previousCandidates =
        allSeasons
          .filter(
            (season) => {
              const year =
                getSeasonStartYear(
                  season.name,
                );

              return (
                year !== null &&
                year < currentYear
              );
            },
          )
          .sort(
            (a, b) => {
              const aYear =
                getSeasonStartYear(
                  a.name,
                ) ?? 0;

              const bYear =
                getSeasonStartYear(
                  b.name,
                ) ?? 0;

              return bYear - aYear;
            },
          );

      previousSeason =
        previousCandidates[0] ??
        null;
    }

    // ========================================================
    // 9. 직전 시즌 name_ko
    // ========================================================

    const previousNameMap =
      new Map<
        number,
        string | null
      >();

    if (previousSeason) {
      const {
        data: previousData,
        error: previousError,
      } = await supabase
        .from("season_squads")
        .select(
          "fotmob_player_id, name_ko",
        )
        .eq(
          "season_id",
          previousSeason.id,
        )
        .in(
          "fotmob_player_id",
          fotmobPlayerIds,
        );

      if (previousError) {
        throw new Error(
          `Failed to get previous squad: ${previousError.message}`,
        );
      }

      for (
        const row of
          previousData ?? []
      ) {
        previousNameMap.set(
          Number(
            row.fotmob_player_id,
          ),
          row.name_ko,
        );
      }
    }

    // ========================================================
    // 10. Upsert 데이터
    // ========================================================

    const syncedAt =
      new Date().toISOString();

    const rows =
      validPlayers.map(
        (player) => {
          const existing =
            existingMap.get(
              player.id,
            );

          const previousNameKo =
            previousNameMap.get(
              player.id,
            ) ?? null;

          const position =
            convertPosition(
              player.role?.key,
            );

          if (!position) {
            throw new Error(
              `Invalid position: ${player.name}`,
            );
          }

          return {
            season_id:
              currentSeason.id,

            fotmob_player_id:
              player.id,

            // 기존 연결값 유지
            player_id:
              existing?.player_id ??
              null,

            name:
              player.name,

            // 현재 시즌 → 이전 시즌 → null
            name_ko:
              existing?.name_ko ??
              previousNameKo ??
              null,

            shirt_number:
              getShirtNumber(
                player.shirtNumber,
              ),

            position,

            position_ids_desc:
              player.positionIdsDesc ??
              null,

            nationality_code:
              player.ccode ??
              null,

            nationality_name:
              player.cname ??
              null,

            date_of_birth:
              getDateOfBirth(
                player.dateOfBirth,
              ),

            transfer_value:
              getTransferValue(
                player.transferValue,
              ),

            prediction_multiplier:
              existing
                ?.prediction_multiplier ??
              1.0,

            synced_at:
              syncedAt,
          };
        },
      );

    // ========================================================
    // 11. DB 저장
    // ========================================================

    const {
      data: saved,
      error: saveError,
    } = await supabase
      .from("season_squads")
      .upsert(
        rows,
        {
          onConflict:
            "season_id,fotmob_player_id",
        },
      )
      .select();

    if (saveError) {
      throw new Error(
        `Failed to save squad: ${saveError.message}`,
      );
    }

    // ========================================================
    // 12. 결과
    // ========================================================

    const inserted =
      rows.filter(
        (row) =>
          !existingMap.has(
            row.fotmob_player_id,
          ),
      ).length;

    const updated =
      rows.length - inserted;

    return jsonResponse({
      success: true,

      team:
        fotmobData.details?.name ??
        "Newcastle United",

      season: {
        database:
          currentSeason.name,

        fotmob:
          fotmobSeason,
      },

      result: {
        fetched:
          players.length,

        valid:
          validPlayers.length,

        inserted,
        updated,
      },

      players: saved,
    });
  } catch (error) {
    console.error(error);

    return jsonResponse(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      500,
    );
  }
});