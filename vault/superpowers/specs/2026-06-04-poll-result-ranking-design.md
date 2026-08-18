# Poll Result Ranking Design

## Goal

Make poll results easier to scan by showing vote options in descending vote-share order with filled ranking rows. For active polls, the result page should feel like a live ranking. For closed polls, it should feel like a final result with a clear top option.

## Assumptions

- `ResultView` is shown when a user has already voted, or when the poll is closed.
- Active polls can show results after voting, but should not show a "top winner" card because the result is not final.
- Closed polls can show a top-vote card when at least one vote exists.
- Option images are optional. If an option has no usable image, the UI does not render an empty thumbnail slot.

## Scope

- Update the standard poll `ResultView` result layout.
- Sort result rows by vote count descending, using the existing option order as the tie-breaker.
- Replace the current progress-bar list with filled ranking rows inspired by the provided reference image, using the app's existing Newcastle/LDSG colors.
- Show optional 1:1 option thumbnails only when an image exists.
- Show a subdued top-vote card only for closed polls with votes.
- Keep comments and player info sections in their existing positions after the result summary.

Out of scope:

- Overall rating poll results.
- New data fetching or database schema changes.
- Tie-specific "joint winner" messaging.
- New generated fallback thumbnails.

## UI

The cover image and header remain unchanged.

Below the cover, the result content starts with total participants. Active and closed states then diverge:

- Active result: show `현재 순위` and the filled ranking list only.
- Closed result: show a white `최다 득표` card with primary border/accent, then show `최종 순위` and the same filled ranking list.

Each ranking row is a rounded white surface with a filled primary-tint background whose width matches the option percent. The row content sits above the fill:

- Optional 1:1 thumbnail, rendered only when the option image is available.
- Option label and optional description.
- `내 선택` badge when the row matches the user's vote.
- Percent on the right.
- Vote count as secondary text below the option label.

Image priority for result rows:

1. `option.image_url`
2. Option player's `photo_url` for player-option poll types
3. No image rendered

The top-vote card uses the same image priority for the winning option. If no image exists, the card simply shows text and percent without an image gap.

## Data Flow

`ResultView` already receives `poll`, `voteCounts`, and `myOptionId`.

Within the component:

1. Build option result items from `poll.poll_options`.
2. Attach count, percent, original index, optional image URL, and `isMine`.
3. Sort by count descending, then original index ascending.
4. Derive the top item from the sorted list.
5. Use `poll.status === 'closed'` and `total > 0` to decide whether to show the top-vote card.
6. Render the sorted ranking rows for both active and closed result states.

## Edge Cases

- No votes: hide the top-vote card and show an empty-results message instead of misleading 0% rankings.
- Zero-percent rows with nonzero total: keep them in sorted order with a minimal or zero-width fill.
- Missing image: omit the thumbnail element entirely.
- Long labels: truncate single-line row labels while preserving the right-side percent.
- Option descriptions: keep existing line-clamp behavior so rows do not become oversized.

## Testing

- Add or update focused tests for the pure ranking derivation if the logic is extracted.
- Verify active voted polls render only the ranking list.
- Verify closed polls with votes render the top-vote card and final ranking list.
- Verify rows sort by vote count descending.
- Verify missing images do not reserve thumbnail space.
- Run the app's relevant lint/test command after implementation.
