import { expect, it } from 'vitest'
import { AppearanceSize, AppearanceSpace, ComponentEvent, ComponentSlot, SemanticColor } from '../src/index'

it('vocabulary exports', () => {
  expect(SemanticColor.Error).toBe('error')
  expect(AppearanceSize.MD).toBe('md')
  expect(AppearanceSpace.Compact).toBe('compact')
  expect(ComponentEvent.Change).toBe('change')
  expect(ComponentSlot.Prepend).toBe('prepend')
})
