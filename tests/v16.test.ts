import {describe,it,expect} from 'vitest';
import {monthlyDrift} from '../src/balance';
import {JOBS,jobOffers,offerChance} from '../src/careers';
import {newGame,advanceMonth,autoResolve,careerPrompt,choose} from '../src/engine';
describe('v1.6',()=>{
 it('study focus gains knowledge at a happiness cost',()=>{const study=monthlyDrift(150,'none','study'),rest=monthlyDrift(150,'none','rest');expect(study.knowledge).toBeGreaterThan(0);expect(study.happiness).toBeLessThan(rest.happiness);});
 it('has diverse careers and deterministic offers',()=>{const s=newGame(10);expect(JOBS.length).toBeGreaterThanOrEqual(20);expect(jobOffers(s)).toEqual(jobOffers(s));expect(jobOffers(s)).toHaveLength(3);});
 it('aptitude affects hiring',()=>{const job=JOBS.find(j=>j.id==='research')!;const s=newGame();const low=offerChance(s,job);s.stats.knowledge=100;expect(offerChance(s,job)).toBeGreaterThan(low);});
 it('does not end life when debt passes 10 million',()=>{const s=newGame();s.month=300;s.debt=10010000;s.stats.money=0;const n=advanceMonth(s,[]);expect(n.finished).toBe(false);expect(n.debt).toBeGreaterThan(10000000);});
 it('auto choices resolve career prompts without blocking',()=>{const s=newGame(23);s.month=215;s.autoChoices=true;const n=advanceMonth(s,[]);expect(n.pending?.eventId).toBe('career-start');const resolved=autoResolve(n,[]);expect(resolved.pending).toBeNull();});
 it('job offers are not all jobs',()=>{const s=newGame(3);s.month=216;const p=careerPrompt(s,'career-search');expect(p.choices).toHaveLength(4);expect(p.choices.filter(c=>c.jobId).length).toBe(3);});
});
