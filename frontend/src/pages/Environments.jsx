import { useEffect, useState } from 'react'
import apiClient from '../api/client.js'

function Environments() {
  const [envs, setEnvs] = useState([])
  const [flags, setFlags] = useState([])
  const [selectedFlagKey, setSelectedFlagKey] = useState('')
  const [selectedFlag, setSelectedFlag] = useState(null)
  const [overrides, setOverrides] = useState([])
  const [loadingEnvs, setLoadingEnvs] = useState(true)
  const [loadingOverrides, setLoadingOverrides] = useState(false)
  const [loadingFlags, setLoadingFlags] = useState(false)
  const [error, setError] = useState(null)

  // Modals state
  const [showAddEnvModal, setShowAddEnvModal] = useState(false)
  const [showEditEnvModal, setShowEditEnvModal] = useState(false)
  const [editingEnv, setEditingEnv] = useState(null)

  // Add environment fields
  const [newEnvName, setNewEnvName] = useState('')
  const [newEnvDesc, setNewEnvDesc] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Override edit state
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [editingOverride, setEditingOverride] = useState(null)
  const [overrideInputValue, setOverrideInputValue] = useState('')
  const [overrideActive, setOverrideActive] = useState(true)

  // Load environments list
  const fetchEnvironments = () => {
    setLoadingEnvs(true)
    apiClient
      .get('/environments')
      .then((res) => {
        setEnvs(res.data)
        setError(null)
      })
      .catch((err) => {
        setError(err.response?.data?.detail || err.message)
      })
      .finally(() => {
        setLoadingEnvs(false)
      })
  }

  // Load flags list for select dropdown
  const fetchFlags = () => {
    setLoadingFlags(true)
    apiClient
      .get('/flags?environment=development')
      .then((res) => {
        setFlags(res.data)
        if (res.data.length > 0 && !selectedFlagKey) {
          setSelectedFlagKey(res.data[0].flag_key)
        }
      })
      .catch((err) => {
        console.error('Failed to fetch flags list', err)
      })
      .finally(() => {
        setLoadingFlags(false)
      })
  }

  // Load overrides for selected flag
  const fetchOverrides = (flagKey) => {
    if (!flagKey) return
    setLoadingOverrides(true)
    apiClient
      .get(`/flags/${flagKey}/overrides`)
      .then((res) => {
        setOverrides(res.data)
      })
      .catch((err) => {
        console.error('Failed to load overrides', err)
      })
      .finally(() => {
        setLoadingOverrides(false)
      })
  }

  useEffect(() => {
    fetchEnvironments()
    fetchFlags()
  }, [])

  useEffect(() => {
    if (selectedFlagKey) {
      const flg = flags.find((f) => f.flag_key === selectedFlagKey)
      setSelectedFlag(flg || null)
      fetchOverrides(selectedFlagKey)
    } else {
      setSelectedFlag(null)
      setOverrides([])
    }
  }, [selectedFlagKey, flags])

  // Get color-coded acronym badge matching reference mockups
  const getEnvBadgeStyles = (name) => {
    const n = name.toLowerCase()
    if (n.includes('dev')) return { text: 'DEV', bg: '#2563eb', color: '#ffffff' }
    if (n.includes('stag')) return { text: 'STG', bg: '#7c3aed', color: '#ffffff' }
    if (n.includes('prod')) return { text: 'PROD', bg: '#16a34a', color: '#ffffff' }
    return { text: name.substring(0, 4).toUpperCase(), bg: '#4b5563', color: '#ffffff' }
  }

  // Format date strings cleanly like "29 May 2024, 10:30 AM"
  const formatDate = (dateString) => {
    if (!dateString) return '—'
    const date = new Date(dateString)
    const day = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    return `${day}, ${time}`
  }

  // Create environment handler
  const handleCreateEnv = (e) => {
    e.preventDefault()
    const name = newEnvName.trim().toLowerCase().replace(/\s+/g, '_')
    if (!name) return

    setActionLoading(true)
    apiClient
      .post('/environments', { name, description: newEnvDesc.trim() || null })
      .then(() => {
        setShowAddEnvModal(false)
        setNewEnvName('')
        setNewEnvDesc('')
        fetchEnvironments()
      })
      .catch((err) => {
        alert(err.response?.data?.detail || err.message)
      })
      .finally(() => {
        setActionLoading(false)
      })
  }

  // Update environment handler
  const handleUpdateEnv = (e) => {
    e.preventDefault()
    if (!editingEnv) return

    setActionLoading(true)
    apiClient
      .put(`/environments/${editingEnv.id}`, {
        name: editingEnv.name.trim().toLowerCase().replace(/\s+/g, '_'),
        description: editingEnv.description ? editingEnv.description.trim() : null,
      })
      .then(() => {
        setShowEditEnvModal(false)
        setEditingEnv(null)
        fetchEnvironments()
      })
      .catch((err) => {
        alert(err.response?.data?.detail || err.message)
      })
      .finally(() => {
        setActionLoading(false)
      })
  }

  // Delete environment handler
  const handleDeleteEnv = (id, name) => {
    if (!confirm(`Are you sure you want to delete "${name}" environment?\nThis will remove all associated flags and overrides.`)) {
      return
    }

    apiClient
      .delete(`/environments/${id}`)
      .then(() => {
        fetchEnvironments()
        fetchFlags()
      })
      .catch((err) => {
        alert(err.response?.data?.detail || err.message)
      })
  }

  // Toggle boolean override
  const handleToggleBooleanOverride = (envId, currentOverrideValue, currentStatus) => {
    if (!selectedFlagKey) return

    const isCurrentlyTrue = currentStatus === 'Overridden' && (currentOverrideValue === 'true' || currentOverrideValue === 'ON')
    const newOverrideValue = isCurrentlyTrue ? 'false' : 'true'

    apiClient
      .put(`/flags/${selectedFlagKey}/overrides/${envId}`, {
        value: newOverrideValue,
        active: true,
      })
      .then(() => {
        fetchOverrides(selectedFlagKey)
        window.dispatchEvent(new CustomEvent('sync-dashboard'))
      })
      .catch((err) => {
        alert('Failed to set override: ' + (err.response?.data?.detail || err.message))
      })
  }

  // Edit custom override modal trigger
  const handleOpenOverrideModal = (item) => {
    setEditingOverride(item)
    setOverrideInputValue(item.override_value || '')
    setOverrideActive(item.status === 'Overridden')
    setShowOverrideModal(true)
  }

  // Save custom override value
  const handleSaveOverride = (e) => {
    e.preventDefault()
    if (!editingOverride || !selectedFlagKey) return

    setActionLoading(true)
    apiClient
      .put(`/flags/${selectedFlagKey}/overrides/${editingOverride.environment_id}`, {
        value: overrideInputValue.trim(),
        active: overrideActive,
      })
      .then(() => {
        setShowOverrideModal(false)
        setEditingOverride(null)
        fetchOverrides(selectedFlagKey)
        window.dispatchEvent(new CustomEvent('sync-dashboard'))
      })
      .catch((err) => {
        alert(err.response?.data?.detail || err.message)
      })
      .finally(() => {
        setActionLoading(false)
      })
  }

  // Reset override to default directly
  const handleResetOverride = (envId) => {
    if (!selectedFlagKey) return

    apiClient
      .put(`/flags/${selectedFlagKey}/overrides/${envId}`, {
        value: '',
        active: false,
      })
      .then(() => {
        fetchOverrides(selectedFlagKey)
        window.dispatchEvent(new CustomEvent('sync-dashboard'))
      })
      .catch((err) => {
        alert('Failed to reset override: ' + (err.response?.data?.detail || err.message))
      })
  }

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Environments</h1>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 10px',
              borderRadius: 12,
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
              fontSize: 12,
              fontWeight: 700,
              border: '1px solid rgba(16, 185, 129, 0.3)',
              fontFamily: 'var(--font-mono)'
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
              Live
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Manage environments and flag overrides.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddEnvModal(true)}>
          + Create Environment
        </button>
      </div>

      {error ? (
        <div style={{ padding: '12px 16px', backgroundColor: 'rgba(255, 51, 51, 0.05)', border: '1px solid rgba(255, 51, 51, 0.15)', borderRadius: 6, color: '#ff3333', fontSize: 13, marginBottom: 24 }}>
          <strong>Error loading configurations: </strong>{error}
        </div>
      ) : null}

      {/* Environments List Table */}
      <div className="card" style={{ padding: 0, marginBottom: 32, overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-zinc-800)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 15, margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
            Environments
          </h2>
        </div>

        {loadingEnvs ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
            Loading environments data...
          </div>
        ) : envs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
            <h3>No environments configured</h3>
            <p style={{ fontSize: 12 }}>Create an environment to begin targeting feature rollouts.</p>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 80, paddingLeft: 24 }}>ID</th>
                  <th style={{ width: 200 }}>Name</th>
                  <th>Description</th>
                  <th style={{ width: 140 }}>Status</th>
                  <th style={{ width: 120, textAlign: 'right', paddingRight: 24 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {envs.map((env) => (
                  <tr key={env.id}>
                    <td style={{ paddingLeft: 24 }}>
                      <code style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{env.id}</code>
                    </td>
                    <td style={{ fontWeight: 600, textTransform: 'capitalize', color: 'var(--text-primary)', fontSize: 14 }}>
                      {env.name}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                      {env.description || <em style={{ color: 'var(--text-muted)' }}>No description provided.</em>}
                    </td>
                    <td>
                      <span className="badge badge-enabled" style={{ fontSize: 10, padding: '2px 8px', borderRadius: 12 }}>Active</span>
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: 24 }}>
                      <div style={{ display: 'inline-flex', gap: 12 }}>
                        <button
                          onClick={() => {
                            setEditingEnv({ ...env })
                            setShowEditEnvModal(true)
                          }}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}
                          title="Edit Environment"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteEnv(env.id, env.name)}
                          style={{ background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer', padding: 4 }}
                          title="Delete Environment"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Flag Overrides by Environment Panel */}
      <div className="card" style={{ padding: '28px', overflow: 'hidden' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px 0' }}>
          Flag Overrides by Environment
        </h2>

        {flags.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
            {loadingFlags ? 'Loading flags...' : 'No flags available. Create a flag first to configure overrides.'}
          </div>
        ) : (
          <div>
            {/* Select Flag Filter Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                Select Flag:
              </label>
              <select
                className="form-select"
                value={selectedFlagKey}
                onChange={(e) => setSelectedFlagKey(e.target.value)}
                style={{
                  height: '38px',
                  fontSize: '13px',
                  minWidth: '280px',
                  fontWeight: 500,
                  padding: '6px 14px'
                }}
              >
                {flags.map((f) => {
                  const defaultFormatted = f.type === 'boolean' 
                    ? (f.default_value === 'true' ? 'ON' : 'OFF')
                    : f.default_value
                  return (
                    <option key={f.id} value={f.flag_key}>
                      {f.name} (Default: {defaultFormatted})
                    </option>
                  )
                })}
              </select>
            </div>

            {/* Overrides Table */}
            {loadingOverrides ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
                Loading environment overrides...
              </div>
            ) : (
              <div className="table-container" style={{ border: '1px solid var(--border-zinc-800)', borderRadius: '8px', overflow: 'hidden' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 240, paddingLeft: 24 }}>Environment</th>
                      <th style={{ width: 200 }}>Override Value</th>
                      <th style={{ width: 160 }}>Status</th>
                      <th>Last Updated</th>
                      <th style={{ width: 80, textAlign: 'right', paddingRight: 24 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {overrides.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)', fontSize: 13 }}>
                          No override records returned for this flag.
                        </td>
                      </tr>
                    ) : (
                      overrides.map((item) => {
                      const badge = getEnvBadgeStyles(item.environment_name)
                      const isBoolean = selectedFlag?.type === 'boolean'
                      const isOverridden = item.status === 'Overridden'
                      const isTrueOverride = isOverridden && (item.override_value === 'true' || item.override_value === 'ON')

                      return (
                        <tr key={item.environment_id}>
                          {/* Environment Name + Badge */}
                          <td style={{ paddingLeft: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <span style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '4px 8px',
                                backgroundColor: badge.bg,
                                color: badge.color,
                                borderRadius: '4px',
                                fontFamily: 'var(--font-mono)',
                                letterSpacing: 0.5
                              }}>
                                {badge.text}
                              </span>
                              <span style={{ fontWeight: 600, textTransform: 'capitalize', fontSize: 13.5, color: 'var(--text-primary)' }}>
                                {item.environment_name}
                              </span>
                            </div>
                          </td>

                          {/* Override Value (Toggle Switch + ON/OFF label) */}
                          <td>
                            {isBoolean ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <label className="switch">
                                  <input
                                    type="checkbox"
                                    checked={isTrueOverride}
                                    onChange={() => handleToggleBooleanOverride(item.environment_id, item.override_value, item.status)}
                                  />
                                  <span className="slider" style={{ borderRadius: '14px' }}></span>
                                </label>
                                <span style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  fontFamily: 'var(--font-mono)',
                                  color: isTrueOverride ? 'var(--success)' : 'var(--text-secondary)'
                                }}>
                                  {isTrueOverride ? 'ON' : 'OFF'}
                                </span>
                              </div>
                            ) : (
                              <code style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: isOverridden ? 'var(--primary)' : 'var(--text-secondary)',
                                fontFamily: 'var(--font-mono)'
                              }}>
                                {item.override_value || '—'}
                              </code>
                            )}
                          </td>

                          {/* Status Badge */}
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

                          {/* Last Updated Timestamp */}
                          <td>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                              {formatDate(item.updated_at)}
                            </span>
                          </td>

                          {/* Edit Action Icon & Reset Button */}
                          <td style={{ textAlign: 'right', paddingRight: 24 }}>
                            <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                              {isOverridden ? (
                                <button
                                  onClick={() => handleResetOverride(item.environment_id)}
                                  style={{
                                    background: 'rgba(239, 68, 68, 0.08)',
                                    border: '1px solid rgba(239, 68, 68, 0.25)',
                                    color: '#ef4444',
                                    borderRadius: '4px',
                                    padding: '3px 8px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4
                                  }}
                                  title="Reset to Default (Deactivate Override)"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                                    <path d="M3 3v5h5"></path>
                                  </svg>
                                  Reset
                                </button>
                              ) : null}

                              <button
                                onClick={() => handleOpenOverrideModal(item)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}
                                title="Edit Override Configuration"
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                  <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    }))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Reference Explanatory Notice Alert Box */}
            <div style={{
              display: 'flex',
              gap: 14,
              marginTop: 24,
              padding: '16px 20px',
              backgroundColor: 'rgba(124, 58, 237, 0.05)',
              border: '1px solid rgba(124, 58, 237, 0.18)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontSize: 13,
              alignItems: 'center'
            }}>
              <div style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                backgroundColor: '#7c3aed',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0
              }}>
                i
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.4 }}>
                If an override exists for an environment, that value will be used. Otherwise, the flag's default value will be used.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Environment Modal */}
      {showAddEnvModal ? (
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
          zIndex: 1000,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '28px', border: '1px solid var(--border-zinc-800)', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h2 style={{ fontSize: 16, margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
              Create Environment
            </h2>
            <form onSubmit={handleCreateEnv} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label>Environment Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. development, staging, sandbox"
                  className="form-input"
                  value={newEnvName}
                  onChange={(e) => setNewEnvName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  placeholder="Summarize the core purpose of this environment"
                  className="form-textarea"
                  rows="3"
                  value={newEnvDesc}
                  onChange={(e) => setNewEnvDesc(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddEnvModal(false)} disabled={actionLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Edit Environment Modal */}
      {showEditEnvModal && editingEnv ? (
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
          zIndex: 1000,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '28px', border: '1px solid var(--border-zinc-800)', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h2 style={{ fontSize: 16, margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
              Edit Environment Details
            </h2>
            <form onSubmit={handleUpdateEnv} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label>Environment Name</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={editingEnv.name}
                  onChange={(e) => setEditingEnv({ ...editingEnv, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  className="form-textarea"
                  rows="3"
                  value={editingEnv.description || ''}
                  onChange={(e) => setEditingEnv({ ...editingEnv, description: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setShowEditEnvModal(false)
                  setEditingEnv(null)
                }} disabled={actionLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Edit Override Modal */}
      {showOverrideModal && editingOverride ? (
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
          zIndex: 1000,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '460px', padding: '28px', border: '1px solid var(--border-zinc-800)', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <h2 style={{ fontSize: 16, margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
                Configure Flag Override
              </h2>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                Environment: <strong>{editingOverride.environment_name}</strong>
              </span>
            </div>

            <form onSubmit={handleSaveOverride} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={overrideActive}
                    onChange={(e) => setOverrideActive(e.target.checked)}
                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    Enable Environment Override
                  </span>
                </label>
              </div>

              {overrideActive ? (
                <div className="form-group" style={{ animation: 'fadeIn 0.15s ease-out' }}>
                  <label>Override Value</label>
                  {selectedFlag?.type === 'boolean' ? (
                    <select
                      className="form-select"
                      value={overrideInputValue}
                      onChange={(e) => setOverrideInputValue(e.target.value)}
                    >
                      <option value="true">True (ON)</option>
                      <option value="false">False (OFF)</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="form-input"
                      required
                      placeholder={`Enter override ${selectedFlag?.type || 'string'} value`}
                      value={overrideInputValue}
                      onChange={(e) => setOverrideInputValue(e.target.value)}
                    />
                  )}
                </div>
              ) : null}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                {editingOverride.status === 'Overridden' ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ borderColor: '#ff4444', color: '#ff4444', background: 'rgba(255, 68, 68, 0.02)' }}
                    onClick={() => {
                      setShowOverrideModal(false)
                      handleResetOverride(editingOverride.environment_id)
                    }}
                  >
                    Reset to Default
                  </button>
                ) : <div />}

                <div style={{ display: 'flex', gap: 12 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => {
                    setShowOverrideModal(false)
                    setEditingOverride(null)
                  }} disabled={actionLoading}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                    {actionLoading ? 'Saving...' : 'Apply'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default Environments
