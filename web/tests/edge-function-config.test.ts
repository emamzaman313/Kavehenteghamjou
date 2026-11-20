import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const functionConfig = readFileSync(
  new URL('../../supabase/config.toml', import.meta.url),
  'utf8',
);

function sectionFor(name: string): string {
  const header = `[functions.${name}]`;
  const start = functionConfig.indexOf(header);
  if (start < 0) throw new Error(`Missing Supabase function config: ${name}`);
  const nextSection = functionConfig.indexOf('\n[functions.', start + header.length);
  return functionConfig.slice(start, nextSection < 0 ? undefined : nextSection);
}

describe('Supabase Edge Function gateway authentication', () => {
  it('lets unauthenticated guest-code calls reach their handler', () => {
    const section = sectionFor('access-code-login');
    expect(section).toMatch(/verify_jwt\s*=\s*false/);
    expect(section).toContain('import_map = "./functions/access-code-login/deno.json"');
  });

  it('keeps admin-console gateway auth disabled only because the handler verifies user JWT and RBAC itself', () => {
    expect(sectionFor('admin-console')).toMatch(/verify_jwt\s*=\s*false/);
  });

  it('keeps notification and rank management endpoints behind gateway JWT validation', () => {
    expect(sectionFor('notification-dispatch')).toMatch(/verify_jwt\s*=\s*true/);
    expect(sectionFor('rank-management')).toMatch(/verify_jwt\s*=\s*true/);
  });
});
