const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class CleanupManager {
  constructor() {
    this.downloadDir = process.env.DOWNLOAD_DIR || '/mnt/ninjaseeds';
    this.tempDir = '/tmp';
    this.maxStoragePercent = 90; // Clean when storage > 90%
  }

  async getStorageUsage() {
    try {
      const { stdout } = await execAsync(`df -h ${this.downloadDir} | tail -1`);
      const usage = stdout.split(/\s+/)[4].replace('%', '');
      return parseInt(usage);
    } catch (error) {
      console.error('Failed to get storage usage:', error.message);
      return 0;
    }
  }

  async cleanTempFiles() {
    try {
      // Clean /tmp torrent files
      await execAsync('find /tmp -name "*.torrent" -mtime +1 -delete 2>/dev/null || true');
      
      // Clean old temp files
      await execAsync('find /tmp -type f -mtime +7 -delete 2>/dev/null || true');
      
      console.log('✅ Temp files cleaned');
    } catch (error) {
      console.error('❌ Temp cleanup failed:', error.message);
    }
  }

  async cleanTransmissionCache() {
    try {
      // Clean transmission resume files for removed torrents
      await execAsync('find /var/lib/transmission-daemon/.config/transmission-daemon/resume -name "*.resume" -mtime +1 -delete 2>/dev/null || true');
      
      // Clean transmission torrents folder
      await execAsync('find /var/lib/transmission-daemon/.config/transmission-daemon/torrents -name "*.torrent" -mtime +1 -delete 2>/dev/null || true');
      
      console.log('✅ Transmission cache cleaned');
    } catch (error) {
      console.error('❌ Transmission cleanup failed:', error.message);
    }
  }

  async cleanOrphanedFiles() {
    try {
      // Remove empty directories
      await execAsync(`find ${this.downloadDir} -type d -empty -delete 2>/dev/null || true`);
      
      console.log('✅ Orphaned files cleaned');
    } catch (error) {
      console.error('❌ Orphaned cleanup failed:', error.message);
    }
  }

  async forceCleanup() {
    try {
      const usage = await this.getStorageUsage();
      
      if (usage > this.maxStoragePercent) {
        console.log(`🧹 Storage at ${usage}%, forcing cleanup...`);
        
        // Clean old completed torrents (older than 7 days)
        await execAsync(`find ${this.downloadDir} -type f -mtime +7 -delete 2>/dev/null || true`);
        
        // Clear system cache
        await execAsync('sync && echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true');
        
        console.log('✅ Force cleanup completed');
      }
    } catch (error) {
      console.error('❌ Force cleanup failed:', error.message);
    }
  }

  async fullCleanup() {
    console.log('🧹 Starting automatic cleanup...');
    
    await Promise.all([
      this.cleanTempFiles(),
      this.cleanTransmissionCache(),
      this.cleanOrphanedFiles()
    ]);
    
    await this.forceCleanup();
    
    const usage = await this.getStorageUsage();
    console.log(`✅ Cleanup completed. Storage usage: ${usage}%`);
  }
}

module.exports = CleanupManager;