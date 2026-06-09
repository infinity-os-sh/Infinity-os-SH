# -*- coding: utf-8 -*-
CSS = """<style>
:root{--bg:#09090f;--card:#141820;--bg3:#13161f;--border:rgba(255,255,255,.06);--text:#e8ecf5;--text2:#8a95aa;--text3:#4a5468;--amber:#f5a623;--teal:#4ecdc4;--red:#ff5f5f;--green:#4ade80;--blue:#60a5fa;--purple:#a78bfa;}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--text);font-family:'Noto Sans SC',system-ui,sans-serif;line-height:1.55;padding-bottom:46px}
.wrap{max-width:840px;margin:0 auto;padding:0 13px}
.top{position:sticky;top:0;z-index:50;background:rgba(9,9,15,.94);backdrop-filter:blur(14px);border-bottom:1px solid var(--border);padding:10px 13px;display:flex;align-items:center;gap:9px}
.sym{width:26px;height:26px;border-radius:7px;background:linear-gradient(135deg,#f5a623,#ff7c38);display:flex;align-items:center;justify-content:center;font-weight:800;color:#000;font-size:13px;font-family:'Syne'}
.bd{font-family:'Syne';font-weight:700;font-size:12px}.bd span{color:var(--amber)}
.ver{margin-left:auto;font-family:'Space Mono',monospace;font-size:10px;color:var(--text3)}
.hero{padding:20px 0 12px;border-bottom:1px solid var(--border)}
.kk{font-family:'Space Mono',monospace;font-size:10px;color:var(--amber);letter-spacing:.1em;text-transform:uppercase}
h1{font-family:'Syne';font-size:25px;font-weight:800;margin:5px 0 9px}h1 span{color:var(--amber)}
.intent{background:linear-gradient(135deg,rgba(245,166,35,.08),rgba(78,205,196,.03));border:1px solid rgba(245,166,35,.2);border-radius:11px;padding:12px 14px;font-size:13px;color:var(--text);margin-bottom:6px}
.intent b{color:var(--amber)}
.owner{font-family:'Space Mono',monospace;font-size:11px;color:var(--text3);margin-top:8px}.owner b{color:var(--text2)}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0}
.kpi{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 6px;text-align:center}
.kv{font-family:'Syne';font-size:19px;font-weight:800;line-height:1}.kl{font-size:9px;color:var(--text3);margin-top:4px;line-height:1.3}
.g{color:var(--green)}.a{color:var(--amber)}.r{color:var(--red)}.t{color:var(--teal)}
.sec{margin:15px 0;border:1px solid var(--border);border-radius:12px;background:var(--card);overflow:hidden}
.sh{padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px;font-weight:700;display:flex;align-items:center;gap:7px}
.sh .em{font-size:15px}
.body{padding:11px 14px;font-size:12.5px;color:var(--text2)}
.body li{margin:6px 0;list-style:none;padding-left:16px;position:relative}.body li::before{content:'▸';position:absolute;left:0;color:var(--amber)}
.dl{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:12px}.dl span{color:var(--text2)}.dl b{color:var(--text)}
/* 2x2 mini */
.q2wrap{padding:12px 14px}
.q2head{display:flex;font-size:9.5px;color:var(--text3);font-family:'Space Mono',monospace;margin-bottom:4px;padding-left:26px}
.q2head span{flex:1;text-align:center}
.q2row{display:flex;align-items:stretch;gap:6px;margin-bottom:6px}
.q2lbl{width:20px;display:flex;align-items:center;justify-content:center;font-size:9.5px;color:var(--text3);font-family:'Space Mono',monospace;writing-mode:vertical-rl;transform:rotate(180deg)}
.q2{flex:1;border-radius:9px;padding:9px 10px;border:1px solid var(--border)}
.q2.A{background:rgba(74,222,128,.08);border-color:rgba(74,222,128,.3)}
.q2.B{background:rgba(255,95,95,.08);border-color:rgba(255,95,95,.3)}
.q2.C{background:rgba(245,166,35,.08);border-color:rgba(245,166,35,.3)}
.q2.D{background:rgba(96,165,250,.05);border-color:rgba(96,165,250,.2)}
.q2 .qn{font-family:'Space Mono',monospace;font-size:9px;color:var(--text3)}
.q2 .qt{font-family:'Syne';font-size:13px;font-weight:800;margin-top:1px}
.q2.A .qt{color:var(--green)}.q2.B .qt{color:var(--red)}.q2.C .qt{color:var(--amber)}.q2.D .qt{color:var(--blue)}
.q2 .qm{font-size:11px;color:var(--text);margin-top:2px}.q2 .qm b{font-family:'Syne';font-size:15px}
.q2note{margin:4px 14px 12px;padding:9px 12px;border-radius:9px;background:var(--bg3);border:1px solid var(--border);font-size:12px;color:var(--text2);line-height:1.6}
.q2note b{color:var(--text)}
.verdict{padding:12px 14px;font-size:13px;line-height:1.6}
.verdict.no{background:rgba(255,95,95,.07);border-left:3px solid var(--red)}
.verdict.partial{background:rgba(245,166,35,.06);border-left:3px solid var(--amber)}
.verdict.ok{background:rgba(74,222,128,.06);border-left:3px solid var(--green)}
.verdict b{color:var(--text)}
.res{background:rgba(78,205,196,.06);border:1px solid rgba(78,205,196,.22);border-radius:11px;padding:12px 14px;font-size:13px;color:var(--text);margin:15px 0}.res b{color:var(--teal)}
.ph{display:inline-block;font-family:'Space Mono',monospace;font-size:9.5px;color:var(--blue);border:1px solid rgba(96,165,250,.3);border-radius:5px;padding:1px 6px;margin-left:3px}
.foot{margin-top:20px;padding-top:13px;border-top:1px solid var(--border);font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;line-height:1.6}
.tag{display:inline-block;font-size:10px;padding:2px 9px;border-radius:9px;margin-left:6px;vertical-align:middle}
</style>"""
HEAD = """<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} · 战略意图实现度</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&family=Space+Mono:wght@400;700&family=Syne:wght@600;700;800&display=swap" rel="stylesheet">""" + CSS + """</head><body>
<div class="top"><div class="sym">&#8734;</div><div class="bd">INFINITY <span>OS</span> · 六月鲜子品牌</div><div class="ver">含自身2×2象限</div></div>
<div class="wrap">"""
def li(items): return ''.join(f"<li>{x}</li>" for x in items)
def q2cell(cls,code,name,n,amt,amtlbl):
    return f'<div class="q2 {cls}"><div class="qn">{code}</div><div class="qt">{cls} {name}</div><div class="qm"><b>{n}</b>个 · {amt}万{amtlbl}</div></div>'
