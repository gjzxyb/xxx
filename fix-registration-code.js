// 加载并初始化注册开关
async function loadRegistrationStatus() {
  try {
    const response = await fetch('/api/admin/registration-setting', {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    const result = await response.json();

    if (result.code === 200) {
      const toggle = document.getElementById('registrationToggle');
      toggle.checked = result.data.registrationEnabled !== false;
    }
  } catch (error) {
    console.error('加载注册状态失败:', error);
  }
}

// 切换注册开关
document.getElementById('registrationToggle').addEventListener('change', async (e) => {
  const enabled = e.target.checked;

  try {
    const response = await fetch('/api/admin/registration-setting', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getToken()
      },
      body: JSON.stringify({ enabled })
    });

    const result = await response.json();

    if (result.code === 200) {
      alert(result.message);
    } else {
      alert(result.message || '更新失败');
      e.target.checked = !enabled;
    }
  } catch (error) {
    console.error('切换注册开关失败:', error);
    alert('操作失败，请稍后重试');
    e.target.checked = !enabled;
  }
});
