'use strict';
const $ = id => document.getElementById(id);
const form = $('card-form');
const status = $('status');
const buttons = [...document.querySelectorAll('[data-download]')];
const logo = new Image();
logo.src = 'assets/ceo-brand.png';
let renderVersion = 0;
let ready = false;
let currentQR = null;
for (const [index, office] of LOCATIONS.entries()) {
  $('location').add(new Option(office.name, String(index)));
}
function details() {
  const value = id => $(id).value.trim();
  return {name:value('fullName'), title:value('jobTitle'), email:value('email'),
    phone:value('phone'), extension:value('extension'),
    office:LOCATIONS[$('location').value] || null};
}
function escapeVCard(value) {
  return value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}
// vCard 3.0 lines are folded at 75 UTF-8 octets, without splitting a character.
function foldLine(line) {
  let result = '', bytes = 0;
  for (const character of line) {
    const size = new TextEncoder().encode(character).length;
    if (bytes + size > 75) { result += '\r\n '; bytes = 1; }
    result += character; bytes += size;
  }
  return result;
}
function makeVCard(d) {
  const esc = escapeVCard;
  const phone = d.phone.replace(/[^+0-9]/g, '');
  const lines = ['BEGIN:VCARD','VERSION:3.0',`N:;${esc(d.name)};;;`, `FN:${esc(d.name)}`,
    'ORG:Commission on Economic Opportunity', `TITLE:${esc(d.title)}`,
    `EMAIL;TYPE=WORK,INTERNET:${esc(d.email)}`,`TEL;TYPE=WORK,VOICE:${phone}${d.extension ? ' x' + d.extension : ''}`,
    'URL:https://www.ceoempowers.org/'];
  if (d.office) {
    const match = d.office.address.match(/^(.*), (.*), NY (\d{5})$/);
    lines.push(`ADR;TYPE=WORK:;;${esc(match[1])};${esc(match[2])};NY;${match[3]};USA`);
    lines.push(`NOTE:${esc(d.office.name)}${d.extension ? '\\nPhone extension: ' + esc(d.extension) : ''}`);
  }
  lines.push('END:VCARD');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
function fittedText(ctx, text, x, y, maxWidth, size, weight = 'normal', color = '#35363a') {
  ctx.fillStyle = color;
  do { ctx.font = `${weight} ${size--}px Arial, Helvetica, sans-serif`; }
  while (ctx.measureText(text).width > maxWidth && size > 10);
  ctx.fillText(text, x, y);
}
function lines(ctx, text, x, y, width, size, lineHeight) {
  ctx.fillStyle = '#65616a'; ctx.font = `${size}px Arial, Helvetica, sans-serif`;
  let line = '';
  for (const word of text.split(' ')) {
    if (ctx.measureText(line + word).width > width && line) { ctx.fillText(line.trim(),x,y); y += lineHeight; line = ''; }
    line += word + ' ';
  }
  ctx.fillText(line.trim(),x,y); return y + lineHeight;
}
function drawCard(canvas, d, qr, wallpaper = false) {
  canvas.width = wallpaper ? 1080 : 1500; canvas.height = wallpaper ? 1920 : 1000;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#7b4198'; ctx.fillRect(0,0,canvas.width,16);
  ctx.fillStyle = '#ea1956'; ctx.fillRect(0,canvas.height-16,canvas.width,16);
  if (wallpaper) {
    if (logo.naturalWidth) ctx.drawImage(logo,440,190,200,267);
    ctx.textAlign = 'center';
    fittedText(ctx,d.name || 'Your Name',540,565,930,70,'bold');
    fittedText(ctx,d.title || 'Your Job Title',540,635,930,42);
    fittedText(ctx,d.phone + (d.extension ? ' ext. '+d.extension : '') || 'Your work phone',540,725,930,35);
    fittedText(ctx,d.email || 'Your work email',540,785,930,35);
    if (d.office) fittedText(ctx,d.office.name,540,855,940,32,'bold','#7b4198');
    if (qr) ctx.drawImage(qr,240,950,600,600);
    fittedText(ctx,qr ? 'SCAN TO SAVE MY CONTACT' : 'Complete your details to add a QR code',540,1630,930,28,'bold','#7b4198');
    fittedText(ctx,'ceoempowers.org',540,1710,930,35,'bold','#ea1956');
  } else {
    if (logo.naturalWidth) ctx.drawImage(logo,70,70,180,240);
    fittedText(ctx,d.name || 'Your Name',310,145,1110,66,'bold');
    fittedText(ctx,d.title || 'Your Job Title',310,220,1110,40);
    fittedText(ctx,'Commission on Economic Opportunity',310,285,1110,29,'normal','#7b4198');
    ctx.strokeStyle = '#e6dfeb'; ctx.beginPath();ctx.moveTo(70,360);ctx.lineTo(1430,360);ctx.stroke();
    fittedText(ctx,d.phone + (d.extension ? ' ext. '+d.extension : '') || 'Your work phone',80,455,840,38);
    fittedText(ctx,d.email || 'Your work email',80,520,840,36);
    if (d.office) {
      const y = lines(ctx,d.office.name,80,635,810,34,45);
      lines(ctx,d.office.address,80,y+20,810,30,42);
    } else fittedText(ctx,'Choose your office location',80,635,810,32,'normal','#777777');
    fittedText(ctx,'ceoempowers.org',80,875,820,36,'bold','#ea1956');
    if (qr) ctx.drawImage(qr,1010,410,420,420);
    else {ctx.fillStyle='#f6f1f8';ctx.fillRect(1010,410,420,420);}
    fittedText(ctx,qr ? 'SCAN TO SAVE CONTACT' : 'Complete your details for QR',1010,875,420,23,'bold','#7b4198');
  }
}
async function refresh() {
  const version = ++renderVersion;
  const d = details(); ready = false; currentQR = null;
  buttons.forEach(b => b.disabled = true);
  $('office-address').textContent = d.office ? d.office.address : 'Choose an office to include its address.';
  $('preview-summary').textContent = d.name ? `${d.name}${d.title ? ' · ' + d.title : ''}${d.office ? ' · ' + d.office.name : ''}` : 'Enter your details to personalize your card.';
  drawCard($('card-preview'),d,null);
  if (!form.checkValidity()) { status.textContent = 'Complete the required fields to enable downloads.'; return; }
  try {
    if (typeof QRCode === 'undefined') throw new Error('QR library unavailable');
    const qr = document.createElement('canvas');
    await QRCode.toCanvas(qr,makeVCard(d),{width:900,margin:4,errorCorrectionLevel:'M',color:{dark:'#000000',light:'#ffffff'}});
    if (version !== renderVersion) return;
    if (!logo.complete || !logo.naturalWidth) throw new Error('Brand image unavailable');
    currentQR = qr; ready = true;
    drawCard($('card-preview'),d,qr);
    buttons.forEach(b => b.disabled = false);
    status.textContent = 'Ready to download. Double-check your details before sharing.';
  } catch (error) {
    if (version === renderVersion) status.textContent = 'We couldn’t create your card. Reload the page and try again, or shorten your details.';
  }
}
function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');link.href=url;link.download=name;
  document.body.append(link);link.click();link.remove();
  setTimeout(() => URL.revokeObjectURL(url),60000);
}
async function download(kind) {
  if (!form.reportValidity() || !ready || !currentQR) return;
  const d = details();
  const filename = d.name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'ceo-contact';
  try {
    if (kind === 'vcf') saveBlob(new Blob([makeVCard(d)],{type:'text/vcard;charset=utf-8'}),filename+'.vcf');
    else {
      const canvas = document.createElement('canvas');
      if (kind === 'qr') {canvas.width=900;canvas.height=900;canvas.getContext('2d').drawImage(currentQR,0,0);}
      else drawCard(canvas,d,currentQR,kind === 'wallpaper');
      const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/png'));
      if (!blob) throw new Error('Image export failed');
      saveBlob(blob,filename+'-'+kind+'.png');
    }
    status.textContent = 'Download started. Your details have not been saved on this website.';
  } catch(error) {status.textContent = 'The download failed. Please try again.';}
}
form.addEventListener('submit',event=>event.preventDefault());
form.addEventListener('input',refresh);
form.addEventListener('change',refresh);
buttons.forEach(button=>button.addEventListener('click',()=>download(button.dataset.download)));
logo.addEventListener('load',refresh);
logo.addEventListener('error',()=>{status.textContent='The company graphic could not load. Please reload the page.';buttons.forEach(b=>b.disabled=true);});
refresh();
