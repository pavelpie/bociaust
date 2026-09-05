const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const noop = () => {};
const elements = new Map();
const ctx = new Proxy({createLinearGradient: () => ({addColorStop: noop}), createRadialGradient: () => ({addColorStop: noop})}, {get: (o,k) => o[k] || noop, set: (o,k,v) => (o[k]=v,true)});
function element(id) {
  if (!elements.has(id)) elements.set(id, {textContent:'', innerHTML:'', classList:{add:noop,remove:noop}, setAttribute:noop, addEventListener:noop, focus:noop, getContext:()=>ctx, querySelector:s=>element(id+s)});
  return elements.get(id);
}
const sandbox = {document:{querySelector:element,querySelectorAll:()=>[],addEventListener:noop},window:{addEventListener:noop,devicePixelRatio:1},requestAnimationFrame:noop,HTMLButtonElement:class{},Math};
// Expose the simulation only in this isolated test context, never in the app.
const source = fs.readFileSync(`${__dirname}/game.js`,'utf8').replace('})();','globalThis.test={bird,keys,step,start,pause,draw,platforms};})();');
vm.runInNewContext(source,sandbox);
const t=sandbox.test;
const advance=n=>{for(let i=0;i<n;i++)t.step(1/120);};
t.start(); advance(120); assert.equal(t.bird.y,395); assert(t.bird.grounded);
t.keys.add('Space'); advance(60); assert(t.bird.y<350); assert(t.bird.vy<0);
t.keys.clear(); advance(400); assert(t.bird.grounded); assert.equal(t.bird.y,395);
t.keys.add('KeyD'); advance(60); assert(t.bird.x>200); assert(t.bird.vx>0);
t.pause(); const x=t.bird.x; advance(100); assert.equal(t.bird.x,x); assert.equal(t.keys.size,0); t.start();
Object.assign(t.bird,{x:1236,y:250,vx:0,vy:0}); advance(1); assert.equal(t.bird.x,-35);
Object.assign(t.bird,{x:600,y:620,vx:0,vy:200}); advance(1); assert.equal(t.bird.x,172); assert.equal(t.bird.y,395);
for(const p of t.platforms){Object.assign(t.bird,{x:p.x+p.w/2,y:p.y-21,vx:0,vy:200}); advance(4); assert.equal(t.bird.y,p.y-19); assert(t.bird.grounded);}
Object.assign(t.bird,{x:460,y:337,vx:0,vy:-250}); advance(25); assert(t.bird.y<315); assert(!t.bird.grounded);
t.draw();
console.log('PASS: resting, flight, gravity, steering, pause, wrap, respawn, all six platform landings, one-way passage, drawing smoke check.');
