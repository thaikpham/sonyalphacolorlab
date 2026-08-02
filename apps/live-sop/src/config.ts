// Central project configuration.
//
// There is deliberately no API key here. Anything read from `import.meta.env`
// with a `VITE_` prefix is inlined into the browser bundle at build time, so a
// key supplied that way is published to every visitor who opens devtools. The
// AI panels are bring-your-own-key: the reader pastes their own key into the
// settings form and it stays in their own localStorage. See src/lib/gemini.ts.
export const DEFAULT_MODEL = 'gemini-2.5-flash';
