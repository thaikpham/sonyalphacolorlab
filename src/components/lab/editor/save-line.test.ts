import { describe, expect, it } from 'vitest'
import { saveLine } from './save-line'

/** The rail's save line, executed: which of the editor's states wins. */
const SAVED = 'Đã lưu.'
const at = new Date('2026-10-23T09:30:00Z')
const base = { busy: '' as const, status: null, dirty: false, savedAt: null, saved: SAVED }

describe('saveLine', () => {
  it('says saving while a save is out, over everything else', () => {
    expect(
      saveLine({ ...base, busy: 'saving', status: { kind: 'err', msg: 'boom' }, dirty: true, savedAt: at }),
    ).toEqual({ kind: 'saving' })
  })

  it('shows an error’s own message', () => {
    expect(saveLine({ ...base, status: { kind: 'err', msg: 'Không lưu được.' }, dirty: true, savedAt: at })).toEqual({
      kind: 'err',
      msg: 'Không lưu được.',
    })
  })

  it('reads unsaved after an edit that follows a save, not the save’s message', () => {
    expect(saveLine({ ...base, status: { kind: 'ok', msg: SAVED }, dirty: true, savedAt: at })).toEqual({
      kind: 'unsaved',
    })
    expect(
      saveLine({ ...base, status: { kind: 'ok', msg: 'Đã lưu; bỏ 2 khối.' }, dirty: true, savedAt: at }),
    ).toEqual({ kind: 'unsaved' })
  })

  it('shows an ok message that says more than saved, such as a dropped-block count', () => {
    expect(saveLine({ ...base, status: { kind: 'ok', msg: 'Đã lưu; bỏ 2 khối.' }, savedAt: at })).toEqual({
      kind: 'ok',
      msg: 'Đã lưu; bỏ 2 khối.',
    })
  })

  it('lets a plain saved message fall through to the save time', () => {
    expect(saveLine({ ...base, status: { kind: 'ok', msg: SAVED }, savedAt: at })).toEqual({ kind: 'savedAt' })
  })

  it('says nothing before anything has happened', () => {
    expect(saveLine(base)).toEqual({ kind: 'none' })
    expect(saveLine({ ...base, status: { kind: 'ok', msg: SAVED } })).toEqual({ kind: 'none' })
  })
})