def quadblock(q):
    # 布局: 上=好(D左 A右), 下=差(C左 B右)
    top = '<div class="q2row"><div class="q2lbl">好</div>' + \
        q2cell('D','没做×好','设计错',q['D']['n'],q['D']['目标万'],'目标') + \
        q2cell('A','做了×好','正样本',q['A']['n'],q['A']['实际万'],'实际') + '</div>'
    bot = '<div class="q2row"><div class="q2lbl">差</div>' + \
        q2cell('C','没做×差','执行',q['C']['n'],q['C']['目标万'],'目标') + \
        q2cell('B','做了×差','因果',q['B']['n'],q['B']['目标万'],'目标') + '</div>'
    head='<div class="q2head"><span>没做(左)</span><span>做了(右)</span></div>'
    return f'<div class="q2wrap">{head}{top}{bot}</div>'

def page(d):
    h=HEAD.replace('{title}', d['title'])
    h+=f"""<div class="hero"><div class="kk">战略意图 vs 实际 · 含子品牌自身2×2象限</div>
    <h1>{d['title']} <span class="tag" style="background:{d['tagbg']};color:{d['tagc']}">{d['stage']}</span></h1>
    <div class="intent"><b>品牌战略意图:</b>{d['intent']}</div>
    <div class="owner">责任人:<b>[ 待填 ]</b> · 这份=该责任人的子品牌记分卡(意图=满分尺·差距=没做对的)</div></div>
    <div class="kpis">
      <div class="kpi"><div class="kv {d['ac']}">{d['dacheng']}%</div><div class="kl">H1达成<br>{d['shi']}/{d['mu']}万</div></div>
      <div class="kpi"><div class="kv t">{d['share']}%</div><div class="kl">占六月鲜<br>动销比重</div></div>
      <div class="kpi"><div class="kv {d['rc']}">{d['ramp']}×</div><div class="kl">H2/H1目标<br>下半年要求</div></div>
      <div class="kpi"><div class="kv a">{d['live']}/{d['skutot']}</div><div class="kl">活SKU/总<br>铺了没动{d['dead']}</div></div>
    </div>"""
    h+=f"""<div class="sec"><div class="sh"><span class="em">📊</span>发生了什么(真实动销)</div>
    <div class="body"><div class="dl">{d['facts']}</div><div style="margin-top:9px">{d['facts2']}</div></div></div>"""
    h+=f"""<div class="sec"><div class="sh"><span class="em">🧭</span>{d['title']} 自身 2×2 象限</div>{quadblock(d['quad'])}<div class="q2note">{d['quadnote']}</div></div>"""
    h+=f"""<div class="sec"><div class="sh"><span class="em">🎯</span>意图实现了吗?</div><div class="verdict {d['vcls']}">{d['verdict']}</div></div>"""
    h+=f"""<div class="sec"><div class="sh"><span class="em">🔧</span>需要加强的点</div><div class="body"><ul>{li(d['fix'])}</ul></div></div>"""
    h+=f"""<div class="sec"><div class="sh"><span class="em">🗓️</span>下半年(H2)策略调整</div><div class="body"><ul>{li(d['h2'])}</ul></div></div>"""
    h+=f"""<div class="res"><b>💰 资源投入方向:</b>{d['res']}</div>"""
    h+=f"""<div class="foot">六月鲜·{d['title']} 战略意图实现度+自身2×2 · 口径:大润发1279店动销·1-5月 · 目标人群是否抓到 <span class="ph">需账A</span> · 署名 DS</div></div></body></html>"""
    return h

