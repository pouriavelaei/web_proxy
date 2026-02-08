// Web Proxy Worker for Cloudflare

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }
    
    // صفحه اصلی
    if (url.pathname === '/' && !url.searchParams.has('url')) {
      return new Response(getHomePage(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
    
    // استخراج URL مقصد
    let targetUrl = url.searchParams.get('url');
    
    if (!targetUrl) {
      return new Response(getErrorPage('لطفا URL را وارد کنید'), { 
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
    
    // چک کردن اگر URL دوبار encode شده (مثلاً از یک پراکسی دیگه)
    // اگر خود URL یک پراکسیه، URL واقعی رو استخراج کن
    if (targetUrl.includes(url.origin + '/?url=')) {
      const match = targetUrl.match(/\?url=([^&]+)/);
      if (match) {
        targetUrl = decodeURIComponent(match[1]);
      }
    }
    
    try {
      // اضافه کردن https اگر نداره
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
      }
      
      const targetUrlObj = new URL(targetUrl);
      const targetBase = targetUrlObj.origin;
      
      // ساخت هدرها
      const proxyHeaders = new Headers();
      
      // کپی هدرهای ضروری از request اصلی
      const headersToKeep = [
        'accept', 'accept-encoding', 'accept-language', 
        'cache-control', 'range', 'if-none-match', 'if-modified-since',
        'upgrade-insecure-requests', 'sec-fetch-dest', 'sec-fetch-mode', 
        'sec-fetch-site', 'sec-fetch-user'
      ];
      
      for (const [key, value] of request.headers.entries()) {
        if (headersToKeep.includes(key.toLowerCase())) {
          proxyHeaders.set(key, value);
        }
      }
      
      // Forward cookies
      const cookieHeader = request.headers.get('cookie');
      if (cookieHeader) {
        proxyHeaders.set('Cookie', cookieHeader);
      }
      
      // هدرهای اختصاصی - شبیه‌سازی یک مرورگر واقعی
      proxyHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
      proxyHeaders.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7');
      proxyHeaders.set('Accept-Language', 'en-US,en;q=0.9,fa;q=0.8');
      proxyHeaders.set('Accept-Encoding', 'gzip, deflate, br');
      proxyHeaders.set('Referer', targetUrlObj.origin + '/');
      proxyHeaders.set('Origin', targetUrlObj.origin);
      proxyHeaders.set('DNT', '1');
      proxyHeaders.set('Connection', 'keep-alive');
      proxyHeaders.set('Upgrade-Insecure-Requests', '1');
      proxyHeaders.set('Sec-Fetch-Dest', 'document');
      proxyHeaders.set('Sec-Fetch-Mode', 'navigate');
      proxyHeaders.set('Sec-Fetch-Site', 'none');
      proxyHeaders.set('Sec-Fetch-User', '?1');
      proxyHeaders.set('Sec-Ch-Ua', '"Not_A Brand";v="8", "Chromium";v="131", "Google Chrome";v="131"');
      proxyHeaders.set('Sec-Ch-Ua-Mobile', '?0');
      proxyHeaders.set('Sec-Ch-Ua-Platform', '"Windows"');
      
      // فچ کردن محتوا
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: proxyHeaders,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
        redirect: 'follow',
        cf: {
          cacheEverything: false,
          cacheTtl: 0
        }
      });
      
      // چک کردن Cloudflare challenge
      if (response.status === 403 || response.status === 503) {
        const text = await response.text();
        if (text.includes('cloudflare') || text.includes('Cloudflare') || text.includes('Ray ID')) {
          return new Response(getCloudflareBlockPage(targetUrl), {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        }
        // اگر Cloudflare challenge نبود، محتوا رو بفرست
        return new Response(text, {
          status: response.status,
          headers: response.headers
        });
      }
      
      // ساخت هدرهای پاسخ
      const responseHeaders = new Headers(response.headers);
      
      // حذف هدرهای مشکل‌ساز
      const headersToRemove = [
        'content-security-policy', 'x-frame-options', 'content-security-policy-report-only',
        'strict-transport-security', 'x-content-type-options', 'clear-site-data'
      ];
      headersToRemove.forEach(h => responseHeaders.delete(h));
      
      // CORS headers
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', '*');
      responseHeaders.set('Access-Control-Allow-Headers', '*');
      responseHeaders.set('Access-Control-Expose-Headers', '*');
      
      // مدیریت کوکی‌ها
      const setCookies = [];
      for (const [key, value] of response.headers.entries()) {
        if (key.toLowerCase() === 'set-cookie') {
          const modified = value
            .replace(/;\s*domain=[^;]+/gi, '')
            .replace(/;\s*secure\s*(?=;|$)/gi, '')
            .replace(/;\s*samesite=[^;]+/gi, '; SameSite=None; Secure');
          setCookies.push(modified);
        }
      }
      
      responseHeaders.delete('set-cookie');
      setCookies.forEach(cookie => responseHeaders.append('Set-Cookie', cookie));
      
      // پردازش محتوا
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('text/html')) {
        let html = await response.text();
        html = rewriteHTML(html, targetUrl, url.origin, targetBase);
        return new Response(html, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders
        });
      }
      
      if (contentType.includes('css')) {
        let css = await response.text();
        css = rewriteCSS(css, targetUrl, url.origin, targetBase);
        return new Response(css, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders
        });
      }
      
      if (contentType.includes('javascript')) {
        let js = await response.text();
        js = rewriteJS(js, targetUrl, url.origin, targetBase);
        return new Response(js, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders
        });
      }
      
      // سایر فایل‌ها
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });
      
    } catch (error) {
      return new Response(getErrorPage(error.message), { 
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
  }
};

function handleOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    }
  });
}

