import type {Trait} from './traits';
export type FamilyWealth='struggling'|'modest'|'comfortable';
export type ParentEducation='basic'|'vocational'|'university';
export type Upbringing='supportive'|'strict'|'unstable';
export type Origin={region:'city'|'rural'|'coastal';parentOccupation:string;wealth:FamilyWealth;parentEducation:ParentEducation;upbringing:Upbringing;siblings:number;schoolPerformance:number;universityAccepted:boolean|null};
export const wealthNames:Record<FamilyWealth,string>={struggling:'家計が厳しい',modest:'一般的な家庭',comfortable:'経済的に余裕がある'};
export const educationNames:Record<ParentEducation,string>={basic:'高校まで',vocational:'専門学校など',university:'大学'};
export const upbringingNames:Record<Upbringing,string>={supportive:'温かく支えてくれる',strict:'教育熱心で厳格',unstable:'不安定な家庭環境'};
export function randomOrigin(random:()=>number):Origin{
 const roll=random(),wealth:FamilyWealth=roll<0.25?'struggling':roll<0.8?'modest':'comfortable';
 const educationRoll=random(),parentEducation:ParentEducation=educationRoll<(wealth==='comfortable'?0.2:0.5)?'basic':educationRoll<(wealth==='comfortable'?0.55:0.82)?'vocational':'university';
 const u=random(),upbringing:Upbringing=u<0.68?'supportive':u<0.88?'strict':'unstable';
 return {wealth,parentEducation,upbringing,siblings:Math.floor(random()*4),schoolPerformance:50,universityAccepted:null,region:(['city','rural','coastal'] as const)[Math.min(2,Math.floor(random()*3))],parentOccupation:(['会社員','自営業','医療・教育職','不安定就労'])[Math.min(3,Math.floor(random()*4))]};
}
export function schoolPerformanceDelta(origin:Origin,traits:Trait[],priority:string):number{
 return (priority==='study'||priority==='learning'?0.035:-0.015)+(traits.includes('quickLearner')?0.012:0)+(origin.parentEducation==='university'?0.008:0)+(origin.upbringing==='unstable'?-0.012:0)+(origin.wealth==='struggling'?-0.005:0);
}
export function admissionChance(origin:Origin,knowledge:number,traits:Trait[]):number{
 const chance=12+knowledge*0.32+origin.schoolPerformance*0.40+(origin.parentEducation==='university'?7:0)+(traits.includes('quickLearner')?5:0)+(origin.wealth==='struggling'?-6:0);
 return Math.max(5,Math.min(95,Math.round(chance)));
}
export function tuitionMonthly(origin:Origin):number{return origin.wealth==='comfortable'?45000:origin.wealth==='modest'?65000:85000;}
