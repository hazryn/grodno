/**
 * Minimalny, ale solidny parser GEDCOM 5.5.1 → drzewo węzłów.
 * Świadomie własny (zamiast zależności) — pełna kontrola, zero niespodzianek API,
 * a to rdzeń importu. Obsługuje: poziomy, xref (@..@) na rekordach 0-poziomu,
 * wartości-pointery, łączenie linii CONC/CONT, BOM.
 */

export interface GedcomNode {
  level: number;
  tag: string;
  /** Tylko dla rekordów 0-poziomu: identyfikator @I123@ → "I123". */
  xref?: string;
  /** Wartość po tagu; dla pointerów to "@F1@". */
  value?: string;
  children: GedcomNode[];
}

const LINE_RE = /^\s*(\d+)\s+(?:@([^@]+)@\s+)?([A-Za-z_][A-Za-z0-9_]*)(?:\s(.*))?$/;

/** Parsuje cały tekst GEDCOM na listę rekordów 0-poziomu. */
export function parseGedcom(text: string): GedcomNode[] {
  // Usuń BOM, normalizuj końce linii.
  const clean = text.replace(/^﻿/, '');
  const lines = clean.split(/\r\n|\r|\n/);

  const roots: GedcomNode[] = [];
  // stack[level] = ostatni węzeł na danym poziomie.
  const stack: GedcomNode[] = [];

  for (const rawLine of lines) {
    if (rawLine.trim() === '') continue;
    const m = LINE_RE.exec(rawLine);
    if (!m) continue; // toleruj śmieci

    const level = Number.parseInt(m[1], 10);
    const xref = m[2];
    const tag = m[3];
    const value = m[4];

    // CONC/CONT — sklejanie wartości z rodzicem, nie nowy węzeł.
    if (tag === 'CONC' || tag === 'CONT') {
      const parent = stack[level - 1];
      if (parent) {
        const sep = tag === 'CONT' ? '\n' : '';
        parent.value = (parent.value ?? '') + sep + (value ?? '');
      }
      continue;
    }

    const node: GedcomNode = { level, tag, children: [] };
    if (xref) node.xref = xref;
    if (value !== undefined) node.value = value;

    if (level === 0) {
      roots.push(node);
    } else {
      const parent = stack[level - 1];
      if (parent) parent.children.push(node);
    }

    stack[level] = node;
    stack.length = level + 1; // odetnij głębsze poziomy
  }

  return roots;
}

/* ----------------------------- helpery dostępu ----------------------------- */

export function firstChild(node: GedcomNode, tag: string): GedcomNode | undefined {
  return node.children.find((c) => c.tag === tag);
}

export function childrenWithTag(node: GedcomNode, tag: string): GedcomNode[] {
  return node.children.filter((c) => c.tag === tag);
}

export function childValue(node: GedcomNode, tag: string): string | undefined {
  return firstChild(node, tag)?.value;
}

/** "@F1@" → "F1"; zwraca null gdy to nie pointer. */
export function asPointer(value: string | undefined): string | null {
  if (!value) return null;
  const m = /^@([^@]+)@$/.exec(value.trim());
  return m ? m[1] : null;
}
