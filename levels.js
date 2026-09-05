(function (root) {
  'use strict';
  const BIOMES = [
    { name: 'Nad rozlewiskiem', sky: ['#25494c','#688377','#abb391'], hills: ['#526f66','#47695f','#345a52'], sun:'#e5ddb6', grass:'#879b65', accent:'#d8eb98' },
    { name: 'Wrzosowa dolina', sky: ['#383759','#857a99','#c5afbd'], hills: ['#77718c','#625d7b','#48455f'], sun:'#efdbd5', grass:'#a390b0', accent:'#edc2eb' },
    { name: 'Złote szuwary', sky: ['#59483d','#aa8560','#e0c997'], hills: ['#a18b62','#7e7950','#555d40'], sun:'#fff0bc', grass:'#b6aa65', accent:'#ffe1a0' },
    { name: 'Błękitne jeziora', sky: ['#254765','#719bab','#c3dad3'], hills: ['#668d9b','#4f7786','#355969'], sun:'#e7f4e7', grass:'#83aca4', accent:'#b9eeed' },
    { name: 'Różowy świt', sky: ['#684855','#b88989','#e6c3a9'], hills: ['#aa8d8b','#86767a','#5b5d65'], sun:'#fff1cd', grass:'#b6a084', accent:'#ffd2bd' },
    { name: 'Miętowe mokradła', sky: ['#214b46','#659d87','#bad3a9'], hills: ['#65937d','#4c7c65','#315a4d'], sun:'#e9efbb', grass:'#94b779', accent:'#c9f0ba' },
    { name: 'Srebrzysta noc', sky: ['#192b49','#485d7b','#8497af'], hills: ['#4d647f','#3b516d','#2a3d57'], sun:'#e2e9f4', grass:'#8a9fad', accent:'#cddffd' },
    { name: 'Miedziana jesień', sky: ['#523f40','#9d7665','#cfb58c'], hills: ['#96785e','#79664f','#514f40'], sun:'#f8dc9f', grass:'#b89760', accent:'#f4cf91' }
  ];
  const BASE = [
    {x:55,y:414,w:235,depth:64}, {x:390,y:315,w:185,depth:61},
    {x:758,y:385,w:238,depth:72}, {x:970,y:210,w:165,depth:51},
    {x:155,y:170,w:170,depth:50}, {x:575,y:125,w:140,depth:47}
  ];
  function random(seed) {
    let state = seed >>> 0;
    return () => {
      state += 0x6D2B79F5;
      let t = Math.imul(state ^ state >>> 15, 1 | state);
      t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function valid(platforms) {
    return platforms.length === 6 && platforms.every((p,i) =>
      p.x >= 24 && p.x+p.w <= 1176 && p.y >= 110 && p.y <= 446 && p.w >= 130 &&
      platforms.every((q,j) => i === j ||
        p.x+p.w+35 <= q.x || q.x+q.w+35 <= p.x || Math.abs(p.y-q.y) >= 110));
  }
  function biomeIndex(seed, level) {
    // A shuffled bag uses all eight palettes before repeating; no adjacent repeat.
    const rng = random(seed ^ 0xA341316C);
    let previous = -1, bag = [];
    for (let block = 0; block <= Math.floor((level-1)/BIOMES.length); block++) {
      bag = BIOMES.map((_,i)=>i);
      for (let i=bag.length-1;i>0;i--) {const j=Math.floor(rng()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
      if (bag[0]===previous) [bag[0],bag[1]]=[bag[1],bag[0]];
      previous=bag[bag.length-1];
    }
    return bag[(level-1)%BIOMES.length];
  }
  function generate(seed, level) {
    if (!Number.isInteger(level) || level<1 || level>100) throw new RangeError('Level must be 1–100');
    const rng=random((seed ^ Math.imul(level,0x9E3779B1)) >>> 0);
    const shift=level===1?0:18+Math.min(22,Math.floor(level/5));
    const mirror=level>1 && rng()<.5;
    let platforms;
    for (let attempt=0;attempt<40;attempt++) {
      platforms=BASE.map(p=>{
        const w=p.w+(level===1?0:Math.round((rng()-.5)*20));
        let x=p.x+Math.round((rng()-.5)*shift*2);
        const y=p.y+Math.round((rng()-.5)*Math.min(shift,30));
        if(mirror)x=1200-x-w;
        return {...p,x,y,w};
      });
      if(valid(platforms))break;
      platforms=null;
    }
    // Bounded rejection sampling always has a known playable fallback.
    if(!platforms)platforms=BASE.map(p=>({...p,x:mirror?1200-p.x-p.w:p.x}));
    const celebration=level%10===0;
    const types=['egg','flower','frog'];
    const theme=types[Math.floor(rng()*types.length)];
    platforms.forEach((p,i)=>{
      p.item={x:p.x+p.w*(i===0?.78:.35+rng()*.3),y:p.y-23,
        type:celebration?theme:types[Math.floor(rng()*types.length)],golden:celebration,collected:false};
    });
    return {platforms,biome:BIOMES[biomeIndex(seed,level)],celebration};
  }
  const api={generate,valid,BIOMES};
  if(typeof module==='object' && module.exports)module.exports=api;
  else root.BociaustLevels=api;
})(typeof globalThis!=='undefined'?globalThis:this);
