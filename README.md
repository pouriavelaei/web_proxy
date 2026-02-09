# 🔥 مثلاً فیلتر نیست (Masalan Filter Nist)

<div dir="rtl">

یک وب‌پراکسی فوق‌سبک و تجربی که با استفاده از **Cloudflare Workers** نوشته شده است. این پروژه با هدف دسترسی سریع به محتوای متنی، مستندات برنامه‌نویسی و وب‌گردی سبک طراحی شده است.

</div>

An ultra-lightweight and experimental web proxy built on **Cloudflare Workers**. Designed for quick access to text-based content, documentation, and light browsing without any client-side installations.

---

## ✨ ویژگی‌ها | Features

<div dir="rtl">

- 🚀 **بدون نیاز به نصب**: کاملاً مبتنی بر مرورگر
- 🛡️ **تمرکز بر حریم خصوصی**: استفاده از موتور جستجوی Mojeek به جای گوگل
- 🧠 **هوشمند**: بازنویسی داینامیک لینک‌ها، فرم‌ها و درخواست‌های AJAX
- 💻 **بهینه‌سازی شده برای برنامه‌نویس‌ها**: دسترسی سریع به MDN، StackOverflow، GitHub و...
- ⚡ **سرعت بالا**: اجرا روی شبکه جهانی Cloudflare
- 🎨 **رابط کاربری فارسی**: طراحی ساده و کاربردی

</div>

- 🚀 **No Installation Required**: Fully browser-based
- 🛡️ **Privacy-Focused**: Uses Mojeek search engine instead of Google
- 🧠 **Smart**: Dynamic rewriting of links, forms, and AJAX requests
- 💻 **Optimized for Developers**: Quick access to MDN, StackOverflow, GitHub, etc.
- ⚡ **High Speed**: Runs on Cloudflare's global network
- 🎨 **Persian UI**: Simple and functional design

---

## ⚠️ محدودیت‌ها (بخوانید!) | Limitations (Read First!)

<div dir="rtl">

این پروژه در مرحله **آلفا** و صرفاً یک **کنجکاوی فنی** (Experimental) است. لطفاً به موارد زیر توجه کنید:

</div>

This project is in **alpha stage** and purely an **experimental** endeavor. Please note the following:

### 🚫 کارهایی که نمی‌تواند انجام دهد | What It Can't Do

<div dir="rtl">

- 🎥 **ویدیو**: در حال حاضر از استریم ویدیو (مانند YouTube، Vimeo) پشتیبانی نمی‌کند
- 🔒 **سایت‌های حساس**: سایت‌هایی با کپچا (CAPTCHA) یا کوکی‌های پیچیده امنیتی ممکن است به درستی کار نکنند
- 🏦 **سایت‌های بانکی**: اصلاً توصیه نمی‌شود - برای امنیت خودتان از VPN استفاده کنید
- 🇮🇷 **جستجوی فارسی**: Mojeek در حال حاضر نتایج فارسی قوی ندارد (نتیجه نمی‌دهد)

</div>

- 🎥 **Video**: Currently doesn't support video streaming (like YouTube, Vimeo)
- 🔒 **Sensitive Sites**: Sites with CAPTCHA or complex security cookies may not work properly
- 🏦 **Banking Sites**: Not recommended at all - use a VPN for your security
- 🇮🇷 **Persian Search**: Mojeek currently doesn't have strong Persian results (returns empty)

### ✅ بهترین کاربرد | Best Use Cases

<div dir="rtl">

- 📚 خواندن مستندات (MDN، DevDocs، W3Schools)
- 💬 دسترسی به فروم‌ها و Q&A ها (StackOverflow، Reddit)
- 📰 خواندن مقالات و بلاگ‌ها
- 🔍 جستجوی سریع اطلاعات
- 📖 مطالعه محتوای متنی

</div>

- 📚 Reading documentation (MDN, DevDocs, W3Schools)
- 💬 Accessing forums and Q&A (StackOverflow, Reddit)
- 📰 Reading articles and blogs
- 🔍 Quick information search
- 📖 Browsing text-based content

