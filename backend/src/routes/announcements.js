const express = require('express');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// 模拟公告数据库
let announcements = [
  {
    id: 1,
    title: '欢迎使用电影预订平台',
    content: '这是一个公益性质的电影预订平台，欢迎各位用户使用！',
    priority: 1, // 优先级：1-高，2-中，3-低
    isActive: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

// 获取系统公告（返回单个公告）
router.get('/', (req, res) => {
  try {
    // 返回第一个活跃的公告，如果没有则返回默认公告
    let systemAnnouncement = announcements.find(a => a.isActive);
    
    if (!systemAnnouncement) {
      // 如果没有公告，创建默认公告
      systemAnnouncement = {
        id: 1,
        title: '系统公告',
        content: '暂无公告',
        priority: 1,
        isActive: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      announcements.push(systemAnnouncement);
    }
    
    res.json({
      success: true,
      data: systemAnnouncement
    });
  } catch (error) {
    console.error('获取公告错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取单个公告
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const announcement = announcements.find(a => a.id === parseInt(id));
    
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: '公告不存在'
      });
    }

    res.json({
      success: true,
      data: announcement
    });
  } catch (error) {
    console.error('获取公告错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 创建公告验证规则
const createAnnouncementValidation = [
  body('title').notEmpty().withMessage('公告标题不能为空'),
  body('content').notEmpty().withMessage('公告内容不能为空'),
  body('priority').optional().isInt({ min: 1, max: 3 }).withMessage('优先级必须是1-3之间的整数')
];

// 创建公告
router.post('/', createAnnouncementValidation, (req, res) => {
  try {
    // 验证输入
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '输入验证失败',
        errors: errors.array()
      });
    }

    const { title, content, priority = 2 } = req.body;

    // 创建新公告
    const newAnnouncement = {
      id: announcements.length > 0 ? Math.max(...announcements.map(a => a.id)) + 1 : 1,
      title,
      content,
      priority,
      isActive: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    announcements.push(newAnnouncement);

    res.status(201).json({
      success: true,
      message: '公告创建成功',
      data: newAnnouncement
    });

  } catch (error) {
    console.error('创建公告错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 更新系统公告（无ID，直接更新第一个公告）
router.put('/', (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({
        success: false,
        message: '公告内容不能为空'
      });
    }

    // 更新第一个公告的内容
    if (announcements.length > 0) {
      announcements[0].content = content;
      announcements[0].updated_at = new Date().toISOString();
      
      res.json({
        success: true,
        message: '公告更新成功',
        data: announcements[0]
      });
    } else {
      // 如果没有公告，创建一个新的
      const newAnnouncement = {
        id: 1,
        title: '系统公告',
        content: content,
        priority: 1,
        isActive: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      announcements.push(newAnnouncement);
      
      res.json({
        success: true,
        message: '公告创建成功',
        data: newAnnouncement
      });
    }

  } catch (error) {
    console.error('更新系统公告错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 更新公告验证规则
const updateAnnouncementValidation = [
  body('title').optional().notEmpty().withMessage('公告标题不能为空'),
  body('content').optional().notEmpty().withMessage('公告内容不能为空'),
  body('priority').optional().isInt({ min: 1, max: 3 }).withMessage('优先级必须是1-3之间的整数'),
  body('isActive').optional().isBoolean().withMessage('激活状态必须是布尔值')
];

// 更新公告
router.put('/:id', updateAnnouncementValidation, (req, res) => {
  try {
    // 验证输入
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '输入验证失败',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const announcementIndex = announcements.findIndex(a => a.id === parseInt(id));
    
    if (announcementIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '公告不存在'
      });
    }

    const { title, content, priority, isActive } = req.body;

    // 更新公告信息
    const updatedAnnouncement = {
      ...announcements[announcementIndex],
      ...(title && { title }),
      ...(content && { content }),
      ...(priority && { priority }),
      ...(typeof isActive === 'boolean' && { isActive }),
      updated_at: new Date().toISOString()
    };

    announcements[announcementIndex] = updatedAnnouncement;

    res.json({
      success: true,
      message: '公告更新成功',
      data: updatedAnnouncement
    });

  } catch (error) {
    console.error('更新公告错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 删除公告
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const announcementIndex = announcements.findIndex(a => a.id === parseInt(id));
    
    if (announcementIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '公告不存在'
      });
    }

    // 删除公告
    const deletedAnnouncement = announcements.splice(announcementIndex, 1)[0];

    res.json({
      success: true,
      message: '公告删除成功',
      data: deletedAnnouncement
    });

  } catch (error) {
    console.error('删除公告错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

module.exports = router;
