import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import Navbar from './Navbar.jsx'

function Layout() {
  const [selectedEnv, setSelectedEnv] = useState('development')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => window.innerWidth < 768
  )

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark'
    if (savedTheme === 'light') {
      document.documentElement.classList.add('theme-light')
    } else {
      document.documentElement.classList.remove('theme-light')
    }

    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarCollapsed(true)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])


  const handleToggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed)
  }

  return (
    <div className="app-layout">
      <Sidebar isCollapsed={isSidebarCollapsed} onToggle={handleToggleSidebar} />
      <div className="main-content">
        <Navbar 
          selectedEnv={selectedEnv} 
          onEnvChange={setSelectedEnv} 
          onToggleSidebar={handleToggleSidebar}
        />
        <div className="page-content">
          <Outlet context={{ selectedEnv }} />
        </div>
      </div>
    </div>
  )
}

export default Layout