import json
Q=json.load(open('subbrand_quad.json'))
DATA=[
 dict(file='infinity_os_ly_sub_classic.html', title='经典(老品)', stage='成熟衰退期', tagbg='rgba(138,149,170,.15)',tagc='#8a95aa',
   intent='成熟衰退期的老品——当现金牛,稳住基本盘,为升级版输血。',
   dacheng=103,ac='g',shi=2022,mu=1955,share=68.8,ramp=1.36,rc='a',live=13,skutot=34,dead=21,
   facts='<span>鲜味 <b>1481万</b></span><span>红烧 <b>541万</b></span><span>折价SKU <b>13</b></span>',
   facts2='扛把子:880ML减盐33%(780万/117%)、1.8L特级(133%)。红烧深折880ML −25%。',
   quad=Q['经典'],
   quadnote='<b>形态:集中在A + 一条长尾塌在C。</b>钱几乎全在 A(9个SKU扛1997万)→ <b>现金牛意图实现了</b>。但 <b>21个SKU塌在C</b>=老品SKU泛滥(铺了没动/没真铺),这21个是<b>瘦身对象,不是补铺对象</b>(成熟品该少而精)。B只有4个小SKU。→ 健康的现金牛,但拖着一条僵尸长尾。',
   vcls='partial',
   verdict='<b>作为现金牛——实现了</b>(A象限9个SKU扛1997万)。<b>但意图与目标脱节:</b>战略说"衰退",H2却要它再涨36%;且21个SKU塌在C象限=没瘦身。',
   fix=['C象限21个SKU=瘦身对象:核查后砍掉僵尸,别补铺','目标与意图对齐:H2 +36% 不像"衰退收割",需澄清','红烧深折(880ML −25%)——别用折价拖老品'],
   h2=['收割维持、稳价、SKU瘦身','把货架与资源腾给遵循自然/有机','若确实要涨36%,"衰退"定位要正式改口'],
   res='<b>低投入维持</b>,现金反哺升级版。不追加铺货,先砍C象限21个僵尸,把货架让给遵循自然。'),

 dict(file='infinity_os_ly_sub_light.html', title='轻', stage='形象担当·跑反了', tagbg='rgba(255,95,95,.12)',tagc='#ff5f5f',
   intent='细分小众市场,提升品牌形象与联想——是形象担当,不是走量。',
   dacheng=45,ac='r',shi=117,mu=263,share=4.0,ramp=1.17,rc='a',live=7,skutot=26,dead=16,
   facts='<span>生抽 <b>76万</b></span><span>红烧 <b>24万</b></span><span>折价SKU <b>8(深折)</b></span>',
   facts2='深折:280ML −19%、500ML −18%。',
   quad=Q['轻'],
   quadnote='<b>形态:整个塌在C(16/20个SKU)。</b>一个"形象担当",<b>80%的SKU根本没在货架存在(C象限)</b>——连存在感都没有,形象联想从何谈起?仅有的3个A、1个B(还在折价)。<b>这是四个子品牌里2×2最塌的一个。</b>',
   vcls='no',
   verdict='<b>没有,而且跑反了。</b>16/20个SKU塌在C(没存在感),活着的少数还在深折(−18%)→ 折价亲手毁形象。<b>更根本:用"销量达成45%"考一个形象品牌就是错的KPI</b>,逼它折价冲量。',
   fix=['先想清:形象担当为何16个SKU没上架?是没铺还是没必要铺','立刻停深折(折价=反形象)','改KPI:考品牌联想/认知,不是销量','理清 轻 vs 遵循自然 定位重叠(差异化 or 并线)'],
   h2=['收折价、转形象投入(内容/高端陈列/场景)','先做定位决断(独立 or 并入遵循自然)','小而精:不追量,追被高端人群记住'],
   res='<b>形象型投入</b>(内容/陈列/KOL),不是降价补贴。预算小但花在"形象联想"上;先解决C象限"根本没上架"的存在感问题。'),

 dict(file='infinity_os_ly_sub_natural.html', title='遵循自然(升级版)', stage='成长期·欠火', tagbg='rgba(74,222,128,.12)',tagc='#4ade80',
   intent='经典的更新升级版;目标市场=夺回流失的老顾客 + 拉新年轻用户。',
   dacheng=76,ac='r',shi=661,mu=870,share=22.5,ramp=1.10,rc='a',live=7,skutot=38,dead=26,
   facts='<span>生抽 <b>374万</b></span><span>鲜味 <b>146万</b></span><span>红烧 <b>141万</b></span>',
   facts2='接棒主力:1.8L/1.3L轻盐生抽(114%/95%)。深折:1.3L −26%。',
   quad=Q['遵循自然'],
   quadnote='<b>形态:A成立 + 大片塌在C + 2个在B。</b>5个换代主力在 A(扛515万)→ <b>升级换代结构成立、意图在结构上实现</b>。但 <b>26个SKU塌在C</b>=铺货严重没到位(最大隐性差,含头号160ML);2个在B(目标261万只做146万,且折价)=投了还欠火。→ <b>结构成、执行欠。</b>',
   vcls='partial',
   verdict='<b>结构上在实现(A象限5个主力接棒成功),但执行欠火</b>:26个SKU塌在C(铺货没到位)。<b>盲区:有没有真"夺回老客+拉新年轻人",动销看不出</b>,需消费者数据 <span class="ph">账A</span>。',
   fix=['C象限26个=铺货主战场:头号160ML铺了却0动销,派核查补铺','B象限2个(1.8L鲜酱油)投了还欠且折价 → 进因果队列,别再降价','聚焦主力规格做透,别散铺','补红烧换代规格(遵循自然红烧缺位)','目标人群验证缺失 <span class="ph">需账A</span>'],
   h2=['抢成长:集中火力把C象限26个铺到位(尤其160ML)','补红烧换代、聚焦主力SKU不散铺','收深折→转价值沟通(0添加/健康)'],
   res='<b>重点投入(优先/成长担当)</b>,钱投在C象限"铺货补位"和红烧换代,<b>不是普惠降价</b>(B象限证明降价无效)。尽快接消费者数据验证目标人群。'),

 dict(file='infinity_os_ly_sub_organic.html', title='有机', stage='特色·信号好但薄', tagbg='rgba(167,139,250,.14)',tagc='#a78bfa',
   intent='面向更高端、有信念(健康/价值观)的人群——高端心智担当。',
   dacheng=192,ac='g',shi=139,mu=72,share=4.7,ramp=7.78,rc='r',live=1,skutot=5,dead=1,
   facts='<span>有机 <b>139万</b></span><span>唯一动销=纯松茸有机生抽</span>',
   facts2='500ML纯松茸有机生抽:139万/204%。H2目标560万(8倍)。',
   quad=Q['有机'],
   quadnote='<b>形态:全押在1个A上。</b>整条线就2个有目标SKU——1个在A(纯松茸,超额138万)+1个在C(没铺)。<b>信念人群意图在那1个A上验证了(它确实卖得动),但全部身家押在1个SKU上=极度脆弱。</b>H2要8倍,1个A扛不起。',
   vcls='ok',
   verdict='<b>早期信号好(那1个A超额192%),但极薄</b>——整条线靠1个SKU。H2要8倍(560万),1个A扛不起。LRC(更高层)还没进大润发。"信念人群"是否抓到 <span class="ph">需账A</span>。',
   fix=['只有1个A——必须造更多A的候选(扩有机产品线)才撑得起H2 8倍','C象限那1个(100ML)+ 评估更多规格/品类铺货','LRC缺位:评估是否进KA','守高端价(目前只1个轻折价)'],
   h2=['扩有机产品线,把"1个SKU的成功"复制成"一个系列"','评估LRC进KA','守价 + 信念/价值观内容,绝不降价'],
   res='<b>该加预算抢的唯一方向</b>(特色担当)。钱投在扩有机SKU + 信念内容,不是降价。它是高端心智的种子,但太薄,8倍目标必须靠扩线撑。'),
]
for d in DATA:
    html=page(d)
    open(d['file'],'w',encoding='utf-8').write(html)
    open('/mnt/user-data/outputs/'+d['file'],'w',encoding='utf-8').write(html)
    print('生成',d['file'],len(html),'字节 | div',html.count('<div'),'/',html.count('</div>'))
