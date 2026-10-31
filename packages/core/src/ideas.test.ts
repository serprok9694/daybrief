import { describe, expect, it } from 'vitest';
import {
  IDEA_MAX_LENGTH,
  normalizeIdeaText,
  parseIdeaInput,
  pickIdeaOfTheDay,
  type Idea,
} from './ideas';

describe('parseIdeaInput', () => {
  it('trims the text and the external id', () => {
    expect(
      parseIdeaInput({ text: '  Learn Rust \n', source: 'shortcut', externalId: ' r1 ' }),
    ).toEqual({ text: 'Learn Rust', source: 'shortcut', externalId: 'r1' });
  });

  it('leaves source and external id optional', () => {
    expect(parseIdeaInput({ text: 'x' })).toEqual({
      text: 'x',
      source: undefined,
      externalId: null,
    });
    expect(parseIdeaInput({ text: 'x', externalId: '  ' })).toMatchObject({ externalId: null });
    expect(parseIdeaInput({ text: 'x', externalId: null })).toMatchObject({ externalId: null });
  });

  it('rejects empty text', () => {
    expect(parseIdeaInput({ text: '' })).toBe('empty_text');
    expect(parseIdeaInput({ text: ' \n\t ' })).toBe('empty_text');
  });

  it('limits the text to 2000 code points after trimming', () => {
    const max = 'x'.repeat(IDEA_MAX_LENGTH);
    expect(parseIdeaInput({ text: max })).toMatchObject({ text: max });
    expect(parseIdeaInput({ text: ` ${max} ` })).toMatchObject({ text: max });
    expect(parseIdeaInput({ text: 'x'.repeat(IDEA_MAX_LENGTH + 1) })).toBe('text_too_long');
    // An emoji is one code point but two UTF-16 units.
    expect(parseIdeaInput({ text: '💡'.repeat(IDEA_MAX_LENGTH) })).not.toBeTypeOf('string');
  });

  it('rejects malformed bodies', () => {
    for (const body of [
      null,
      'text',
      [],
      {},
      { text: 42 },
      { text: 'x', source: 'email' },
      { text: 'x', externalId: 1 },
      { text: 'x', externalId: 'e'.repeat(201) },
    ]) {
      expect(parseIdeaInput(body)).toBe('invalid_request');
    }
  });
});

describe('normalizeIdeaText', () => {
  it('ignores case, whitespace and Unicode composition', () => {
    expect(normalizeIdeaText('  Learn\n\n  RUST ')).toBe('learn rust');
    expect(normalizeIdeaText('Café')).toBe(normalizeIdeaText('Café'));
    expect(normalizeIdeaText('Идея  Дня')).toBe('идея дня');
  });

  it('keeps different texts different', () => {
    expect(normalizeIdeaText('learn rust')).not.toBe(normalizeIdeaText('learn go'));
  });
});

describe('pickIdeaOfTheDay', () => {
  const now = new Date('2026-10-31T10:00:00Z');
  const idea = (id: string, extra: Partial<Idea> = {}): Idea => ({
    id,
    text: id,
    source: 'command',
    externalId: null,
    createdAt: '2026-10-01T00:00:00Z',
    snoozedUntil: null,
    doneAt: null,
    lastShownAt: null,
    ...extra,
  });

  it('is null without ideas', () => {
    expect(pickIdeaOfTheDay([], 'UTC', now)).toBeNull();
  });

  it('picks the idea shown longest ago, never shown first, then the oldest', () => {
    const ideas = [
      idea('shown', { lastShownAt: '2026-10-20T00:00:00Z' }),
      idea('new', { createdAt: '2026-10-05T00:00:00Z' }),
      idea('old', { createdAt: '2026-10-02T00:00:00Z' }),
    ];
    expect(pickIdeaOfTheDay(ideas, 'UTC', now)).toEqual({ idea: ideas[2], markShown: true });
    expect(pickIdeaOfTheDay(ideas.slice(0, 1), 'UTC', now)).toEqual({
      idea: ideas[0],
      markShown: true,
    });
  });

  it('keeps the idea already shown today, without marking it again', () => {
    const ideas = [idea('never'), idea('today', { lastShownAt: '2026-10-31T07:00:00Z' })];
    expect(pickIdeaOfTheDay(ideas, 'UTC', now)).toEqual({ idea: ideas[1], markShown: false });
  });

  it('counts "today" in the user zone', () => {
    // 23:30 UTC on the 30th is already the 31st in Warsaw (UTC+1 after the DST switch).
    const ideas = [idea('never'), idea('shown', { lastShownAt: '2026-10-30T23:30:00Z' })];
    expect(pickIdeaOfTheDay(ideas, 'Europe/Warsaw', now)?.idea.id).toBe('shown');
    expect(pickIdeaOfTheDay(ideas, 'UTC', now)?.idea.id).toBe('never');
  });

  it('skips done and snoozed ideas', () => {
    const ideas = [
      idea('done', { doneAt: '2026-10-30T00:00:00Z' }),
      idea('snoozed', { snoozedUntil: '2026-11-03T00:00:00Z' }),
      idea('done today', { doneAt: '2026-10-31T09:00:00Z', lastShownAt: '2026-10-31T08:00:00Z' }),
    ];
    expect(pickIdeaOfTheDay(ideas, 'UTC', now)).toBeNull();
    const back = idea('snooze over', { snoozedUntil: '2026-10-31T09:59:59Z' });
    expect(pickIdeaOfTheDay([...ideas, back], 'UTC', now)?.idea.id).toBe('snooze over');
  });
});
