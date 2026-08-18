# Image Upload WebP Optimization and Banner Crop Design

## Goal

Reduce uploaded image size across poll and transfer-related image surfaces, while giving transfer banner uploads a simple 21:9 frame adjustment flow before saving.

## Approved Direction

Use the "upload then adjust" banner flow:

- Non-WebP image uploads are converted to WebP before storage.
- Poll option images and poll representative images save optimized WebP URLs.
- Transfer banner uploads open a 21:9 preview frame where the admin can adjust zoom and position.
- The adjusted 21:9 banner is saved as the final WebP file.
- Existing database image URL columns remain the source of truth; no crop metadata is stored.

## Current Context

The app already has a shared admin upload action, `uploadPhoto`, in `app/src/lib/actions/admin.ts`. It uploads the raw file bytes to the public Supabase Storage bucket `player-photos` and keeps the original extension and MIME type.

Current image surfaces:

- Admin free-choice poll option images already use file inputs and call `uploadPhoto`.
- Admin transfer banner images already use file inputs and call `uploadPhoto`.
- Admin player photos already use file inputs and call `uploadPhoto`.
- Admin poll representative images currently use a URL field.
- User-created polls currently use URL fields for representative images and free-choice option images.

The new upload behavior should keep changes surgical by extending this shared upload path where possible.

## Scope

In scope:

- Convert uploaded image files to WebP before storage.
- Use lower-size output settings by default.
- Add representative image file upload for all poll creation flows.
- Add free-choice option image file upload for user poll creation.
- Add a banner frame adjustment UI for transfer banner uploads.
- Store adjusted transfer banners as 21:9 WebP files.
- Keep existing image URL columns:
  - `polls.thumbnail_url`
  - `poll_options.image_url`
  - `farewells.banner_image_url`
  - existing player `photo_url`

Out of scope:

- Storing original image files.
- Storing crop metadata in the database.
- Retrofitting existing stored images.
- Adding a separate storage bucket.
- Supporting animated GIF preservation. Animated images can be treated as static image uploads.

## Upload Optimization

The shared upload action should save image uploads with:

- File extension: `.webp`
- Content type: `image/webp`
- Quality biased toward low size, starting around `72`
- Resize limits based on use:
  - General image uploads: cap the long edge to a reasonable display size.
  - Poll representative images: enough for card/detail display, not full-resolution originals.
  - Free-choice option images: smaller than representative images.
  - Player photos: square-ish display needs, still WebP optimized.
  - Transfer banners: final 21:9 image, sized for the banner frame.

If a file is already WebP, it should still pass through the optimization path so size and dimensions stay consistent.

## Banner Adjustment Flow

For transfer banner upload fields:

1. Admin selects an image file.
2. The UI shows a 21:9 preview frame matching the public banner ratio.
3. Admin can adjust:
   - zoom
   - horizontal position
   - vertical position
4. The client renders the adjusted frame to a 21:9 canvas.
5. The canvas output is uploaded through the same WebP storage action.
6. The returned public URL is saved to `banner_image_url`.

This keeps public rendering simple: the existing `FarewellBanner` can continue using `object-cover` with the stored URL because the saved asset already matches the frame.

## Poll Image Flow

Admin poll creation:

- Add a representative image file input next to the existing representative image URL field.
- If both URL and file are provided, prefer the explicit URL to avoid surprising replacement.
- Free-choice option image file inputs keep the existing behavior, but the upload result becomes an optimized WebP URL.

User poll creation:

- Add a representative image file input.
- Add file inputs for free-choice option images.
- Preserve existing URL fields for now so users can still paste image links.
- If both URL and file are provided for the same image, prefer the URL.

## Data Flow

```text
file input
  -> optional client-side banner crop
  -> FormData file
  -> shared upload action
  -> WebP conversion and resize
  -> Supabase Storage public URL
  -> existing database URL column
  -> existing public UI renders URL
```

## Error Handling

- Reject empty files.
- Reject non-image uploads based on MIME type.
- Return the existing upload error shape: `{ url?: string; error?: string }`.
- If optimization fails, surface an upload error and do not create or update the poll/transfer record.
- Keep user-facing messages short and specific, such as "이미지 업로드에 실패했습니다."

## Testing

Use test-first implementation for the image utility and upload path:

- A non-WebP image upload path produces a `.webp` storage path and `image/webp` content type.
- Existing WebP input is still saved as optimized WebP.
- Transfer banner crop output uses the expected 21:9 dimensions.
- Poll option upload flows set `image_url` to the uploaded WebP URL.
- Poll representative upload flows set `thumbnail_url` to the uploaded WebP URL.

Browser verification should cover:

- Admin free-choice option image upload.
- Admin poll representative image upload.
- Admin transfer banner upload with position/zoom adjustment.
- User poll representative image upload.
- User free-choice option image upload.

## Tradeoffs

This design favors small saved files and simple rendering. Because crop metadata is not stored, changing the banner frame ratio later would require re-uploading or re-cropping images. That is acceptable for the current goal because the approved direction prioritizes upload-time size reduction and a simple banner framing workflow.

