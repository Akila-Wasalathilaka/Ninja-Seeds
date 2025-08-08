const axios = require('axios');

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
      throw new Error('Failed to get session ID');
    }
  }

  async makeRequest(method, arguments_obj = {}) {
    if (!this.sessionId) {
      await this.getSessionId();
    }

    try {
      const response = await axios.post(this.baseURL, {
        method: method,
        arguments: arguments_obj
      }, {
        headers: {
          'X-Transmission-Session-Id': this.sessionId
        }
      });
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 409) {
        this.sessionId = error.response.headers['x-transmission-session-id'];
        const response = await axios.post(this.baseURL, {
          method: method,
          arguments: arguments_obj
        }, {
          headers: {
            'X-Transmission-Session-Id': this.sessionId
          }
        });
        return response.data;
      }
      throw error;
    }
  }

  async addPublicTrackers(torrentId) {
    const publicTrackers = [
      'udp://tracker.openbittorrent.com:80/announce',
      'udp://tracker.opentrackr.org:1337/announce',
      'udp://open.stealth.si:80/announce',
      'udp://tracker.torrent.eu.org:451/announce',
      'udp://exodus.desync.com:6969/announce',
      'udp://tracker.moeking.me:6969/announce'
    ];

    try {
      const result = await this.makeRequest('torrent-set', {
        ids: [parseInt(torrentId)],
        trackerAdd: publicTrackers
      });
      
      console.log(`Added ${publicTrackers.length} public trackers to torrent ${torrentId}`);
      return result;
    } catch (error) {
      console.error('Error adding trackers:', error.message);
    }
  }

  async getTorrents() {
    const result = await this.makeRequest('torrent-get', {
      fields: ['id', 'name']
    });
    return result.arguments.torrents;
  }
}

async function main() {
  const api = new TransmissionAPI();
  
  try {
    const torrents = await api.getTorrents();
    
    for (const torrent of torrents) {
      console.log(`Adding trackers to: ${torrent.name}`);
      await api.addPublicTrackers(torrent.id);
    }
    
    console.log('✅ Public trackers added to all torrents!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();