/**
 * 安全的DOM操作工具
 * 用于替代innerHTML，防止XSS攻击
 */

class SafeDOM {
  /**
   * 安全地设置元素的文本内容
   * @param {HTMLElement} element 
   * @param {string} text 
   */
  static setText(element, text) {
    if (!element) return;
    element.textContent = text || '';
  }

  /**
   * 安全地创建带有class的元素
   * @param {string} tagName 
   * @param {string} className 
   * @param {string} textContent 
   * @returns {HTMLElement}
   */
  static createElement(tagName, className = '', textContent = '') {
    const element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (textContent) {
      element.textContent = textContent;
    }
    return element;
  }

  /**
   * 安全地清空元素内容
   * @param {HTMLElement} element 
   */
  static clear(element) {
    if (!element) return;
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  /**
   * 安全地添加多个子元素
   * @param {HTMLElement} parent 
   * @param {HTMLElement[]} children 
   */
  static appendChildren(parent, children) {
    if (!parent || !Array.isArray(children)) return;
    children.forEach(child => {
      if (child instanceof HTMLElement) {
        parent.appendChild(child);
      }
    });
  }

  /**
   * 转义HTML特殊字符，防止XSS
   * @param {string} str 
   * @returns {string}
   */
  static escapeHTML(str) {
    if (typeof str !== 'string') return '';
    
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * 安全地设置属性
   * @param {HTMLElement} element 
   * @param {string} attribute 
   * @param {string} value 
   */
  static setAttribute(element, attribute, value) {
    if (!element || !attribute) return;
    
    // 禁止设置危险属性
    const dangerousAttrs = ['onclick', 'onerror', 'onload', 'onmouseover'];
    if (dangerousAttrs.includes(attribute.toLowerCase())) {
      console.warn(`警告: 禁止设置危险属性 ${attribute}`);
      return;
    }
    
    element.setAttribute(attribute, value);
  }

  /**
   * 创建密码强度指示器UI（安全版本）
   * 替代原有的innerHTML方式
   * @param {Object} policy - 密码策略配置
   * @returns {HTMLElement}
   */
  static createPasswordStrengthUI(policy) {
    const container = this.createElement('div', 'password-strength-container');
    
    // 强度条
    const bar = this.createElement('div', 'password-strength-bar');
    const indicator = this.createElement('div', 'password-strength-indicator');
    indicator.id = 'strengthIndicator';
    bar.appendChild(indicator);
    
    // 强度文本
    const strengthText = this.createElement('div', 'password-strength-text', '请输入密码');
    strengthText.id = 'strengthText';
    
    // 规则列表
    const rules = this.createElement('div', 'password-rules');
    const ruleTitle = this.createElement('div', 'password-rule-title', '密码要求：');
    rules.appendChild(ruleTitle);
    
    // 长度规则
    rules.appendChild(this.createPasswordRule(
      'rule-length',
      `${policy.minLength}-${policy.maxLength}个字符`
    ));
    
    // 小写字母
    if (policy.requireLowercase) {
      rules.appendChild(this.createPasswordRule(
        'rule-lowercase',
        '至少一个小写字母'
      ));
    }
    
    // 大写字母
    if (policy.requireUppercase) {
      rules.appendChild(this.createPasswordRule(
        'rule-uppercase',
        '至少一个大写字母'
      ));
    }
    
    // 数字
    if (policy.requireNumber) {
      rules.appendChild(this.createPasswordRule(
        'rule-number',
        '至少一个数字'
      ));
    }
    
    // 特殊字符
    if (policy.requireSpecial) {
      rules.appendChild(this.createPasswordRule(
        'rule-special',
        '至少一个特殊字符'
      ));
    }
    
    // 组装
    container.appendChild(bar);
    container.appendChild(strengthText);
    container.appendChild(rules);
    
    return container;
  }

  /**
   * 创建单个密码规则元素
   * @param {string} id 
   * @param {string} text 
   * @returns {HTMLElement}
   */
  static createPasswordRule(id, text) {
    const rule = this.createElement('div', 'password-rule');
    rule.id = id;
    
    const icon = this.createElement('span', 'rule-icon', '○');
    const ruleText = this.createElement('span', 'rule-text', text);
    
    rule.appendChild(icon);
    rule.appendChild(ruleText);
    
    return rule;
  }

  /**
   * 创建密码匹配指示器
   * @returns {HTMLElement}
   */
  static createPasswordMatchIndicator() {
    const match = this.createElement('div', 'password-match');
    match.id = 'passwordMatch';
    match.style.display = 'none';
    
    const icon = this.createElement('span', 'rule-icon', '○');
    const text = this.createElement('span', 'rule-text', '两次密码输入一致');
    
    match.appendChild(icon);
    match.appendChild(text);
    
    return match;
  }
}

// 导出到全局
if (typeof window !== 'undefined') {
  window.SafeDOM = SafeDOM;
}

// 如果是Node.js环境
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SafeDOM;
}