---

## 🏗️ معماری | Architecture

<div dir="rtl">

این پروژه از **Cloudflare Workers** استفاده می‌کند که یک پلتفرم Serverless و Edge Computing است:

</div>

This project uses **Cloudflare Workers**, a serverless edge computing platform:

```
User Request → Cloudflare Worker → Target Website
                     ↓
           Dynamic Content Rewriting
                     ↓
              Modified Response → User
```

<div dir="rtl">

**ویژگی‌های فنی:**
- بازنویسی HTML، CSS و JavaScript به صورت داینامیک
- مدیریت هوشمند کوکی‌ها و Session ها
- پشتیبانی از ریدایرکت‌ها و URL های نسبی
- شبیه‌سازی هدرهای مرورگر واقعی
- مدیریت فرم‌ها و POST request ها

</div>

**Technical Features:**
- Dynamic HTML, CSS, and JavaScript rewriting
- Smart cookie and session management
- Support for redirects and relative URLs
- Real browser header simulation
- Form and POST request handling

---

## 🛠️ نصب و راه‌اندازی | Deployment

<div dir="rtl">

### پیش‌نیازها

- حساب [Cloudflare](https://cloudflare.com) (رایگان)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) نصب شده

> **نکته:** این پروژه بدون هیچ dependency خارجی است - فقط یک فایل JavaScript خالص!

### مراحل نصب

1. **کلون کردن پروژه:**
```bash
git clone <repository-url>
cd web_proxy
```

2. **تنظیم Wrangler:**
```bash
npx wrangler login
```

3. **ویرایش تنظیمات** در فایل `wrangler.jsonc` (در صورت نیاز):
```jsonc
{
    "name": "your-proxy-name",
    "main": "worker.js",
    "compatibility_date": "2026-02-08"
}
```

4. **تست در محیط محلی:**
```bash
npx wrangler dev
```

5. **انتشار روی Cloudflare:**
```bash
npx wrangler deploy
```

</div>

### Prerequisites

- [Cloudflare](https://cloudflare.com) account (free)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) installed

> **Note:** This project has zero external dependencies - just pure JavaScript!

### Installation Steps

Follow the Persian instructions above or refer to [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/).

---

## 🤝 مشارکت | Contributing

<div dir="rtl">

این پروژه با **وایب** نوشته شده و قطعاً جای بهبود دارد! اگر:

- ایده‌ای برای حل مشکل **استریم ویدیو** دارید
- می‌خواهید مدیریت **کوکی‌ها** را بهتر کنید
- روشی برای پشتیبانی از **CAPTCHA** پیدا کرده‌اید
- قابلیت جدیدی می‌خواهید اضافه کنید

خوشحال می‌شوم **Pull Request** بفرستید!

</div>

This project was built with a **coding vibe** and exploration in mind. Contributions are more than welcome if you have:

- Ideas for **video streaming** support
- Better **cookie management** solutions
- Ways to handle **CAPTCHA**
- New features to add

Feel free to open an issue or submit a **Pull Request**!

---

## 📊 محدودیت‌های Cloudflare Workers | Cloudflare Workers Limits

<div dir="rtl">

پلن رایگان محدودیت‌های زیر را دارد:

</div>

The free plan has the following limits:

| Metric                                             | Free Tier (2026)     |
| -------------------------------------------------- | -------------------- |
| <div dir="rtl">درخواست‌ها در روز</div> Requests/day | 100,000              |
| <div dir="rtl">حجم CPU</div> CPU Time              | 10ms per invocation  |
| <div dir="rtl">حافظه</div> Memory                  | 128MB                |
| <div dir="rtl">ساب‌دومین‌های رایگان</div> Subdomains | workers.dev (رایگان) |

<div dir="rtl">

برای استفاده شخصی کاملاً کافی است!

</div>

Perfect for personal use!

---

## ❓ سوالات متداول | FAQ

<div dir="rtl">

### چرا Mojeek؟
**جواب:** گوگل به دلیل داشتن کپچای پیچیده (CAPTCHA) از طریق پراکسی قابل استفاده نبود، و Mojeek بهترین عملکرد را بین موتورهای جایگزین داشت - البته فقط برای جستجوهای انگلیسی.

### آیا امن است؟
**جواب:** کد باز است و می‌توانید خودتان بررسی کنید. اما برای کارهای حساس (بانکی، ایمیل شخصی) از VPN استفاده کنید.

### چرا یوتیوب کار نمی‌کند؟
**جواب:** ویدیوهای استریم نیاز به streaming بایناری، range request های پیچیده، و برخی DRM/codec های خاص دارند. همچنین سایت‌هایی مثل یوتیوب از JavaScript Obfuscation پیشرفته استفاده می‌کنند که rewrite کردن آن‌ها بسیار سخت است.

### می‌توانم روی سرور شخصی‌ام نصب کنم؟
**جواب:** این کد مخصوص Cloudflare Workers است، اما می‌توانید آن را برای Node.js یا Deno تطبیق دهید.

</div>

### Why Mojeek?
**Answer:** Google couldn't be used due to its complex CAPTCHA system, and Mojeek had the best performance among alternative search engines - though only for English queries.

### Is it secure?
**Answer:** The code is open-source and you can review it yourself. However, for sensitive tasks (banking, personal email), use a VPN.

### Why doesn't YouTube work?
**Answer:** Video streaming requires binary streaming, complex range requests, and specific DRM/codecs. Additionally, sites like YouTube use advanced JavaScript obfuscation that makes rewriting extremely difficult.

### Can I install it on my personal server?
**Answer:** This code is specifically for Cloudflare Workers, but you can adapt it for Node.js or Deno.

---

## 📜 لایسنس | License

<div dir="rtl">

این پروژه تحت لایسنس **GNU GPL v3** منتشر شده است. برای جزئیات بیشتر فایل [LICENSE](LICENSE) را مطالعه کنید.

**کپی‌رایت:** © 2026 [پوریا ولایی](https://github.com/pouriavelaei) - تمامی حقوق با رعایت شرایط GPL v3 محفوظ است.

</div>

This project is released under the **GNU GPL v3** license. See the [LICENSE](LICENSE) file for details.

**Copyright:** © 2026 [Pouria Velaei](https://github.com/pouriavelaei) - All rights reserved under GPL v3 terms.

---

## �‍💻 توسعه‌دهنده | Developer

<div dir="rtl">

**پوریا ولایی**

- 🐙 **گیتهاب:** [github.com/pouriavelaei](https://github.com/pouriavelaei)
- 📢 **کانال تلگرام:** [PythonFarsi2024](https://t.me/PythonFarsi2024)

</div>

**Pouria Velaei**

- 🐙 **GitHub:** [github.com/pouriavelaei](https://github.com/pouriavelaei)
- 📢 **Telegram Channel:** [PythonFarsi2024](https://t.me/PythonFarsi2024)

---

## �🙏 تشکر | Acknowledgments

<div dir="rtl">

- [Cloudflare Workers](https://workers.cloudflare.com/) - پلتفرم اجرا
- [Mojeek](https://www.mojeek.com/) - موتور جستجوی بی‌طرف
- جامعه توسعه‌دهندگان ایرانی ❤️

</div>

- [Cloudflare Workers](https://workers.cloudflare.com/) - Execution platform
- [Mojeek](https://www.mojeek.com/) - Privacy-focused search engine
- Iranian developer community ❤️

---

<div align="center" dir="rtl">

**ساخته شده با ☕ و کنجکاوی فنی | Made with ☕ and technical curiosity**

© 2026 [Pouria Velaei](https://github.com/pouriavelaei) | Licensed under GNU GPL v3

[![GitHub](https://img.shields.io/badge/GitHub-pouriavelaei-181717?style=flat&logo=github)](https://github.com/pouriavelaei)
[![Telegram](https://img.shields.io/badge/Telegram-PythonFarsi2024-26A5E4?style=flat&logo=telegram)](https://t.me/PythonFarsi2024)

</div>
