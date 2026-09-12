# Supabase Migration Map

تاريخ التدقيق: 2026-09-11  
المصدر الذي تم تدقيقه: `Abdallah-Yahia.zip` من الرابط الموجود في الملف المرفق.

## الخلاصة التنفيذية

المشروع الحالي **ليس مستقلًا عن Replit**. توجد أربع طبقات اعتماد رئيسية:

1. **Authentication:** Clerk في الواجهة والخادم، مع Clerk proxy خاص بـ Replit.
2. **Database:** PostgreSQL عبر Drizzle و`DATABASE_URL`، لكن الوصول يتم من خادم Express الحالي.
3. **Storage:** Google Cloud Storage مع Replit Sidecar على `127.0.0.1:1106`.
4. **Realtime / presence:** Socket.io وحالة online محفوظة في `Map` داخل ذاكرة Node.js.

تمت إضافة مخطط PostgreSQL الهدف في:

- `supabase/migrations/001_initial_schema.sql`
- `supabase/README.md`

لم يتم حذف أي package أو route أو خدمة من المصدر في هذه المرحلة. ما زال نقل Auth وStorage وRealtime وPush يحتاج تنفيذًا منفصلًا واختبارات تشغيلية.

## الجرد الحالي لقاعدة البيانات

الجداول الموجودة فعليًا في `lib/db/src/schema/`:

| الجدول الحالي | المصدر | الملاحظات |
|---|---|---|
| `users` | `users.ts` | مفتاح `serial`، وهوية Clerk في `clerk_id`، ويتضمن بيانات خاصة وflags إدارية. |
| `messages` | `messages.ts` | الرسائل، المرفقات، polls، replies عبر `parent_id`، pin/edit/delete، ومصفوفات JSON للإيصال. |
| `message_reactions` | `messageReactions.ts` | reaction لكل مستخدم ورسالة وإيموجي. |
| `poll_votes` | `pollVotes.ts` | أصوات poll. |
| `study_plans` | `studyPlans.ts` | خطط المستخدم الخاصة. |
| `challenges` | `challenges.ts` | تحديات المستخدم الخاصة. |
| `chat_settings` | `chatSettings.ts` | حالة الشات والإعلان ومفاتيح VAPID الحالية. مفاتيح VAPID لا ينبغي نقلها إلى جدول عام. |
| `activity_logs` | `activityLogs.ts` | سجل نشاط إداري/تشغيلي. |
| `push_subscriptions` | `pushSubscriptions.ts` | اشتراكات Web Push. لا يوجد FK حاليًا إلى `users`. |

لا توجد في النسخة الحالية جداول فعلية باسم `profiles` أو `groups` أو `notifications` أو `message_receipts`. تمت إضافة هذه الجداول في مخطط الهدف حيث تخدم متطلبات Supabase والميزات المطلوبة، مع إبقاء الفرق موثقًا بدل افتراض أنها كانت موجودة.

## مصفوفة الاعتماديات

### 1. Replit runtime وdeployment

| الاعتماد | مكانه | الوظيفة الحالية | البديل الهدف | نوع Supabase / التغيير |
|---|---|---|---|---|
| Replit deployment/router | `.replit`، خصوصًا `[deployment]` و`[[ports]]` | تشغيل artifactين على منافذ Replit وربط `/api` | استضافة Vite مستقلة + Edge Functions أو API مستضاف مستقلًا | ليس Supabase؛ إزالة إعدادات Replit من النشر |
| Replit artifact services | `artifacts/api-server/.replit-artifact/artifact.toml` | نشر API على 8080 مع `/api` و`/socket.io` | Supabase مباشرة من العميل، وEdge Functions للعمليات الموثوقة | Edge Functions عند الحاجة |
| Replit frontend artifact | `artifacts/ay-chat/.replit-artifact/artifact.toml` | تشغيل Vite على 21764 وإعادة كتابة المسارات | أي static hosting مستقل | ليس اعتماد runtime مطلوبًا |
| `PORT`, `BASE_PATH`, `REPL_ID` | `artifacts/*/vite.config.ts`, `api-server/src/index.ts` | bootstrap خاص ببيئة artifact | `VITE_SUPABASE_URL` وpublishable key، مع إعدادات استضافة عادية | إزالة الشروط الخاصة بـReplit؛ الإبقاء على `PORT` فقط إن بقي خادم مستقل |
| `@replit/vite-plugin-*` | `artifacts/ay-chat/package.json`, `artifacts/mockup-sandbox/package.json`, ملفات Vite وlockfile | cartographer، dev banner، runtime error overlay | أدوات Vite عادية أو لا شيء | إزالة packages بعد التأكد من عدم الحاجة إليها |

### 2. Authentication

