import {describe,it,expect} from 'vitest';
import {newGame,advanceMonth,setUniversity,setCareer,startRomance,marry,haveChild} from '../src/engine';
import {educationAt,careerOptions,normalizeProgression} from '../src/progression';
describe('life progression',()=>{
 it('education stages change with age',()=>{expect(educationAt(72,false)).toBe('elementary');expect(educationAt(216,true)).toBe('university');expect(educationAt(264,true)).toBe('working');});
 it('old saves get default progression',()=>{const x=normalizeProgression({month:200});expect(x.month).toBe(200);expect(x.career).toBe('none');});
 it('career requires adulthood',()=>{const s=newGame();expect(careerOptions(s)).toEqual([]);s.month=240;expect(setCareer(s,'office').career).toBe('office');});
 it('university can be selected in high school',()=>{const s=newGame();s.month=190;expect(setUniversity(s,true).graduatedUniversity).toBe(true);});
 it('monthly salary and costs are applied',()=>{const s=newGame();s.month=239;s.education='working';s.career='technical';s.stats.money=0;const n=advanceMonth(s,[]);expect(n.stats.money).toBe(140000);});
 it('relationships support marriage and children',()=>{const s=newGame();s.month=240;s.people.push({id:'f1',name:'葵',kind:'friend',birthMonth:0,alive:true});s.relations.push({id:'f1',closeness:80,trust:80,lastContactMonth:240});const a=startRomance(s,'f1');expect(a.partnerId).toBe('f1');const b=marry(a);expect(b.spouseId).toBe('f1');expect(haveChild(b).children).toBe(1);});
});
