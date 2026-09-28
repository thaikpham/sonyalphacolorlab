import { describe, expect, it } from 'vitest'
import en from '../../../messages/en.json'
import vi from '../../../messages/vi.json'
import { LEVELS, TOPICS } from './articles'
import { CURRICULUM, topicsForLevel } from './curriculum'
import type { Article } from './types'

const CATALOGUES = { en, vi } as const

describe('learning path', () => {
  it('maps every level, and only real topics', () => {
    const topicIds = new Set(TOPICS.map((t) => t.id))
    for (const level of LEVELS) {
      expect(CURRICULUM[level.id].length, level.id).toBeGreaterThan(0)
      for (const topic of CURRICULUM[level.id]) expect(topicIds.has(topic), topic).toBe(true)
    }
  })

  it('reaches every topic from at least one stage', () => {
    const mapped = new Set(Object.values(CURRICULUM).flat())
    expect(TOPICS.filter((t) => !mapped.has(t.id)).map((t) => t.id)).toEqual([])
  })

  /* The focus line is what a topic means at that stage. A mapped topic
     without one would render as a bare name, which is the list of chips this
     replaced; a line without a mapping is copy nothing shows. */
  it.each(Object.keys(CATALOGUES) as (keyof typeof CATALOGUES)[])(
    '%s has a mindset and exactly the mapped focus lines',
    (locale) => {
      const path = CATALOGUES[locale].lab.path as Record<
        string,
        { mindset: string; focus: Record<string, string> }
      >
      for (const level of LEVELS) {
        const stage = path[level.id]
        expect(stage.mindset, `${locale} ${level.id}`).not.toBe('')
        expect(Object.keys(stage.focus).sort()).toEqual([...CURRICULUM[level.id]].sort())
      }
    },
  )

  it('keeps an article filed outside the map reachable, after the map', () => {
    const stray = { id: 'x', topic: 'firmware', level: 'newbie' } as Article
    const topics = topicsForLevel('newbie', [stray])
    expect(topics.slice(0, CURRICULUM.newbie.length)).toEqual(CURRICULUM.newbie)
    expect(topics.at(-1)).toBe('firmware')
    expect(topicsForLevel('newbie', [stray, stray])).toHaveLength(CURRICULUM.newbie.length + 1)
  })
})