| الاعتماد | مكانه | الوظيفة الحالية | بديل Supabase | الملفات المتأثرة |
|---|---|---|---|---|
| Clerk React | `artifacts/ay-chat/src/App.tsx` | `ClerkProvider`, `SignIn`, `SignUp`, route guards | `@supabase/supabase-js` و`supabase.auth` | `App.tsx`, `index.css`, `package.json` |
| Clerk React user/session | `AppShell.tsx`, `lib/presence.ts`, `App.tsx` | user identity، sign out، signed-in state | `onAuthStateChange`, `getSession`, `signOut` | هذه الملفات و`lib/types.ts` |
| Clerk Express middleware | `api-server/src/app.ts` | استخراج الهوية من cookie/session | تحقق JWT من Supabase أو نقل route إلى Edge Function | `app.ts`, `middlewares/auth.ts` |
| Clerk user sync | `middlewares/auth.ts` | إنشاء user محليًا ومزامنة الصورة والاسم | trigger من `auth.users` إلى `public.profiles` | `middlewares/auth.ts`, schema |
| Clerk proxy | `middlewares/clerkProxyMiddleware.ts` و`app.ts` | proxy إلى Clerk على custom/Replit domains | حذف middleware؛ Supabase Auth يتصل مباشرة بنطاق Supabase | حذف الملف بعد اكتمال النقل |
| `clerk_id` | `lib/db/src/schema/users.ts` وroutes | ربط السجل المحلي بهوية Clerk | `profiles.id uuid references auth.users(id)` | schema وكل استعلامات `usersTable` |
| Google OAuth | إعدادات Clerk وواجهة Clerk الحالية | مزود تسجيل خارجي محتمل | ممنوع في الهدف؛ email/password وphone verification فقط | يجب حذف أي provider config عند تنفيذ Auth |

متطلبات التسجيل المستهدفة: `display_name`, email, phone اختياري/مطلوب حسب المنتج، password، email confirmation، phone MFA عند الحاجة، وTOTP أو آلية MFA المدعومة من Supabase. كلمات المرور وrefresh tokens تبقى داخل Supabase Auth ولا تدخل `public`.

### 3. Database

| الاعتماد | مكانه | الوظيفة الحالية | البديل |
|---|---|---|---|
| `DATABASE_URL` | `lib/db/src/index.ts`, `drizzle.config.ts` | اتصال Node مباشرة إلى PostgreSQL | Supabase Postgres، مع RLS؛ يمكن إبقاء Drizzle مؤقتًا أثناء الجسر |
| Drizzle queries | كل `api-server/src/routes/*.ts` | CRUD للمستخدمين والرسائل والإدارة | Supabase client/PostgREST، أو Edge Functions للعمليات المركبة والامتيازات |
| auto-admin أول مستخدم | `middlewares/auth.ts` | قرار إداري داخل race-prone request flow | trigger/transaction أو تعيين admin آمن بعد التسجيل |
| JSON receipt arrays | `messages.ts` | delivered/seen داخل `delivered_to`, `seen_by` | جدول `message_receipts` بمفتاح مركب وفهارس |

### 4. Storage وuploads

| الاعتماد | مكانه | الوظيفة الحالية | البديل |
|---|---|---|---|
| Replit Sidecar `http://127.0.0.1:1106` | `api-server/src/lib/objectStorage.ts` | الحصول على credentials وsigned URL | Supabase Storage signed upload URL أو direct upload |
| `@google-cloud/storage` | `api-server/package.json`, `objectStorage.ts`, `objectAcl.ts` | bucket/file metadata/download | Supabase Storage bucket `chat-attachments` |
| `PUBLIC_OBJECT_SEARCH_PATHS` | `objectStorage.ts` | public object search roots | bucket/prefix policies |
| `PRIVATE_OBJECT_DIR` | `objectStorage.ts` | private object root | user-owned folders + Storage RLS |
| upload route | `routes/storage.ts` | presigned upload URL وdownload proxy | `storage.from("chat-attachments").createSignedUploadUrl` أو Edge Function |
| Uppy client | `lib/object-storage-web`, `Composer.tsx` | رفع الملفات عبر route الحالي | Supabase Storage JS client أو Uppy adapter مع signed URL |

### 5. Realtime وpresence

