import { ClearOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, Input, Space } from 'antd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveLogs } from '../hooks/useLiveLogs'
import { colorForLine, LOG_AREA_HEIGHT_WITH_TOOLBAR, logBoxStyle } from '../logs-page.utils'
import { LogLine } from './LogLine'

export function LiveLogsTab(): React.ReactElement {
  const { t } = useTranslation()
  const [filter, setFilter] = useState('')
  const { lines, boxRef, handleScroll, clear } = useLiveLogs()

  const filtered = filter
    ? lines.filter((l) => l.toLowerCase().includes(filter.toLowerCase()))
    : lines

  return (
    <div>
      <Space style={{ marginBottom: 8 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder={t('logs.filter')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ width: 240 }}
          allowClear
        />
        <Button icon={<ClearOutlined />} onClick={clear}>
          {t('logs.clear')}
        </Button>
      </Space>
      <div
        ref={boxRef}
        onScroll={handleScroll}
        style={{ ...logBoxStyle, height: LOG_AREA_HEIGHT_WITH_TOOLBAR }}
      >
        {filtered.length === 0 ? (
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>{t('logs.noLogs')}</span>
        ) : (
          filtered.map((line, i) => (
            <LogLine key={i} line={line} color={colorForLine(line) || 'rgba(255,255,255,0.75)'} />
          ))
        )}
      </div>
    </div>
  )
}
