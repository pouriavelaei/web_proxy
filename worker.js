// Web Proxy Worker for Cloudflare

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // صفحه اصلی - فرم ورودی URL
    if (url.pathname === '/' || url.pathname === '') {
      return new Response(getHomePage(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
    
    // استخراج URL مقصد
    const targetUrl = url.searchParams.get('url') || url.pathname.slice(1);
    
    if (!targetUrl) {
      return new Response('لطفا URL را وارد کنید', { status: 400 });
    }
    
    try {
      // ساخت URL کامل
      let fullUrl = targetUrl;
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        fullUrl = 'https://' + targetUrl;
      }
      
      // کپی کردن هدرهای درخواست اصلی
      const headers = new Headers(request.headers);
      headers.delete('host');
      headers.set('Origin', new URL(fullUrl).origin);
      headers.set('Referer', fullUrl);
      
      // ارسال درخواست به سرور مقصد
      const response = await fetch(fullUrl, {
        method: request.method,
        headers: headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.arrayBuffer() : undefined,
        redirect: 'manual'
      });
      
      // مدیریت ریدایرکت
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('Location');
        if (location) {
          const redirectUrl = new URL(location, fullUrl);
          return Response.redirect(`${url.origin}/?url=${encodeURIComponent(redirectUrl.href)}`, response.status);
        }
      }
      
      // کپی کردن هدرهای پاسخ
      const responseHeaders = new Headers(response.headers);
      
      // حذف هدرهای امنیتی که مانع کار پراکسی می‌شوند
      responseHeaders.delete('content-security-policy');
      responseHeaders.delete('x-frame-options');
      responseHeaders.delete('content-security-policy-report-only');
      
      // مدیریت کوکی‌ها - تبدیل domain به domain پراکسی
      const cookies = response.headers.getAll('set-cookie');
      if (cookies.length > 0) {
        responseHeaders.delete('set-cookie');
        cookies.forEach(cookie => {
          // حذف محدودیت‌های domain و secure برای کار آسان‌تر
          let modifiedCookie = cookie
            .replace(/;\s*domain=[^;]+/gi, '')
            .replace(/;\s*secure/gi, '');
          responseHeaders.append('set-cookie', modifiedCookie);
        });
      }
      
      // بازنویسی محتوا برای HTMLها و CSSها
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('text/html')) {
        let html = await response.text();
        html = rewriteHTML(html, fullUrl, url.origin);
        return new Response(html, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders
        });
      } else if (contentType.includes('text/css')) {
        let css = await response.text();
        css = rewriteCSS(css, fullUrl, url.origin);
        return new Response(css, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders
        });
      } else if (contentType.includes('javascript') || contentType.includes('json')) {
        // برای جاوااسکریپت فعلا بدون تغییر برمی‌گردانیم
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders
        });
      }
      
      // برای محتواهای دیگر (تصاویر، ویدیوها و ...) بدون تغییر
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });
      
    } catch (error) {
      return new Response(`خطا: ${error.message}`, { 
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
  }
};

// بازنویسی HTML
function rewriteHTML(html, originalUrl, proxyOrigin) {
  const baseUrl = new URL(originalUrl);
  const baseOrigin = baseUrl.origin;
  
  // بازنویسی لینک‌های مطلق
  html = html.replace(
    /href="https?:\/\/([^"]+)"/gi,
    (match, url) => `href="${proxyOrigin}/?url=${encodeURIComponent('https://' + url)}"`
  );
  
  html = html.replace(
    /href='https?:\/\/([^']+)'/gi,
    (match, url) => `href='${proxyOrigin}/?url=${encodeURIComponent('https://' + url)}'`
  );
  
  // بازنویسی لینک‌های نسبی
  html = html.replace(
    /href="\/([^"]+)"/gi,
    (match, path) => `href="${proxyOrigin}/?url=${encodeURIComponent(baseOrigin + '/' + path)}"`
  );
  
  html = html.replace(
    /href='\/([^']+)'/gi,
    (match, path) => `href='${proxyOrigin}/?url=${encodeURIComponent(baseOrigin + '/' + path)}'`
  );
  
  // بازنویسی src برای تصاویر، اسکریپت‌ها و ...
  html = html.replace(
    /src="https?:\/\/([^"]+)"/gi,
    (match, url) => `src="${proxyOrigin}/?url=${encodeURIComponent('https://' + url)}"`
  );
  
  html = html.replace(
    /src='https?:\/\/([^']+)'/gi,
    (match, url) => `src='${proxyOrigin}/?url=${encodeURIComponent('https://' + url)}'`
  );
  
  html = html.replace(
    /src="\/([^"]+)"/gi,
    (match, path) => `src="${proxyOrigin}/?url=${encodeURIComponent(baseOrigin + '/' + path)}"`
  );
  
  html = html.replace(
    /src='\/([^']+)'/gi,
    (match, path) => `src='${proxyOrigin}/?url=${encodeURIComponent(baseOrigin + '/' + path)}'`
  );
  
  // بازنویسی action برای فرم‌ها
  html = html.replace(
    /action="https?:\/\/([^"]+)"/gi,
    (match, url) => `action="${proxyOrigin}/?url=${encodeURIComponent('https://' + url)}"`
  );
  
  html = html.replace(
    /action="\/([^"]+)"/gi, 
    (match, path) => `action="${proxyOrigin}/?url=${encodeURIComponent(baseOrigin + '/' + path)}"`
  );
  
  // اضافه کردن base tag
  if (!html.includes('<base')) {
    html = html.replace(
      /<head([^>]*)>/i,
      `<head$1>\n  <base href="${proxyOrigin}/?url=${encodeURIComponent(baseOrigin + '/')}">`
    );
  }
  
  return html;
}

