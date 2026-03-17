import { useEffect, useMemo, useState } from 'react'

export function useSkillsMarketplaces() {
  const [marketplaces, setMarketplaces] = useState<SkillMarketplaceInfo[]>([])
  const [activeMarketplace, setActiveMarketplace] = useState('skillhub')

  useEffect(() => {
    window.api.skill.listMarketplaces().then((list) => {
      setMarketplaces(list)
      if (list.length === 0) return
      setActiveMarketplace((current) => (list.find((m) => m.id === current) ? current : list[0].id))
    })
  }, [])

  const marketplaceOptions = useMemo(
    () => marketplaces.map((m) => ({ value: m.id, label: m.name })),
    [marketplaces]
  )

  return {
    marketplaces,
    activeMarketplace,
    setActiveMarketplace,
    marketplaceOptions,
  }
}
