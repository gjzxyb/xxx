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

  try {
    const response = await fetch(API_BASE + url, {
      ...options,
      headers
    });

    const data = await response.json();

    if (data.code === 401) {
      clearToken();
      window.location.href = '/';
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
    login: (studentId, password) => request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ studentId, password })
    }),

    register: (data) => request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

    getProfile: () => request('/auth/profile'),

    changePassword: (oldPassword, newPassword) => request('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ oldPassword, newPassword })
    })
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

    getStats: () => request('/selections/stats')
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
      body: JSON.stringify({ startTime, endTime })
    }),

    getStudents: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request('/admin/students' + (query ? '?' + query : ''));
    },

    importStudents: (students) => request('/admin/import-students', {
      method: 'POST',
      body: JSON.stringify({ students })
    }),

    exportUrl: () => API_BASE + '/admin/export?token=' + getToken()
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
