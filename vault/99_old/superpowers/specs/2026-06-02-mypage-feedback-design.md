# Mypage Feedback Design

## Goal

Logged-in users can leave a short text feedback message from `/my`, and the app stores it in Supabase for operators to review later.

## Scope

- Add one feedback entry button to the existing mypage screen.
- Add a dedicated `/my/feedback` page for writing feedback.
- Store feedback as text linked to the current authenticated user.
- Show submit, pending, success, and error states in the mypage UI.
- Keep mock mode non-persistent and successful, matching other demo-only flows.

Out of scope:

- Feedback categories.
- Admin review UI.
- Email, Slack, or webhook notifications.
- Editing or deleting submitted feedback.

## Architecture

Create a `user_feedback` table with `user_id`, `content`, and timestamps. Add an insert-only RLS policy for authenticated users so each row must be written by its owner. Operators can review rows through Supabase with privileged access.

Add a small pure feedback validator/normalizer that trims content and enforces a 500-character limit. The server action uses that helper before inserting into Supabase. The feedback page client imports the action on submit, clears the textarea on success, and displays a short status message.

## UI

Place a feedback button in the account settings area of `/my`. The button navigates to `/my/feedback`, which uses the existing card, button, typography, and spacing patterns already present in the app.

The section contains:

- A compact heading with the feedback count omitted.
- A textarea capped at 500 characters.
- A submit button with a send icon.
- One inline status message after submission.

## Data Flow

1. User clicks the feedback button on `/my`.
2. User types feedback on `/my/feedback`.
3. Client calls `submitFeedback(content)`.
4. Server action checks mock mode and authentication.
5. Server action normalizes content.
6. Supabase inserts into `user_feedback`.
7. Client clears the field and shows success, or keeps the field and shows an error.

## Testing

- Add a Node test for the feedback normalizer covering empty content, trimming, valid content, and length limit.
- Run the new feedback test and the existing build or lint command available in the app.
