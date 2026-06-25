import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseGedcomDate,
  gedcomDateSortKey,
  gedcomDateYear,
  formatGedcomDatePl,
} from './gedcom-date.js';

test('exact full date', () => {
  const d = parseGedcomDate('12 MAY 1900');
  assert.equal(d?.kind, 'exact');
  assert.deepEqual(d?.date, { day: 12, month: 5, year: 1900 });
  assert.equal(gedcomDateSortKey(d), 19000512);
  assert.equal(gedcomDateYear(d), 1900);
});

test('year only', () => {
  const d = parseGedcomDate('1850');
  assert.equal(d?.kind, 'exact');
  assert.deepEqual(d?.date, { year: 1850 });
  assert.equal(gedcomDateYear(d), 1850);
});

test('month + year', () => {
  const d = parseGedcomDate('MAR 1912');
  assert.deepEqual(d?.date, { month: 3, year: 1912 });
});

test('about', () => {
  const d = parseGedcomDate('ABT 1900');
  assert.equal(d?.kind, 'about');
  assert.equal(gedcomDateYear(d), 1900);
  assert.equal(formatGedcomDatePl(d), 'ok. 1900');
});

test('before / after', () => {
  assert.equal(parseGedcomDate('BEF 1800')?.kind, 'before');
  assert.equal(parseGedcomDate('AFT 1800')?.kind, 'after');
});

test('between range', () => {
  const d = parseGedcomDate('BET 1900 AND 1910');
  assert.equal(d?.kind, 'between');
  assert.equal(d?.date?.year, 1900);
  assert.equal(d?.end?.year, 1910);
});

test('from..to period', () => {
  const d = parseGedcomDate('FROM 1939 TO 1945');
  assert.equal(d?.kind, 'period');
  assert.equal(d?.date?.year, 1939);
  assert.equal(d?.end?.year, 1945);
});

test('empty / null', () => {
  assert.equal(parseGedcomDate(''), null);
  assert.equal(parseGedcomDate(null), null);
  assert.equal(gedcomDateSortKey(null), null);
});

test('unparseable falls back to unknown but keeps raw', () => {
  const d = parseGedcomDate('jakiś czas temu');
  assert.equal(d?.raw, 'jakiś czas temu');
  assert.ok(d?.kind === 'unknown' || d?.kind === 'exact');
});
