import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const workflow = readFileSync(path.join(projectRoot, '.github', 'workflows', 'android-test-build.yml'), 'utf8');

test('Customer TEST APK workflow bakes only the hosted TEST API', () => {
  const customerJob = workflow.slice(workflow.indexOf('customer-final-physical-apk:'));
  assert.match(customerJob, /VITE_API_BASE_URL: https:\/\/no-wait-salon-web-test\.onrender\.com/);
  assert.match(customerJob, /grep -R --binary-files=text -Fq "https:\/\/no-wait-salon-web-test\.onrender\.com"/);
  assert.match(customerJob, /if grep -R --binary-files=text -Fq "https:\/\/no-wait-salon-api\.onrender\.com"/);
  assert.doesNotMatch(
    customerJob,
    /if grep -R --binary-files=text -Fq "https:\/\/no-wait-salon-web-test\.onrender\.com"/,
    'the required TEST URL must never be mistaken for the forbidden production URL',
  );
});
