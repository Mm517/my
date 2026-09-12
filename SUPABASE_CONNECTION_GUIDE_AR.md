# دليل ربط مشروع Abdallah Yahia بـ Supabase

## الحالة الحالية بصراحة

النسخة المرفقة هي **نسخة مرحلة الترحيل التحضيرية** وليست نهاية الترحيل الكامل:

- تم إنشاء مخطط Supabase الهدف في `supabase/migrations/001_initial_schema.sql`.
- تم إنشاء خريطة الاعتماديات في `MIGRATION_MAP.md`.
- تم إنشاء أداة تصدير البيانات القديمة في `scripts/src/export-legacy-data.ts`.
- ما زال التطبيق الحالي يستخدم Clerk وSocket.io وReplit/Google Cloud Storage.
- لم يتم تطبيق SQL على قاعدة Supabase، ولم يتم نقل بيانات الإنتاج.
- لم يتم بعد استبدال Auth أو Storage أو Realtime داخل الواجهة والخادم.

لا تشغّل النسخة الجديدة على مستخدمين حقيقيين باعتبارها مستقلة عن Replit قبل إكمال مراحل Auth وStorage وRealtime واختبارها.

## 1. اختيار مشروع Supabase

المشروع الذي حددته أثناء العمل:

```text
https://supabase.com/dashboard/project/tnlmqkwmhrnhgxxhwfpy
```

Project Ref:

```text
tnlmqkwmhrnhgxxhwfpy
```

إذا كان هذا المشروع غير صحيح، استخدم Project Ref الصحيح في الخطوات التالية بدلًا منه.

## 2. تطبيق مخطط قاعدة البيانات

قبل التطبيق:

1. خذ Backup من قاعدة PostgreSQL القديمة.
2. لا تطبق المخطط الهدف فوق قاعدة الإنتاج القديمة مباشرة.
3. راجع فرق الـIDs: قاعدة التطبيق القديمة تستخدم `integer`، والمخطط الهدف يستخدم UUID مرتبطًا بـ`auth.users`.

من لوحة Supabase:

1. افتح **SQL Editor**.
2. افتح الملف `supabase/migrations/001_initial_schema.sql`.
3. انسخ محتواه إلى SQL Editor.
4. شغّله مرة واحدة.
5. تحقق من ظهور الجداول في `public`.
6. تحقق من ظهور bucket خاص باسم `chat-attachments`.
7. تحقق من وجود RLS policies وعدم وجود جداول التطبيق الجديدة بدون حماية.

مهم: لا تعيد تشغيل migration بلا داعٍ على قاعدة تحتوي بيانات؛ هذا الملف هو migration تأسيسي ويجب التعامل معه كجزء من سجل migrations.

## 3. إعداد Authentication

من **Authentication → Providers**:

- فعّل Email.
- فعّل Email Confirmation.
- عطّل Google وأي OAuth provider آخر حسب متطلبات المشروع.
- فعّل Phone فقط إذا تم إعداد SMS provider وكان الهاتف مطلوبًا.
- فعّل MFA/TOTP بعد نقل شاشة 2FA واختبارها.

المسار المستهدف للتسجيل:

1. `supabase.auth.signUp({ email, password })`
2. تأكيد البريد.
3. trigger ينشئ `public.profiles`.
4. تفعيل MFA من Supabase Auth.
5. استخدام `resetPasswordForEmail` لاستعادة كلمة المرور.

لا تنقل كلمات المرور أو refresh tokens إلى جداول `public`.

## 4. المفاتيح والـEnvironment Variables

ضع القيم في Secrets الخاصة ببيئة التشغيل، وليس في Git أو داخل هذا الملف.

### الواجهة

```env
VITE_SUPABASE_URL=https://tnlmqkwmhrnhgxxhwfpy.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-or-anon-key>
```

### الخادم أو Edge Functions فقط

```env
SUPABASE_URL=https://tnlmqkwmhrnhgxxhwfpy.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only-key>
VAPID_PUBLIC_KEY=<public-key>
VAPID_PRIVATE_KEY=<private-key>
VAPID_SUBJECT=mailto:<verified-address>
```

لا تضع `SUPABASE_SERVICE_ROLE_KEY` أو `VAPID_PRIVATE_KEY` في الواجهة أو في ملفات ملتزمة بالمستودع. لا ترسل أي مفتاح سري داخل المحادثة.

## 5. تجهيز بيانات PostgreSQL القديمة

الأداة الجديدة للقراءة فقط. تحتاج `DATABASE_URL` للقاعدة القديمة:

```bash
DATABASE_URL="postgresql://..." \
  pnpm --filter @workspace/scripts run export-legacy-data
```

أو حدّد مجلدًا خارجيًا:

```bash
DATABASE_URL="postgresql://..." \
  pnpm --filter @workspace/scripts run export-legacy-data -- /tmp/abdallah-migration
```

ستنتج الأداة:

- ملف JSON لكل جدول قديم.
- `manifest.json` بعدد الصفوف.
- بدون تنفيذ `INSERT` أو `UPDATE` أو `DELETE`.
- بدون تصدير `chat_settings.vapid_private_key`.

بعد التصدير يجب بناء mapping واضح من:

```text
old users.id (integer) -> new auth.users.id / public.profiles.id (uuid)
```

لا تستورد الرسائل أو الخطط أو التحديات قبل تثبيت هذا الـmapping.

## 6. ما يجب تغييره في الكود بعد نجاح الاتصال

هذه الخطوات لم تُنفذ بعد في النسخة الحالية:

1. استبدال Clerk بـSupabase Auth في `artifacts/ay-chat`.
2. استبدال Clerk middleware في `artifacts/api-server`.
3. استبدال Replit Sidecar وGoogle Cloud Storage بـSupabase Storage.
4. استبدال Socket.io بـPostgres Changes وBroadcast وPresence.
5. نقل VAPID private key إلى Edge Function secrets.
6. تحديث routes وAPI types مع الحفاظ على سلوك الواجهة.
7. تشغيل اختبارات RLS بحسابين عاديين وحساب admin.
8. حذف packages وإعدادات Replit وClerk فقط بعد نجاح اختبارات parity.

## 7. التحقق بعد الترحيل

اختبر على الأقل:

- التسجيل وتأكيد البريد وتسجيل الدخول والخروج.
- استعادة كلمة المرور.
- MFA/TOTP.
- إرسال وتعديل وحذف الرسائل.
- الردود والتفاعلات وpolls.
- delivered/seen receipts.
- رفع وتنزيل الملفات مع منع الوصول إلى folder مستخدم آخر.
- online presence وإعادة الاتصال.
- admin/ban/mute/chat state.
- push notifications.
- إعادة تحميل الصفحة بدون فقدان الرسائل.

## 8. فحوصات المشروع الحالية

```bash
pnpm install
pnpm run typecheck
PORT=3000 BASE_PATH=/ pnpm run build
```

قيم `PORT` و`BASE_PATH` في أمر البناء مؤقتة فقط لتجاوز إعداد Vite الحالي أثناء مرحلة الترحيل؛ إزالة اعتماد التشغيل على Replit تأتي ضمن مرحلة الاستقلال النهائية.
