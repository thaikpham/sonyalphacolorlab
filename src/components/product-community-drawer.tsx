'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { SonyCamera } from '@/lib/cameras/types';
import { SUBREDDIT_HANDLE, SUBREDDIT_URL, submitUrl } from '@/lib/reddit/config';
import {
  composeBody,
  composeTitle,
  TOPIC_TAGS,
  type CommunityTopic,
  type RedditStatus,
  type TopicTag,
} from '@/lib/reddit/topics';

interface ProductCommunityDrawerProps {
  product: SonyCamera;
}

type Filter = 'hot' | 'new' | TopicTag;

interface TopicsResponse {
  ok: boolean;
  status?: RedditStatus;
  topics?: CommunityTopic[];
}

function initialsFor(handle: string): string {
  const parts = handle.replace(/[._-]+/g, ' ').trim().split(/\s+/);
  return (parts[0]?.[0] ?? '?').concat(parts[1]?.[0] ?? '').toUpperCase();
}

/* The two chip rows — filters and compose tags — are the same control, so they
   share one recipe. A selection is an accent-tinted FILL plus a level-1 shadow,
   never a stroke, and the label on that field is pure ink rather than a darker
   step of the field's own colour. */
const CHIP = 'px-4 rounded-md text-label font-semibold whitespace-nowrap cursor-pointer transition-colors inline-flex items-center min-h-[var(--layout-touch-target)]';
const CHIP_ON = 'bg-accent-500/15 text-ink shadow-[var(--elevation-1)]';
const CHIP_OFF = 'bg-glass text-ink-muted hover:text-ink';

/**
 * The product's topics on r/<SUBREDDIT>, and a composer that hands off to
 * Reddit's own submit page.
 *
 * Every number on screen is Reddit's. There is no local score, no local post
 * list and no placeholder feed: a vote or a comment is an action on someone
 * else's platform under the reader's own account, so the card links out for it
 * rather than simulating it. The composer opens Reddit pre-filled for the same
 * reason — the post has to carry the name of whoever wrote it.
 */
