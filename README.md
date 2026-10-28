# 📒 حساب‌یار V4 — نسخه جامع مالی

حساب‌یار یک اپ حسابداری فارسی، RTL و قابل نصب به‌صورت PWA است و برای بسته‌بندی Android با Capacitor آماده شده است.

## وضعیت انتشار

- Release: `pro1.12` (schema 5)
- Package version: `1.0.0-pro1.12`
- Storage اصلی: IndexedDB با ذخیره اتمیک snapshot
- Cloud sync: اختیاری، با ربات تلگرام + Cloudflare Worker (پوشه‌ی `server/`)
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

## همگام‌سازی (ربات تلگرام + Cloudflare Worker)

سرور در `server/worker.js` است و راهنمای نصب در `server/README-fa.md`. هیچ توکن یا کلیدی داخل repository نیست؛ توکن ربات فقط در Secretهای Cloudflare می‌ماند و آدرس سرور و رمز همگام‌سازی از داخل برنامه وارد می‌شود.

هر گوشی با کد ۶ رقمی یک‌بارمصرفِ ربات وصل می‌شود، رکوردها روی گوشی رمزنگاری می‌شوند و سرور فقط متن رمزشده نگه می‌دارد. پنل مدیریت (تایید/مسدود کردن کاربر، قطع گوشی) روی `/admin` همان Worker است.

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

قفل حالت فروشگاه صرفاً محدودکننده UI/رفتار سمت کلاینت است و نباید به‌عنوان مرز امنیتی سرور در نظر گرفته شود.

## PWA و Offline

Service Worker نسخه `pro2` را cache می‌کند، shell برنامه را برای حالت offline نگه می‌دارد و فایل‌های اصلی را network-first به‌روزرسانی می‌کند. درخواست‌های خارجی وارد cache محلی نمی‌شوند.

## Android APK

Workflow زیر را اجرا می‌کند:

1. `npm ci`
2. `npm run validate`
3. `npm test`
4. Java 17
5. ایجاد Android project در صورت نبودن آن
6. `npx cap sync android`
7. `./gradlew assembleDebug`
8. آپلود artifact با نام `HesabYar-pro2-APK`

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

## V4 — نصب و آموزش سریع

1. اجرای محلی: `python3 -m http.server 8080` و باز کردن `http://localhost:8080` (PWA نیاز به HTTP دارد).
2. انتشار: همه‌ی فایل‌ها را روی هر هاست استاتیک (GitHub Pages، Netlify و ...) بگذارید.
3. به‌روزرسانی از نسخه‌ی قبل: فایل‌ها را جایگزین کنید و برنامه را باز کنید. اطلاعات قبلی حفظ می‌شود؛ پیش از ارتقای ساختار، «نسخه‌ی ایمنی» ساخته می‌شود (منو ← امکانات جامع مالی ← پشتیبان‌گیری و بازیابی).
4. تست: `npm run validate && npm test && npm run test:v4` (برای `test:v4` و `test:browser` باید `npm i -D playwright && npx playwright install chromium`).

### ساختار فایل‌های V4
- `src/v4/v4-core.js` — اعتبارسنجی، فیلتر، محاسبات مالی، ساخت xlsx، migration.
- `src/v4/v4-sections.js` — بودجه، اهداف، پس‌انداز، دارایی، هم‌خرج، تقویم، فیلتر چک‌ها.
- `src/v4/v4-backup.js` — Backup/Restore انتخابی و نسخه‌های ایمنی.
- `src/v4/v4-security.js` — سلامت داده و قفل خودکار.
- `src/v4/v4-ui.js` — اتصال به منو، داشبورد، تنظیمات و `render()`.
- `src/v4/v4.css` — استایل. `tests/v4*.{mjs}` — تست‌ها.

همگام‌سازی: داده‌ی V4 (بودجه، اهداف و ...) هنوز sync نمی‌شود.
