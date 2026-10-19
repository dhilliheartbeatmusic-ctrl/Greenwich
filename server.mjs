import http from 'node:http';
import {readFile, stat, mkdir} from 'node:fs/promises';
import {resolve, extname, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';

const ROOT=dirname(fileURLToPath(import.meta.url));
const TYPES={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8'};
const STATUSES=['New','Contacted','Follow-up','Confirmed','Closed'];
const REQUEST_KINDS=['enquiry','booking','career'];
const QUALIFICATIONS=['10th completed','12th completed','Diploma','Graduate','Postgraduate','Currently studying','Other'];
const MAX_BODY=24*1024;
function clean(value,max){return typeof value==='string'?value.trim().slice(0,max):'';}
function fail(status,message){const e=new Error(message);e.status=status;throw e;}
function csvCell(v){const text=String(v??'');return '"'+(/^[\s]*[=+@-]/.test(text)?"'"+text:text).replaceAll('"','""')+'"';}
async function readBody(req){
  if(!req.headers['content-type']?.startsWith('application/json'))fail(415,'JSON content is required.');
  let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>MAX_BODY)fail(413,'Request is too large.');}
  try{return JSON.parse(raw);}catch{fail(400,'Invalid request.');}
}

export async function createApp(options={}){
  const production=options.production??process.env.NODE_ENV==='production';
  const password=options.password??process.env.ADMIN_PASSWORD??'';
  const origin=options.origin??process.env.PUBLIC_ORIGIN??'';
  const dataDir=resolve(options.dataDir??process.env.DATA_DIR??resolve(ROOT,'data'));
  if(password&&password.length<14)throw new Error('ADMIN_PASSWORD must be at least 14 characters.');
  if(production&&(!password||!/^https:\/\/[^/]+$/.test(origin)))throw new Error('Production requires a strong ADMIN_PASSWORD and PUBLIC_ORIGIN set to the public HTTPS origin.');
  await mkdir(dataDir,{recursive:true,mode:0o700});
  const db=new DatabaseSync(resolve(dataDir,'greenwich.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS enquiries (
    id TEXT PRIMARY KEY, request_key TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
    phone TEXT NOT NULL, interest TEXT NOT NULL, message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'New', created_at TEXT NOT NULL,
    consent_at TEXT NOT NULL, consent_version TEXT NOT NULL DEFAULT '1'
  ); CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  // Additive migration preserves enquiries from the original admissions website.
  const columns=new Set(db.prepare('PRAGMA table_info(enquiries)').all().map(column=>column.name));
  for(const [name,definition] of Object.entries({request_kind:"TEXT NOT NULL DEFAULT 'enquiry'",email:"TEXT NOT NULL DEFAULT ''",qualification:"TEXT NOT NULL DEFAULT ''",career_track:"TEXT NOT NULL DEFAULT ''",preferred_month:"TEXT NOT NULL DEFAULT ''",request_hash:"TEXT NOT NULL DEFAULT ''"})){
    if(!columns.has(name))db.exec(`ALTER TABLE enquiries ADD COLUMN ${name} ${definition}`);
  }
  const sandbox={window:{}};vm.runInNewContext(await readFile(resolve(ROOT,'public/site-data.js'),'utf8'),sandbox);
  const defaultContent=JSON.parse(JSON.stringify(sandbox.window.GREENWICH_CONTENT));
  const getContent=()=>{const r=db.prepare('SELECT value FROM settings WHERE key=?').get('content');return r?JSON.parse(r.value):defaultContent;};
  const salt=randomBytes(32),passwordHash=password?scryptSync(password,salt,64):null;
  const sessions=new Map(),limits=new Map();
  function limited(key,max,windowMs){const now=Date.now();const old=limits.get(key);const item=old&&old.until>now?old:{count:0,until:now+windowMs};item.count++;limits.set(key,item);if(item.count>max)fail(429,'Too many requests. Please try again later.');}
  function session(req){const token=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('greenwich_session='))?.slice(18);const value=token&&sessions.get(token);if(!value||value.expires<Date.now())fail(401,'Please sign in.');return {token,...value};}
  function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
  function validateContent(value){
    if(!value||typeof value.announcement!=='string'||value.announcement.length>180||!Array.isArray(value.programs)||value.programs.length<1||value.programs.length>6)fail(400,'Provide an announcement and 1–6 study areas.');
    return {announcement:clean(value.announcement,180),programs:value.programs.map((p,i)=>{
      if(!p||typeof p.title!=='string'||!p.title.trim()||!Array.isArray(p.topics)||p.topics.length>8)fail(400,'Each area needs a title and up to 8 topics.');
      return {id:clean(p.id,40)||`area-${i}`,title:clean(p.title,80),category:clean(p.category,60),description:clean(p.description,600),topics:p.topics.map(t=>clean(t,120)),duration:clean(p.duration,160),eligibility:clean(p.eligibility,240),fees:clean(p.fees,240)};
    })};
  }
  const cleanup=setInterval(()=>{const now=Date.now();for(const [key,value]of limits)if(value.until<now)limits.delete(key);for(const [key,value]of sessions)if(value.expires<now)sessions.delete(key);},60000);cleanup.unref();
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    if(production)res.setHeader('Strict-Transport-Security','max-age=31536000');
    try{
      const url=new URL(req.url,'http://localhost');const path=url.pathname;
      const ip=process.env.TRUST_PROXY==='1'?String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',')[0].trim():req.socket.remoteAddress;
      if(path.startsWith('/api/')){
        if(!['GET','POST','PATCH','PUT','DELETE'].includes(req.method))fail(405,'Method not allowed.');
        if(req.method!=='GET'){
          const requestOrigin=req.headers.origin;
          const allowed=origin||`http://${req.headers.host}`;
          if(requestOrigin&&requestOrigin!==allowed)fail(403,'This origin is not allowed.');
          if(production&&!requestOrigin)fail(403,'An origin is required.');
          if(req.headers['sec-fetch-site']==='cross-site')fail(403,'Cross-site request rejected.');
        }
        if(path==='/api/public-content'&&req.method==='GET')return json(res,200,{service:'greenwich-admissions',requestTypes:true,content:getContent()});
        if(path==='/api/enquiries'&&req.method==='POST'){
          limited('enquiry:'+ip,8,15*60000);
          const body=await readBody(req);
          const name=clean(body.name,100),phone=clean(body.phone,20),interest=clean(body.interest,80),message=clean(body.message,1500),key=clean(body.idempotencyKey,100);
          if(body.website)fail(400,'Unable to accept this enquiry.');
          const digits=phone.replace(/\D/g,'');
          if(name.length<2||!/^[-+() 0-9]+$/.test(phone)||digits.length<10||digits.length>15||!interest||body.consent!==true||key.length<10)fail(400,'Enter a valid name, mobile, interest and consent.');
          if(![...getContent().programs.map(p=>p.title),'Help me choose'].includes(interest))fail(400,'Select a valid area of interest.');
          const kind=body.requestKind===undefined?'enquiry':body.requestKind;
          const email=clean(body.email,254),qualification=clean(body.qualification,80),track=clean(body.careerTrack,30),month=clean(body.preferredMonth,7);
          if(!REQUEST_KINDS.includes(kind))fail(400,'Choose a valid request type.');
          if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,'Enter a valid email address.');
          if(qualification&&!QUALIFICATIONS.includes(qualification))fail(400,'Select a valid qualification.');
          if(track&&!['Shore','Ship','Either'].includes(track))fail(400,'Select Shore, Ship or Either.');
          if((kind==='booking'||kind==='career')&&!qualification)fail(400,'Select your highest qualification.');
          if(kind==='career'&&!track)fail(400,'Select your preferred career direction.');
          const currentMonth=new Date(Date.now()+330*60000).toISOString().slice(0,7);
          if(kind==='booking'&&(interest==='Help me choose'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||month<currentMonth||body.preferredMonth!==month))fail(400,'Choose a course and a current or future start month.');
          const preferredMonth=kind==='booking'?month:'';
          const requestHash=createHash('sha256').update(JSON.stringify({name,phone,interest,message,kind,email,qualification,track,preferredMonth})).digest('hex');
          const existing=db.prepare('SELECT id,request_hash FROM enquiries WHERE request_key=?').get(key);
          if(existing){
            if(existing.request_hash&&existing.request_hash!==requestHash)fail(409,'This request reference belongs to different details. Please start a new request.');
            return json(res,200,{reference:existing.id});
          }
          const prefix=kind==='booking'?'GGB':kind==='career'?'GGC':'GGI';
          const reference=prefix+'-'+randomUUID().toUpperCase(),now=new Date().toISOString();
          db.prepare('INSERT INTO enquiries (id,request_key,name,phone,interest,message,created_at,consent_at,request_kind,email,qualification,career_track,preferred_month,request_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(reference,key,name,phone,interest,message,now,now,kind,email,qualification,track,preferredMonth,requestHash);
          return json(res,201,{reference});
        }
        if(path==='/api/admin/login'&&req.method==='POST'){
          if(!passwordHash)fail(503,'Admin access is not configured. Set ADMIN_PASSWORD on the server.');
          limited('login:'+ip,8,15*60000);
          const body=await readBody(req);const attempt=typeof body.password==='string'?body.password:'';
          if(!timingSafeEqual(scryptSync(attempt.slice(0,1024),salt,64),passwordHash))fail(401,'Incorrect password.');
          const token=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');sessions.set(token,{csrf,expires:Date.now()+8*3600000});
          res.setHeader('Set-Cookie',`greenwich_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${production?'; Secure':''}`);
          return json(res,200,{csrf});
        }
        if(path.startsWith('/api/admin/')){
          const current=session(req);
          if(req.method!=='GET'&&req.headers['x-csrf-token']!==current.csrf)fail(403,'Session verification failed. Please sign in again.');
          if(path==='/api/admin/session'&&req.method==='GET')return json(res,200,{csrf:current.csrf});
          if(path==='/api/admin/logout'&&req.method==='POST'){sessions.delete(current.token);res.setHeader('Set-Cookie',`greenwich_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${production?'; Secure':''}`);return json(res,200,{ok:true});}
          if(path==='/api/admin/enquiries'&&req.method==='GET'){
            const rows=db.prepare('SELECT id,name,phone,interest,message,status,created_at,request_kind,email,qualification,career_track,preferred_month FROM enquiries ORDER BY created_at DESC LIMIT 1000').all();return json(res,200,{enquiries:rows});
          }
          if(path==='/api/admin/export'&&req.method==='GET'){
            const rows=db.prepare('SELECT id,name,phone,interest,message,status,created_at,request_kind,email,qualification,career_track,preferred_month FROM enquiries ORDER BY created_at DESC').all();
            const csv=['Reference,Name,Phone,Interest,Message,Status,Created at,Request type,Email,Qualification,Career direction,Preferred start month',...rows.map(r=>Object.values(r).map(csvCell).join(','))].join('\r\n');
            res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="Greenwich_Enquiries.csv"','Cache-Control':'no-store'});return res.end('\uFEFF'+csv);
          }
          if(path.startsWith('/api/admin/enquiries/')&&req.method==='PATCH'){
            const id=path.split('/').pop(),body=await readBody(req);if(!STATUSES.includes(body.status))fail(400,'Invalid status.');
            const result=db.prepare('UPDATE enquiries SET status=? WHERE id=?').run(body.status,id);if(!result.changes)fail(404,'Enquiry not found.');return json(res,200,{ok:true});
          }
          if(path.startsWith('/api/admin/enquiries/')&&req.method==='DELETE'){
            const id=path.split('/').pop();const result=db.prepare('DELETE FROM enquiries WHERE id=?').run(id);if(!result.changes)fail(404,'Enquiry not found.');return json(res,200,{ok:true});
          }
          if(path==='/api/admin/content'&&req.method==='PUT'){
            const content=validateContent(await readBody(req));db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('content',JSON.stringify(content));return json(res,200,{ok:true});
          }
        }
        fail(404,'Endpoint not found.');
      }
      if(!['GET','HEAD'].includes(req.method))fail(405,'Method not allowed.');
      let relative=decodeURIComponent(path);if(relative==='/')relative='/index.html';if(relative==='/admin'||relative==='/admin/')relative='/admin.html';
      if(relative.split('/').some(part=>part.startsWith('.')))fail(404,'Page not found.');
      const publicRoot=resolve(ROOT,'public');const target=resolve(publicRoot,'.'+relative);
      if(!target.startsWith(publicRoot+'/'))fail(404,'Page not found.');
      let info;try{info=await stat(target);}catch{fail(404,'Page not found.');}if(!info.isFile())fail(404,'Page not found.');
      const bytes=await readFile(target);res.writeHead(200,{'Content-Type':TYPES[extname(target)]||'application/octet-stream','Cache-Control':relative.includes('/assets/')?'public, max-age=86400':'no-cache','Content-Length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);
    }catch(error){if(!res.headersSent)json(res,error.status||500,{error:error.status?error.message:'The server could not complete the request. Please try again.'});else res.end();}
  });
  server.on('close',()=>{clearInterval(cleanup);db.close();});
  return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const server=await createApp();server.listen(Number(process.env.PORT||3000),process.env.HOST||'127.0.0.1',()=>console.log('Greenwich server is ready.'));
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
}