| الوظيفة | مكانها | التنفيذ الحالي | البديل |
|---|---|---|---|
| إرسال واستقبال الرسائل | `routes/messages.ts`, `lib/realtime.ts`, `hooks/useChatSocket.ts` | CRUD ثم Socket.io broadcast | insert في `messages` ثم Postgres Changes |
| update/delete/pin/reaction/poll | `routes/messages.ts` | Socket events `message:update/delete` | Postgres Changes على `messages`, `message_reactions`, `poll_votes` |
| receipts | `routes/messages.ts`, `useChatSocket.ts` | arrays + `message:receipt` | `message_receipts` + Postgres Changes |
| chat state | `routes/chatState.ts` | DB row + `chat:state` | `chat_settings` + Postgres Changes |
| typing | لا يوجد event دائم في النسخة الحالية | لا يوجد تنفيذ مثبت في source snapshot | Supabase Broadcast، دون تخزين دائم |
| online presence | `api-server/src/lib/presence.ts` | `Map<number, number>` في ذاكرة process + heartbeat | Supabase Presence channel |
| Socket.io server/client | `api-server/src/index.ts`, `lib/realtime.ts`, `ay-chat/src/lib/socket.ts` | اتصال `/socket.io` | حذف بعد نجاح Realtime parity test |

لا يجوز الاعتماد على `Map` أو ذاكرة Node لحالة مهمة؛ إعادة تشغيل الخادم الحالي تفقد presence فورًا، بينما الرسائل نفسها تبقى في PostgreSQL.

### 6. Notifications وPush

| الاعتماد | مكانه | الوظيفة الحالية | البديل |
|---|---|---|---|
| Web Push | `api-server/src/lib/push.ts`, `routes/push.ts` | إرسال push من الخادم لكل رسالة جديدة | Edge Function مع secrets، أو مزود Push مستقل |
| VAPID secrets | `chat_settings` و`initPush()` | توليد وتخزين private key داخل DB | secrets في Supabase Edge Functions فقط |
| Browser notifications | `lib/notifications.ts`, `public/sw.js` | إشعار/صوت محلي بعد Realtime event | يبقى client-side مع Supabase event |
| durable notifications | غير موجود حاليًا | لا يوجد inbox محفوظ | جدول `notifications` في migration الهدف، ويحتاج ربط routes/UI لاحقًا |

## جرد API والملفات التابعة

### Routes الحالية

- `GET /api/healthz` — health check؛ `routes/health.ts`.
- `GET /api/me` — Clerk-to-local user sync؛ `routes/auth.ts`, `middlewares/auth.ts`.
- `PATCH /api/me/profile` — `routes/profile.ts`.
- `GET/PATCH /api/chat/state` — `routes/chatState.ts`.
- `GET/POST /api/messages` — list/create؛ `routes/messages.ts`.
- `PATCH/DELETE /api/messages/:id` — edit/delete.
- `POST /api/messages/bulk-delete` — admin delete.
- `POST /api/messages/:id/pin` و`/unpin` — pin.
- `POST /api/messages/receipts/delivered` و`/seen` — receipts.
- `POST /api/messages/:id/reactions` — add/remove reaction.
- `POST /api/messages/:id/vote` و`/poll/close` — polls.
- `GET/POST/DELETE /api/study-plans` — `routes/profile.ts`.
- `GET/POST/DELETE /api/challenges` — `routes/profile.ts`.
- `GET/PATCH /api/admin/users` — admin user management.
- `GET /api/admin/users/:id/study-plans` و`/challenges` — admin private views.
- `GET /api/admin/stats`, `GET /api/admin/messages/flagged`, `DELETE /api/admin/messages/:id`.
- `POST /api/storage/uploads/request-url`, `GET /api/storage/public-objects/*`, `GET /api/storage/objects/*`.
- `POST /api/presence/heartbeat`, `GET /api/presence`.
- `GET /api/users/directory`.
- `GET /api/push/vapid-public-key`, `POST /api/push/subscribe`, `POST /api/push/unsubscribe`.

### WebSocket / events

`api-server/src/lib/realtime.ts` و`ay-chat/src/hooks/useChatSocket.ts` يستخدمان:

- `message:new`
- `message:update`
- `message:delete`
- `message:receipt`
- `chat:state`

`typing` و`delivered` و`seen` يجب فصلها في التصميم الهدف: الرسائل والإيصالات المخزنة عبر Postgres Changes، وtyping عبر Broadcast، وonline عبر Presence.

## الملفات التي ستتغير في مراحل النقل

### مرحلة Auth

`artifacts/ay-chat/package.json`, `src/App.tsx`, `src/components/AppShell.tsx`, `src/lib/presence.ts`, `src/lib/types.ts`, `src/index.css`, `artifacts/api-server/package.json`, `src/app.ts`, `src/middlewares/auth.ts`, `src/middlewares/clerkProxyMiddleware.ts`, `routes/auth.ts`, `lib/db/src/schema/users.ts`.

### مرحلة Database

`lib/db/src/schema/*.ts`, `lib/db/src/index.ts`, `lib/db/drizzle.config.ts`, كل routes التي تستورد `@workspace/db`, وملفات API types/generated schemas. تم تجهيز SQL الهدف في `supabase/migrations/001_initial_schema.sql` دون حذف مخطط Drizzle القديم.

