export type Person = { id:string; name:string; kind:'family'|'friend'; birthMonth:number; alive:boolean };
export type Relation = { id:string; closeness:number; trust:number; lastContactMonth:number };
export type SocialState = { people:Person[]; relations:Relation[]; nextPersonId:number; lastSocialTick:number };
export function initialSocial():SocialState {return {people:[{id:'mother',name:'母',kind:'family',birthMonth:-336,alive:true},{id:'father',name:'父',kind:'family',birthMonth:-360,alive:true}],relations:[{id:'mother',closeness:80,trust:85,lastContactMonth:0},{id:'father',closeness:65,trust:75,lastContactMonth:0}],nextPersonId:1,lastSocialTick:0};}
export function normalizeSocial<T extends object>(state:T):T&SocialState {const s=state as Partial<SocialState>;const d=initialSocial();return {...state,people:Array.isArray(s.people)?s.people:d.people,relations:Array.isArray(s.relations)?s.relations:d.relations,nextPersonId:Number.isInteger(s.nextPersonId)?s.nextPersonId!:d.nextPersonId,lastSocialTick:Number.isInteger(s.lastSocialTick)?s.lastSocialTick!:d.lastSocialTick};}
export function socialMonth(s:SocialState,month:number,random:()=>number,log:(text:string)=>void):void {
 if(s.lastSocialTick>=month)return;
 for(const r of s.relations){const p=s.people.find(x=>x.id===r.id);if(p?.alive&&p.kind==='friend'&&month-r.lastContactMonth>=6)r.closeness=Math.max(0,r.closeness-0.2);}
 if(month>=72&&s.people.filter(p=>p.kind==='friend').length<10&&random()<0.025){
 const names=['葵','陽菜','悠斗','凛','蓮','美咲','結衣','湊','紬','颯太','琴音','優花','直樹','莉子','大和','咲良','蒼','千尋','海斗','花音','樹'];
 const available=names.filter(name=>!s.people.some(person=>person.name===name));
 if(available.length===0){s.lastSocialTick=month;return;}
 const name=available[Math.floor(random()*available.length)];
 const id='friend-'+s.nextPersonId++;
 s.people.push({id,name,kind:'friend',birthMonth:month-72-Math.floor(random()*48),alive:true});
 s.relations.push({id,closeness:30,trust:30,lastContactMonth:month});
 log(name+'と知り合った。');
 }
 s.lastSocialTick=month;
}
export function contact(s:SocialState,month:number,id:string):string|null {
 const person=s.people.find(x=>x.id===id);const r=s.relations.find(x=>x.id===id);
 if(!person?.alive||!r)return null;
 r.closeness=Math.min(100,r.closeness+5);r.trust=Math.min(100,r.trust+2);r.lastContactMonth=month;
 return person.name+'と交流し、少し親しくなった。';
}
