import { useCallback, useState } from 'react'
import type { ProxyState } from '../settings-page.types'

interface UseSettingsProxyArgs {
  gwState: GatewayState
  t: (key: string, options?: Record<string, unknown>) => string
  onSuccess: (text: string) => void
  onError: (text: string) => void
}

export function useSettingsProxy({ gwState, t, onSuccess, onError }: UseSettingsProxyArgs) {
  const [savedProxy, setSavedProxy] = useState<ProxyState>({
    enabled: false,
    url: '',
    bypass: 'localhost;127.0.0.1;::1;<local>',
  })
  const [draftProxy, setDraftProxy] = useState<ProxyState>({
    enabled: false,
    url: '',
    bypass: 'localhost;127.0.0.1;::1;<local>',
  })
  const [proxySaving, setProxySaving] = useState(false)
  const [proxyJustSaved, setProxyJustSaved] = useState(false)
  const [proxyTesting, setProxyTesting] = useState(false)
  const [proxyTestResult, setProxyTestResult] = useState<{
    ok: boolean
    latencyMs?: number
    error?: string
  } | null>(null)
  const proxyDirty =
    draftProxy.enabled !== savedProxy.enabled ||
    draftProxy.url !== savedProxy.url ||
    draftProxy.bypass !== savedProxy.bypass

  const applyInitial = useCallback((proxyCfg: ProxySettings): void => {
    const next = {
      enabled: proxyCfg.proxyEnabled,
      url: proxyCfg.proxyUrl,
      bypass: proxyCfg.proxyBypass,
    }
    setSavedProxy(next)
    setDraftProxy(next)
  }, [])

  const doSaveProxy = useCallback(async (): Promise<boolean> => {
    try {
      await window.api.proxy.set({
        proxyEnabled: draftProxy.enabled,
        proxyUrl: draftProxy.url,
        proxyBypass: draftProxy.bypass,
      })
      setSavedProxy({ ...draftProxy })
      setProxyJustSaved(true)
      setTimeout(() => setProxyJustSaved(false), 2000)
      return true
    } catch {
      return false
    }
  }, [draftProxy])

  const handleProxySave = useCallback(async (): Promise<void> => {
    setProxySaving(true)
    setProxyTestResult(null)
    const ok = await doSaveProxy()
    setProxySaving(false)
    if (ok) {
      onSuccess(gwState === 'running' ? t('common.restartSuccess') : t('settings.proxy.applied'))
    } else {
      onError(t('common.saveFailed'))
    }
  }, [doSaveProxy, gwState, onError, onSuccess, t])

  const handleProxyTest = useCallback(async (): Promise<void> => {
    setProxyTesting(true)
    setProxyTestResult(null)
    try {
      const result = await window.api.proxy.test({
        proxyUrl: draftProxy.url,
        proxyBypass: draftProxy.bypass,
      })
      setProxyTestResult(result)
    } finally {
      setProxyTesting(false)
    }
  }, [draftProxy.bypass, draftProxy.url])

  return {
    savedProxy,
    draftProxy,
    setDraftProxy,
    proxySaving,
    proxyJustSaved,
    proxyTesting,
    proxyTestResult,
    setProxyTestResult,
    proxyDirty,
    applyInitial,
    handleProxySave,
    handleProxyTest,
  }
}
