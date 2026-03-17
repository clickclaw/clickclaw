import { describe, expect, it } from 'vitest'
import {
  buildDefaultModelPathIfMissing,
  mergeRemoteModels,
  removeModel,
  upsertModel,
  type ModelLike,
} from '../../../shared/models/model-hook-helpers'

describe('model-hook.helpers', () => {
  describe('upsertModel', () => {
    it('adds model when id does not exist', () => {
      const existing: ModelLike[] = [{ id: 'gpt-4o', name: 'GPT-4o' }]
      const next = upsertModel(existing, { id: 'gpt-4.1', name: 'GPT-4.1' })
      expect(next).toEqual([
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'gpt-4.1', name: 'GPT-4.1' },
      ])
    })

    it('replaces model when id already exists', () => {
      const existing: ModelLike[] = [
        { id: 'gpt-4o', name: 'old-name', input: ['text'] },
        { id: 'o3-mini', name: 'o3-mini' },
      ]
      const next = upsertModel(existing, {
        id: 'gpt-4o',
        name: 'new-name',
        input: ['text', 'image'],
      })
      expect(next).toEqual([
        { id: 'gpt-4o', name: 'new-name', input: ['text', 'image'] },
        { id: 'o3-mini', name: 'o3-mini' },
      ])
    })
  })

  describe('removeModel', () => {
    it('removes target id and preserves others', () => {
      const existing: ModelLike[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
      expect(removeModel(existing, 'b')).toEqual([{ id: 'a' }, { id: 'c' }])
    })
  })

  describe('mergeRemoteModels', () => {
    it('adds only missing remote ids and keeps existing order', () => {
      const existing: ModelLike[] = [{ id: 'gpt-4o', name: 'GPT-4o' }]
      const merged = mergeRemoteModels(existing, ['gpt-4o', 'gpt-4.1', 'o3-mini'])
      expect(merged).toEqual([
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'gpt-4.1', name: 'gpt-4.1', input: ['text'] },
        { id: 'o3-mini', name: 'o3-mini', input: ['text'] },
      ])
    })
  })

  describe('buildDefaultModelPathIfMissing', () => {
    it('returns null when current default already exists (string)', () => {
      expect(
        buildDefaultModelPathIfMissing('openai/gpt-4o', 'openai', [{ id: 'gpt-4.1' }])
      ).toBeNull()
    })

    it('returns null when current default already exists (object)', () => {
      expect(
        buildDefaultModelPathIfMissing({ primary: 'openai/gpt-4o', fallbacks: [] }, 'openai', [
          { id: 'gpt-4.1' },
        ])
      ).toBeNull()
    })

    it('returns null when no models provided', () => {
      expect(buildDefaultModelPathIfMissing(null, 'openai', [])).toBeNull()
      expect(buildDefaultModelPathIfMissing(null, 'openai', undefined)).toBeNull()
    })

    it('builds provider/model path when default missing', () => {
      expect(buildDefaultModelPathIfMissing(null, 'openai', [{ id: 'gpt-4.1' }])).toBe(
        'openai/gpt-4.1'
      )
    })
  })
})
