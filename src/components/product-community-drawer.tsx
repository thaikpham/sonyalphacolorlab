'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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

/**
 * Deterministic avatar tint, so a handle keeps the same colour across renders.
 * Cheap hash — this is decoration, not identity.
 */
const AVATAR_TINTS = [
  'bg-amber-400/25 text-amber-200 border-amber-400/40',
  'bg-sky-400/25 text-sky-200 border-sky-400/40',
  'bg-emerald-400/25 text-emerald-200 border-emerald-400/40',
  'bg-fuchsia-400/25 text-fuchsia-200 border-fuchsia-400/40',
  'bg-rose-400/25 text-rose-200 border-rose-400/40',
];

function tintFor(handle: string): string {
  let h = 0;
  for (let i = 0; i < handle.length; i += 1) h = (h * 31 + handle.charCodeAt(i)) % 997;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

function initialsFor(handle: string): string {
  const parts = handle.replace(/[._-]+/g, ' ').trim().split(/\s+/);
  return (parts[0]?.[0] ?? '?').concat(parts[1]?.[0] ?? '').toUpperCase();
}

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

  /* No synchronous setState: `status` already starts at 'loading', and the
     refresh button puts it back there itself. An effect that sets state before
     its first await cascades a render on every mount for nothing. */
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/reddit/topics?productId=${encodeURIComponent(product.id)}`);
      const data = (await res.json()) as TopicsResponse;
      setTopics(data.topics ?? []);
      setStatus(data.status ?? 'unavailable');
    } catch {
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

  const panel = (
    <div
      className={`w-full flex flex-col bg-[#14151a] border border-white/20 overflow-hidden shadow-2xl font-sans ${
        isFullscreen ? 'h-full max-w-5xl rounded-3xl' : 'h-full rounded-2xl'
      }`}
    >
      {/* Space header — the handle is a real, linkable community */}
      <div className="p-4 bg-gradient-to-r from-amber-500/20 via-black to-sky-500/15 border-b border-white/20 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-400 text-black font-black flex items-center justify-center text-sm shadow-md shrink-0 font-mono">
            r/
          </div>
          <div className="flex flex-col min-w-0">
            <a
              href={SUBREDDIT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-extrabold text-[1rem] sm:text-lg text-white hover:text-amber-300 transition-colors tracking-tight font-mono truncate"
            >
              {SUBREDDIT_HANDLE}
            </a>
            <span className="text-xs text-slate-100 font-semibold mt-0.5 truncate">
              {t('rTopicSubtitle', { name: product.name })}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="px-3.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-extrabold transition-all cursor-pointer border border-white/30 shrink-0"
        >
          {isFullscreen ? t('exitFullscreenBtn') : t('fullscreenBtn')}
        </button>
      </div>

      {/* Why the feed is empty, when it is empty for a reason other than "no posts" */}
      {(status === 'notConfigured' || status === 'unauthorized' || status === 'unavailable') && (
        <p className="px-4 py-2.5 bg-amber-400/15 border-b border-amber-400/40 text-[11px] sm:text-xs text-amber-100 font-semibold leading-relaxed">
          {t(`redditStatus.${status}`, { handle: SUBREDDIT_HANDLE })}
        </p>
      )}

      <div className="px-4 py-2.5 bg-black/90 border-b border-white/20 flex items-center justify-between gap-3 text-xs flex-wrap">
        <span className="font-mono font-bold text-slate-100">
          {status === 'loading' ? t('topicsLoading') : t('topicCount', { count: topics.length })}
        </span>
        <button
          type="button"
          onClick={refresh}
          className="font-extrabold text-sky-300 hover:text-sky-200 transition-colors cursor-pointer"
        >
          {t('refreshTopicsBtn')}
        </button>
      </div>

      <div className="flex items-center gap-2 px-4 py-2.5 bg-black/80 border-b border-white/15 overflow-x-auto scrollbar-none text-xs">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setActiveFilter(f.key)}
            className={`px-4 py-1.5 rounded-xl font-extrabold transition-all cursor-pointer whitespace-nowrap ${
              activeFilter === f.key
                ? 'bg-amber-400 text-black shadow-md'
                : 'text-slate-100 hover:text-white bg-white/10 border border-white/15'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <form onSubmit={handOff} className="p-4 bg-black/60 border-b border-white/15 flex flex-col gap-2.5">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          {TOPIC_TAGS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTag(option)}
              aria-pressed={tag === option}
              className={`px-3 py-1 rounded-lg text-[11px] font-mono font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                tag === option
                  ? 'bg-sky-400 text-black shadow-md'
                  : 'bg-white/10 text-slate-100 border border-white/20 hover:bg-white/20'
              }`}
            >
              {tagLabel[option]}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          placeholder={t('composeTitlePlaceholder', { name: product.name })}
          className="w-full px-4 py-2.5 rounded-xl bg-black border border-white/30 text-xs sm:text-sm text-white placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all font-sans font-medium"
        />

        {titleDraft.trim() && (
          <>
            <textarea
              value={bodyDraft}
              onChange={(e) => setBodyDraft(e.target.value)}
              rows={3}
              placeholder={t('composeBodyPlaceholder')}
              className="w-full px-4 py-2.5 rounded-xl bg-black border border-white/30 text-xs sm:text-sm text-white placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all font-sans font-medium resize-y"
            />
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-[11px] text-slate-300 font-medium flex-1 min-w-[12rem] leading-relaxed">
                {t('handoffNote', { handle: SUBREDDIT_HANDLE })}
              </span>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-amber-400 text-black text-xs font-black shadow-md hover:bg-amber-300 transition-all cursor-pointer shrink-0"
              >
                {t('composeOnRedditBtn')}
              </button>
            </div>
          </>
        )}

        {handedOff && (
          <p className="text-[11px] text-sky-200 font-semibold leading-relaxed">
            {t('handoffDoneNote')}
          </p>
        )}
      </form>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {status === 'loading' ? (
          <p className="py-16 text-center text-xs sm:text-sm text-slate-200 font-bold px-6">
            {t('topicsLoading')}
          </p>
        ) : visible.length === 0 ? (
          <p className="py-16 text-center text-xs sm:text-sm text-slate-200 font-bold px-6 leading-relaxed">
            {t('topicsEmpty', { handle: SUBREDDIT_HANDLE })}
          </p>
        ) : (
          visible.map((topic) => {
            const isLong = topic.body.length > 140;
            const isOpen = !!expanded[topic.id];

            return (
              <article
                key={topic.id}
                className={`p-4 sm:p-5 rounded-2xl border flex flex-col gap-3 shadow-lg transition-all ${
                  topic.isPinned || topic.isMod
                    ? 'bg-[#1f212a] border-amber-400/70'
                    : 'bg-[#1a1b22] border-white/25 hover:border-amber-400/50'
                }`}
              >
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                    <span
                      className={`w-8 h-8 rounded-full shrink-0 border flex items-center justify-center text-[11px] font-black font-mono ${tintFor(topic.author)}`}
                      aria-hidden="true"
                    >
                      {initialsFor(topic.author)}
                    </span>
                    <a
                      href={`https://www.reddit.com/user/${topic.author}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-black text-white hover:text-amber-300 transition-colors font-mono text-xs sm:text-sm truncate"
                    >
                      u/{topic.author}
                    </a>
                    {topic.isMod && (
                      <span className="px-2 py-0.5 rounded bg-amber-400 text-black text-[10px] font-black shadow-sm">
                        {t('adminBadge')}
                      </span>
                    )}
                    {topic.isPinned && (
                      <span className="px-2 py-0.5 rounded bg-sky-400 text-black text-[10px] font-black shadow-sm">
                        {t('pinnedBadge')}
                      </span>
                    )}
                    <span className="text-xs text-amber-200 font-semibold">
                      • {relTime(topic.createdUtc)}
                    </span>
                  </div>

                  <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-extrabold bg-white/15 text-amber-300 border border-white/20 shrink-0">
                    {tagLabel[topic.tag]}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <a
                    href={topic.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-extrabold text-sm sm:text-[1rem] text-white hover:text-amber-300 transition-colors font-sans leading-snug tracking-tight"
                  >
                    {topic.title}
                  </a>
                  {topic.body && (
                    <p className="text-xs sm:text-sm text-slate-100 leading-relaxed font-sans font-medium whitespace-pre-line">
                      {isLong && !isOpen ? `${topic.body.slice(0, 140)}…` : topic.body}
                    </p>
                  )}
                  {isLong && (
                    <button
                      type="button"
                      onClick={() => setExpanded((p) => ({ ...p, [topic.id]: !isOpen }))}
                      className="text-xs font-black text-amber-300 hover:text-amber-200 hover:underline w-fit mt-1 cursor-pointer"
                    >
                      {isOpen ? t('collapseText') : t('expandText')}
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-white/15 text-xs">
                  <div className="flex items-center gap-3 text-slate-100 font-mono font-bold">
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
                    className="px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-black transition-all border border-white/20"
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
      <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-2xl p-4 sm:p-8 flex items-center justify-center animate-backdrop-blur font-sans">
        {panel}
      </div>
    );
  }

  return panel;
}
