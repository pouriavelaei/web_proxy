const TARGET_URL = "https://www.google.com";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    // Build target URL
    const targetUrl = new URL(TARGET_URL);
    targetUrl.pathname = url.pathname;
    targetUrl.search = url.search;
    
    // Clone request headers
    const headers = new Headers(request.headers);
    headers.set("Host", targetUrl.host);
    headers.delete("cf-connecting-ip");
    headers.delete("cf-ipcountry");
    headers.delete("cf-ray");
    headers.delete("cf-visitor");
    
    // Fetch from target
    const response = await fetch(targetUrl.toString(), {
      method: request.method,
      headers: headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
      redirect: "manual",
    });
    
    // Handle redirects
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("Location");
      if (location) {
        const newLocation = rewriteUrl(location, url.origin, TARGET_URL);
        const newHeaders = new Headers(response.headers);
        newHeaders.set("Location", newLocation);
        return new Response(null, {
          status: response.status,
          headers: newHeaders,
        });
      }
    }
    
    const contentType = response.headers.get("Content-Type") || "";
    
    // Rewrite HTML content
    if (contentType.includes("text/html")) {
      let html = await response.text();
      html = rewriteHtml(html, url.origin, TARGET_URL);
      
      const newHeaders = new Headers(response.headers);
      newHeaders.delete("content-encoding");
      newHeaders.delete("content-length");
      newHeaders.set("Access-Control-Allow-Origin", "*");
      
      return new Response(html, {
        status: response.status,
        headers: newHeaders,
      });
    }
    
    // Pass through other content
    const newHeaders = new Headers(response.headers);
    newHeaders.set("Access-Control-Allow-Origin", "*");
    
    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  },
};

function rewriteUrl(urlStr, proxyOrigin, targetOrigin) {
  try {
    const targetUrl = new URL(targetOrigin);
    if (urlStr.startsWith(targetOrigin)) {
      return urlStr.replace(targetOrigin, proxyOrigin);
    }
    if (urlStr.startsWith("https://" + targetUrl.host) || urlStr.startsWith("http://" + targetUrl.host)) {
      return urlStr.replace(new RegExp("https?://" + targetUrl.host), proxyOrigin);
    }
    if (urlStr.startsWith("/")) {
      return urlStr; // Relative URLs stay relative
    }
    return urlStr;
  } catch {
    return urlStr;
  }
}

function rewriteHtml(html, proxyOrigin, targetOrigin) {
  const targetUrl = new URL(targetOrigin);
  
  // Replace absolute URLs
  html = html.replace(new RegExp(targetOrigin, "g"), proxyOrigin);
  html = html.replace(new RegExp("https://" + targetUrl.host, "g"), proxyOrigin);
  html = html.replace(new RegExp("http://" + targetUrl.host, "g"), proxyOrigin);
  html = html.replace(new RegExp("//" + targetUrl.host, "g"), proxyOrigin.replace(/^https?:/, ""));
  
  return html;
}
