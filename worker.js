export default {
  async fetch(request) {
    const url = new URL(request.url);
    const proxyOrigin = url.origin;
    
    // صفحه اصلی - فرم ورود URL
    if (url.pathname === "/" && !url.searchParams.has("url")) {
      return new Response(getHomePage(), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    
    // دریافت URL مقصد
    let targetUrl;
    if (url.searchParams.has("url")) {
      targetUrl = url.searchParams.get("url").trim();
    } else {
      // مسیر به صورت /https://example.com/path
      const pathUrl = decodeURIComponent(url.pathname.slice(1)) + url.search;
      if (pathUrl.startsWith("http://") || pathUrl.startsWith("https://")) {
        targetUrl = pathUrl;
      } else if (pathUrl.length > 0 && pathUrl.includes(".")) {
        targetUrl = "https://" + pathUrl;
      } else {
        return new Response(getHomePage(), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
    }
    
    // اضافه کردن پروتکل اگر کاربر ننوشته
    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      targetUrl = "https://" + targetUrl;
    }
    
    try {
      const target = new URL(targetUrl);
      
      // لیست User-Agent های جدید و واقعی (2025-2026)
      const userAgents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0"
      ];
      
      // ساخت هدرهای واقعی‌تر
      const headers = new Headers();
      
      // استفاده از User-Agent کاربر یا انتخاب تصادفی
      const clientUA = request.headers.get("User-Agent");
      const userAgent = clientUA && clientUA.includes("Mozilla") ? clientUA : userAgents[Math.floor(Math.random() * userAgents.length)];
      const isFirefox = userAgent.includes("Firefox");
      const isSafari = userAgent.includes("Safari") && !userAgent.includes("Chrome");
      
      // هدرهای اصلی - بدون DNT که سیگنال مشکوک است
      headers.set("User-Agent", userAgent);
      headers.set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7");
      headers.set("Accept-Language", "en-US,en;q=0.9");
      headers.set("Accept-Encoding", "gzip, deflate, br, zstd");
      headers.set("Upgrade-Insecure-Requests", "1");
      headers.set("Cache-Control", "max-age=0");
      
      // مدیریت Referer هوشمند
      const originalReferer = request.headers.get("Referer");
      if (originalReferer && originalReferer.includes(proxyOrigin)) {
        // استخراج URL واقعی از referer پروکسی
        const refMatch = originalReferer.match(/https?:\/\/[^/]+\/+(https?:\/\/.+)/);
        if (refMatch) {
          headers.set("Referer", refMatch[1]);
        } else {
          headers.set("Referer", target.origin + "/");
        }
      } else {
        headers.set("Referer", target.origin + "/");
      }
      
      // Origin فقط برای POST/PUT نیاز است
      if (request.method === "POST" || request.method === "PUT") {
        headers.set("Origin", target.origin);
      }
      
      // هدرهای مخصوص Chrome - نسخه‌های جدید
      if (!isFirefox && !isSafari) {
        headers.set("Sec-Ch-Ua", '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"');
        headers.set("Sec-Ch-Ua-Mobile", "?0");
        headers.set("Sec-Ch-Ua-Platform", '"Windows"');
      }
      
      // Sec-Fetch headers - تنظیم هوشمند بر اساس نوع درخواست
      headers.set("Sec-Fetch-Dest", "document");
      headers.set("Sec-Fetch-Mode", "navigate");
      
      // برای POST (مثل فرم جستجو) باید same-origin باشد
      if (request.method === "POST") {
        headers.set("Sec-Fetch-Site", "same-origin");
        headers.set("Sec-Fetch-User", "?1");
      } else {
        // بررسی اگر از پروکسی آمده
        const originalReferer = request.headers.get("Referer");
        if (originalReferer && originalReferer.includes(proxyOrigin)) {
          // استخراج target از referer پروکسی و چک same-origin
          const refMatch = originalReferer.match(/https?:\/\/[^/]+\/+(https?:\/\/([^/]+))/);
          if (refMatch && refMatch[2] === target.host) {
            headers.set("Sec-Fetch-Site", "same-origin");
          } else {
            headers.set("Sec-Fetch-Site", "same-site");
          }
          headers.set("Sec-Fetch-User", "?1");
        } else {
          headers.set("Sec-Fetch-Site", "none");
          headers.set("Sec-Fetch-User", "?1");
        }
      }
      
      // فوروارد کوکی‌های درخواست
      const cookies = request.headers.get("Cookie");
      if (cookies) {
        headers.set("Cookie", cookies);
      }
      
      // فوروارد Content-Type برای POST
      if (request.method === "POST" || request.method === "PUT") {
        const contentType = request.headers.get("Content-Type");
        if (contentType) {
          headers.set("Content-Type", contentType);
        }
      }
      
      // بدون تاخیر - تاخیر مصنوعی باعث timeout و مشکلات دیگر می‌شود
      
      // درخواست به سایت مقصد
      const response = await fetch(target.toString(), {
        method: request.method,
        headers: headers,
        body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
        redirect: "manual",
      });
      
      // مدیریت ریدایرکت
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("Location");
        if (location) {
          const absoluteLocation = new URL(location, target).toString();
          const newHeaders = new Headers(response.headers);
          newHeaders.set("Location", `${proxyOrigin}/${absoluteLocation}`);
          return new Response(null, {
            status: response.status,
            headers: newHeaders,
          });
        }
      }
      
      const contentType = response.headers.get("Content-Type") || "";
      
      // بازنویسی HTML
      if (contentType.includes("text/html")) {
        let html = await response.text();
        html = rewriteHtml(html, proxyOrigin, target);
        
        const newHeaders = new Headers(response.headers);
        newHeaders.delete("content-encoding");
        newHeaders.delete("content-length");
        newHeaders.delete("content-security-policy");
        newHeaders.delete("content-security-policy-report-only");
        newHeaders.delete("x-frame-options");
        newHeaders.delete("strict-transport-security");
        newHeaders.set("Access-Control-Allow-Origin", "*");
        newHeaders.set("Access-Control-Allow-Credentials", "true");
        
        // مدیریت بهتر کوکی‌ها
        const setCookies = [];
        response.headers.forEach((value, key) => {
          if (key.toLowerCase() === 'set-cookie') {
            setCookies.push(value);
          }
        });
        
        if (setCookies.length > 0) {
          newHeaders.delete('set-cookie');
          setCookies.forEach(cookie => {
            let modifiedCookie = cookie
              .replace(/;\s*domain=[^;]*/gi, '')
              .replace(/;\s*secure\s*(?=;|$)/gi, '')
              .replace(/;\s*samesite=strict/gi, '; SameSite=None')
              .replace(/;\s*samesite=lax/gi, '; SameSite=None');
            
            if (!modifiedCookie.toLowerCase().includes('samesite=')) {
              modifiedCookie += '; SameSite=None';
            }
            
            newHeaders.append('Set-Cookie', modifiedCookie);
          });
        }
        
        return new Response(html, {
          status: response.status,
          headers: newHeaders,
        });
      }
      
      // بازنویسی CSS
      if (contentType.includes("text/css")) {
        let css = await response.text();
        css = rewriteCss(css, proxyOrigin, target);
        
        const newHeaders = new Headers(response.headers);
        newHeaders.delete("content-encoding");
        newHeaders.delete("content-length");
        newHeaders.set("Access-Control-Allow-Origin", "*");
        
        return new Response(css, {
          status: response.status,
          headers: newHeaders,
        });
      }
      
      // بازنویسی JavaScript
      if (contentType.includes("application/javascript") || contentType.includes("text/javascript")) {
        let js = await response.text();
        js = rewriteJs(js, proxyOrigin, target);
        
        const newHeaders = new Headers(response.headers);
        newHeaders.delete("content-encoding");
        newHeaders.delete("content-length");
        newHeaders.set("Access-Control-Allow-Origin", "*");
        
        return new Response(js, {
          status: response.status,
          headers: newHeaders,
        });
      }
      
      // سایر محتواها بدون تغییر
      const newHeaders = new Headers(response.headers);
      newHeaders.set("Access-Control-Allow-Origin", "*");
      newHeaders.delete("content-security-policy");
      newHeaders.delete("content-security-policy-report-only");
      
      return new Response(response.body, {
        status: response.status,
        headers: newHeaders,
      });
      
    } catch (error) {
      return new Response(getErrorPage(error.message), {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
  },
};

function getHomePage() {
  return `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>وب پراکسی آزاد</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    @keyframes gradient {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    
    @keyframes glow {
      0%, 100% { box-shadow: 0 0 20px rgba(220, 38, 38, 0.3); }
      50% { box-shadow: 0 0 40px rgba(220, 38, 38, 0.5); }
    }
    
    body {
      font-family: 'Vazirmatn', Tahoma, Arial, sans-serif;
      background: linear-gradient(-45deg, #0a0a0a, #1a0a0a, #150505, #0d0d0d);
      background-size: 400% 400%;
      animation: gradient 15s ease infinite;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      overflow: hidden;
      position: relative;
    }
    
    body::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: 
        radial-gradient(circle at 20% 80%, rgba(220, 38, 38, 0.08) 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(185, 28, 28, 0.08) 0%, transparent 50%),
        url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23dc2626' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
    }
    
    .container {
      background: rgba(20, 20, 20, 0.8);
      backdrop-filter: blur(20px);
      border-radius: 30px;
      padding: 50px 40px;
      max-width: 550px;
      width: 92%;
      text-align: center;
      box-shadow: 0 25px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);
      border: 1px solid rgba(220, 38, 38, 0.2);
      position: relative;
      z-index: 1;
      animation: glow 4s ease-in-out infinite;
    }
    
    .logo {
      font-size: 4em;
      margin-bottom: 15px;
      animation: float 3s ease-in-out infinite;
      display: inline-block;
      filter: drop-shadow(0 0 20px rgba(220, 38, 38, 0.5));
    }
    
    h1 {
      font-size: 2.2em;
      font-weight: 900;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      text-shadow: 0 0 40px rgba(220, 38, 38, 0.3);
    }
    
    .subtitle {
      color: rgba(255,255,255,0.5);
      margin-bottom: 35px;
      font-size: 15px;
    }
    
    .input-wrapper {
      position: relative;
      margin-bottom: 15px;
    }
    
    .input-wrapper::before {
      content: '🔗';
      position: absolute;
      left: 18px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 18px;
      z-index: 2;
    }
    
    input[type="text"] {
      width: 100%;
      padding: 18px 20px 18px 50px;
      border: 2px solid rgba(220, 38, 38, 0.3);
      border-radius: 15px;
      font-size: 16px;
      font-family: inherit;
      background: rgba(0, 0, 0, 0.4);
      color: #fff;
      direction: ltr;
      text-align: left;
      transition: all 0.3s ease;
    }
    
    input[type="text"]::placeholder {
      color: rgba(255,255,255,0.3);
    }
    
    input[type="text"]:focus {
      outline: none;
      border-color: #dc2626;
      background: rgba(0, 0, 0, 0.6);
      box-shadow: 0 0 30px rgba(220, 38, 38, 0.3);
    }
    
    button {
      width: 100%;
      padding: 18px 30px;
      border: none;
      border-radius: 15px;
      background: linear-gradient(135deg, #dc2626 0%, #b91c1c 50%, #991b1b 100%);
      color: #fff;
      font-size: 17px;
      font-weight: 700;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(220, 38, 38, 0.3);
    }
    
    button::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
      transition: 0.5s;
    }
    
    button:hover {
      transform: translateY(-3px);
      box-shadow: 0 15px 40px rgba(220, 38, 38, 0.5);
    }
    
    button:hover::before {
      left: 100%;
    }
    
    button:active {
      transform: translateY(-1px);
    }
    
    .hint {
      font-size: 12px;
      color: rgba(255,255,255,0.35);
      margin-top: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
    }
    
    .hint span {
      background: rgba(220, 38, 38, 0.2);
      padding: 3px 8px;
      border-radius: 5px;
      font-family: monospace;
      direction: ltr;
      color: #ef4444;
    }
    
    .divider {
      display: flex;
      align-items: center;
      margin: 30px 0;
      color: rgba(255,255,255,0.25);
      font-size: 13px;
    }
    
    .divider::before, .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(220, 38, 38, 0.3), transparent);
    }
    
    .divider span {
      padding: 0 15px;
    }
    
    .quick-links {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 10px;
    }
    
    .quick-links a {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 18px;
      background: rgba(220, 38, 38, 0.1);
      border: 1px solid rgba(220, 38, 38, 0.2);
      border-radius: 25px;
      color: #fff;
      text-decoration: none;
      font-size: 14px;
      transition: all 0.3s ease;
    }
    
    .quick-links a:hover {
      background: rgba(220, 38, 38, 0.25);
      border-color: rgba(220, 38, 38, 0.4);
      transform: translateY(-2px);
      box-shadow: 0 5px 20px rgba(220, 38, 38, 0.2);
    }
    
    .quick-links img {
      width: 20px;
      height: 20px;
      border-radius: 4px;
    }
    
    .footer {
      margin-top: 35px;
      padding-top: 20px;
      border-top: 1px solid rgba(220, 38, 38, 0.15);
      font-size: 12px;
      color: rgba(255,255,255,0.25);
    }
    
    .footer a {
      color: #ef4444;
      text-decoration: none;
    }
    
    .status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #22c55e;
      margin-top: 10px;
    }
    
    .status-dot {
      width: 8px;
      height: 8px;
      background: #22c55e;
      border-radius: 50%;
      animation: pulse 2s infinite;
      box-shadow: 0 0 10px rgba(34, 197, 94, 0.5);
    }
    
    .warning {
      margin-top: 12px;
      font-size: 11px;
      color: rgba(255, 200, 100, 0.7);
      padding: 8px 15px;
      background: rgba(255, 200, 100, 0.1);
      border-radius: 8px;
      border: 1px solid rgba(255, 200, 100, 0.15);
    }
    
    .info-box {
      margin-top: 15px;
      padding: 12px 15px;
      background: rgba(59, 130, 246, 0.1);
      border-radius: 10px;
      border: 1px solid rgba(59, 130, 246, 0.2);
      font-size: 12px;
      color: rgba(147, 197, 253, 0.9);
      text-align: right;
    }
    
    .info-box strong {
      color: #60a5fa;
      display: block;
      margin-bottom: 5px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">🔥</div>
    <h1>وب پراکسی آزاد</h1>
    <p class="subtitle">به هر سایتی دسترسی داشته باشید - سریع و امن</p>
    
    <form action="/" method="GET" id="proxyForm">
      <div class="input-wrapper">
        <input type="text" name="url" id="urlInput" placeholder="example.com یا https://site.com" autocomplete="off" autofocus>
      </div>
      <button type="submit">🚀 باز کردن سایت</button>
      <div class="hint">نیازی به نوشتن <span>https://</span> نیست</div>
    </form>
    
    <div class="divider"><span>موتورهای جستجو (نسخه HTML ساده)</span></div>
    
    <div class="quick-links">
      <a href="/?url=html.duckduckgo.com/html">
        <img src="https://duckduckgo.com/favicon.ico" alt="">DuckDuckGo HTML
      </a>
      <a href="/?url=lite.duckduckgo.com/lite">
        <img src="https://duckduckgo.com/favicon.ico" alt="">DuckDuckGo Lite
      </a>
      <a href="/?url=www.qwant.com">
        <img src="https://www.qwant.com/favicon.ico" alt="">Qwant
      </a>
      <a href="/?url=wiby.me">
        <img src="https://wiby.me/favicon.ico" alt="">Wiby
      </a>
      <a href="/?url=www.mojeek.com">
        <img src="https://www.mojeek.com/favicon.ico" alt="">Mojeek
      </a>
    </div>
    
    <div class="divider"><span>سایت‌های محبوب</span></div>
    
    <div class="quick-links">
      <a href="/?url=wikipedia.org">
        <img src="https://www.wikipedia.org/favicon.ico" alt="">Wikipedia
      </a>
      <a href="/?url=archive.org">
        <img src="https://archive.org/favicon.ico" alt="">Archive.org
      </a>
      <a href="/?url=github.com">
        <img src="https://github.com/favicon.ico" alt="">GitHub
      </a>
      <a href="/?url=stackoverflow.com">
        <img src="https://stackoverflow.com/favicon.ico" alt="">StackOverflow
      </a>
    </div>
    
    <div class="footer">
      <div class="status">
        <span class="status-dot"></span>
        سرور فعال است
      </div>
      <div class="warning">
        ⚠️ نسخه‌های HTML/Lite موتورها بهتر کار می‌کنند - از DuckDuckGo HTML یا Lite استفاده کنید
      </div>
      <div class="info-box">
        <strong>💡 نکته:</strong>
        این پروکسی برای دسترسی آزاد به اینترنت طراحی شده. موتورهای جستجوی بدون CAPTCHA استفاده کنید یا مستقیماً آدرس سایت را وارد کنید.
      </div>
    </div>
  </div>
  
  <script>
    document.getElementById('proxyForm').addEventListener('submit', function(e) {
      const input = document.getElementById('urlInput');
      let url = input.value.trim();
      
      // حذف فاصله‌های اضافی
      url = url.replace(/\s+/g, '');
      
      // اگر خالی بود، جلوگیری از ارسال
      if (!url) {
        e.preventDefault();
        input.focus();
        return;
      }
      
      input.value = url;
    });
    
    // ذخیره آخرین URL استفاده شده
    const urlInput = document.getElementById('urlInput');
    const lastUrl = localStorage.getItem('lastProxyUrl');
    if (lastUrl && !urlInput.value) {
      urlInput.placeholder = 'آخرین: ' + lastUrl;
    }
    
    document.getElementById('proxyForm').addEventListener('submit', function() {
      const url = urlInput.value.trim();
      if (url) {
        localStorage.setItem('lastProxyUrl', url);
      }
    });
  </script>
</body>
</html>`;
}

function getErrorPage(message) {
  return `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>خطا - وب پراکسی</title>
  <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Vazirmatn', Tahoma, Arial, sans-serif;
      background: linear-gradient(-45deg, #0a0a0a, #1a0a0a, #150505, #0d0d0d);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
    }
    
    body::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(circle at 50% 50%, rgba(220, 38, 38, 0.1) 0%, transparent 50%);
    }
    
    .error-container {
      background: rgba(20, 20, 20, 0.9);
      backdrop-filter: blur(20px);
      padding: 50px 40px;
      border-radius: 25px;
      max-width: 450px;
      width: 90%;
      border: 1px solid rgba(220, 38, 38, 0.3);
      box-shadow: 0 25px 50px rgba(0,0,0,0.5), 0 0 40px rgba(220, 38, 38, 0.1);
      position: relative;
      z-index: 1;
    }
    
    .error-icon {
      font-size: 4em;
      margin-bottom: 20px;
      filter: drop-shadow(0 0 20px rgba(220, 38, 38, 0.5));
    }
    
    h1 {
      font-size: 1.8em;
      margin-bottom: 15px;
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .error-message {
      background: rgba(220, 38, 38, 0.1);
      padding: 15px 20px;
      border-radius: 10px;
      margin: 20px 0;
      font-size: 14px;
      color: rgba(255,255,255,0.7);
      border: 1px solid rgba(220, 38, 38, 0.2);
      direction: ltr;
      word-break: break-all;
    }
    
    .back-btn {
      display: inline-block;
      margin-top: 20px;
      padding: 15px 35px;
      background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
      color: #fff;
      text-decoration: none;
      border-radius: 12px;
      font-weight: 700;
      transition: all 0.3s ease;
      box-shadow: 0 10px 30px rgba(220, 38, 38, 0.3);
    }
    
    .back-btn:hover {
      transform: translateY(-3px);
      box-shadow: 0 15px 40px rgba(220, 38, 38, 0.5);
    }
    
    .tips {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid rgba(220, 38, 38, 0.15);
      font-size: 13px;
      color: rgba(255,255,255,0.4);
    }
    
    .tips ul {
      list-style: none;
      margin-top: 10px;
    }
    
    .tips li {
      padding: 5px 0;
    }
    
    .tips strong {
      color: #ef4444;
    }
  </style>
</head>
<body>
  <div class="error-container">
    <div class="error-icon">🚨</div>
    <h1>مشکلی پیش آمد</h1>
    <div class="error-message">${escapeHtml(message)}</div>
    <a href="/" class="back-btn">← بازگشت به صفحه اصلی</a>
    <div class="tips">
      <strong>راهنما:</strong>
      <ul>
        <li>✓ آدرس سایت را بررسی کنید</li>
        <li>✓ از صحیح بودن نام دامنه مطمئن شوید</li>
        <li>✓ ممکن است سایت موقتاً در دسترس نباشد</li>
        <li>✓ برای Google از DuckDuckGo استفاده کنید</li>
      </ul>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function rewriteHtml(html, proxyOrigin, targetUrl) {
  const targetOrigin = targetUrl.origin;
  const targetHost = targetUrl.host;
  
  // بازنویسی لینک‌های کامل با http/https
  html = html.replace(/(href|src|action|data|poster|background)=(["'])(https?:\/\/[^"']+)(["'])/gi, (match, attr, q1, url, q2) => {
    return `${attr}=${q1}${proxyOrigin}/${url}${q2}`;
  });
  
  // بازنویسی لینک‌های نسبی به پروتکل (//)
  html = html.replace(/(href|src|action|data|poster)=(["'])(\/\/[^"']+)(["'])/gi, (match, attr, q1, url, q2) => {
    return `${attr}=${q1}${proxyOrigin}/https:${url}${q2}`;
  });
  
  // بازنویسی لینک‌های نسبی (/)
  html = html.replace(/(href|src|action|data|poster|background)=(["'])(\/[^/"'][^"']*)(["'])/gi, (match, attr, q1, path, q2) => {
    if (path.startsWith("//")) return match;
    return `${attr}=${q1}${proxyOrigin}/${targetOrigin}${path}${q2}`;
  });
  
  // بازنویسی meta refresh
  html = html.replace(/<meta([^>]*http-equiv=["']refresh["'][^>]*content=["'][^"']*url=)([^"']+)(["'][^>]*)>/gi, (match, before, url, after) => {
    let newUrl = url.trim();
    if (newUrl.startsWith('http://') || newUrl.startsWith('https://')) {
      newUrl = `${proxyOrigin}/${newUrl}`;
    } else if (newUrl.startsWith('//')) {
      newUrl = `${proxyOrigin}/https:${newUrl}`;
    } else if (newUrl.startsWith('/')) {
      newUrl = `${proxyOrigin}/${targetOrigin}${newUrl}`;
    }
    return `<meta${before}${newUrl}${after}>`;
  });
  
  // تزریق اسکریپت برای مدیریت لینک‌های داینامیک
  const script = `<script>
(function() {
  const proxyOrigin = "${proxyOrigin}";
  const targetOrigin = "${targetOrigin}";
  const targetHost = "${targetHost}";
  
  // تابع بازنویسی URL
  function rewriteUrl(url) {
    if (!url || typeof url !== 'string') return url;
    
    url = url.trim();
    
    if (url.startsWith('http://') || url.startsWith('https://')) {
      if (url.startsWith(proxyOrigin)) return url;
      return proxyOrigin + '/' + url;
    }
    if (url.startsWith('//')) {
      return proxyOrigin + '/https:' + url;
    }
    if (url.startsWith('/')) {
      return proxyOrigin + '/' + targetOrigin + url;
    }
    if (url.startsWith('#') || url.startsWith('javascript:') || url.startsWith('data:') || url.startsWith('mailto:') || url.startsWith('tel:')) {
      return url;
    }
    
    return url;
  }
  
  // بازنویسی fetch
  const originalFetch = window.fetch;
  window.fetch = function(url, options) {
    if (typeof url === 'string') {
      url = rewriteUrl(url);
    } else if (url instanceof Request) {
      url = new Request(rewriteUrl(url.url), url);
    }
    return originalFetch.call(this, url, options);
  };
  
  // بازنویسی XMLHttpRequest
  const originalXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    return originalXhrOpen.call(this, method, rewriteUrl(url), ...rest);
  };
  
  // بازنویسی WebSocket
  const originalWebSocket = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    if (typeof url === 'string') {
      url = url.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
      url = rewriteUrl(url);
      url = url.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
    }
    return new originalWebSocket(url, protocols);
  };
  
  // بازنویسی window.open
  const originalWindowOpen = window.open;
  window.open = function(url, ...args) {
    if (url) {
      url = rewriteUrl(url);
    }
    return originalWindowOpen.call(this, url, ...args);
  };
  
  // مدیریت کلیک روی لینک‌ها
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a');
    if (link && link.href) {
      const href = link.getAttribute('href');
      if (href && !href.startsWith(proxyOrigin) && !href.startsWith('#') && !href.startsWith('javascript:')) {
        e.preventDefault();
        const newUrl = rewriteUrl(href);
        if (link.target === '_blank') {
          window.open(newUrl, '_blank');
        } else {
          window.location.href = newUrl;
        }
      }
    }
  }, true);
  
  // مدیریت submit فرم‌ها
  document.addEventListener('submit', function(e) {
    const form = e.target;
    if (form.action) {
      const action = form.getAttribute('action');
      if (action && !action.startsWith(proxyOrigin)) {
        form.action = rewriteUrl(action);
      }
    }
  }, true);
  
  // بازنویسی تمام iframe ها
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      mutation.addedNodes.forEach(function(node) {
        if (node.tagName === 'IFRAME' && node.src && !node.src.startsWith(proxyOrigin)) {
          node.src = rewriteUrl(node.src);
        }
      });
    });
  });
  
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
</script>`;
  
  html = html.replace(/<\/head>/i, script + '</head>');
  
  // اگر </head> وجود نداشت، در ابتدای body اضافه کن
  if (!html.includes('</head>')) {
    html = html.replace(/<body/i, script + '<body');
  }
  
  return html;
}

function rewriteCss(css, proxyOrigin, targetUrl) {
  const targetOrigin = targetUrl.origin;
  
  // بازنویسی url() در CSS با http/https
  css = css.replace(/url\((["']?)(https?:\/\/[^)"']+)(["']?)\)/gi, (match, q1, url, q2) => {
    return `url(${q1}${proxyOrigin}/${url}${q2})`;
  });
  
  // بازنویسی url() با //
  css = css.replace(/url\((["']?)(\/\/[^)"']+)(["']?)\)/gi, (match, q1, url, q2) => {
    return `url(${q1}${proxyOrigin}/https:${url}${q2})`;
  });
  
  // بازنویسی url() با /
  css = css.replace(/url\((["']?)(\/[^)"']+)(["']?)\)/gi, (match, q1, path, q2) => {
    if (path.startsWith("//")) return match;
    return `url(${q1}${proxyOrigin}/${targetOrigin}${path}${q2})`;
  });
  
  // بازنویسی @import
  css = css.replace(/@import\s+(["'])(https?:\/\/[^"']+)(["'])/gi, (match, q1, url, q2) => {
    return `@import ${q1}${proxyOrigin}/${url}${q2}`;
  });
  
  return css;
}

function rewriteJs(js, proxyOrigin, targetUrl) {
  const targetOrigin = targetUrl.origin;
  
  // بازنویسی محافظه‌کارانه URLها در JavaScript
  try {
    // بازنویسی URLهای با کوتیشن دوتایی
    js = js.replace(/"(https?:\/\/[^"]+)"/g, (match, url) => {
      if (url.startsWith(proxyOrigin)) return match;
      return `"${proxyOrigin}/${url}"`;
    });
    
    // بازنویسی URLهای با کوتیشن تکی
    js = js.replace(/'(https?:\/\/[^']+)'/g, (match, url) => {
      if (url.startsWith(proxyOrigin)) return match;
      return `'${proxyOrigin}/${url}'`;
    });
    
    // بازنویسی URLهای با backtick
    js = js.replace(/`(https?:\/\/[^`]+)`/g, (match, url) => {
      if (url.startsWith(proxyOrigin)) return match;
      return `\`${proxyOrigin}/${url}\``;
    });
  } catch (e) {
    // در صورت خطا، JavaScript را بدون تغییر برگردان
    console.error('Error rewriting JS:', e);
  }
  
  return js;
}