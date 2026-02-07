/**
 * 密码强度指示器组件
 * 用于实时显示密码强度和规则提示
 */

class PasswordStrengthIndicator {
  constructor(options = {}) {
    this.passwordInput = options.passwordInput;
    this.confirmInput = options.confirmInput;
    this.container = options.container;
    this.policy = null;
    
    this.init();
  }

  async init() {
    // 获取密码策略配置
    await this.loadPasswordPolicy();
    
    // 渲染指示器UI
    this.render();
    
    // 绑定事件
    this.bindEvents();
  }

  async loadPasswordPolicy() {
    try {
      const response = await fetch('/api/auth/password-policy');
      const data = await response.json();
      if (data.code === 200) {
        this.policy = data.data;
      }
    } catch (error) {
      console.error('获取密码策略失败:', error);
      // 使用默认策略
      this.policy = {
        minLength: 8,
        maxLength: 32,
        requireUppercase: true,
        requireLowercase: true,
        requireNumber: true,
        requireSpecial: false
      };
    }
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="password-strength-container">
        <div class="password-strength-bar">
          <div class="password-strength-indicator" id="strengthIndicator"></div>
        </div>
        <div class="password-strength-text" id="strengthText">请输入密码</div>
        
        <div class="password-rules">
          <div class="password-rule-title">密码要求：</div>
          <div class="password-rule" id="rule-length">
            <span class="rule-icon">○</span>
            <span class="rule-text">${this.policy.minLength}-${this.policy.maxLength}个字符</span>
          </div>
          ${this.policy.requireLowercase ? `
          <div class="password-rule" id="rule-lowercase">
            <span class="rule-icon">○</span>
            <span class="rule-text">至少一个小写字母</span>
          </div>
          ` : ''}
          ${this.policy.requireUppercase ? `
          <div class="password-rule" id="rule-uppercase">
            <span class="rule-icon">○</span>
            <span class="rule-text">至少一个大写字母</span>
          </div>
          ` : ''}
          ${this.policy.requireNumber ? `
          <div class="password-rule" id="rule-number">
            <span class="rule-icon">○</span>
            <span class="rule-text">至少一个数字</span>
          </div>
          ` : ''}
          ${this.policy.requireSpecial ? `
          <div class="password-rule" id="rule-special">
            <span class="rule-icon">○</span>
            <span class="rule-text">至少一个特殊字符</span>
          </div>
          ` : ''}
        </div>
        
        ${this.confirmInput ? `
        <div class="password-match" id="passwordMatch" style="display: none;">
          <span class="rule-icon">○</span>
          <span class="rule-text">两次密码输入一致</span>
        </div>
        ` : ''}
      </div>
    `;
  }

  bindEvents() {
    // 保存事件处理器引用，便于后续移除
    this.handlePasswordInput = () => {
      this.checkPassword(this.passwordInput.value);
    };
    
    this.handleConfirmInput = () => {
      this.checkPasswordMatch();
    };
    
    if (this.passwordInput) {
      this.passwordInput.addEventListener('input', this.handlePasswordInput);
    }

    if (this.confirmInput) {
      this.confirmInput.addEventListener('input', this.handleConfirmInput);
    }
  }

  checkPassword(password) {
    if (!password) {
      this.updateStrength('', 'weak');
      this.resetRules();
      return { isValid: false, errors: ['密码不能为空'] };
    }

    const validation = this.validatePassword(password);
    
    // 更新强度指示器
    this.updateStrength(validation.strength, validation.strength);
    
    // 更新规则检查状态
    this.updateRules(password);
    
    // 检查密码匹配
    if (this.confirmInput) {
      this.checkPasswordMatch();
    }

    return validation;
  }

  validatePassword(password) {
    const errors = [];
    
    // 长度检查
    const lengthValid = password.length >= this.policy.minLength && 
                       password.length <= this.policy.maxLength;
    if (!lengthValid) {
      errors.push(`密码长度需要${this.policy.minLength}-${this.policy.maxLength}个字符`);
    }

    // 大写字母检查
    if (this.policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('需要包含大写字母');
    }

    // 小写字母检查
    if (this.policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('需要包含小写字母');
    }

    // 数字检查
    if (this.policy.requireNumber && !/[0-9]/.test(password)) {
      errors.push('需要包含数字');
    }

    // 特殊字符检查
    if (this.policy.requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('需要包含特殊字符');
    }

    // 计算强度
    const strength = this.calculateStrength(password);

    return {
      isValid: errors.length === 0,
      errors,
      strength
    };
  }

  calculateStrength(password) {
    let score = 0;

    // 长度分数
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;

    // 字符类型分数
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 1;

    // 复杂度检查
    const hasSequential = /(?:abc|bcd|cde|123|234|345)/i.test(password);
    const hasRepeating = /(.)\1{2,}/.test(password);
    
    if (!hasSequential) score += 1;
    if (!hasRepeating) score += 1;

    if (score <= 3) return 'weak';
    if (score <= 6) return 'medium';
    return 'strong';
  }

  updateStrength(text, level) {
    const indicator = document.getElementById('strengthIndicator');
    const strengthText = document.getElementById('strengthText');
    
    if (!indicator || !strengthText) return;

    // 移除所有强度类
    indicator.className = 'password-strength-indicator';
    
    if (level === 'weak') {
      indicator.classList.add('strength-weak');
      strengthText.textContent = '弱';
      strengthText.style.color = 'var(--danger)';
    } else if (level === 'medium') {
      indicator.classList.add('strength-medium');
      strengthText.textContent = '中等';
      strengthText.style.color = 'var(--warning)';
    } else if (level === 'strong') {
      indicator.classList.add('strength-strong');
      strengthText.textContent = '强';
      strengthText.style.color = 'var(--success)';
    } else {
      strengthText.textContent = '请输入密码';
      strengthText.style.color = 'var(--text-muted)';
    }
  }

  updateRules(password) {
    // 长度检查
    this.updateRule('rule-length', 
      password.length >= this.policy.minLength && 
      password.length <= this.policy.maxLength
    );

    // 小写字母
    if (this.policy.requireLowercase) {
      this.updateRule('rule-lowercase', /[a-z]/.test(password));
    }

    // 大写字母
    if (this.policy.requireUppercase) {
      this.updateRule('rule-uppercase', /[A-Z]/.test(password));
    }

    // 数字
    if (this.policy.requireNumber) {
      this.updateRule('rule-number', /[0-9]/.test(password));
    }

    // 特殊字符
    if (this.policy.requireSpecial) {
      this.updateRule('rule-special', /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password));
    }
  }

  updateRule(ruleId, passed) {
    const ruleElement = document.getElementById(ruleId);
    if (!ruleElement) return;

    const icon = ruleElement.querySelector('.rule-icon');
    
    if (passed) {
      ruleElement.classList.add('rule-passed');
      icon.textContent = '✓';
      icon.style.color = 'var(--success)';
    } else {
      ruleElement.classList.remove('rule-passed');
      icon.textContent = '○';
      icon.style.color = 'var(--text-muted)';
    }
  }

  resetRules() {
    const rules = ['rule-length', 'rule-lowercase', 'rule-uppercase', 'rule-number', 'rule-special'];
    rules.forEach(ruleId => {
      const ruleElement = document.getElementById(ruleId);
      if (ruleElement) {
        ruleElement.classList.remove('rule-passed');
        const icon = ruleElement.querySelector('.rule-icon');
        if (icon) {
          icon.textContent = '○';
          icon.style.color = 'var(--text-muted)';
        }
      }
    });
  }

  checkPasswordMatch() {
    if (!this.confirmInput || !this.passwordInput) return;

    const matchElement = document.getElementById('passwordMatch');
    if (!matchElement) return;

    const password = this.passwordInput.value;
    const confirm = this.confirmInput.value;

    if (!confirm) {
      matchElement.style.display = 'none';
      return;
    }

    matchElement.style.display = 'flex';
    const icon = matchElement.querySelector('.rule-icon');
    
    if (password === confirm) {
      matchElement.classList.add('rule-passed');
      icon.textContent = '✓';
      icon.style.color = 'var(--success)';
    } else {
      matchElement.classList.remove('rule-passed');
      icon.textContent = '✗';
      icon.style.color = 'var(--danger)';
    }
  }

  isValid() {
    const password = this.passwordInput ? this.passwordInput.value : '';
    const validation = this.validatePassword(password);
    
    if (this.confirmInput) {
      const confirm = this.confirmInput.value;
      if (password !== confirm) {
        return false;
      }
    }
    
    return validation.isValid;
  }

  getErrors() {
    const password = this.passwordInput ? this.passwordInput.value : '';
    const validation = this.validatePassword(password);
    
    if (this.confirmInput) {
      const confirm = this.confirmInput.value;
      if (password !== confirm) {
        validation.errors.push('两次密码输入不一致');
      }
    }
    
    return validation.errors;
  }

  /**
   * 销毁实例，清理事件监听器和 DOM
   */
  destroy() {
    // 移除事件监听器
    if (this.passwordInput) {
      this.passwordInput.removeEventListener('input', this.handlePasswordInput);
    }
    
    if (this.confirmInput) {
      this.confirmInput.removeEventListener('input', this.handleConfirmInput);
    }
    
    // 清空容器内容
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

// 导出到全局
window.PasswordStrengthIndicator = PasswordStrengthIndicator;
