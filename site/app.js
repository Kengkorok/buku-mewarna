/* Buku Mewarna — dependency-free, region-locked painting. */
(() => {
'use strict';
const $ = s => document.querySelector(s), VB = 400, RES = 800, INK = '#303936';
const STYLE = '<style>.r{fill:#fff;stroke:'+INK+';stroke-width:4.5;stroke-linejoin:round;stroke-linecap:round}.d{fill:none;stroke:'+INK+';stroke-width:4.5;stroke-linejoin:round;stroke-linecap:round}.f{fill:'+INK+';stroke:none}</style>';
const COLORS = [
 ['#ed7190','Merah jambu'],['#ef7357','Jingga'],['#efb952','Kuning madu'],['#f6df7c','Kuning'],
 ['#b9d76b','Hijau limau'],['#74b894','Hijau'],['#57bcb5','Turquoise'],['#77c4d9','Biru langit'],
 ['#678dd1','Biru'],['#9180bf','Ungu'],['#c2a0d2','Lavender'],['#f3a7b8','Merah muda'],
 ['#c65053','Merah'],['#dd914b','Oren'],['#aedac4','Pudina'],['#426b95','Biru laut'],
 ['#705289','Ungu gelap'],['#cfb49a','Coklat susu'],['#966d52','Coklat'],['#c5ceca','Kelabu'],
 ['#f0e7d7','Krim'],['#525a55','Arang'],['#222825','Hitam'],['#ffffff','Putih']
];
const CATS = [['all','✦ Semua'],['haiwan','🐱 Haiwan'],['kenderaan','🚗 Kenderaan'],['makanan','🍦 Makanan'],['alam','🌿 Alam'],['lain','🤖 Lain-lain'],['saved','♡ Hasil Seni']];
const TILES = ['#f2eee5','#eaf1e9','#f8eae5','#eaf0f4','#f1eaf5','#f8f0dc'];
const canvas = (w=RES,h=w) => Object.assign(document.createElement('canvas'),{width:w,height:h});
const brush = $('#brush'), ctx = brush.getContext('2d',{willReadFrequently:true});
brush.width=brush.height=RES;
const scratch=canvas(), sc=scratch.getContext('2d');
const state = {cat:'all',page:null,tool:'brush',color:COLORS[0][0],size:28,sound:true,ready:false,
 fills:{},strokes:[],history:[],ptr:-1,current:null,pointer:null,regions:[],map:null,bounds:[],masks:new Map(),generation:0,celebrated:false};
const PAGES=(window.PAGES||[]).slice();
const byId=Object.fromEntries(PAGES.map(p=>[p.id,p]));
function svgDoc(p){return '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">'+STYLE+'<g transform="translate(32 32) scale(.84)">'+p.svg+'</g></svg>';}
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
function snapshot(){return {fills:{...state.fills},strokes:state.strokes.map(s=>({...s,pts:s.pts.map(p=>p.slice())}))};}
function persist(){
 if(!state.page||!state.ready)return;
 if(!write('bm.draft.'+state.page.id,{version:2,...snapshot()}))toast('Storan penuh. Simpan gambar untuk kekalkan hasil.');
}
function restore(s){state.fills={...s.fills};state.strokes=s.strokes.map(x=>({...x,pts:x.pts.map(p=>p.slice())}));redraw();updateProgress();persist();}
function action(before){
 state.history=state.history.slice(0,state.ptr+1);
 state.history.push({before,after:snapshot()});
 if(state.history.length>40)state.history.shift();
 state.ptr=state.history.length-1;buttons();updateProgress();persist();
}
function buttons(){$('#btn-undo').disabled=state.ptr<0;$('#btn-redo').disabled=state.ptr>=state.history.length-1;}
function undo(){finishStroke();if(state.ptr<0)return;restore(state.history[state.ptr--].before);buttons();}
function redo(){finishStroke();if(state.ptr>=state.history.length-1)return;restore(state.history[++state.ptr].after);buttons();}
function toast(msg){$('#toast').textContent=msg;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,2400);}
let audio;
function pop(step=0){
 if(!state.sound)return;
 try{audio??=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();
 const t=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();o.frequency.value=440*Math.pow(2,[0,2,4,7,9][step%5]/12);
 g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.12,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+.24);
 o.connect(g).connect(audio.destination);o.start(t);o.stop(t+.25);}catch{/* Audio is optional. */}
}
function sparkle(x,y,color=state.color,n=9){
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 for(let i=0;i<n;i++){const dot=document.createElement('i'),a=Math.random()*Math.PI*2,d=25+Math.random()*75;
 dot.style.cssText='left:'+x+'px;top:'+y+'px;background:'+color+';--dx:'+Math.cos(a)*d+'px;--dy:'+Math.sin(a)*d+'px';
 $('#effects').append(dot);setTimeout(()=>dot.remove(),750);}
}
function renderCats(){
 $('#cats').replaceChildren();
 CATS.forEach(([id,name])=>{const b=document.createElement('button');b.className='chip'+(state.cat===id?' on':'');b.textContent=name;b.setAttribute('aria-pressed',state.cat===id);
 b.onclick=()=>{state.cat=id;renderCats();renderGrid();};$('#cats').append(b);});
}
function renderGrid(){
 const grid=$('#grid');grid.replaceChildren();
 if(state.cat==='saved'){
 const list=read('bm.saved',[]);$('#page-count').textContent=list.length;
 if(!list.length){grid.innerHTML='<div class="empty">Belum ada hasil seni.<br>Warnakan sesuatu dan tekan Simpan. ♡</div>';return;}
 list.forEach(item=>{const card=document.createElement('div');card.className='card';
 const b=document.createElement('button');b.setAttribute('aria-label','Muat turun hasil seni');const img=new Image();img.src=item.d;img.alt=item.title||'Hasil seni';
 const label=document.createElement('b');label.textContent=item.title||new Date(item.t).toLocaleDateString('ms-MY');b.append(img,label);
 b.onclick=()=>download(item.d,'mewarna-'+item.t+'.jpg');const del=document.createElement('button');del.className='del';del.textContent='Padam';
 del.onclick=()=>{write('bm.saved',read('bm.saved',[]).filter(x=>x.t!==item.t));renderGrid();};card.append(b,del);grid.append(card);});return;
 }
 const pages=PAGES.filter(p=>state.cat==='all'||p.cat===state.cat);$('#page-count').textContent=pages.length;
 pages.forEach((p,i)=>{
 const card=document.createElement('button');card.className='card';card.dataset.page=p.id;card.setAttribute('aria-label','Warnakan '+p.title);
 card.style.setProperty('--tile',TILES[i%TILES.length]);
 card.innerHTML='<span class="card-art">'+svgDoc(p)+'</span><span class="card-label"><b>'+p.title+'</b><span class="card-arrow" aria-hidden="true">↗</span></span>';
 const draft=read('bm.draft.'+p.id,null);if(draft?.version===2&&(Object.keys(draft.fills).length||draft.strokes.length)){
 const tag=document.createElement('span');tag.className='draft-badge';tag.textContent='Sambung ↗';card.querySelector('.card-art').append(tag);}
 card.onclick=()=>openPage(p);grid.append(card);
 });
}
function gallery(){
 finishStroke();persist();state.generation++;state.ready=false;state.page=null;
 $('#complete-dialog').close();$('#clear-dialog').close();$('#app').classList.remove('color-view');
 $('#title').innerHTML='Buku Mewarna<span class="brand-dot">.</span>';$('#eyebrow').textContent='RUANG KREATIF SI KECIL';
 $('#btn-back').hidden=true;$('#stagewrap').hidden=true;$('#gallery').hidden=false;$('#marker').hidden=true;renderGrid();
}
function imageFrom(svg){
 return new Promise((resolve,reject)=>{
 const img=new Image(),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
 img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('SVG tidak dapat dimuatkan'));};img.src=url;
 });
}
async function openPage(p){
 finishStroke();persist();const token=++state.generation;
 state.page=p;state.ready=false;state.current=null;state.pointer=null;state.celebrated=false;
 state.fills={};state.strokes=[];state.history=[];state.ptr=-1;state.masks.clear();
 ctx.clearRect(0,0,RES,RES);$('#marker').hidden=true;$('#stage').classList.remove('ready');
 $('#art-holder').innerHTML=svgDoc(p);const art=$('#art-holder svg');art.id='art';
 state.regions=[...art.querySelectorAll('.r')];state.regions.forEach((el,i)=>el.dataset.i=i);
 // Append the background ID after existing IDs so saved artwork keeps its regions.
 const background=document.createElementNS('http://www.w3.org/2000/svg','rect');
 background.setAttribute('class','r background-region');background.setAttribute('width',VB);background.setAttribute('height',VB);
 background.style.stroke='none';state.background=state.regions.length;background.dataset.i=state.background;
 art.prepend(background);state.regions.push(background);
 $('#outline-holder').replaceChildren();
 $('#app').classList.add('color-view');$('#title').textContent=p.title;$('#eyebrow').textContent='JOM MEWARNA · '+String(PAGES.indexOf(p)+1).padStart(2,'0');
 $('#btn-back').hidden=false;$('#gallery').hidden=true;$('#stagewrap').hidden=false;$('#hint').textContent='Sediakan warna…';buttons();layout();
 try{
 // Unique flat colors encode the TOPMOST visible region. Black lines are not paintable.
 // Unlike geometric clipping alone this also excludes eyes and overlapping foreground parts.
 const ids=art.cloneNode(true);ids.setAttribute('width',RES);ids.setAttribute('height',RES);
 ids.querySelector('style').remove();const lookup=new Map();
 ids.querySelectorAll('.r').forEach(el=>{const i=+el.dataset.i,code=((i+1)*7919)&0xffffff;lookup.set(code,i);
 el.setAttribute('fill','#'+code.toString(16).padStart(6,'0'));el.setAttribute('stroke',i===state.background?'none':'#000');el.setAttribute('stroke-width','4.5');el.setAttribute('stroke-linejoin','round');});
 ids.querySelectorAll('.d').forEach(el=>{el.setAttribute('fill','none');el.setAttribute('stroke','#000');el.setAttribute('stroke-width','4.5');el.setAttribute('stroke-linecap','round');});
 ids.querySelectorAll('.f').forEach(el=>el.setAttribute('fill','#000'));
 const [img,lineImg]=await Promise.all([imageFrom(new XMLSerializer().serializeToString(ids)),imageFrom(svgDoc(p))]);
 if(token!==state.generation)return;
 // Rasterize the original white-filled drawing before removing white, preserving
 // occlusion: a head must hide body outlines behind it, including in exported PNGs.
 const ink=canvas(1200),inkCtx=ink.getContext('2d');inkCtx.drawImage(lineImg,0,0,1200,1200);
 const lineData=inkCtx.getImageData(0,0,1200,1200);
 for(let k=0;k<lineData.data.length;k+=4){const alpha=(255-lineData.data[k+1])*255/(255-57);
 if(lineData.data[k+3]===0)continue;
 lineData.data[k]=48;lineData.data[k+1]=57;lineData.data[k+2]=54;lineData.data[k+3]=Math.min(255,alpha);}
 inkCtx.putImageData(lineData,0,0);state.ink=ink;$('#outline-holder').append(ink);
 const idCanvas=canvas(),idCtx=idCanvas.getContext('2d');idCtx.drawImage(img,0,0,RES,RES);
 const data=idCtx.getImageData(0,0,RES,RES).data,map=new Int16Array(RES*RES);map.fill(-1);
 const bounds=state.regions.map(()=>({x:RES,y:RES,x2:0,y2:0,count:0}));
 for(let k=0;k<map.length;k++){const o=k*4,code=(data[o]<<16)|(data[o+1]<<8)|data[o+2],id=lookup.get(code);
 if(id===undefined||data[o+3]<250)continue;
 map[k]=id;const b=bounds[id],x=k%RES,y=Math.floor(k/RES);b.x=Math.min(b.x,x);b.y=Math.min(b.y,y);b.x2=Math.max(b.x2,x);b.y2=Math.max(b.y2,y);b.count++;}
 state.map=map;state.bounds=bounds;state.ready=true;$('#stage').classList.add('ready');
 const draft=read('bm.draft.'+p.id,null);
 if(draft?.version===2&&Array.isArray(draft.strokes)&&draft.fills){state.fills=draft.fills;state.strokes=draft.strokes;}
 redraw();updateProgress(false);setTool(state.tool);
 }catch(err){if(token===state.generation){$('#hint').textContent='Lukisan gagal dimuatkan';toast('Cuba buka lukisan ini semula.');console.error(err);}}
}
function layout(){
 if(!state.page)return;
 const area=$('#drawing-area'),r=area.getBoundingClientRect();
 const caption=getComputedStyle($('.stage-caption')).display==='none'?0:30;
 const size=Math.max(80,Math.floor(Math.min(r.width-2,r.height-caption-12,660)));
 $('#stage').style.width=size+'px';$('#stage').style.height=size+'px';
}
function point(e){
 // SVG's inverse screen matrix includes CSS scale, scrolling and viewport changes.
 const art=$('#art'),m=art?.getScreenCTM();
 if(!m)return [0,0];
 const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse());return [p.x,p.y];
}
function regionAt(pt){
 const x=Math.floor(pt[0]*RES/VB),y=Math.floor(pt[1]*RES/VB);
 if(x<0||y<0||x>=RES||y>=RES)return -1;
 return state.map[y*RES+x];
}
function mask(id){
 if(state.masks.has(id))return state.masks.get(id);
 const b=state.bounds[id];if(!b?.count)return null;
 const left=Math.max(0,b.x-1),top=Math.max(0,b.y-1),w=Math.min(RES-1,b.x2+1)-left+1,h=Math.min(RES-1,b.y2+1)-top+1;
 const c=canvas(w,h),cctx=c.getContext('2d'),d=cctx.createImageData(w,h);
 // Extend half a viewBox pixel underneath the ink to avoid white anti-alias seams.
 // The 4.5-unit outline is much wider, so adjacent color regions remain separate.
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
 let inside=false;
 for(let dy=-1;dy<=1&&!inside;dy++)for(let dx=-1;dx<=1;dx++){
 const px=x+left+dx,py=y+top+dy;
 if(px>=0&&px<RES&&py>=0&&py<RES&&state.map[py*RES+px]===id){inside=true;break;}}
 if(inside){const o=(y*w+x)*4;d.data[o]=d.data[o+1]=d.data[o+2]=d.data[o+3]=255;}}
 cctx.putImageData(d,0,0);const result={c,x:left,y:top};state.masks.set(id,result);return result;
}
function fillRegion(target,id,color,w=RES){
 const m=mask(+id);if(!m)return;
 const layer=canvas(m.c.width,m.c.height),lc=layer.getContext('2d');lc.drawImage(m.c,0,0);
 lc.globalCompositeOperation='source-in';lc.fillStyle=color;lc.fillRect(0,0,layer.width,layer.height);
 const scale=w/RES;target.drawImage(layer,m.x*scale,m.y*scale,layer.width*scale,layer.height*scale);
}
function paintStroke(target,st,w=RES,onlyLast=false){
 const m=mask(st.region);if(!m||!st.pts.length)return;
 // One reusable scratch layer avoids allocating a full canvas on every move.
 if(scratch.width!==w)scratch.width=scratch.height=w;
 sc.setTransform(1,0,0,1,0,0);sc.globalCompositeOperation='source-over';sc.clearRect(0,0,w,w);
 sc.save();sc.scale(w/VB,w/VB);sc.lineCap='round';sc.lineJoin='round';sc.lineWidth=st.size;sc.strokeStyle=st.color;sc.fillStyle=st.color;
 const pts=onlyLast?st.pts.slice(-2):st.pts;sc.beginPath();
 if(pts.length===1){sc.arc(pts[0][0],pts[0][1],st.size/2,0,Math.PI*2);sc.fill();}
 else{sc.moveTo(...pts[0]);for(let i=1;i<pts.length;i++)sc.lineTo(...pts[i]);sc.stroke();}
 sc.restore();sc.globalCompositeOperation='destination-in';const scale=w/RES;
 sc.drawImage(m.c,m.x*scale,m.y*scale,m.c.width*scale,m.c.height*scale);
 target.save();target.globalCompositeOperation=st.erase?'destination-out':'source-over';target.drawImage(scratch,0,0);target.restore();
}
function renderPaint(target,w){
 target.clearRect(0,0,w,w);
 Object.entries(state.fills).forEach(([id,color])=>fillRegion(target,id,color,w));
 state.strokes.forEach(st=>paintStroke(target,st,w));
}
function redraw(){renderPaint(ctx,RES);}
function markerSvg(){
 // The first coordinate is the exact nib tip: (0,0). The body extends down/right.
 const erase=state.tool==='eraser',color=erase?'#e7a7b0':state.color;
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 68 190"><path d="M0 0 L16 10 L5 20 Z" fill="'+(erase?'#e7a7b0':'#313833')+'"/><path d="M16 10 L32 32 L16 47 L5 20 Z" fill="#545c56"/><path d="M32 32 L43 47 L27 62 L16 47 Z" fill="#aab0a9"/><path d="M43 47 L67 151 Q75 181 52 188 Q34 192 28 170 L27 62 Z" fill="'+color+'" stroke="#313833" stroke-opacity=".18" stroke-width="1.5"/><path d="M40 58 L59 159" stroke="#fff" stroke-opacity=".4" stroke-width="5" stroke-linecap="round"/><path d="M28 65 L39 169" stroke="#000" stroke-opacity=".09" stroke-width="5"/><path d="M29 69 L48 64" stroke="#fff" stroke-opacity=".6" stroke-width="2"/></svg>';
}
function showMarker(e){
 if(!state.ready||state.tool==='fill'||(e.pointerType==='touch'&&state.pointer===null)){$('#marker').hidden=true;return;}
 const pt=point(e),r=$('#stage').getBoundingClientRect();$('#marker').hidden=false;
 $('#marker').style.left=pt[0]/VB*r.width+'px';$('#marker').style.top=pt[1]/VB*r.height+'px';
}
function fill(id){
 const before=snapshot();state.fills[id]=state.color;state.strokes=state.strokes.filter(s=>s.region!==id);
 redraw();action(before);pop(id);
}
$('#stage').addEventListener('contextmenu',e=>e.preventDefault());
$('#stage').addEventListener('pointerdown',e=>{
 if(!state.ready||state.pointer!==null||(e.pointerType==='mouse'&&e.button!==0)||!e.isPrimary)return;
 e.preventDefault();const pt=point(e),id=regionAt(pt);showMarker(e);
 if(id<0)return;
 if(state.tool==='fill'){fill(id);const r=$('#stage').getBoundingClientRect();sparkle(e.clientX-r.left,e.clientY-r.top);return;}
 state.pointer=e.pointerId;$('#stage').setPointerCapture(e.pointerId);
 state.current={color:state.color,size:state.size,erase:state.tool==='eraser',region:id,pts:[pt]};
 state.before=snapshot();paintStroke(ctx,state.current,RES,true);showMarker(e);
});
$('#stage').addEventListener('pointermove',e=>{
 showMarker(e);if(e.pointerId!==state.pointer||!state.current)return;e.preventDefault();
 const samples=e.getCoalescedEvents?.()||[e];
 for(const sample of samples.length?samples:[e]){
 const pt=point(sample),last=state.current.pts.at(-1);
 if(Math.hypot(pt[0]-last[0],pt[1]-last[1])<.5)continue;
 state.current.pts.push(pt);paintStroke(ctx,state.current,RES,true);
 }
});
function finishStroke(){
 if(state.pointer===null||!state.current)return;
 const st=state.current,before=state.before,pid=state.pointer;state.current=null;state.pointer=null;
 if($('#stage').hasPointerCapture(pid))$('#stage').releasePointerCapture(pid);
 state.strokes.push(st);
 // Assist only the color being applied, not earlier paint of another color.
 // A 62% sweep completes that region, while the mask keeps neighboring parts untouched.
 if(!st.erase){
 const b=state.bounds[st.region],pixels=ctx.getImageData(b.x,b.y,b.x2-b.x+1,b.y2-b.y+1).data;
 const rgb=st.color.match(/\w\w/g).map(x=>parseInt(x,16));let painted=0;
 for(let y=b.y;y<=b.y2;y++)for(let x=b.x;x<=b.x2;x++){
 if(state.map[y*RES+x]!==st.region)continue;const o=((y-b.y)*(b.x2-b.x+1)+x-b.x)*4;
 if(pixels[o+3]>220&&Math.abs(pixels[o]-rgb[0])<8&&Math.abs(pixels[o+1]-rgb[1])<8&&Math.abs(pixels[o+2]-rgb[2])<8)painted++;
 }
 if(painted/b.count>=.62){state.fills[st.region]=st.color;state.strokes=state.strokes.filter(s=>s.region!==st.region);
 const r=$('#stage').getBoundingClientRect(),pt=st.pts.at(-1);sparkle(pt[0]/VB*r.width,pt[1]/VB*r.height);pop(st.region);}
 }
 redraw();action(before);$('#marker').hidden=true;
}
$('#stage').addEventListener('pointerup',e=>{if(e.pointerId===state.pointer)finishStroke();});
$('#stage').addEventListener('pointercancel',e=>{if(e.pointerId===state.pointer)finishStroke();});
$('#stage').addEventListener('lostpointercapture',e=>{if(e.pointerId===state.pointer)finishStroke();});
$('#stage').addEventListener('pointerleave',()=>{if(state.pointer===null)$('#marker').hidden=true;});
function updateProgress(celebrate=true){
 if(!state.ready)return;
 const pixels=ctx.getImageData(0,0,RES,RES).data,painted=new Uint32Array(state.regions.length);
 for(let k=0;k<state.map.length;k++){const id=state.map[k];if(id>=0&&pixels[k*4+3]>220)painted[id]++;}
 // Background is optional: children can finish the picture on white paper, too.
 const visible=state.bounds.map((b,id)=>({b,id})).filter(x=>x.id!==state.background&&x.b.count>=12);
 const done=visible.filter(({b,id})=>painted[id]/b.count>.97).length;
 $('#progress-label').textContent=done+' / '+visible.length+' bahagian';$('#progress').max=visible.length||1;$('#progress').value=done;
 if(done<visible.length)state.celebrated=false;
 if(celebrate&&done===visible.length&&visible.length&&!state.celebrated){
 state.celebrated=true;const token=state.generation;[0,2,4].forEach((n,i)=>setTimeout(()=>{if(token===state.generation)pop(n);},i*120));
 setTimeout(()=>{if(token===state.generation&&state.celebrated){$('#complete-dialog').showModal();const r=$('#stage').getBoundingClientRect();sparkle(r.width/2,r.height/2,'#efb952',28);}},450);
 }
}
function magic(){
 if(!state.ready)return;finishStroke();const before=snapshot();state.strokes=[];
 state.bounds.forEach((b,i)=>{if(b.count)state.fills[i]=i===state.background?'#eaf2e9':COLORS[i%19][0];});redraw();action(before);pop(4);
}
function clearArt(){finishStroke();const before=snapshot();state.fills={};state.strokes=[];state.celebrated=false;redraw();action(before);toast('Sedia untuk warna baru!');}
async function compose(){
 const p=state.page,ink=state.ink,paint=canvas(1200);renderPaint(paint.getContext('2d'),1200);
 const base=await imageFrom(svgDoc(p)),out=canvas(1200),c=out.getContext('2d');
 c.fillStyle='#fff';c.fillRect(0,0,1200,1200);c.drawImage(base,0,0,1200,1200);c.drawImage(paint,0,0);c.drawImage(ink,0,0,1200,1200);return out;
}
function download(data,name){const a=document.createElement('a');a.href=data;a.download=name;document.body.append(a);a.click();a.remove();}
async function saveArt(){
 if(!state.ready)return;finishStroke();const p=state.page;
 try{
 const out=await compose();download(out.toDataURL('image/png'),'mewarna-'+p.id+'.png');
 const thumb=canvas(480,480);thumb.getContext('2d').drawImage(out,0,0,480,480);
 const list=read('bm.saved',[]);list.unshift({t:Date.now(),title:p.title,d:thumb.toDataURL('image/jpeg',.85)});
 const ok=write('bm.saved',list.slice(0,12));toast(ok?'Gambar disimpan! Lihat di Hasil Seni ♡':'Gambar dimuat turun. Galeri penuh.');pop(4);
 }catch(err){console.error(err);toast('Gagal simpan. Cuba sekali lagi.');}
}
function renderPalette(){
 $('#palette').replaceChildren();
 COLORS.forEach(([c,name])=>{const b=document.createElement('button');b.className='sw'+(state.color===c?' on':'');b.style.background=c;b.title=name;b.setAttribute('aria-label',name);b.setAttribute('aria-pressed',state.color===c);
 b.onclick=()=>{finishStroke();state.color=c;if(state.tool==='eraser')setTool('brush');renderPalette();};$('#palette').append(b);});
 $('#color-name').textContent=COLORS.find(c=>c[0]===state.color)?.[1]||'Warna pilihan sendiri';$('#custom').value=state.color;
 document.documentElement.style.setProperty('--paint',state.color);$('#marker').innerHTML=markerSvg();
 document.querySelectorAll('[data-icon="marker"]').forEach(el=>el.innerHTML=markerSvg());
}
function setTool(tool){
 finishStroke();state.tool=tool;$('#marker').hidden=true;$('#marker').innerHTML=markerSvg();
 document.querySelectorAll('[data-tool]').forEach(b=>{b.classList.toggle('on',b.dataset.tool===tool);b.setAttribute('aria-pressed',b.dataset.tool===tool);});
 $('#hint').textContent=tool==='fill'?'Sentuh satu bahagian untuk isi':tool==='eraser'?'Gosok untuk padam warna':'Warna kekal dalam garisan';
}
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
document.querySelector('[data-icon="bucket"]').innerHTML='<svg viewBox="0 0 40 40" fill="none"><path d="M12 9 30 26 19 36 3 20Z" fill="#efc460" stroke="#4d6254" stroke-width="2"/><path d="m6 18 13 12 9-6M14 5c10-9 21 4 13 12" stroke="#4d6254" stroke-width="2.5" stroke-linecap="round"/><path d="M34 24c-7 9-6 12-1 12s6-4 1-12Z" fill="#74b894"/></svg>';
document.querySelector('[data-icon="eraser"]').innerHTML='<svg viewBox="0 0 40 40"><path d="m5 24 15-18q2-2 4 0l12 10q2 2 0 4L21 37Z" fill="#e7a7b0" stroke="#4d6254" stroke-width="2"/><path d="m5 24 9-10 16 13-9 10Z" fill="#f5e8db" stroke="#4d6254" stroke-width="2"/></svg>';
$('#btn-back').onclick=gallery;$('#btn-undo').onclick=undo;$('#btn-redo').onclick=redo;$('#btn-magic').onclick=magic;$('#btn-save').onclick=saveArt;
$('#btn-clear').onclick=()=>{if(state.ready){finishStroke();$('#clear-dialog').showModal();}};
$('#btn-confirm-clear').onclick=()=>{$('#clear-dialog').close();clearArt();};$('#btn-cancel-clear').onclick=()=>$('#clear-dialog').close();
$('#btn-continue').onclick=()=>$('#complete-dialog').close();$('#btn-done-save').onclick=saveArt;
$('#btn-next').onclick=()=>{$('#complete-dialog').close();const next=PAGES[(PAGES.indexOf(state.page)+1)%PAGES.length];openPage(next);};
$('#size').oninput=()=>{state.size=+$('#size').value;$('#size-value').textContent=state.size;};
$('#custom').oninput=()=>{finishStroke();state.color=$('#custom').value;if(state.tool==='eraser')setTool('brush');renderPalette();};
function soundButton(){$('#btn-sound').textContent=state.sound?'♪':'♩';$('#btn-sound').setAttribute('aria-pressed',state.sound);$('#btn-sound').title=state.sound?'Tutup bunyi':'Buka bunyi';$('#btn-sound').setAttribute('aria-label',$('#btn-sound').title);}
$('#btn-sound').onclick=()=>{state.sound=!state.sound;write('bm.sound',state.sound);soundButton();if(state.sound)pop();};
document.addEventListener('keydown',e=>{if(!state.page||!(e.ctrlKey||e.metaKey)||['INPUT','TEXTAREA'].includes(e.target.tagName))return;
 if(e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}else if(e.key.toLowerCase()==='y'){e.preventDefault();redo();}});
window.addEventListener('resize',layout);if(window.visualViewport)visualViewport.addEventListener('resize',layout);
new ResizeObserver(layout).observe($('#drawing-area'));
document.addEventListener('visibilitychange',()=>{if(document.hidden){finishStroke();persist();}});
window.addEventListener('pagehide',()=>{finishStroke();persist();});
state.sound=read('bm.sound',true)!==false&&read('bm.sound',true)!==0;
soundButton();renderCats();renderGrid();renderPalette();setTool('brush');buttons();
$('#hero-picture').innerHTML=svgDoc(byId.boba||PAGES[0]);
const heroColors=['#79c6d3','#f0a0ba','#f4df83','#e0c5a3','#b4d891'];
$('#hero-picture').querySelectorAll('.r').forEach((el,i)=>el.style.fill=heroColors[i%heroColors.length]);
})();
