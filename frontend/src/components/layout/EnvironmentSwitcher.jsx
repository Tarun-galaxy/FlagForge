import { useEffect, useState } from 'react'
import apiClient from '../../api/client.js'

function EnvironmentSwitcher({ selectedEnv, onChange }) {
  const [environments, setEnvironments] = useState([])

  useEffect(() => {
    apiClient
      .get('/environments')
      .then((res) => {
        setEnvironments(res.data)
      })
      .catch((err) => {
        console.error('Failed to load environments', err)
        // Fallback default environments if server has issues
        setEnvironments([
          { id: 1, name: 'development' },
          { id: 2, name: 'staging' },
          { id: 3, name: 'production' },
        ])
      })
  }, [])

  return (
    <select
      value={selectedEnv}
      onChange={(e) => onChange(e.target.value)}
      className="form-select"
      style={{ padding: '6px 12px', fontSize: '13px', height: '36px', minWidth: '130px', fontWeight: 600 }}
    >
      {environments.map((env) => (
        <option key={env.id} value={env.name}>
          {env.name.toUpperCase()}
        </option>
      ))}
    </select>
  )
}

export default EnvironmentSwitcher