### مرحلة Storage

`artifacts/api-server/src/lib/objectStorage.ts`, `objectAcl.ts`, `routes/storage.ts`, `api-server/package.json`, `lib/object-storage-web/*`, `artifacts/ay-chat/src/components/chat/Composer.tsx`, وschema/paths الخاصة بـattachments.

### مرحلة Realtime

`api-server/src/index.ts`, `lib/realtime.ts`, `lib/presence.ts`, كل `broadcast()` في routes، `ay-chat/src/lib/socket.ts`, `hooks/useChatSocket.ts`, `lib/presence.ts`, و`pages/chat.tsx`.

### مرحلة Push

`api-server/src/lib/push.ts`, `routes/push.ts`, `lib/db/src/schema/chatSettings.ts`, `pushSubscriptions.ts`, `ay-chat/src/lib/push.ts`, و`public/sw.js`. يجب أن تنتقل VAPID private key إلى Edge Function secret.

## متطلبات البيئة الحالية مقابل الهدف

### الحالية التي تكشف اعتمادًا على المنصة

`DATABASE_URL`, `PORT`, `BASE_PATH`, `REPL_ID`, `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PROXY_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `PUBLIC_OBJECT_SEARCH_PATHS`, `PRIVATE_OBJECT_DIR`, ومفاتيح VAPID المخزنة في DB.

### الهدف

- Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Supabase CLI/CI فقط: `SUPABASE_DB_URL` أو اتصال Supabase CLI الموثق.
- Server/Edge Functions فقط: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` عند الحاجة للعمليات الموثوقة.
- Push Edge Function secrets: `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`.

لا يوضع `SUPABASE_SERVICE_ROLE_KEY` أو أي private/VAPID secret في الواجهة أو ملفات `.env` الملتزمة بالمستودع.

## ما تم وما لم يتم

### تم

- تنزيل snapshot المصدر وفحص بنية monorepo والـartifacts والـshared libraries.
- حصر الجداول والـroutes وSocket events وStorage وAuth وpresence.
- تحديد الاعتماديات الصريحة والمخفية على Replit.
- إنشاء مخطط Supabase أولي UUID-based مع foreign keys وRLS وindexes وStorage policies وRealtime publication.
- إنشاء دليل تشغيل SQL في `supabase/README.md`.
- إضافة `pnpm --filter @workspace/scripts run export-legacy-data` لتصدير بيانات PostgreSQL القديمة للترحيل دون تعديلها.
- استبعاد `chat_settings.vapid_private_key` عمدًا من التصدير؛ المفتاح الخاص مكانه النهائي secrets وليس ملف بيانات.
- اجتياز `pnpm run typecheck` و`PORT=3000 BASE_PATH=/ pnpm run build` بعد إصلاح أخطاء baseline الموجودة.

### لم يتم عمدًا في هذه المرحلة

- لم يتم حذف Clerk أو Socket.io أو Google Cloud/Replit Storage.
- لم يتم تغيير الواجهة أو API contracts.
- لم يتم نقل بيانات PostgreSQL القديمة؛ يلزم mapping من integer IDs إلى UUIDs قبل ذلك.
- لم يتم تنفيذ SQL على مشروع Supabase؛ اتصال Supabase موجود في البيئة لكن خادم MCP لم يكن قابلًا للوصول أثناء المحاولات.
- لم يتم الادعاء بأن اختبارات التسجيل أو MFA أو upload أو Realtime ناجحة قبل توفر مشروع Supabase وcredentials صحيحة.

## المخاطر والقرارات المطلوبة قبل التنفيذ الكامل

1. **توافق الهوية:** كل `users.id` الحالي integer، بينما `auth.users.id` UUID؛ يلزم جدول mapping/ETL قبل نقل البيانات.
2. **خصوصية الملفات:** route الحالي يسمح بطلب upload URL دون `requireAuth`; يجب فرض Auth وfolder ownership في Supabase Storage.
3. **خصوصية المستخدم:** البريد والهاتف لا يجب أن يظهرا في directory العام؛ لذلك يفصل مخطط الهدف `profiles` عن view عام محدود.
4. **صلاحيات الإدارة:** قرار “أول مستخدم admin” يحتاج آلية آمنة في database أو bootstrap يدوي، وليس فحصًا متزامنًا من كل request.
5. **Push:** private VAPID keys الحالية لا يجب نسخها إلى Supabase table عامة؛ ينبغي تدويرها ووضعها في Edge Function secrets.
6. **Socket removal:** لا تحذف Socket.io إلا بعد اختبار parity لكل create/update/delete/receipt/reaction/poll/state.
