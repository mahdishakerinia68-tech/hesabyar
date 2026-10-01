# Firestore Rules

قوانین نهایی در `firestore.rules` قرار دارند و همه خواندن/نوشتن‌ها را به `request.auth.uid == userId` محدود می‌کنند.
قبل از انتشار باید Rules را در پروژه Firebase deploy و با حساب واقعی/آزمایشی تست کرد.
