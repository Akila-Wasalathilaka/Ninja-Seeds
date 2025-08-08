import React, { useState, useEffect } from 'react'
import { Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { 
  Download, 
  Plus, 
  HardDrive, 
  Activity, 
  Shield,
  Menu,
  X,
  User
} from 'lucide-react'
import Dashboard from './pages/Dashboard'
import AddTorrent from './pages/AddTorrent'
import Storage from './pages/Storage'
import Login from './pages/Login'
import Signup from './pages/Signup'
import { api } from './utils/api'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [stats, setStats] = useState({
    totalTorrents: 0,
    activeDownloads: 0,
    seedingTorrents: 0,
    diskUsage: 0
  })
  
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const token = localStorage.getItem('ninja-token')
    const user = localStorage.getItem('ninja-user')
    if (token && user) {
      setIsAuthenticated(true)
      setCurrentUser(JSON.parse(user))
      fetchStats()
    }
  }, [])

  const fetchStats = async () => {
    try {
      const response = await api.get('/stats')
      setStats(response.data)
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const handleAuth = (token, user) => {
    localStorage.setItem('ninja-token', token)
    localStorage.setItem('ninja-user', JSON.stringify(user))
    setIsAuthenticated(true)
    setCurrentUser(user)
    fetchStats()
    navigate('/')
  }

  const handleLogout = () => {
    localStorage.removeItem('ninja-token')
    localStorage.removeItem('ninja-user')
    setIsAuthenticated(false)
    setCurrentUser(null)
    navigate('/login')
  }

  // If not authenticated, show login/signup pages
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/signup" element={<Signup onSignup={handleAuth} />} />
        <Route path="*" element={<Login onLogin={handleAuth} />} />
      </Routes>
    )
  }

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Activity },
    { name: 'Add Torrent', href: '/add', icon: Plus },
    { name: 'Storage', href: '/storage', icon: HardDrive },
  ]

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Mobile header */}
      <div className="lg:hidden sticky top-0 z-50 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center justify-between p-3 sm:p-4">
          <div className="flex items-center space-x-2">
            <span className="text-xl sm:text-2xl">🥷</span>
            <h1 className="text-lg sm:text-xl font-bold text-white">Ninja Seeds</h1>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        
        {/* Mobile stats bar */}
        <div className="px-3 pb-3 sm:px-4 sm:pb-4">
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="bg-gray-700 p-2 rounded text-center">
              <div className="text-gray-400">Total</div>
              <div className="font-semibold text-white">{stats.totalTorrents}</div>
            </div>
            <div className="bg-gray-700 p-2 rounded text-center">
              <div className="text-gray-400">Active</div>
              <div className="font-semibold text-primary-400">{stats.activeDownloads}</div>
            </div>
            <div className="bg-gray-700 p-2 rounded text-center">
              <div className="text-gray-400">Seeding</div>
              <div className="font-semibold text-success-400">{stats.seedingTorrents}</div>
            </div>
            <div className="bg-gray-700 p-2 rounded text-center">
              <div className="text-gray-400">User</div>
              <div className="font-semibold text-warning-400 truncate">{currentUser?.username}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className={`${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 transition-transform duration-300 ease-in-out lg:static absolute z-40 w-72 sm:w-80 lg:w-64 h-screen bg-gray-800 border-r border-gray-700 overflow-y-auto`}>
          
          {/* Desktop Logo */}
          <div className="hidden lg:flex items-center space-x-3 p-6 border-b border-gray-700">
            <span className="text-3xl">🥷</span>
            <div>
              <h1 className="text-xl font-bold text-white">Ninja Seeds</h1>
              <p className="text-sm text-gray-400">Torrent Seeding Box</p>
            </div>
          </div>

          {/* Mobile user info header */}
          <div className="lg:hidden p-4 border-b border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center">
                <User size={20} className="text-white" />
              </div>
              <div>
                <div className="text-base font-medium text-white">{currentUser?.username}</div>
                <div className="text-sm text-gray-400 capitalize">{currentUser?.role}</div>
              </div>
            </div>
          </div>

          {/* Desktop User Info */}
          <div className="hidden lg:block p-4 border-b border-gray-700">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
                <User size={16} className="text-white" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">{currentUser?.username}</div>
                <div className="text-xs text-gray-400 capitalize">{currentUser?.role}</div>
              </div>
            </div>
          </div>

          {/* Desktop Stats Overview */}
          <div className="hidden lg:block p-4 border-b border-gray-700">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-700 p-3 rounded">
                <div className="text-gray-400">Total</div>
                <div className="font-semibold text-white">{stats.totalTorrents}</div>
              </div>
              <div className="bg-gray-700 p-3 rounded">
                <div className="text-gray-400">Active</div>
                <div className="font-semibold text-primary-400">{stats.activeDownloads}</div>
              </div>
              <div className="bg-gray-700 p-3 rounded">
                <div className="text-gray-400">Seeding</div>
                <div className="font-semibold text-success-400">{stats.seedingTorrents}</div>
              </div>
              <div className="bg-gray-700 p-3 rounded">
                <div className="text-gray-400">Disk</div>
                <div className="font-semibold text-warning-400">{stats.diskUsage}%</div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="p-4 flex-1">
            <ul className="space-y-2">
              {navigation.map((item) => (
                <li key={item.name}>
                  <NavLink
                    to={item.href}
                    className={({ isActive }) =>
                      `flex items-center space-x-3 px-4 py-3 lg:px-3 lg:py-2 rounded-lg text-base lg:text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-primary-600 text-white'
                          : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                      }`
                    }
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <item.icon size={20} className="lg:w-[18px] lg:h-[18px]" />
                    <span>{item.name}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          {/* Logout Button */}
          <div className="p-4 border-t border-gray-700">
            <button
              onClick={handleLogout}
              className="flex items-center space-x-3 w-full px-4 py-3 lg:px-3 lg:py-2 text-base lg:text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white rounded-lg transition-colors"
            >
              <Shield size={20} className="lg:w-[18px] lg:h-[18px]" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Overlay for mobile */}
        {isMobileMenuOpen && (
          <div 
            className="lg:hidden fixed inset-0 z-30 bg-black bg-opacity-50"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Main Content */}
        <div className="flex-1 lg:ml-0 min-h-screen">
          <main className="p-3 sm:p-4 lg:p-6">
            <Routes>
              <Route path="/" element={<Dashboard onStatsUpdate={fetchStats} />} />
              <Route path="/add" element={<AddTorrent onTorrentAdded={fetchStats} />} />
              <Route path="/storage" element={<Storage />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  )
}

export default App
