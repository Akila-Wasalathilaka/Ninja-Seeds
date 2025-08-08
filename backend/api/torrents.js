const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const archiver = require('archiver');
const { authenticateToken } = require('../auth/auth');
const TransmissionAPI = require('../utils/transmission');
const router = express.Router();

// Configure multer for torrent file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, '/tmp/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/x-bittorrent' || file.originalname.endsWith('.torrent')) {
      cb(null, true);
    } else {
      cb(new Error('Only .torrent files are allowed'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const transmissionAPI = new TransmissionAPI();

// Get all torrents
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await transmissionAPI.getTorrents();

    if (result.success) {
      res.json({
        success: true,
        torrents: result.torrents,
        total: result.torrents.length
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to fetch torrents',
        torrents: []
      });
    }
  } catch (error) {
    console.error('Error fetching torrents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch torrents',
      torrents: []
    });
  }
});

// Add magnet link
router.post('/add-magnet', authenticateToken, async (req, res) => {
  try {
    console.log('🧲 Adding magnet link:', req.body);
    
    let magnetLink = req.body.magnetLink;
    
    if (!magnetLink && typeof req.body === 'string') {
      try {
        const parsed = JSON.parse(req.body);
        magnetLink = parsed.magnetLink;
      } catch (e) {
        const match = req.body.match(/magnetLink['":\s]+([^'"}\s]+)/);
        if (match) magnetLink = match[1];
      }
    }

    if (!magnetLink || !magnetLink.startsWith('magnet:')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid magnet URL. Must start with "magnet:"'
      });
    }

    const result = await transmissionAPI.addMagnet(magnetLink);

    if (result.success) {
      res.json({
        success: true,
        message: 'Magnet link added successfully!',
        hash: result.hash,
        id: result.id,
        name: result.name
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to add magnet link'
      });
    }
  } catch (error) {
    console.error('Error in add-magnet:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error while adding magnet link'
    });
  }
});

// Add torrent file
router.post('/add-file', authenticateToken, upload.single('torrent'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No torrent file uploaded'
      });
    }

    console.log('📁 Adding torrent file:', req.file.originalname);
    const result = await transmissionAPI.addTorrentFile(req.file.path);

    if (result.success) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.warn('Failed to cleanup uploaded file:', cleanupError.message);
      }

      res.json({
        success: true,
        message: 'Torrent file added successfully!',
        filename: req.file.originalname,
        hash: result.hash,
        id: result.id,
        name: result.name
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to add torrent file'
      });
    }
  } catch (error) {
    console.error('Error in add-file:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error while adding torrent file'
    });
  }
});

// Remove torrent
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { deleteFiles = true } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Torrent ID is required'
      });
    }

    console.log(`🗑️ Removing torrent ${id}, deleteFiles: ${deleteFiles}`);
    const result = await transmissionAPI.removeTorrent(id, deleteFiles);

    if (result.success) {
      res.json({
        success: true,
        message: 'Torrent removed successfully',
        id: id
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to remove torrent'
      });
    }
  } catch (error) {
    console.error('Error removing torrent:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while removing torrent'
    });
  }
});

// Download torrent files (ZIP for directories)
router.get('/download/:id', authenticateToken, async (req, res) => {
  try {
    console.log(`📦 Download request for torrent ID: ${req.params.id}`);
    const { id } = req.params;
    
    // Get torrent info
    const result = await transmissionAPI.makeRequest('torrent-get', {
      ids: [parseInt(id)],
      fields: ['id', 'name', 'files', 'downloadDir', 'isFinished', 'percentDone']
    });

    if (result.result !== 'success' || !result.arguments.torrents.length) {
      console.log(`❌ Torrent not found: ${id}`);
      return res.status(404).json({
        success: false,
        error: 'Torrent not found'
      });
    }

    const torrent = result.arguments.torrents[0];
    console.log(`🔥 Processing "${torrent.name}" - ${Math.round(torrent.percentDone * 100)}% complete`);
    
    // Allow downloads at 90% completion
    if (!torrent.isFinished && torrent.percentDone < 0.90) {
      return res.status(400).json({
        success: false,
        error: `Torrent is only ${Math.round(torrent.percentDone * 100)}% complete. Please wait for at least 90% completion.`
      });
    }

    const torrentPath = path.join(torrent.downloadDir, torrent.name);
    
    try {
      const stats = await fs.stat(torrentPath);
      console.log(`✅ Found ${stats.isDirectory() ? 'directory' : 'file'} at ${torrentPath}`);
      
      if (stats.isDirectory()) {
        // Directory - create ZIP
        const safeFileName = torrent.name.replace(/[^a-zA-Z0-9.-\s]/g, '_');
        
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}.zip"`);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Transfer-Encoding', 'chunked');
        
        console.log('🗜️ Creating ZIP archive...');
        
        const archive = archiver('zip', {
          zlib: { level: 1 }, // Fast compression
          forceLocalTime: true
        });

        let archiveError = false;

        archive.on('error', (err) => {
          console.error('❌ Archive error:', err);
          archiveError = true;
          if (!res.headersSent) {
            res.status(500).json({ success: false, error: 'Archive creation failed' });
          }
        });

        archive.on('end', () => {
          if (!archiveError) {
            console.log('✅ ZIP download completed successfully!');
          }
        });

        archive.pipe(res);
        archive.directory(torrentPath, safeFileName);
        archive.finalize();
        
      } else {
        // Single file - stream directly
        console.log('📄 Streaming single file...');
        const fileName = path.basename(torrent.name);
        
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        
        const fileStream = require('fs').createReadStream(torrentPath);
        fileStream.pipe(res);
        
        console.log('✅ File download initiated!');
      }
      
    } catch (error) {
      console.error(`❌ Files not found at ${torrentPath}`, error);
      return res.status(404).json({
        success: false,
        error: 'Downloaded files not found on server'
      });
    }

  } catch (error) {
    console.error('❌ Download error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: `Download failed: ${error.message}`
      });
    }
  }
});

module.exports = router;
