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
      
      // ساخت هدرها
      const headers = new Headers();
      headers.set("User-Agent", request.headers.get("User-Agent") || "Mozilla/5.0");
      headers.set("Accept", request.headers.get("Accept") || "*/*");
      headers.set("Accept-Language", request.headers.get("Accept-Language") || "en-US,en;q=0.9");
      
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
        newHeaders.delete("x-frame-options");
        newHeaders.set("Access-Control-Allow-Origin", "*");
        
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
        
        return new Response(css, {
          status: response.status,
          headers: newHeaders,
        });
      }
      
      // سایر محتواها بدون تغییر
      const newHeaders = new Headers(response.headers);
      newHeaders.set("Access-Control-Allow-Origin", "*");
      newHeaders.delete("content-security-policy");
      
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
    
    body {
      font-family: 'Vazirmatn', Tahoma, Arial, sans-serif;
      background: linear-gradient(-45deg, #0f0c29, #302b63, #24243e, #0f0c29);
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
      background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
    }
    
    .container {
      background: rgba(255,255,255,0.05);
      backdrop-filter: blur(20px);
      border-radius: 30px;
      padding: 50px 40px;
      max-width: 550px;
      width: 92%;
      text-align: center;
      box-shadow: 0 25px 50px rgba(0,0,0,0.4), inset 0 0 60px rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      position: relative;
      z-index: 1;
    }
    
    .logo {
      font-size: 4em;
      margin-bottom: 15px;
      animation: float 3s ease-in-out infinite;
      display: inline-block;
    }
    
    h1 {
      font-size: 2.2em;
      font-weight: 900;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .subtitle {
      color: rgba(255,255,255,0.6);
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
      border: 2px solid rgba(255,255,255,0.1);
      border-radius: 15px;
      font-size: 16px;
      font-family: inherit;
      background: rgba(255,255,255,0.08);
      color: #fff;
      direction: ltr;
      text-align: left;
      transition: all 0.3s ease;
    }
    
    input[type="text"]::placeholder {
      color: rgba(255,255,255,0.4);
    }
    
    input[type="text"]:focus {
      outline: none;
      border-color: #667eea;
      background: rgba(255,255,255,0.12);
      box-shadow: 0 0 30px rgba(102, 126, 234, 0.3);
    }
    
    button {
      width: 100%;
      padding: 18px 30px;
      border: none;
      border-radius: 15px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
      font-size: 17px;
      font-weight: 700;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
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
      box-shadow: 0 15px 35px rgba(102, 126, 234, 0.4);
    }
    
    button:hover::before {
      left: 100%;
    }
    
    button:active {
      transform: translateY(-1px);
    }
    
    .hint {
      font-size: 12px;
      color: rgba(255,255,255,0.4);
      margin-top: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
    }
    
    .hint span {
      background: rgba(255,255,255,0.1);
      padding: 3px 8px;
      border-radius: 5px;
      font-family: monospace;
      direction: ltr;
    }
    
    .divider {
      display: flex;
      align-items: center;
      margin: 30px 0;
      color: rgba(255,255,255,0.3);
      font-size: 13px;
    }
    
    .divider::before, .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
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
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 25px;
      color: #fff;
      text-decoration: none;
      font-size: 14px;
      transition: all 0.3s ease;
    }
    
    .quick-links a:hover {
      background: rgba(255,255,255,0.15);
      border-color: rgba(255,255,255,0.2);
      transform: translateY(-2px);
    }
    
    .quick-links img {
      width: 20px;
      height: 20px;
      border-radius: 4px;
    }
    
    .footer {
      margin-top: 35px;
      padding-top: 20px;
      border-top: 1px solid rgba(255,255,255,0.1);
      font-size: 12px;
      color: rgba(255,255,255,0.3);
    }
    
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
    
    .status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #4ade80;
      margin-top: 10px;
    }
    
    .status-dot {
      width: 8px;
      height: 8px;
      background: #4ade80;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">🌍</div>
    <h1>وب پراکسی آزاد</h1>
    <p class="subtitle">به هر سایتی دسترسی داشته باشید - سریع و امن</p>
    
    <form action="/" method="GET" id="proxyForm">
      <div class="input-wrapper">
        <input type="text" name="url" id="urlInput" placeholder="google.com یا https://example.com" autocomplete="off" autofocus>
      </div>
      <button type="submit">🚀 باز کردن سایت</button>
      <div class="hint">نیازی به نوشتن <span>https://</span> نیست</div>
    </form>
    
    <div class="divider"><span>یا امتحان کنید</span></div>
    
    <div class="quick-links">
      <a href="/?url=google.com">
        <img src="https://www.google.com/favicon.ico" alt="">Google
      </a>
      <a href="/?url=youtube.com">
        <img src="https://www.youtube.com/favicon.ico" alt="">YouTube
      </a>
      <a href="/?url=twitter.com">
        <img src="https://abs.twimg.com/favicons/twitter.3.ico" alt="">Twitter
      </a>
      <a href="/?url=instagram.com">
        <img src="https://www.instagram.com/favicon.ico" alt="">Instagram
      </a>
      <a href="/?url=wikipedia.org">
        <img src="https://www.wikipedia.org/favicon.ico" alt="">Wikipedia
      </a>
    </div>
    
    <div class="footer">
      <div class="status">
        <span class="status-dot"></span>
        سرور فعال است
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
      background: linear-gradient(-45deg, #1a1a2e, #2d1f3d, #1a1a2e);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
    }
    
    .error-container {
      background: rgba(255,255,255,0.05);
      backdrop-filter: blur(20px);
      padding: 50px 40px;
      border-radius: 25px;
      max-width: 450px;
      width: 90%;
      border: 1px solid rgba(255,100,100,0.2);
      box-shadow: 0 25px 50px rgba(0,0,0,0.3);
    }
    
    .error-icon {
      font-size: 4em;
      margin-bottom: 20px;
    }
    
    h1 {
      font-size: 1.8em;
      margin-bottom: 15px;
      color: #ff6b6b;
    }
    
    .error-message {
      background: rgba(255,100,100,0.1);
      padding: 15px 20px;
      border-radius: 10px;
      margin: 20px 0;
      font-size: 14px;
      color: rgba(255,255,255,0.8);
      border: 1px solid rgba(255,100,100,0.2);
      direction: ltr;
      word-break: break-all;
    }
    
    .back-btn {
      display: inline-block;
      margin-top: 20px;
      padding: 15px 35px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
      text-decoration: none;
      border-radius: 12px;
      font-weight: 700;
      transition: all 0.3s ease;
    }
    
    .back-btn:hover {
      transform: translateY(-3px);
      box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
    }
    
    .tips {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid rgba(255,255,255,0.1);
      font-size: 13px;
      color: rgba(255,255,255,0.5);
    }
    
    .tips ul {
      list-style: none;
      margin-top: 10px;
    }
    
    .tips li {
      padding: 5px 0;
    }
  </style>
</head>
<body>
  <div class="error-container">
    <div class="error-icon">😕</div>
    <h1>مشکلی پیش آمد</h1>
    <div class="error-message">${message}</div>
    <a href="/" class="back-btn">← بازگشت به صفحه اصلی</a>
    <div class="tips">
      <strong>راهنما:</strong>
      <ul>
        <li>آدرس سایت را بررسی کنید</li>
        <li>از صحیح بودن نام دامنه مطمئن شوید</li>
        <li>ممکن است سایت موقتاً در دسترس نباشد</li>
      </ul>
    </div>
  </div>
</body>
</html>`;
}

function rewriteHtml(html, proxyOrigin, targetUrl) {
  const targetOrigin = targetUrl.origin;
  
  // بازنویسی لینک‌های href و src
  html = html.replace(/(href|src|action)=(["'])(https?:\/\/[^"']+)(["'])/gi, (match, attr, q1, url, q2) => {
    return `${attr}=${q1}${proxyOrigin}/${url}${q2}`;
  });
  
  // بازنویسی لینک‌های نسبی به پروتکل
  html = html.replace(/(href|src)=(["'])(\/\/[^"']+)(["'])/gi, (match, attr, q1, url, q2) => {
    return `${attr}=${q1}${proxyOrigin}/https:${url}${q2}`;
  });
  
  // بازنویسی لینک‌های نسبی
  html = html.replace(/(href|src|action)=(["'])(\/[^"']+)(["'])/gi, (match, attr, q1, path, q2) => {
    if (path.startsWith("//")) return match;
    return `${attr}=${q1}${proxyOrigin}/${targetOrigin}${path}${q2}`;
  });
  
  // تزریق اسکریپت برای مدیریت لینک‌های داینامیک
  const script = `<script>
    (function() {
      const proxyOrigin = "${proxyOrigin}";
      const targetOrigin = "${targetOrigin}";
      
      // بازنویسی fetch
      const originalFetch = window.fetch;
      window.fetch = function(url, options) {
        if (typeof url === 'string') {
          url = rewriteUrl(url);
        }
        return originalFetch.call(this, url, options);
      };
      
      // بازنویسی XMLHttpRequest
      const originalOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        return originalOpen.call(this, method, rewriteUrl(url), ...rest);
      };
      
      function rewriteUrl(url) {
        if (url.startsWith('http://') || url.startsWith('https://')) {
          return proxyOrigin + '/' + url;
        }
        if (url.startsWith('//')) {
          return proxyOrigin + '/https:' + url;
        }
        if (url.startsWith('/')) {
          return proxyOrigin + '/' + targetOrigin + url;
        }
        return url;
      }
      
      // بازنویسی لینک‌های کلیک‌شده
      document.addEventListener('click', function(e) {
        const link = e.target.closest('a');
        if (link && link.href) {
          const href = link.getAttribute('href');
          if (href && !href.startsWith(proxyOrigin) && !href.startsWith('#') && !href.startsWith('javascript:')) {
            e.preventDefault();
            window.location.href = rewriteUrl(href);
          }
        }
      }, true);
    })();
  </script>`;
  
  html = html.replace(/<\/head>/i, script + '</head>');
  
  return html;
}

function rewriteCss(css, proxyOrigin, targetUrl) {
  const targetOrigin = targetUrl.origin;
  
  // بازنویسی url() در CSS
  css = css.replace(/url\((["']?)(https?:\/\/[^)"']+)(["']?)\)/gi, (match, q1, url, q2) => {
    return `url(${q1}${proxyOrigin}/${url}${q2})`;
  });
  
  css = css.replace(/url\((["']?)(\/[^)"']+)(["']?)\)/gi, (match, q1, path, q2) => {
    if (path.startsWith("//")) {
      return `url(${q1}${proxyOrigin}/https:${path}${q2})`;
    }
    return `url(${q1}${proxyOrigin}/${targetOrigin}${path}${q2})`;
  });
  
  return css;
}
