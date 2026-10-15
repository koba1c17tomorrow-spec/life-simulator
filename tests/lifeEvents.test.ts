import {describe,it,expect} from 'vitest';
import {newGame,choose,type GameState} from '../src/engine';
function pending(s:GameState,action:'date'|'marry'|'child',personId?:string){s.month=300;s.monthStarted=true;s.pending={eventId:'test-life',text:'人生の節目',personId,choices:[{label:'進める',effects:[],lifeAction:action},{label:'見送る',effects:[]}]};return s;}
describe('life event choices',()=>{
 it('dating begins only when accepted',()=>{const a=newGame(1);a.people.push({id:'p',name:'友人',kind:'friend',birthMonth:0,alive:true,gender:'female',orientation:'bisexual'});a.identity={gender:'male',orientation:'bisexual'};a.relations.push({id:'p',closeness:80,trust:80,lastContactMonth:300});const s=pending(a,'date','p');expect(choose(s,1,[]).partnerId).toBeNull();expect(choose(s,0,[]).partnerId).toBe('p');});
 it('marriage is not automatic on a monthly tick',()=>{const a=newGame(2);a.partnerId='friend-1';a.month=300;expect(a.spouseId).toBeNull();});
 it('children are a decision rather than automatic when a choice is presented',()=>{const a=newGame(3);a.people.push({id:'spouse',name:'配偶者',kind:'friend',birthMonth:0,alive:true});a.spouseId='spouse';const s=pending(a,'child');expect(choose(s,1,[]).children).toBe(0);expect(choose(s,0,[]).children).toBe(1);});
});
