import assert from 'node:assert/strict';
import test from 'node:test';

async function render() {
  const url = new URL('../dist/server/index.js', import.meta.url);
  url.searchParams.set('test', `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(url.href);
  return worker.fetch(new Request('http://localhost/', { headers: { accept: 'text/html' } }),
    { ASSETS: { fetch: async () => new Response('Not found', { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} });
}

test('renders the live draft without audit/build runtime dependencies', async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  for (const label of ['Predecessor Counterpick','My Role','My Hero','Enemy Read','Enemy Team','Recommended Heroes']) assert.ok(html.includes(label), label);
  for (const label of ['Data audit','Flex mode','I already picked','Phased match build','Augment and build direction']) assert.ok(!html.includes(label), label);
  assert.match(html, /Enemy matchup unknown/);
  assert.match(html, /Murdock/);
  assert.doesNotMatch(html, /auditItemData is not defined/);
});
