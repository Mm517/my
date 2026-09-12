# Supabase setup

هذا المجلد هو طبقة Supabase الهدف للمشروع. المخطط الحالي القديم المبني على Drizzle لم يُحذف بعد، لأن الترحيل يحتاج مرحلة mapping واختبار قبل إيقافه.

## 1. تشغيل الـ migration

### من لوحة Supabase

1. أنشئ مشروع Supabase جديدًا.
2. افتح **SQL Editor**.
3. انسخ محتوى `supabase/migrations/001_initial_schema.sql`.
4. شغّله مرة واحدة.
5. تحقق من ظهور الجداول في `public` ومن ظهور bucket باسم `chat-attachments` في Storage.

### باستخدام Supabase CLI

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

إذا لم يكن المشروع مربوطًا بعد:

```bash
supabase init
supabase link --project-ref <project-ref>
supabase db push
```

لا تشغّل migration الهدف على قاعدة الإنتاج القديمة دون backup وخطة mapping؛ الـIDs القديمة integer والهدف يستخدم UUID.

## 1.1 تصدير البيانات القديمة قبل النقل

يمكن إنشاء نسخة JSON للقراءة والتحليل من قاعدة PostgreSQL الحالية دون تعديلها:

```bash
DATABASE_URL="postgresql://..." \
  pnpm --filter @workspace/scripts run export-legacy-data
```

يمكن تمرير مجلد إخراج مختلف كوسيط ثانٍ:

```bash
DATABASE_URL="postgresql://..." \
  pnpm --filter @workspace/scripts run export-legacy-data -- /tmp/abdallah-migration
```

الأداة تصدر الجداول القديمة و`manifest.json`، وتقرأ فقط ولا تنفذ `INSERT` أو `UPDATE` أو `DELETE`. تستبعد `chat_settings.vapid_private_key` عمدًا؛ هذا السر يجب تدويره ووضعه لاحقًا في secrets الخاصة بالـEdge Function، وليس في ملف التصدير أو قاعدة البيانات الهدف.

## 2. Auth configuration

في **Authentication → Providers**:

- فعّل Email.
- فعّل تأكيد البريد الإلكتروني.
- عطّل Google وأي OAuth provider آخر؛ الهدف لا يستخدم Google Login.
- فعّل Phone فقط إذا كان مزود SMS مضبوطًا ومطلوبًا فعليًا.
- فعّل MFA/TOTP من إعدادات المشروع عند نقل واجهة 2FA.

تسجيل المستخدم المقترح:

1. الواجهة تستدعي `supabase.auth.signUp({ email, password, options: { data: { display_name, phone } } })`.
2. Supabase يرسل email confirmation.
3. trigger `handle_new_user()` ينشئ صف `public.profiles`.
4. phone verification وMFA يتمان من Supabase Auth؛ لا تحفظ password أو refresh token في `public`.
5. الاستعادة تستخدم `resetPasswordForEmail`.

## 3. Environment variables

### الواجهة فقط

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-or-anon-key>
```

الـpublishable/anon key مصمم للواجهة مع RLS. لا تضع `service_role` هنا.

### Server أو Edge Functions فقط

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only-key>
VAPID_PUBLIC_KEY=<public-key>
VAPID_PRIVATE_KEY=<private-key>
VAPID_SUBJECT=mailto:<verified-address>
```

لا تضع هذه القيم في Git أو في bundle الواجهة. مفاتيح VAPID private يجب أن تكون secrets في Edge Function، وليس في `chat_settings`.

## 4. Storage

الـmigration ينشئ bucket خاصًا باسم `chat-attachments` ويضع policies بحيث تكون الملفات داخل:

```text
<auth.uid()>/<filename>
```

التدفق المستهدف:

1. المستخدم يسجل الدخول.
2. الواجهة تنشئ signed upload URL أو ترفع مباشرة باستخدام Supabase Storage.
3. لا يوجد `127.0.0.1:1106` ولا Google Cloud credentials.
4. يخزن message attachment مسار bucket والـmetadata، وليس secret أو signed URL دائم.

## 5. Realtime

الـmigration يضيف الجداول اللازمة إلى publication `supabase_realtime` حيث أمكن. عند نقل الواجهة:

- `messages`, `message_reactions`, `message_receipts`, `poll_votes`, و`chat_settings`: Postgres Changes.
- typing: Broadcast فقط، دون صف دائم في قاعدة البيانات.
- online state: Presence channel.
- لا تعتمد على `Map` أو process memory.

يجب تنفيذ اختبار parity قبل إزالة Socket.io:

- رسالة جديدة، تعديل، حذف.
- reply، reaction، poll vote/close.
- delivered/seen receipts.
- تغيير chat state.
- reconnect وإعادة تحميل الصفحة دون فقدان الرسائل.

## 6. RLS والاختبار

اختبر بحسابين مختلفين:

- المستخدم يرى بياناته الخاصة وخططه وتحدياته.
- المستخدم لا يرى phone أو بيانات خاصة لمستخدم آخر.
- مستخدم عادي لا يستطيع تعديل أو حذف رسالة مستخدم آخر.
- admin يستطيع عمليات الإدارة المطلوبة.
- المستخدم المحظور لا يستطيع الإرسال.
- لا يستطيع مستخدم رفع ملف داخل folder مستخدم آخر.

هذه الملفات تجهز المخطط والسياسات فقط. نقل الـfrontend والroutes وEdge Functions يجب أن يأتي بعد تثبيت مشروع Supabase واختبار RLS فعليًا.