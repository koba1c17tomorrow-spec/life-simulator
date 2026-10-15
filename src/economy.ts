import type {GameState, Effect} from './engine';
export type Economy={lifetimeWork:number;scholarship:boolean;illness:string|null;savings:number;investments:number;living:'basic'|'standard'|'comfortable';housing:'family'|'rent'|'owned';purchases:Record<string,number>;benefits:Record<string,number>;lastSpendMonth:number;restructured:boolean;unemployedMonths:number;retired:boolean;tax:number;expenseBreakdown:Record<string,number>};
export const initialEconomy=():Economy=>({lifetimeWork:0,scholarship:false,illness:null,savings:0,investments:0,living:'standard',housing:'rent',purchases:{},benefits:{},lastSpendMonth:-1,restructured:false,unemployedMonths:0,retired:false,tax:0,expenseBreakdown:{}});
export type Purchase={id:string;category:string;name:string;price:number;minAge:number;cooldown:number;effects:Effect[];benefit?:string;description:string};
export const PURCHASES:Purchase[]=[
{id:'meal',category:'交友・娯楽',name:'外食',price:3000,minAge:144,cooldown:3,effects:[{stat:'happiness',delta:2}],benefit:'social',description:'気分転換と次の交流のきっかけ'},
{id:'gift',category:'交友・娯楽',name:'プレゼント',price:5000,minAge:144,cooldown:6,effects:[],benefit:'social',description:'生存する親しい人の親密度と信頼を高める'},
{id:'travel',category:'交友・娯楽',name:'旅行',price:80000,minAge:216,cooldown:24,effects:[{stat:'happiness',delta:5}],benefit:'memories',description:'思い出は将来の再会イベントにも影響'},
{id:'hobby',category:'交友・娯楽',name:'趣味の道具',price:15000,minAge:120,cooldown:12,effects:[{stat:'happiness',delta:2}],benefit:'creative',description:'創作企画の成功率を高める'},
{id:'entertainment',category:'交友・娯楽',name:'娯楽',price:2000,minAge:120,cooldown:3,effects:[{stat:'happiness',delta:2}],description:'手軽な気分転換'},
{id:'books',category:'教育・自己投資',name:'本や教材',price:3000,minAge:72,cooldown:12,effects:[{stat:'knowledge',delta:0.5}],benefit:'learning',description:'1年間の学習に小さな助け'},
{id:'lessons',category:'教育・自己投資',name:'習い事',price:20000,minAge:72,cooldown:12,effects:[{stat:'sociability',delta:0.5}],benefit:'learning',description:'継続学習と学校の経験に影響'},
{id:'certificate',category:'教育・自己投資',name:'資格取得',price:60000,minAge:216,cooldown:36,effects:[{stat:'knowledge',delta:1}],benefit:'qualification',description:'学習を経て資格を得て、採用率を改善'},
{id:'training',category:'教育・自己投資',name:'職業訓練',price:40000,minAge:216,cooldown:24,effects:[{stat:'knowledge',delta:1}],benefit:'qualification',description:'再就職の採用率を改善'},
{id:'tuition',category:'教育・自己投資',name:'進学準備',price:100000,minAge:180,cooldown:48,effects:[],benefit:'learning',description:'受験準備に活用される'},
{id:'appliance',category:'生活',name:'家電',price:50000,minAge:216,cooldown:60,effects:[{stat:'happiness',delta:2}],benefit:'comfort',description:'数年間の生活費を少し節約'},
{id:'phone',category:'生活',name:'スマートフォン',price:60000,minAge:144,cooldown:36,effects:[],benefit:'social',description:'離れた友人と連絡するきっかけ'},
{id:'housing',category:'生活',name:'住居を購入',price:18000000,minAge:240,cooldown:9999,effects:[{stat:'happiness',delta:3}],description:'家賃を維持費に置き換える（ローンなし）'},
{id:'health',category:'生活',name:'健康管理',price:10000,minAge:216,cooldown:12,effects:[{stat:'health',delta:1}],benefit:'health',description:'1年間の病気リスクを軽減'},
];
export function purchaseReason(s:GameState,p:Purchase):string {
 if(s.finished||s.pending)return '進行停止中は購入できません';
 if(s.month<p.minAge)return `${Math.floor(p.minAge/12)}歳から利用できます`;
 if(s.lastSpendMonth===s.month)return '購入は月1回までです';
 if(s.month-(s.purchases[p.id]??-99999)<p.cooldown)return '買い替え・利用間隔が必要です';
 if(s.debt>3000000&&p.category==='交友・娯楽')return '債務整理か返済を優先してください';
 if(s.benefits.creditRestricted>=s.month&&p.price>=40000)return '債務整理後の支出制限中です';
 if(s.stats.money<p.price)return '所持金が不足しています';
 if(p.id==='housing'&&s.housing==='owned')return '住居を所有しています';
 return '';
}
export function spend(original:GameState,id:string):GameState {
 const p=PURCHASES.find(p=>p.id===id);if(!p||purchaseReason(original,p))return original;
 const s=structuredClone(original);s.stats.money-=p.price;s.lastSpendMonth=s.month;s.purchases[id]=s.month;
 for(const e of p.effects)s.stats[e.stat]=Math.max(0,Math.min(100,s.stats[e.stat]+e.delta));
 if(p.benefit)s.benefits[p.benefit]=s.month+(p.benefit==='comfort'?60:12);
 if(id==='housing')s.housing='owned';
 if(id==='gift'){const r=s.relations.filter(r=>s.people.some(p=>p.id===r.id&&p.alive)).sort((a,b)=>b.closeness-a.closeness)[0];if(r){r.closeness=Math.min(100,r.closeness+5);r.trust=Math.min(100,r.trust+3);}}
 s.history.unshift({id:`spend-${s.month}-${id}`,month:s.month,text:`【支出】${p.name}に${p.price.toLocaleString()}円を使った。${p.description}。`});return s;
}
export function transfer(original:GameState,kind:'save'|'withdraw'|'invest'|'sell'|'repay',amount:number):GameState {
 if(original.finished||original.pending||original.month<216||!Number.isSafeInteger(amount)||amount<=0)return original;
 const s=structuredClone(original);const source=kind==='withdraw'?s.savings:kind==='sell'?s.investments:s.stats.money;
 if(kind==='invest'&&s.benefits.creditRestricted>=s.month)return original;
 if(amount>source||(kind==='repay'&&amount>s.debt))return original;
 if(kind==='save'){s.stats.money-=amount;s.savings+=amount;}if(kind==='withdraw'){s.savings-=amount;s.stats.money+=amount;}
 if(kind==='invest'){s.stats.money-=amount;s.investments+=amount;}if(kind==='sell'){s.investments-=amount;s.stats.money+=amount;}
 if(kind==='repay'){s.stats.money-=amount;s.debt-=amount;}
 s.history.unshift({id:`finance-${s.month}-${s.history.length}`,month:s.month,text:`【金融】${({save:'貯蓄',withdraw:'引出',invest:'投資',sell:'売却',repay:'借金返済'})[kind]} ${amount.toLocaleString()}円。`});return s;
}
export function changeLiving(original:GameState,living:Economy['living']):GameState {
 if(original.month<216||original.pending||original.finished||!['basic','standard','comfortable'].includes(living)||original.debt>3000000&&living!=='basic')return original;
 return {...original,living};
}
export function restructure(original:GameState):GameState {
 if(original.finished||original.pending||original.debt<3000000||original.restructured)return original;
 const s=structuredClone(original);const assets=s.stats.money+s.savings+s.investments;s.debt=Math.max(0,s.debt-assets)*0.35;s.stats.money=0;s.savings=0;s.investments=0;s.restructured=true;s.living='basic';s.benefits.creditRestricted=s.month+84;
 if(s.housing==='owned'){s.debt=Math.max(0,s.debt-12000000);s.housing='rent';}
 s.history.unshift({id:`debt-${s.month}`,month:s.month,text:'【債務整理】資産を返済に充て、残債を整理した。7年間は新規投資と高額消費を控える。'});return s;
}
export function settleBudget(s:GameState,random:()=>number,log:(text:string)=>void){
 s.savings=Math.round(s.savings*1.0002);if(s.investments)s.investments=Math.max(0,Math.round(s.investments*(0.98+random()*0.045)));
 if(s.month<216){s.monthlyExpenses=0;return;}
 if(s.career==='none'&&!s.retired){s.unemployedMonths++;if(s.unemployedMonths<=6&&s.experience>0)s.monthlyIncome+=90000;}else s.unemployedMonths=0;
 if(s.retired)s.monthlyIncome=85000+Math.min(100000,s.lifetimeWork*100);
 const university=s.education==='university';const factor=({basic:0.72,standard:1,comfortable:1.45})[s.living];
 s.tax=Math.round(Math.max(0,s.monthlyIncome-100000)*0.18);
 s.expenseBreakdown={住居:s.housing==='owned'?18000:s.housing==='family'?15000:55000,生活:Math.round((university?40000:75000)*factor),税社会保険:s.tax,扶養:Math.max(s.people.filter(p=>p.parentIds?.includes('player')&&p.alive&&s.month-p.birthMonth<216).length,s.children-s.people.filter(p=>p.parentIds?.includes('player')).length)*25000+(s.spouseId?15000:0),教育:university?(s.scholarship?20000:60000):s.education==='vocational'?45000:0,医療:s.illness?10000:3000};
 if(s.benefits.comfort>=s.month)s.expenseBreakdown.生活-=3000;
 s.monthlyExpenses=Object.values(s.expenseBreakdown).reduce((a,b)=>a+b,0);
 let balance=s.stats.money+s.monthlyIncome-s.monthlyExpenses;
 if(balance<0&&s.savings>0){const withdrawal=Math.min(s.savings,-balance);s.savings-=withdrawal;balance+=withdrawal;}
 if(balance<0){s.debt-=balance;s.stats.money=0;}else{const repayment=Math.min(s.debt,Math.floor(balance*0.5));s.debt-=repayment;s.stats.money=balance-repayment;}
 s.debt=Math.round(s.debt*(s.restructured?1.0002:1.002));
 if(s.debt>=3000000&&s.living!=='basic'){s.living='basic';log('家計の悪化により生活水準を切り詰めた。');}
 s.stats.happiness=Math.max(0,Math.min(100,s.stats.happiness+(s.living==='comfortable'?0.04:s.living==='basic'?-0.03:0)));
}
