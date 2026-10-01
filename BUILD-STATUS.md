# Build verification — pro1.9

## اجرا و پاس‌شده در محیط ساخت
- `npm run validate` (syntax + security-check) ✔
- `npm test` (واحد + ایستا + `tests/v4.test.mjs`) ✔
- `npm run test:browser`: ۱۹ از ۱۹ (Chromium headless) ✔ — شامل فرایند Restore قدیمی
- `npm run test:v4`: ۲۲ از ۲۲ سناریوی مرورگری (۲۰ مورد چک‌لیست + مایگریشن + ماندگاری) بدون خطای JavaScript ✔

## اجرا نشده
- تست روی گوشی واقعی (Android/iOS) و Safari
- همگام‌سازی Firebase (داده‌ی V4 هنوز sync نمی‌شود)
- Capacitor/APK
