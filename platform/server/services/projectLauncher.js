const { spawn } = require('child_process');
const path = require('path');
const { Project } = require('../models');

// 项目进程管理
const projectProcesses = new Map(); // projectId -> process

/**
 * 分配可用端口
 */
async function allocatePort() {
  const usedPorts = await Project.findAll({
    attributes: ['port'],
    where: {
      port: { [require('sequelize').Op.not]: null }
    }
  });

  const usedPortNumbers = usedPorts.map(p => p.port);
  let port = 5000; // 起始端口

  while (usedPortNumbers.includes(port)) {
    port++;
  }

  return port;
}

/**
 * 启动项目服务
 * @param {string} projectId - 项目ID
 * @returns {Promise<number>} 返回端口号
 */
async function startProject(projectId) {
  try {
    const project = await Project.findByPk(projectId);
    if (!project) {
      throw new Error('项目不存在');
    }

    // 如果已经在运行，直接返回端口
    if (project.status === 'running' && projectProcesses.has(projectId)) {
      return project.port;
    }

    // 分配端口（如果还没有）
    let port = project.port;
    if (!port) {
      port = await allocatePort();
      await project.update({ port });
    }

    // 更新状态
    await project.update({ status: 'starting' });

    // 启动项目进程
    const dbPath = path.join(__dirname, '../databases/projects', project.dbFilename);
    const serverPath = path.join(__dirname, '../../../server/app.js');

    const env = {
      ...process.env,
      PORT: port.toString(),
      DB_PATH: dbPath,
      PROJECT_ID: projectId
    };

    const projectProcess = spawn('node', [serverPath], {
      env,
      cwd: path.join(__dirname, '../../../server'),
      detached: false
    });

    projectProcess.stdout.on('data', (data) => {
      console.log(`[项目 ${projectId}]: ${data}`);
    });

    projectProcess.stderr.on('data', (data) => {
      console.error(`[项目 ${projectId} 错误]: ${data}`);
    });

    projectProcess.on('error', async (error) => {
      console.error(`[项目 ${projectId}] 启动失败:`, error);
      await project.update({ status: 'error' });
      projectProcesses.delete(projectId);
    });

    projectProcess.on('exit', async (code) => {
      console.log(`[项目 ${projectId}] 进程退出，代码: ${code}`);
      await project.update({ status: 'stopped' });
      projectProcesses.delete(projectId);
    });

    // 保存进程引用
    projectProcesses.set(projectId, projectProcess);

    // 等待一段时间确认启动成功
    await new Promise(resolve => setTimeout(resolve, 2000));
    await project.update({ status: 'running' });

    return port;
  } catch (error) {
    console.error('启动项目失败:', error);
    throw error;
  }
}

/**
 * 停止项目服务
 * @param {string} projectId - 项目ID
 */
async function stopProject(projectId) {
  const project = await Project.findByPk(projectId);
  if (!project) {
    throw new Error('项目不存在');
  }

  const process = projectProcesses.get(projectId);
  if (process) {
    process.kill();
    projectProcesses.delete(projectId);
  }

  await project.update({ status: 'stopped' });
}

/**
 * 获取项目状态
 * @param {string} projectId - 项目ID
 */
async function getProjectStatus(projectId) {
  const project = await Project.findByPk(projectId);
  if (!project) {
    return null;
  }

  return {
    id: project.id,
    name: project.name,
    status: project.status,
    port: project.port,
    url: project.port ? `http://localhost:${project.port}` : null
  };
}

module.exports = {
  startProject,
  stopProject,
  getProjectStatus,
  allocatePort
};
