/**
 * 时区工具函数
 */

/**
 * 获取指定时区的当前时间
 * @param {string} timezone - 时区（如 'Asia/Shanghai'）
 * @returns {Date}
 */
function getCurrentTimeInTimezone(timezone = 'Asia/Shanghai') {
  return new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
}

/**
 * 比较时间（考虑时区）
 * @param {Date|string} time1 
 * @param {Date|string} time2 
 * @param {string} timezone 
 * @returns {number} -1: time1 < time2, 0: equal, 1: time1 > time2
 */
function compareTimesInTimezone(time1, time2, timezone = 'Asia/Shanghai') {
  const t1 = new Date(time1).toLocaleString('en-US', { timeZone: timezone });
  const t2 = new Date(time2).toLocaleString('en-US', { timeZone: timezone });
  
  const date1 = new Date(t1);
  const date2 = new Date(t2);
  
  if (date1 < date2) return -1;
  if (date1 > date2) return 1;
  return 0;
}

/**
 * 格式化时间显示（带时区）
 * @param {Date|string} time 
 * @param {string} timezone 
 * @returns {string}
 */
function formatTimeWithTimezone(time, timezone = 'Asia/Shanghai') {
  return new Date(time).toLocaleString('zh-CN', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

module.exports = {
  getCurrentTimeInTimezone,
  compareTimesInTimezone,
  formatTimeWithTimezone
};
