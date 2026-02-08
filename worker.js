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
      targetUrl = url.searchParams.get("url");
    } else {
      // مسیر به صورت /https://example.com/path
      const pathUrl = url.pathname.slice(1) + url.search;
      if (pathUrl.startsWith("http://") || pathUrl.startsWith("https://")) {
        targetUrl = pathUrl;
      } else {
        return new Response(getHomePage(), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
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
  <title>وب پراکسی</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Tahoma, Arial, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    .container {
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      padding: 40px;
      max-width: 500px;
      width: 90%;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    }
    h1 { margin-bottom: 10px; font-size: 2em; }
    p { color: #aaa; margin-bottom: 30px; }
    .input-group {
      display: flex;
      gap: 10px;
      flex-direction: column;
    }
    input[type="url"] {
      width: 100%;
      padding: 15px 20px;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      background: rgba(255,255,255,0.9);
      color: #333;
      direction: ltr;
    }
    input[type="url"]:focus {
      outline: 2px solid #4facfe;
    }
    button {
      padding: 15px 30px;
      border: none;
      border-radius: 10px;
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
      color: #fff;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: transform 0.2s;
    }
    button:hover { transform: scale(1.02); }
    .examples {
      margin-top: 30px;
      text-align: right;
    }
    .examples h3 { margin-bottom: 10px; font-size: 14px; color: #888; }
    .examples a {
      display: inline-block;
      margin: 5px;
      padding: 8px 15px;
      background: rgba(255,255,255,0.1);
      border-radius: 20px;
      color: #4facfe;
      text-decoration: none;
      font-size: 13px;
    }
    .examples a:hover { background: rgba(255,255,255,0.2); }
  </style>
</head>
<body>
  <div class="container">
    <h1>🌐 وب پراکسی</h1>
    <p>آدرس سایت مورد نظر را وارد کنید</p>
    <form action="/" method="GET">
      <div class="input-group">
        <input type="url" name="url" placeholder="https://example.com" required>
        <button type="submit">باز کردن سایت</button>
      </div>
    </form>
    <div class="examples">
      <h3>نمونه‌ها:</h3>
      <a href="/?url=https://www.google.com">Google</a>
      <a href="/?url=https://www.wikipedia.org">Wikipedia</a>
      <a href="/?url=https://www.github.com">GitHub</a>
    </div>
  </div>
</body>
</html>`;
}

function getErrorPage(message) {
  return `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="UTF-8">
  <title>خطا</title>
  <style>
    body {
      font-family: Tahoma, Arial, sans-serif;
      background: #1a1a2e;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
    }
    .error {
      background: rgba(255,0,0,0.2);
      padding: 40px;
      border-radius: 20px;
    }
    a { color: #4facfe; }
  </style>
</head>
<body>
  <div class="error">
    <h1>❌ خطا</h1>
    <p>${message}</p>
    <p><a href="/">بازگشت به صفحه اصلی</a></p>
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