// بازنویسی HTML
function rewriteHTML(html, originalUrl, proxyOrigin, targetBase) {
  const baseUrl = new URL(originalUrl);
  
  const proxyUrl = (url) => {
    try {
      if (!url || url.trim() === '' || url.startsWith('data:') || 
          url.startsWith('blob:') || url.startsWith('javascript:') || 
          url.startsWith('about:') || url === '#' || url.startsWith('mailto:') ||
          url.startsWith('tel:')) {
        return url;
      }
      
      // اگر قبلاً پراکسی شده، برگردون
      if (url.includes(proxyOrigin + '/?url=')) {
        return url;
      }
      
      let absoluteUrl;
      if (url.startsWith('http://') || url.startsWith('https://')) {
        absoluteUrl = url;
      } else if (url.startsWith('//')) {
        absoluteUrl = 'https:' + url;
      } else if (url.startsWith('/')) {
        absoluteUrl = targetBase + url;
      } else if (url.startsWith('?')) {
        // Query string - حفظ path فعلی
        const currentPath = baseUrl.pathname;
        absoluteUrl = targetBase + currentPath + url;
      } else if (url.startsWith('#')) {
        // Hash فقط - return as is
        return url;
      } else {
        // Relative URL
        absoluteUrl = new URL(url, originalUrl).href;
      }
      
      return `${proxyOrigin}/?url=${encodeURIComponent(absoluteUrl)}`;
    } catch (e) {
      console.warn('Failed to proxy URL:', url, e);
      return url;
    }
  };
  
  // بازنویسی تمام attributeها با دقت بیشتر
  // href attribute
  html = html.replace(/<a\s+([^>]*\s)?href\s*=\s*["']([^"']+)["']/gi, (match, before, url) => {
    const proxied = proxyUrl(url);
    return `<a ${before || ''}href="${proxied}"`;
  });
  
  // src attribute
  html = html.replace(/<(img|script|iframe|embed|source|video|audio)\s+([^>]*\s)?src\s*=\s*["']([^"']+)["']/gi, (match, tag, before, url) => {
    const proxied = proxyUrl(url);
    return `<${tag} ${before || ''}src="${proxied}"`;
  });
  
  // action attribute برای فرم‌ها
  html = html.replace(/<form\s+([^>]*\s)?action\s*=\s*["']([^"']+)["']/gi, (match, before, url) => {
    const proxied = proxyUrl(url);
    return `<form ${before || ''}action="${proxied}"`;
  });
  
  // data و poster attributes
  html = html.replace(/\b(data|poster)\s*=\s*["']([^"']+)["']/gi, (match, attr, url) => {
    // فقط اگر شبیه URL بود
    if (url.startsWith('http') || url.startsWith('/') || url.startsWith('//')) {
      return `${attr}="${proxyUrl(url)}"`;
    }
    return match;
  });
  
  // بازنویسی srcset
  html = html.replace(/\bsrcset\s*=\s*["']([^"']+)["']/gi, (match, srcset) => {
    const newSrcset = srcset.split(',').map(item => {
      const parts = item.trim().split(/\s+/);
      parts[0] = proxyUrl(parts[0]);
      return parts.join(' ');
    }).join(', ');
    return `srcset="${newSrcset}"`;
  });
  
  // بازنویسی inline styles با url()
  html = html.replace(/style\s*=\s*["']([^"']*url\([^"']*\)[^"']*)["']/gi, (match, style) => {
    const newStyle = style.replace(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi, (m, url) => {
      return `url("${proxyUrl(url.trim())}")`;
    });
    return `style="${newStyle}"`;
  });
  
  // اضافه کردن base tag برای relative URLs (اگر نداره)
  if (!html.match(/<base[^>]+>/i)) {
    const baseTag = `<base href="${proxyOrigin}/?url=${encodeURIComponent(targetBase + '/')}">`;
    if (html.match(/<head[^>]*>/i)) {
      html = html.replace(/<head([^>]*)>/i, `<head$1>\n  ${baseTag}`);
    }
  }
  
  // اضافه کردن اسکریپت proxy
  const script = `
  <script>
  (function() {
    const PROXY_ORIGIN = '${proxyOrigin}';
    const TARGET_BASE = '${targetBase}';
    const CURRENT_URL = '${originalUrl}';
    
    // تابع کمکی برای پراکسی کردن URL
    function proxyUrl(url) {
      if (!url || typeof url !== 'string') return url;
      
      // فیلتر کردن URLهای خاص
      if (url.startsWith('data:') || url.startsWith('blob:') || 
          url.startsWith('javascript:') || url.startsWith('about:') ||
          url === '#' || url.startsWith('mailto:') || url.startsWith('tel:')) {
        return url;
      }
      
      // اگر قبلاً پراکسی شده، برگردون
      if (url.includes(PROXY_ORIGIN + '/?url=')) {
        return url;
      }
      
      try {
        let absoluteUrl;
        
        if (url.startsWith('http://') || url.startsWith('https://')) {
          // URL کامل
          absoluteUrl = url;
        } else if (url.startsWith('//')) {
          // Protocol-relative URL
          absoluteUrl = 'https:' + url;
        } else if (url.startsWith('/')) {
          // Absolute path
          absoluteUrl = TARGET_BASE + url;
        } else if (url.startsWith('?') || url.startsWith('#')) {
          // Query یا hash - نسبت به URL فعلی
          absoluteUrl = CURRENT_URL.split('?')[0].split('#')[0] + url;
        } else {
          // Relative URL
          const currentUrlObj = new URL(CURRENT_URL);
          const basePath = currentUrlObj.pathname.substring(0, currentUrlObj.pathname.lastIndexOf('/') + 1);
          absoluteUrl = currentUrlObj.origin + basePath + url;
        }
        
        return PROXY_ORIGIN + '/?url=' + encodeURIComponent(absoluteUrl);
      } catch (e) {
        console.warn('Failed to proxy URL:', url, e);
        return url;
      }
    }
    
    // Override fetch
    const originalFetch = window.fetch;
    window.fetch = function(url, opts) {
      try {
        if (typeof url === 'string') {
          url = proxyUrl(url);
        } else if (url && url.url) {
          url.url = proxyUrl(url.url);
        }
      } catch (e) {
        console.error('Fetch override error:', e);
      }
      return originalFetch(url, opts);
    };
    
    // Override XMLHttpRequest
    const XHR = XMLHttpRequest.prototype;
    const origOpen = XHR.open;
    XHR.open = function(method, url, ...args) {
      try {
        if (typeof url === 'string') {
          url = proxyUrl(url);
        }
      } catch (e) {
        console.error('XHR override error:', e);
      }
      return origOpen.call(this, method, url, ...args);
    };
    
    // Override window.open
    const origWindowOpen = window.open;
    window.open = function(url, ...args) {
      try {
        if (url && typeof url === 'string') {
          url = proxyUrl(url);
        }
      } catch (e) {
        console.error('window.open override error:', e);
      }
      return origWindowOpen.call(this, url, ...args);
    };
    
    // Override form submission
    document.addEventListener('submit', function(e) {
      try {
        const form = e.target;
        if (form && form.action) {
          const newAction = proxyUrl(form.action);
          form.setAttribute('action', newAction);
        }
      } catch (e) {
        console.error('Form submit override error:', e);
      }
    }, true);
    
    // Override history API
    const origPushState = history.pushState;
    const origReplaceState = history.replaceState;
    
    history.pushState = function(state, title, url) {
      try {
        if (url && typeof url === 'string' && !url.startsWith('#')) {
          url = proxyUrl(url);
        }
      } catch (e) {
        console.error('pushState override error:', e);
      }
      return origPushState.call(this, state, title, url);
    };
    
    history.replaceState = function(state, title, url) {
      try {
        if (url && typeof url === 'string' && !url.startsWith('#')) {
          url = proxyUrl(url);
        }
      } catch (e) {
        console.error('replaceState override error:', e);
      }
      return origReplaceState.call(this, state, title, url);
    };
    
    // Override anchor clicks برای safety
    document.addEventListener('click', function(e) {
      try {
        let target = e.target;
        // پیدا کردن نزدیکترین anchor tag
        while (target && target.tagName !== 'A') {
          target = target.parentElement;
        }
        
        if (target && target.tagName === 'A') {
          const href = target.getAttribute('href');
          
          // اگر href نداره یا special URL هست، بذار به حال خودش
          if (!href || href === '#' || href.startsWith('javascript:') || 
              href.startsWith('mailto:') || href.startsWith('tel:')) {
            return;
          }
          
          // اگر قبلاً پراکسی شده، بذار به حال خودش
          if (href.includes(PROXY_ORIGIN + '/?url=')) {
            return;
          }
          
          // پراکسی کردن URL
          e.preventDefault();
          e.stopPropagation();
          
          const proxiedUrl = proxyUrl(href);
          
          // چک کردن target attribute
          if (target.target === '_blank' || target.target === '_new') {
            window.open(proxiedUrl, target.target);
          } else {
            window.location.href = proxiedUrl;
          }
        }
      } catch (err) {
        console.error('Click handler error:', err);
        // اگر خطا داشت، بذار navigation عادی اتفاق بیفته
      }
    }, true);
  })();
  </script>`;
  
  if (html.match(/<\/head>/i)) {
    html = html.replace(/<\/head>/i, script + '</head>');
  } else if (html.match(/<body[^>]*>/i)) {
    html = html.replace(/<body([^>]*)>/i, '<body$1>' + script);
  } else {
    html = script + html;
  }
  
  return html;
}

