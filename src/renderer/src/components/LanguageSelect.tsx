import { Select, Space } from 'antd'
import { GlobalOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'

function LanguageSelect(): React.ReactElement {
  const { i18n } = useTranslation()

  return (
    <Space size={4} style={{ cursor: 'default' }}>
      <GlobalOutlined style={{ fontSize: 12, color: 'rgba(0,0,0,0.35)' }} />
      <Select
        value={i18n.language}
        onChange={(val) => i18n.changeLanguage(val)}
        options={[
          { value: 'zh-CN', label: '中文' },
          { value: 'en', label: 'English' },
        ]}
        size="small"
        variant="borderless"
        popupMatchSelectWidth={false}
        style={{ width: 90 }}
      />
    </Space>
  )
}

export default LanguageSelect
