import React, { useState, useEffect } from 'react'
import { HardDrive, Cpu, MemoryStick, Server, RefreshCw } from 'lucide-react'
import { api, formatBytes } from '../utils/api'

export default function Storage() {
  const [stats, setStats] = useState({
    disk: {
      total: 0,
      used: 0,
      free: 0,
      percentage: 0
    },
    memory: {
      total: 0,
      used: 0,
      free: 0,
      percentage: 0
    },
    cpu: {
      usage: 0,
      cores: 0
    },
    system: {
      uptime: 0,
      platform: '',
      arch: ''
    }
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 10000) // Refresh every 10 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchStats = async () => {
    try {
      setIsRefreshing(true)
      const response = await api.get('/stats')
      setStats(response.data)
    } catch (error) {
      console.error('Failed to fetch system stats:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const getUsageColor = (percentage) => {
    if (percentage >= 90) return 'bg-danger-500'
    if (percentage >= 75) return 'bg-warning-500'
    if (percentage >= 50) return 'bg-primary-500'
    return 'bg-success-500'
  }

  const getUsageTextColor = (percentage) => {
    if (percentage >= 90) return 'text-danger-400'
    if (percentage >= 75) return 'text-warning-400'
    if (percentage >= 50) return 'text-primary-400'
    return 'text-success-400'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <RefreshCw className="animate-spin" size={20} />
          <span>Loading system stats...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Storage & System</h1>
          <p className="text-sm sm:text-base text-gray-400">Monitor your system resources</p>
        </div>
        <button
          onClick={fetchStats}
          disabled={isRefreshing}
          className="btn btn-secondary flex items-center justify-center space-x-2 w-full sm:w-auto"
        >
          <RefreshCw className={isRefreshing ? 'animate-spin' : ''} size={18} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Storage Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Disk Usage */}
        <div className="card">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-primary-600 rounded-lg">
              <HardDrive size={20} className="text-white sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-medium text-white">Disk Storage</h3>
              <p className="text-xs sm:text-sm text-gray-400">50GB Oracle Volume</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Used</span>
              <span className={`font-medium ${getUsageTextColor(stats.disk.percentage)}`}>
                {stats.disk.percentage}%
              </span>
            </div>
            
            <div className="progress-bar">
              <div 
                className={`progress-fill ${getUsageColor(stats.disk.percentage)}`}
                style={{ width: `${stats.disk.percentage}%` }}
              />
            </div>
            
            <div className="flex justify-between text-xs sm:text-sm text-gray-400">
              <span>{formatBytes(stats.disk.used)} used</span>
              <span>{formatBytes(stats.disk.free)} free</span>
            </div>
            
            <div className="text-center text-xs sm:text-sm font-medium text-white">
              {formatBytes(stats.disk.total)} total
            </div>
          </div>
        </div>

        {/* Memory Usage */}
        <div className="card">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-success-600 rounded-lg">
              <MemoryStick size={20} className="text-white sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-medium text-white">Memory</h3>
              <p className="text-xs sm:text-sm text-gray-400">24GB RAM</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Used</span>
              <span className={`font-medium ${getUsageTextColor(stats.memory.percentage)}`}>
                {stats.memory.percentage}%
              </span>
            </div>
            
            <div className="progress-bar">
              <div 
                className={`progress-fill ${getUsageColor(stats.memory.percentage)}`}
                style={{ width: `${stats.memory.percentage}%` }}
              />
            </div>
            
            <div className="flex justify-between text-xs sm:text-sm text-gray-400">
              <span>{formatBytes(stats.memory.used)} used</span>
              <span>{formatBytes(stats.memory.free)} free</span>
            </div>
            
            <div className="text-center text-xs sm:text-sm font-medium text-white">
              {formatBytes(stats.memory.total)} total
            </div>
          </div>
        </div>

        {/* CPU Usage */}
        <div className="card sm:col-span-2 lg:col-span-1">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-warning-600 rounded-lg">
              <Cpu size={20} className="text-white sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-medium text-white">CPU</h3>
              <p className="text-xs sm:text-sm text-gray-400">{stats.cpu.cores} Cores</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Usage</span>
              <span className={`font-medium ${getUsageTextColor(stats.cpu.usage)}`}>
                {stats.cpu.usage}%
              </span>
            </div>
            
            <div className="progress-bar">
              <div 
                className={`progress-fill ${getUsageColor(stats.cpu.usage)}`}
                style={{ width: `${stats.cpu.usage}%` }}
              />
            </div>
            
            <div className="text-center text-xs sm:text-sm font-medium text-white">
              {stats.cpu.cores} Core{stats.cpu.cores !== 1 ? 's' : ''} Available
            </div>
          </div>
        </div>
      </div>

      {/* System Information */}
      <div className="card">
        <div className="flex items-center space-x-3 mb-4 sm:mb-6">
          <div className="p-2 bg-gray-600 rounded-lg">
            <Server size={20} className="text-white sm:w-6 sm:h-6" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-medium text-white">System Information</h3>
            <p className="text-xs sm:text-sm text-gray-400">Oracle Free Tier Details</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div>
            <div className="text-xs sm:text-sm text-gray-400 mb-1">Platform</div>
            <div className="text-sm sm:text-lg font-medium text-white">{stats.system.platform || 'Linux'}</div>
          </div>
          
          <div>
            <div className="text-xs sm:text-sm text-gray-400 mb-1">Architecture</div>
            <div className="text-sm sm:text-lg font-medium text-white">{stats.system.arch || 'ARM64'}</div>
          </div>
          
          <div>
            <div className="text-xs sm:text-sm text-gray-400 mb-1">Uptime</div>
            <div className="text-sm sm:text-lg font-medium text-white">{formatUptime(stats.system.uptime)}</div>
          </div>
          
          <div>
            <div className="text-xs sm:text-sm text-gray-400 mb-1">Server Type</div>
            <div className="text-sm sm:text-lg font-medium text-white">Oracle Cloud</div>
          </div>
        </div>
      </div>

      {/* Storage Tips */}
      <div className="card bg-gray-800/50">
        <h3 className="text-base sm:text-lg font-medium text-white mb-3 flex items-center space-x-2">
          <span>💡</span>
          <span>Storage Tips</span>
        </h3>
        <ul className="space-y-2 text-xs sm:text-sm text-gray-400">
          <li>• Oracle Free Tier provides 50GB of block storage</li>
          <li>• Old torrents are auto-removed when storage exceeds 90%</li>
          <li>• Downloads are compressed as ZIP files to save space</li>
          <li>• Monitor disk usage regularly to avoid service interruption</li>
        </ul>
      </div>
    </div>
  )
}
