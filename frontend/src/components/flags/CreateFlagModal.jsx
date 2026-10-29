import { useState, useEffect } from 'react'

function CreateFlagModal({ isOpen, onClose, onCreate, currentEnv }) {
  const [key, setKey] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState('boolean')
  const [defaultValue, setDefaultValue] = useState('false')
  const [description, setDescription] = useState('')
  const [ownerTeam, setOwnerTeam] = useState('')
  const [environment, setEnvironment] = useState(currentEnv || 'development')
  const [isEnabled, setIsEnabled] = useState(false)
  const [error, setError] = useState('')

  // Sync environment when currentEnv changes
  useEffect(() => {
    setEnvironment(currentEnv || 'development')
  }, [currentEnv])

  // Adjust default value option based on type changes
  useEffect(() => {
    if (type === 'boolean') {
      setDefaultValue('false')
    } else if (type === 'number') {
      setDefaultValue('0')
    } else {
      setDefaultValue('')
    }
  }, [type])

  if (!isOpen) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    // Basic validation
    if (!key.trim()) {
      setError('Flag key is required')
      return
    }
    if (!/^[a-z0-9-_]+$/.test(key)) {
      setError('Flag key must contain only lowercase letters, numbers, dashes, and underscores')
      return
    }
    if (!name.trim()) {
      setError('Flag name is required')
      return
    }
    if (type === 'number' && isNaN(Number(defaultValue))) {
      setError('Default value must be a valid number')
      return
    }

    const payload = {
      key: key.trim(),
      name: name.trim(),
      type,
      default_value: defaultValue.trim(),
      description: description.trim() || null,
      owner_team: ownerTeam.trim() || null,
      is_enabled: isEnabled,
      environment: environment.toLowerCase(),
    }

    onCreate(payload)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Create Flag</h2>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '2px 8px', border: 'none', background: 'transparent', minWidth: 'auto', fontSize: 20 }}>
            &times;
          </button>
        </div>

        {error && (
          <div style={{ padding: '8px 12px', backgroundColor: 'rgba(255, 51, 51, 0.05)', color: '#ff3333', border: '1px solid rgba(255, 51, 51, 0.15)', borderRadius: 4, marginBottom: 16, fontSize: 12 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Flag Key</label>
            <input
              type="text"
              className="form-input"
              value={key}
              onChange={(e) => setKey(e.target.value.toLowerCase())}
              placeholder="e.g. new-checkout-flow"
              required
            />
          </div>

          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. New Checkout Flow"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label>Type</label>
              <select className="form-select" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="boolean">Boolean</option>
                <option value="string">String</option>
                <option value="number">Number</option>
              </select>
            </div>

            <div className="form-group">
              <label>Default Value</label>
              {type === 'boolean' ? (
                <select className="form-select" value={defaultValue} onChange={(e) => setDefaultValue(e.target.value)}>
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              ) : (
                <input
                  type="text"
                  className="form-input"
                  value={defaultValue}
                  onChange={(e) => setDefaultValue(e.target.value)}
                  placeholder={type === 'number' ? '0' : 'e.g. red-button'}
                  required
                />
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              className="form-textarea"
              rows="3"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the usage/intent of this feature toggle..."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label>Owner Team</label>
              <input
                type="text"
                className="form-input"
                value={ownerTeam}
                onChange={(e) => setOwnerTeam(e.target.value)}
                placeholder="e.g. Billing Team"
              />
            </div>

            <div className="form-group">
              <label>Environment</label>
              <select className="form-select" value={environment} onChange={(e) => setEnvironment(e.target.value)}>
                <option value="development">Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
            </div>
          </div>

          {/* Squeezed Enable toggler inline with label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 28px' }}>
            <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', fontFamily: 'var(--font-mono)', letterSpacing: '0.5px', color: 'var(--text-primary)' }}>
              Enabled
            </span>
            <label className="switch" style={{ margin: 0 }}>
              <input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} />
              <span className="slider"></span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create Flag
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateFlagModal
