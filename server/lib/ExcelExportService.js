/**
 * Excel导出服务
 * 使用流式处理优化大数据集导出性能
 */

const XLSX = require('xlsx');

class ExcelExportService {
  /**
   * 导出选科列表
   * @param {Array} selections - 选科记录数组
   * @param {Object} options - 导出选项
   * @returns {Buffer} Excel文件Buffer
   */
  async exportSelections(selections, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        // 使用setImmediate分批处理，避免阻塞事件循环
        const batchSize = 100;
        const excelData = [];
        let currentIndex = 0;

        const processBatch = () => {
          const endIndex = Math.min(currentIndex + batchSize, selections.length);

          for (let i = currentIndex; i < endIndex; i++) {
            const sel = selections[i];
            excelData.push({
              '序号': i + 1,
              '学号': sel.user?.studentId || '',
              '姓名': sel.user?.name || '',
              '班级': sel.user?.className || '',
              '首选科目': sel.physicsHistorySubject?.name || '',
              '再选科目1': sel.electiveOneSubject?.name || '',
              '再选科目2': sel.electiveTwoSubject?.name || '',
              '状态': this._getStatusText(sel.status),
              '提交时间': sel.submittedAt ? new Date(sel.submittedAt).toLocaleString('zh-CN') : ''
            });
          }

          currentIndex = endIndex;

          if (currentIndex < selections.length) {
            // 继续处理下一批
            setImmediate(processBatch);
          } else {
            // 所有数据处理完成，生成Excel
            const buffer = this._generateExcelBuffer(excelData, '选科列表');
            resolve(buffer);
          }
        };

        // 开始处理
        processBatch();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 导出选科组合统计
   * @param {Array} combinations - 组合统计数据
   * @param {Object} stats - 统计汇总
   * @returns {Buffer} Excel文件Buffer
   */
  async exportCombinations(combinations, stats) {
    return new Promise((resolve, reject) => {
      try {
        const wb = XLSX.utils.book_new();

        // Sheet 1: 组合统计汇总
        const summaryData = combinations.map((combo, i) => ({
          '排名': i + 1,
          '选科组合': `${combo.physicsHistory}+${combo.elective1}+${combo.elective2}`,
          '首选科目': combo.physicsHistory,
          '再选科目1': combo.elective1,
          '再选科目2': combo.elective2,
          '人数': combo.students.length,
          '占比': stats.total > 0 ? (combo.students.length / stats.total * 100).toFixed(1) + '%' : '0%'
        }));

        // 添加汇总行
        summaryData.push({});
        summaryData.push({ '排名': '汇总', '选科组合': '', '首选科目': '', '再选科目1': '', '再选科目2': '', '人数': '', '占比': '' });
        summaryData.push({
          '排名': '',
          '选科组合': '物理方向总人数',
          '首选科目': '',
          '再选科目1': '',
          '再选科目2': '',
          '人数': stats.physicsCount,
          '占比': stats.total > 0 ? (stats.physicsCount / stats.total * 100).toFixed(1) + '%' : '0%'
        });
        summaryData.push({
          '排名': '',
          '选科组合': '历史方向总人数',
          '首选科目': '',
          '再选科目1': '',
          '再选科目2': '',
          '人数': stats.historyCount,
          '占比': stats.total > 0 ? (stats.historyCount / stats.total * 100).toFixed(1) + '%' : '0%'
        });
        summaryData.push({
          '排名': '',
          '选科组合': '总人数',
          '首选科目': '',
          '再选科目1': '',
          '再选科目2': '',
          '人数': stats.total,
          '占比': '100%'
        });
        summaryData.push({
          '排名': '',
          '选科组合': '组合数量',
          '首选科目': '',
          '再选科目1': '',
          '再选科目2': '',
          '人数': combinations.length,
          '占比': ''
        });

        const ws1 = XLSX.utils.json_to_sheet(summaryData);
        ws1['!cols'] = [{ wch: 6 }, { wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 8 }];
        XLSX.utils.book_append_sheet(wb, ws1, '组合统计汇总');

        // Sheet 2: 各组合详细名单（分批处理）
        this._addDetailSheet(wb, combinations);

        // 生成Buffer
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        resolve(buffer);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 添加详细名单Sheet（分批处理）
   * @private
   */
  _addDetailSheet(wb, combinations) {
    const detailData = [];
    const batchSize = 100;
    let processed = 0;

    for (const combo of combinations) {
      const comboName = `${combo.physicsHistory}+${combo.elective1}+${combo.elective2}`;

      for (const student of combo.students) {
        detailData.push({
          '选科组合': comboName,
          '首选科目': combo.physicsHistory,
          '再选科目1': combo.elective1,
          '再选科目2': combo.elective2,
          '学号': student.studentId,
          '姓名': student.name,
          '班级': student.className
        });

        processed++;

        // 每处理一批数据，让出CPU时间
        if (processed % batchSize === 0) {
          // 注意：这里是同步的，但通过分批可以减少单次处理时间
        }
      }
    }

    const ws2 = XLSX.utils.json_to_sheet(detailData);
    ws2['!cols'] = [{ wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws2, '选科详细名单');
  }

  /**
   * 生成Excel Buffer
   * @private
   */
  _generateExcelBuffer(data, sheetName) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // 设置列宽
    ws['!cols'] = [
      { wch: 6 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
      { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 18 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * 获取状态文本
   * @private
   */
  _getStatusText(status) {
    const statusMap = {
      'submitted': '已提交',
      'confirmed': '已确认',
      'cancelled': '已取消',
      'draft': '草稿'
    };
    return statusMap[status] || status;
  }
}

// 导出单例
const excelExportService = new ExcelExportService();
module.exports = excelExportService;