export function ProductCommunityDrawer({ product }: ProductCommunityDrawerProps) {
  const t = useTranslations('cameras');

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<Filter>('new');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [topics, setTopics] = useState<CommunityTopic[]>([]);
  const [status, setStatus] = useState<RedditStatus | 'loading'>('loading');
  const [handedOff, setHandedOff] = useState(false);

  const [tag, setTag] = useState<TopicTag>('qa');
  const [titleDraft, setTitleDraft] = useState('');
  const [bodyDraft, setBodyDraft] = useState('');

  /* `now` is read once per load rather than at render time: `Date.now()` inside
     the map would make every card's timestamp a new value on every keystroke in
     the composer. */
  const [now, setNow] = useState(0);

  /* Which load is allowed to write. The refresh button is deliberately not
     disabled while a request is in flight — the reader pressing it twice must
     not feel like a dead control — so two fetches can overlap, and the network
     does not promise they resolve in the order they were sent. Without this
     counter the slower, older response lands last and wins: the panel shows a
     stale topic list, or flips `status` back to a value the newer request had
     already moved past. Every load claims a ticket and only the current holder
     touches state. */
  const loadTicket = useRef(0);

  /* No synchronous setState: `status` already starts at 'loading', and the
     refresh button puts it back there itself. An effect that sets state before
     its first await cascades a render on every mount for nothing. */
  const load = useCallback(async () => {
    const ticket = ++loadTicket.current;
    try {
      const res = await fetch(`/api/reddit/topics?productId=${encodeURIComponent(product.id)}`);
      const data = (await res.json()) as TopicsResponse;
      if (ticket !== loadTicket.current) return;
      setTopics(data.topics ?? []);
      setStatus(data.status ?? 'unavailable');
    } catch {
      if (ticket !== loadTicket.current) return;
      setTopics([]);
      setStatus('unavailable');
    }
    setNow(Math.floor(Date.now() / 1000));
  }, [product.id]);

  /* Product pages are statically generated for all 93 products across both
     locales, so the topic list cannot be server-rendered without baking a feed
     into the build — the initial load belongs on the client.

     `set-state-in-effect` cannot see through `useCallback` that `load` suspends
     on `await fetch(...)` before touching state, so no setState here is
     synchronous. Same disable, same reason as `recipe-community-section.tsx`;
     remove it if `load` ever gains a synchronous early setState. */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const refresh = () => {
    setStatus('loading');
    void load();
  };

  /* Opened, not posted. The reader presses Post on Reddit under their own
     account; this app never learns whether they did, so the draft stays in the
     box and the panel offers a refresh instead of claiming success. */
  const handOff = (e: React.FormEvent) => {
    e.preventDefault();
    const title = titleDraft.trim();
    if (!title) return;
    window.open(
      submitUrl(composeTitle(title, tag), composeBody(bodyDraft, product)),
      '_blank',
      'noopener,noreferrer',
    );
    setHandedOff(true);
  };

  const visible = useMemo(() => {
    if (activeFilter === 'hot') return [...topics].sort((a, b) => b.score - a.score);
    if (activeFilter === 'new') return topics;
    return topics.filter((x) => x.tag === activeFilter);
  }, [topics, activeFilter]);

  const relTime = (createdUtc: number) => {
    const hours = Math.floor((now - createdUtc) / 3600);
    if (hours < 1) return t('timeJustNow');
    if (hours < 24) return t('timeHours', { count: hours });
    return t('timeDays', { count: Math.round(hours / 24) });
  };

  const tagLabel: Record<TopicTag, string> = {
    guide: t('tagGuide'),
    recipe: t('tagRecipe'),
    sample: t('tagSample'),
    qa: t('tagQa'),
  };

  const filters: { key: Filter; label: string }[] = [
    { key: 'new', label: t('filterNew') },
    { key: 'hot', label: t('filterHot') },
    { key: 'recipe', label: t('filterRecipes') },
    { key: 'sample', label: t('filterPhotos') },
    { key: 'qa', label: t('filterQuestions') },
  ];

  /* A sheet: one film above the page it sits on. The radius, the blur and the
     shadow all come from `.surface-raised` as one recipe — nothing here paints
     its own background or edge. */
  const panel = (
    <div
      className={`w-full flex flex-col overflow-hidden surface-raised ${
        isFullscreen ? 'h-full max-w-5xl' : 'h-full'
      }`}
    >
      {/* Space header — the handle is a real, linkable community */}
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-md bg-community/15 text-community text-body font-semibold flex items-center justify-center shrink-0">
            r/
          </div>
          <div className="flex flex-col min-w-0">
            <a
              href={SUBREDDIT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-body-lg font-semibold text-ink hover:text-accent-400 transition-colors truncate"
            >
              {SUBREDDIT_HANDLE}
            </a>
            <span className="meta mt-0.5 truncate">
              {t('rTopicSubtitle', { name: product.name })}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="btn-glass shrink-0 cursor-pointer"
        >
          {isFullscreen ? t('exitFullscreenBtn') : t('fullscreenBtn')}
        </button>
      </div>

      <hr className="seam shrink-0" />

      {/* Why the feed is empty, when it is empty for a reason other than "no posts" */}
      {(status === 'notConfigured' || status === 'unauthorized' || status === 'unavailable') && (
        <p className="px-4 py-3 bg-danger/15 text-ink text-body-sm leading-relaxed">
          {t(`redditStatus.${status}`, { handle: SUBREDDIT_HANDLE })}
        </p>
      )}

      <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <span className="meta">
          {status === 'loading' ? t('topicsLoading') : t('topicCount', { count: topics.length })}
        </span>
        <button
          type="button"
          onClick={refresh}
          className="text-label font-semibold text-accent-400 hover:text-ink transition-colors cursor-pointer"
        >
          {t('refreshTopicsBtn')}
        </button>
      </div>

      <div className="flex items-center gap-2 px-4 pb-3 overflow-x-auto scroll-silent">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setActiveFilter(f.key)}
            className={`${CHIP} ${activeFilter === f.key ? CHIP_ON : CHIP_OFF}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <hr className="seam shrink-0" />

      <form onSubmit={handOff} className="p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 overflow-x-auto scroll-silent">
          {TOPIC_TAGS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTag(option)}
              aria-pressed={tag === option}
              className={`${CHIP} ${tag === option ? CHIP_ON : CHIP_OFF}`}
            >
              {tagLabel[option]}
            </button>
          ))}
        </div>

        {/* No `focus:outline-none` and no focus ring of its own: the one stroke
            in the system is the global `:focus-visible` outline. */}
        <input
          type="text"
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          placeholder={t('composeTitlePlaceholder', { name: product.name })}
          className="surface-sunken w-full px-4 py-3 text-body text-ink placeholder:text-ink-faint"
        />

        {titleDraft.trim() && (
          <>
            <textarea
              value={bodyDraft}
              onChange={(e) => setBodyDraft(e.target.value)}
              rows={3}
              placeholder={t('composeBodyPlaceholder')}
              className="surface-sunken w-full px-4 py-3 text-body text-ink placeholder:text-ink-faint resize-y"
            />
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="meta flex-1 min-w-[12rem] leading-relaxed">
                {t('handoffNote', { handle: SUBREDDIT_HANDLE })}
              </span>
              <button type="submit" className="btn-accent shrink-0 cursor-pointer">
                {t('composeOnRedditBtn')}
              </button>
            </div>
          </>
        )}

        {handedOff && (
          <p className="text-meta text-community leading-relaxed">{t('handoffDoneNote')}</p>
        )}
      </form>

      <hr className="seam shrink-0" />

      <div className="flex-1 scroll-area p-4 space-y-4">
        {status === 'loading' ? (
          <p className="py-16 px-6 text-center text-body text-ink-muted">{t('topicsLoading')}</p>
        ) : visible.length === 0 ? (
          <p className="py-16 px-6 text-center text-body text-ink-muted leading-relaxed">
            {t('topicsEmpty', { handle: SUBREDDIT_HANDLE })}
          </p>
        ) : (
          visible.map((topic) => {
            const isLong = topic.body.length > 140;
            const isOpen = !!expanded[topic.id];

            return (
              /* A pinned or moderator post floats one film higher. It used to be
                 a coloured stroke, and an elevation says the same thing without
                 spending a signal colour on decoration. */
              <article
                key={topic.id}
                className={`p-4 sm:p-5 flex flex-col gap-3 ${
                  topic.isPinned || topic.isMod ? 'surface-raised' : 'surface'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                    {/* One avatar treatment for everyone. The old hash picked one
                        of five hues per handle, which is a signal colour spent on
                        decoration — and it was never identity. */}
                    <span
                      className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center bg-accent-900 text-accent-200 text-label font-semibold"
                      aria-hidden="true"
                    >
                      {initialsFor(topic.author)}
                    </span>
                    <a
                      href={`https://www.reddit.com/user/${topic.author}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-body-sm font-semibold text-ink hover:text-accent-400 transition-colors truncate"
                    >
                      u/{topic.author}
                    </a>
                    {topic.isMod && (
                      <span className="px-2 py-0.5 rounded-sm bg-accent-500/15 text-accent-200 text-label font-semibold">
                        {t('adminBadge')}
                      </span>
                    )}
                    {topic.isPinned && (
                      <span className="px-2 py-0.5 rounded-sm bg-glass text-ink-muted text-label font-semibold">
                        {t('pinnedBadge')}
                      </span>
                    )}
                    <span className="meta">• {relTime(topic.createdUtc)}</span>
                  </div>

                  <span className="px-2.5 py-1 rounded-sm bg-glass text-ink-muted text-label font-semibold shrink-0">
                    {tagLabel[topic.tag]}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <a
                    href={topic.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-body sm:text-body-lg font-semibold text-ink hover:text-accent-400 transition-colors leading-snug"
                  >
                    {topic.title}
                  </a>
                  {topic.body && (
                    <p className="text-body-sm sm:text-body text-ink-muted leading-relaxed whitespace-pre-line">
                      {isLong && !isOpen ? `${topic.body.slice(0, 140)}…` : topic.body}
                    </p>
                  )}
                  {isLong && (
                    <button
                      type="button"
                      onClick={() => setExpanded((p) => ({ ...p, [topic.id]: !isOpen }))}
                      className="text-body-sm font-semibold text-accent-400 hover:text-ink transition-colors w-fit mt-1 cursor-pointer"
                    >
                      {isOpen ? t('collapseText') : t('expandText')}
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 meta">
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden="true">▲</span>
                      {topic.score}
                    </span>
                    <span>{t('commentsCount', { count: topic.comments })}</span>
                  </div>

                  <a
                    href={topic.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-glass inline-flex items-center shrink-0"
                  >
                    {t('openOnRedditBtn')}
                  </a>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-void/90 backdrop-blur-[30px] p-4 sm:p-8 flex items-center justify-center animate-fade-in">
        {panel}
      </div>
    );
  }

  return panel;
}
