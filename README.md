# حساب‌یار / HesabYar

**نسخه فعلی: 1.2.5**

این نسخه با تمرکز بر **Web / PWA / مرورگر موبایل / GitHub Pages** نگهداری می‌شود. ساخت APK، Android و iOS در محدوده نسخه وب فعلی نیست.

## اجرای محلی

برای اجرای صحیح Service Worker از localhost استفاده کنید:

```bash
npx serve .
```

یا:

```bash
python3 -m http.server 8080
```

سپس آدرس localhost را در مرورگر باز کنید. Service Worker در محیط امن HTTPS یا localhost فعال می‌شود.

## GitHub Pages

پروژه را به عنوان یک سایت استاتیک منتشر کنید. GitHub Pages باید با HTTPS ارائه شود تا قابلیت‌های PWA و Service Worker فعال باشند.

## داده و localStorage

داده‌های اصلی برنامه در localStorage نگهداری می‌شوند و نسخه‌های قدیمی باید با همان ساختار سازگار باقی بمانند. پرشدن فضای ذخیره‌سازی مرورگر ممکن است باعث خطای ذخیره شود؛ در این حالت ابتدا از داده‌ها بکاپ بگیرید.

## هوش مصنوعی و API Key

در نسخه frontend، کلید API روی همان دستگاه در localStorage ذخیره می‌شود. این روش **محرمانگی کامل کلید را تضمین نمی‌کند**، چون کد frontend و فضای ذخیره‌سازی در اختیار مرورگر کاربر است. برای امنیت واقعی، درخواست API باید از یک backend یا Cloud Function عبور کند. URL سفارشی API فقط با HTTPS پذیرفته می‌شود.

## اعتبارسنجی

```bash
npm run validate
```

این دستور syntax فایل اصلی، Service Worker و bridgeهای موجود را بررسی می‌کند.
