import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {createApp} from '../server.mjs';

test('Admissions delivery, persistence, access control and content updates',async(t)=>{
  const directory=await mkdtemp(join(tmpdir(),'greenwich-test-'));
  const password=randomBytes(24).toString('base64url');
  let server=await createApp({dataDir:directory,password,production:false});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let base=`http://127.0.0.1:${server.address().port}`,cookie='',csrf='';
  const call=(path,method='GET',body,headers={})=>fetch(base+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...(csrf?{'X-CSRF-Token':csrf}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});});
  let content;
  await t.test('Public website and data available; source and database are private',async()=>{
    const page=await call('/');assert.equal(page.status,200);assert.match(await page.text(),/KOMARA(?:<br>|\s)+GANAPATHI RAO/);assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
    const api=await call('/api/public-content');assert.equal(api.status,200);const data=await api.json();assert.equal(data.service,'greenwich-admissions');content=data.content;
    assert.equal((await call('/server.mjs')).status,404);assert.equal((await call('/data/greenwich.sqlite')).status,404);assert.equal((await call('/.env')).status,404);
    assert.equal((await call('/api/admin/enquiries')).status,401);assert.equal((await call('/api/admin/export')).status,401);
  });
  const payload={name:'=Test Student',phone:'+91 90000 00000',interest:'Hotel Management',message:'Test enquiry, not a real student',consent:true,idempotencyKey:randomUUID()};let reference;
  await t.test('Validate consent, phones and reject cross-origin writes',async()=>{
    assert.equal((await call('/api/enquiries','POST',{...payload,consent:false})).status,400);
    assert.equal((await call('/api/enquiries','POST',{...payload,phone:'123'})).status,400);
    assert.equal((await call('/api/enquiries','POST',payload,{Origin:'https://untrusted.example'})).status,403);
  });
  await t.test('Save enquiry once and return a stable confirmation on retry',async()=>{
    const response=await call('/api/enquiries','POST',payload);assert.equal(response.status,201);reference=(await response.json()).reference;assert.match(reference,/^GGI-/);
    const retry=await call('/api/enquiries','POST',payload);assert.equal(retry.status,200);assert.equal((await retry.json()).reference,reference);
  });
  await t.test('Admin login requires password and sets protected session',async()=>{
    assert.equal((await call('/api/admin/login','POST',{password:'incorrect'})).status,401);
    const response=await call('/api/admin/login','POST',{password});assert.equal(response.status,200);const setCookie=response.headers.get('set-cookie');assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/SameSite=Strict/);cookie=setCookie.split(';')[0];csrf=(await response.json()).csrf;
    assert.equal((await call('/api/admin/session')).status,200);
    const rows=(await (await call('/api/admin/enquiries')).json()).enquiries;assert.equal(rows.length,1);assert.equal(rows[0].id,reference);
  });
  await t.test('Status changes require CSRF; exports neutralize spreadsheet formulas',async()=>{
    assert.equal((await call('/api/admin/enquiries/'+reference,'PATCH',{status:'Contacted'},{'X-CSRF-Token':'bad'})).status,403);
    assert.equal((await call('/api/admin/enquiries/'+reference,'PATCH',{status:'Contacted'})).status,200);
    const csv=await(await call('/api/admin/export')).text();assert.match(csv,/'=Test Student/);assert.match(csv,/'\+91 90000 00000/);assert.match(csv,/Contacted/);
  });
  await t.test('Staff can publish verified course details',async()=>{
    content.programs[0].duration='Test duration';content.announcement='Test announcement';
    assert.equal((await call('/api/admin/content','PUT',content)).status,200);
    assert.equal((await(await call('/api/public-content')).json()).content.programs[0].duration,'Test duration');
    assert.equal((await call('/api/admin/content','PUT',{programs:[]})).status,400);
  });
  await t.test('Records persist across restart; old sessions expire',async()=>{
    await new Promise(resolve=>server.close(resolve));server=await createApp({dataDir:directory,password,production:false});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
    assert.equal((await call('/api/admin/enquiries')).status,401);
    const auth=await call('/api/admin/login','POST',{password});cookie=auth.headers.get('set-cookie').split(';')[0];csrf=(await auth.json()).csrf;
    const rows=(await(await call('/api/admin/enquiries')).json()).enquiries;assert.equal(rows.length,1);assert.equal(rows[0].status,'Contacted');
    assert.equal((await(await call('/api/public-content')).json()).content.announcement,'Test announcement');
  });
  await t.test('Staff can delete a record and sign out',async()=>{
    assert.equal((await call('/api/admin/enquiries/'+reference,'DELETE')).status,200);assert.equal((await(await call('/api/admin/enquiries')).json()).enquiries.length,0);
    assert.equal((await call('/api/admin/logout','POST',{})).status,200);assert.equal((await call('/api/admin/enquiries')).status,401);
  });
});

test('Production refuses unconfigured authentication',async()=>{
  await assert.rejects(()=>createApp({production:true,password:'',origin:'https://college.example'}),/Production requires/);
  await assert.rejects(()=>createApp({production:true,password:'short',origin:'https://college.example'}),/14 characters/);
});
