# 📒 حساب‌یار — pro1.1

حساب‌یار یک اپ حسابداری فارسی، RTL و قابل نصب به‌صورت PWA است و برای بسته‌بندی Android با Capacitor آماده شده است.

## وضعیت انتشار

- Release: `pro1.1`
- Package version: `2.0.1-pro1.1`
- Storage اصلی: IndexedDB با ذخیره اتمیک snapshot
- Cloud sync: اختیاری، با Firebase Authentication + Firestore Rules
- Android: Capacitor 7 + Java 17 در CI
- Artifactهای build در repository نگهداری نمی‌شوند.

## اجرای محلی

```bash
npm ci
npm run validate
npm test
npm run test:browser
```

برای تست PWA باید با HTTP سرو شود، نه `file://`:

```bash
python3 -m http.server 8080
```

سپس `http://localhost:8080` را باز کنید.

## تست مرورگر

Playwright در `devDependencies` قرار دارد. در محیط CI، Chromium نیز نصب می‌شود.

```bash
npx playwright install --with-deps chromium
npm run test:browser
```

## Firebase / همگام‌سازی

تنظیمات Firebase در repository به‌صورت credential یا API secret نگهداری نمی‌شوند. کاربر تنظیمات Web App را از داخل برنامه وارد می‌کند و اطلاعات در storage محلی تنظیمات نگهداری می‌شود.

قوانین Firestore فقط اجازه دسترسی کاربر به `users/{uid}` و زیرمجموعه‌های خودش را می‌دهند و payload رکوردها از نظر نام فیلد، نوع داده و اندازه محدود شده است.

## Storage و Backup

- IndexedDB مرجع اصلی داده است.
- localStorage فقط برای تنظیمات کوچک و fallback زمانی استفاده می‌شود که IndexedDB در دسترس نباشد.
- ذخیره snapshot در یک transaction واحد انجام می‌شود.
- در خطای quota، snapshot قبلی حذف نمی‌شود.
- backup رمزنگاری‌شده و restore با اعتبارسنجی انجام می‌شود.

## حالت‌های برنامه

- `personal`: امکانات شخصی
- `business`: امکانات کامل کسب‌وکاری
- `store`: حالت فروشگاه/کیوسک محدود با رمز مدیر جداگانه

قفل حالت فروشگاه صرفاً محدودکننده UI/رفتار سمت کلاینت است و نباید به‌عنوان مرز امنیتی سرور یا کنترل دسترسی Firestore در نظر گرفته شود.

## PWA و Offline

Service Worker نسخه `pro1.1` را cache می‌کند، shell برنامه را برای حالت offline نگه می‌دارد و فایل‌های اصلی را network-first به‌روزرسانی می‌کند. درخواست‌های خارجی وارد cache محلی نمی‌شوند.

## Android APK

Workflow زیر را اجرا می‌کند:

1. `npm ci`
2. `npm run validate`
3. `npm test`
4. Java 17
5. ایجاد Android project در صورت نبودن آن
6. `npx cap sync android`
7. `./gradlew assembleDebug`
8. آپلود artifact با نام `HesabYar-pro1.1-APK`

Workflow: `.github/workflows/android.yml`

برای release امضاشده، keystore باید فقط از GitHub Secrets/secure CI storage تأمین شود و هرگز داخل repository قرار نگیرد.

## امنیت release

این فایل‌ها نباید commit شوند:

```text
*.bak
*.zip
*.apk
*.aab
*.keystore
*.jks
.env
.env.*
```

اسکریپت `scripts/security-check.mjs` وجود artifactهای ممنوع و الگوهای secret/credential را بررسی می‌کند.

## CSP و XSS

CSP به حالت enforce تغییر داده شده است. به‌دلیل اینکه UI فعلی هنوز تعدادی inline event handler دارد، `script-src 'unsafe-inline'` فعلاً نگه داشته شده و باید در refactor بعدی به event delegation / addEventListener منتقل شود تا کاملاً حذف شود.

ورودی‌های user-facing هنگام تولید HTML با `esc()` escape می‌شوند و تست XSS برای payloadهای `<img>`, `<script>` و کاراکترهای ویژه وجود دارد.

## انتشار

قبل از release:

```bash
npm ci
npm run validate
npm test
npm run test:browser
```

سپس tag نسخه را ایجاد کنید و GitHub Actions را اجرا کنید. APK/ZIP را داخل repository commit نکنید؛ artifactهای CI یا Release assets محل مناسب انتشار هستند.
