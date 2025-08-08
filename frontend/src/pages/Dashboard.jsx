import React, { useState, useEffect } from 'react'
import { 
  Download, 
  Upload, 
  Play, 
  Pause, 
  Trash2, 
  RefreshCw,
  FileDown,
  Clock,
  Users,
  ChevronDown,
  ChevronUp,
  File
} from 'lucide-react'
import toast from 'react-hot-toast'
import { api, formatBytes, formatSpeed, formatTime, getStatusColor } from '../utils/api'

export default function Dashboard({ onStatsUpdate }) {
  const [torrents, setTorrents] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [expandedTorrent, setExpandedTorrent] = useState(null)
  const [torrentFiles, setTorrentFiles] = useState({})

  useEffect(() => {
    fetchTorrents()
    const interval = setInterval(fetchTorrents, 3000) // Refresh every 3 seconds for real-time updates
    return () => clearInterval(interval)
  }, [])

  const fetchTorrents = async () => {
    try {
      setIsRefreshing(true)
      const response = await api.get('/torrents')
      setTorrents(response.data.torrents || [])
      onStatsUpdate && onStatsUpdate()
    } catch (error) {
      console.error('Failed to fetch torrents:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const removeTorrent = async (id, name) => {
    if (!confirm(`Remove torrent "${name}"? This will delete the files.`)) return
    
    try {
      await api.delete(`/torrents/${id}`, { data: { deleteFiles: true } })
      toast.success('Torrent removed successfully')
      fetchTorrents()
    } catch (error) {
      // Error handled by interceptor
    }
  }

  const pauseTorrent = async (id, name) => {
    try {
      await api.post(`/torrents/${id}/pause`)
      toast.success(`Paused "${name}"`)
      fetchTorrents()
    } catch (error) {
      // Error handled by interceptor
    }
  }

  const resumeTorrent = async (id, name) => {
    try {
      await api.post(`/torrents/${id}/resume`)
      toast.success(`Resumed "${name}"`)
      fetchTorrents()
    } catch (error) {
      // Error handled by interceptor
    }
  }

  const toggleFileList = async (torrentId) => {
    if (expandedTorrent === torrentId) {
      setExpandedTorrent(null)
      return
    }
    
    if (!torrentFiles[torrentId]) {
      try {
        const response = await api.get(`/torrents/${torrentId}/files`)
        setTorrentFiles(prev => ({
          ...prev,
          [torrentId]: response.data.files || []
        }))
      } catch (error) {
        return
      }
    }
    
    setExpandedTorrent(torrentId)
  }

  const downloadFile = async (torrentId, fileIndex, fileName) => {
    try {
      toast.loading(`Starting ${fileName} download...`)
      
      // Direct download link for instant speed
      window.open(`${api.defaults.baseURL}/torrents/${torrentId}/file/${fileIndex}`, '_blank')
      
      toast.success('File download started!')
    } catch (error) {
      toast.error('Download failed')
    }
  }

  const downloadTorrent = async (id, name) => {
    try {
      toast.loading(`Starting instant download...`)
      
      // Use speed-optimized download endpoint
      window.open(`${api.defaults.baseURL}/torrents/${id}/speed-download`, '_blank')
      
      toast.success('Download started!')
    } catch (error) {
      toast.error('Download failed')
    }
  }

  const getProgressColor = (progress) => {
    if (progress >= 1) return 'bg-success-500'
    if (progress >= 0.5) return 'bg-primary-500'
    return 'bg-warning-500'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <RefreshCw className="animate-spin" size={20} />
          <span>Loading torrents...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 text-sm sm:text-base">Manage your torrent downloads</p>
        </div>
        <button
          onClick={fetchTorrents}
          disabled={isRefreshing}
          className="btn btn-secondary flex items-center justify-center space-x-2 w-full sm:w-auto"
        >
          <RefreshCw className={isRefreshing ? 'animate-spin' : ''} size={18} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Torrents Grid */}
      {torrents.length === 0 ? (
        <div className="card text-center py-8 sm:py-12">
          <div className="mx-auto w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mb-4">
            <Download size={24} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No torrents yet</h3>
          <p className="text-gray-400 mb-4">Add your first torrent to get started</p>
          <a href="/add" className="btn btn-primary">
            Add Torrent
          </a>
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-6">
          {torrents.map((torrent) => (
            <div key={torrent.id} className="card">
              {/* Mobile Header */}
              <div className="sm:hidden mb-4">
                <h3 className="text-sm font-medium text-white mb-3 break-words leading-tight">
                  {torrent.name}
                </h3>
                <div className="flex items-center justify-between text-xs">
                  <span className={`font-medium ${getStatusColor(torrent.status)} px-2 py-1 rounded text-xs`}>
                    {torrent.status}
                  </span>
                  <div className="text-right">
                    <div className="text-gray-300 font-medium">{formatBytes(torrent.size)}</div>
                    <div className="text-gray-400">Ratio: {torrent.ratio?.toFixed(2) || '0.00'}</div>
                  </div>
                </div>
              </div>

              {/* Desktop Header */}
              <div className="hidden sm:flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-medium text-white mb-1 truncate">
                    {torrent.name}
                  </h3>
                  <div className="flex items-center space-x-4 text-sm text-gray-400">
                    <span className={`font-medium ${getStatusColor(torrent.status)}`}>
                      {torrent.status}
                    </span>
                    <span>{formatBytes(torrent.size)}</span>
                    <span>Ratio: {torrent.ratio?.toFixed(2) || '0.00'}</span>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Progress</span>
                  <span className="text-white font-medium">{Math.round(torrent.progress * 100)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(torrent.progress)}`}
                    style={{ width: `${torrent.progress * 100}%` }}
                  />
                </div>
              </div>

              {/* Speed and Ratio Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4">
                <div className="bg-gray-700 p-2 sm:p-3 rounded">
                  <div className="flex items-center space-x-1 sm:space-x-2 mb-1">
                    <Download size={12} className="text-primary-400 sm:w-[14px] sm:h-[14px]" />
                    <span className="text-xs text-gray-400">Down</span>
                  </div>
                  <div className="text-xs sm:text-sm font-medium text-white truncate">{formatSpeed(torrent.downloadSpeed)}</div>
                </div>
                
                <div className="bg-gray-700 p-2 sm:p-3 rounded">
                  <div className="flex items-center space-x-1 sm:space-x-2 mb-1">
                    <Upload size={12} className="text-success-400 sm:w-[14px] sm:h-[14px]" />
                    <span className="text-xs text-gray-400">Up</span>
                  </div>
                  <div className="text-xs sm:text-sm font-medium text-white truncate">{formatSpeed(torrent.uploadSpeed)}</div>
                </div>
                
                <div className="bg-gray-700 p-2 sm:p-3 rounded">
                  <div className="flex items-center space-x-1 sm:space-x-2 mb-1">
                    <Users size={12} className="text-warning-400 sm:w-[14px] sm:h-[14px]" />
                    <span className="text-xs text-gray-400">Seeds</span>
                  </div>
                  <div className="text-xs sm:text-sm font-medium text-white">{torrent.seeders || 0}</div>
                </div>
                
                <div className="bg-gray-700 p-2 sm:p-3 rounded">
                  <div className="flex items-center space-x-1 sm:space-x-2 mb-1">
                    <Users size={12} className="text-gray-400 sm:w-[14px] sm:h-[14px]" />
                    <span className="text-xs text-gray-400">Peers</span>
                  </div>
                  <div className="text-xs sm:text-sm font-medium text-white">{torrent.leechers || 0}</div>
                </div>
              </div>
              
              {/* Real-time Connection Details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4">
                <div className="bg-gray-800 p-2 sm:p-3 rounded border border-gray-600">
                  <div className="flex items-center space-x-1 sm:space-x-2 mb-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-xs text-gray-400">Connected</span>
                  </div>
                  <div className="text-xs sm:text-sm font-medium text-white">{torrent.peersConnected || 0}</div>
                </div>
                
                <div className="bg-gray-800 p-2 sm:p-3 rounded border border-gray-600">
                  <div className="flex items-center space-x-1 sm:space-x-2 mb-1">
                    <Upload size={12} className="text-green-400 sm:w-[14px] sm:h-[14px]" />
                    <span className="text-xs text-gray-400">To Us</span>
                  </div>
                  <div className="text-xs sm:text-sm font-medium text-white">{torrent.peersSendingToUs || 0}</div>
                </div>
                
                <div className="bg-gray-800 p-2 sm:p-3 rounded border border-gray-600">
                  <div className="flex items-center space-x-1 sm:space-x-2 mb-1">
                    <Download size={12} className="text-blue-400 sm:w-[14px] sm:h-[14px]" />
                    <span className="text-xs text-gray-400">From Us</span>
                  </div>
                  <div className="text-xs sm:text-sm font-medium text-white">{torrent.peersGettingFromUs || 0}</div>
                </div>
                
                <div className="bg-gray-800 p-2 sm:p-3 rounded border border-gray-600">
                  <div className="flex items-center space-x-1 sm:space-x-2 mb-1">
                    <Clock size={12} className="text-gray-400 sm:w-[14px] sm:h-[14px]" />
                    <span className="text-xs text-gray-400">ETA</span>
                  </div>
                  <div className="text-xs sm:text-sm font-medium text-white truncate">{formatTime(torrent.eta)}</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => toggleFileList(torrent.id)}
                    className="btn btn-secondary text-xs px-3 py-2 flex items-center space-x-1 flex-1 sm:flex-none justify-center"
                    title="View Files"
                  >
                    <File size={14} />
                    <span>Files</span>
                    {expandedTorrent === torrent.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  
                  {(torrent.progress >= 1.0 || torrent.status === 'seeding') && (
                    <button
                      onClick={() => downloadTorrent(torrent.id, torrent.name)}
                      className="btn btn-success text-xs px-3 py-2 flex items-center space-x-1 flex-1 sm:flex-none justify-center"
                      title={`Download ${formatBytes(torrent.size)}`}
                    >
                      <FileDown size={14} />
                      <span className="hidden sm:inline">All ({formatBytes(torrent.size)})</span>
                      <span className="sm:hidden">Download</span>
                    </button>
                  )}
                </div>
                
                <div className="flex gap-2">
                  {(torrent.status === 'stopped' || torrent.status === 'check-wait' || torrent.status === 'seed-wait') ? (
                    <button
                      onClick={() => resumeTorrent(torrent.id, torrent.name)}
                      className="btn btn-primary text-xs px-3 py-2 flex items-center space-x-1 flex-1 justify-center"
                      title="Resume"
                    >
                      <Play size={14} />
                      <span>Resume</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => pauseTorrent(torrent.id, torrent.name)}
                      className="btn btn-warning text-xs px-3 py-2 flex items-center space-x-1 flex-1 justify-center"
                      title="Pause"
                    >
                      <Pause size={14} />
                      <span>Pause</span>
                    </button>
                  )}
                  
                  <button
                    onClick={() => removeTorrent(torrent.id, torrent.name)}
                    className="btn btn-danger text-xs px-3 py-2 flex items-center space-x-1 flex-1 justify-center"
                    title="Remove"
                  >
                    <Trash2 size={14} />
                    <span>Remove</span>
                  </button>
                </div>
              </div>

              {/* File List */}
              {expandedTorrent === torrent.id && torrentFiles[torrent.id] && (
                <div className="mt-4 border-t border-gray-700 pt-4">
                  <h4 className="text-sm font-medium text-white mb-3">Files</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {torrentFiles[torrent.id].map((file, index) => (
                      <div key={index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-700 rounded">
                        <div className="flex-1 min-w-0 mb-2 sm:mb-0">
                          <div className="text-sm text-white truncate">{file.name}</div>
                          <div className="text-xs text-gray-400">{formatBytes(file.size)}</div>
                        </div>
                        {file.progress >= 0.9 && (
                          <button
                            onClick={() => downloadFile(torrent.id, index, file.name)}
                            className="btn btn-primary text-xs px-3 py-2 flex items-center space-x-1 w-full sm:w-auto"
                          >
                            <FileDown size={14} />
                            <span>Download</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
