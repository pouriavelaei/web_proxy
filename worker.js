// Cloudflare Worker Web Proxy
// بدون مشکل CAPTCHA و کوکی

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // صفحه اصلی پراکسی
  if (url.pathname === '/') {
    return new Response(getHomePage(), {
      headers: {
        'content-type': 'text/html;charset=UTF-8',
      },
    })
  }
  
  // پردازش درخواست پراکسی
  if (url.pathname.startsWith('/proxy/')) {
    const targetUrl = url.pathname.replace('/proxy/', '')
    
    if (!targetUrl) {
      return new Response('لطفا URL را وارد کنید', { status: 400 })
    }
    
    try {
      // ساخت URL کامل
      let fullUrl = targetUrl
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        fullUrl = 'https://' + targetUrl
      }
      
      // هدرهای سفارشی برای جلوگیری از تشخیص به عنوان بات
      const proxyHeaders = new Headers()
      proxyHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
      proxyHeaders.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8')
      proxyHeaders.set('Accept-Language', 'en-US,en;q=0.9,fa;q=0.8')
      proxyHeaders.set('Accept-Encoding', 'gzip, deflate, br')
      proxyHeaders.set('DNT', '1')
      proxyHeaders.set('Connection', 'keep-alive')
      proxyHeaders.set('Upgrade-Insecure-Requests', '1')
      proxyHeaders.set('Sec-Fetch-Dest', 'document')
      proxyHeaders.set('Sec-Fetch-Mode', 'navigate')
      proxyHeaders.set('Sec-Fetch-Site', 'none')
      proxyHeaders.set('Cache-Control', 'max-age=0')
      
      // درخواست به سایت مقصد
      const response = await fetch(fullUrl, {
        method: request.method,
        headers: proxyHeaders,
        redirect: 'follow'
      })
      
      // کپی هدرها
      const responseHeaders = new Headers(response.headers)
      
      // حذف هدرهای مشکل‌ساز
      responseHeaders.delete('content-security-policy')
      responseHeaders.delete('x-frame-options')
      responseHeaders.delete('set-cookie')
      
      // اضافه کردن CORS
      responseHeaders.set('Access-Control-Allow-Origin', '*')
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      responseHeaders.set('Access-Control-Allow-Headers', '*')
      
      const contentType = response.headers.get('content-type') || ''
      
      // اگر HTML است، لینک‌ها و منابع را تغییر بده
      if (contentType.includes('text/html')) {
        let body = await response.text()
        const baseUrl = new URL(fullUrl)
        
        // تبدیل لینک‌های نسبی به مطلق
        body = body.replace(
          /href=["'](?!http|\/\/|#|javascript:)(.*?)["']/gi,
          `href="/proxy/${baseUrl.origin}/$1"`
        )
        body = body.replace(
          /src=["'](?!http|\/\/|data:)(.*?)["']/gi,
          `src="/proxy/${baseUrl.origin}/$1"`
        )
        body = body.replace(
          /href=["'](https?:\/\/.*?)["']/gi,
          `href="/proxy/$1"`
        )
        body = body.replace(
          /src=["'](https?:\/\/.*?)["']/gi,
          `src="/proxy/$1"`
        )
        
        return new Response(body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders
        })
      }
      
      // برای فایل‌های دیگر، مستقیم برگردان
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      })
      
    } catch (error) {
      return new Response('خطا در دریافت صفحه: ' + error.message, { status: 500 })
    }
  }
  
  return new Response('آدرس نامعتبر', { status: 404 })
}

function getHomePage() {
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>وب پراکسی رایگان</title>
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
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        
        .container {
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 600px;
            width: 100%;
        }
        
        h1 {
            color: #667eea;
            margin-bottom: 10px;
            font-size: 2em;
        }
        
        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 0.9em;
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
            transition: border-color 0.3s;
        }
        
        input[type="text"]:focus {
            outline: none;
            border-color: #667eea;
        }
        
        button {
            padding: 15px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            cursor: pointer;
            transition: transform 0.2s;
            font-weight: bold;
        }
        
        button:hover {
            transform: translateY(-2px);
        }
        
        button:active {
            transform: translateY(0);
        }
        
        .features {
            margin-top: 30px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 10px;
        }
        
        .features h3 {
            color: #333;
            margin-bottom: 15px;
            font-size: 1.2em;
        }
        
        .features ul {
            list-style: none;
        }
        
        .features li {
            padding: 8px 0;
            color: #555;
            position: relative;
            padding-right: 25px;
        }
        
        .features li:before {
            content: "✓";
            position: absolute;
            right: 0;
            color: #667eea;
            font-weight: bold;
        }
        
        .warning {
            margin-top: 20px;
            padding: 15px;
            background: #fff3cd;
            border-radius: 10px;
            border-right: 4px solid #ffc107;
            font-size: 0.9em;
            color: #856404;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🌐 وب پراکسی رایگان</h1>
        <p class="subtitle">دسترسی آزاد به وب سایت‌ها بدون محدودیت</p>
        
        <form id="proxyForm">
            <div class="input-group">
                <input 
                    type="text" 
                    id="urlInput" 
                    placeholder="آدرس سایت را وارد کنید (مثال: google.com)"
                    required
                />
                <button type="submit">باز کن</button>
            </div>
        </form>
        
        <div class="features">
            <h3>ویژگی‌ها:</h3>
            <ul>
                <li>بدون نیاز به تایید کپچا</li>
                <li>بدون ذخیره کوکی</li>
                <li>رایگان و نامحدود</li>
                <li>سرعت بالا با Cloudflare</li>
                <li>حفظ حریم خصوصی</li>
            </ul>
        </div>
        
        <div class="warning">
            ⚠️ توجه: این پراکسی فقط برای استفاده شخصی و قانونی است. از آن برای فعالیت‌های غیرقانونی استفاده نکنید.
        </div>
    </div>
    
    <script>
        document.getElementById('proxyForm').addEventListener('submit', function(e) {
            e.preventDefault()
            const url = document.getElementById('urlInput').value.trim()
            if (url) {
                // حذف http:// یا https:// اگر وارد شده
                const cleanUrl = url.replace(/^https?:\/\//, '')
                window.location.href = '/proxy/' + cleanUrl
            }
        })
    </script>
</body>
</html>`
}