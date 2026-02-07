/**
 * 时间工具类
 * 统一处理时区和时间比较
 */

class TimeUtils {
  /**
   * 获取当前UTC时间
   * @returns {Date}
   */
  static now() {
    return new Date();
  }

  /**
   * 将本地时间转换为UTC
   * @param {Date|string} localTime
   * @returns {Date}
   */
  static toUTC(localTime) {
    if (!localTime) return null;
    const date = new Date(localTime);
    return new Date(date.getTime() + date.getTimezoneOffset() * 60000);
  }

  /**
   * 检查当前时间是否在指定范围内
   * @param {Date|string} startTime - 开始时间
   * @param {Date|string} endTime - 结束时间
   * @returns {Object} { inRange: boolean, status: string, message: string }
   */
  static isInTimeRange(startTime, endTime) {
    const now = this.now();
    
    if (!startTime && !endTime) {
      return { inRange: true, status: 'open', message: '无时间限制' };
    }

    if (startTime) {
      const start = new Date(startTime);
      if (now < start) {
        return {
          inRange: false,
          status: 'not_started',
          message: `活动未开始，开始时间: ${start.toLocaleString('zh-CN')}`,
          startTime: start,
          remainingTime: start - now
        };
      }
    }

    if (endTime) {
      const end = new Date(endTime);
      if (now > end) {
        return {
          inRange: false,
          status: 'ended',
          message: `活动已结束，结束时间: ${end.toLocaleString('zh-CN')}`,
          endTime: end
        };
      }
    }

    return {
      inRange: true,
      status: 'active',
      message: '活动进行中',
      startTime: startTime ? new Date(startTime) : null,
      endTime: endTime ? new Date(endTime) : null,
      remainingTime: endTime ? new Date(endTime) - now : null
    };
  }

  /**
   * 格式化时间为ISO字符串（UTC）
   * @param {Date} date
   * @returns {string}
   */
  static toISOString(date) {
    if (!date) return null;
    return new Date(date).toISOString();
  }

  /**
   * 添加时间偏移
   * @param {Date} date - 基准时间
   * @param {number} milliseconds - 毫秒数
   * @returns {Date}
   */
  static addTime(date, milliseconds) {
    return new Date(new Date(date).getTime() + milliseconds);
  }

  /**
   * 格式化剩余时间为可读字符串
   * @param {number} milliseconds
   * @returns {string}
   */
  static formatRemainingTime(milliseconds) {
    if (!milliseconds || milliseconds < 0) return '已过期';
    
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}天${hours % 24}小时`;
    if (hours > 0) return `${hours}小时${minutes % 60}分钟`;
    if (minutes > 0) return `${minutes}分钟`;
    return `${seconds}秒`;
  }
}

module.exports = TimeUtils;
