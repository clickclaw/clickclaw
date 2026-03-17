import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Col, Row, Skeleton, Tag, Typography } from 'antd'
import {
  ApiOutlined,
  GithubOutlined,
  GlobalOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import {
  CLICKCLAW_API_BASE_URL,
  CLICKCLAW_DOCS_URL,
  CLICKCLAW_WEBSITE_URL,
} from '@shared/urls'
import { getBrandLogo } from '../../assets/brand-logos'
import PageHeader from '../../components/PageHeader'

interface AboutApiPayload {
  version?: number
  updatedAt?: string
  about?: {
    productName?: string
    slogan?: string
    website?: string
    docs?: string
    communityPage?: string
  }
  announcement?: {
    title?: string
    content?: string
  }
}

interface ChannelsApiPayload {
  community?: {
    groups?: Array<{
      name?: string
      joinUrl?: string
      qrImageUrl?: string
    }>
  }
}

interface CommunityGroup {
  name: string
  joinUrl?: string
  qrImageUrl?: string
}

const DEFAULT_GROUPS: CommunityGroup[] = []

export default function AboutPage(): React.ReactElement {
  const { t } = useTranslation()
  const atomgitLogo = getBrandLogo('atomgit')
  const [loading, setLoading] = useState(true)
  const [aboutPayload, setAboutPayload] = useState<AboutApiPayload | null>(null)
  const [communityGroups, setCommunityGroups] = useState<CommunityGroup[]>(DEFAULT_GROUPS)

  useEffect(() => {
    let disposed = false

    const load = async (): Promise<void> => {
      try {
        const [aboutRes, channelsRes] = await Promise.allSettled([
          fetch(`${CLICKCLAW_API_BASE_URL}/v1/about`, {
            headers: { Accept: 'application/json' },
          }),
          fetch(`${CLICKCLAW_API_BASE_URL}/v1/channels`, {
            headers: { Accept: 'application/json' },
          }),
        ])

        if (disposed) return

        if (aboutRes.status === 'fulfilled' && aboutRes.value.ok) {
          const payload = (await aboutRes.value.json()) as AboutApiPayload
          setAboutPayload(payload)
        }

        if (channelsRes.status === 'fulfilled' && channelsRes.value.ok) {
          const payload = (await channelsRes.value.json()) as ChannelsApiPayload
          const groups = (payload.community?.groups || [])
            .filter((group): group is CommunityGroup => typeof group?.name === 'string')
            .map((group) => ({
              name: group.name!,
              joinUrl: typeof group.joinUrl === 'string' ? group.joinUrl : undefined,
              qrImageUrl: typeof group.qrImageUrl === 'string' ? group.qrImageUrl : undefined,
            }))
          if (groups.length > 0) setCommunityGroups(groups)
        }
      } catch {
        // keep fallback UI
      } finally {
        if (!disposed) setLoading(false)
      }
    }

    load().catch(() => {
      if (!disposed) setLoading(false)
    })

    return () => {
      disposed = true
    }
  }, [])

  const productName = aboutPayload?.about?.productName || 'ClickClaw'
  const slogan = aboutPayload?.about?.slogan || t('aboutPage.defaultSlogan')
  const website = aboutPayload?.about?.website || CLICKCLAW_WEBSITE_URL
  const docs = aboutPayload?.about?.docs || CLICKCLAW_DOCS_URL

  const announcement = useMemo(() => {
    const title = aboutPayload?.announcement?.title
    const content = aboutPayload?.announcement?.content
    if (!title && !content) return null
    return {
      title: title || t('aboutPage.announcementTitle'),
      content: content || t('aboutPage.noAnnouncement'),
    }
  }, [aboutPayload?.announcement?.content, aboutPayload?.announcement?.title, t])

  return (
    <div style={{ padding: '24px 28px 36px', height: '100%', overflow: 'auto' }}>
      <PageHeader title={t('aboutPage.title')} subtitle={t('aboutPage.subtitle')} />

      {loading ? (
        <Card style={{ borderRadius: 12, marginBottom: 16 }}>
          <Skeleton active paragraph={{ rows: 4 }} />
        </Card>
      ) : (
        <>
          <Card
            style={{
              borderRadius: 12,
              marginBottom: 16,
              borderColor: '#ffd8bf',
              background:
                'linear-gradient(160deg, rgba(255,237,230,0.9) 0%, rgba(255,255,255,0.98) 45%, rgba(255,249,245,0.98) 100%)',
            }}
          >
            <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 6 }}>
              {productName}
            </Typography.Title>
            <Typography.Paragraph style={{ marginBottom: 12, color: '#595959' }}>
              {slogan}
            </Typography.Paragraph>
            <Row gutter={[8, 8]}>
              <Col>
                <Button
                  icon={<GlobalOutlined />}
                  onClick={() => window.api.shell.openExternal(website)}
                >
                  {t('aboutPage.website')}
                </Button>
              </Col>
              <Col>
                <Button icon={<ApiOutlined />} onClick={() => window.api.shell.openExternal(docs)}>
                  {t('aboutPage.docs')}
                </Button>
              </Col>
              <Col>
                <Button
                  icon={<GithubOutlined />}
                  onClick={() =>
                    window.api.shell.openExternal('https://github.com/clickclaw/clickclaw')
                  }
                >
                  GitHub
                </Button>
              </Col>
              <Col>
                <Button
                  icon={
                    atomgitLogo ? (
                      <img
                        src={atomgitLogo}
                        alt="atomgit-logo"
                        style={{ width: 14, height: 14, objectFit: 'contain' }}
                      />
                    ) : (
                      <LinkOutlined />
                    )
                  }
                  onClick={() =>
                    window.api.shell.openExternal('https://atomgit.com/clickclaw/clickclaw')
                  }
                >
                  AtomGit
                </Button>
              </Col>
            </Row>
          </Card>

          {announcement && (
            <Alert
              showIcon
              type="info"
              style={{ marginBottom: 16, borderRadius: 10 }}
              message={announcement.title}
              description={announcement.content}
            />
          )}

          <Typography.Title level={5} style={{ marginBottom: 10 }}>
            {t('aboutPage.communityTitle')}
          </Typography.Title>
          <Row gutter={[12, 12]}>
            {communityGroups.map((group) => (
              <Col xs={24} sm={12} lg={8} key={group.name}>
                <Card size="small" style={{ borderRadius: 10 }}>
                  <Typography.Text strong>{group.name}</Typography.Text>
                  <div style={{ marginTop: 10, marginBottom: 10 }}>
                    {group.qrImageUrl ? (
                      <img
                        src={group.qrImageUrl}
                        alt={`${group.name}-qr`}
                        style={{
                          width: 160,
                          height: 160,
                          borderRadius: 8,
                          border: '1px solid #f0f0f0',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 160,
                          height: 160,
                          borderRadius: 8,
                          border: '1px dashed #d9d9d9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#8c8c8c',
                          fontSize: 12,
                        }}
                      >
                        {t('aboutPage.qrComingSoon')}
                      </div>
                    )}
                  </div>
                  {group.joinUrl ? (
                    <Button
                      block
                      type="primary"
                      style={{ background: '#FF4D2A', borderColor: '#FF4D2A' }}
                      onClick={() => window.api.shell.openExternal(group.joinUrl!)}
                    >
                      {t('aboutPage.joinNow')}
                    </Button>
                  ) : (
                    <Tag color="default">{t('aboutPage.waitingPublish')}</Tag>
                  )}
                </Card>
              </Col>
            ))}
          </Row>

          <Typography.Title level={5} style={{ marginTop: 20, marginBottom: 10 }}>
            {t('settings.about.feedback')}
          </Typography.Title>
          <Card size="small" style={{ borderRadius: 10 }}>
            <Typography.Paragraph style={{ marginBottom: 10, color: '#595959' }}>
              {t('settings.about.feedbackModalDesc')}
            </Typography.Paragraph>
            <Row gutter={[8, 8]}>
              <Col>
                <Button
                  icon={<GithubOutlined />}
                  onClick={() =>
                    window.api.shell.openExternal('https://github.com/clickclaw/clickclaw/issues')
                  }
                >
                  GitHub Issues
                </Button>
              </Col>
              <Col>
                <Button
                  icon={
                    atomgitLogo ? (
                      <img
                        src={atomgitLogo}
                        alt="atomgit-logo"
                        style={{ width: 14, height: 14, objectFit: 'contain' }}
                      />
                    ) : (
                      <LinkOutlined />
                    )
                  }
                  onClick={() =>
                    window.api.shell.openExternal('https://atomgit.com/clickclaw/clickclaw/issues')
                  }
                >
                  AtomGit Issues
                </Button>
              </Col>
            </Row>
          </Card>
        </>
      )}
    </div>
  )
}
