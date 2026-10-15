export type RelativeStat='health'|'happiness'|'knowledge'|'sociability';
export function ageAverage(month:number,key:RelativeStat):number{
 const age=month/12;
 if(key==='knowledge')return Math.min(78,18+Math.min(age,22)*1.6+Math.max(0,age-22)*0.18);
 if(key==='health')return Math.max(35,82-Math.max(0,age-25)*0.65);
 if(key==='happiness')return 58;
 return Math.min(70,35+Math.min(age,25)*0.9);
}
export function relativeScore(value:number,month:number,key:RelativeStat):number{return Math.max(0,Math.min(100,Math.round(50+value-ageAverage(month,key))));}
export function monthlyDrift(month:number,career:string,priority:string):Record<RelativeStat,number>{
 const working=career!=='none'&&month>=216;
 return {health:(working?-0.28:0.01)-(month>540?0.15:0)+(priority==='health'?0.38:0)+(priority==='study'?-0.04:0),happiness:(working?-0.19:-0.06)+(priority==='rest'?0.32:0)+(priority==='study'?-0.32:0)+(priority==='social'?0.10:0),knowledge:(month>=72&&month<276?-0.32:-0.10)+(priority==='study'?0.82:0),sociability:-0.16+(priority==='social'?0.48:0)};
}
