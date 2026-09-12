# حالة ربط مشروع Abdallah Yahia بـ Supabase — بعد التنفيذ

المشروع اتربط فعليًا بـ Supabase (project ref: `tnlmqkwmhrnhgxxhwfpy`)، والـ schema
اتطبق، وتم تعديل كود الـ Auth وStorage وRealtime وPush وDB layer بالكامل تقريبًا.
الملف ده بيوثّق بالظبط اللي اتعمل واللي لسه محتاج منك خطوة يدوية أو اختبار محلي،
لأني معنديش الـ secrets ولا قاعدة الإنتاج القديمة عشان أشغّل وأختبر كل حاجة end-to-end.

---

## ✅ اللي خلص فعليًا (على قاعدة Supabase نفسها)

- طُبّق `supabase/migrations/001_initial_schema.sql` بالكامل: كل الجداول، bucket
  `chat-attachments`، الـ RLS policies، الـ triggers، وaddition الجداول لـ
  `supabase_realtime` publication.
- اتصلحت 3 مشاكل أمان كانت ظاهرة في الـ Security Advisor (view كان
  `SECURITY DEFINER` بالغلط، دالة من غير `search_path` ثابت، RPC مكشوف من غير داعي).
- اتصلح أداء الـ RLS: 26 policy كانت بتنفّذ `auth.uid()` لكل صف بدل مرة واحدة،
  زودت index ناقص على foreign keys في `notifications`، ودمجت policies مكررة.

## ✅ اللي خلص في الكود (على القرص، مش مرفوع لسه)

### Auth
- `middlewares/auth.ts`, `lib/supabaseAdmin.ts` (باك إند) — يتحقق من Supabase JWT.
- `lib/supabase.ts`, `lib/auth.tsx`, `pages/auth-forms.tsx`, `App.tsx`,
  `AppShell.tsx` (فرونت إند) — auth كامل بدل Clerk، مع صفحات sign-in/sign-up يدوية.
- Clerk اتشال من الـ `package.json` بتاعت الفرونت والباك، ومن CSS.

### Database layer (Drizzle schema)
- `lib/db/src/schema/*` بالكامل بقت متطابقة مع الـ schema المطبق فعليًا على
  Supabase: `profiles` بدل `users`، uuid بدل serial/integer في كل مكان،
  جدول `message_receipts` حقيقي بدل JSON arrays (`delivered_to`/`seen_by`).
- `lib/db/src/index.ts` بيستخدم SSL للاتصال بـ Supabase Postgres.

### Routes (باك إند)
كل الـ routes دي اتعدلت لتستخدم uuid + `profiles` + بدون أي `broadcast()`:
`routes/messages.ts`, `routes/chatState.ts`, `routes/profile.ts`,
`routes/admin.ts`, `routes/users.ts`, `routes/presence.ts`, `routes/storage.ts`,
`routes/auth.ts`. الـ realtime دلوقتي عن طريق Postgres Changes مش Socket.io.

### Storage
- `lib/objectStorage.ts`, `routes/storage.ts` — Supabase Storage بدل GCS/Replit،
  مع فرض `requireAuth` (كان فيه ثغرة قبل كده — مذكورة في MIGRATION_MAP.md).
- `lib/object-storage-web` (use-upload.ts + ObjectUploader.tsx) — بقت بتستخدم
  `uploadToSignedUrl` بدل Uppy/S3.

### Realtime
- `lib/realtime.ts` (فرونت)، `hooks/useChatRealtime.ts` — الفرونت بيشترك في
  Postgres Changes على `messages`, `message_reactions`, `poll_votes`,
  `message_receipts`, `chat_settings` بدل Socket.io. الباك إند مبقاش فيه
  Socket.io server خالص (`index.ts` اتنضف).
- **مهم:** الـ Postgres Changes بترجّع الصف الخام من الجدول (من غير اسم الكاتب،
  تجميع الـ reactions، إلخ). بدل ما نكرر كل منطق الـ join في المتصفح، الحل
  الحالي هو إن أي تغيير في الجداول دي يعمل `invalidateQueries(["messages"])`
  (بعد debounce بسيط) فيرجع يجيب النسخة الكاملة المنسّقة من `/api/messages`.
  ده أبسط وأصح، بس معناه إن في refetch بدل push فوري لكل حدث — مقبول لحجم
  شات عادي، وسهل تحسينه بعدين لو الحمل زاد.

### Push
- `lib/push.ts` — الـ VAPID keys بقت بتتقرا من environment variables
  (`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`) مش من عمود في
  قاعدة البيانات زي قبل.

