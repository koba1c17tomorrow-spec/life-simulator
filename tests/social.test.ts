import {describe,it,expect} from 'vitest';
import {newGame,advanceMonth,meetPerson} from '../src/engine';
import {initialSocial,socialMonth,normalizeSocial} from '../src/social';
describe('NPC and relationships',()=>{
 it('starts with family',()=>{const s=newGame();expect(s.people.map(p=>p.name)).toEqual(['母','父']);expect(s.relations).toHaveLength(2);});
 it('migrates old saves without losing progress',()=>{const old={month:42};const next=normalizeSocial(old);expect(next.month).toBe(42);expect(next.people).toHaveLength(2);});
 it('contact improves closeness and consumes monthly action',()=>{const a=meetPerson(newGame(),'mother');expect(a.relations[0].closeness).toBe(85);expect(meetPerson(a,'mother').relations[0].closeness).toBe(85);});
 it('social tick can add a friend deterministically',()=>{const s=initialSocial();socialMonth(s,72,()=>0,()=>{});expect(s.people).toHaveLength(3);expect(s.relations).toHaveLength(3);});
 it('distant friendships slowly fade',()=>{const s=initialSocial();socialMonth(s,72,()=>0,()=>{});const before=s.relations[2].closeness;socialMonth(s,79,()=>1,()=>{});expect(s.relations[2].closeness).toBeLessThan(before);expect(s.relations[0].closeness).toBe(80);});
 it('simulation advances with old-save state',()=>{const s=newGame();delete (s as Partial<typeof s>).people;expect(advanceMonth(s,[]).people).toHaveLength(2);});
});
