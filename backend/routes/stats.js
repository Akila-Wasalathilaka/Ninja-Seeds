const express = require('express');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs').promises;
const TransmissionAPI = require('../utils/transmission');
const router = express.Router();

router.get('/stats', async (req, res) => {
  try {
    // Get torrent stats from Transmission
    const transmissionAPI = new TransmissionAPI();
    let torrentStats = {
      totalTorrents: 0,
      activeDownloads: 0,
      seedingTorrents: 0,
      diskUsage: 0
    };

    try {
      const torrentsData = await transmissionAPI.getTorrents();
      if (torrentsData && torrentsData.success && torrentsData.torrents) {
        const torrents = torrentsData.torrents;
        torrentStats.totalTorrents = torrents.length;
        torrentStats.activeDownloads = torrents.filter(t => 
          t.status === 'downloading' || t.downloadSpeed > 0
        ).length;
        torrentStats.seedingTorrents = torrents.filter(t => 
          t.status === 'seeding' || (t.isFinished && t.uploadSpeed > 0)
        ).length;
        // Get actual disk usage from system, not torrent sizes
        const diskInfo = await getDiskUsage();
        torrentStats.diskUsage = diskInfo.percentage;
      }
    } catch (transmissionError) {
      console.error('Transmission API error:', transmissionError);
      // Continue with default values if Transmission is unavailable
    }

    const stats = {
      disk: await getDiskUsage(),
      memory: getMemoryUsage(),
      cpu: await getCpuUsage(),
      system: getSystemInfo(),
      ...torrentStats
    };

    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system stats'
    });
  }
});

async function getDiskUsage() {
  try {
    return new Promise((resolve) => {
      exec('df -h /mnt/ninjaseeds 2>/dev/null || df -h /', (error, stdout) => {
        if (error) {
          resolve({
            total: 50 * 1024 * 1024 * 1024, // 50GB default
            used: 0,
            free: 50 * 1024 * 1024 * 1024,
            percentage: 0
          });
          return;
        }

        const lines = stdout.trim().split('\n');
        if (lines.length > 1) {
          const parts = lines[1].split(/\s+/);
          const total = parseSize(parts[1]);
          const used = parseSize(parts[2]);
          const free = parseSize(parts[3]);
          const percentage = parseInt(parts[4]);

          resolve({
            total,
            used,
            free,
            percentage
          });
        } else {
          resolve({
            total: 50 * 1024 * 1024 * 1024,
            used: 0,
            free: 50 * 1024 * 1024 * 1024,
            percentage: 0
          });
        }
      });
    });
  } catch (error) {
    return {
      total: 50 * 1024 * 1024 * 1024,
      used: 0,
      free: 50 * 1024 * 1024 * 1024,
      percentage: 0
    };
  }
}

function parseSize(sizeStr) {
  const units = { K: 1024, M: 1024**2, G: 1024**3, T: 1024**4 };
  const match = sizeStr.match(/^(\d+(?:\.\d+)?)([KMGT]?)$/);
  if (!match) return 0;
  
  const [, size, unit] = match;
  return parseFloat(size) * (units[unit] || 1);
}

function getMemoryUsage() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const percentage = Math.round((used / total) * 100);

  return {
    total,
    used,
    free,
    percentage
  };
}

async function getCpuUsage() {
  return new Promise((resolve) => {
    const startMeasure = getCpuInfo();
    
    setTimeout(() => {
      const endMeasure = getCpuInfo();
      const idleDifference = endMeasure.idle - startMeasure.idle;
      const totalDifference = endMeasure.total - startMeasure.total;
      const usage = Math.round(100 - (100 * idleDifference / totalDifference));
      
      resolve({
        usage: Math.max(0, Math.min(100, usage)),
        cores: os.cpus().length
      });
    }, 1000);
  });
}

function getCpuInfo() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;

  cpus.forEach(cpu => {
    for (let type in cpu.times) {
      total += cpu.times[type];
    }
    idle += cpu.times.idle;
  });

  return { idle, total };
}

function getSystemInfo() {
  return {
    uptime: os.uptime(),
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname()
  };
}

module.exports = router;
