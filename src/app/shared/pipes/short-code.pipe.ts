import { Pipe, PipeTransform } from '@angular/core';

/** Displays a legacy code (`PRJ-003`, `NTE-004`, `WKI-002`…) as just its
 * trailing sequential number ("3", "4", "2") — the full prefixed code still
 * exists everywhere else (API payloads, exports, filters); this is purely a
 * cosmetic simplification for lists/headers where the letter prefix and
 * zero-padding don't add anything the user needs to read. */
@Pipe({ name: 'shortCode', standalone: true })
export class ShortCodePipe implements PipeTransform {
  transform(code: string | null | undefined): string {
    if (!code) return '—';
    const match = code.match(/(\d+)\s*$/);
    return match ? String(parseInt(match[1], 10)) : code;
  }
}
