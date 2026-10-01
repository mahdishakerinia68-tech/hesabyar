# Capacitor

Capacitor خارج از محدوده‌ی نسخه‌ی Web/PWA است و dependencyهای آن در `package.json` نیستند. فایل‌های `capacitor-*-bridge.js` و `capacitor.config.ts` فقط برای سازگاری کد باقی مانده‌اند؛ روی وب بدون Capacitor هیچ کاری نمی‌کنند.

اگر در آینده انتشار native لازم شد:

```bash
npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/filesystem @capacitor/local-notifications
npx cap add android && npx cap sync android
```

سپس یک workflow جداگانه برای Gradle اضافه و روی دستگاه واقعی تست کنید. رفتار نسخه‌ی Web/PWA نباید تغییر کند.
