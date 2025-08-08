const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { authenticateToken } = require('../auth/auth');
const TransmissionAPI = require('../utils/transmission');
const router = express.Router();

const transmissionAPI = new TransmissionAPI();

// Get file list for a torrent
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`📋 Getting file list for torrent: ${id}`);
    
    const result = await transmissionAPI.makeRequest('torrent-get', {
      ids: [parseInt(id)],
      fields: ['id', 'name', 'files', 'fileStats', 'isFinished', 'percentDone', 'downloadDir']
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
      progress: file.length > 0 ? torrent.fileStats[index].bytesCompleted / file.length : 0,
      extension: path.extname(file.name).toLowerCase(),
      relativePath: file.name
    }));

    // Group files by directory
    const fileTree = {};
    files.forEach(file => {
      const pathParts = file.relativePath.split('/');
      let current = fileTree;
      
      pathParts.forEach((part, index) => {
        if (index === pathParts.length - 1) {
          // It's a file
          current[part] = {
            type: 'file',
            ...file
          };
        } else {
          // It's a directory
          if (!current[part]) {
            current[part] = {
              type: 'directory',
              children: {}
            };
          }
          current = current[part].children;
        }
      });
    });

    res.json({
      success: true,
      torrentId: torrent.id,
      torrentName: torrent.name,
      downloadDir: torrent.downloadDir,
      isFinished: torrent.isFinished,
      totalProgress: torrent.percentDone,
      totalFiles: files.length,
      files: files,
      fileTree: fileTree
    });

  } catch (error) {
    console.error('❌ Error getting file list:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while getting file list',
      details: error.message
    });
  }
});

// Browse directory contents (for file explorer)
router.get('/browse/:id/*', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const subPath = req.params[0] || '';
    
    console.log(`📁 Browsing torrent ${id}, path: ${subPath}`);
    
    // Get torrent info first
    const result = await transmissionAPI.makeRequest('torrent-get', {
      ids: [parseInt(id)],
      fields: ['id', 'name', 'downloadDir', 'isFinished', 'percentDone']
    });

    if (result.result !== 'success' || !result.arguments.torrents.length) {
      return res.status(404).json({
        success: false,
        error: 'Torrent not found'
      });
    }

    const torrent = result.arguments.torrents[0];
    const torrentPath = path.join(torrent.downloadDir, torrent.name);
    const fullPath = path.join(torrentPath, subPath);
    
    // Security check - ensure path is within torrent directory
    const normalizedTorrentPath = path.resolve(torrentPath);
    const normalizedFullPath = path.resolve(fullPath);
    
    if (!normalizedFullPath.startsWith(normalizedTorrentPath)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - path outside torrent directory'
      });
    }

    try {
      const stats = await fs.stat(fullPath);
      
      if (stats.isDirectory()) {
        // List directory contents
        const entries = await fs.readdir(fullPath, { withFileTypes: true });
        
        const contents = await Promise.all(
          entries.map(async (entry) => {
            const entryPath = path.join(fullPath, entry.name);
            const entryStats = await fs.stat(entryPath);
            
            return {
              name: entry.name,
              type: entry.isDirectory() ? 'directory' : 'file',
              size: entryStats.size,
              modified: entryStats.mtime,
              extension: entry.isFile() ? path.extname(entry.name).toLowerCase() : null,
              relativePath: path.join(subPath, entry.name)
            };
          })
        );

        res.json({
          success: true,
          torrentId: torrent.id,
          torrentName: torrent.name,
          currentPath: subPath,
          isDirectory: true,
          contents: contents.sort((a, b) => {
            // Directories first, then files, both alphabetically
            if (a.type !== b.type) {
              return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
          })
        });
        
      } else {
        // Single file info
        res.json({
          success: true,
          torrentId: torrent.id,
          torrentName: torrent.name,
          currentPath: subPath,
          isDirectory: false,
          file: {
            name: path.basename(fullPath),
            size: stats.size,
            modified: stats.mtime,
            extension: path.extname(fullPath).toLowerCase()
          }
        });
      }
      
    } catch (error) {
      console.error(`❌ Path not accessible: ${fullPath}`, error);
      return res.status(404).json({
        success: false,
        error: 'Path not found or not accessible'
      });
    }

  } catch (error) {
    console.error('❌ Error browsing files:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while browsing files',
      details: error.message
    });
  }
});

module.exports = router;
