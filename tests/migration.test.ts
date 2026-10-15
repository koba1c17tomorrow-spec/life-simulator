import {it,expect} from 'vitest';
import {newGame,normalizeGameState,advanceMonth,autoResolve} from '../src/engine';
it('migrates old saves and preserves random stream and progress',()=>{const old:any=newGame(42);old.month=120;delete old.origin;delete old.people;delete old.career;const next=normalizeGameState(old);expect(next.month).toBe(120);expect(next.seed).toBe(old.seed);expect(next.people.length).toBe(2);expect(normalizeGameState(next)).toEqual(next);});
it('rejects corrupt and future save formats',()=>{expect(()=>normalizeGameState({version:99})).toThrow();const old=newGame();old.stats.health=NaN;expect(()=>normalizeGameState(old)).toThrow();});
it('seeded automatic life finishes without blocking',()=>{let s=newGame(42);s.autoChoices=true;for(let i=0;i<1200&&!s.finished;i++){s=autoResolve(advanceMonth(s,[]),[]);expect(s.pending).toBeNull();expect(Object.values(s.stats).every(Number.isFinite)).toBe(true);}expect(s.finished).toBe(true);});
