# حسابدار 4.2.0 — Android + iOS

این پوشه برای تبدیل نسخه وب به اپ با Capacitor آماده شده است.

## نصب وابستگی‌ها
```bash
npm install
npx cap add android
npx cap add ios
npx cap sync
```

## اندروید
```bash
npx cap open android
```
سپس در Android Studio خروجی APK یا AAB بگیر.

## آیفون
روی Mac:
```bash
npx cap open ios
```
سپس پروژه را با Xcode برای iPhone/ App Store Archive کن.

## اعلان‌ها
پکیج‌های Local Notifications و Push Notifications اضافه شده‌اند. برای اعلان زمان‌دار کاملاً Native باید منطق زمان‌بندی Native را به نسخه نهایی متصل کنی.

## بروزرسانی GitHub
داخل تنظیمات برنامه، مخزن را به شکل `username/repository` وارد کن. برنامه از GitHub Releases آخرین نسخه را می‌خواند و اگر شماره نسخه جدیدتر باشد هشدار می‌دهد.
