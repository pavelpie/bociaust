(() => {
  'use strict';
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const overlay = document.querySelector('#overlay');
  const status = document.querySelector('#status');
  const altitude = document.querySelector('#altitude b');
  const pauseButton = document.querySelector('#pause');
  const soundButton = document.querySelector('#sound');
  const levelLabel = document.querySelector('#level');
  const collectionLabel = document.querySelector('#collection');
  const timerLabel = document.querySelector('#timer');
  const biomeLabel = document.querySelector('#biome');
  // Create audio only after a user gesture (also works on touch devices).
  let audioContext, masterGain, wingNoise, muted = false;
  const voices = new Set();
  function unlockAudio() {
    if (muted) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    try {
      if (!audioContext) {
        audioContext = new Audio();
        masterGain = audioContext.createGain();
        masterGain.gain.value = .45;
        masterGain.connect(audioContext.destination);
        wingNoise = audioContext.createBuffer(1, Math.ceil(audioContext.sampleRate * .3), audioContext.sampleRate);
        const data = wingNoise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    } catch { /* Audio is optional; playback restrictions must not stop the game. */ }
  }
  function stopSounds() {
    for (const source of voices) {
      source.stop();
      source.disconnect();
    }
    voices.clear();
  }
  function playWingSound(takeoff) {
    if (muted || !wingNoise || audioContext.state !== 'running') return;
    const now = audioContext.currentTime;
    const duration = takeoff ? .24 : .14;
    const source = audioContext.createBufferSource();
    source.buffer = wingNoise;
    source.playbackRate.value = .94 + Math.random() * .12;
    const filter = audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = .65;
    filter.frequency.setValueAtTime(takeoff ? 1300 : 950, now);
    filter.frequency.exponentialRampToValueAtTime(220, now + duration);
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(takeoff ? .5 : .3, now + .018);
    gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    source.connect(filter); filter.connect(gain); gain.connect(masterGain);
    voices.add(source);
    source.onended = () => { voices.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(now); source.stop(now + duration);
    if (takeoff) {
      // A soft, rising pulse distinguishes the push away from the platform.
      const pulse = audioContext.createOscillator();
      const envelope = audioContext.createGain();
      pulse.type = 'sine';
      pulse.frequency.setValueAtTime(145, now);
      pulse.frequency.exponentialRampToValueAtTime(310, now + .14);
      envelope.gain.setValueAtTime(0, now);
      envelope.gain.linearRampToValueAtTime(.19, now + .012);
      envelope.gain.exponentialRampToValueAtTime(.001, now + .18);
      pulse.connect(envelope); envelope.connect(masterGain);
      voices.add(pulse);
      pulse.onended = () => { voices.delete(pulse); pulse.disconnect(); envelope.disconnect(); };
      pulse.start(now); pulse.stop(now + .19);
    }
  }
  function playCollectSound(type, complete) {
    if (muted || !audioContext || audioContext.state !== 'running' || !masterGain) return;
    const base = {egg:660,flower:784,frog:523}[type];
    const notes = complete ? [1,1.25,1.5,2] : [1,1.5];
    notes.forEach((ratio,i) => {
      const now = audioContext.currentTime + i*.075;
      const tone=audioContext.createOscillator(), gain=audioContext.createGain();
      tone.type='sine'; tone.frequency.setValueAtTime(base*ratio,now);
      gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.18,now+.008);
      gain.gain.exponentialRampToValueAtTime(.001,now+.22);
      tone.connect(gain);gain.connect(masterGain);voices.add(tone);
      tone.onended=()=>{voices.delete(tone);tone.disconnect();gain.disconnect();};
      tone.start(now);tone.stop(now+.23);
    });
  }
  soundButton.addEventListener('click', () => {
    muted = !muted;
    if (muted) stopSounds(); else unlockAudio();
    if (masterGain) masterGain.gain.value = muted ? 0 : .45;
    soundButton.innerHTML = muted ? '♫ <span>Dźwięk wył.</span>' : '♫ <span>Dźwięk wł.</span>';
    soundButton.setAttribute('aria-pressed', String(muted));
    soundButton.setAttribute('aria-label', muted ? 'Włącz dźwięk' : 'Wycisz dźwięk');
    canvas.focus({preventScroll:true});
  });
  const W = 1200, H = 580;
  const platforms = [];
  let seed = Math.floor(Math.random()*4294967296), level = 1, biome;
  let levelTime = 0, results = [], collected = 0, transitionTime = 0, resumeMode = 'playing';
  const keys = new Set();
  let mode = 'ready', time = 0, last = 0, accumulator = 0, flapClock = 0;
  let particles = [];
  const bird = { x: 172, y: 395, vx: 0, vy: 0, facing: 1, grounded: true, wing: 0 };
  // Deterministic decoration keeps scenery stable across frames and resets.
  const noise = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  function formatTime(seconds) {
    const tenths=Math.floor(seconds*10+1e-7);
    return `${String(Math.floor(tenths/600)).padStart(2,'0')}:${String(Math.floor(tenths/10)%60).padStart(2,'0')}.${tenths%10}`;
  }
  function updateHud() {
    // Avoid repeatedly announcing unchanged live-region counters.
    const values=[
      [levelLabel,`POZIOM ${String(level).padStart(2,'0')} / 100`],
      [collectionLabel,`ZEBRANE ${collected} / ${platforms.length}`],
      [timerLabel,formatTime(levelTime)], [biomeLabel,biome.name.toUpperCase()]
    ];
    for(const [element,value] of values)if(element.textContent!==value)element.textContent=value;
  }
  function loadLevel(number) {
    const generated=BociaustLevels.generate(seed,number);
    level=number;biome=generated.biome;
    platforms.splice(0,platforms.length,...generated.platforms);
    levelTime=0;collected=0;transitionTime=0;keys.clear();resetBird();updateHud();
    document.querySelector('#scene-detail').textContent=generated.celebration?'Złoty przystanek · zbierz cały komplet':'Zbierz przedmiot z każdej platformy';
    status.textContent=generated.celebration?'ZŁOTY PRZYSTANEK':'ZBIERZ WSZYSTKIE SKARBY';
  }
  function showOverlay(title,description,button,hint) {
    overlay.classList.remove('hidden');
    overlay.querySelector('h2').textContent=title;
    overlay.querySelector('p').innerHTML=description;
    overlay.querySelector('button').textContent=button;
    overlay.querySelector('small').textContent=hint;
  }
  function showSummary() {
    const total=results.reduce((sum,value)=>sum+value,0);
    const complete=level===100;
    showOverlay(complete?'Sto poziomów. Piękny lot.':`Poziom ${level} zebrany!`,
      `Komplet ${collected} / ${platforms.length} · czas <strong>${formatTime(levelTime)}</strong><br>`+
      `Łączny czas lotu: <strong>${formatTime(total)}</strong>`+
      (complete?`<br>Średnio na poziom: ${formatTime(total/100)}`:''),
      complete?'Nowa wyprawa ↗':'Następny poziom ↗',
      complete?'Wszystkie 600 przedmiotów zebrane.':`Kolejny przystanek za ${Math.ceil(transitionTime)} s · P — pauza`);
  }
  function collectItems() {
    for(const p of platforms) {
      const item=p.item;
      if(item.collected || Math.abs(bird.x-item.x)>28 || Math.abs(bird.y-item.y)>27)continue;
      item.collected=true;collected++;
      burst(item.x,item.y,14,item.golden?'#ffe298':biome.accent);
      playCollectSound(item.type,collected===platforms.length);
      if(collected===platforms.length) {
        results.push(levelTime);keys.clear();
        mode=level===100?'finished':'transition';transitionTime=3.5;
        showSummary();
      }
    }
  }
  function path(points, fill) {
    ctx.beginPath(); points.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.closePath();ctx.fillStyle=fill;ctx.fill();
  }
  function ellipse(x,y,rx,ry,color) {ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
  function background() {
    const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,biome.sky[0]);sky.addColorStop(.65,biome.sky[1]);sky.addColorStop(1,biome.sky[2]);ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    const glow=ctx.createRadialGradient(908,133,5,908,133,210);glow.addColorStop(0,'#e5dfab29');glow.addColorStop(1,'#e5dfab00');ctx.fillStyle=glow;ctx.fillRect(650,0,550,400);
    ellipse(908,133,42,42,biome.sun);ellipse(908,133,53,53,'#e8dfb90a');
    for(let i=0;i<8;i++){let x=(noise(i)*1400+time*(2+i%3))%1450-125;let y=70+noise(i+17)*220;ellipse(x,y,75+noise(i+2)*90,3+noise(i+5)*6,'#c4d0b50a');}
    for(let layer=0;layer<3;layer++){
      const base=325+layer*73, points=[[0,H],[0,base]];
      for(let x=0;x<=W+20;x+=20)points.push([x,base+Math.sin(x*.006+layer*3)*26+Math.sin(x*.015+layer)*12]);
      points.push([W,H]);path(points,biome.hills[layer]);
      for(let i=0;i<35;i++){let x=noise(i+layer*78)*W,y=base+Math.sin(x*.006+layer*3)*26+Math.sin(x*.015+layer)*12;let h=13+noise(i+91)*35;path([[x-5,y+4],[x,y-h],[x+6,y+4]],biome.hills[layer]);}
    }
    ctx.fillStyle='#77978435';ctx.fillRect(0,514,W,66);
    for(let i=0;i<45;i++){ctx.fillStyle='#cbd4aa12';ctx.fillRect(noise(i+300)*W,523+noise(i+400)*53,15+noise(i+90)*65,1);}
    // Distant birds.
    ctx.strokeStyle='#cee0c34a';ctx.lineWidth=1.2;
    for(let i=0;i<5;i++){let x=620+i*22+Math.sin(time*.2)*10,y=207+Math.sin(i*2)*13;ctx.beginPath();ctx.moveTo(x-5,y);ctx.quadraticCurveTo(x-2,y-4,x,y);ctx.quadraticCurveTo(x+2,y-4,x+5,y);ctx.stroke();}
    for(let i=0;i<32;i++){let x=noise(i+500)*W;let y=H;ctx.strokeStyle='#193e39';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x-5,y-20,x+Math.sin(time+i)*3,y-20-noise(i+550)*32);ctx.stroke();}
  }
  function platform(p,index) {
    const {x,y,w,depth:d}=p;
    ellipse(x+w/2,y+d+13,w*.43,7,'#163d3320');
    path([[x,y+3],[x+w,y+3],[x+w-13,y+20],[x+w*.73,y+d*.63],[x+w*.57,y+d],[x+w*.38,y+d*.73],[x+22,y+29]],'#334c41');
    path([[x+15,y+9],[x+w*.48,y+9],[x+w*.38,y+d*.73],[x+22,y+29]],'#465b47');
    path([[x+w*.48,y+9],[x+w-5,y+9],[x+w*.73,y+d*.63],[x+w*.57,y+d]],'#293f37');
    path([[x-3,y],[x+12,y-7],[x+w-16,y-7],[x+w+4,y],[x+w-4,y+8],[x+7,y+10]],biome.grass);
    ctx.fillStyle='#b3be80';ctx.fillRect(x+9,y-5,w-24,3);
    for(let i=0;i<Math.floor(w/11);i++) {const gx=x+8+i*11,gh=3+noise(i+index*20)*10;ctx.strokeStyle=i%3?'#9cad72':'#c6c88d';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(gx,y-4);ctx.lineTo(gx-2,y-gh-4);ctx.moveTo(gx,y-4);ctx.lineTo(gx+3,y-gh*.7-4);ctx.stroke();}
    for(let i=0;i<3;i++){let vx=x+w*(.2+i*.27);ctx.strokeStyle='#688358';ctx.beginPath();ctx.moveTo(vx,y+8);ctx.quadraticCurveTo(vx-5,y+24,vx+2,y+25+noise(index+i)*18);ctx.stroke();ellipse(vx-2,y+18,3,2,'#829464');}
    if(index===0){for(let i=0;i<9;i++){ctx.strokeStyle=i%2?'#b59c6c':'#736c4a';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x+w/2,y-3,24-i,5,0,0,Math.PI);ctx.stroke();}}
  }
  function collectible(p,index) {
    const item=p.item;
    if(item.collected) {
      ctx.strokeStyle=biome.accent;ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(item.x-4,p.y-15);ctx.lineTo(item.x-1,p.y-12);ctx.lineTo(item.x+5,p.y-19);ctx.stroke();
      return;
    }
    const x=item.x,y=item.y+Math.sin(time*2+index)*2;
    ellipse(x,y,19,19,item.golden?'#ffe29826':'#eff4d519');
    if(item.type==='egg') {
      ellipse(x,y,8,11,item.golden?'#ffe298':'#f4edd7');
      ellipse(x-2,y-4,2,3,'#fff9eb');ellipse(x+3,y+3,1.5,2,'#b6a68c');
    } else if(item.type==='flower') {
      ctx.strokeStyle='#99c779';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+12);ctx.stroke();
      ellipse(x+4,y+7,4,2,'#99c779');
      for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ellipse(x+Math.cos(a)*6,y+Math.sin(a)*6,4,4,item.golden?'#ffe298':'#f1c8e4');}
      ellipse(x,y,3,3,'#f2c572');
    } else {
      const color=item.golden?'#e7cb73':'#a5cc79';
      ellipse(x-8,y+6,5,3,color);ellipse(x+8,y+6,5,3,color);ellipse(x,y+1,10,7,color);
      ellipse(x-5,y-5,4,4,color);ellipse(x+5,y-5,4,4,color);
      ellipse(x-5,y-6,1.4,1.8,'#263b37');ellipse(x+5,y-6,1.4,1.8,'#263b37');
    }
  }
  function stork() {
    ctx.save();ctx.translate(bird.x,bird.y);ctx.scale(bird.facing,1);ctx.rotate(Math.max(-.15,Math.min(.15,bird.vx/1400)));
    // Red legs, white body, black flight feathers and the unmistakable long beak.
    ctx.strokeStyle='#df785c';ctx.lineWidth=2;ctx.lineCap='round';
    for(let i=0;i<2;i++){let lx=i*6-3;ctx.beginPath();ctx.moveTo(lx,7);ctx.lineTo(lx-(bird.grounded?0:9),17);ctx.lineTo(lx+(bird.grounded?5:-13),18);ctx.stroke();}
    path([[-13,-3],[-26,-5],[-21,3],[-9,6]],'#172d30');
    ellipse(0,0,17,10,'#eceddc');
    ctx.strokeStyle='#f4f1de';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(11,0);ctx.quadraticCurveTo(20,-3,19,-19);ctx.stroke();
    ellipse(21,-20,7,6,'#f5f0db');path([[26,-22],[49,-17],[26,-17]],'#e58b61');ellipse(23,-22,1.4,1.4,'#172b2c');
    const lift=bird.grounded?-2:Math.sin(bird.wing)*19;
    path([[7,-3],[-3,-11-lift],[-23,-14-lift],[-16,-3],[-7,6]],'#1c3032');
    path([[8,-4],[-2,-13-lift],[-15,-12-lift],[-10,-1],[0,4]],'#d9e0d1');
    ctx.restore();
  }
  function burst(x,y,count,color) {for(let i=0;i<count;i++)particles.push({x,y,vx:(noise(i+time)*2-1)*45,vy:-10-noise(i+time+9)*35,life:.65,max:.65,color});}
  function step(dt) {
    time+=dt;
    if(mode==='transition') {
      transitionTime=Math.max(0,transitionTime-dt);
      if(transitionTime<=0){loadLevel(level+1);mode='playing';overlay.classList.add('hidden');}
      else overlay.querySelector('small').textContent=`Kolejny przystanek za ${Math.ceil(transitionTime)} s · P — pauza`;
      return;
    }
    if(mode!=='playing')return;
    levelTime+=dt;
    const direction=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA'));
    bird.vx+=direction*620*dt;bird.vx*=Math.exp(-(bird.grounded?5.5:1.5)*dt);bird.vx=Math.max(-245,Math.min(245,bird.vx));
    if(direction)bird.facing=direction;
    flapClock=Math.max(0,flapClock-dt);
    if(keys.has('Space')&&flapClock<=0){playWingSound(bird.grounded);bird.vy=Math.max(-310,bird.vy-185);bird.grounded=false;flapClock=.17;bird.wing=Math.PI/2;burst(bird.x-8*bird.facing,bird.y+8,3,'#e2e8bf');}
    bird.vy=Math.min(360,bird.vy+590*dt);
    const oldFeet=bird.y+19;
    bird.x+=bird.vx*dt;bird.y+=bird.vy*dt;bird.grounded=false;
    // One-way platforms: crossing their top while descending is a landing.
    if(bird.vy>=0){for(const p of platforms){if(bird.x+10>p.x&&bird.x-10<p.x+p.w&&oldFeet<=p.y&&bird.y+19>=p.y){if(bird.vy>85)burst(bird.x,p.y,7,'#c4c88d');bird.y=p.y-19;bird.vy=0;bird.grounded=true;break;}}}
    if(bird.y<34){bird.y=34;bird.vy=Math.max(0,bird.vy);}
    // Joust-style horizontal wrap; the lower edge softly returns the bird to its nest.
    if(bird.x<-35)bird.x=W+35;if(bird.x>W+35)bird.x=-35;
    if(bird.y>H+35){resetBird();status.textContent='Z POWROTEM W GNIEŹDZIE';}
    else status.textContent=bird.grounded?'CHWILA ODDECHU':'W SWOIM RYTMIE';
    bird.wing+=dt*(keys.has('Space')?24:5);
    particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;});particles=particles.filter(p=>p.life>0);
    altitude.textContent=Math.max(0,Math.round((414-bird.y-19)/8));
    collectItems();updateHud();
  }
  function draw() {
    ctx.clearRect(0,0,W,H);background();platforms.forEach(platform);platforms.forEach(collectible);
    for(let i=0;i<22;i++){const x=(noise(i+800)*W+Math.sin(time*.3+i)*15),y=180+noise(i+850)*330+Math.cos(time*.5+i)*10;ellipse(x,y,1.2,1.2,`rgba(218,231,166,${.12+(Math.sin(time+i)+1)*.12})`);}
    particles.forEach(p=>{ctx.globalAlpha=p.life/p.max;ellipse(p.x,p.y,2,1,p.color);});ctx.globalAlpha=1;stork();
  }
  function resetBird(){stopSounds();const p=platforms[0];Object.assign(bird,{x:p.x+p.w/2,y:p.y-19,vx:0,vy:0,facing:1,grounded:true,wing:0});particles=[];flapClock=0;}
  function start(){
    unlockAudio();
    if(mode==='finished'){seed=Math.floor(Math.random()*4294967296);results=[];loadLevel(1);}
    else if(mode==='transition')loadLevel(level+1);
    const nextMode=mode==='paused'?resumeMode:'playing';
    mode=nextMode;
    if(mode==='transition')showSummary();else overlay.classList.add('hidden');
    pauseButton.innerHTML='Ⅱ <span>Pauza</span>';pauseButton.setAttribute('aria-label','Wstrzymaj grę');canvas.focus({preventScroll:true});
  }
  function pause(){
    if(mode==='ready'||mode==='finished')return;
    if(mode==='paused'){start();return;}
    resumeMode=mode;mode='paused';stopSounds();keys.clear();
    showOverlay('Chwila oddechu.','Twój czas i postęp czekają.<br>Wróć do zbierania, kiedy zechcesz.','Lecimy dalej ↗','Spacja lub P — wznów');
    pauseButton.innerHTML='▶ <span>Wznów</span>';pauseButton.setAttribute('aria-label','Wznów grę');status.textContent='PAUZA';
  }
  document.querySelector('#start').addEventListener('click',start);
  pauseButton.addEventListener('click',pause);
  document.querySelector('#reset').addEventListener('click',()=>{
    // Reset only the current unfinished level; never erase completed results.
    if(mode==='transition'||mode==='finished'||(mode==='paused'&&resumeMode==='transition'))return;
    loadLevel(level);mode='ready';start();
  });
  const accepted=['Space','ArrowLeft','ArrowRight','KeyA','KeyD','KeyP','Escape'];
  window.addEventListener('keydown',e=>{if(!accepted.includes(e.code))return;if(e.target instanceof HTMLButtonElement&&e.code==='Space')return;e.preventDefault();if(e.repeat)return;if(e.code==='KeyP'||e.code==='Escape'){pause();return;}if(e.code==='Space'&&(mode==='ready'||mode==='paused'))start();if(mode==='playing')keys.add(e.code);});
  window.addEventListener('keyup',e=>keys.delete(e.code));
  window.addEventListener('blur',()=>{keys.clear();if(mode==='playing'||mode==='transition')pause();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&(mode==='playing'||mode==='transition'))pause();});
  document.querySelectorAll('[data-key]').forEach(button=>{button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);if(mode==='ready'||mode==='paused')start();if(mode==='playing')keys.add(button.dataset.key);});const release=()=>keys.delete(button.dataset.key);button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);});
  function resize(){const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);}
  window.addEventListener('resize',resize);loadLevel(1);resize();
  function frame(now){if(!last)last=now;accumulator+=Math.min((now-last)/1000,.05);last=now;while(accumulator>=1/120){step(1/120);accumulator-=1/120;}draw();requestAnimationFrame(frame);}requestAnimationFrame(frame);
})();

