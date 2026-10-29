import { useParams, useNavigate, useOutletContext } from 'react-router-dom'
import { useState, useEffect, useRef, useMemo } from 'react'
import apiClient from '../api/client.js'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts'


function FlagDetail() {
  const { key } = useParams()
  const navigate = useNavigate()
  const { selectedEnv } = useOutletContext()

  const [flag, setFlag] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isEditing, setIsEditing] = useState(false)

  // Active top navigation tab
  const [activeTab, setActiveTab] = useState('targeting') // 'targeting' | 'overrides' | 'evaluation'

  // Edit fields
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [ownerTeam, setOwnerTeam] = useState('')
  const [defaultValue, setDefaultValue] = useState('')
  const [updating, setUpdating] = useState(false)

  // Targeting fields
  const [whitelistedUsers, setWhitelistedUsers] = useState([])
  const [selectedGroups, setSelectedGroups] = useState([])
  const [rolloutPercentage, setRolloutPercentage] = useState(0)
  const [savedWhitelist, setSavedWhitelist] = useState([])
  const [savedGroups, setSavedGroups] = useState([])
  const [savedPercentage, setSavedPercentage] = useState(0)
  const [newUser, setNewUser] = useState('')
  const [savingTargeting, setSavingTargeting] = useState(false)
  const userInputRef = useRef(null)

  const hasTargetingChanges = useMemo(() => {
    const wlChanged = JSON.stringify([...whitelistedUsers].sort()) !== JSON.stringify([...savedWhitelist].sort())
    const grpChanged = JSON.stringify([...selectedGroups].sort()) !== JSON.stringify([...savedGroups].sort())
    const pctChanged = rolloutPercentage !== savedPercentage
    return wlChanged || grpChanged || pctChanged
  }, [whitelistedUsers, savedWhitelist, selectedGroups, savedGroups, rolloutPercentage, savedPercentage])

  // Available groups
  const [availableGroups, setAvailableGroups] = useState([])
  const [groupSearch, setGroupSearch] = useState('')
  const [showCreateGroupInput, setShowCreateGroupInput] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  
  // Available groups Edit/Delete mode
  const [isEditingGroups, setIsEditingGroups] = useState(false)
  const [groupsToDelete, setGroupsToDelete] = useState([])

  // Manage Groups Modal
  const [showGroupsModal, setShowGroupsModal] = useState(false)
  const [modalSelectedGroup, setModalSelectedGroup] = useState('')
  const [groupMembers, setGroupMembers] = useState([])
  const [newMemberId, setNewMemberId] = useState('')
  const [loadingMembers, setLoadingMembers] = useState(false)

  // Overrides Tab State (Read-Only Status View per user directive)
  const [overrides, setOverrides] = useState([])
  const [loadingOverrides, setLoadingOverrides] = useState(false)

  // Evaluation Test Tab State
  const [testEnv, setTestEnv] = useState('Production')
  const [testUserId, setTestUserId] = useState('')
  const [testGroups, setTestGroups] = useState('')
  const [testContext, setTestContext] = useState('')
  const [evaluating, setEvaluating] = useState(false)
  const [evalResult, setEvalResult] = useState(null)
  const [evalError, setEvalError] = useState(null)

  // Metrics Analytics Tab State
  const [metricsTimeframe, setMetricsTimeframe] = useState('7D')
  const [metricsData, setMetricsData] = useState(null)

  const [loadingMetrics, setLoadingMetrics] = useState(false)
  const [metricsError, setMetricsError] = useState(null)

  const fetchMetrics = (timeframe = metricsTimeframe) => {
    setLoadingMetrics(true)
    apiClient
      .get(`/flags/${key}/metrics?timeframe=${timeframe}`)
      .then((res) => {
        setMetricsData(res.data)
        setMetricsError(null)
      })
      .catch((err) => {
        setMetricsError(err.response?.data?.detail || err.message)
      })
      .finally(() => setLoadingMetrics(false))
  }

  const handleClearAnalytics = () => {
    if (!window.confirm("Are you sure you want to clear analytics data for this flag?")) return
    setLoadingMetrics(true)
    apiClient
      .post(`/flags/${key}/clear-analytics`)
      .then(() => fetchMetrics(metricsTimeframe))
      .catch((err) => alert(err.response?.data?.detail || err.message))
      .finally(() => setLoadingMetrics(false))
  }

  const handleFlushAnalytics = () => {
    apiClient
      .post('/flags/analytics/flush')
      .then((res) => {
        alert(`Flushed ${res.data.flushed_keys} hourly key(s), total ${res.data.total_evaluations_flushed.toLocaleString()} evaluations written into database.`)
        fetchMetrics(metricsTimeframe)
      })
      .catch((err) => alert(err.response?.data?.detail || err.message))
  }

  useEffect(() => {
    if (activeTab === 'metrics') {
      fetchMetrics(metricsTimeframe)
    }
  }, [activeTab, metricsTimeframe, key])

  // System Status State

  const [systemStatus, setSystemStatus] = useState({
    all_systems_operational: true,
    api_server: 'Operational',
    redis_cache: 'Operational',
    postgresql: 'Operational',
    background_worker: 'Operational'
  })

  const fetchSystemStatus = () => {
    apiClient
      .get('/health')
      .then((res) => {
        if (res.data) setSystemStatus(res.data)
      })
      .catch((err) => console.error('Failed to fetch system status:', err))
  }

  const fetchFlagDetail = () => {
    setLoading(true)
    apiClient
      .get(`/flags/${key}?environment=${selectedEnv}`)
      .then((res) => {
        const data = res.data
        setFlag(data)
        setName(data.name)
        setDescription(data.description || '')
        setOwnerTeam(data.owner_team || '')
        setDefaultValue(data.default_value)
        setError(null)
      })
      .catch((err) => {
        setError(err.response?.data?.detail || err.message)
      })
      .finally(() => {
        setLoading(false)
      })
  }

  const fetchTargetingRules = () => {
    apiClient
      .get(`/flags/${key}/targeting?environment=${selectedEnv}`)
      .then((res) => {
        const wl = res.data.whitelist ? res.data.whitelist.split(',').map(x => x.trim()).filter(Boolean) : []
        const grps = res.data.groups ? res.data.groups.split(',').map(x => x.trim()).filter(Boolean) : []
        const pct = res.data.percentage !== undefined ? res.data.percentage : 0
        setWhitelistedUsers(wl)
        setSelectedGroups(grps)
        setRolloutPercentage(pct)
        setSavedWhitelist(wl)
        setSavedGroups(grps)
        setSavedPercentage(pct)
      })
      .catch((err) => {
        console.error('Failed to load targeting rules:', err)
      })
  }

  const fetchAvailableGroups = () => {
    apiClient
      .get('/groups')
      .then((res) => {
        setAvailableGroups(res.data)
        if (res.data.length > 0 && !modalSelectedGroup) {
          setModalSelectedGroup(res.data[0])
        }
      })
      .catch((err) => {
        console.error('Failed to load available groups:', err)
      })
  }

  const fetchOverrides = () => {
    setLoadingOverrides(true)
    apiClient
      .get(`/flags/${key}/overrides`)
      .then((res) => {
        setOverrides(res.data)
      })
      .catch((err) => {
        console.error('Failed to load overrides:', err)
      })
      .finally(() => {
        setLoadingOverrides(false)
      })
  }

  useEffect(() => {
    fetchFlagDetail()
    fetchTargetingRules()
    fetchAvailableGroups()
    fetchOverrides()
    fetchSystemStatus()
  }, [key, selectedEnv])

  const handleUpdate = (e) => {
    e.preventDefault()
    setUpdating(true)
    apiClient
      .put(`/flags/${key}?environment=${selectedEnv}`, {
        name,
        description: description.trim() || null,
        owner_team: ownerTeam.trim() || null,
        default_value: defaultValue,
      })
      .then((res) => {
        setFlag(res.data)
        setIsEditing(false)
        fetchFlagDetail()
      })
      .catch((err) => {
        alert('Failed to update flag details: ' + (err.response?.data?.detail || err.message))
      })
      .finally(() => {
        setUpdating(false)
      })
  }

  const saveTargetingRules = (newWhitelist, newGroups, newPercentage) => {
    const pct = newPercentage !== undefined ? newPercentage : rolloutPercentage
    setSavingTargeting(true)
    apiClient
      .post(`/flags/${key}/targeting?environment=${selectedEnv}`, {
        whitelist: newWhitelist.join(','),
        groups: newGroups.join(','),
        percentage: pct
      })
      .then((res) => {
        const wl = res.data.whitelist ? res.data.whitelist.split(',').map(x => x.trim()).filter(Boolean) : []
        const grps = res.data.groups ? res.data.groups.split(',').map(x => x.trim()).filter(Boolean) : []
        const pctVal = res.data.percentage !== undefined ? res.data.percentage : 0
        setWhitelistedUsers(wl)
        setSelectedGroups(grps)
        setRolloutPercentage(pctVal)
        setSavedWhitelist(wl)
        setSavedGroups(grps)
        setSavedPercentage(pctVal)
      })
      .catch((err) => {
        alert('Failed to update targeting rules: ' + (err.response?.data?.detail || err.message))
      })
      .finally(() => {
        setSavingTargeting(false)
      })
  }

  const handleToggle = () => {
    if (!flag) return
    const newStatus = !flag.is_enabled
    apiClient
      .put(`/flags/${key}?environment=${selectedEnv}`, { is_enabled: newStatus })
      .then((res) => {
        setFlag({ ...flag, is_enabled: res.data.is_enabled })
      })
      .catch((err) => {
        alert('Failed to toggle flag: ' + (err.response?.data?.detail || err.message))
      })
  }

  const handleAddWhitelistUser = (e) => {
    e.preventDefault()
    const trimmed = newUser.trim()
    if (!trimmed) return
    if (whitelistedUsers.includes(trimmed)) {
      alert('User ID is already whitelisted.')
      return
    }
    const updated = [...whitelistedUsers, trimmed]
    setWhitelistedUsers(updated)
    setNewUser('')
  }

  const handleRemoveWhitelistUser = (userId) => {
    const updated = whitelistedUsers.filter(u => u !== userId)
    setWhitelistedUsers(updated)
  }

  const handleToggleGroup = (groupName) => {
    let updated
    if (selectedGroups.includes(groupName)) {
      updated = selectedGroups.filter(g => g !== groupName)
    } else {
      updated = [...selectedGroups, groupName]
    }
    setSelectedGroups(updated)
  }

  const handleCreateGroup = (e) => {
    e.preventDefault()
    const trimmed = newGroupName.trim().toLowerCase().replace(/\s+/g, '_')
    if (!trimmed) return
    if (availableGroups.includes(trimmed)) {
      alert('Group already exists.')
      return
    }
    apiClient
      .post('/groups', { name: trimmed })
      .then(() => {
        setAvailableGroups([...availableGroups, trimmed])
        setNewGroupName('')
        setShowCreateGroupInput(false)
      })
      .catch((err) => {
        alert('Failed to create group: ' + (err.response?.data?.detail || err.message))
      })
  }

  const handleDeleteSelectedGroups = () => {
    if (groupsToDelete.length === 0) return
    if (!window.confirm(`Are you sure you want to delete ${groupsToDelete.length} selected group(s)?`)) return

    apiClient
      .post('/groups/batch-delete', { groups: groupsToDelete })
      .then(() => {
        const updatedAvailable = availableGroups.filter(g => !groupsToDelete.includes(g))
        setAvailableGroups(updatedAvailable)

        const updatedSelected = selectedGroups.filter(g => !groupsToDelete.includes(g))
        setSelectedGroups(updatedSelected)

        setGroupsToDelete([])
        setIsEditingGroups(false)
      })
      .catch((err) => {
        alert('Failed to delete groups: ' + (err.response?.data?.detail || err.message))
      })
  }

  const handleDelete = () => {
    if (!window.confirm(`Are you sure you want to permanently delete flag "${flag.name}"? This will delete it across ALL environments.`)) {
      return
    }
    apiClient
      .delete(`/flags/${key}`)
      .then(() => {
        navigate('/flags')
      })
      .catch((err) => {
        alert('Failed to delete flag: ' + (err.response?.data?.detail || err.message))
      })
  }

  // Manage Group Members Modal Handlers
  const fetchGroupMembers = (groupName) => {
    if (!groupName) return
    setLoadingMembers(true)
    apiClient
      .get(`/groups/${groupName}/members`)
      .then((res) => setGroupMembers(res.data))
      .catch((err) => console.error('Failed to load group members:', err))
      .finally(() => setLoadingMembers(false))
  }

  useEffect(() => {
    if (showGroupsModal && modalSelectedGroup) {
      fetchGroupMembers(modalSelectedGroup)
    }
  }, [showGroupsModal, modalSelectedGroup])

  const handleAddMember = (e) => {
    e.preventDefault()
    const trimmed = newMemberId.trim()
    if (!trimmed || !modalSelectedGroup) return
    apiClient
      .post(`/groups/${modalSelectedGroup}/members`, { user_id: trimmed })
      .then(() => {
        setNewMemberId('')
        fetchGroupMembers(modalSelectedGroup)
      })
      .catch((err) => alert(err.response?.data?.detail || err.message))
  }

  const handleRemoveMember = (userId) => {
    if (!modalSelectedGroup) return
    apiClient
      .delete(`/groups/${modalSelectedGroup}/members/${userId}`)
      .then(() => fetchGroupMembers(modalSelectedGroup))
      .catch((err) => alert(err.response?.data?.detail || err.message))
  }

  // Evaluation Test Runner
  const handleRunEvaluation = (e) => {
    if (e) e.preventDefault()
    setEvaluating(true)
    setEvalError(null)

    let parsedContext = {}
    if (testContext.trim()) {
      try {
        parsedContext = JSON.parse(testContext.trim())
      } catch (err) {
        setEvalError('Invalid JSON format in Additional Context.')
        setEvaluating(false)
        return
      }
    }

    const reqBody = {
      flag_key: key,
      environment: testEnv,
      user_id: testUserId.trim() || undefined,
      groups: testGroups.split(',').map(g => g.trim()).filter(Boolean),
      context: parsedContext
    }

    apiClient
      .post('/evaluate', reqBody)
      .then((res) => {
        setEvalResult(res.data)
      })
      .catch((err) => {
        setEvalError(err.response?.data?.detail || err.message)
      })
      .finally(() => {
        setEvaluating(false)
      })
  }

  const getEnvBadgeStyles = (name) => {
    const n = name.toLowerCase()
    if (n.includes('dev')) return { text: 'DEV', bg: '#2563eb', color: '#ffffff' }
    if (n.includes('stag')) return { text: 'STG', bg: '#7c3aed', color: '#ffffff' }
    if (n.includes('prod')) return { text: 'PROD', bg: '#16a34a', color: '#ffffff' }
    return { text: name.substring(0, 4).toUpperCase(), bg: '#4b5563', color: '#ffffff' }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '—'
    const date = new Date(dateString)
    const day = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    return `${day}, ${time}`
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-secondary)' }}>
        Loading flag configuration...
      </div>
    )
  }

  if (error || !flag) {
    return (
      <div>
        <button className="btn btn-secondary" onClick={() => navigate('/flags')} style={{ marginBottom: 20 }}>
          ← Back to Flags
        </button>
        <div className="card" style={{ padding: '32px', textAlign: 'center', borderColor: '#ff4444' }}>
          <h2 style={{ color: '#ff4444', margin: '0 0 8px 0' }}>Flag Not Found</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{error || 'Unable to retrieve flag configuration.'}</p>
        </div>
      </div>
    )
  }

  const filteredAvailableGroups = availableGroups.filter(g =>
    g.toLowerCase().includes(groupSearch.toLowerCase())
  )

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* Back button */}
      <button className="btn btn-secondary" onClick={() => navigate('/flags')} style={{ marginBottom: 24, fontSize: 12 }}>
        ← Back to Flags
      </button>

      {/* Flag Top Banner Card with Metadata Grid & Inline Edit Form */}
      <div className="card" style={{ padding: '24px 28px', marginBottom: 28 }}>
        {isEditing ? (
          /* Inline Edit Form Mode */
          <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-zinc-800)', paddingBottom: 14 }}>
              <h2 style={{ fontSize: 16, margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
                Edit Flag Details — <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>{flag.flag_key}</code>
              </h2>
              <button type="button" className="btn btn-secondary" onClick={() => setIsEditing(false)} style={{ fontSize: 12 }}>
                Cancel
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div className="form-group">
                <label style={{ fontSize: 12, fontWeight: 600 }}>Flag Name</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ fontSize: 13 }}
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: 12, fontWeight: 600 }}>Owner Team</label>
                <input
                  type="text"
                  className="form-input"
                  value={ownerTeam}
                  onChange={(e) => setOwnerTeam(e.target.value)}
                  placeholder="e.g. Frontend Team, Payments"
                  style={{ fontSize: 13 }}
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: 12, fontWeight: 600 }}>Default Value ({flag.type})</label>
                {flag.type === 'boolean' ? (
                  <select
                    className="form-select"
                    value={defaultValue}
                    onChange={(e) => setDefaultValue(e.target.value)}
                    style={{ fontSize: 13, height: 38 }}
                  >
                    <option value="true">True (ON)</option>
                    <option value="false">False (OFF)</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={defaultValue}
                    onChange={(e) => setDefaultValue(e.target.value)}
                    style={{ fontSize: 13 }}
                  />
                )}
              </div>
            </div>

            <div className="form-group">
              <label style={{ fontSize: 12, fontWeight: 600 }}>Description</label>
              <textarea
                className="form-textarea"
                rows="2"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter flag description..."
                style={{ fontSize: 13 }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 4 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsEditing(false)} disabled={updating}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={updating} style={{ fontWeight: 600 }}>
                {updating ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          /* View Details Mode */
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                  <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {flag.flag_key}
                  </h1>
                  <span className="badge badge-enabled" style={{ fontSize: 11, padding: '3px 10px', textTransform: 'capitalize' }}>
                    Environment: {selectedEnv}
                  </span>
                  <span className={`badge ${flag.is_enabled ? 'badge-enabled' : 'badge-disabled'}`} style={{ fontSize: 11, padding: '3px 10px' }}>
                    Status: {flag.is_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
                  {flag.name}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <label className="switch" title="Toggle Flag Enabled State">
                  <input type="checkbox" checked={flag.is_enabled} onChange={handleToggle} />
                  <span className="slider"></span>
                </label>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setName(flag.name || '')
                    setDescription(flag.description || '')
                    setOwnerTeam(flag.owner_team || '')
                    setDefaultValue(flag.default_value || '')
                    setIsEditing(true)
                  }}
                >
                  Edit Details
                </button>
                <button className="btn btn-secondary" onClick={handleDelete} style={{ color: '#ff4444', borderColor: 'rgba(255,68,68,0.2)' }}>
                  Delete
                </button>
              </div>
            </div>

            {/* Flag Details Metadata Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 16,
              paddingTop: 16,
              borderTop: '1px solid var(--border-zinc-800)'
            }}>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 2 }}>
                  Data Type
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                  {flag.type}
                </span>
              </div>

              <div>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 2 }}>
                  Default Value
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                  {flag.type === 'boolean' ? (flag.default_value === 'true' ? 'ON (true)' : 'OFF (false)') : flag.default_value}
                </span>
              </div>

              <div>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 2 }}>
                  Owner Team
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {flag.owner_team || 'Unassigned'}
                </span>
              </div>

              <div>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 2 }}>
                  Created At
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {formatDate(flag.created_at)}
                </span>
              </div>

              <div>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 2 }}>
                  Updated At
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {formatDate(flag.updated_at)}
                </span>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 2 }}>
                  Description
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {flag.description || 'No description provided.'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3 Top Level Tabs Header */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-zinc-800)', marginBottom: 28, gap: 32 }}>
        <button
          onClick={() => setActiveTab('targeting')}
          style={{
            background: 'none',
            border: 'none',
            padding: '12px 4px',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            color: activeTab === 'targeting' ? 'var(--primary)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'targeting' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
            transition: 'all 0.15s ease'
          }}
        >
          Targeting Rules
        </button>

        <button
          onClick={() => setActiveTab('overrides')}
          style={{
            background: 'none',
            border: 'none',
            padding: '12px 4px',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            color: activeTab === 'overrides' ? 'var(--primary)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'overrides' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
            transition: 'all 0.15s ease'
          }}
        >
          Overrides
        </button>

        <button
          onClick={() => setActiveTab('evaluation')}
          style={{
            background: 'none',
            border: 'none',
            padding: '12px 4px',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            color: activeTab === 'evaluation' ? 'var(--primary)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'evaluation' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
            transition: 'all 0.15s ease'
          }}
        >
          Evaluation Test
        </button>

        <button
          onClick={() => setActiveTab('metrics')}
          style={{
            background: 'none',
            border: 'none',
            padding: '12px 4px',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            color: activeTab === 'metrics' ? 'var(--primary)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'metrics' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
            transition: 'all 0.15s ease'
          }}
        >
          Metrics
        </button>
      </div>


      {/* TAB 1: TARGETING RULES (Compact 60% Width Layout) */}
      {activeTab === 'targeting' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: '660px' }}>
          {/* Combined Targeting Rules Confirmation Bar */}
          <div
            className="card"
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: hasTargetingChanges ? 'rgba(37, 99, 235, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              border: hasTargetingChanges ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid var(--border-zinc-800)',
              borderRadius: 8,
              transition: 'all 0.2s ease'
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: hasTargetingChanges ? '#60a5fa' : 'var(--text-primary)' }}>
                {hasTargetingChanges ? '⚠️ Unsaved Targeting Rule Changes' : '✓ All Targeting Rules Synced'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                Modify Whitelist, Groups, and Rollout Percentage below, then click Confirm to save all 3 combined.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {hasTargetingChanges && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setWhitelistedUsers(savedWhitelist)
                    setSelectedGroups(savedGroups)
                    setRolloutPercentage(savedPercentage)
                  }}
                  disabled={savingTargeting}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    height: 36,
                    padding: '0 16px',
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    color: '#f87171',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Discard
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => saveTargetingRules(whitelistedUsers, selectedGroups, rolloutPercentage)}
                disabled={savingTargeting || !hasTargetingChanges}
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  height: 36,
                  padding: '0 18px',
                  whiteSpace: 'nowrap',
                  backgroundColor: hasTargetingChanges ? '#2563eb' : '#18181b',
                  color: hasTargetingChanges ? '#ffffff' : '#a1a1aa',
                  border: hasTargetingChanges ? '1px solid #3b82f6' : '1px solid #3f3f46',
                  boxShadow: hasTargetingChanges ? '0 0 12px rgba(37, 99, 235, 0.35)' : 'none',
                  cursor: hasTargetingChanges ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s ease'
                }}
              >
                {savingTargeting ? 'Saving...' : 'Confirm & Save'}
              </button>
            </div>
          </div>
          {/* Rule 1: User Whitelist */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16, color: '#38bdf8' }}>👤</span>
                  <h3 style={{ fontSize: 16, margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
                    User Whitelist (Individual Users)
                  </h3>
                </div>
              </div>
            </div>

            <form onSubmit={handleAddWhitelistUser} style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Enter User ID to whitelist (e.g. user_101, admin_user)..."
                value={newUser}
                onChange={(e) => setNewUser(e.target.value)}
                ref={userInputRef}
                style={{ flex: 1, fontSize: 13 }}
              />
              <button type="submit" className="btn btn-primary" style={{ fontSize: 13, fontWeight: 600 }}>
                + Add Whitelisted User
              </button>
            </form>

            {whitelistedUsers.length === 0 ? (
              <div style={{ padding: '20px', color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', background: 'rgba(255,255,255,0.01)', borderRadius: 6, border: '1px dashed var(--border-zinc-800)' }}>
                No whitelisted users configured for this flag.
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {whitelistedUsers.map((uid) => (
                  <span key={uid} style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '5px 12px',
                    borderRadius: 16,
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    color: '#2563eb',
                    border: '1px solid rgba(37, 99, 235, 0.25)',
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono)'
                  }}>
                    {uid}
                    <button
                      onClick={() => handleRemoveWhitelistUser(uid)}
                      style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0, fontSize: 15, fontWeight: 700 }}
                      title="Remove User"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Rule 2: Group Targeting */}
          <div className="card" style={{ padding: '24px', border: '1px solid var(--border-zinc-800)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16, color: '#10b981' }}>👥</span>
                <h3 style={{ fontSize: 16, margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Group Targeting
                </h3>
              </div>

              <div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowGroupsModal(true)}
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#ff4500',
                    borderColor: 'rgba(255, 69, 0, 0.4)',
                    backgroundColor: 'rgba(255, 69, 0, 0.08)'
                  }}
                >
                  Manage Group Members
                </button>
              </div>
            </div>

            {/* Currently Targeted Groups Chips */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                Currently Targeted Groups ({selectedGroups.length}):
              </label>
              {selectedGroups.length === 0 ? (
                <div style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: 12, background: 'rgba(255,255,255,0.01)', borderRadius: 6, border: '1px dashed var(--border-zinc-800)' }}>
                  No groups currently targeted. Select from available groups below.
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {selectedGroups.map((g) => (
                    <span key={g} style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '5px 12px',
                      borderRadius: 16,
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: 'var(--font-mono)'
                    }}>
                      ✓ {g}
                      <button
                        onClick={() => handleToggleGroup(g)}
                        style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: 0, fontSize: 15, fontWeight: 700 }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Available Groups Selection Grid */}
            <div style={{ borderTop: '1px solid var(--border-zinc-800)', paddingTop: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Available Group Directory ({filteredAvailableGroups.length})
                </span>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Filter groups..."
                  value={groupSearch}
                  onChange={(e) => setGroupSearch(e.target.value)}
                  style={{ width: 180, fontSize: 12, height: 32 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, maxHeight: 200, overflowY: 'auto' }}>
                {filteredAvailableGroups.map((g) => {
                  const isSelected = selectedGroups.includes(g)

                  return (
                    <div
                      key={g}
                      onClick={() => handleToggleGroup(g)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 6,
                        backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255,255,255,0.02)',
                        border: isSelected ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-zinc-800)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: 12,
                        fontFamily: 'var(--font-mono)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span style={{ color: isSelected ? '#10b981' : 'var(--text-primary)', fontWeight: isSelected ? 600 : 400 }}>
                        {g}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isSelected ? '#10b981' : 'var(--text-secondary)' }}>
                        {isSelected ? '✓' : '+'}
                      </span>
                    </div>
                  )
                })}
              </div>

              {isEditingGroups && groupsToDelete.length > 0 ? (
                <button
                  className="btn btn-secondary"
                  onClick={handleDeleteSelectedGroups}
                  style={{ marginTop: 14, color: '#ff4444', borderColor: 'rgba(255, 68, 68, 0.3)', fontSize: 12 }}
                >
                  Delete ({groupsToDelete.length}) Selected Groups
                </button>
              ) : showCreateGroupInput ? (
                <form onSubmit={handleCreateGroup} style={{ display: 'flex', gap: 8, marginTop: 14, maxWidth: 360 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="New group name (e.g. beta_users)..."
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    style={{ flex: 1, fontSize: 12 }}
                    autoFocus
                  />
                  <button type="submit" className="btn btn-primary" style={{ fontSize: 12 }}>Save</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCreateGroupInput(false)} style={{ fontSize: 12 }}>Cancel</button>
                </form>
              ) : (
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowCreateGroupInput(true)}
                  style={{
                    marginTop: 14,
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#ff4500',
                    borderColor: 'rgba(255, 69, 0, 0.4)',
                    backgroundColor: 'rgba(255, 69, 0, 0.08)'
                  }}
                >
                  + Create New Group
                </button>
              )}
            </div>
          </div>

          {/* Rule 3: Percentage Rollout */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16, color: '#f59e0b' }}>%</span>
                  <h3 style={{ fontSize: 16, margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Percentage Rollout
                  </h3>
                </div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>
                {rolloutPercentage}%
              </div>
            </div>

            {/* Slider & Quick Presets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <input
                type="range"
                min="0"
                max="100"
                value={rolloutPercentage}
                onChange={(e) => setRolloutPercentage(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer', height: 6 }}
              />

              {/* Quick Preset Buttons */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Quick Presets:</span>
                {[0, 10, 25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setRolloutPercentage(pct)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                      backgroundColor: rolloutPercentage === pct ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
                      color: rolloutPercentage === pct ? '#ffffff' : 'var(--text-secondary)',
                      border: rolloutPercentage === pct ? '1px solid var(--primary)' : '1px solid var(--border-zinc-800)',
                      cursor: 'pointer'
                    }}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: OVERRIDES (Read-Only Status View per user directive) */}
      {activeTab === 'overrides' && (
        <div className="card" style={{ padding: '28px' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px 0' }}>
            Environment Overrides Status
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24 }}>
            Current override status for flag <code>{flag.flag_key}</code> across environments.
          </p>

          {loadingOverrides ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
              Loading environment overrides...
            </div>
          ) : (
            <div className="table-container" style={{ border: '1px solid var(--border-zinc-800)', borderRadius: '8px', overflow: 'hidden' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 260, paddingLeft: 24 }}>Environment</th>
                    <th style={{ width: 220 }}>Override Value</th>
                    <th style={{ width: 180 }}>Status</th>
                    <th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {overrides.map((item) => {
                    const badge = getEnvBadgeStyles(item.environment_name)
                    const isOverridden = item.status === 'Overridden'
                    const isTrueOverride = isOverridden && (item.override_value === 'true' || item.override_value === 'ON')

                    return (
                      <tr key={item.environment_id}>
                        <td style={{ paddingLeft: 24 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '4px 8px',
                              backgroundColor: badge.bg,
                              color: badge.color,
                              borderRadius: '4px',
                              fontFamily: 'var(--font-mono)'
                            }}>
                              {badge.text}
                            </span>
                            <span style={{ fontWeight: 600, textTransform: 'capitalize', fontSize: 13.5, color: 'var(--text-primary)' }}>
                              {item.environment_name}
                            </span>
                          </div>
                        </td>

                        <td>
                          {flag.type === 'boolean' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{
                                fontSize: 12,
                                fontWeight: 700,
                                fontFamily: 'var(--font-mono)',
                                color: isTrueOverride ? 'var(--success)' : 'var(--text-secondary)'
                              }}>
                                {isOverridden ? (isTrueOverride ? 'ON' : 'OFF') : '—'}
                              </span>
                            </div>
                          ) : (
                            <code style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                              {item.override_value || '—'}
                            </code>
                          )}
                        </td>

                        <td>
                          {isOverridden ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '3px 12px',
                              borderRadius: '16px',
                              fontSize: 11,
                              fontWeight: 600,
                              backgroundColor: '#eff6ff',
                              color: '#2563eb',
                              border: '1px solid rgba(37, 99, 235, 0.25)'
                            }}>
                              Overridden
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '3px 12px',
                              borderRadius: '16px',
                              fontSize: 11,
                              fontWeight: 500,
                              backgroundColor: 'rgba(255, 255, 255, 0.03)',
                              color: 'var(--text-secondary)',
                              border: '1px solid var(--border-zinc-800)'
                            }}>
                              Using Default
                            </span>
                          )}
                        </td>

                        <td>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                            {formatDate(item.updated_at)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: EVALUATION TEST PANEL */}
      {activeTab === 'evaluation' && (
        <div style={{ display: 'grid', gridTemplateColumns: evalResult ? '360px 1fr 280px' : '420px 1fr', gap: 24, alignItems: 'flex-start' }}>
          {/* Left Column: Test Form */}
          <div className="card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
              Evaluation Test Panel
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 20, lineHeight: 1.4 }}>
              Test how this flag resolves for a given user & environment.
            </p>

            <form onSubmit={handleRunEvaluation} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label style={{ fontSize: 12, fontWeight: 600 }}>Environment</label>
                <select
                  className="form-select"
                  value={testEnv}
                  onChange={(e) => setTestEnv(e.target.value)}
                  style={{ fontSize: 13, height: 38 }}
                >
                  <option value="Production">Production</option>
                  <option value="Staging">Staging</option>
                  <option value="Development">Development</option>
                </select>
              </div>

              <div className="form-group">
                <label style={{ fontSize: 12, fontWeight: 600 }}>User ID</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. user_101"
                  value={testUserId}
                  onChange={(e) => setTestUserId(e.target.value)}
                  style={{ fontSize: 13 }}
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: 12, fontWeight: 600 }}>Groups (comma separated)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. beta_users, premium_plan"
                  value={testGroups}
                  onChange={(e) => setTestGroups(e.target.value)}
                  style={{ fontSize: 13 }}
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: 12, fontWeight: 600 }}>Additional Context (JSON)</label>
                <textarea
                  className="form-textarea"
                  rows="4"
                  placeholder='{\n  "plan": "premium",\n  "country": "IN"\n}'
                  value={testContext}
                  onChange={(e) => setTestContext(e.target.value)}
                  style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}
                />
              </div>

              {evalError && (
                <div style={{ padding: '8px 12px', background: 'rgba(255,51,51,0.08)', border: '1px solid rgba(255,51,51,0.2)', borderRadius: 6, color: '#ff4444', fontSize: 12 }}>
                  {evalError}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={evaluating}
                style={{
                  backgroundColor: '#6366f1',
                  borderColor: '#6366f1',
                  height: 42,
                  fontSize: 14,
                  fontWeight: 600,
                  marginTop: 8,
                  display: 'inline-flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                {evaluating ? 'Evaluating...' : '▷ Evaluate Flag'}
              </button>
            </form>
          </div>

          {/* Middle Column: Evaluation Result View */}
          {evalResult ? (
            <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 15, margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Evaluation Result
                </h3>
                {evalResult.cached ? (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 9px',
                    borderRadius: 12,
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)'
                  }}>
                    Cached ⚡
                  </span>
                ) : (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 9px',
                    borderRadius: 12,
                    backgroundColor: 'rgba(59, 130, 246, 0.12)',
                    color: '#60a5fa',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)'
                  }}>
                    Live
                  </span>
                )}
              </div>

              {/* Resolved Value Card */}
              <div style={{
                padding: '20px 24px',
                backgroundColor: evalResult.value ? 'rgba(16, 185, 129, 0.06)' : 'rgba(255, 255, 255, 0.02)',
                border: evalResult.value ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid var(--border-zinc-800)',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: evalResult.value ? '#10b981' : 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Resolved Value
                  </span>
                  <div style={{ fontSize: 24, fontWeight: 800, color: evalResult.value ? '#10b981' : 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                    {String(evalResult.value).toUpperCase()}
                  </div>
                </div>

                {flag.type === 'boolean' && (
                  <div style={{
                    width: 44,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: evalResult.value ? '#10b981' : '#3f3f46',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 2,
                    justifyContent: evalResult.value ? 'flex-end' : 'flex-start',
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)'
                  }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: '#ffffff' }} />
                  </div>
                )}
              </div>

              {/* Result Details List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13 }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 12, display: 'block', marginBottom: 2 }}>Matched Rule</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {evalResult.matched_rule || evalResult.reason}
                  </span>
                </div>

                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 12, display: 'block', marginBottom: 2 }}>Rule Detail</span>
                  <span style={{ color: 'var(--text-primary)' }}>
                    {evalResult.rule_detail || evalResult.details || '—'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 12, display: 'block', marginBottom: 2 }}>Evaluated At</span>
                    <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {evalResult.evaluated_at}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 12, display: 'block', marginBottom: 4 }}>Response Time</span>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 10px',
                      borderRadius: 12,
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      color: '#10b981',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 13,
                      fontWeight: 800,
                      boxShadow: '0 0 10px rgba(16, 185, 129, 0.15)'
                    }}>
                      ⚡ {evalResult.latency_ms !== undefined ? `${evalResult.latency_ms} ms` : '< 1 ms'}
                    </span>
                  </div>
                </div>

                {/* Request Summary Matching Image 2 */}
                <div style={{ borderTop: '1px solid var(--border-zinc-800)', paddingTop: 14 }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>
                    Request Summary
                  </span>
                  <div style={{
                    backgroundColor: 'rgba(0,0,0,0.25)',
                    padding: '12px 14px',
                    borderRadius: 6,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    border: '1px solid var(--border-zinc-800)'
                  }}>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <span style={{ color: 'var(--text-muted)', width: 100 }}>flag_key:</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{evalResult.request_summary?.flag_key || key}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <span style={{ color: 'var(--text-muted)', width: 100 }}>environment:</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{evalResult.request_summary?.environment || testEnv}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <span style={{ color: 'var(--text-muted)', width: 100 }}>user_id:</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{evalResult.request_summary?.user_id || (testUserId ? testUserId : 'N/A')}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <span style={{ color: 'var(--text-muted)', width: 100 }}>groups:</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                        {JSON.stringify(evalResult.request_summary?.groups || testGroups.split(',').map(g => g.trim()).filter(Boolean))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
              <h3 style={{ fontSize: 15, margin: 0, color: 'var(--text-primary)' }}>Ready to Evaluate</h3>
              <p style={{ fontSize: 12, maxWidth: 300, margin: '8px auto 0 auto' }}>
                Fill out the test parameters on the left and click "Evaluate Flag" to see instant resolution & priority step checks.
              </p>
            </div>
          )}

          {/* Right Column: ✨ Priority Check Timeline */}
          {evalResult && (
            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#ec4899', fontSize: 14 }}>✨</span>
                <h3 style={{ fontSize: 14, margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Priority Check
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(evalResult.priority_checks || evalResult.priority_steps || []).map((stepItem) => {
                  const isMatched = stepItem.status === 'Matched'

                  return (
                    <div
                      key={stepItem.priority || stepItem.step}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        backgroundColor: isMatched ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                        border: isMatched ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-zinc-800)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          backgroundColor: isMatched ? '#10b981' : 'rgba(255,255,255,0.06)',
                          color: isMatched ? '#ffffff' : 'var(--text-secondary)',
                          fontSize: 11,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {stepItem.priority || stepItem.step}
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: isMatched ? 700 : 500, color: isMatched ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                            {stepItem.name}
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: 11, fontWeight: 600 }}>
                        {isMatched ? (
                          <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                            Matched ✓
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>
                            {stepItem.status}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: METRICS ANALYTICS (Recharts) */}
      {activeTab === 'metrics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeIn 0.2s ease-out' }}>
          <div className="card" style={{ padding: '24px 28px', border: '1px solid var(--border-zinc-800)' }}>
            {/* Header + Timeframe Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
                  Evaluation Count
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                  Number of times this flag was evaluated.
                </p>
              </div>

              {/* Timeframe pill selector */}
              <div style={{ display: 'flex', gap: 6, backgroundColor: 'rgba(255, 255, 255, 0.04)', padding: 4, borderRadius: 8, border: '1px solid var(--border-zinc-800)' }}>
                {['7D', '30D', '90D'].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setMetricsTimeframe(tf)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: 'none',
                      backgroundColor: metricsTimeframe === tf ? 'var(--primary)' : 'transparent',
                      color: metricsTimeframe === tf ? '#ffffff' : 'var(--text-secondary)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {loadingMetrics ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
                Loading evaluation analytics...
              </div>
            ) : metricsError ? (
              <div style={{ padding: 20, border: '1px solid #ff4444', borderRadius: 8, color: '#ff4444', fontSize: 13 }}>
                Failed to load metrics: {metricsError}
              </div>
            ) : (
              <div>
                {/* KPI Summary Card */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#7c3aed', display: 'inline-block' }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Total Evaluations
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                      <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                        {(metricsData?.total_evaluations || 0).toLocaleString()}
                      </span>

                      {/* Percentage Badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 12,
                          backgroundColor: metricsData?.is_positive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          color: metricsData?.is_positive ? '#10b981' : '#ef4444',
                          border: `1px solid ${metricsData?.is_positive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                        }}>
                          {metricsData?.is_positive ? '↑' : '↓'} {Math.abs(metricsData?.change_percentage || 0)}%
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          vs previous {metricsTimeframe === '7D' ? '7 days' : metricsTimeframe === '90D' ? '90 days' : '30 days'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions: Flush Redis & Clear Analytics */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleFlushAnalytics}
                      title="Flush active Redis hourly counters into PostgreSQL database"
                      style={{ fontSize: 12 }}
                    >
                      ⚡ Flush Redis to DB
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleClearAnalytics}
                      title="Clear evaluation analytics historical data for this flag"
                      style={{ fontSize: 12 }}
                    >
                      🗑️ Clear Analytics
                    </button>
                  </div>
                </div>

                {/* Recharts Bar Chart Container */}
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={metricsData?.data || []}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.06)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: '#71717a', fontSize: 11 }}
                        axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: '#71717a', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(val) => {
                          if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`
                          if (val >= 1000) return `${(val / 1000).toFixed(0)}K`
                          return val
                        }}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(124, 58, 237, 0.08)' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const row = payload[0].payload
                            return (
                              <div style={{
                                backgroundColor: '#09090b',
                                border: '1px solid #27272a',
                                borderRadius: 8,
                                padding: '10px 14px',
                                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)'
                              }}>
                                <div style={{ fontSize: 11, color: '#a1a1aa', fontWeight: 600, marginBottom: 4 }}>
                                  {row.full_date || row.date}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#ffffff', fontWeight: 700 }}>
                                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#7c3aed', display: 'inline-block' }} />
                                  Evaluations: {payload[0].value.toLocaleString()}
                                </div>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      <Bar
                        dataKey="count"
                        fill="#7c3aed"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={28}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      )}


      {/* Manage Groups Modal */}
      {showGroupsModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', padding: '28px', border: '1px solid var(--border-zinc-800)', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 16, margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
                Manage Group Members
              </h2>
              <button
                onClick={() => setShowGroupsModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <div className="form-group">
              <label>Select Group</label>
              <select
                className="form-select"
                value={modalSelectedGroup}
                onChange={(e) => setModalSelectedGroup(e.target.value)}
              >
                {availableGroups.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <form onSubmit={handleAddMember} style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                className="form-input"
                placeholder="User ID to add to group..."
                value={newMemberId}
                onChange={(e) => setNewMemberId(e.target.value)}
                style={{ flex: 1, fontSize: 13 }}
              />
              <button type="submit" className="btn btn-primary" style={{ fontSize: 12 }}>+ Add Member</button>
            </form>

            <div style={{ borderTop: '1px solid var(--border-zinc-800)', paddingTop: 16 }}>
              <h4 style={{ fontSize: 13, margin: '0 0 12px 0', color: 'var(--text-primary)' }}>
                Current Members ({groupMembers.length})
              </h4>
              {loadingMembers ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Loading members...</div>
              ) : groupMembers.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No members in this group yet.</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                  {groupMembers.map((m) => (
                    <span key={m.id} style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      borderRadius: 14,
                      backgroundColor: 'rgba(255,255,255,0.04)',
                      border: '1px solid var(--border-zinc-800)',
                      fontSize: 12,
                      fontFamily: 'var(--font-mono)'
                    }}>
                      {m.user_id}
                      <button
                        onClick={() => handleRemoveMember(m.user_id)}
                        style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', padding: 0, fontSize: 14 }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="btn btn-secondary" onClick={() => setShowGroupsModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}


    </div>
  )
}

export default FlagDetail
