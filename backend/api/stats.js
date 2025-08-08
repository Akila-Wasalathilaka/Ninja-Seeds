const express = require('express');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const { authenticateToken } = require('../auth/auth');
const router = express.Router();

const execAsync = promisify(exec);

// Get system statistics
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('📊 Fetching system stats...');

    // Get disk usage
    const diskCmd = "df -h /mnt/ninjaseeds 2>/dev/null || df -h /";
    const { stdout: diskOutput } = await execAsync(diskCmd);
    
    // Parse disk usage
    const diskLines = diskOutput.trim().split('\n');
    const diskData = diskLines[diskLines.length - 1].split(/\s+/);
    
    const diskStats = {
      total: diskData[1] || 'N/A',
      used: diskData[2] || 'N/A',
      available: diskData[3] || 'N/A',
      usedPercent: diskData[4] || 'N/A',
      mountPoint: diskData[5] || '/'
    };

    // Get memory usage
    const { stdout: memOutput } = await execAsync("free -h");
    const memLines = memOutput.trim().split('\n');
    const memData = memLines[1].split(/\s+/);
    
    const memStats = {
      total: memData[1] || 'N/A',
      used: memData[2] || 'N/A',
      free: memData[3] || 'N/A',
      available: memData[6] || 'N/A'
    };

    // Get CPU usage
    const { stdout: cpuOutput } = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1");
    const cpuUsage = parseFloat(cpuOutput.trim()) || 0;

    // Get load average
    const { stdout: loadOutput } = await execAsync("uptime | awk -F'load average:' '{print $2}'");
    const loadAverage = loadOutput.trim();

    // Get torrent directory size
    let torrentDirSize = 'N/A';
    try {
      const { stdout: sizeOutput } = await execAsync("du -sh /mnt/ninjaseeds 2>/dev/null || echo '0B'");
      torrentDirSize = sizeOutput.trim().split('\t')[0];
    } catch (error) {
      console.warn('Could not get torrent directory size:', error.message);
    }

    // Get uptime
    const { stdout: uptimeOutput } = await execAsync("uptime -p");
    const uptime = uptimeOutput.trim().replace('up ', '');

    // Get network stats (optional)
    let networkStats = {};
    try {
      const { stdout: netOutput } = await execAsync("cat /proc/net/dev | grep -E 'eth0|ens|enp' | head -1");
      if (netOutput) {
        const netData = netOutput.trim().split(/\s+/);
        networkStats = {
          interface: netData[0].replace(':', ''),
          rxBytes: parseInt(netData[1]) || 0,
          txBytes: parseInt(netData[9]) || 0
        };
      }
    } catch (error) {
      console.warn('Could not get network stats:', error.message);
    }

    const stats = {
      success: true,
      timestamp: new Date().toISOString(),
      disk: diskStats,
      memory: memStats,
      cpu: {
        usage: cpuUsage,
        loadAverage: loadAverage
      },
      system: {
        uptime: uptime,
        torrentDirSize: torrentDirSize
      },
      network: networkStats
    };

    console.log('✅ System stats fetched successfully');
    res.json(stats);

  } catch (error) {
    console.error('❌ Error fetching system stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system statistics',
      details: error.message
    });
  }
});

// Get transmission daemon status
router.get('/transmission', authenticateToken, async (req, res) => {
  try {
    // Check if transmission daemon is running
    const { stdout: processOutput } = await execAsync("pgrep -f transmission-daemon || echo 'not_running'");
    const isRunning = processOutput.trim() !== 'not_running';

    // Get transmission version
    let version = 'Unknown';
    try {
      const { stdout: versionOutput } = await execAsync("transmission-daemon --version 2>/dev/null | head -1");
      version = versionOutput.trim();
    } catch (error) {
      console.warn('Could not get transmission version:', error.message);
    }

    // Get configuration info
    let configPath = '/etc/transmission-daemon/settings.json';
    let configExists = false;
    try {
      await fs.access(configPath);
      configExists = true;
    } catch (error) {
      configPath = '/var/lib/transmission-daemon/.config/transmission-daemon/settings.json';
      try {
        await fs.access(configPath);
        configExists = true;
      } catch (error) {
        console.warn('Could not find transmission config file');
      }
    }

    res.json({
      success: true,
      transmission: {
        running: isRunning,
        version: version,
        configPath: configExists ? configPath : 'Not found',
        configExists: configExists,
        pid: isRunning ? processOutput.trim() : null
      }
    });

  } catch (error) {
    console.error('❌ Error checking transmission status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check transmission status',
      details: error.message
    });
  }
});

module.exports = router;
