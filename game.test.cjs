const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const noop = () => {};
const elements = new Map();
const ctx = new Proxy({createLinearGradient: () => ({addColorStop: noop}), createRadialGradient: () => ({addColorStop: noop})}, {get: (o,k) => o[k] || noop, set: (o,k,v) => (o[k]=v,true)});
function element(id) {
  if (!elements.has(id)) elements.set(id, {textContent:'', innerHTML:'', classList:{add:noop,remove:noop}, setAttribute:noop, handlers:{}, addEventListener(event,handler){this.handlers[event]=handler;}, focus:noop, getContext:()=>ctx, querySelector:s=>element(id+s)});
  return elements.get(id);
}
const sandbox = {BociaustLevels:require('./levels.js'),document:{querySelector:element,querySelectorAll:()=>[],addEventListener:noop},window:{addEventListener:noop,devicePixelRatio:1},requestAnimationFrame:noop,HTMLButtonElement:class{},Math};
// Expose the simulation only in this isolated test context, never in the app.
const source = fs.readFileSync(`${__dirname}/game.js`,'utf8').replace('})();','globalThis.test={bird,keys,step,start,pause,draw,platforms,loadLevel,formatTime,getState:()=>({level,mode,levelTime,collected,transitionTime,results:[...results]})};})();');
vm.runInNewContext(source,sandbox);
const t=sandbox.test;
const advance=n=>{for(let i=0;i<n;i++)t.step(1/120);};
t.start(); advance(120); assert.equal(t.bird.y,395); assert(t.bird.grounded);
t.keys.add('Space'); advance(60); assert(t.bird.y<350); assert(t.bird.vy<0);
t.keys.clear(); advance(400); assert(t.bird.grounded); assert.equal(t.bird.y,395);
t.keys.add('KeyD'); advance(60); assert(t.bird.x>200); assert(t.bird.vx>0);
t.pause(); const x=t.bird.x; advance(100); assert.equal(t.bird.x,x); assert.equal(t.keys.size,0); t.start();
Object.assign(t.bird,{x:1236,y:250,vx:0,vy:0}); advance(1); assert.equal(t.bird.x,-35);
Object.assign(t.bird,{x:600,y:620,vx:0,vy:200}); advance(1); assert.equal(t.bird.x,172.5); assert.equal(t.bird.y,395);
for(const p of t.platforms){Object.assign(t.bird,{x:p.x+p.w/2,y:p.y-21,vx:0,vy:200}); advance(4); assert.equal(t.bird.y,p.y-19); assert(t.bird.grounded);}
Object.assign(t.bird,{x:460,y:337,vx:0,vy:-250}); advance(25); assert(t.bird.y<315); assert(!t.bird.grounded);
t.draw();
console.log('PASS: resting, flight, gravity, steering, pause, wrap, respawn, all six platform landings, one-way passage, drawing smoke check.');

// Test event timing and lifecycle separately from subjective sound quality.
const played = [];
const param = () => ({value:0,setValueAtTime:noop,linearRampToValueAtTime:noop,exponentialRampToValueAtTime:noop});
function audioNode(kind) {
  return {gain:param(),frequency:param(),Q:param(),playbackRate:param(),connect:noop,disconnect:noop,
    start(){played.push(this);},stop(){this.stopped=true;},kind};
}
let contexts = 0;
sandbox.window.AudioContext = class {
  constructor(){contexts++;this.state='running';this.currentTime=0;this.sampleRate=44100;this.destination={};}
  createGain(){return audioNode('gain');}
  createBiquadFilter(){return audioNode('filter');}
  createBuffer(){return {getChannelData:()=>new Float32Array(13230)};}
  createBufferSource(){return audioNode('wing');}
  createOscillator(){return audioNode('takeoff');}
};
assert.equal(contexts,0);
t.start(); assert.equal(contexts,1);
Object.assign(t.bird,{x:172,y:395,vx:0,vy:0,grounded:true});
t.keys.add('Space'); advance(1);
assert.deepEqual(played.map(n=>n.kind),['wing','takeoff']);
advance(60);
assert.equal(played.filter(n=>n.kind==='takeoff').length,1);
assert(played.filter(n=>n.kind==='wing').length>=3);
element('#sound').handlers.click();
const mutedCount=played.length; advance(60); assert.equal(played.length,mutedCount);
element('#sound').handlers.click(); advance(24); assert(played.length>mutedCount);
t.pause(); const pausedCount=played.length; advance(60); assert.equal(played.length,pausedCount);
t.start(); assert.equal(contexts,1);
console.log('PASS: audio initialized on start, takeoff once, repeated wing beats, mute/unmute, pause, single AudioContext. Audio output requires a browser listening check.');

// End-to-end campaign state flow, with contact positions supplied by the test.
t.keys.clear();t.loadLevel(1);
const item=t.platforms[0].item;
Object.assign(t.bird,{x:item.x,y:item.y,vx:0,vy:0});
let soundCount=played.length;advance(1);
assert.equal(t.getState().collected,1);assert.equal(played.length,soundCount+2);
advance(1);assert.equal(t.getState().collected,1);assert.equal(played.length,soundCount+2);
// A fall preserves pickups and elapsed time, unlike an explicit level retry.
Object.assign(t.bird,{x:600,y:620,vx:0,vy:200});advance(1);assert.equal(t.getState().collected,1);
t.pause();const frozen=t.getState().levelTime;advance(120);assert.equal(t.getState().levelTime,frozen);t.start();
element('#reset').handlers.click();assert.equal(t.getState().collected,0);assert.equal(t.getState().levelTime,0);
for(let number=1;number<=100;number++) {
  assert.equal(t.getState().level,number);
  for(const p of t.platforms){Object.assign(t.bird,{x:p.item.x,y:p.item.y,vx:0,vy:0});advance(1);}
  const state=t.getState();
  assert.equal(state.collected,6);assert.equal(state.results.length,number);
  assert.equal(state.mode,number===100?'finished':'transition');
  const finalTime=state.levelTime;advance(10);assert.equal(t.getState().levelTime,finalTime);
  if(number===1) {
    t.pause();const remaining=t.getState().transitionTime;advance(600);assert.equal(t.getState().transitionTime,remaining);
    t.start();assert.equal(t.getState().mode,'transition');
  }
  if(number<100){advance(421);assert.equal(t.getState().mode,'playing');assert.equal(t.getState().collected,0);}
}
advance(1200);assert.equal(t.getState().level,100);assert.equal(t.getState().mode,'finished');
assert.equal(t.getState().results.length,100);assert(t.getState().results.every(n=>n>0));
t.start();assert.equal(t.getState().level,1);assert.equal(t.getState().results.length,0);
assert.equal(t.formatTime(65.29),'01:05.2');
t.draw();
console.log('PASS: collectible sound once, respawn preserves progress, retry, timer pause, summary pause, automatic levels 1–100, final summary and fresh campaign.');
