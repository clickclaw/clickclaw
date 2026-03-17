import { useEffect, useState } from 'react'
import { Typography } from 'antd'
import type { CSSProperties } from 'react'

const { Text } = Typography

interface AppVersionProps {
  style?: CSSProperties
}

function AppVersion({ style }: AppVersionProps): React.ReactElement {
  const [version, setVersion] = useState<string>('')

  useEffect(() => {
    window.api
      .getVersion()
      .then(setVersion)
      .catch(() => {})
  }, [])

  if (!version) return <></>

  return <Text style={{ fontSize: 11, color: 'rgba(0,0,0,0.25)', ...style }}>v{version}</Text>
}

export default AppVersion
