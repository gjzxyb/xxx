/**
 * 自动化备份管理器
 * 定期备份数据库，防止数据丢失
 */
const cron = require('node-cron');
const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class BackupManager {
  constructor() {
    this.backupDir = path.join(__dirname, '../../backups');
    this.dbDir = path.join(__dirname, '../../databases');
    
    // 配置
    this.maxBackups = parseInt(process.env.MAX_BACKUPS) || 7; // 保留最近7个备份
    this.backupSchedule = process.env.BACKUP_SCHEDULE || '0 3 * * *'; // 每天凌晨3点
    this.enabled = process.env.BACKUP_ENABLED !== 'false'; // 默认启用
    
    // 确保备份目录存在
    this.ensureBackupDir();
  }

  /**
   * 确保备份目录存在
   */
  async ensureBackupDir() {
    try {
      await fs.ensureDir(this.backupDir);
      console.log(`✓ 备份目录已就绪: ${this.backupDir}`);
    } catch (error) {
      console.error('创建备份目录失败:', error);
      this.enabled = false;
    }
  }

  /**
   * 创建备份
   * @returns {Promise<string>} 备份文件路径
   */
  async createBackup() {
    if (!this.enabled) {
      console.warn('⚠️  备份功能已禁用');
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupFileName = `backup-${timestamp}.zip`;
    const backupPath = path.join(this.backupDir, backupFileName);

    console.log(`🔄 开始创建备份: ${backupFileName}`);

    try {
      // 创建备份压缩包
      await this.createArchive(backupPath);
      
      // 验证备份文件
      const stats = await fs.stat(backupPath);
      console.log(`✓ 备份创建成功: ${backupFileName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      
      // 清理旧备份
      await this.cleanOldBackups();
      
      return backupPath;
    } catch (error) {
      console.error('❌ 备份失败:', error);
      
      // 清理失败的备份文件
      try {
        if (await fs.pathExists(backupPath)) {
          await fs.remove(backupPath);
        }
      } catch (cleanupError) {
        console.error('清理失败备份文件出错:', cleanupError);
      }
      
      throw error;
    }
  }

  /**
   * 创建压缩归档
   * @param {string} outputPath - 输出文件路径
   */
  async createArchive(outputPath) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // 最高压缩级别
      });

      output.on('close', () => {
        resolve();
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);

      // 添加数据库文件
      if (fs.existsSync(this.dbDir)) {
        archive.directory(this.dbDir, 'databases');
      }

      // 添加配置文件（可选）
      const envFile = path.join(__dirname, '../../.env');
      if (fs.existsSync(envFile)) {
        archive.file(envFile, { name: 'config/.env.backup' });
      }

      // 添加备份元数据
      const metadata = {
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        nodeVersion: process.version,
        platform: process.platform
      };
      archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });

      archive.finalize();
    });
  }

  /**
   * 清理旧备份
   */
  async cleanOldBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files
        .filter(f => f.startsWith('backup-') && f.endsWith('.zip'))
        .map(f => ({
          name: f,
          path: path.join(this.backupDir, f),
          time: fs.statSync(path.join(this.backupDir, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time); // 按时间降序排序

      // 保留最新的 N 个备份
      const toDelete = backupFiles.slice(this.maxBackups);

      for (const file of toDelete) {
        await fs.remove(file.path);
        console.log(`🗑️  已删除旧备份: ${file.name}`);
      }

      if (toDelete.length > 0) {
        console.log(`✓ 清理了 ${toDelete.length} 个旧备份`);
      }
    } catch (error) {
      console.error('清理旧备份失败:', error);
    }
  }

  /**
   * 恢复备份
   * @param {string} backupPath - 备份文件路径
   */
  async restoreBackup(backupPath) {
    console.log(`🔄 开始恢复备份: ${backupPath}`);

    if (!await fs.pathExists(backupPath)) {
      throw new Error('备份文件不存在');
    }

    // 创建临时目录
    const tempDir = path.join(this.backupDir, 'temp_restore');
    await fs.ensureDir(tempDir);

    try {
      // 解压备份文件
      await execAsync(`unzip -q "${backupPath}" -d "${tempDir}"`);

      // 备份当前数据（以防恢复失败）
      const currentBackup = await this.createBackup();
      console.log(`✓ 当前数据已备份至: ${currentBackup}`);

      // 恢复数据库文件
      const restoredDbDir = path.join(tempDir, 'databases');
      if (await fs.pathExists(restoredDbDir)) {
        await fs.remove(this.dbDir);
        await fs.move(restoredDbDir, this.dbDir);
        console.log('✓ 数据库已恢复');
      }

      // 清理临时目录
      await fs.remove(tempDir);

      console.log('✓ 备份恢复成功');
    } catch (error) {
      console.error('❌ 备份恢复失败:', error);
      
      // 清理临时目录
      try {
        await fs.remove(tempDir);
      } catch (cleanupError) {
        console.error('清理临时目录失败:', cleanupError);
      }
      
      throw error;
    }
  }

  /**
   * 列出所有备份
   * @returns {Promise<Array>} 备份列表
   */
  async listBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backups = [];

      for (const file of files) {
        if (file.startsWith('backup-') && file.endsWith('.zip')) {
          const filePath = path.join(this.backupDir, file);
          const stats = await fs.stat(filePath);
          
          backups.push({
            name: file,
            path: filePath,
            size: stats.size,
            createdAt: stats.mtime,
            isValid: await this.validateBackup(filePath)
          });
        }
      }

      return backups.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error('列出备份失败:', error);
      return [];
    }
  }

  /**
   * 验证备份文件完整性
   * @param {string} backupPath - 备份文件路径
   */
  async validateBackup(backupPath) {
    try {
      const stats = await fs.stat(backupPath);
      return stats.size > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * 启动定时备份
   */
  startSchedule() {
    if (!this.enabled) {
      console.log('⚠️  自动备份已禁用');
      return;
    }

    try {
      // 验证cron表达式
      if (!cron.validate(this.backupSchedule)) {
        console.error('❌ 无效的备份计划表达式:', this.backupSchedule);
        return;
      }

      cron.schedule(this.backupSchedule, async () => {
        console.log('⏰ 定时备份任务触发');
        try {
          await this.createBackup();
        } catch (error) {
          console.error('定时备份失败:', error);
        }
      });

      console.log(`✓ 自动备份已启动 (计划: ${this.backupSchedule})`);
    } catch (error) {
      console.error('启动定时备份失败:', error);
      this.enabled = false;
    }
  }

  /**
   * 获取备份统计信息
   */
  async getStats() {
    const backups = await this.listBackups();
    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);

    return {
      count: backups.length,
      totalSize: totalSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      oldestBackup: backups[backups.length - 1]?.createdAt,
      newestBackup: backups[0]?.createdAt,
      enabled: this.enabled,
      maxBackups: this.maxBackups,
      schedule: this.backupSchedule
    };
  }
}

// 单例模式
const backupManager = new BackupManager();

module.exports = backupManager;