// بازنویسی CSS
function rewriteCSS(css, originalUrl, proxyOrigin) {
  const baseUrl = new URL(originalUrl);
  const baseOrigin = baseUrl.origin;
  
  // بازنویسی url() در CSS
  css = css.replace(
    /url\(['"]?https?:\/\/([^'")\s]+)['"]?\)/gi,
    (match, url) => `url("${proxyOrigin}/?url=${encodeURIComponent('https://' + url)}")`
  );
  
  css = css.replace(
    /url\(['"]?\/([^'")\s]+)['"]?\)/gi,
    (match, path) => `url("${proxyOrigin}/?url=${encodeURIComponent(baseOrigin + '/' + path)}")`
  );
  
  return css;
}

// صفحه اصلی
function getHomePage() {
  return `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>وب پراکسی</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    
    .container {
      background: white;
      padding: 40px;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 600px;
      width: 100%;
    }
    
    h1 {
      color: #667eea;
      margin-bottom: 10px;
      font-size: 2.5em;
      text-align: center;
    }
    
    .subtitle {
      text-align: center;
      color: #666;
      margin-bottom: 30px;
      font-size: 1.1em;
    }
    
    .input-group {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }
    
    input[type="text"] {
      flex: 1;
      padding: 15px 20px;
      border: 2px solid #e0e0e0;
      border-radius: 10px;
      font-size: 16px;
      transition: all 0.3s;
      direction: ltr;
      text-align: left;
    }
    
    input[type="text"]:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
    
    button {
      padding: 15px 30px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: transform 0.2s;
      white-space: nowrap;
    }
    
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
    }
    
    button:active {
      transform: translateY(0);
    }
    
    .quick-links {
      margin-top: 20px;
    }
    
    .quick-links h3 {
      color: #333;
      margin-bottom: 15px;
      font-size: 1.2em;
    }
    
    .links {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px;
    }
    
    .link-btn {
      padding: 12px 20px;
      background: #f5f5f5;
      color: #333;
      text-decoration: none;
      border-radius: 8px;
      text-align: center;
      transition: all 0.3s;
      display: block;
    }
    
    .link-btn:hover {
      background: #667eea;
      color: white;
      transform: translateY(-2px);
    }
    
    .info {
      margin-top: 30px;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 10px;
      border-right: 4px solid #667eea;
    }
    
    .info h3 {
      color: #667eea;
      margin-bottom: 10px;
    }
    
    .info ul {
      margin-right: 20px;
      color: #666;
      line-height: 1.8;
    }
    
    @media (max-width: 600px) {
      .container {
        padding: 25px;
      }
      
      h1 {
        font-size: 2em;
      }
      
      .input-group {
        flex-direction: column;
      }
      
      button {
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🌐 وب پراکسی</h1>
    <p class="subtitle">به هر سایتی دسترسی داشته باشید</p>
    
    <form action="/" method="GET">
      <div class="input-group">
        <input 
          type="text" 
          name="url" 
          placeholder="آدرس وب‌سایت را وارد کنید (مثال: youtube.com)" 
          required
          autocomplete="off"
        >
        <button type="submit">برو</button>
      </div>
    </form>
    
    <div class="quick-links">
      <h3>دسترسی سریع:</h3>
      <div class="links">
        <a href="/?url=youtube.com" class="link-btn">🎬 YouTube</a>
        <a href="/?url=twitter.com" class="link-btn">🐦 Twitter</a>
        <a href="/?url=instagram.com" class="link-btn">📸 Instagram</a>
        <a href="/?url=facebook.com" class="link-btn">👥 Facebook</a>
        <a href="/?url=reddit.com" class="link-btn">🔥 Reddit</a>
        <a href="/?url=wikipedia.org" class="link-btn">📚 Wikipedia</a>
      </div>
    </div>
    
    <div class="info">
      <h3>ویژگی‌ها:</h3>
      <ul>
        <li>✅ دسترسی به تمام وب‌سایت‌ها از جمله یوتیوب</li>
        <li>✅ پشتیبانی کامل از کوکی‌ها و session</li>
        <li>✅ بدون نیاز به نصب هیچ برنامه‌ای</li>
        <li>✅ سریع و امن</li>
      </ul>
    </div>
  </div>
  
  <script>
    // Focus on input field when page loads
    document.querySelector('input[name="url"]').focus();
  </script>
</body>
</html>`;
}
