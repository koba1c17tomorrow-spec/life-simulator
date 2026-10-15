import type {GameState,Effect} from './engine';
export type Vitality={stress:number;illnessUntil:number;caregivingMonths:number;deathCause:string|null;timeline:{month:number;text:string}[];scheduled:{month:number;text:string;effects:Effect[];flag?:string}[];achievements:string[]};
export const initialVitality=():Vitality=>({stress:0,illnessUntil:0,caregivingMonths:0,deathCause:null,timeline:[],scheduled:[],achievements:[]});
export function healthMonth(s:GameState,random:()=>number,log:(text:string)=>void){
 const age=s.month/12;
 const care=s.people.find(p=>p.kind==='family'&&p.alive&&s.month-p.birthMonth>=900&&p.illness);
 const working=s.career!=='none'&&!s.retired;
 s.stress=Math.max(0,Math.min(100,s.stress+(working?0.10:-0.15)+(care?0.4:0)+(s.debt>3000000?0.12:0)-(s.priority==='rest'?0.15:s.priority==='hobby'?0.08:0)));
 if(care){s.caregivingMonths++;s.stats.health=Math.max(0,s.stats.health-0.03);if(s.caregivingMonths%12===1)log('【介護】'+care.name+'の生活を支えている。自分の休息も必要だ。');}
 const prevention=s.priority==='wellness'||s.priority==='health'||s.benefits.health>=s.month;
 if(!s.illness&&age>=3&&random()<(0.001+Math.max(0,age-50)*0.0001+s.stress*0.00001)*(prevention?0.7:1)){
  s.illness=random()<0.3?'怪我':'病気';s.illnessUntil=s.month+3+Math.floor(random()*9);s.stats.health=Math.max(0,s.stats.health-5);log('【健康】'+s.illness+'で療養を始めた。');
 }
 if(s.illness){s.stats.health=Math.max(0,s.stats.health-0.05);if(s.month>=s.illnessUntil){s.illness=null;s.stats.health=Math.min(100,s.stats.health+3);log('【回復】療養を終え、日常へ戻った。');s.flags.recovered=true;}}
 s.stats.health=Math.max(0,Math.min(100,s.stats.health+(prevention?0.012:0)-s.stress*0.00008));
 // Homeostasis prevents policy or a long run of minor events from permanently locking happiness.
 s.stats.happiness=Math.max(0,Math.min(100,s.stats.happiness+(58-s.stats.happiness)*0.003-s.stress*0.0002));
 if(s.month>=780&&!s.retired){s.retired=true;s.career='none';s.jobId=null;s.careerLevel=0;log('【退職】現役を退き、年金と資産で暮らす時期を迎えた。');s.flags.retired=true;}
 if(s.month>=216&&s.childhoodConfidence>0&&!s.flags.childhoodReward){s.flags.childhoodReward=true;s.stats.sociability=Math.min(100,s.stats.sociability+s.childhoodConfidence*0.2);log('幼い頃に支えられた経験が、新しい環境に踏み出す力になった。');}
 if(s.month>=1200||s.stats.health<=0||age>=75&&random()<Math.max(0,(age-74)*0.0003)+(s.illness?0.0005:0)){
  s.finished=true;s.deathCause=s.stats.health<=0?(s.illness??'健康の衰弱'):s.illness??'老衰';s.pending=null;s.queue=[];s.monthStarted=false;log('【人生の終わり】'+s.deathCause+'により、'+Math.floor(age)+'年の人生を終えた。');
 }
}
export function delayedMonth(s:GameState,apply:(effects:Effect[])=>void,log:(text:string)=>void){
 const due=s.scheduled.filter(e=>e.month<=s.month);s.scheduled=s.scheduled.filter(e=>e.month>s.month);
 for(const e of due){apply(e.effects);if(e.flag)s.flags[e.flag]=true;log('【あの時から】'+e.text);}
}
export function updateAchievements(s:GameState){
 const earned:{id:string;ok:boolean}[]=[{id:'成人',ok:s.month>=216},{id:'学びを修める',ok:!!s.degree&&s.degree!=='high'},{id:'家族の物語',ok:s.children>0},{id:'仕事の積み重ね',ok:s.lifetimeWork>=240},{id:'備えのある暮らし',ok:s.savings+s.investments>=3000000},{id:'再出発',ok:s.restructured&&s.debt===0},{id:'長い友情',ok:s.relations.some(r=>r.closeness>=75&&s.month>=600)},{id:'人生を歩む',ok:s.finished}];
 for(const a of earned)if(a.ok&&!s.achievements.includes(a.id))s.achievements.push(a.id);
}
