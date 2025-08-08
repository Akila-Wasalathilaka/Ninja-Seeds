const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const archiver = require('archiver');
const jwt = require('jsonwebtoken');
const CleanupManager = require('../utils/cleanup');
const router = express.Router();

const cleanup = new CleanupManager();

const JWT_SECRET = process.env.JWT_SECRET || 'seedr-secret-key-2025';

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

// Transmission API Class
class TransmissionAPI {
  constructor() {
    this.baseURL = 'http://localhost:9091/transmission/rpc';
    this.sessionId = null;
  }

  async getSessionId() {
    try {
      await axios.post(this.baseURL, {});
    } catch (error) {
      if (error.response && error.response.status === 409) {
        this.sessionId = error.response.headers['x-transmission-session-id'];
        return this.sessionId;
      }
      throw new Error('Failed to get session ID from Transmission');
    }
  }

  async makeRequest(method, arguments_obj = {}) {
    try {
      if (!this.sessionId) {
        await this.getSessionId();
      }

      const requestData = {
        method: method,
        arguments: arguments_obj
      };

      const response = await axios.post(this.baseURL, requestData, {
        headers: {
          'X-Transmission-Session-Id': this.sessionId
        },
        timeout: 10000
      });

      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 409) {
        this.sessionId = error.response.headers['x-transmission-session-id'];
        
        const requestData = {
          method: method,
          arguments: arguments_obj
        };

        const response = await axios.post(this.baseURL, requestData, {
          headers: {
            'X-Transmission-Session-Id': this.sessionId
          },
          timeout: 10000
        });

        return response.data;
      }
      throw error;
    }
  }

  async addMagnet(magnetLink) {
    try {
      const result = await this.makeRequest('torrent-add', {
        filename: magnetLink,
        'download-dir': '/mnt/ninjaseeds',
        paused: false,
        'seed-ratio-limit': -1,
        'seed-idle-limit': -1,
        'honor-limits-on-battery': false,
        'peer-limit': 200,
        'priority': 'high',
        'bandwidth-priority': 1
      });

      if (result.result === 'success') {
        const torrent = result.arguments['torrent-added'] || result.arguments['torrent-duplicate'];
        return {
          success: true,
          hash: torrent.hashString,
          id: torrent.id,
          name: torrent.name
        };
      } else {
        return {
          success: false,
          error: result.result
        };
      }
    } catch (error) {
      console.error('Error adding magnet:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async addTorrentFile(filePath) {
    try {
      const torrentData = await fs.readFile(filePath);
      const base64Data = torrentData.toString('base64');

      const result = await this.makeRequest('torrent-add', {
        metainfo: base64Data,
        'download-dir': '/mnt/ninjaseeds',
        paused: false,
        'seed-ratio-limit': -1,
        'seed-idle-limit': -1,
        'honor-limits-on-battery': false,
        'peer-limit': 200,
        'priority': 'high',
        'bandwidth-priority': 1
      });

      if (result.result === 'success') {
        const torrent = result.arguments['torrent-added'] || result.arguments['torrent-duplicate'];
        
        // Explicitly start the torrent
        try {
          await this.makeRequest('torrent-start', {
            ids: [torrent.id]
          });
          console.log(`Started torrent: ${torrent.name}`);
        } catch (startError) {
          console.warn('Failed to start torrent:', startError.message);
        }
        
        return {
          success: true,
          hash: torrent.hashString,
          id: torrent.id,
          name: torrent.name
        };
      } else {
        return {
          success: false,
          error: result.result
        };
      }
    } catch (error) {
      console.error('Error adding torrent file:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getTorrents() {
    try {
      const result = await this.makeRequest('torrent-get', {
        fields: [
          'id', 'name', 'hashString', 'totalSize', 'percentDone',
          'status', 'rateDownload', 'rateUpload', 'uploadRatio',
          'seeders', 'leechers', 'eta', 'downloadDir', 'isFinished',
          'addedDate', 'activityDate', 'peersConnected', 'peersGettingFromUs',
          'peersSendingToUs', 'sizeWhenDone', 'leftUntilDone', 'recheckProgress'
        ]
      });

      if (result.result === 'success') {
        const torrents = result.arguments.torrents.map(torrent => ({
          id: torrent.id,
          name: torrent.name,
          hash: torrent.hashString,
          size: torrent.totalSize,
          progress: torrent.percentDone,
          status: this.getStatusText(torrent.status),
          downloadSpeed: torrent.rateDownload || 0,
          uploadSpeed: torrent.rateUpload || 0,
          ratio: torrent.uploadRatio || 0,
          seeders: torrent.seeders || 0,
          leechers: torrent.leechers || 0,
          eta: torrent.eta === -1 ? -1 : torrent.eta,
          downloadDir: torrent.downloadDir,
          isFinished: torrent.isFinished,
          addedDate: torrent.addedDate ? new Date(torrent.addedDate * 1000) : null,
          activityDate: torrent.activityDate ? new Date(torrent.activityDate * 1000) : null,
          peersConnected: torrent.peersConnected || 0,
          peersGettingFromUs: torrent.peersGettingFromUs || 0,
          peersSendingToUs: torrent.peersSendingToUs || 0,
          sizeWhenDone: torrent.sizeWhenDone || torrent.totalSize,
          leftUntilDone: torrent.leftUntilDone || 0,
          recheckProgress: torrent.recheckProgress || 0
        }));

        return {
          success: true,
          torrents: torrents
        };
      } else {
        return {
          success: false,
          error: result.result
        };
      }
    } catch (error) {
      console.error('Error getting torrents:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  getStatusText(status) {
    const statusMap = {
      0: 'stopped',
      1: 'check-wait',
      2: 'checking',
      3: 'download-wait',
      4: 'downloading',
      5: 'seed-wait',
      6: 'seeding'
    };
    return statusMap[status] || 'unknown';
  }

  async removeTorrent(torrentId, deleteData = false) {
    try {
      const result = await this.makeRequest('torrent-remove', {
        ids: [parseInt(torrentId)],
        'delete-local-data': deleteData
      });

      return {
        success: result.result === 'success',
        error: result.result !== 'success' ? result.result : null
      };
    } catch (error) {
      console.error('Error removing torrent:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async pauseTorrent(torrentId) {
    try {
      const result = await this.makeRequest('torrent-stop', {
        ids: [parseInt(torrentId)]
      });

      return {
        success: result.result === 'success',
        error: result.result !== 'success' ? result.result : null
      };
    } catch (error) {
      console.error('Error pausing torrent:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async resumeTorrent(torrentId) {
    try {
      const result = await this.makeRequest('torrent-start', {
        ids: [parseInt(torrentId)]
      });

      return {
        success: result.result === 'success',
        error: result.result !== 'success' ? result.result : null
      };
    } catch (error) {
      console.error('Error resuming torrent:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

const transmissionAPI = new TransmissionAPI();

// Routes

// Add magnet link
router.post('/add-magnet', async (req, res) => {
  try {
    console.log('Request body:', req.body);
    
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
router.post('/add-file', upload.single('torrent'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No torrent file uploaded'
      });
    }

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

// Get all torrents
router.get('/', async (req, res) => {
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

// Remove torrent with auto-cleanup
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { deleteFiles = true } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Torrent ID is required'
      });
    }

    const result = await transmissionAPI.removeTorrent(id, deleteFiles);

    if (result.success) {
      // Auto-cleanup after torrent removal
      cleanup.fullCleanup().catch(err => console.error('Cleanup failed:', err));
      
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

// INSTANT DOWNLOAD - NINJA SEEDS (Full Torrent)
router.get('/download/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await transmissionAPI.makeRequest('torrent-get', {
      ids: [parseInt(id)],
      fields: ['id', 'name', 'downloadDir', 'isFinished', 'percentDone', 'totalSize']
    });

    if (result.result !== 'success' || !result.arguments.torrents.length) {
      return res.status(404).json({ success: false, error: 'Torrent not found' });
    }

    const torrent = result.arguments.torrents[0];
    
    if (!torrent.isFinished && torrent.percentDone < 0.90) {
      return res.status(400).json({
        success: false,
        error: `Torrent is only ${Math.round(torrent.percentDone * 100)}% complete.`
      });
    }

    const torrentPath = path.join(torrent.downloadDir, torrent.name);
    const stats = await fs.stat(torrentPath);
    
    if (stats.isDirectory()) {
      // ZIP streaming
      const safeFileName = torrent.name.replace(/[^a-zA-Z0-9.-\s]/g, '_');
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}.zip"`);
      res.setHeader('Accept-Ranges', 'bytes');
      
      const archive = archiver('zip', { zlib: { level: 0 } });
      archive.pipe(res);
      archive.directory(torrentPath, safeFileName);
      archive.finalize();
      
    } else {
      // Direct file
      const fileName = path.basename(torrent.name);
      const range = req.headers.range;
      
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
        
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${stats.size}`);
        res.setHeader('Content-Length', (end - start) + 1);
        
        require('fs').createReadStream(torrentPath, { start, end }).pipe(res);
      } else {
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        
        require('fs').createReadStream(torrentPath).pipe(res);
      }
      
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', 'application/octet-stream');
    }

  } catch (error) {
    console.error('Download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Download failed' });
    }
  }
});

// Pause torrent
router.post('/:id/pause', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await transmissionAPI.pauseTorrent(id);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Torrent paused successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to pause torrent'
      });
    }
  } catch (error) {
    console.error('Error pausing torrent:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while pausing torrent'
    });
  }
});

// Resume torrent
router.post('/:id/resume', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await transmissionAPI.resumeTorrent(id);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Torrent resumed successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to resume torrent'
      });
    }
  } catch (error) {
    console.error('Error resuming torrent:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while resuming torrent'
    });
  }
});

// INSTANT DOWNLOAD - Individual File
router.get('/:id/file/:fileIndex', async (req, res) => {
  try {
    const { id, fileIndex } = req.params;
    
    const result = await transmissionAPI.makeRequest('torrent-get', {
      ids: [parseInt(id)],
      fields: ['id', 'name', 'files', 'downloadDir']
    });

    if (result.result !== 'success' || !result.arguments.torrents.length) {
      return res.status(404).json({ success: false, error: 'Torrent not found' });
    }

    const torrent = result.arguments.torrents[0];
    const file = torrent.files[parseInt(fileIndex)];
    
    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    const filePath = path.join(torrent.downloadDir, file.name);
    
    try {
      const stats = await fs.stat(filePath);
      const fileName = path.basename(file.name);
      
      // Set headers for instant download
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'no-cache');
      
      // Handle range requests for large files
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
        
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${stats.size}`);
        res.setHeader('Content-Length', (end - start) + 1);
        
        require('fs').createReadStream(filePath, { start, end }).pipe(res);
      } else {
        require('fs').createReadStream(filePath).pipe(res);
      }
      
    } catch (error) {
      return res.status(404).json({ success: false, error: 'File not found on disk' });
    }

  } catch (error) {
    console.error('Individual file download error:', error);
    res.status(500).json({ success: false, error: 'Download failed' });
  }
});

// Get file list for a torrent
router.get('/:id/files', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await transmissionAPI.makeRequest('torrent-get', {
      ids: [parseInt(id)],
      fields: ['id', 'name', 'files', 'fileStats', 'isFinished', 'percentDone']
    });

    if (result.result !== 'success' || !result.arguments.torrents.length) {
      return res.status(404).json({
        success: false,
        error: 'Torrent not found'
      });
    }

    const torrent = result.arguments.torrents[0];
    
    const files = torrent.files.map((file, index) => ({
      index: index,
      name: file.name,
      size: file.length,
      bytesCompleted: torrent.fileStats[index].bytesCompleted,
      priority: torrent.fileStats[index].priority,
      wanted: torrent.fileStats[index].wanted,
      progress: file.length > 0 ? torrent.fileStats[index].bytesCompleted / file.length : 0
    }));

    res.json({
      success: true,
      torrentId: torrent.id,
      torrentName: torrent.name,
      isFinished: torrent.isFinished,
      totalProgress: torrent.percentDone,
      files: files
    });

  } catch (error) {
    console.error('Error getting file list:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while getting file list'
    });
  }
});

// Manual cleanup endpoint
router.post('/cleanup', async (req, res) => {
  try {
    await cleanup.fullCleanup();
    const usage = await cleanup.getStorageUsage();
    
    res.json({
      success: true,
      message: 'Cleanup completed successfully',
      storageUsage: `${usage}%`
    });
  } catch (error) {
    console.error('Manual cleanup failed:', error);
    res.status(500).json({
      success: false,
      error: 'Cleanup failed'
    });
  }
});

// SPEED OPTIMIZATION - Auto-download when seeding finishes
router.get('/:id/speed-download', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await transmissionAPI.makeRequest('torrent-get', {
      ids: [parseInt(id)],
      fields: ['id', 'name', 'downloadDir', 'isFinished', 'percentDone', 'status']
    });

    if (result.result !== 'success' || !result.arguments.torrents.length) {
      return res.status(404).json({ success: false, error: 'Torrent not found' });
    }

    const torrent = result.arguments.torrents[0];
    
    // Check if torrent is ready for download (100% complete or seeding)
    if (torrent.percentDone >= 1.0 || torrent.status === 6) { // status 6 = seeding
      const torrentPath = path.join(torrent.downloadDir, torrent.name);
      const stats = await fs.stat(torrentPath);
      
      if (stats.isDirectory()) {
        // ZIP streaming with speed optimization
        const safeFileName = torrent.name.replace(/[^a-zA-Z0-9.-\s]/g, '_');
        
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}.zip"`);
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        const archive = archiver('zip', { 
          zlib: { level: 1 }, // Fast compression
          store: true // Store without compression for speed
        });
        
        archive.pipe(res);
        archive.directory(torrentPath, safeFileName);
        archive.finalize();
        
      } else {
        // Direct file with speed headers
        const fileName = path.basename(torrent.name);
        
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        require('fs').createReadStream(torrentPath, { highWaterMark: 64 * 1024 }).pipe(res);
      }
    } else {
      res.status(400).json({
        success: false,
        error: `Torrent not ready. Progress: ${Math.round(torrent.percentDone * 100)}%`
      });
    }

  } catch (error) {
    console.error('Speed download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Speed download failed' });
    }
  }
});

module.exports = router;
