# حسابدار A2 — Android + iOS

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
پکیج‌های Local Notifications و Push Notifications اضافه شده‌اند. منطق یادآوری زمان‌دار از Local Notifications رسمی Capacitor استفاده می‌کند. در Android/iOS native، اعلان‌ها در سطح سیستم زمان‌بندی می‌شوند و به اجرای دائمی برنامه در پس‌زمینه وابسته نیستند. در Android 12+ ممکن است اجازه Exact Alarm توسط سیستم درخواست شود. در مرورگر/PWA محدودیت سیستم‌عامل اجازه تضمین اعلان پس از بسته‌شدن کامل برنامه را نمی‌دهد.

## بروزرسانی GitHub
داخل تنظیمات برنامه، مخزن را به شکل `username/repository` وارد کن. برنامه از GitHub Releases آخرین نسخه را می‌خواند و اگر شماره نسخه جدیدتر باشد هشدار می‌دهد.
