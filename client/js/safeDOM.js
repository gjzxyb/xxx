/**
 * safeDOM - 安全的DOM操作工具类
 * 防止XSS攻击
 */

const safeDOM = {
  /**
   * HTML转义 - 防止XSS注入
   */
  escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * 安全设置元素文本内容
   */
  setText(element, text) {
    if (!element) return;
    element.textContent = text || '';
  },

  /**
   * 安全设置元素HTML（自动转义）
   */
  setEscapedHTML(element, html) {
    if (!element) return;
    element.textContent = html || '';
  },

  /**
   * 安全设置innerHTML（仅用于已知安全的HTML）
   * 使用白名单标签过滤
   */
  setHTML(element, html, allowedTags = ['b', 'i', 'u', 'strong', 'em', 'br', 'p', 'span']) {
    if (!element) return;
    
    // 创建临时容器
    const temp = document.createElement('div');
    temp.innerHTML = html || '';
    
    // 递归清理节点，只保留白名单标签
    const cleanNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.cloneNode(false);
      }
      
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();
        
        if (!allowedTags.includes(tagName)) {
          // 不在白名单中的标签，只保留其文本内容
          const textNode = document.createTextNode(node.textContent);
          return textNode;
        }
        
        // 在白名单中，创建新元素（不复制属性，防止注入）
        const newNode = document.createElement(tagName);
        
        // 递归处理子节点
        Array.from(node.childNodes).forEach(child => {
          const cleanedChild = cleanNode(child);
          if (cleanedChild) {
            newNode.appendChild(cleanedChild);
          }
        });
        
        return newNode;
      }
      
      return null;
    };
    
    // 清空目标元素
    element.innerHTML = '';
    
    // 添加清理后的节点
    Array.from(temp.childNodes).forEach(child => {
      const cleanedChild = cleanNode(child);
      if (cleanedChild) {
        element.appendChild(cleanedChild);
      }
    });
  },

  /**
   * 创建安全的元素
   */
  createElement(tagName, options = {}) {
    const element = document.createElement(tagName);
    
    // 安全设置文本内容
    if (options.text) {
      element.textContent = options.text;
    }
    
    // 安全设置类名
    if (options.className) {
      if (Array.isArray(options.className)) {
        element.className = options.className.join(' ');
      } else {
        element.className = options.className;
      }
    }
    
    // 安全设置属性（白名单）
    const allowedAttrs = ['id', 'href', 'src', 'alt', 'title', 'type', 'value', 'placeholder', 'disabled', 'readonly'];
    if (options.attrs) {
      Object.keys(options.attrs).forEach(key => {
        if (allowedAttrs.includes(key)) {
          // 对href和src做额外验证
          if (key === 'href' || key === 'src') {
            const value = options.attrs[key];
            // 只允许http(s)和相对路径，阻止javascript:等危险协议
            if (value && (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/') || value.startsWith('./'))) {
              element.setAttribute(key, value);
            }
          } else {
            element.setAttribute(key, options.attrs[key]);
          }
        }
      });
    }
    
    // 安全设置事件监听器
    if (options.on) {
      Object.keys(options.on).forEach(eventName => {
        element.addEventListener(eventName, options.on[eventName]);
      });
    }
    
    // 添加子元素
    if (options.children) {
      options.children.forEach(child => {
        if (child instanceof Node) {
          element.appendChild(child);
        } else if (typeof child === 'string') {
          element.appendChild(document.createTextNode(child));
        }
      });
    }
    
    return element;
  },

  /**
   * 安全追加HTML内容
   */
  appendHTML(element, html) {
    const temp = this.createElement('div');
    this.setHTML(temp, html);
    Array.from(temp.childNodes).forEach(child => {
      element.appendChild(child);
    });
  },

  /**
   * 清空元素
   */
  empty(element) {
    if (!element) return;
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }
};

// 导出
if (typeof window !== 'undefined') {
  window.safeDOM = safeDOM;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = safeDOM;
}