// بازنویسی CSS  
function rewriteCSS(css, originalUrl, proxyOrigin, targetBase) {
  const baseUrl = new URL(originalUrl);
  
  const proxyUrl = (url) => {
    try {
      if (!url || url.trim() === '' || url.startsWith('data:') || url.startsWith('blob:')) {
        return url;
      }
      
      url = url.trim();
      let absoluteUrl;
      
      if (url.startsWith('http://') || url.startsWith('https://')) {
        absoluteUrl = url;
      } else if (url.startsWith('//')) {
        absoluteUrl = 'https:' + url;
      } else if (url.startsWith('/')) {
        absoluteUrl = targetBase + url;
      } else {
        absoluteUrl = new URL(url, originalUrl).href;
      }
      
      return `${proxyOrigin}/?url=${encodeURIComponent(absoluteUrl)}`;
    } catch {
      return url;
    }
  };
  
  // بازنویسی url()
  css = css.replace(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi, (match, url) => {
    return `url("${proxyUrl(url)}")`;
  });
  
  // بازنویسی @import
  css = css.replace(/@import\s+(['"])([^'"]+)\1/gi, (match, quote, url) => {
    return `@import ${quote}${proxyUrl(url)}${quote}`;
  });
  
  return css;
}

// بازنویسی JavaScript
function rewriteJS(js, originalUrl, proxyOrigin, targetBase) {
  // فعلاً JS رو بدون تغییر برمیگردونیم چون ممکنه کد خراب بشه
  return js;
}

// صفحه خطا برای Cloudflare Block
function getCloudflareBlockPage(targetUrl) {
  return `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>محدودیت دسترسی - وب پراکسی</title>
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
      text-align: center;
    }
    .icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    h1 {
      color: #f39c12;
      margin-bottom: 20px;
    }
    p {
      color: #666;
      margin-bottom: 15px;
      line-height: 1.8;
    }
    .url {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      margin: 20px 0;
      word-break: break-all;
      font-family: monospace;
      direction: ltr;
      text-align: left;
    }
    .solutions {
      text-align: right;
      margin: 25px 0;
      padding: 20px;
      background: #fff3cd;
      border-radius: 10px;
      border-right: 4px solid #f39c12;
    }
    .solutions h3 {
      color: #856404;
      margin-bottom: 15px;
    }
    .solutions ul {
      margin-right: 20px;
      color: #856404;
    }
    .solutions li {
      margin: 10px 0;
    }
    .btn {
      display: inline-block;
      margin-top: 20px;
      padding: 15px 40px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      border-radius: 10px;
      font-weight: bold;
      transition: transform 0.2s;
    }
    .btn:hover {
      transform: translateY(-2px);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">🛡️</div>
    <h1>سایت محافظت شده است</h1>
    <p>این سایت از Cloudflare Protection استفاده می‌کنه و الان پراکسی‌ها رو block می‌کنه.</p>
    
    <div class="url">${targetUrl}</div>
    
    <div class="solutions">
      <h3>راه‌حل‌های پیشنهادی:</h3>
      <ul>
        <li>✅ از VPN استفاده کنید</li>
        <li>✅ مستقیماً به سایت برید (اگر دسترسی دارید)</li>
        <li>✅ بعداً دوباره امتحان کنید</li>
        <li>✅ سایت دیگری رو امتحان کنید</li>
      </ul>
    </div>
    
    <p style="color: #999; font-size: 0.9em;">
      💡 بعضی سایت‌ها مثل Kick.com از سیستم‌های امنیتی قوی استفاده می‌کنن که پراکسی‌ها رو تشخیص میدن.
    </p>
    
    <a href="/" class="btn">← بازگشت به صفحه اصلی</a>
  </div>
</body>
</html>`;
}

// صفحه خطا
function getErrorPage(message) {
  return `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>خطا - وب پراکسی</title>
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
      text-align: center;
    }
    .error-icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    h1 {
      color: #e74c3c;
      margin-bottom: 20px;
    }
    p {
      color: #666;
      margin-bottom: 30px;
      line-height: 1.6;
    }
    .btn {
      display: inline-block;
      padding: 15px 40px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      border-radius: 10px;
      font-weight: bold;
      transition: transform 0.2s;
    }
    .btn:hover {
      transform: translateY(-2px);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-icon">⚠️</div>
    <h1>خطا در بارگذاری</h1>
    <p>${message}</p>
    <a href="/" class="btn">← بازگشت به صفحه اصلی</a>
  </div>
</body>
</html>`;
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
        <a href="/?url=https://www.youtube.com" class="link-btn">🎬 YouTube</a>
        <a href="/?url=https://twitter.com" class="link-btn">🐦 Twitter</a>
        <a href="/?url=https://www.instagram.com" class="link-btn">📸 Instagram</a>
        <a href="/?url=https://www.tiktok.com" class="link-btn">🎵 TikTok</a>
        <a href="/?url=https://www.reddit.com" class="link-btn">🔥 Reddit</a>
        <a href="/?url=https://wikipedia.org" class="link-btn">📚 Wikipedia</a>
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
      <p style="margin-top: 15px; font-size: 0.9em; color: #999;">
        ⚠️ توجه: بعضی سایت‌ها مثل Kick.com از محافظت Cloudflare استفاده می‌کنن و ممکنه پراکسی کار نکنه.
      </p>
    </div>
  </div>
  
  <script>
    // Focus on input field when page loads
    document.querySelector('input[name="url"]').focus();
    
    // Form already submits with GET method to /?url=...
    // So we just need to make sure the URL is properly formatted
    document.querySelector('form').addEventListener('submit', function(e) {
      let url = document.querySelector('input[name="url"]').value.trim();
      
      if (!url) {
        e.preventDefault();
        return;
      }
      
      // اضافه کردن https اگر نداره
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        e.preventDefault();
        url = 'https://' + url;
        window.location.href = '/?url=' + encodeURIComponent(url);
      }
      // اگر URL درست بود، form رو بذار submit بشه
    });
  </script>
</body>
</html>`;
}
