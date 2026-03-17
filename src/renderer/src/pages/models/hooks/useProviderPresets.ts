import { useEffect, useState } from 'react'
import type { DisplayBrand, DisplayBrandSection } from '../model-page.types'
import { toDisplaySections } from '../model-page.utils'

export function useProviderPresets() {
  const [brands, setBrands] = useState<DisplayBrand[]>([])
  const [brandSections, setBrandSections] = useState<DisplayBrandSection[]>([])

  useEffect(() => {
    window.api.provider.getPresets().then((data) => {
      const sections = data as ProviderPresetSection[]
      const nextSections = toDisplaySections(sections)
      setBrandSections(nextSections)
      setBrands(nextSections.flatMap((section) => section.items))
    })
  }, [])

  return { brands, brandSections }
}
