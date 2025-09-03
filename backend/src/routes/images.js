const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../../uploads/images');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1E9);
    cb(null, `image_${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB限制
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'));
    }
  }
});

// 内存中存储图片信息（不持久化到数据库）
let imageInfo = {
  image1: null,
  image2: null,
  image3: null,
};

// 恢复图片信息函数
const restoreImageInfo = () => {
  try {
    const files = fs.readdirSync(uploadDir);
    console.log('上传目录中的文件:', files);

    const imageFiles = files
      .filter(file => file.startsWith('image_') && (file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png')))
      .map(file => {
        const filePath = path.join(uploadDir, file);
        const stats = fs.statSync(filePath);
        return { file, stats };
      })
      .sort((a, b) => b.stats.mtime - a.stats.mtime);

    if (imageFiles.length > 0) {
      const file1 = imageFiles[0];
      imageInfo.image1 = {
        filename: file1.file,
        originalName: `恢复的图片_${file1.file}`,
        size: file1.stats.size,
        mimetype: file1.file.endsWith('.png') ? 'image/png' : 'image/jpeg',
        uploadTime: file1.stats.mtime.toISOString(),
        uploader: '系统恢复'
      };
      console.log('恢复图片信息 image1:', imageInfo.image1);
    }

    if (imageFiles.length > 1) {
      const file2 = imageFiles[1];
      imageInfo.image2 = {
        filename: file2.file,
        originalName: `恢复的图片_${file2.file}`,
        size: file2.stats.size,
        mimetype: file2.file.endsWith('.png') ? 'image/png' : 'image/jpeg',
        uploadTime: file2.stats.mtime.toISOString(),
        uploader: '系统恢复'
      };
      console.log('恢复图片信息 image2:', imageInfo.image2);
    }

    console.log('最终恢复的图片信息:', imageInfo);
  } catch (error) {
    console.error('恢复图片信息失败:', error);
  }
};

// 启动时恢复图片信息
restoreImageInfo();

// 获取图片信息
router.get('/info', (req, res) => {
  res.json({
    success: true,
    data: imageInfo
  });
});

// 上传图片
router.post('/upload/:position', upload.single('image'), (req, res) => {
  try {
    const position = req.params.position;
    if (!['image1', 'image2', 'image3'].includes(position)) {
      return res.status(400).json({ success: false, message: '无效的图片位置' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: '没有上传文件' });
    }

    // 删除旧图片
    if (imageInfo[position] && imageInfo[position].filename) {
      const oldFilePath = path.join(uploadDir, imageInfo[position].filename);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    // 保存新图片信息
    imageInfo[position] = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadTime: new Date().toISOString(),
      uploader: '管理员'
    };

    res.json({
      success: true,
      message: '图片上传成功',
      data: imageInfo[position]
    });
  } catch (error) {
    console.error('上传图片失败:', error);
    res.status(500).json({ success: false, message: '上传图片失败' });
  }
});

// 删除图片
router.delete('/delete/:position', (req, res) => {
  try {
    const position = req.params.position;
    if (!['image1', 'image2', 'image3'].includes(position)) {
      return res.status(400).json({ success: false, message: '无效的图片位置' });
    }

    if (imageInfo[position] && imageInfo[position].filename) {
      const filePath = path.join(uploadDir, imageInfo[position].filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      imageInfo[position] = null;
    }

    res.json({
      success: true,
      message: '图片删除成功'
    });
  } catch (error) {
    console.error('删除图片失败:', error);
    res.status(500).json({ success: false, message: '删除图片失败' });
  }
});

// 获取图片（代理端点）
router.get('/get/:position', (req, res) => {
  try {
    const position = req.params.position;
    if (!['image1', 'image2', 'image3'].includes(position)) {
      return res.status(400).json({ success: false, message: '无效的图片位置' });
    }

    if (!imageInfo[position] || !imageInfo[position].filename) {
      return res.status(404).json({ success: false, message: '图片不存在' });
    }

    const imagePath = path.join(uploadDir, imageInfo[position].filename);
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ success: false, message: '图片文件不存在' });
    }

    res.setHeader('Content-Type', imageInfo[position].mimetype);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    const imageBuffer = fs.readFileSync(imagePath);
    res.send(imageBuffer);
  } catch (error) {
    console.error('获取图片失败:', error);
    res.status(500).json({ success: false, message: '获取图片失败' });
  }
});

module.exports = router;
