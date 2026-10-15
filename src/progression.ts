export type Education='preschool'|'elementary'|'middle'|'high'|'university'|'working';
export type Career='none'|'parttime'|'office'|'technical'|'creative'|'service';
export type Progression={education:Education;career:Career;careerLevel:number;experience:number;graduatedUniversity:boolean;partnerId:string|null;spouseId:string|null;children:number;monthlyIncome:number;monthlyExpenses:number};
export function initialProgression():Progression{return {education:'preschool',career:'none',careerLevel:0,experience:0,graduatedUniversity:false,partnerId:null,spouseId:null,children:0,monthlyIncome:0,monthlyExpenses:0};}
export function normalizeProgression<T extends object>(s:T):T&Progression{return {...initialProgression(),...s} as T&Progression;}
export function educationAt(month:number,university:boolean):Education{if(month<72)return 'preschool';if(month<144)return 'elementary';if(month<180)return 'middle';if(month<216)return 'high';if(month<264&&university)return 'university';return 'working';}
export function progressionMonth(s:Progression&{month:number;stats:{money:number;knowledge:number;happiness:number}},log:(message:string)=>void):void{
 const old=s.education;s.education=educationAt(s.month,s.graduatedUniversity);
 if(s.education!==old){const names:Record<Education,string>={preschool:'幼少期',elementary:'小学校',middle:'中学校',high:'高校',university:'大学',working:'社会人'};log(names[s.education]+'の時期を迎えた。');}
 if(s.month===216&&s.graduatedUniversity)log('大学に進学した。');
 if(s.month===264&&s.graduatedUniversity)log('大学を卒業した。');
 if(s.month>=216&&s.career!=='none'){s.experience++;if(s.experience>=60&&s.careerLevel<5){s.careerLevel++;s.experience=0;log('仕事で昇進した。');}}
 const base:Record<Career,number>={none:0,parttime:90000,office:220000,technical:260000,creative:200000,service:190000};
 s.monthlyIncome=s.month>=216?Math.round(base[s.career]*(1+s.careerLevel*0.18)):0;
 s.monthlyExpenses=s.month>=216?Math.round(120000+s.children*30000+(s.spouseId?25000:0)):0;
 s.stats.money+=s.monthlyIncome-s.monthlyExpenses;
}
export function careerOptions(s:Progression&{month:number;stats:{knowledge:number}}):Career[]{if(s.month<192)return [];const options:Career[]=['parttime','service','creative','office'];if(s.stats.knowledge>=45)options.push('technical');return options;}
export function careerName(c:Career):string{return ({none:'無職',parttime:'アルバイト',office:'事務職',technical:'技術職',creative:'クリエイティブ職',service:'サービス職'})[c];}
