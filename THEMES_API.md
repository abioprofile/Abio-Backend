# Theme management

All endpoints use the standard response envelope. Base path: `/api/v1/themes`.

- `GET /`: authenticated users list themes, newest first.
- `POST /`: admin or moderator creates a theme.
- `GET /:id`: admin or moderator reads one theme.
- `PATCH /:id`: admin or moderator updates a theme.
- `DELETE /:id`: admin or moderator deletes an unused theme.

Creation requires `name`, `font_config`, `corner_config`, and `wallpaper_config`. Names are trimmed, nonempty, and at most 120 characters. PATCH accepts any nonempty subset of those fields. Supplied configuration sections replace that entire section; omitted sections remain unchanged. All configuration validation matches the preferences schemas. Image wallpapers accept an already hosted URL.

Missing themes return 404. Duplicate names return 409. Deleting a theme selected by any display preference returns 409; change those selections before deleting. A transaction locks the theme row before checking references to prevent concurrent selections from bypassing this protection. No profile preferences are changed by theme editing/deletion. Saved profile styles remain their own snapshots.

Run isolated service/schema checks (no database writes):
`node node_modules/vitest/vitest.mjs run --config vitest.themes.config.mts`
