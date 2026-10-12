const { chromium } = require('playwright');
const fs = require('fs'), assert=require('assert');
const path=require('path'), out=path.resolve(process.env.BM_OUTPUT||path.join(__dirname,'../shots'));
fs.mkdirSync(out,{recursive:true});
const results={},errors=[];
(async()=>{
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const ready=async()=>page.waitForSelector('#stage.ready');
const vb=async(x,y)=>page.evaluate(([x,y])=>{const m=document.querySelector('#art').getScreenCTM();const p=new DOMPoint(x,y).matrixTransform(m);return{x:p.x,y:p.y};},[x,y]);
const g=async(x,y)=>vb(32+.84*x,32+.84*y);
const pixels=()=>page.evaluate(()=>{const c=document.querySelector('#brush'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>220)n++;return n;});
await page.goto(process.env.BM_URL||'http://127.0.0.1:8450/',{waitUntil:'networkidle'});
assert.equal(await page.locator('#grid .card').count(),32);
results.gallery=32;
await page.screenshot({path:path.join(out,'preview-koleksi-phone.png')});
await page.locator('[data-page="boba"]').click();await ready();
await page.screenshot({path:path.join(out,'preview-mewarna-phone.png')});
let pt=await g(200,220);
const expectedId=await page.evaluate(({x,y})=>document.elementFromPoint(x,y).dataset.i,pt);
assert.notEqual(expectedId,undefined);
await page.mouse.move(pt.x,pt.y);await page.mouse.down();
assert.equal(await page.locator('#marker').isVisible(),true);
let alignment=await page.evaluate(({x,y})=>{const r=document.querySelector('#marker').getBoundingClientRect(),s=document.querySelector('#stage').getBoundingClientRect(),m=document.querySelector('#marker');return Math.hypot(s.x+parseFloat(m.style.left)-x,s.y+parseFloat(m.style.top)-y);},pt);
assert(alignment<.1);results.nib_alignment_error_px=alignment;
await page.mouse.up();
assert(await pixels()>100);
const centroid=await page.evaluate(()=>{const c=document.querySelector('#brush'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0,x=0,y=0;for(let k=0;k<c.width*c.height;k++)if(d[k*4+3]>220){n++;x+=k%c.width;y+=Math.floor(k/c.width);}return[x/n/2,y/n/2];});
assert(Math.abs(centroid[0]-200)<1&&Math.abs(centroid[1]-216.8)<1);results.dot_at_touch=true;
await page.locator('#btn-undo').click();assert.equal(await pixels(),0);
await page.locator('#btn-redo').click();assert(await pixels()>100);
results.undo_redo=true;
await page.mouse.move(pt.x,pt.y);await page.mouse.down();
let end=await g(390,220);await page.mouse.move(end.x,end.y,{steps:30});
await page.screenshot({path:path.join(out,'preview-berus-snap.png')});await page.mouse.up();
const leaking=await page.evaluate(id=>{
 const art=document.querySelector('#art'),m=art.getScreenCTM(),c=document.querySelector('#brush'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
 const ink=document.querySelector('#outline-holder canvas'),inkData=ink.getContext('2d').getImageData(0,0,ink.width,ink.height).data;let checked=0,leaks=0,underInk=0;
 for(let y=0;y<c.height;y+=4)for(let x=0;x<c.width;x+=4){if(d[(y*c.width+x)*4+3]<220)continue;
 const p=new DOMPoint((x+.5)/2,(y+.5)/2).matrixTransform(m),el=document.elementFromPoint(p.x,p.y);
 checked++;if(el?.dataset?.i!==id){const ix=Math.floor((x+.5)*ink.width/c.width),iy=Math.floor((y+.5)*ink.height/c.height);if(inkData[(iy*ink.width+ix)*4+3]>0)underInk++;else leaks++;}}
 return{checked,leaks,underInk};
},expectedId);
assert.equal(leaking.leaks,0);results.clipping=leaking;
await page.locator('#btn-undo').click();await page.locator('#btn-undo').click();assert.equal(await pixels(),0);
// Real touch events through Chromium's device emulation.
await page.touchscreen.tap(pt.x,pt.y);assert(await pixels()>0);results.real_touch=true;
await page.locator('[data-tool="fill"]').click();await page.touchscreen.tap(pt.x,pt.y);
assert.match(await page.locator('#progress-label').textContent(),/^1 \/ /);
const filled=await pixels();
await page.locator('[data-tool="eraser"]').click();await page.mouse.move(pt.x,pt.y);await page.mouse.down();await page.mouse.up();
assert(await pixels()<filled);results.eraser_removes_fill=true;
await page.locator('#btn-undo').click();assert.equal(await pixels(),filled);
await page.locator('#btn-back').click();await page.locator('[data-page="boba"]').click();await ready();assert.equal(await pixels(),filled);
await page.reload();await page.locator('[data-page="boba"]').click();await ready();assert.equal(await pixels(),filled);results.draft_restored=true;
await page.locator('#btn-clear').click();await page.locator('#btn-confirm-clear').click();assert.equal(await pixels(),0);
await page.locator('[data-tool="brush"]').click();
await page.locator('#size').fill('64');await page.locator('#size').dispatchEvent('input');
pt=await g(200,220);await page.mouse.move(pt.x,pt.y);await page.mouse.down();
for(let y=185;y<350;y+=16){let a=await g(95,y),b=await g(305,y);await page.mouse.move(a.x,a.y);await page.mouse.move(b.x,b.y,{steps:7});}
await page.mouse.up();
assert.match(await page.locator('#progress-label').textContent(),/^1 \/ /);results.assisted_snap=true;
await page.locator('#btn-magic').click();await page.waitForSelector('#complete-dialog[open]');
results.completion=true;await page.screenshot({path:path.join(out,'preview-siap.png')});
await page.locator('#btn-continue').click();await page.screenshot({path:path.join(out,'preview-berwarna-phone.png')});
const dlPromise=page.waitForEvent('download');await page.locator('#btn-save').click();const dl=await dlPromise;
await dl.saveAs(path.join(out,'contoh-boba.png'));assert.equal(dl.suggestedFilename(),'mewarna-boba.png');
const png=fs.readFileSync(path.join(out,'contoh-boba.png'));assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),1200);results.export_size='1200x1200';
await page.waitForFunction(()=>JSON.parse(localStorage.getItem('bm.saved')||'[]').length===1);
results.export=dl.suggestedFilename();
await page.locator('#btn-undo').click();await page.locator('#btn-magic').click();await page.waitForSelector('#complete-dialog[open]');
await page.locator('#btn-next').click();await ready();assert.equal(await page.locator('#title').textContent(),'Burger Sedap');results.next_page=true;
for(const [w,h] of [[320,568],[390,667],[412,915],[844,390],[1366,900]]){
 await page.setViewportSize({width:w,height:h});await page.waitForTimeout(150);
 const bounds=await page.evaluate(()=>{const ids=['#stage','#tools','#bar'];const boxes=ids.map(s=>{const r=document.querySelector(s).getBoundingClientRect();return{selector:s,x:r.x,y:r.y,right:r.right,bottom:r.bottom};});return{boxes,overflow:document.documentElement.scrollWidth>innerWidth};});
 assert(!bounds.overflow);for(const r of bounds.boxes){assert(r.x>=-1&&r.right<=w+1&&r.bottom<=h+1,'layout '+w+' '+JSON.stringify(r));}
 results['layout_'+w+'x'+h]='fits';
}
await page.locator('#btn-back').click();await page.setViewportSize({width:1366,height:900});await page.screenshot({path:path.join(out,'preview-koleksi-desktop.png')});
for(const p of await page.evaluate(()=>window.PAGES.map(p=>({id:p.id,title:p.title})))){
 await page.locator('[data-page="'+p.id+'"]').click();await ready();
 const n=await page.locator('#art .r').count();assert(n>0,p.id+' has regions');await page.locator('#btn-back').click();
}
results.original_and_new_pages_loaded=32;

assert.equal(await page.locator('#cats .chip', {hasText:'Mandala'}).count(),0);
assert.equal(await page.locator('[data-page^="mandala"]').count(),0);results.no_mandala=true;
await page.setViewportSize({width:390,height:844});
await page.locator('[data-page="boba"]').click();await ready();
await page.locator('#btn-clear').click();await page.locator('#btn-confirm-clear').click();
const rgba=async(x,y)=>page.evaluate(([x,y])=>Array.from(document.querySelector('#brush').getContext('2d').getImageData(Math.floor(x*2),Math.floor(y*2),1,1).data),[x,y]);
const backgroundPoint=await vb(30,200),objectPoint=await g(200,220);
await page.locator('[data-tool="brush"]').click();
await page.mouse.move(backgroundPoint.x,backgroundPoint.y);await page.mouse.down();
let across=await vb(370,200);await page.mouse.move(across.x,across.y,{steps:30});await page.mouse.up();
assert.equal((await rgba(30,200))[3],255);assert.equal((await rgba(200,200))[3],0);
await page.locator('#btn-undo').click();assert.equal(await pixels(),0);
await page.locator('#btn-redo').click();assert.equal((await rgba(30,200))[3],255);
results.background_brush_clipped=true;
await page.locator('[data-tool="fill"]').click();await page.locator('#palette .sw').nth(7).click();
await page.touchscreen.tap(backgroundPoint.x,backgroundPoint.y);
assert.deepEqual(await rgba(30,200),[119,196,217,255]);assert.equal((await rgba(200,216.8))[3],0);
assert.equal(await page.locator('#progress').evaluate(el=>el.value),0);
await page.locator('#palette .sw').nth(0).click();await page.touchscreen.tap(objectPoint.x,objectPoint.y);
assert.deepEqual(await rgba(200,216.8),[237,113,144,255]);assert.deepEqual(await rgba(30,200),[119,196,217,255]);
await page.locator('#btn-undo').click();assert.equal((await rgba(200,216.8))[3],0);assert.deepEqual(await rgba(30,200),[119,196,217,255]);
await page.locator('#btn-redo').click();
await page.locator('[data-tool="eraser"]').click();await page.touchscreen.tap(backgroundPoint.x,backgroundPoint.y);
assert.equal((await rgba(30,200))[3],0);assert.deepEqual(await rgba(200,216.8),[237,113,144,255]);
await page.locator('#btn-undo').click();assert.deepEqual(await rgba(30,200),[119,196,217,255]);
results.background_fill_eraser_undo=true;
await page.reload();await page.locator('[data-page="boba"]').click();await ready();
assert.deepEqual(await rgba(30,200),[119,196,217,255]);assert.deepEqual(await rgba(200,216.8),[237,113,144,255]);
results.background_draft_restored=true;
await page.screenshot({path:path.join(out,'preview-background.png')});
const bgDownload=page.waitForEvent('download');await page.locator('#btn-save').click();const bgFile=await bgDownload;
const bgPath=path.join(out,'background-export.png');await bgFile.saveAs(bgPath);
const pngColors=await page.evaluate(async b64=>{
 const img=new Image();img.src='data:image/png;base64,'+b64;await img.decode();
 const c=document.createElement('canvas');c.width=c.height=1200;c.getContext('2d').drawImage(img,0,0);
 return [[90,600],[600,650]].map(([x,y])=>Array.from(c.getContext('2d').getImageData(x,y,1,1).data));
},fs.readFileSync(bgPath).toString('base64'));
assert.deepEqual(pngColors,[[119,196,217,255],[237,113,144,255]]);results.background_png_export=true;
const legacyDraft=await page.evaluate(()=>{
 const old=JSON.parse(localStorage.getItem('bm.draft.boba'));const bg=document.querySelector('.background-region').dataset.i;
 delete old.fills[bg];old.strokes=old.strokes.filter(s=>String(s.region)!==bg);return JSON.stringify(old);
});
// Seed after pagehide's automatic save, before the next page reads its draft.
await page.addInitScript(draft=>localStorage.setItem('bm.draft.boba',draft),legacyDraft);
await page.reload();await page.locator('[data-page="boba"]').click();await ready();
assert.equal((await rgba(30,200))[3],0);assert.deepEqual(await rgba(200,216.8),[237,113,144,255]);
results.legacy_draft_keeps_region_ids=true;
assert.deepEqual(errors,[]);results.console_errors=errors;
fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
