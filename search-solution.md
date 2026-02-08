# راه‌حل مشکل CAPTCHA در پروکسی

## چرا موتورهای جستجو CAPTCHA می‌دهند؟

1. **IP دیتاسنتر**: Cloudflare Workers از IP دیتاسنتر استفاده می‌کند
2. **TLS Fingerprint**: سرور Cloudflare fingerprint متفاوتی نسبت به مرورگر دارد
3. **HTTP/2 Fingerprint**: ترتیب و اولویت فریم‌های HTTP/2 متفاوت است
4. **Browser API های ناموجود**: WebGL، Canvas fingerprinting، AudioContext

## راه‌حل‌های ممکن:

### گزینه ۱: استفاده از API های عمومی (پیشنهادی)
```javascript
// به جای باز کردن موتور جستجو، از API استفاده کنید:

// Wikipedia API
https://en.wikipedia.org/w/api.php?action=opensearch&search=query

// Wikidata
https://www.wikidata.org/w/api.php

// Archive.org
https://archive.org/advancedsearch.php?q=query&output=json
```

### گزینه ۲: Residential Proxy Pool
- استفاده از proxy های residential (هزینه‌ بردار)
- سرویس‌هایی مثل BrightData، Smartproxy

### گزینه ۳: Browser Extension (بهترین راه‌حل)
- یک extension برای Chrome/Firefox بسازید
- درخواست‌ها از مرورگر کاربر می‌روند
- هیچ CAPTCHA نمی‌خورید

### گزینه ۴: Self-hosted با IP خانگی
- یک VPS با IP residential
- یا روی سیستم خودتان با cloudflared tunnel

## سایت‌هایی که با پروکسی کار می‌کنند:

✅ Wikipedia
✅ Archive.org  
✅ StackOverflow
✅ GitHub
✅ Reddit (بدون login)
✅ Medium
✅ HackerNews

❌ Google
❌ DuckDuckGo
❌ Bing
❌ Brave Search
❌ اکثر موتورهای جستجوی اصلی
