import {describe,it,expect} from 'vitest';
import {newGame,advanceMonth,choose,selectEvents,applyEffects} from '../src/engine';
import {randomIdentity,compatible} from '../src/identity';
describe('v1.1 feedback',()=>{
 it('allows chosen identity',()=>{const s=newGame(10,{gender:'male',orientation:'bisexual'});expect(s.identity).toEqual({gender:'male',orientation:'bisexual'});});
 it('random identity is reproducible',()=>{expect(newGame(123).identity).toEqual(newGame(123).identity);});
 it('orientation affects mutual compatibility',()=>{expect(compatible({gender:'female',orientation:'homosexual'},{gender:'female',orientation:'bisexual'})).toBe(true);expect(compatible({gender:'male',orientation:'heterosexual'},{gender:'male',orientation:'heterosexual'})).toBe(false);});
 it('limits optional choices to once per 3 months',()=>{const s=newGame();s.month=200;s.lastChoiceMonth=199;const events=[{id:'x',category:'social',presentation:'choice' as const,weight:10,text:'x',choices:[{label:'x',effects:[]}]}];expect(selectEvents(s,events)).toEqual([]);});
 it('graduation prompts for a career',()=>{const s=newGame();s.month=215;s.lastChoiceMonth=200;const n=advanceMonth(s,[]);expect(n.pending?.eventId).toBe('career-start');const m=choose(n,0,[]);const selected=n.pending!.choices[0].jobId;expect(selected).toBeDefined();expect(m.history.some(x=>x.text.includes('採用'))).toBe(true);expect(m.lastJobApplicationMonth).toBe(216);expect(m.jobId===selected||m.jobId===null).toBe(true);});
 it('negative money effects add debt',()=>{const s=newGame();applyEffects(s,[{stat:'money',delta:-10000}]);expect(s.stats.money).toBe(0);expect(s.debt).toBe(10000);});
});
