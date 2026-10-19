import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createApp} from '../server.mjs';

async function fixture(t,prepare){
  const directory=await mkdtemp(join(tmpdir(),'greenwich-requests-'));
  if(prepare)prepare(directory);
  const password=randomBytes(24).toString('base64url');
  let server=await createApp({dataDir:directory,password,production:false});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  let cookie='',csrf='';
  const call=(path,method='GET',body)=>fetch(base+path,{method,headers:{'Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':csrf},body:body===undefined?undefined:JSON.stringify(body)});
  async function login(){const response=await call('/api/admin/login','POST',{password});assert.equal(response.status,200);cookie=response.headers.get('set-cookie').split(';')[0];csrf=(await response.json()).csrf;}
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});});
  return {call,login};
}
const basePayload=()=>({name:'Test Candidate',phone:'+91 90000 00001',email:'test@example.com',interest:'Hotel Management',message:'Test only',qualification:'12th completed',consent:true,idempotencyKey:randomUUID()});

test('Course booking requires a real selection and month, persists fields and prevents duplicate/mismatched requests',async t=>{
  const {call,login}=await fixture(t);
  const payload={...basePayload(),requestKind:'booking',careerTrack:'Shore',preferredMonth:new Date(Date.now()+330*60000).toISOString().slice(0,7)};
  for(const change of [{preferredMonth:''},{preferredMonth:'2020-01'},{interest:'Help me choose'},{qualification:''}])assert.equal((await call('/api/enquiries','POST',{...payload,...change})).status,400);
  const response=await call('/api/enquiries','POST',payload);assert.equal(response.status,201);const {reference}=await response.json();assert.match(reference,/^GGB-/);
  const retry=await call('/api/enquiries','POST',payload);assert.equal(retry.status,200);assert.equal((await retry.json()).reference,reference);
  assert.equal((await call('/api/enquiries','POST',{...payload,message:'Different request'})).status,409);
  await login();const rows=(await(await call('/api/admin/enquiries')).json()).enquiries;
  assert.equal(rows.length,1);assert.equal(rows[0].preferred_month,payload.preferredMonth);assert.equal(rows[0].request_kind,'booking');assert.equal(rows[0].qualification,'12th completed');assert.equal(rows[0].career_track,'Shore');assert.equal(rows[0].email,'test@example.com');
  assert.equal((await call('/api/admin/enquiries/'+reference,'PATCH',{status:'Confirmed'})).status,200);
  const csv=await(await call('/api/admin/export')).text();assert.match(csv,/Request type,Email,Qualification,Career direction,Preferred start month/);assert.match(csv,/"booking","test@example.com","12th completed","Shore"/);
});

test('Ship and shore career requests require direction and qualification; admission enquiry remains compatible',async t=>{
  const {call,login}=await fixture(t);
  const payload={...basePayload(),requestKind:'career',interest:'Help me choose',careerTrack:'Ship'};
  assert.equal((await call('/api/enquiries','POST',{...payload,careerTrack:''})).status,400);
  assert.equal((await call('/api/enquiries','POST',{...payload,careerTrack:'Invalid'})).status,400);
  assert.equal((await call('/api/enquiries','POST',{...payload,email:'invalid'})).status,400);
  assert.equal((await call('/api/enquiries','POST',{...payload,requestKind:'other'})).status,400);
  const ship=await call('/api/enquiries','POST',payload);assert.equal(ship.status,201);assert.match((await ship.json()).reference,/^GGC-/);
  assert.equal((await call('/api/enquiries','POST',{...payload,careerTrack:'Shore',idempotencyKey:randomUUID()})).status,201);
  assert.equal((await call('/api/enquiries','POST',{name:'Legacy request',phone:'9000000002',interest:'Help me choose',consent:true,idempotencyKey:randomUUID()})).status,201);
  await login();const rows=(await(await call('/api/admin/enquiries')).json()).enquiries;assert.equal(rows.length,3);assert.equal(rows.filter(r=>r.request_kind==='career').length,2);assert.equal(rows.find(r=>r.name==='Legacy request').request_kind,'enquiry');
});

test('Upgrade preserves an existing database and custom courses while adding booking fields',async t=>{
  const {call,login}=await fixture(t,directory=>{
    const db=new DatabaseSync(join(directory,'greenwich.sqlite'));
    db.exec("CREATE TABLE enquiries (id TEXT PRIMARY KEY,request_key TEXT UNIQUE NOT NULL,name TEXT NOT NULL,phone TEXT NOT NULL,interest TEXT NOT NULL,message TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'New',created_at TEXT NOT NULL,consent_at TEXT NOT NULL,consent_version TEXT NOT NULL DEFAULT '1');CREATE TABLE settings (key TEXT PRIMARY KEY,value TEXT NOT NULL);");
    db.prepare('INSERT INTO enquiries (id,request_key,name,phone,interest,message,created_at,consent_at) VALUES (?,?,?,?,?,?,?,?)').run('GGI-EXISTING','legacy-request-key','Existing Student','9000000003','Custom Course','Keep this record','2026-01-01','2026-01-01');
    db.prepare('INSERT INTO settings VALUES (?,?)').run('content',JSON.stringify({announcement:'Existing announcement',programs:[{id:'hotel',title:'Custom Course',category:'Hospitality',description:'Existing course',topics:[],fees:'Ask admissions',eligibility:'',duration:''}]}));db.close();
  });
  const publicData=await(await call('/api/public-content')).json();assert.equal(publicData.requestTypes,true);assert.equal(publicData.content.programs[0].title,'Custom Course');
  await login();const rows=(await(await call('/api/admin/enquiries')).json()).enquiries;assert.equal(rows.length,1);assert.equal(rows[0].id,'GGI-EXISTING');assert.equal(rows[0].request_kind,'enquiry');assert.equal(rows[0].email,'');
  const response=await call('/api/enquiries','POST',{...basePayload(),requestKind:'booking',interest:'Custom Course',preferredMonth:new Date(Date.now()+330*60000).toISOString().slice(0,7)});assert.equal(response.status,201);
});
