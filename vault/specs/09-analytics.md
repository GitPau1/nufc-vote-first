# 09 — Mixpanel Community Loop Tracking

## Measurement Goal

Mixpanel tracking should answer whether NUFCVOTE is becoming a fan community, not only whether users click through a poll.

The product now has two participation modes:

```text
Poll participation = vote_submitted + poll_result_viewed
Lightweight repeated participation = pick_one_submitted + player_rating_changes_viewed
```

For operations, the main question is:

> Do fans submit opinions, see how the group responded, react to other fans, and come back to do it again?

## Operating Metrics

### 1. Visit

```text
session_started
```

Use `session_started` unique users for DAU and WAU after the tracking change on 2026-06-24. The previous `app_opened` event is legacy data and should not be compared directly with `session_started`.

Use `tab_viewed` for primary tab analysis:

```text
tab_viewed
```

This event is intentionally limited to the three primary tabs: poll, players, and menu. Poll detail pages, rating changes, feedback, and account pages are excluded.

### 2. Poll Participation Loop

```text
tab_viewed { tab: "poll" }
→ poll_card_clicked
→ vote_submitted
→ poll_result_viewed
```

This measures whether a user moves from poll exposure to a first opinion and then reaches the poll reward moment: seeing how their opinion compares with other fans.

### 3. Community Reward

```text
poll_result_viewed
player_rating_changes_viewed
```

Community reward is the moment a user sees their action reflected in a group outcome. Polls deliver this through result views. Pick One delivers this through weekly rating changes.

### 4. Community Temperature

```text
poll_result_viewed
→ comment_submitted
→ comment_liked
```

This measures whether group results create emotional response. `comment_submitted` shows that users want to speak; `comment_liked` shows that users react to other fans.

### 5. Pick One Habit Loop

```text
tab_viewed { tab: "players" }
→ pick_one_viewed
→ pick_one_submitted
→ pick_one_next_clicked
→ player_rating_changes_viewed
```

Pick One is the lightweight repeat loop. It should answer whether player comparisons become a small fan habit, not just a one-time action.

Useful operating questions:

- Do users who open the players tab submit a Pick One choice?
- Do they continue to the next matchup after one choice?
- Do they later view the weekly rating changes?
- Do returning users re-enter this loop?

### 6. Return Behavior

```text
return_visit
→ vote_submitted | pick_one_submitted | comment_submitted | player_rating_changes_viewed
```

The current `return_visit` event means the user came back after at least 30 minutes, not necessarily the next day. It is sent when a new session starts after that window. Treat it as a session return signal. For community health, pair it with follow-up actions instead of reading it alone.

### 7. High-Intent Users

```text
poll_published
poll_first_vote_received
feedback_submitted
```

These events identify users who go beyond lightweight participation. In early community operations, feedback submitters and poll creators are candidates for core user follow-up.

## Event Plan

Track only events that support operating decisions.

| Event | Trigger | Product Question |
|---|---|---|
| `session_started` | A new browser session starts, or the previous activity was more than 30 minutes ago. | How many unique users entered the product? |
| `tab_viewed` | User views one of the three primary tabs: poll, players, or menu. | Which primary tab gets the most traffic? |
| `return_visit` | User returns after the session window. | Did users come back after leaving? |
| `poll_card_clicked` | User opens a poll from a card. | Did a poll topic create interest? |
| `vote_submitted` | Vote is successfully saved. | Did the user submit an opinion? |
| `poll_result_viewed` | Poll result screen is viewed. | Did the user reach the poll reward moment? |
| `comment_submitted` | Comment is successfully created. | Did a result make the user want to speak? |
| `comment_liked` | User likes a comment. | Did users react to other fans? |
| `pick_one_viewed` | Pick One matchup is visible. | Did users see the lightweight participation prompt? |
| `pick_one_submitted` | Pick One choice is saved or already counted. | Did users participate in the lightweight habit loop? |
| `pick_one_next_clicked` | User advances after a Pick One choice. | Did one choice lead to another choice? |
| `player_pick_one_auth_required` | Unauthenticated user attempts Pick One. | Is auth blocking lightweight participation? |
| `player_rating_changes_clicked` | User opens weekly rating changes from players page. | Did users seek the group outcome? |
| `player_rating_changes_viewed` | Weekly rating changes page is viewed. | Did users reach the Pick One reward moment? |
| `auth_prompt_viewed` | Login prompt appears before a gated action. | Where does auth friction appear? |
| `login_completed` | User successfully logs in. | Do users cross the login barrier? |
| `create_poll_clicked` | User submits or starts poll creation. | Did the user show creator intent? |
| `poll_published` | User-created poll is successfully published. | Did creator activation happen? |
| `poll_first_vote_received` | A user-created poll receives its first vote. | Did the creator reach their reward moment? |
| `feedback_submitted` | Feedback is successfully submitted. | Did a high-intent user give operational feedback? |

