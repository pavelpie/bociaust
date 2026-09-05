const assert=require('node:assert/strict');
const {generate,valid,BIOMES}=require('./levels.js');
let layouts=0;
for(let seed=0;seed<200;seed++) {
  let previous=null;
  const seen=new Set();
  for(let level=1;level<=100;level++) {
    const data=generate(seed,level);
    assert(valid(data.platforms),`Invalid geometry: seed ${seed}, level ${level}`);
    assert.notEqual(data.biome.name,previous);previous=data.biome.name;
    if(level<=8)seen.add(data.biome.name);
    for(const p of data.platforms) {
      assert(p.item.x>=p.x+28 && p.item.x<=p.x+p.w-28);
      assert.equal(p.item.y,p.y-23);assert.equal(p.item.collected,false);
      assert(['egg','flower','frog'].includes(p.item.type));
      assert.equal(p.item.golden,level%10===0);
    }
    // Spawn is safely on a platform, with its pickup outside contact radius.
    const spawn=data.platforms[0];assert(spawn.item.x-(spawn.x+spawn.w/2)>28);
    if(level%10===0)assert.equal(new Set(data.platforms.map(p=>p.item.type)).size,1);
    layouts++;
  }
  assert.equal(seen.size,BIOMES.length);
}
assert.deepEqual(generate(123,42),generate(123,42));
assert.notDeepEqual(generate(123,42).platforms,generate(124,42).platforms);
assert.throws(()=>generate(1,101),RangeError);assert.throws(()=>generate(1,0),RangeError);
console.log(`PASS: ${layouts} layouts, platform bounds and clearance, safe spawns, collectible placement, deterministic generation, biome diversity and level limits.`);
