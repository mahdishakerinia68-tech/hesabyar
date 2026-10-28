# Build verification — pro1.12

## اجرا و پاس‌شده در محیط ساخت
- `npm run validate` (syntax + security-check) ✔
- `npm test` (واحد + ایستا + repeat + v4 + `tests/sync.test.mjs` + smoke) ✔
- `tests/sync.test.mjs`: دو «گوشی» (vm جدا) با Worker واقعی و KV شبیه‌سازی‌شده — اتصال با کد، کد اشتباه، رمز همگام‌سازی اشتباه، دوطرفه، تداخل هم‌زمان (409)، حذف، آفلاین، بازیابی از فایل (epoch)، قطع دسترسی گوشی، رمزنگاری بودن داده روی سرور ✔

## اجرا نشده
- `npm run test:browser` و `npm run test:v4` (Playwright نصب نبود)
- تست روی گوشی واقعی و اتصال به ربات/Cloudflare واقعی (نیاز به نصب سرور توسط مالک)
- همگام‌سازی داده‌ی V4 (هنوز sync نمی‌شود)
