/**
 * PageHeader — 统一页面顶部头部组件
 *
 * 用于列表型页面（Models、Channels、Agents、Skills、Logs、Backup 等），
 * 提供一致的标题、副标题、右侧操作区和底部分割线。
 */

import { Typography } from 'antd'
import type { ReactNode } from 'react'

interface PageHeaderProps {
  /** 页面标题 */
  title: string
  /** 副标题/描述（如"3 个渠道"），可选 */
  subtitle?: string
  /** 右侧操作区（按钮、选择器等），可选 */
  extra?: ReactNode
}

export default function PageHeader({
  title,
  subtitle,
  extra,
}: PageHeaderProps): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 16,
        borderBottom: '1px solid #ebebeb',
      }}
    >
      <div>
        <Typography.Title
          level={4}
          style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}
        >
          {title}
        </Typography.Title>
        {subtitle && (
          <Typography.Text
            type="secondary"
            style={{ fontSize: 12, marginTop: 2, display: 'block' }}
          >
            {subtitle}
          </Typography.Text>
        )}
      </div>
      {extra && <div style={{ flexShrink: 0 }}>{extra}</div>}
    </div>
  )
}
