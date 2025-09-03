const express = require('express');
const router = express.Router();

// 获取服务器时间
router.get('/time', (req, res) => {
  try {
    const serverNow = new Date();
    res.json({
      success: true,
      serverTime: serverNow.toISOString(),
      timezone: 'UTC',
      timestamp: serverNow.getTime()
    });
  } catch (error) {
    console.error('获取服务器时间错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取系统状态
router.get('/status', (req, res) => {
  try {
    res.json({
      success: true,
      status: 'running',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取系统状态错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

module.exports = router;
