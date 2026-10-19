const $ = selector => document.querySelector(selector);
const phoneNumber = '919967625438';
const courseArt = {
  hotel: {src:'assets/hotel-reception.webp',alt:'Illustrative hotel reception and guest service'},
  culinary: {src:'assets/hospitality-hero.webp',alt:'Illustrative chef carefully plating a dish'},
  service: {src:'assets/service-training.webp',alt:'Illustrative hospitality trainee preparing a restaurant table'}
};
const requestLabels = {enquiry:'Admission enquiry',booking:'Course booking request',career:'Career enquiry'};
const form = $('#enquiry-form');
const field = name => form.elements.namedItem(name);
const newKey = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let content = window.GREENWICH_CONTENT, serverMode = false, selectedProgram, filter = 'all';
let submissionKey = newKey(), lastFingerprint = '', submitting = false;
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const scrollToForm = () => { $('#enquire').scrollIntoView({behavior:prefersReducedMotion()?'instant':'smooth'});field('name').focus({preventScroll:true}); };
const indiaMonth = () => new Date(Date.now()+330*60000).toISOString().slice(0,7);
field('preferredMonth').min = indiaMonth();

function artFor(program,index=0){return courseArt[program.id] || Object.values(courseArt)[index % 3];}
function renderPrograms(){
  $('#announcement').textContent=content.announcement;
  $('#program-grid').replaceChildren();
  let count=0;
  content.programs.forEach((program,index)=>{
    const key=courseArt[program.id]?program.id:Object.keys(courseArt)[index%3];
    if(filter!=='all'&&key!==filter)return;
    count++;
    const card=document.createElement('article');card.className='program-card';
    const visual=document.createElement('div');visual.className='course-photo';
    const art=artFor(program,index),img=document.createElement('img');img.src=art.src;img.alt=art.alt;img.loading='lazy';img.width=1536;img.height=1024;
    const number=document.createElement('span');number.className='course-number';number.textContent=String(index+1).padStart(2,'0');number.setAttribute('aria-hidden','true');visual.append(img,number);
    const body=document.createElement('div');body.className='course-body';
    const category=document.createElement('p');category.className='eyebrow';category.textContent=program.category;
    const title=document.createElement('h3');title.textContent=program.title;
    const description=document.createElement('p');description.textContent=program.description;
    const actions=document.createElement('div');actions.className='course-actions';
    const details=document.createElement('button');details.type='button';details.className='course-details';details.textContent='Course details ↗';details.setAttribute('aria-label',`View ${program.title} details`);details.addEventListener('click',()=>openProgram(program,index));
    const book=document.createElement('button');book.type='button';book.className='button';book.textContent='Book this course ↗';book.setAttribute('aria-label',`Request a booking for ${program.title}`);book.addEventListener('click',()=>startRequest('booking',program.title));
    actions.append(details,book);body.append(category,title,description,actions);card.append(visual,body);$('#program-grid').append(card);
  });
  $('#course-count').textContent=`${count} study ${count===1?'area':'areas'} shown.`;
  const select=field('interest'),oldValue=select.value;
  select.replaceChildren(new Option('Choose a study area',''));
  content.programs.forEach(p=>select.add(new Option(p.title,p.title)));
  select.add(new Option('Help me choose','Help me choose'));
  select.value=[...select.options].some(o=>o.value===oldValue)?oldValue:'';
  updateRequestUI();
}
function openProgram(program,index){
  selectedProgram=program;
  const art=artFor(program,index);$('#dialog-image').src=art.src;$('#dialog-image').alt=art.alt;
  $('#dialog-category').textContent=program.category;$('#dialog-title').textContent=program.title;$('#dialog-description').textContent=program.description;
  $('#dialog-topics').replaceChildren();for(const topic of program.topics){const li=document.createElement('li');li.textContent=topic;$('#dialog-topics').append(li);}
  $('#dialog-facts').replaceChildren();for(const [key,label]of [['duration','Duration'],['eligibility','Eligibility'],['fees','Fees']]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=program[key]||'Ask admissions for current details';$('#dialog-facts').append(dt,dd);}
  $('#program-dialog').showModal();
}
function updateRequestUI(){
  const kind=field('requestKind').value,booking=kind==='booking',career=kind==='career';
  $('#form-title').textContent=booking?'Book your next chapter.':career?'Choose your horizon.':'Find your path.';
  $('#request-description').textContent=booking?'Request your preferred course and start month. Admissions will confirm availability and fees.':career?'Tell us your qualification and preferred career direction.':'Tell us what you would like to explore.';
  $('#month-field').hidden=!booking;field('preferredMonth').disabled=!booking;field('preferredMonth').required=booking;
  field('qualification').required=booking||career;field('careerTrack').required=career;
  const helpOption=[...field('interest').options].find(o=>o.value==='Help me choose');if(helpOption)helpOption.disabled=booking;
  if(booking&&field('interest').value==='Help me choose')field('interest').value='';
  $('#submit-enquiry').firstChild.textContent=serverMode?(booking?'Send booking request ':career?'Send career enquiry ':'Send admission enquiry '):'Continue on WhatsApp ';
  $('#form-help').textContent=serverMode?'Your request is saved for our team. You’ll receive a reference. Admission, seats and employment require separate confirmation.':'Your details will be prepared for WhatsApp. Open the message and tap Send to share it. A request does not confirm a course seat or employment.';
}
function startRequest(kind,interest,track){
  field('requestKind').value=kind;
  if(interest)field('interest').value=interest;
  if(track)field('careerTrack').value=track;
  updateRequestUI();$('#form-result').hidden=true;scrollToForm();
}
for(const button of document.querySelectorAll('[data-filter]'))button.addEventListener('click',()=>{filter=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));renderPrograms();});
$('.dialog-close').addEventListener('click',()=>$('#program-dialog').close());
$('#program-dialog').addEventListener('click',event=>{if(event.target!==event.currentTarget)return;const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.currentTarget.close();});
$('#dialog-enquire').addEventListener('click',()=>{$('#program-dialog').close();startRequest('booking',selectedProgram.title);});
field('requestKind').addEventListener('change',()=>{updateRequestUI();$('#form-result').hidden=true;});
for(const link of document.querySelectorAll('[data-request]'))link.addEventListener('click',event=>{event.preventDefault();startRequest(link.dataset.request);});
for(const link of document.querySelectorAll('[data-career]'))link.addEventListener('click',event=>{event.preventDefault();startRequest('career','Help me choose',link.dataset.career);});
$('[data-visit]').addEventListener('click',event=>{event.preventDefault();field('message').value='I would like to arrange a campus visit. Please share the address and available timings.';startRequest('enquiry','Help me choose');});
const tabs=[...document.querySelectorAll('[role=tab]')];
function chooseTab(tab,focus=false){tabs.forEach(t=>{const selected=t===tab;t.setAttribute('aria-selected',String(selected));t.tabIndex=selected?0:-1;$('#'+t.getAttribute('aria-controls')).hidden=!selected;});if(focus)tab.focus();}
tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>chooseTab(tab));tab.addEventListener('keydown',event=>{let next;if(event.key==='ArrowRight'||event.key==='ArrowLeft')next=tabs[1-index];else if(event.key==='Home')next=tabs[0];else if(event.key==='End')next=tabs[1];if(next){event.preventDefault();chooseTab(next,true);}});});
function closeMenu(){$('.menu-toggle').setAttribute('aria-expanded','false');$('.menu-toggle').setAttribute('aria-label','Open navigation');$('#navigation').classList.remove('open');}
$('.menu-toggle').addEventListener('click',()=>{const expanded=$('.menu-toggle').getAttribute('aria-expanded')==='true';$('.menu-toggle').setAttribute('aria-expanded',String(!expanded));$('.menu-toggle').setAttribute('aria-label',expanded?'Open navigation':'Close navigation');$('#navigation').classList.toggle('open',!expanded);});
$('#navigation').addEventListener('click',e=>{if(e.target.closest('a'))closeMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
$('#year').textContent=new Date().getFullYear();renderPrograms();
async function detectServer(){
  if(location.protocol==='file:')return;
  try{const response=await fetch('api/public-content',{signal:AbortSignal.timeout(5000)});if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))return;
    const result=await response.json();if(result.service!=='greenwich-admissions'||!Array.isArray(result.content?.programs))return;
    serverMode=result.requestTypes===true;content=result.content;renderPrograms();
  }catch{/* A static deployment uses the explicit WhatsApp handoff. */}
}
const ready=detectServer();
form.addEventListener('submit',async event=>{
  event.preventDefault();if(submitting)return;
  await ready;if(!form.reportValidity())return;
  const data=Object.fromEntries(new FormData(form)),result=$('#form-result');
  const digits=data.phone.replace(/\D/g,'');result.hidden=false;result.classList.remove('error');result.replaceChildren();
  if(data.name.trim().length<2||digits.length<10||digits.length>15){result.textContent='Enter your full name and a valid mobile number.';result.classList.add('error');return;}
  if(data.requestKind==='booking'&&(!/^\d{4}-(0[1-9]|1[0-2])$/.test(data.preferredMonth||'')||data.preferredMonth<indiaMonth()||data.interest==='Help me choose')){result.textContent='Choose a course and a current or future start month.';result.classList.add('error');return;}
  if(data.website)return;
  const payload={...data,preferredMonth:data.requestKind==='booking'?data.preferredMonth:'',consent:!!data.consent};
  if(!serverMode){
    const message=[`Hello Greenwich Global,`,requestLabels[data.requestKind],`Name: ${data.name.trim()}`,`Mobile: ${data.phone.trim()}`,data.email?`Email: ${data.email.trim()}`:'',`Study area: ${data.interest}`,data.qualification?`Qualification: ${data.qualification}`:'',data.careerTrack?`Career direction: ${data.careerTrack}`:'',payload.preferredMonth?`Preferred start: ${payload.preferredMonth}`:'',`Message: ${data.message.trim()||'Please contact me with the next steps.'}`].filter(Boolean).join('\n');
    result.textContent='Your request is ready. Open WhatsApp and tap Send to share it with our team. Nothing has been submitted yet.';
    const link=document.createElement('a');link.href=`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;link.target='_blank';link.rel='noopener';link.textContent='Open my request in WhatsApp ↗';result.append(link);link.focus();return;
  }
  const fingerprint=JSON.stringify(payload);if(lastFingerprint&&lastFingerprint!==fingerprint)submissionKey=newKey();lastFingerprint=fingerprint;
  const submit=$('#submit-enquiry');submitting=true;submit.disabled=true;result.textContent='Sending your request…';
  try{
    const response=await fetch('api/enquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,idempotencyKey:submissionKey}),signal:AbortSignal.timeout(15000)});
    const body=await response.json();if(!response.ok)throw new Error(body.error||'Unable to save your request.');
    result.textContent=`${requestLabels[data.requestKind]} received. Reference: ${body.reference}. Save this reference. Our team will contact you. A course seat or employment is not confirmed by this request.`;
    form.reset();updateRequestUI();submissionKey=newKey();lastFingerprint='';
  }catch(error){result.classList.add('error');result.textContent=`${error.message} No confirmation was received. Retry the same details or call +91 99676 25438.`;}
  finally{submitting=false;submit.disabled=false;}
});
