import { expect,it } from 'vitest';
import { worldRules,WORLD_RULES,currencyLabel } from '../src/worldRules';
import { WORLDS,validateManifest } from '../src/content';
import { newGame,advanceMonth,autoResolve } from '../src/engine';
it('uses a world registry without changing legacy paths or registry order',()=>{
  expect(WORLDS.slice(0,2)).toEqual([{id:'modern',name:'現代の人生'},{id:'coastal',name:'海辺の町の人生'}]);
  for(const id of ['modern','coastal']){const r=worldRules(id);expect(r.engine).toBe('legacy');expect(currencyLabel(id)).toBe('円');expect(r.magic).toBe(false);expect(r.species.human.lifespanMonths).toBe(1200);}
  expect(()=>worldRules('__proto__')).toThrow();expect(()=>worldRules('missing')).toThrow();
});
it('does not mutate world rules or a shared state while simulating existing worlds',()=>{
  const before=structuredClone(WORLD_RULES);
  for(const world of ['modern','coastal']){let a=newGame(42,{},world),b=structuredClone(a);for(let i=0;i<24;i++){a=autoResolve(advanceMonth(a,[]),[]);b=autoResolve(advanceMonth(b,[]),[]);}expect(a).toEqual(b);}
  expect(WORLD_RULES).toEqual(before);
  expect(validateManifest({id:'modern',name:'現代',events:'events.json'},'modern').events).toBe('events.json');
});
