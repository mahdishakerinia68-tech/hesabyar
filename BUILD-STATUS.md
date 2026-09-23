# Build verification — pro1.2

## اجرا و پاس‌شده در محیط ساخت
- `npm run validate` (syntax همه‌ی فایل‌ها + security-check)
- `npm test` (تست‌های واحد، بررسی یکسان بودن نسخه، بررسی ایستای PWA)
- `npm run test:browser`: ۱۷ از ۱۷ سناریو در Chromium headless با Playwright
- بررسی TypeScript-checker روی `app.js`: هیچ نام تعریف‌نشده‌ای جز globalهای عمدی (`firebase`، `HesabYarStorage`) نیست
- تمام handlerهای inline در HTML/رشته‌های `app.js` به توابع تعریف‌شده اشاره می‌کنند
- اسکرین‌شات حالت روشن/تاریک برای خانه، تنظیمات و فاکتور بررسی شد

## اجرا نشده
- تست روی دستگاه واقعی (Chrome Android، Safari iOS)
- همگام‌سازی زنده‌ی Firebase با دو دستگاه (در محیط ساخت اینترنت نبود)
- deploy و تست `firestore.rules` روی پروژه‌ی واقعی
- Capacitor/APK (خارج از محدوده)
- فونت وزیرمتن (Google Fonts) در محیط ساخت بارگذاری نشد؛ رفتار fallback با فونت سیستم دیده شد
