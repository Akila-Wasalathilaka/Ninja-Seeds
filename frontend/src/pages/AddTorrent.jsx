import React, { useState } from 'react'
import { Plus, Link, Upload, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../utils/api'

export default function AddTorrent({ onTorrentAdded }) {
  const [activeTab, setActiveTab] = useState('magnet')
  const [magnetLink, setMagnetLink] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleMagnetSubmit = async (e) => {
    e.preventDefault()
    if (!magnetLink.trim()) {
      toast.error('Please enter a magnet link')
      return
    }

    if (!magnetLink.startsWith('magnet:')) {
      toast.error('Invalid magnet link format')
      return
    }

    setIsLoading(true)
    try {
      const response = await api.post('/torrents/add-magnet', {
        magnetLink: magnetLink.trim()
      })
      
      if (response.data.success) {
        toast.success(`Torrent "${response.data.name}" added successfully!`)
        setMagnetLink('')
        onTorrentAdded && onTorrentAdded()
      }
    } catch (error) {
      // Error handled by interceptor
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileSubmit = async (e) => {
    e.preventDefault()
    if (!selectedFile) {
      toast.error('Please select a torrent file')
      return
    }

    const formData = new FormData()
    formData.append('torrent', selectedFile)

    setIsLoading(true)
    try {
      const response = await api.post('/torrents/add-file', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      
      if (response.data.success) {
        toast.success(`Torrent "${response.data.name}" added successfully!`)
        setSelectedFile(null)
        // Reset file input
        const fileInput = document.getElementById('torrent-file')
        if (fileInput) fileInput.value = ''
        onTorrentAdded && onTorrentAdded()
      }
    } catch (error) {
      // Error handled by interceptor
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (!file.name.endsWith('.torrent')) {
        toast.error('Please select a valid .torrent file')
        e.target.value = ''
        return
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast.error('File size must be less than 10MB')
        e.target.value = ''
        return
      }
      setSelectedFile(file)
    }
  }

  const tabs = [
    { id: 'magnet', name: 'Magnet Link', icon: Link },
    { id: 'file', name: 'Torrent File', icon: Upload }
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">Add Torrent</h1>
        <p className="text-sm sm:text-base text-gray-400">Add a new torrent via magnet link or file upload</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-700">
        <nav className="-mb-px flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 sm:flex-none flex items-center justify-center sm:justify-start space-x-2 py-3 sm:py-2 px-4 sm:px-1 border-b-2 font-medium text-xs sm:text-sm ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              <tab.icon size={16} className="sm:w-[18px] sm:h-[18px]" />
              <span className="sm:inline">{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="card">
        {activeTab === 'magnet' ? (
          <form onSubmit={handleMagnetSubmit} className="space-y-4 sm:space-y-6">
            <div>
              <label htmlFor="magnet-link" className="block text-sm font-medium text-gray-300 mb-2">
                Magnet Link
              </label>
              <textarea
                id="magnet-link"
                rows={4}
                className="input w-full resize-none text-sm"
                placeholder="magnet:?xt=urn:btih:..."
                value={magnetLink}
                onChange={(e) => setMagnetLink(e.target.value)}
                disabled={isLoading}
              />
              <p className="mt-2 text-xs sm:text-sm text-gray-400">
                Paste your magnet link here. It should start with "magnet:"
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading || !magnetLink.trim()}
              className="btn btn-primary flex items-center justify-center space-x-2 w-full sm:w-auto"
            >
              <Plus size={18} />
              <span>{isLoading ? 'Adding...' : 'Add Magnet'}</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleFileSubmit} className="space-y-4 sm:space-y-6">
            <div>
              <label htmlFor="torrent-file" className="block text-sm font-medium text-gray-300 mb-2">
                Torrent File
              </label>
              <div className="mt-1 flex justify-center px-4 sm:px-6 pt-4 sm:pt-5 pb-4 sm:pb-6 border-2 border-gray-600 border-dashed rounded-lg hover:border-gray-500 transition-colors">
                <div className="space-y-1 text-center">
                  <FileText size={36} className="mx-auto text-gray-400 sm:w-12 sm:h-12" />
                  <div className="flex flex-col sm:flex-row text-xs sm:text-sm text-gray-400">
                    <label
                      htmlFor="torrent-file"
                      className="relative cursor-pointer rounded-md font-medium text-primary-400 hover:text-primary-300 focus-within:outline-none"
                    >
                      <span>Upload a torrent file</span>
                      <input
                        id="torrent-file"
                        type="file"
                        accept=".torrent"
                        onChange={handleFileChange}
                        className="sr-only"
                        disabled={isLoading}
                      />
                    </label>
                    <p className="sm:pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    .torrent files up to 10MB
                  </p>
                  {selectedFile && (
                    <p className="text-xs sm:text-sm text-primary-400 mt-2 break-all">
                      Selected: {selectedFile.name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !selectedFile}
              className="btn btn-primary flex items-center justify-center space-x-2 w-full sm:w-auto"
            >
              <Upload size={18} />
              <span>{isLoading ? 'Uploading...' : 'Add Torrent'}</span>
            </button>
          </form>
        )}
      </div>

      {/* Tips */}
      <div className="card bg-gray-800/50">
        <h3 className="text-base sm:text-lg font-medium text-white mb-3 flex items-center space-x-2">
          <span>💡</span>
          <span>Tips</span>
        </h3>
        <ul className="space-y-2 text-xs sm:text-sm text-gray-400">
          <li>• Magnet links are faster and don't require file uploads</li>
          <li>• Torrents will automatically start downloading after being added</li>
          <li>• You can download files when they reach 90% completion</li>
          <li>• Files are automatically zipped for directory downloads</li>
        </ul>
      </div>
    </div>
  )
}
