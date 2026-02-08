export default {
  async fetch(request, env, ctx) {
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
      // decode کردن کامل pathname و search به صورت جداگانه
      let pathUrl = url.pathname.slice(1);
      
      // decode کردن pathname
      if (pathUrl.includes('%')) {
        try {
          // decode کردن چند مرحله‌ای برای مواقعی که double-encoded است
          let decoded = decodeURIComponent(pathUrl);
          // چک کنیم اگر هنوز % دارد، یک بار دیگر decode کن
          if (decoded.includes('%')) {
            try {
              decoded = decodeURIComponent(decoded);
            } catch (e) {
              // اگر نشد، همان decoded اول را نگه دار
            }
          }
          pathUrl = decoded;
        } catch (e) {
          // اگر decode نشد، همان را استفاده کن
          pathUrl = url.pathname.slice(1);
        }
      }
      
      // اضافه کردن search (که خودش decode نشده است)
      if (url.search) {
        pathUrl += url.search;
      }
      
      if (pathUrl.startsWith("http://") || pathUrl.startsWith("https://")) {
        targetUrl = pathUrl;
      } else {
        // مسیر نسبی است - باید از Referer استفاده کنیم
        const referer = request.headers.get("Referer");
        
        if (referer && referer.includes(proxyOrigin)) {
          try {
            // استخراج کامل URL از referer
            // مثال: https://proxy.com/https://www.youtube.com/watch -> https://www.youtube.com/watch
            const refPath = new URL(referer).pathname.slice(1);
            let refTargetUrl;
            
            if (refPath.startsWith("http://") || refPath.startsWith("https://")) {
              refTargetUrl = refPath;
            } else {
              // اگر referer هم مسیر نسبی داره، نمیتونیم resolve کنیم
              return new Response(getHomePage(), {
                headers: { "Content-Type": "text/html; charset=utf-8" },
              });
            }
            
            // حالا pathUrl رو نسبت به refTargetUrl resolve میکنیم
            const refTargetObj = new URL(refTargetUrl);
            
            if (pathUrl.startsWith("/")) {
              // مسیر مطلق - فقط origin را استفاده کن
              targetUrl = refTargetObj.origin + pathUrl;
            } else {
              // مسیر نسبی - نسبت به URL فعلی
              const refTargetPath = refTargetObj.pathname;
              const refTargetDir = refTargetPath.substring(0, refTargetPath.lastIndexOf('/') + 1);
              targetUrl = refTargetObj.origin + refTargetDir + pathUrl;
            }
            
          } catch (e) {
            return new Response(getHomePage(), {
              headers: { "Content-Type": "text/html; charset=utf-8" },
            });
          }
        } else {
          return new Response(getHomePage(), {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }
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
      
      // مدیریت Referer - استخراج یکبار
      const originalReferer = request.headers.get("Referer");
      let realReferer = target.origin + "/";
      let isFromProxy = false;
      
      if (originalReferer && originalReferer.includes(proxyOrigin)) {
        isFromProxy = true;
        const refMatch = originalReferer.match(/https?:\/\/[^/]+\/+(https?:\/\/.+)/);
        if (refMatch) {
          realReferer = refMatch[1];
        }
      }
      
      // هدرهای اصلی
      headers.set("User-Agent", userAgent);
      headers.set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7");
      headers.set("Accept-Language", "en-US,en;q=0.9");
      headers.set("Accept-Encoding", "gzip, deflate, br, zstd");
      headers.set("Upgrade-Insecure-Requests", "1");
      
      // Cache-Control فقط برای GET
      if (request.method === "GET") {
        headers.set("Cache-Control", "max-age=0");
      }
      
      // Referer همیشه تنظیم می‌شود
      headers.set("Referer", realReferer);
      
      // Origin فقط برای POST/PUT
      if (request.method === "POST" || request.method === "PUT") {
        headers.set("Origin", target.origin);
      }
      
      // هدرهای مخصوص Chrome
      if (!isFirefox && !isSafari) {
        headers.set("Sec-Ch-Ua", '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"');
        headers.set("Sec-Ch-Ua-Mobile", "?0");
        headers.set("Sec-Ch-Ua-Platform", '"Windows"');
      }
      
      // Sec-Fetch headers - منطق درست
      if (request.method === "POST" || request.method === "PUT") {
        // چک میکنیم آیا این یک form submission است یا AJAX
        const contentType = request.headers.get("Content-Type") || "";
        const isFormSubmit = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");
        
        if (isFormSubmit) {
          // Form submission
          headers.set("Sec-Fetch-Dest", "document");
          headers.set("Sec-Fetch-Mode", "navigate");
        } else {
          // AJAX request
          headers.set("Sec-Fetch-Dest", "empty");
          headers.set("Sec-Fetch-Mode", "cors");
        }
        headers.set("Sec-Fetch-Site", "same-origin");
        headers.set("Sec-Fetch-User", "?1");
      } else {
        headers.set("Sec-Fetch-Dest", "document");
        headers.set("Sec-Fetch-Mode", "navigate");
        
        if (isFromProxy) {
          // چک کردن اگر referer از همان host است
          try {
            const refUrl = new URL(realReferer);
            if (refUrl.host === target.host) {
              headers.set("Sec-Fetch-Site", "same-origin");
            } else {
              headers.set("Sec-Fetch-Site", "cross-site");
            }
          } catch {
            headers.set("Sec-Fetch-Site", "same-origin");
          }
        } else {
          headers.set("Sec-Fetch-Site", "none");
        }
        headers.set("Sec-Fetch-User", "?1");
      }
      
      // فوروارد تمام کوکی‌ها - مدیریت بهتر
      const cookies = request.headers.get("Cookie");
      if (cookies) {
        // تمیز کردن و فوروارد کوکی‌ها
        const cleanCookies = cookies
          .split(';')
          .map(c => c.trim())
          .filter(c => c.length > 0)
          .join('; ');
        if (cleanCookies) {
          headers.set("Cookie", cleanCookies);
        }
      }
      
      // Content-Type برای POST/PUT
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
          // حل کردن URL نسبی به مطلق
          let absoluteLocation;
          try {
            // اگر location یک URL کامل است
            if (location.startsWith('http://') || location.startsWith('https://')) {
              absoluteLocation = location;
            } else if (location.startsWith('//')) {
              // پروتکل نسبی
              absoluteLocation = target.protocol + location;
            } else if (location.startsWith('/')) {
              // مسیر مطلق - باید نسبت به target origin حل شود
              absoluteLocation = target.origin + location;
            } else if (location.startsWith('?')) {
              // Query string فقط - به pathname فعلی اضافه می‌شود
              absoluteLocation = target.origin + target.pathname + location;
            } else if (location.startsWith('#')) {
              // Fragment فقط
              absoluteLocation = target.origin + target.pathname + target.search + location;
            } else {
              // مسیر نسبی - باید نسبت به pathname فعلی حل شود
              const targetPath = target.pathname.substring(0, target.pathname.lastIndexOf('/') + 1);
              absoluteLocation = target.origin + targetPath + location;
            }
          } catch (e) {
            // در صورت خطا، استفاده از روش قدیمی
            absoluteLocation = new URL(location, target).toString();
          }
          
          const newHeaders = new Headers(response.headers);
          newHeaders.set("Location", `${proxyOrigin}/${absoluteLocation}`);
          
          // حفظ کوکی‌ها در ریدایرکت
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
      console.error('Proxy Error:', error);
      return new Response(getErrorPage(error.message || 'خطای نامشخص'), {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
  }
};

function getHomePage() {
  return `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>مثلاً فیلتر نیست</title>
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
    
    .creator-info {
      margin-top: 15px;
      padding: 12px 15px;
      background: rgba(139, 92, 246, 0.1);
      border-radius: 10px;
      border: 1px solid rgba(139, 92, 246, 0.2);
      font-size: 12px;
      color: rgba(196, 181, 253, 0.9);
      text-align: center;
    }
    
    .creator-info strong {
      color: #a78bfa;
      display: block;
      margin-bottom: 8px;
      font-size: 13px;
    }
    
    .creator-links {
      display: flex;
      justify-content: center;
      gap: 15px;
      flex-wrap: wrap;
      margin-top: 8px;
    }
    
    .creator-links a {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 6px 12px;
      background: rgba(139, 92, 246, 0.15);
      border: 1px solid rgba(139, 92, 246, 0.3);
      border-radius: 20px;
      color: #c4b5fd;
      text-decoration: none;
      font-size: 11px;
      transition: all 0.3s ease;
    }
    
    .creator-links a:hover {
      background: rgba(139, 92, 246, 0.25);
      border-color: rgba(139, 92, 246, 0.5);
      transform: translateY(-2px);
      box-shadow: 0 4px 15px rgba(139, 92, 246, 0.2);
    }
    
    /* Responsive Design - Mobile */
    @media (max-width: 768px) {
      body {
        overflow-y: auto;
        padding: 20px 0;
      }
      
      .container {
        padding: 35px 25px;
        border-radius: 20px;
        width: 95%;
        max-width: 100%;
      }
      
      .logo {
        font-size: 3em;
        margin-bottom: 12px;
      }
      
      h1 {
        font-size: 1.6em;
        margin-bottom: 6px;
      }
      
      .subtitle {
        font-size: 13px;
        margin-bottom: 25px;
        line-height: 1.5;
      }
      
      input[type="text"] {
        padding: 16px 18px 16px 45px;
        font-size: 15px;
        border-radius: 12px;
      }
      
      .input-wrapper::before {
        left: 15px;
        font-size: 16px;
      }
      
      button {
        padding: 16px 25px;
        font-size: 16px;
        border-radius: 12px;
      }
      
      .hint {
        font-size: 11px;
        flex-wrap: wrap;
        line-height: 1.6;
      }
      
      .hint span {
        padding: 2px 6px;
        font-size: 10px;
      }
      
      .divider {
        margin: 25px 0;
        font-size: 12px;
      }
      
      .divider span {
        padding: 0 10px;
      }
      
      .quick-links {
        gap: 8px;
      }
      
      .quick-links a {
        padding: 9px 14px;
        font-size: 12px;
        gap: 5px;
      }
      
      .quick-links img {
        width: 16px;
        height: 16px;
      }
      
      .footer {
        margin-top: 25px;
        padding-top: 15px;
        font-size: 11px;
      }
      
      .status {
        font-size: 11px;
      }
      
      .warning {
        font-size: 10px;
        padding: 8px 12px;
        margin-top: 10px;
        line-height: 1.5;
      }
      
      .info-box {
        font-size: 11px;
        padding: 10px 12px;
        margin-top: 12px;
        line-height: 1.5;
      }
      
      .creator-info {
        font-size: 11px;
        padding: 10px 12px;
        margin-top: 12px;
      }
      
      .creator-info strong {
        font-size: 12px;
      }
      
      .creator-links {
        gap: 10px;
      }
      
      .creator-links a {
        padding: 5px 10px;
        font-size: 10px;
      }
    }
    
    /* Extra Small Mobile */
    @media (max-width: 480px) {
      .container {
        padding: 30px 20px;
      }
      
      .logo {
        font-size: 2.5em;
      }
      
      h1 {
        font-size: 1.4em;
      }
      
      .subtitle {
        font-size: 12px;
      }
      
      input[type="text"] {
        padding: 14px 16px 14px 42px;
        font-size: 14px;
      }
      
      button {
        padding: 14px 20px;
        font-size: 15px;
      }
      
      .quick-links a {
        padding: 8px 12px;
        font-size: 11px;
      }
      
      .divider {
        font-size: 11px;
      }
      
      .creator-links a {
        padding: 5px 9px;
        font-size: 9px;
      }
      
      .creator-links svg {
        width: 12px;
        height: 12px;
      }
    }
    
    /* Desktop Responsive Design */
    @media (min-width: 769px) {
      body {
        overflow-y: auto;
        padding: 40px 0;
      }
      
      .container {
        max-width: 650px;
        padding: 60px 50px;
        border-radius: 35px;
      }
      
      .logo {
        font-size: 4.5em;
        margin-bottom: 20px;
      }
      
      h1 {
        font-size: 2.5em;
        margin-bottom: 12px;
      }
      
      .subtitle {
        font-size: 16px;
        margin-bottom: 40px;
      }
      
      input[type="text"] {
        padding: 20px 22px 20px 55px;
        font-size: 17px;
        border-radius: 16px;
      }
      
      .input-wrapper::before {
        left: 20px;
        font-size: 20px;
      }
      
      button {
        padding: 20px 35px;
        font-size: 18px;
        border-radius: 16px;
      }
      
      .hint {
        font-size: 13px;
        margin-top: 15px;
      }
      
      .hint span {
        padding: 4px 10px;
        font-size: 12px;
      }
      
      .divider {
        margin: 35px 0;
        font-size: 14px;
      }
      
      .quick-links {
        gap: 12px;
      }
      
      .quick-links a {
        padding: 12px 20px;
        font-size: 15px;
        gap: 7px;
      }
      
      .quick-links img {
        width: 22px;
        height: 22px;
      }
      
      .footer {
        margin-top: 40px;
        padding-top: 25px;
        font-size: 13px;
      }
      
      .status {
        font-size: 13px;
      }
      
      .warning {
        font-size: 12px;
        padding: 10px 18px;
        margin-top: 15px;
      }
      
      .info-box {
        font-size: 13px;
        padding: 14px 18px;
        margin-top: 18px;
      }
      
      .creator-info {
        font-size: 13px;
        padding: 14px 18px;
        margin-top: 18px;
      }
      
      .creator-info strong {
        font-size: 14px;
        margin-bottom: 10px;
      }
      
      .creator-links {
        gap: 18px;
      }
      
      .creator-links a {
        padding: 7px 14px;
        font-size: 12px;
      }
    }
    
    /* Large Desktop */
    @media (min-width: 1200px) {
      body {
        padding: 50px 0;
      }
      
      .container {
        max-width: 750px;
        padding: 70px 60px;
        border-radius: 40px;
      }
      
      .logo {
        font-size: 5em;
        margin-bottom: 25px;
      }
      
      h1 {
        font-size: 2.8em;
        margin-bottom: 15px;
      }
      
      .subtitle {
        font-size: 18px;
        margin-bottom: 45px;
      }
      
      input[type="text"] {
        padding: 22px 25px 22px 60px;
        font-size: 18px;
        border-radius: 18px;
      }
      
      .input-wrapper::before {
        left: 22px;
        font-size: 22px;
      }
      
      button {
        padding: 22px 40px;
        font-size: 19px;
        border-radius: 18px;
      }
      
      .hint {
        font-size: 14px;
        margin-top: 18px;
      }
      
      .hint span {
        padding: 5px 12px;
        font-size: 13px;
      }
      
      .divider {
        margin: 40px 0;
        font-size: 15px;
      }
      
      .quick-links {
        gap: 14px;
      }
      
      .quick-links a {
        padding: 13px 22px;
        font-size: 16px;
        gap: 8px;
      }
      
      .quick-links img {
        width: 24px;
        height: 24px;
      }
      
      .footer {
        margin-top: 45px;
        padding-top: 28px;
        font-size: 14px;
      }
      
      .status {
        font-size: 14px;
      }
      
      .warning {
        font-size: 13px;
        padding: 12px 20px;
        margin-top: 18px;
      }
      
      .info-box {
        font-size: 14px;
        padding: 16px 20px;
        margin-top: 20px;
      }
      
      .creator-info {
        font-size: 14px;
        padding: 16px 20px;
        margin-top: 20px;
      }
      
      .creator-info strong {
        font-size: 15px;
        margin-bottom: 12px;
      }
      
      .creator-links {
        gap: 20px;
      }
      
      .creator-links a {
        padding: 8px 16px;
        font-size: 13px;
      }
    }
    
    /* Ultra Wide Desktop */
    @media (min-width: 1600px) {
      body {
        padding: 60px 0;
      }
      
      .container {
        max-width: 850px;
        padding: 80px 70px;
      }
      
      .logo {
        font-size: 5.5em;
      }
      
      h1 {
        font-size: 3em;
      }
      
      .subtitle {
        font-size: 19px;
      }
      
      input[type="text"] {
        font-size: 19px;
      }
      
      button {
        font-size: 20px;
      }
      
      .quick-links a {
        font-size: 17px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">🔥</div>
    <h1>مثلاً فیلتر نیست</h1>
    <p class="subtitle">به هر سایتی مثلا دسترسی داشته باشید یا جستجو کنید - سریع و امن</p>
    
    <form action="/" method="GET" id="proxyForm">
      <div class="input-wrapper">
        <input type="text" name="url" id="urlInput" placeholder="مثلاً: example.com یا جستجو کنید..." autocomplete="off" autofocus>
      </div>
      <button type="submit">🚀 ورود یا جستجو</button>
      <div class="hint">با <span>http://</span> یا <span>https://</span> برای سایت، بدون آن برای جستجو</div>
    </form>
    
    <div class="divider"><span>مثلا داکیومنت‌های برنامه‌نویسی</span></div>
    
    <div class="quick-links">
      <a href="/?url=https://developer.mozilla.org">
        <img src="https://developer.mozilla.org/favicon.ico" alt="">MDN Web Docs
      </a>
      <a href="/?url=https://docs.python.org">
        <img src="https://www.python.org/favicon.ico" alt="">Python Docs
      </a>
      <a href="/?url=https://nodejs.org/docs">
        <img src="https://nodejs.org/favicon.ico" alt="">Node.js Docs
      </a>
      <a href="/?url=https://react.dev">
        <img src="https://react.dev/favicon.ico" alt="">React Docs
      </a>
      <a href="/?url=https://www.php.net/docs.php">
        <img src="https://www.php.net/favicon.ico" alt="">PHP Docs
      </a>
      <a href="/?url=https://go.dev/doc">
        <img src="https://go.dev/favicon.ico" alt="">Go Docs
      </a>
      <a href="/?url=https://docs.rust-lang.org">
        <img src="https://www.rust-lang.org/favicon.ico" alt="">Rust Docs
      </a>
      <a href="/?url=https://vuejs.org/guide">
        <img src="https://vuejs.org/logo.svg" alt="">Vue.js Docs
      </a>
    </div>
    
    <div class="divider"><span>مثلا سایت‌های محبوب</span></div>
    
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
        مثلا سرور فعال است
      </div>
      <div class="warning">
        ⚠️ طراحی شده برای درخواست‌های سبک وب — نه استریم ویدیو (مثل YouTube)
      </div>
      <div class="info-box">
        <strong>💡 مثلا نکته:</strong>
        برای جستجو از تایپ بدون http/https استفاده کنید. بعضی سایت‌ها ممکن است CAPTCHA یا محدودیت داشته باشند.
      </div>
      <div class="creator-info">
        <strong>👨‍💻 مثلا ساخته شده توسط:</strong>
        <div class="creator-links">
          <a href="/?url=https://github.com/pouriavelaei" target="_blank">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            GitHub
          </a>
          <a href="/?url=https://t.me/PythonFarsi2024" target="_blank">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
            Telegram
          </a>
        </div>
      </div>
    </div>
  </div>
  
  <script>
    (function() {
      const form = document.getElementById('proxyForm');
      const input = document.getElementById('urlInput');
      
      // بارگذاری آخرین URL استفاده شده
      const lastUrl = localStorage.getItem('lastProxyUrl');
      if (lastUrl && !input.value) {
        input.placeholder = 'آخرین: ' + lastUrl.substring(0, 30) + '...';
      }
      
      // مدیریت submit فرم - فقط یک event listener
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        let url = input.value.trim().replace(/\s+/g, ' ').trim();
        
        // اگر خالی بود، جلوگیری
        if (!url) {
          input.focus();
          return;
        }
        
        // ذخیره در localStorage
        localStorage.setItem('lastProxyUrl', url);
        
        // تشخیص نوع URL و هدایت
        if (url.startsWith('http://') || url.startsWith('https://')) {
          // URL کامل - مستقیم به پراکسی
          window.location.href = '/?url=' + encodeURIComponent(url);
        } else {
          // متن جستجو - به Mojeek
          window.location.href = '/https://www.mojeek.com/search?q=' + encodeURIComponent(url) + '&theme=dark';
        }
      });
    })();
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
    
    /* Responsive Design - Mobile */
    @media (max-width: 768px) {
      body {
        padding: 20px 0;
      }
      
      .error-container {
        padding: 35px 25px;
        border-radius: 20px;
        width: 95%;
      }
      
      .error-icon {
        font-size: 3em;
        margin-bottom: 15px;
      }
      
      h1 {
        font-size: 1.5em;
      }
      
      .error-message {
        padding: 12px 15px;
        font-size: 12px;
        margin: 15px 0;
      }
      
      .back-btn {
        padding: 13px 28px;
        font-size: 15px;
        border-radius: 10px;
      }
      
      .tips {
        font-size: 12px;
        margin-top: 25px;
        padding-top: 15px;
      }
      
      .tips li {
        padding: 4px 0;
        line-height: 1.5;
      }
    }
    
    @media (max-width: 480px) {
      .error-container {
        padding: 30px 20px;
      }
      
      .error-icon {
        font-size: 2.5em;
      }
      
      h1 {
        font-size: 1.3em;
      }
      
      .error-message {
        font-size: 11px;
        padding: 10px 12px;
      }
      
      .back-btn {
        padding: 12px 25px;
        font-size: 14px;
      }
      
      .tips {
        font-size: 11px;
      }
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
  
  // بازنویسی base tag اگر وجود دارد
  html = html.replace(/<base([^>]+)href=(["'])([^"']+)(["'])([^>]*)>/gi, (match, before, q1, href, q2, after) => {
    let newHref = href;
    if (href.startsWith('http://') || href.startsWith('https://')) {
      if (!href.startsWith(proxyOrigin)) {
        newHref = `${proxyOrigin}/${href}`;
      }
    } else if (href.startsWith('//')) {
      newHref = `${proxyOrigin}/https:${href}`;
    } else if (href.startsWith('/')) {
      newHref = `${proxyOrigin}/${targetOrigin}${href}`;
    }
    return `<base${before}href=${q1}${newHref}${q2}${after}>`;
  });
  
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
  
  // تابع استخراج URL واقعی از پراکسی URL
  function getRealCurrentUrl() {
    const currentPath = window.location.pathname;
    const currentSearch = window.location.search;
    const currentHash = window.location.hash;
    
    // حذف اسلش اول
    let cleanPath = currentPath.slice(1);
    
    // decode کردن در صورت نیاز
    try {
      if (cleanPath.includes('%')) {
        cleanPath = decodeURIComponent(cleanPath);
      }
    } catch (e) {}
    
    // اگر با http شروع می‌شود، URL کامل است
    if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
      return cleanPath + currentSearch + currentHash;
    }
    
    // در غیر این صورت، مسیر نسبی است
    return targetOrigin + '/' + cleanPath + currentSearch + currentHash;
  }
  
  // تابع بازنویسی URL
  function rewriteUrl(url) {
    if (!url || typeof url !== 'string') return url;
    
    url = url.trim();
    
    // URL های خاص که نباید تغییر کنند
    if (url.startsWith('#') || url.startsWith('javascript:') || url.startsWith('data:') || url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('blob:')) {
      return url;
    }
    
    // اگر URL با پراکسی شروع می‌شود، بدون تغییر برگردان
    if (url.startsWith(proxyOrigin)) return url;
    
    // URL کامل با پروتکل
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return proxyOrigin + '/' + url;
    }
    
    // پروتکل نسبی
    if (url.startsWith('//')) {
      return proxyOrigin + '/https:' + url;
    }
    
    // مسیر مطلق - باید نسبت به targetOrigin حل شود
    if (url.startsWith('/')) {
      return proxyOrigin + '/' + targetOrigin + url;
    }
    
    // مسیرهای نسبی (بدون /) - باید نسبت به URL فعلی حل شوند
    try {
      const realCurrentUrl = getRealCurrentUrl();
      const currentUrlObj = new URL(realCurrentUrl);
      const resolvedUrl = new URL(url, currentUrlObj.href);
      return proxyOrigin + '/' + resolvedUrl.toString();
    } catch (e) {
      console.warn('Failed to resolve relative URL:', url, e);
      // در صورت خطا، سعی کن به صورت ساده حل کن
      return proxyOrigin + '/' + targetOrigin + '/' + url;
    }
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
  
  // مدیریت window.location - override کامل
  const originalLocationSetter = Object.getOwnPropertyDescriptor(window.Location.prototype, 'href').set;
  Object.defineProperty(window.Location.prototype, 'href', {
    set: function(url) {
      if (url && typeof url === 'string') {
        if (url.startsWith('/') && !url.startsWith('//' + proxyOrigin)) {
          url = proxyOrigin + '/' + targetOrigin + url;
        } else if (!url.startsWith('http') && !url.startsWith(proxyOrigin) && !url.startsWith('#') && !url.startsWith('javascript:')) {
          url = rewriteUrl(url);
        } else if (url.startsWith('http') && !url.startsWith(proxyOrigin)) {
          url = proxyOrigin + '/' + url;
        }
      }
      return originalLocationSetter.call(this, url);
    },
    get: function() {
      return originalLocationSetter.call(this);
    }
  });
  
  // مدیریت location.assign و location.replace
  const originalLocationAssign = window.Location.prototype.assign;
  window.Location.prototype.assign = function(url) {
    if (url && typeof url === 'string') {
      if (url.startsWith('/') && !url.startsWith('//')) {
        url = proxyOrigin + '/' + targetOrigin + url;
      } else if (!url.startsWith('http') && !url.startsWith('#')) {
        url = rewriteUrl(url);
      } else if (url.startsWith('http') && !url.startsWith(proxyOrigin)) {
        url = proxyOrigin + '/' + url;
      }
    }
    return originalLocationAssign.call(this, url);
  };
  
  const originalLocationReplace = window.Location.prototype.replace;
  window.Location.prototype.replace = function(url) {
    if (url && typeof url === 'string') {
      if (url.startsWith('/') && !url.startsWith('//')) {
        url = proxyOrigin + '/' + targetOrigin + url;
      } else if (!url.startsWith('http') && !url.startsWith('#')) {
        url = rewriteUrl(url);
      } else if (url.startsWith('http') && !url.startsWith(proxyOrigin)) {
        url = proxyOrigin + '/' + url;
      }
    }
    return originalLocationReplace.call(this, url);
  };
  
  // مدیریت history.pushState و history.replaceState
  const originalPushState = window.History.prototype.pushState;
  window.History.prototype.pushState = function(state, title, url) {
    if (url && typeof url === 'string') {
      if (url.startsWith('/') && !url.startsWith('//')) {
        url = proxyOrigin + '/' + targetOrigin + url;
      } else if (!url.startsWith('http') && !url.startsWith('#')) {
        url = rewriteUrl(url);
      } else if (url.startsWith('http') && !url.startsWith(proxyOrigin)) {
        url = proxyOrigin + '/' + url;
      }
    }
    return originalPushState.call(this, state, title, url);
  };
  
  const originalReplaceState = window.History.prototype.replaceState;
  window.History.prototype.replaceState = function(state, title, url) {
    if (url && typeof url === 'string') {
      if (url.startsWith('/') && !url.startsWith('//')) {
        url = proxyOrigin + '/' + targetOrigin + url;
      } else if (!url.startsWith('http') && !url.startsWith('#')) {
        url = rewriteUrl(url);
      } else if (url.startsWith('http') && !url.startsWith(proxyOrigin)) {
        url = proxyOrigin + '/' + url;
      }
    }
    return originalReplaceState.call(this, state, title, url);
  };
  
  // مدیریت کلیک روی لینک‌ها و دکمه‌ها
  document.addEventListener('click', function(e) {
    // پیدا کردن نزدیک‌ترین لینک
    const link = e.target.closest('a, [onclick], button[formaction]');
    
    if (link) {
      // مدیریت لینک‌های href
      if (link.href) {
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
      
      // مدیریت onclick که ممکن است location را تغییر دهد
      const onclickAttr = link.getAttribute('onclick');
      if (onclickAttr && (onclickAttr.includes('location') || onclickAttr.includes('href'))) {
        // این را می‌گذاریم که به صورت طبیعی اجرا شود، چون location setter را اورراید کردیم
      }
      
      // مدیریت button با formaction
      if (link.tagName === 'BUTTON' && link.hasAttribute('formaction')) {
        const formaction = link.getAttribute('formaction');
        if (formaction && !formaction.startsWith(proxyOrigin)) {
          link.setAttribute('formaction', rewriteUrl(formaction));
        }
      }
    }
  }, true);
  
  // مدیریت submit فرم‌ها - بهبود یافته
  document.addEventListener('submit', function(e) {
    const form = e.target;
    let action = form.getAttribute('action');
    
    // اگر action خالی یا null باشد
    if (!action || action === '' || action === '#') {
      // از URL واقعی فعلی استفاده می‌کنیم
      const realUrl = getRealCurrentUrl();
      try {
        const currentUrl = new URL(realUrl);
        action = currentUrl.origin + currentUrl.pathname;
      } catch (e) {
        action = targetOrigin + '/';
      }
    }
    
    if (!action.startsWith(proxyOrigin)) {
      // بازنویسی action
      const rewrittenAction = rewriteUrl(action);
      form.setAttribute('action', rewrittenAction);
      form.action = rewrittenAction;
    }
  }, true);
  
  // مدیریت فرم‌هایی که با جاوااسکریپت submit می‌شوند
  const originalFormSubmit = HTMLFormElement.prototype.submit;
  HTMLFormElement.prototype.submit = function() {
    let action = this.getAttribute('action');
    
    if (!action || action === '' || action === '#') {
      const realUrl = getRealCurrentUrl();
      try {
        const currentUrl = new URL(realUrl);
        action = currentUrl.origin + currentUrl.pathname;
      } catch (e) {
        action = targetOrigin + '/';
      }
    }
    
    if (!action.startsWith(proxyOrigin)) {
      this.action = rewriteUrl(action);
    }
    return originalFormSubmit.call(this);
  };
  
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
  
  // اصلاح base href اگر وجود دارد
  function ensureCorrectBase() {
    const existingBase = document.querySelector('base');
    const correctBaseHref = proxyOrigin + '/' + targetOrigin + '/';
    
    if (existingBase) {
      const currentHref = existingBase.getAttribute('href');
      if (currentHref !== correctBaseHref) {
        existingBase.setAttribute('href', correctBaseHref);
      }
    } else {
      // اگر base وجود ندارد، اضافه کن
      const newBase = document.createElement('base');
      newBase.href = correctBaseHref;
      document.head.insertBefore(newBase, document.head.firstChild);
    }
  }
  
  // اجرای اولیه
  ensureCorrectBase();
  
  // چک کردن مداوم base tag (یوتیوب ممکن است آن را تغییر دهد)
  setInterval(ensureCorrectBase, 500);
  
  // Navigation interceptor - جلوگیری از ناوبری اشتباه
  if (window.navigation) {
    window.navigation.addEventListener('navigate', function(e) {
      const destination = e.destination.url;
      
      // اگر به URL نسبی می‌رود که با پراکسی شروع نمی‌شود
      if (destination && !destination.startsWith(proxyOrigin + '/http')) {
        const destinationUrl = new URL(destination);
        const path = destinationUrl.pathname;
        
        // اگر مسیر نسبی است و نباید به صفحه اصلی برود
        if (path && path !== '/' && !path.startsWith('/http')) {
          e.preventDefault();
          const correctedUrl = proxyOrigin + '/' + targetOrigin + path + destinationUrl.search + destinationUrl.hash;
          window.location.href = correctedUrl;
        }
      }
    });
  }
})();
</script>`;
  
  // اضافه کردن base tag برای مدیریت بهتر URL های نسبی
  const baseTag = `<base href="${proxyOrigin}/${targetOrigin}/">`;
  
  // تزریق base و script به head
  if (html.match(/<head[^>]*>/i)) {
    html = html.replace(/<head[^>]*>/i, (match) => match + "\n" + baseTag + "\n" + script);
  } else if (html.includes('</head>')) {
    html = html.replace(/<\/head>/i, baseTag + "\n" + script + "\n</head>");
  } else {
    // اگر head نبود، قبل از body
    html = html.replace(/<body/i, baseTag + "\n" + script + "\n<body");
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