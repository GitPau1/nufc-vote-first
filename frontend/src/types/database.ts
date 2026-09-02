// DB schema types for the poll-only application.

export type PollType = 'evaluation' | 'selection' | 'subject_options' | 'question_targets' | 'free_choice' | 'overall_rating'
export type PollStatus = 'scheduled' | 'active' | 'closed'
/** season_squads.position — GK는 승부예측 픽 후보가 아니다(DEF/MID/FWD만 픽 대상). */
export type SquadPosition = 'GK' | 'DEF' | 'MID' | 'FWD'
export type Position = 'GK' | 'DEF' | 'MID' | 'FWD' | 'MGR'
export type PlayerStatus = 'first_team' | 'loan' | 'u21'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          avatar_url: string | null
          display_name: string | null
          created_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      public_profiles: {
        Row: {
          id: string
          display_name: string | null
          avatar_url: string | null
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['public_profiles']['Row'], 'updated_at'>
        Update: Partial<Database['public']['Tables']['public_profiles']['Insert']>
      }
      players: {
        Row: {
          id: string
          name: string
          position: Position
          squad_number: number | null
          photo_url: string | null
          base_rating: number
          is_active: boolean
          squad_status: PlayerStatus
        }
        Insert: Omit<Database['public']['Tables']['players']['Row'], 'id' | 'is_active' | 'squad_status'> & {
          is_active?: boolean
          squad_status?: PlayerStatus
        }
        Update: Partial<Database['public']['Tables']['players']['Insert']>
      }
      polls: {
        Row: {
          id: string
          type: PollType
          title: string
          description: string | null
          player_id: string | null
          created_by: string | null
          status: PollStatus
          thumbnail_url: string | null
          scheduled_at: string | null
          closes_at: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['polls']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['polls']['Insert']>
      }
      poll_options: {
        Row: {
          id: string
          poll_id: string
          label: string
          description?: string | null
          player_id: string | null
          image_url?: string | null
          display_order: number
          created_at?: string
        }
        Insert: Omit<Database['public']['Tables']['poll_options']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['poll_options']['Insert']>
      }
      votes: {
        Row: {
          id: string
          poll_id: string
          user_id: string
          option_id: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['votes']['Row'], 'id' | 'created_at'>
        Update: never
      }
      comments: {
        Row: {
          id: string
          poll_id: string
          user_id: string
          content: string
          is_hidden: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['comments']['Row'], 'id' | 'is_hidden' | 'created_at'>
        Update: Pick<Database['public']['Tables']['comments']['Row'], 'is_hidden'>
      }
      comment_likes: {
        Row: {
          id: string
          comment_id: string
          user_id: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['comment_likes']['Row'], 'id' | 'created_at'>
        Update: never
      }
      rating_votes: {
        Row: {
          id: string
          poll_id: string
          user_id: string
          target_player_id: string
          score: number
          comment: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['rating_votes']['Row'], 'id' | 'created_at'>
        Update: never
      }
      rating_vote_likes: {
        Row: {
          id: string
          rating_vote_id: string
          user_id: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['rating_vote_likes']['Row'], 'id' | 'created_at'>
        Update: never
      }
      player_pick_one_choices: {
        Row: {
          id: string
          user_id: string
          winner_player_id: string
          loser_player_id: string
          player_a_id: string
          player_b_id: string
          week_start_at: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['player_pick_one_choices']['Row'], 'id' | 'created_at'>
        Update: never
      }
      player_pick_one_ratings: {
        Row: {
          player_id: string
          rating: number
          wins: number
          losses: number
          choice_count: number
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['player_pick_one_ratings']['Row'], 'updated_at'> & {
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['player_pick_one_ratings']['Insert']>
      }
      player_pick_one_weekly_runs: {
        Row: {
          id: string
          week_start_at: string
          week_end_at: string
          status: string
          applied_at: string | null
          error_message: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['player_pick_one_weekly_runs']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['player_pick_one_weekly_runs']['Insert']>
      }
      player_pick_one_rating_changes: {
        Row: {
          id: string
          run_id: string
          player_id: string
          previous_rating: number
          new_rating: number
          previous_overall: number
          new_overall: number
          delta: number
          wins: number
          losses: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['player_pick_one_rating_changes']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['player_pick_one_rating_changes']['Insert']>
      }
      user_feedback: {
        Row: {
          id: string
          user_id: string
          content: string
          category: 'vote' | 'prediction' | 'player' | 'etc'
          rating: number | null
          page_path: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['user_feedback']['Row'], 'id' | 'created_at'>
        Update: never
      }
      // FotMob 팀 API 동기화 테이블. id 없이 fixture_id(FotMob 원본 ID)가 PK다 —
      // supabase/migrations/20260821100000_create_fixtures.sql 참고.
      // 뉴캐슬 관점 데이터라 result/score는 중립이 아니다.
      fixtures: {
        Row: {
          fixture_id: number
          competition_id: number | null
          competition_name: string | null
          stage: string | null
          kickoff_at: string | null
          home_id: number
          home_name: string
          home_score: number | null
          away_id: number
          away_name: string
          away_score: number | null
          score_str: string | null
          result: 'WIN' | 'DRAW' | 'LOSS' | null
          started: boolean
          finished: boolean
          cancelled: boolean
          status_code: string | null
          status_description: string | null
          synced_at: string
        }
        Insert: Omit<Database['public']['Tables']['fixtures']['Row'], 'synced_at'> & { synced_at?: string }
        Update: Partial<Database['public']['Tables']['fixtures']['Insert']>
      }
      // 시즌 표시(홈/원정 이름은 fixtures와 무관, 승부예측 시즌 스쿼드 구분용) —
      // supabase/migrations의 원격 seasons 테이블. is_current로 "지금 시즌" 하나만 켜져 있다.
      seasons: {
        Row: {
          id: string
          name: string
          starts_at: string | null
          ends_at: string | null
          is_current: boolean
          display_order: number
          created_at: string
          updated_at: string
        }
        // 동기화/관리자(service-role) 전용 테이블이지만, Insert를 never로 두면
        // supabase-js가 select 결과 타입까지 never로 좁혀버린다.
        Insert: Database['public']['Tables']['seasons']['Row']
        Update: Partial<Database['public']['Tables']['seasons']['Row']>
      }
      // 시즌 스쿼드(외부 API 동기화). 승부예측 선수 픽 후보이자 배당 소스 —
      // supabase/migrations/20260821110000_create_season_squads.sql 참고.
      season_squads: {
        Row: {
          season_id: string
          fotmob_player_id: number
          player_id: string | null
          name: string
          name_ko: string | null
          shirt_number: number | null
          position: SquadPosition
          position_ids_desc: string | null
          nationality_code: string | null
          nationality_name: string | null
          date_of_birth: string | null
          transfer_value: number | null
          prediction_multiplier: number
          pick_cost: number
          synced_at: string
          is_active: boolean
        }
        Insert: Database['public']['Tables']['season_squads']['Row']
        Update: Partial<Database['public']['Tables']['season_squads']['Row']>
      }
      // 승부예측 제출. 경기 하나가 1행이다(제출 후 수정 불가 — UNIQUE + UPDATE 정책 없음).
      predictions: {
        Row: {
          id: string
          user_id: string
          fixture_id: number
          home_score: number
          away_score: number
          def_player_id: number
          mid_player_id: number
          fwd_player_id: number
          def_multiplier: number
          mid_multiplier: number
          fwd_multiplier: number
          def_cost: number
          mid_cost: number
          fwd_cost: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['predictions']['Row'], 'id' | 'created_at'>
        Update: never
      }
      // 경기별 선수 평점(같은 마이그레이션 파일에 함께 있다).
      fixture_player_ratings: {
        Row: {
          fixture_id: number
          player_id: number
          rating: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['fixture_player_ratings']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['fixture_player_ratings']['Insert']>
      }
    }
    // 승부예측 결과/랭킹 view (20260821120000_create_predictions.sql).
    // 전부 읽기 전용이라 Row만 둔다. 점수 산식은 DB 함수(prediction_match_points /
    // prediction_pick_points)에 있고 view가 그 결과를 컬럼으로 내려준다.
    Views: {
      // 예측 1건 + 계산된 점수. 종료된 경기만 들어온다(view 정의에 where f.finished).
      prediction_results: {
        Row: {
          id: string
          user_id: string
          fixture_id: number
          kickoff_at: string | null
          competition_name: string | null
          pred_home: number
          pred_away: number
          // 경기가 끝났어도 스코어가 아직 안 들어왔으면 null
          actual_home: number | null
          actual_away: number | null
          def_player_id: number
          mid_player_id: number
          fwd_player_id: number
          // fixture_player_ratings에 행이 없으면 null (= 미출전/미집계)
          def_rating: number | null
          mid_rating: number | null
          fwd_rating: number | null
          // 점수는 coalesce가 걸려 있어 null이 아니다 — 평점이 없으면 0
          match_points: number
          def_points: number
          mid_points: number
          fwd_points: number
          pick_points: number
          total_points: number
        }
        // 읽기 전용 view (GenericNonUpdatableView 형태). 다만 Tables 쪽에 Relationships가 없어
        // 스키마 전체가 supabase-js 추론에서 빠진다 — 조회 결과는 PredictionResultRow 등으로 직접 단언해 쓴다.
        Relationships: []
      }
      // 주차별 랭킹 — 결과 화면 "전체 결과" 탭 (20260823140000_week_leaderboard.sql).
      // 랭킹 단위가 주차라 경기 단위 fixture_leaderboard는 같은 migration에서 삭제했다.
      week_leaderboard: {
        Row: {
          /** lib/predictions/week.ts의 weekKey()와 같은 ISO 주차 문자열('2026-35') */
          week_key: string
          user_id: string
          display_name: string | null
          avatar_url: string | null
          match_points: number
          pick_points: number
          total_points: number
          /** 동점이면 user_id 순 — rank()라서 건너뛰는 순위가 생긴다 */
          rank: number
          /** 그 주차의 전체 참여자 수 ("N위 / M명"의 M) */
          total_entries: number
        }
        // 읽기 전용 view (GenericNonUpdatableView 형태). 다만 Tables 쪽에 Relationships가 없어
        // 스키마 전체가 supabase-js 추론에서 빠진다 — 조회 결과는 PredictionResultRow 등으로 직접 단언해 쓴다.
        Relationships: []
      }
      // 시즌 누적 랭킹 — 목록 화면 우측 랭킹 카드
      season_leaderboard: {
        Row: {
          user_id: string
          display_name: string | null
          avatar_url: string | null
          total_points: number
          /** 채점된 예측 건수 */
          played: number
          rank: number
        }
        // 읽기 전용 view (GenericNonUpdatableView 형태). 다만 Tables 쪽에 Relationships가 없어
        // 스키마 전체가 supabase-js 추론에서 빠진다 — 조회 결과는 PredictionResultRow 등으로 직접 단언해 쓴다.
        Relationships: []
      }
      // 평점 투표 poll별 참여자 수 (20260825120000_rating_poll_participants.sql).
      // 행 수가 아니라 중복 제거된 user_id 수다 — 참여자 1명이 선수 수만큼 rating_votes 행을 남긴다.
      rating_poll_participants: {
        Row: {
          poll_id: string
          participant_count: number
        }
        // 읽기 전용 view (GenericNonUpdatableView 형태). 다만 Tables 쪽에 Relationships가 없어
        // 스키마 전체가 supabase-js 추론에서 빠진다 — 조회 결과는 PredictionResultRow 등으로 직접 단언해 쓴다.
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      poll_type: PollType
      poll_status: PollStatus
    }
  }
}

export type FixtureRow = Database['public']['Tables']['fixtures']['Row']
export type SeasonRow = Database['public']['Tables']['seasons']['Row']
export type SeasonSquadRow = Database['public']['Tables']['season_squads']['Row']
export type FixturePlayerRatingRow = Database['public']['Tables']['fixture_player_ratings']['Row']
export type UserRow = Database['public']['Tables']['users']['Row']
export type PublicProfileRow = Database['public']['Tables']['public_profiles']['Row']
export type PlayerRow = Database['public']['Tables']['players']['Row']
export type PollRow = Database['public']['Tables']['polls']['Row']
export type PollOptionRow = Database['public']['Tables']['poll_options']['Row']
export type VoteRow = Database['public']['Tables']['votes']['Row']
export type CommentRow = Database['public']['Tables']['comments']['Row']
export type CommentLikeRow = Database['public']['Tables']['comment_likes']['Row']
export type RatingVoteRow = Database['public']['Tables']['rating_votes']['Row']
export type RatingVoteLikeRow = Database['public']['Tables']['rating_vote_likes']['Row']
export type PlayerPickOneChoiceRow = Database['public']['Tables']['player_pick_one_choices']['Row']
export type PlayerPickOneRatingRow = Database['public']['Tables']['player_pick_one_ratings']['Row']
export type PlayerPickOneWeeklyRunRow = Database['public']['Tables']['player_pick_one_weekly_runs']['Row']
export type PlayerPickOneRatingChangeRow = Database['public']['Tables']['player_pick_one_rating_changes']['Row']
export type UserFeedbackRow = Database['public']['Tables']['user_feedback']['Row']
export type PredictionRow = Database['public']['Tables']['predictions']['Row']
export type PredictionInsert = Database['public']['Tables']['predictions']['Insert']
export type PredictionResultRow = Database['public']['Views']['prediction_results']['Row']
export type WeekLeaderboardRow = Database['public']['Views']['week_leaderboard']['Row']
export type SeasonLeaderboardRow = Database['public']['Views']['season_leaderboard']['Row']
export type RatingPollParticipantsRow = Database['public']['Views']['rating_poll_participants']['Row']

export type PollWithOptions = PollRow & {
  poll_options: PollOptionRow[]
  player?: PlayerRow | null
  vote_count: number
  my_vote?: VoteRow | null
}

export type CommentWithMeta = CommentRow & {
  user: Pick<PublicProfileRow, 'display_name' | 'avatar_url'>
  like_count: number
  is_liked: boolean
}
