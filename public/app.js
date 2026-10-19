const $ = (selector) => document.querySelector(selector);
const phoneNumber = '919967625438';
const icons = [
  '<path d="M8 46h48M13 45V17l19-9 19 9v28M22 45V30h20v15M20 19h3m7 0h3m7 0h3M20 25h3m7 0h3m7 0h3M27 45V34h10v11"/>',
  '<path d="M19 28c-11-1-12-17-1-19 5-1 8 1 10 4 4-8 16-7 19 1 12 0 12 15 2 16l-2 18H20Zm2 12h26M19 52h30M27 19v12m10-12v12"/>',
  '<path d="M9 48h46M13 43a19 19 0 0 1 38 0ZM29 21v-4h6v4M8 53h48M32 6v5M13 14l4 4m34-4-4 4"/>'
];
let content = window.GREENWICH_CONTENT;
let serverMode = false;
let selectedProgram;
let submissionKey = globalThis.crypto?.randomUUID?.() || String(Date.now()) + Math.random();

function renderPrograms() {
  $('#announcement').textContent = content.announcement;
  $('#program-grid').replaceChildren();
  content.programs.forEach((program, index) => {
    const card = document.createElement('article'); card.className = 'program-card';
    // Only fixed, developer-owned SVG markup is inserted as HTML.
    const icon = document.createElement('div'); icon.className = 'program-icon';
    icon.innerHTML = `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">${icons[index % icons.length]}</svg>`;
    const category = document.createElement('p'); category.className = 'eyebrow'; category.textContent = program.category;
    const title = document.createElement('h3'); title.textContent = program.title;
    const description = document.createElement('p'); description.textContent = program.description;
    const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Explore this area'; button.setAttribute('aria-label', `Explore ${program.title}`);
    const arrow = document.createElement('span'); arrow.textContent = '↗'; arrow.setAttribute('aria-hidden','true'); button.append(arrow);
    button.addEventListener('click', () => openProgram(program));
    card.append(icon, category, title, description, button); $('#program-grid').append(card);
  });
  const select = $('[name=interest]'); const oldValue = select.value;
  select.replaceChildren(new Option('Select your interest', ''));
  content.programs.forEach(p => select.add(new Option(p.title, p.title)));
  select.add(new Option('Help me choose', 'Help me choose')); select.value = oldValue;
}
function openProgram(program) {
  selectedProgram = program;
  $('#dialog-category').textContent = program.category; $('#dialog-title').textContent = program.title;
  $('#dialog-description').textContent = program.description; $('#dialog-topics').replaceChildren();
  for(const topic of program.topics) { const li=document.createElement('li');li.textContent=topic;$('#dialog-topics').append(li); }
  $('#dialog-facts').replaceChildren();
  for(const [key,label] of [['duration','Duration'],['eligibility','Eligibility'],['fees','Fees']]) {
    const dt=document.createElement('dt');dt.textContent=label; const dd=document.createElement('dd');dd.textContent=program[key] || 'Contact admissions for current details';$('#dialog-facts').append(dt,dd);
  }
  $('#program-dialog').showModal();
}
$('.dialog-close').addEventListener('click',()=>$('#program-dialog').close());
$('#program-dialog').addEventListener('click',e=>{if(e.target===$('#program-dialog')) {const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
$('#dialog-enquire').addEventListener('click',()=>{$('[name=interest]').value=selectedProgram.title;$('#program-dialog').close();$('#enquire').scrollIntoView({behavior:'smooth'});$('[name=name]').focus({preventScroll:true});});
$('.menu-toggle').addEventListener('click',()=>{const expanded=$('.menu-toggle').getAttribute('aria-expanded')==='true';$('.menu-toggle').setAttribute('aria-expanded',String(!expanded));$('.menu-toggle').setAttribute('aria-label',expanded?'Open navigation':'Close navigation');$('#navigation').classList.toggle('open',!expanded);});
function closeMenu(){$('.menu-toggle').setAttribute('aria-expanded','false');$('.menu-toggle').setAttribute('aria-label','Open navigation');$('#navigation').classList.remove('open');}
$('#navigation').addEventListener('click',e=>{if(e.target.closest('a'))closeMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
$('#year').textContent=new Date().getFullYear();
renderPrograms();

async function detectServer(){
  if(location.protocol==='file:')return;
  try{
    const response=await fetch('api/public-content',{signal:AbortSignal.timeout(4000)});
    if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))return;
    const result=await response.json();
    if(result.service!=='greenwich-admissions')return;
    serverMode=true;content=result.content;renderPrograms();
    $('#submit-enquiry').firstChild.textContent='Send admission enquiry ';
    $('#form-help').textContent='Your enquiry will be saved securely for the admissions team. This is not an admission confirmation.';
  }catch{/* Static hosting keeps the clearly labelled WhatsApp flow. */}
}
detectServer();

$('#enquiry-form').addEventListener('submit',async(event)=>{
  event.preventDefault(); const form=event.currentTarget;
  if(!form.reportValidity())return;
  const data=Object.fromEntries(new FormData(form));
  const digits=data.phone.replace(/\D/g,'');
  const result=$('#form-result');result.hidden=false;result.classList.remove('error');result.replaceChildren();
  if(data.name.trim().length<2||digits.length<10||digits.length>15){result.textContent='Enter your full name and a valid mobile number.';result.classList.add('error');return;}
  if(data.website)return;
  if(!serverMode){
    const message=`Hello Greenwich admissions,\nName: ${data.name.trim()}\nMobile: ${data.phone.trim()}\nInterest: ${data.interest}\nQuestion: ${data.message.trim()||'Please share course and admission details.'}`;
    result.textContent='Your message is ready. Open WhatsApp and tap Send to deliver it to admissions. Nothing has been submitted yet.';
    const link=document.createElement('a');link.href=`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;link.target='_blank';link.rel='noopener';link.textContent='Open my enquiry in WhatsApp ↗';result.append(link);link.focus();return;
  }
  const submit=$('#submit-enquiry');submit.disabled=true;result.textContent='Sending your enquiry…';
  try{
    const response=await fetch('api/enquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,consent:!!data.consent,idempotencyKey:submissionKey}),signal:AbortSignal.timeout(15000)});
    const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Unable to save your enquiry.');
    result.textContent=`Thank you. Your enquiry has been received. Reference: ${payload.reference}. Please save this reference. This is an enquiry, not an admission confirmation.`;
    form.reset();submissionKey=crypto.randomUUID();
  }catch(error){result.classList.add('error');result.textContent=`${error.message} Please try again or call +91 99676 25438. No confirmation has been received.`;}
  finally{submit.disabled=false;}
});
