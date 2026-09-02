import worker from './src/worker.js';

// Minimal D1 stub: enough to exercise the real SQL paths we use.
function makeDB(){
  const rows = new Map();
  const run = (sql, args) => {
    if (/^INSERT INTO records/i.test(sql)) {
      const [id,o,v,doc,u,c] = args;
      rows.set(id,{id,owner_token:o,view_token:v,doc,updated_at:u,created_at:c});
      return {meta:{changes:1}};
    }
    if (/^UPDATE records/i.test(sql)) {
      const [doc,now,id,expected] = args;
      const r = rows.get(id);
      if (!r || r.updated_at !== expected) return {meta:{changes:0}};
      r.doc = doc; r.updated_at = now;
      return {meta:{changes:1}};
    }
    if (/^DELETE FROM records/i.test(sql)) { rows.delete(args[0]); return {meta:{changes:1}}; }
    throw new Error('unhandled sql: '+sql);
  };
  const first = (sql,args) => {
    if (/^SELECT/i.test(sql)) return rows.get(args[0]) || null;
    throw new Error('unhandled sql: '+sql);
  };
  return { prepare(sql){ let bound=[]; return { bind(...a){bound=a;return this;},
    run:()=>Promise.resolve(run(sql,bound)), first:()=>Promise.resolve(first(sql,bound)) }; }, _rows: rows };
}

const env = { DB: makeDB(), ALLOWED_ORIGINS: '*' };
const call = (method, path, {body, token, headers={}}={}) =>
  worker.fetch(new Request('https://api.test'+path, {
    method,
    headers: { 'content-type':'application/json', ...(token?{Authorization:'Bearer '+token}:{}) , ...headers},
    body: body===undefined?undefined:JSON.stringify(body)
  }), env);

let pass=0, fail=0;
const t = async (name, fn) => { try{ await fn(); console.log('  ok  '+name); pass++; }
  catch(e){ console.log('  FAIL '+name+' -> '+e.message); fail++; } };
const eq = (a,b,m='') => { if(JSON.stringify(a)!==JSON.stringify(b)) throw new Error(`${m} expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); };

console.log('API tests');
let rec;

await t('health', async()=>{ const r=await call('GET','/v1/health'); eq(r.status,200); });
await t('create returns 201 + two distinct tokens', async()=>{
  const r = await call('POST','/v1/records',{body:{doc:{name:'test'}}});
  eq(r.status,201); rec = await r.json();
  if(!rec.id || !rec.ownerToken || !rec.viewToken) throw new Error('missing fields');
  if(rec.ownerToken===rec.viewToken) throw new Error('tokens identical');
  if(rec.ownerToken.length!==64) throw new Error('token too short');
});
await t('GET without token -> 401', async()=>{ eq((await call('GET','/v1/records/'+rec.id)).status,401); });
await t('GET with bad token -> 401', async()=>{ eq((await call('GET','/v1/records/'+rec.id,{token:'x'.repeat(64)})).status,401); });
await t('GET with owner token -> role owner', async()=>{
  const r=await call('GET','/v1/records/'+rec.id,{token:rec.ownerToken}); eq(r.status,200);
  const b=await r.json(); eq(b.role,'owner'); eq(b.doc.name,'test');
});
await t('GET with view token -> role view', async()=>{
  const b=await (await call('GET','/v1/records/'+rec.id,{token:rec.viewToken})).json(); eq(b.role,'view');
});
await t('GET via ?token= query works', async()=>{
  eq((await call('GET','/v1/records/'+rec.id+'?token='+rec.viewToken)).status,200);
});
await t('PUT with view token -> 403', async()=>{
  eq((await call('PUT','/v1/records/'+rec.id,{token:rec.viewToken,body:{doc:{n:1}}})).status,403);
});
let afterPut;
await t('PUT with owner token succeeds and bumps updatedAt', async()=>{
  const r=await call('PUT','/v1/records/'+rec.id,{token:rec.ownerToken,body:{doc:{name:'updated'},baseUpdatedAt:rec.updatedAt}});
  eq(r.status,200); afterPut=await r.json();
  if(afterPut.updatedAt < rec.updatedAt) throw new Error('updatedAt went backwards');
});
await t('stale PUT -> 409 and returns server doc', async()=>{
  const r=await call('PUT','/v1/records/'+rec.id,{token:rec.ownerToken,body:{doc:{name:'stale'},baseUpdatedAt:1}});
  eq(r.status,409); const b=await r.json(); eq(b.error.doc.name,'updated');
});
await t('malformed id -> 400', async()=>{ eq((await call('GET','/v1/records/nope',{token:rec.ownerToken})).status,400); });
await t('unknown record -> 404', async()=>{ eq((await call('GET','/v1/records/'+'a'.repeat(20),{token:rec.ownerToken})).status,404); });
await t('bad JSON -> 400', async()=>{
  const r=await worker.fetch(new Request('https://api.test/v1/records/'+rec.id,{method:'PUT',
    headers:{'content-type':'application/json',Authorization:'Bearer '+rec.ownerToken},body:'{oops'}),env);
  eq(r.status,400);
});
await t('OPTIONS preflight -> 204 + CORS', async()=>{
  const r=await call('OPTIONS','/v1/records');
  eq(r.status,204); if(!r.headers.get('Access-Control-Allow-Origin')) throw new Error('no CORS header');
});
await t('wrong method on collection -> 405', async()=>{ eq((await call('GET','/v1/records')).status,405); });
await t('DELETE with view token -> 403', async()=>{
  eq((await call('DELETE','/v1/records/'+rec.id,{token:rec.viewToken})).status,403);
});
await t('DELETE with owner token -> ok, then 404', async()=>{
  eq((await call('DELETE','/v1/records/'+rec.id,{token:rec.ownerToken})).status,200);
  eq((await call('GET','/v1/records/'+rec.id,{token:rec.ownerToken})).status,404);
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
