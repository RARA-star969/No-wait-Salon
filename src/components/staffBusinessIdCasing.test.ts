import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateBusinessCode, isValidBusinessCode } from '../shared/businessCodeValidation';

const here = path.dirname(fileURLToPath(import.meta.url));
const staffShellSource = readFileSync(path.join(here, 'StaffAppShell.tsx'), 'utf8');

test('Business ID input preserves exactly what the staff member typed', () => {
  const inputBlock = staffShellSource.slice(
    staffShellSource.indexOf('<label className="text-xs font-bold text-[#5C6E6B]">Business ID</label>'),
    staffShellSource.indexOf('</form>', staffShellSource.indexOf('Business ID')),
  );
  // No forced-casing transform on the value the user sees.
  assert.doesNotMatch(inputBlock, /setBusinessCode\(e\.target\.value\.toUpperCase\(\)\)/);
  assert.doesNotMatch(inputBlock, /setBusinessCode\(e\.target\.value\.toLowerCase\(\)\)/);
  assert.match(inputBlock, /onChange=\{e => setBusinessCode\(e\.target\.value\)\}/);
  // No CSS text-transform forcing the visible casing either.
  const classNameMatch = inputBlock.match(/className="([^"]*)"/);
  assert.ok(classNameMatch, 'input should have a className');
  assert.doesNotMatch(classNameMatch![1], /\buppercase\b/);
  assert.doesNotMatch(classNameMatch![1], /\blowercase\b/);
});

test('salon-01 / Salon-01 / SALON-01 all resolve to the same canonical Business ID', () => {
  assert.equal(validateBusinessCode('salon-01'), 'SALON-01');
  assert.equal(validateBusinessCode('Salon-01'), 'SALON-01');
  assert.equal(validateBusinessCode('SALON-01'), 'SALON-01');
});

test('business code validation is case-insensitive for well-formed codes', () => {
  assert.ok(isValidBusinessCode('salon-01'));
  assert.ok(isValidBusinessCode('SALON-01'));
  assert.equal(validateBusinessCode('salon-01'), validateBusinessCode('SALON-01'));
});

test('an invalid business code is still rejected regardless of casing', () => {
  assert.throws(() => validateBusinessCode('a'));
  assert.throws(() => validateBusinessCode('has a space'));
  assert.equal(isValidBusinessCode(''), false);
  assert.equal(isValidBusinessCode(null), false);
});

test('Staff dashboard routing keys off the resolved business record, never the raw typed text', () => {
  // The dashboard-type branch reads the server-resolved session's
  // mainCategoryId — the exact same category metadata the backend already
  // trusts elsewhere — never something derived from the Business ID string
  // the user typed.
  assert.match(staffShellSource, /const isGym = session!\.business\.mainCategoryId === 'gym';/);
  assert.match(staffShellSource, /if \(isGym\) return <GymDashboardView/);
  assert.match(staffShellSource, /<StaffDashboard/);
  // No routing decision derived from `businessCode` itself.
  const routingBlock = staffShellSource.slice(
    staffShellSource.indexOf('const isGym ='),
    staffShellSource.indexOf('const isGym =') + 400,
  );
  assert.doesNotMatch(routingBlock, /businessCode/);
});