### Types
- `artifacts/ay-chat/src/lib/types.ts` بالكامل بقى uuid (`string`) بدل
  `number`، وشلت `clerkId`/`email` من `CurrentUser`/`FlaggedMessage`.

---

## ⚠️ لسه محتاج منك (بالترتيب من الأهم)

### 1. الـ env variables (خطوة إلزامية قبل أي تشغيل)
انسخ `.env.example` في كل من `artifacts/ay-chat` و`artifacts/api-server` إلى
`.env` واملأ:
- `VITE_SUPABASE_PUBLISHABLE_KEY` و `SUPABASE_SERVICE_ROLE_KEY` — من
  Supabase Dashboard → Project Settings → API.
- `DATABASE_URL` — من Project Settings → Database (استخدم الـ connection
  string بتاع Supabase نفسه، مش أي قاعدة قديمة).
- `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` — ولّدهم بـ
  `npx web-push generate-vapid-keys` وحطهم كـ secrets (مش في Git).

### 2. إعداد Authentication من لوحة Supabase
زي ما هو موضّح في `SUPABASE_CONNECTION_GUIDE_AR.md` الأصلي: فعّل Email +
Email confirmation، عطّل أي OAuth provider مش محتاجه، فعّل MFA بعد ما تتأكد إن
شاشة الـ 2FA اتعملت في الفرونت (لسه معمولاش — مش من ضمن اللي طلبته النهاردة).

### 3. أول admin
شلت منطق "أول مستخدم يبقى admin تلقائيًا" (كان فيه سباق/ثغرة كما ذُكر في
MIGRATION_MAP.md). بعد أول تسجيل حساب، رقّي نفسك admin يدويًا بـ SQL Editor:
```sql
update public.profiles set role = 'admin' where id = '<your-auth-user-id>';
```

### 4. تشغيل الفحوصات المحلية
```bash
pnpm install
pnpm run typecheck
```
معنديش القدرة أشغّل `pnpm install`/`typecheck` هنا (الشبكة عندي مقفولة على
npm/pip registries بس، ومفيش الـ secrets)، فمتوقع تلاقي أخطاء type صغيرة
محتاجة تصحيح — أكبر مصدر متوقع هو:

### 5. حزمة `@workspace/api-zod` (Generated types) — محتاجة regenerate
الحزمة دي متولدة من `lib/api-spec/openapi.yaml` عن طريق orval، ومفيهاش لسه
تحديث الـ id fields من `integer` لـ `string (uuid)` ولا حذف `clerkId`/`email`.
**متعدلش الملفات المتولدة يدويًا** (فيها تعليق "Do not edit manually") — عدّل
`lib/api-spec/openapi.yaml` (خصوصًا الأجزاء اللي فيها `type: integer` لـ id
fields، و`clerkId`/`email` في schema المستخدم) وبعدين شغّل أمر التوليد
(orval) اللي معرّف في `package.json` بتاع `api-spec` أو `api-zod`.

### 6. الأجزاء اللي معملتش فيها تغيير (خارج نطاق اللي طلبته):
- **MFA/2FA UI** في الفرونت — مش موجودة أصلًا في الكود القديم، فمفيش حاجة
  اتشالت، بس لو عايز تفعّل MFA من الخطوة 2 محتاج شاشة جديدة.
- **Presence عن طريق Supabase Presence channel** بدل الـ in-memory `Map` في
  `lib/presence.ts` — سيبتها زي ما هي (بس بقت uuid-based) لأنها شغالة صح
  لسيرفر instance واحد؛ لو هتشغّل أكتر من instance/serverless محتاج فعلًا
  تتحول لـ Supabase Presence channel.
- **تصدير البيانات القديمة والـ mapping** (`scripts/src/export-legacy-data.ts`)
  — لسه متستخدمش، لأنه محتاج `DATABASE_URL` لقاعدة الإنتاج القديمة اللي
  معنديش وصول ليها. لو عندك بيانات فعلية عايز تنقلها، قولّي وهساعدك تبني
  الـ mapping بين `integer id` القديم و`uuid` الجديد.

---

## اختبار سريع بعد ما تحط الـ env variables

```bash
pnpm install
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/ay-chat run dev
```
سجّل حساب جديد → أكّد الإيميل (لو مفعّل) → سجّل دخول → ابعت رسالة → افتحها في
تاب تاني وشوف لو وصلت realtime من غير refresh. لو حصل خطأ، الأغلب يكون إما
`.env` ناقص أو الـ `@workspace/api-zod` لسه مش متولد من جديد (خطوة 5).
