# Abdallah Yahia Chat

A full-stack educational community web app for Abdallah Yahia's students. Features anonymous group chat, private study plans, personal challenges, file sharing, and a moderated community space.

## Architecture

Monorepo (pnpm workspaces) with three artifacts:

- `artifacts/ay-chat` — React + Vite frontend with Clerk auth, Tailwind v4, shadcn/ui
- `artifacts/api-server` — Express 5 backend with Socket.io for realtime, Clerk middleware, Drizzle ORM
- `artifacts/mockup-sandbox` — design sandbox (separate from the chat app)

Shared libs:
- `lib/db` — Drizzle schemas (users, messages, study_plans, challenges, chat_settings)
- `lib/api-spec` — OpenAPI source of truth
- `lib/api-zod` — generated zod request/response schemas
- `lib/api-client-react` — generated React Query client (currently unused; UI uses `apiFetch` helper)
- `lib/object-storage-web` — Uppy v5 ObjectUploader for file uploads

## Key Features

- **Anonymous chat handles** — real names stored in DB; `Mo***`-style names exposed publicly via `anonymizeName()`
- **Real-time messages** — Socket.io broadcasts (`message:new`, `message:update`, `message:delete`, `chat:state`) on the default `/socket.io` path, exposed by the api-server artifact
- **File sharing** — images, PDFs, Word docs via existing `/storage/uploads/request-url` flow (presigned PUT)
- **Profanity filter** — English (`bad-words` package) + Arabic word list, applied on create/update
- **Edit / delete** — own messages always; admins can delete anyone's
- **Admin panel** — user list with mute/ban/admin toggles, view any user's private study plans + challenges, disable chat globally, pin announcement banner
- **First user becomes admin** — auto-promoted in `requireAuth` middleware on first registration
- **Dark mode** — Discord-inspired dark theme + WhatsApp-inspired light theme, toggle in sidebar
- **Read receipts** — WhatsApp-style ticks (sent / delivered / seen) using `deliveredTo` + `seenBy` jsonb int[] on each message
- **Web Push notifications** — Service Worker (`public/sw.js`) + VAPID keys auto-generated and stored in `chat_settings`; subscriptions saved in `push_subscriptions` table; sent on every new message via `sendPushToOthers`
- **Polls / voting** — any message can carry a poll (jsonb `poll` column on `messagesTable` + `poll_votes` table). Single-choice or multi-choice, optional close-poll action by author/admin. UI: `PollCreator` dialog opened from the composer chart-icon button, results rendered inline as `PollCard` with progress bars, voter tooltips and live updates over the existing `message:update` socket event.

## Auth

Clerk (`@clerk/react` v6 on the client, `@clerk/express` v2 on the server). Custom appearance uses `shadcn` theme with brand color overrides. Uses Replit Clerk proxy via `clerkProxyMiddleware`. Required envs: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`.

## Routing

Client uses `wouter` with `<Router base={import.meta.env.BASE_URL}>`. All API calls go through `apiFetch()` which prepends the artifact base path + `/api`.

## DB

Postgres via `DATABASE_URL`. Push schema with `pnpm --filter @workspace/db run push`.

## User Preferences

- No emojis anywhere in the UI.
- Discord/WhatsApp-inspired visual style (sidebar dark, chat content area light/dark).
- All real names stay private — only admins see them in the admin panel.
