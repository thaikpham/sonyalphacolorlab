import type { Article, LevelId, TopicId } from './types'

/**
 * The learning path: which topics each stage is about, in the order a reader
 * at that stage should meet them.
 *
 * A topic is not owned by one level. Autofocus is "which focus mode" for a
 * beginner, "back-button and tracking" in the middle and "a per-genre setup"
 * at the top — the same subject, a different skill set and a different
 * question. So the map is level → topics, and what a topic MEANS at a stage
 * is its focus line in `messages/*.json` (`lab.path.<level>.focus.<topic>`),
 * which `curriculum.test.ts` keeps in step with this file.
 *
 * The three stages follow the shape of the skill-acquisition models photo and
 * film teaching tends to lean on (Dreyfus is the usual one): a novice needs
 * rules and a reason for them; a competent shooter plans for the situation in
 * front of them; a proficient one builds a system that holds under pressure
 * and across bodies. The mindset line for each stage says that in the
 * reader's terms.
 *
 * The map lists topics that have no article yet on purpose. It is a syllabus,
 * and knowing what the next stage covers is useful before anything is
 * written about it — the rail shows those rows as "coming soon", not links.
 */
export const CURRICULUM: Readonly<Record<LevelId, readonly TopicId[]>> = {
  newbie: ['setup', 'exposure', 'composition', 'af', 'lens', 'color', 'video', 'audio'],
  mid: ['exposure', 'composition', 'af', 'color', 'video', 'audio', 'lens', 'post', 'gear', 'firmware'],
  pro: ['composition', 'color', 'post', 'video', 'audio', 'af', 'body', 'gear'],
}

/**
 * A stage's topics, as the rail lists them: the curriculum first, then any
 * topic an editor has published at this level that the map does not name.
 * The second half is what keeps an article reachable when it is filed
 * somewhere the syllabus did not anticipate — the map guides, it never hides.
 */
export function topicsForLevel(level: LevelId, articles: readonly Article[]): readonly TopicId[] {
  const planned = CURRICULUM[level]
  const extra = [
    ...new Set(
      articles.filter((a) => a.level === level && !planned.includes(a.topic)).map((a) => a.topic),
    ),
  ]
  return [...planned, ...extra]
}
