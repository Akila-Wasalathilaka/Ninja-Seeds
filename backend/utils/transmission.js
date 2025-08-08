const fs = require('fs').promises;
const axios = require('axios');

class TransmissionAPI {
  constructor() {
    this.baseURL = process.env.TRANSMISSION_RPC_URL || 'http://localhost:9091/transmission/rpc';
    this.sessionId = null;
    this.downloadDir = process.env.DOWNLOAD_DIR || '/mnt/ninjaseeds';
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
        timeout: 15000
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
          timeout: 15000
        });

        return response.data;
      }
      throw error;
    }
  }

  async addMagnet(magnetLink) {
    try {
      console.log('🧲 Adding magnet to Transmission...');
      const result = await this.makeRequest('torrent-add', {
        filename: magnetLink,
        'download-dir': this.downloadDir,
        paused: false,
        'seed-ratio-limit': -1,          // Unlimited seeding ratio
        'seed-idle-limit': -1,           // Unlimited seeding time
        'honor-limits-on-battery': false,
        'peer-limit': 200,               // More peers for better speeds
        'priority': 'high',
        'bandwidth-priority': 1
      });

      if (result.result === 'success') {
        const torrent = result.arguments['torrent-added'] || result.arguments['torrent-duplicate'];
        console.log(`✅ Magnet added: ${torrent.name}`);
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
      console.error('❌ Error adding magnet:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async addTorrentFile(filePath) {
    try {
      console.log('📁 Adding torrent file to Transmission...');
      const torrentData = await fs.readFile(filePath);
      const base64Data = torrentData.toString('base64');

      const result = await this.makeRequest('torrent-add', {
        metainfo: base64Data,
        'download-dir': this.downloadDir,
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
          console.log(`✅ Torrent started: ${torrent.name}`);
        } catch (startError) {
          console.warn('⚠️ Failed to start torrent:', startError.message);
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
      console.error('❌ Error adding torrent file:', error.message);
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
      console.error('❌ Error getting torrents:', error.message);
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
      console.log(`🗑️ Removing torrent ${torrentId}, delete data: ${deleteData}`);
      const result = await this.makeRequest('torrent-remove', {
        ids: [parseInt(torrentId)],
        'delete-local-data': deleteData
      });

      return {
        success: result.result === 'success',
        error: result.result !== 'success' ? result.result : null
      };
    } catch (error) {
      console.error('❌ Error removing torrent:', error.message);
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
      console.error('❌ Error pausing torrent:', error.message);
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
      console.error('❌ Error resuming torrent:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = TransmissionAPI;
