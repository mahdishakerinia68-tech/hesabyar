# Build verification — pro1.11

## اجرا و پاس‌شده در محیط ساخت
- `npm run validate` (syntax + security-check) ✔
- `npm test` (واحد + ایستا + `tests/repeat.test.mjs` + `tests/v4.test.mjs`) ✔
- بررسی دستی در Chromium headless: گزینه‌ی «سالانه» در فرم یادآوری و یادداشت، ذخیره، تاریخ بعدی (سال بعد)، برچسب‌ها در صفحه‌ی یادآوری‌ها، جدول هفتگی و رخدادهای تقویم مالی — بدون خطای JavaScript ✔

## اجرا نشده
- `npm run test:browser` و `npm run test:v4` (Playwright برای Node در این محیط نصب نبود)
- تست روی گوشی واقعی (Android/iOS) و Safari
- همگام‌سازی Firebase (داده‌ی V4 هنوز sync نمی‌شود)
- Capacitor/APK (اعلان بومی سالانه فقط در کد اضافه شده، روی دستگاه تست نشده)
