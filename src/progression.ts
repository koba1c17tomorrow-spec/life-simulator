export type Education='preschool'|'elementary'|'middle'|'high'|'university'|'working';
export type Career='none'|'parttime'|'office'|'technical'|'creative'|'service';
export type Progression={education:Education;career:Career;careerLevel:number;experience:number;graduatedUniversity:boolean;partnerId:string|null;spouseId:string|null;children:number;monthlyIncome:number;monthlyExpenses:number;debt:number;lastCareerPromptMonth:number;lastChoiceMonth:number;lastJobApplicationMonth:number};
export function initialProgression():Progression{return {education:'preschool',career:'none',careerLevel:0,experience:0,graduatedUniversity:false,partnerId:null,spouseId:null,children:0,monthlyIncome:0,monthlyExpenses:0,debt:0,lastCareerPromptMonth:-999,lastChoiceMonth:-999,lastJobApplicationMonth:-999};}
export function normalizeProgression<T extends object>(s:T):T&Progression{return {...initialProgression(),...s} as T&Progression;}
export function educationAt(month:number,university:boolean):Education{if(month<72)return 'preschool';if(month<144)return 'elementary';if(month<180)return 'middle';if(month<216)return 'high';if(month<264&&university)return 'university';return 'working';}
export const salaryTable:Record<Career,number>={none:0,parttime:90000,office:220000,technical:260000,creative:200000,service:190000};
export function annualSalary(c:Career,level=0){return Math.round(salaryTable[c]*(1+level*0.18)*12);}
export function jobChance(s:{month:number;stats:{knowledge:number;sociability:number;health:number};graduatedUniversity:boolean},c:Career){const base:Record<Career,number>={none:100,parttime:90,office:43,technical:20,creative:34,service:62};return c==='none'?100:Math.max(5,Math.min(95,Math.round(base[c]+s.stats.knowledge*(c==='technical'?0.65:0.18)+s.stats.sociability*(c==='service'?0.28:0.13)+s.stats.health*0.08+(s.graduatedUniversity&&s.month>=264?14:0))));}
export function progressionMonth(s:Progression&{month:number;stats:{money:number;knowledge:number;happiness:number}},log:(message:string)=>void):void{
 const old=s.education;s.education=educationAt(s.month,s.graduatedUniversity);
 if(s.education!==old){const names:Record<Education,string>={preschool:'幼少期',elementary:'小学校',middle:'中学校',high:'高校',university:'大学',working:'社会人'};log(names[s.education]+'の時期を迎えた。');}
 if(s.month===216&&s.graduatedUniversity)log('大学に進学した。');
 if(s.month===264&&s.graduatedUniversity)log('大学を卒業した。');
 if(s.month>=216&&s.career!=='none'){s.experience++;if(s.experience>=60&&s.careerLevel<5){s.careerLevel++;s.experience=0;log('仕事で昇進した。');}}
 s.monthlyIncome=s.month>=216?Math.round(salaryTable[s.career]*(1+s.careerLevel*0.18)):0;
 s.monthlyExpenses=s.month>=216?Math.round(170000+s.children*45000+(s.spouseId?35000:0)+Math.max(0,s.monthlyIncome-200000)*0.2):0;
 const balance=s.stats.money+s.monthlyIncome-s.monthlyExpenses;
 if(balance<0){s.debt+=-balance;s.stats.money=0;}else if(s.debt>0){const payment=Math.min(s.debt,balance);s.debt-=payment;s.stats.money=balance-payment;}else{s.stats.money=balance;}
 if(s.debt>0){s.debt=Math.round(s.debt*1.003);if(s.debt>1000000&&s.month%12===0)log('借金が増え、生活が厳しくなっている。');}
}
export function careerOptions(s:Progression&{month:number;stats:{knowledge:number}}):Career[]{if(s.month<192)return [];const options:Career[]=['parttime','service','creative','office'];if(s.stats.knowledge>=45)options.push('technical');return options;}
export function careerName(c:Career):string{return ({none:'無職',parttime:'アルバイト',office:'事務職',technical:'技術職',creative:'クリエイティブ職',service:'サービス職'})[c];}
