# راه‌اندازی سرور همگام‌سازی حساب‌یار روی Cloudflare

## ۱. ساخت Worker
1. وارد dash.cloudflare.com شو → **Workers & Pages** → **Create** → **Create Worker**.
2. اسم بده: `hesabyar-sync` → **Deploy**.
3. **Edit code** را بزن، همه کد پیش‌فرض را پاک کن و محتوای فایل `worker.js` را بچسبان → **Deploy**.

## ۲. ساخت دیتابیس (KV)
1. منوی چپ: **Storage & Databases** → **KV** → **Create** → نام: `HESABYAR_DB`.
2. برگرد به Worker → **Settings** → **Bindings** → **Add** → **KV namespace**.
3. Variable name را دقیقاً `DB` بگذار و `HESABYAR_DB` را انتخاب کن → Save.

## ۳. تنظیم متغیرها
Worker → **Settings** → **Variables and Secrets** → Add:

| نام | نوع | مقدار |
|---|---|---|
| `BOT_TOKEN` | Secret | توکنی که BotFather داد |
| `ADMIN_KEY` | Secret | یک رمز طولانی و دلخواه برای ورود به پنل (حداقل ۱۶ کاراکتر) |
| `WEBHOOK_SECRET` | Secret | یک متن تصادفی فقط با حروف انگلیسی، عدد، `_` و `-` (مثلاً ۳۰ کاراکتر) |
| `ADMIN_ID` | Text | ایدی عددی تلگرام خودت |
| `ALLOWED_ORIGIN` | Text | `https://mahdishakerinia68-tech.github.io` |
| `MAX_DEVICES` | Text (اختیاری) | `5` |

بعد از ذخیره، Deploy را دوباره بزن.

## ۴. اتصال ربات
1. آدرس Worker را باز کن: `https://hesabyar-sync.<اسم-حساب-تو>.workers.dev/admin`
2. `ADMIN_KEY` را وارد کن.
3. دکمه **اتصال ربات (Webhook)** را بزن. باید بنویسد «ربات وصل شد».

## ۵. تست
1. توی تلگرام به ربات `/start` بزن. (چون ایدی تو ADMIN_ID است، خودکار تایید می‌شود.)
2. یک کد ۶ رقمی می‌دهد.
3. کاربر دیگری که `/start` بزند، توی تلگرام خودت پیام تایید/رد می‌گیری (و توی پنل هم می‌بینی).

## محدودیت‌های پلن رایگان
- حداکثر ۱۰۰٬۰۰۰ خواندن و ۱٬۰۰۰ نوشتن KV در روز؛ برای چند کاربر معمولی کافی است.
- KV ممکن است تا حدود یک دقیقه برای دیدن آخرین تغییر تاخیر داشته باشد؛ ادغام بر اساس شناسه رکورد این را پوشش می‌دهد.
