import { useState, useEffect } from 'react'
import { Layout, Menu } from 'antd'
import type { MenuProps } from 'antd'
import {
  DashboardOutlined,
  MessageOutlined,
  RobotOutlined,
  ApiOutlined,
  ThunderboltOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  SettingOutlined,
  DatabaseOutlined,
  ScheduleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { GatewayProvider } from '../contexts/GatewayContext'
import TitleBar from '../components/TitleBar'

const { Sider, Content } = Layout

type MenuItem = Required<MenuProps>['items'][number]

function MainLayout(): React.ReactElement {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [version, setVersion] = useState('')

  useEffect(() => {
    window.api.getVersion().then(setVersion)
    window.api.appState
      .get()
      .then((state) => {
        setCollapsed(state.sidebarCollapsed)
      })
      .catch(() => {})
  }, [])

  const handleCollapse = (value: boolean): void => {
    setCollapsed(value)
    window.api.appState.set({ sidebarCollapsed: value }).catch(() => {})
  }

  const menuItems: MenuItem[] = [
    {
      key: 'home-group',
      type: 'group',
      label: t('sidebar.home'),
      children: [
        { key: '/dashboard', icon: <DashboardOutlined />, label: t('sidebar.dashboard') },
        { key: '/chat', icon: <MessageOutlined />, label: t('sidebar.chat') },
        { key: '/cron', icon: <ScheduleOutlined />, label: t('sidebar.cron') },
      ],
    },
    {
      key: 'config-group',
      type: 'group',
      label: t('sidebar.config'),
      children: [
        { key: '/agents', icon: <RobotOutlined />, label: t('sidebar.agents') },
        { key: '/models', icon: <ThunderboltOutlined />, label: t('sidebar.models') },
        { key: '/channels', icon: <ApiOutlined />, label: t('sidebar.channels') },
        { key: '/skills', icon: <AppstoreOutlined />, label: t('sidebar.skills') },
      ],
    },
    {
      key: 'system-group',
      type: 'group',
      label: t('sidebar.system'),
      children: [
        { key: '/logs', icon: <FileTextOutlined />, label: t('sidebar.logs') },
        { key: '/backup', icon: <DatabaseOutlined />, label: t('sidebar.backup') },
        { key: '/settings', icon: <SettingOutlined />, label: t('sidebar.settings') },
        { key: '/about', icon: <InfoCircleOutlined />, label: t('sidebar.about') },
      ],
    },
  ]

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key)
  }

  return (
    // 外层 flex 列：TitleBar(40px) + 主布局(剩余高度)
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TitleBar />

      <Layout style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <Sider
          width={220}
          collapsedWidth={80}
          collapsible
          collapsed={collapsed}
          onCollapse={handleCollapse}
          style={{ overflow: 'auto', height: '100%', position: 'relative' }}
        >
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={handleMenuClick}
            style={{ paddingTop: 8 }}
          />

          <div
            style={{
              position: 'absolute',
              bottom: 48,
              width: '100%',
              textAlign: 'center',
              color: 'rgba(255,255,255,0.35)',
              fontSize: 12,
              pointerEvents: 'none',
            }}
          >
            {collapsed ? `v${version.split('.')[0] || ''}` : `v${version}`}
          </div>
        </Sider>

        <Layout style={{ overflow: 'hidden' }}>
          <Content style={{ height: '100%', overflow: 'auto' }}>
            <GatewayProvider>
              <Outlet />
            </GatewayProvider>
          </Content>
        </Layout>
      </Layout>
    </div>
  )
}

export default MainLayout
