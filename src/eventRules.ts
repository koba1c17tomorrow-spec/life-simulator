import type {Trait} from './traits';
import type {Origin} from './origins';
export type RuleStat='health'|'happiness'|'knowledge'|'sociability'|'money';
export type RuleField=RuleStat|'schoolPerformance'|'debt'|'ageMonths'|'friendCloseness';
export type Requirement={field?:RuleField;min?:number;max?:number;trait?:Trait;wealth?:Origin['wealth'];career?:string;education?:string};
export type RollRule={base:number;stat?:RuleStat;statFactor?:number;gradeFactor?:number;trait?:Trait;traitBonus?:number;wealth?:Origin['wealth'];wealthBonus?:number};
export type RuleContext={month:number;stats:Record<RuleStat,number>;origin?:Origin;traits?:Trait[];career?:string;education?:string;debt?:number;friendCloseness?:number};
export function satisfies(ctx:RuleContext,requirements:Requirement[]=[]):boolean{
 return requirements.every(r=>{
  if(r.trait&&!ctx.traits?.includes(r.trait))return false;
  if(r.wealth&&ctx.origin?.wealth!==r.wealth)return false;
  if(r.career&&ctx.career!==r.career)return false;
  if(r.education&&ctx.education!==r.education)return false;
  if(r.field){
   const value=r.field==='ageMonths'?ctx.month:r.field==='schoolPerformance'?ctx.origin?.schoolPerformance:r.field==='debt'?ctx.debt:r.field==='friendCloseness'?ctx.friendCloseness:ctx.stats[r.field];
   if(value===undefined||!Number.isFinite(value))return false;
   if(r.min!==undefined&&value<r.min)return false;
   if(r.max!==undefined&&value>r.max)return false;
  }
  return true;
 });
}
export function rollChance(ctx:RuleContext,rule:RollRule):number{
 let chance=rule.base;
 if(rule.stat)chance+=(ctx.stats[rule.stat]??0)*(rule.statFactor??0);
 chance+=(ctx.origin?.schoolPerformance??0)*(rule.gradeFactor??0);
 if(rule.trait&&ctx.traits?.includes(rule.trait))chance+=rule.traitBonus??0;
 if(rule.wealth&&ctx.origin?.wealth===rule.wealth)chance+=rule.wealthBonus??0;
 return Math.max(0,Math.min(100,Math.round(chance)));
}
