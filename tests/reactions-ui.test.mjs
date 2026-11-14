import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const script = await readFile('public/reactions.js', 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup(fetch) {
  const label = {}, icon = {}, note = {}, attributes = {};
  let click;
  const button = {querySelector: s=>s==='.reaction-label'?label:icon,
    setAttribute:(k,v)=>attributes[k]=v, removeAttribute:k=>delete attributes[k],
    addEventListener:(_event,fn)=>click=fn};
  vm.runInNewContext(script, {fetch, AbortSignal, document:{getElementById:id=>id==='reaction-like'?button:note}});
  return {label, icon, note, button, attributes, click:()=>click()};
}
test('button reads shared state, sends desired state and prevents duplicate in-flight clicks', async () => {
  const calls = [];
  let resolveWrite;
  const ui = setup(async (_url, options) => {
    calls.push(options);
    if (options.method==='PUT') return new Promise(resolve=>resolveWrite=()=>resolve(Response.json({liked:true,count:4})));
    return Response.json({liked:false,count:3});
  });
  await tick();
  assert.match(ui.label.textContent, /3/);
  ui.click(); ui.click();
  assert.equal(calls.length,2);
  assert.equal(calls[1].body,'{"liked":true}');
  assert.equal(ui.attributes['aria-pressed'],'false');
  resolveWrite(); await tick();
  assert.equal(ui.attributes['aria-pressed'],'true');
  assert.match(ui.label.textContent,/4/);
  assert.equal(ui.button.disabled,false);
});
test('API errors preserve the last confirmed state and show a retry message', async () => {
  const ui = setup(async (_url, options)=>options.method==='GET'
    ? Response.json({liked:false,count:2}) : Response.json({error:'rate_limited'},{status:429}));
  await tick(); ui.click(); await tick();
  assert.equal(ui.attributes['aria-pressed'],'false');
  assert.match(ui.label.textContent,/2/);
  assert.match(ui.note.textContent,/잠시 후/);
  assert.equal(ui.button.disabled,false);
});
test('initial API failure never presents a fabricated zero or saved reaction', async () => {
  const ui = setup(async ()=>{throw new Error('offline')});
  await tick();
  assert.equal(ui.label.textContent,undefined);
  assert.equal(ui.button.disabled,false);
});
