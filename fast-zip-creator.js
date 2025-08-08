const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

class FastZipCreator {
  constructor() {
    this.downloadDir = '/var/www/downloads';
    this.torrentDir = '/mnt/ninjaseeds';
  }

  async createFastZip(torrentName, torrentId) {
    try {
      const sourcePath = path.join(this.torrentDir, torrentName);
      const safeFileName = torrentName.replace(/[^a-zA-Z0-9.-\s]/g, '_');
      const zipPath = path.join(this.downloadDir, `${safeFileName}_${torrentId}.zip`);
      
      console.log(`🚀 Creating ultra-fast ZIP: ${safeFileName}`);
      
      // Check if source exists
      try {
        await fs.access(sourcePath);
      } catch (error) {
        throw new Error(`Source not found: ${sourcePath}`);
      }
      
      // Create ZIP with store mode (no compression) for maximum speed
      const zipCommand = `cd "${this.torrentDir}" && zip -0 -r "${zipPath}" "${torrentName}"`;
      
      return new Promise((resolve, reject) => {
        exec(zipCommand, { maxBuffer: 1024 * 1024 * 100 }, async (error, stdout, stderr) => {
          if (error) {
            console.error('❌ ZIP creation failed:', error);
            reject(error);
            return;
          }
          
          try {
            const stats = await fs.stat(zipPath);
            const downloadUrl = `/downloads/${path.basename(zipPath)}`;
            
            console.log(`✅ Fast ZIP created: ${(stats.size / 1024 / 1024).toFixed(1)}MB`);
            
            resolve({
              success: true,
              zipPath,
              downloadUrl,
              size: stats.size,
              filename: path.basename(zipPath)
            });
          } catch (statError) {
            reject(statError);
          }
        });
      });
      
    } catch (error) {
      console.error('❌ Fast ZIP error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async cleanupOldZips() {
    try {
      const files = await fs.readdir(this.downloadDir);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      for (const file of files) {
        if (file.endsWith('.zip')) {
          const filePath = path.join(this.downloadDir, file);
          const stats = await fs.stat(filePath);
          
          if (now - stats.mtime.getTime() > maxAge) {
            await fs.unlink(filePath);
            console.log(`🗑️ Cleaned up old ZIP: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
  }
}

module.exports = FastZipCreator;