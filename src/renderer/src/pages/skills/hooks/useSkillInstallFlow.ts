import { App } from 'antd'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { VetStepUI } from '../skills-page.types'
import { INITIAL_VET_STEPS } from '../skills-page.types'

interface UseSkillInstallFlowParams {
  activeMarketplace: string
  skillsDir: string
  loadInstalled: () => Promise<void>
}

export function useSkillInstallFlow({
  activeMarketplace,
  skillsDir,
  loadInstalled,
}: UseSkillInstallFlowParams) {
  const { t, i18n } = useTranslation()
  const { message } = App.useApp()

  const [installingSlug, setInstallingSlug] = useState<string | null>(null)
  const [vetModalOpen, setVetModalOpen] = useState(false)
  const [vetModalSlug, setVetModalSlug] = useState<string | null>(null)
  const [vetPhase, setVetPhase] = useState<'progress' | 'result'>('progress')
  const [vetSteps, setVetSteps] = useState<VetStepUI[]>(INITIAL_VET_STEPS)
  const [vetStreamText, setVetStreamText] = useState('')
  const [vetResult, setVetResult] = useState<VetResult | null>(null)
  const [vetError, setVetError] = useState<string | null>(null)
  const vetCancelledRef = useRef(false)

  const doInstall = useCallback(
    async (slug: string) => {
      setInstallingSlug(slug)
      try {
        const result = await window.api.skill.install(activeMarketplace, slug, undefined, skillsDir)
        if (result.success) {
          message.success(t('skills.installSuccess', { name: slug }))
          await loadInstalled()
        } else {
          message.error(t('skills.installFailed', { error: result.error }))
        }
      } catch (err) {
        message.error(t('skills.installFailed', { error: String(err) }))
      } finally {
        setInstallingSlug(null)
      }
    },
    [activeMarketplace, loadInstalled, message, skillsDir, t]
  )

  const handleInstall = useCallback(
    async (slug: string) => {
      const vetSettings = await window.api.skill.vetSettings
        .get()
        .catch(() => ({ enabled: false, customModel: null }))

      if (!vetSettings.enabled) {
        await doInstall(slug)
        return
      }

      vetCancelledRef.current = false
      setVetModalSlug(slug)
      setVetPhase('progress')
      setVetSteps([...INITIAL_VET_STEPS])
      setVetStreamText('')
      setVetError(null)
      setVetResult(null)
      setVetModalOpen(true)
      setInstallingSlug(slug)

      const unsubscribe = window.api.skill.onVetProgress((evt) => {
        const { stage, chunk } = evt

        setVetSteps((prev) =>
          prev.map((s) => {
            if (stage === 'downloading' && s.key === 'downloading')
              return { ...s, status: 'processing' }
            if (stage === 'parsing' && s.key === 'downloading') return { ...s, status: 'done' }
            if (stage === 'parsing' && s.key === 'parsing') return { ...s, status: 'processing' }
            if (stage === 'analyzing' && s.key === 'parsing') return { ...s, status: 'done' }
            if (stage === 'analyzing' && s.key === 'analyzing')
              return { ...s, status: 'processing' }
            if (stage === 'done' && s.status !== 'error') return { ...s, status: 'done' }
            return s
          })
        )

        if (stage === 'analyzing' && chunk) {
          setVetStreamText((prev) => prev + chunk)
        }
      })

      try {
        const result = await window.api.skill.vet(activeMarketplace, slug, undefined, i18n.language)
        if (vetCancelledRef.current) return
        setVetResult(result)
        setVetPhase('result')
      } catch (err) {
        if (vetCancelledRef.current) return
        const errMsg = err instanceof Error ? err.message : String(err)
        if (errMsg.includes('no-model-configured')) {
          setVetModalOpen(false)
          setInstallingSlug(null)
          message.warning(t('skills.vetter.noModelConfigured'))
          await doInstall(slug)
        } else {
          setVetError(errMsg)
        }
      } finally {
        unsubscribe()
      }
    },
    [activeMarketplace, doInstall, i18n.language, message, t]
  )

  const handleConfirmInstall = useCallback(async () => {
    const slug = vetModalSlug
    setVetModalOpen(false)
    setVetModalSlug(null)
    setVetResult(null)
    if (!slug) return
    await doInstall(slug)
  }, [doInstall, vetModalSlug])

  const handleCancelVet = useCallback(() => {
    vetCancelledRef.current = true
    setVetModalOpen(false)
    setInstallingSlug(null)
    setVetError(null)
    if (vetModalSlug) {
      window.api.skill.vetCancel(vetModalSlug)
    }
  }, [vetModalSlug])

  return {
    installingSlug,
    vetModalOpen,
    vetModalSlug,
    vetPhase,
    vetSteps,
    vetStreamText,
    vetResult,
    vetError,
    handleInstall,
    handleConfirmInstall,
    handleCancelVet,
  }
}
