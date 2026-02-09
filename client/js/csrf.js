/**
 * CSRF Token 工具模块
 * 提供统一的 CSRF token 获取和请求增强功能
 */

/**
 * 从 Cookie 中获取 CSRF Token
 * @returns {string|null} CSRF token 或 null
 */
function getCsrfToken() {
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'CSRF-TOKEN') {
      return value;
    }
  }
  return null;
}

/**
 * 为 fetch 请求添加 CSRF token
 * @param {string} url - 请求 URL
 * @param {Object} options - fetch 选项
 * @returns {Object} 增强后的 fetch 选项
 */
function addCsrfToken(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  
  // 只为 POST、PUT、DELETE、PATCH 请求添加 CSRF token
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      options.headers = {
        ...options.headers,
        'X-CSRF-Token': csrfToken
      };
    }
  }
  
  return options;
}

/**
 * 增强的 fetch 函数，自动添加 CSRF token
 * @param {string} url - 请求 URL
 * @param {Object} options - fetch 选项
 * @returns {Promise} fetch Promise
 */
function csrfFetch(url, options = {}) {
  const enhancedOptions = addCsrfToken(url, options);
  return fetch(url, enhancedOptions);
}

// 自动增强全局 fetch 函数
(function() {
  if (typeof window !== 'undefined' && window.fetch) {
    const originalFetch = window.fetch;
    
    window.fetch = function(url, options = {}) {
      // 自动添加 CSRF token
      const enhancedOptions = addCsrfToken(url, options);
      return originalFetch(url, enhancedOptions);
    };
    
    // 保留原始 fetch 的引用，以防需要绕过 CSRF
    window.originalFetch = originalFetch;
  }
})();

// 导出到全局
if (typeof window !== 'undefined') {
  window.getCsrfToken = getCsrfToken;
  window.addCsrfToken = addCsrfToken;
  window.csrfFetch = csrfFetch;
}
