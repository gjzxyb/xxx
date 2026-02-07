/**
 * API 封装模块
 * 统一处理接口请求和响应
 */

const API_BASE = '/api';

// 获取存储的Token
function getToken() {
  return localStorage.getItem('token');
}

// 设置Token
function setToken(token) {
  localStorage.setItem('token', token);
}

// 清除Token
function clearToken() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

// 获取当前用户
function getCurrentUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

// 设置当前用户
function setCurrentUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
}

// 检查是否已登录
function isLoggedIn() {
  return !!getToken();
}

// 检查是否是管理员
function isAdmin() {
  const user = getCurrentUser();
  return user && user.role === 'admin';
}

// 通用请求方法
async function request(url, options = {}) {
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 自动从 URL 获取 projectId 并添加到请求中
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('projectId');

  // 使用 URL API 优化 URL 拼接
  let finalUrl = url;
  if (projectId && !url.includes('projectId=')) {
    try {
      // 创建完整的 URL 对象
      const fullUrl = new URL(url, API_BASE);
      // 使用 URLSearchParams 添加参数
      fullUrl.searchParams.append('projectId', projectId);
      // 返回相对路径（去除 base）
      finalUrl = fullUrl.pathname + fullUrl.search;
    } catch (e) {
      // 降级方案：使用原来的字符串拼接
      const separator = url.includes('?') ? '&' : '?';
      finalUrl = `${url}${separator}projectId=${projectId}`;
    }
  }

  try {
    const response = await fetch(API_BASE + finalUrl, {
      ...options,
      headers
    });

    const data = await response.json();

    // 只有在非登录接口且返回401时才自动跳转
    if (data.code === 401 && !url.includes('/auth/login')) {
      clearToken();
      // 保留 projectId 参数
      const urlParams = new URLSearchParams(window.location.search);
      const projectId = urlParams.get('projectId');
      window.location.href = projectId ? `/?projectId=${projectId}` : '/';
      return null;
    }

    return data;
  } catch (err) {
    console.error('请求失败:', err);
    return {
      code: 500,
      message: '网络请求失败，请稍后重试',
      data: null
    };
  }
}

// API 方法封装
const api = {
  // 认证相关
  auth: {
    login: (studentId, password, projectId) => request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ studentId, password, projectId })
    }),

    register: (data) => request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

    getProfile: () => request('/auth/profile'),

    changePassword: (oldPassword, newPassword) => request('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ oldPassword, newPassword })
    }),

    getPasswordPolicy: () => request('/auth/password-policy')
  },

  // 科目相关
  subjects: {
    getAll: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request('/subjects' + (query ? '?' + query : ''));
    },

    getById: (id) => request(`/subjects/${id}`),

    create: (data) => request('/subjects', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

    update: (id, data) => request(`/subjects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

    delete: (id) => request(`/subjects/${id}`, {
      method: 'DELETE'
    })
  },

  // 选科相关
  selections: {
    getStatus: () => request('/selections/status'),

    getMy: () => request('/selections/my'),

    submit: (data) => request('/selections', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

    cancel: () => request('/selections/my', {
      method: 'DELETE'
    }),

    getAll: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request('/selections' + (query ? '?' + query : ''));
    },

    getStats: () => request('/selections/stats'),

    getCombinations: () => request('/selections/combinations')
  },

  // 管理员相关
  admin: {
    getConfig: () => request('/admin/config'),

    updateConfig: (key, value, description) => request('/admin/config', {
      method: 'PUT',
      body: JSON.stringify({ key, value, description })
    }),

    setSelectionTime: (startTime, endTime) => request('/admin/selection-time', {
      method: 'PUT',
      body: JSON.stringify({ selectionStartTime: startTime, selectionEndTime: endTime })
    }),

    getStudents: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request('/admin/students' + (query ? '?' + query : ''));
    },

    importStudents: (students) => request('/admin/import-students', {
      method: 'POST',
      body: JSON.stringify({ students })
    }),

    createStudent: (data) => request('/admin/students', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

    updateStudent: (id, data) => request(`/admin/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

    deleteStudent: (id) => request(`/admin/students/${id}`, {
      method: 'DELETE'
    }),

    resetPassword: (id) => request(`/admin/students/${id}/reset-password`, {
      method: 'POST'
    }),

    // 导出功能 - 使用POST方法而非URL传递token
    export: () => {
      const token = getToken();
      const urlParams = new URLSearchParams(window.location.search);
      const projectId = urlParams.get('projectId');
      
      // 创建一个隐藏的form来发起POST请求并下载文件
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = API_BASE + '/admin/export' + (projectId ? '?projectId=' + projectId : '');
      form.target = '_blank';
      
      const tokenInput = document.createElement('input');
      tokenInput.type = 'hidden';
      tokenInput.name = 'token';
      tokenInput.value = token;
      form.appendChild(tokenInput);
      
      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);
    },
    
    // 保留旧的exportUrl方法以兼容，但标记为废弃
    exportUrl: () => {
      console.warn('exportUrl已废弃，请使用api.admin.export()方法');
      return API_BASE + '/admin/export';
    }
  }
};

// 导出
window.api = api;
window.getToken = getToken;
window.setToken = setToken;
window.clearToken = clearToken;
window.getCurrentUser = getCurrentUser;
window.setCurrentUser = setCurrentUser;
window.isLoggedIn = isLoggedIn;
window.isAdmin = isAdmin;