## Tracking Change History

### 2026-06-24

The visit model changed:

- `app_opened` stopped being the active visit event.
- `session_started` became the DAU/WAU source event.
- `tab_viewed` became the primary tab comparison event.
- `poll_feed_viewed` and `players_viewed` stopped being active events because they duplicated `tab_viewed`.

Do not join pre-change `app_opened` trends and post-change `session_started` trends into a single continuous chart without an annotation.

## Current Ambiguities

These events are useful, but their interpretation must stay narrow:

| Event | Do Not Read As | Current Meaning |
|---|---|---|
| `app_opened` | Current active visit metric. | Legacy pre-2026-06-24 route/session entry event. |
| `tab_viewed` | All page views. | Primary tab view for poll, players, or menu only. |
| `return_visit` | Calendar-day retention. | Session return after 30+ minutes. |
| `vote_submitted` | All community participation. | Poll-specific participation only. |
| `poll_result_viewed` | All value moments. | Poll reward moment only. |
| `create_poll_clicked` | Guaranteed valid creation intent. | Creation form submission/start signal, depending on firing position. |
| `comment_liked` | Full community health. | Lightweight reaction to another fan; pair with comments submitted. |

## Event Properties

### Common Properties

Attach these when available:

```ts
{
  source_page:
    | "home"
    | "polls"
    | "poll_detail"
    | "create"
    | "players"
    | "player_changes"
    | "my"
    | "feedback"
    | "menu"
    | "direct",
  is_first_session: boolean,
  is_logged_in: boolean,
  user_role: "guest" | "user" | "admin"
}
```

`is_first_session` is supplied by the analytics helper. `is_logged_in` and `user_role` remain target properties for a later identity pass.

### Auth Prompt Properties

Attach to `auth_prompt_viewed`:

```ts
{
  trigger_action: "vote" | "comment" | "create_poll" | "login"
}
```

Use `player_pick_one_auth_required` for Pick One auth blocks unless a login prompt is actually shown.

### Poll Event Properties

Attach to poll-related events:

```ts
{
  poll_id: string,
  poll_type: "subject_options" | "free_choice" | "overall_rating" | "selection" | "question_targets" | "evaluation",
  poll_status: "active" | "scheduled" | "closed",
  creator_type: "admin" | "user",
  is_first_vote: boolean
}
```

### Primary Tab Properties

Attach to `tab_viewed`:

```ts
{
  tab: "poll" | "players" | "menu"
}
```

Use `tab_viewed by tab` in Mixpanel to compare the three primary navigation areas. `/polls/[id]`, `/players/changes`, `/my`, and `/my/feedback` are intentionally excluded.

### Poll Creation Properties

Attach to `create_poll_clicked` and `poll_published`:

```ts
{
  poll_type: "subject_options" | "free_choice" | "overall_rating",
  option_count: number,
  has_thumbnail: boolean
}
```

### Pick One Properties

Attach to Pick One events:

```ts
{
  winner_player_id: string,
  loser_player_id: string,
  winner_overall: number,
  loser_overall: number,
  result_state: "saved" | "duplicate"
}
```

Do not send player names to Mixpanel. Player IDs and aggregate ratings are sufficient for behavior analysis.

### Rating Changes Properties

Attach to `player_rating_changes_viewed`:

```ts
{
  has_applied_week: boolean,
  changed_player_count: number
}
```

### Feedback Properties

Attach to `feedback_submitted`:

```ts
{
  content_length: number
}
```

Do not send feedback body content to Mixpanel.

## Deferred or Removed Events

The previous short news loop is outside the current poll-only plus players product scope. Keep these out of active dashboards unless the posts feature returns:

- `post_feed_viewed`
- `post_create_clicked`
- `post_published`
- `post_reacted`
- `post_embed_clicked`
- `post_card_viewed`
- `post_edited`
- `post_deleted`

Detailed UX diagnostics remain deferred:

- `vote_option_selected`
- `vote_modal_shown`
- `vote_modal_cancelled`
- `scheduled_poll_viewed`
- `mypage_visited`
- `logout`
- `account_deleted`
- `feedback_opened`
