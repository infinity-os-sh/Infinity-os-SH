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
.owner{font-family:'Space Mono',monospace;font-size:11px;color:var(--text3);margin-top:8px}
.owner b{color:var(--text2)}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0}
.kpi{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 6px;text-align:center}
.kv{font-family:'Syne';font-size:19px;font-weight:800;line-height:1}.kl{font-size:9px;color:var(--text3);margin-top:4px;line-height:1.3}
.g{color:var(--green)}.a{color:var(--amber)}.r{color:var(--red)}.t{color:var(--teal)}
.sec{margin:15px 0;border:1px solid var(--border);border-radius:12px;background:var(--card);overflow:hidden}
.sh{padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px;font-weight:700;display:flex;align-items:center;gap:7px}
.sh .em{font-size:15px}
.body{padding:11px 14px;font-size:12.5px;color:var(--text2)}
.body li{margin:6px 0;list-style:none;padding-left:16px;position:relative}
.body li::before{content:'▸';position:absolute;left:0;color:var(--amber)}
.dl{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:12px}
.dl span{color:var(--text2)}.dl b{color:var(--text)}
.verdict{padding:12px 14px;font-size:13px;line-height:1.6}
.verdict.no{background:rgba(255,95,95,.07);border-left:3px solid var(--red)}
.verdict.partial{background:rgba(245,166,35,.06);border-left:3px solid var(--amber)}
.verdict.ok{background:rgba(74,222,128,.06);border-left:3px solid var(--green)}
.verdict b{color:var(--text)}
.res{background:rgba(78,205,196,.06);border:1px solid rgba(78,205,196,.22);border-radius:11px;padding:12px 14px;font-size:13px;color:var(--text);margin:15px 0}
.res b{color:var(--teal)}
.ph{display:inline-block;font-family:'Space Mono',monospace;font-size:9.5px;color:var(--blue);border:1px solid rgba(96,165,250,.3);border-radius:5px;padding:1px 6px;margin-left:3px}
.foot{margin-top:20px;padding-top:13px;border-top:1px solid var(--border);font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;line-height:1.6}
.tag{display:inline-block;font-size:10px;padding:2px 9px;border-radius:9px;margin-left:6px;vertical-align:middle}
</style>"""

HEAD = """<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} · 战略意图实现度</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&family=Space+Mono:wght@400;700&family=Syne:wght@600;700;800&display=swap" rel="stylesheet">""" + CSS + """</head><body>
<div class="top"><div class="sym">&#8734;</div><div class="bd">INFINITY <span>OS</span> · 六月鲜子品牌</div><div class="ver">动销基准 · H1 1-5月</div></div>
<div class="wrap">"""

def li(items): return ''.join(f"<li>{x}</li>" for x in items)

def page(d):
    h=HEAD.replace('{title}', d['title'])
    h+=f"""<div class="hero"><div class="kk">战略意图 vs 实际 · 该做对的事做到没</div>
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
    h+=f"""<div class="sec"><div class="sh"><span class="em">🎯</span>意图实现了吗?</div><div class="verdict {d['vcls']}">{d['verdict']}</div></div>"""
    h+=f"""<div class="sec"><div class="sh"><span class="em">🔧</span>需要加强的点</div><div class="body"><ul>{li(d['fix'])}</ul></div></div>"""
    h+=f"""<div class="sec"><div class="sh"><span class="em">🗓️</span>下半年(H2)策略调整</div><div class="body"><ul>{li(d['h2'])}</ul></div></div>"""
    h+=f"""<div class="res"><b>💰 资源投入方向:</b>{d['res']}</div>"""
    h+=f"""<div class="foot">六月鲜·{d['title']} 战略意图实现度 · 口径:大润发1279店动销sellout·1-5月 · 目标人群是否抓到 <span class="ph">需消费者数据·账A</span> · 署名 DS</div>
    </div></body></html>"""
    return h

DATA=[
 dict(file='infinity_os_ly_sub_classic.html', title='经典(老品)', stage='成熟衰退期', tagbg='rgba(138,149,170,.15)',tagc='#8a95aa',
   intent='成熟衰退期的老品——当现金牛,稳住基本盘,为升级版输血。',
   dacheng=103,ac='g',shi=2022,mu=1955,share=68.8,ramp=1.36,rc='a',live=13,skutot=34,dead=21,
   facts='<span>鲜味 <b>1481万</b></span><span>红烧 <b>541万</b></span><span>折价SKU <b>13</b></span>',
   facts2='扛把子动销:880ML减盐33%(780万/117%)、1.8L特级(346万/133%)、880ML红烧(264万/117%)。红烧深折:880ML −25%。',
   vcls='partial',
   verdict='<b>作为现金牛——实现了</b>(仍扛68.8%、超额103%)。<b>但出现意图与目标脱节:</b>战略说"衰退",H2目标却要它再涨36%(2664万)——嘴上说衰退、手上还当增长引擎压指标。同时34个SKU只13个活、21个铺了没动,老品没瘦身。',
   fix=['目标与意图对齐:到底收割还是要增长?H2 1.36× 不像"衰退收割",需澄清口径','瘦身:砍掉21个"铺了没动"的老SKU,成熟品要少而精','红烧在深折(880ML −25%)——别用折价拖着老品,损毛利又无益'],
   h2=['定位收割:稳价、维持铺货、不追加投入','SKU瘦身,把货架与资源腾给遵循自然/有机','若公司确实要它涨36%,则"衰退"定位要正式改口,不能既要又要'],
   res='<b>低投入维持</b>,现金反哺升级版。不追加铺货,把货架让位给遵循自然——经典的钱要去养换代,不是养自己。'),

 dict(file='infinity_os_ly_sub_light.html', title='轻', stage='形象担当·跑反了', tagbg='rgba(255,95,95,.12)',tagc='#ff5f5f',
   intent='细分小众市场,提升品牌形象与联想——是形象担当,不是走量。',
   dacheng=45,ac='r',shi=117,mu=263,share=4.0,ramp=1.17,rc='a',live=7,skutot=26,dead=16,
   facts='<span>生抽 <b>76万</b></span><span>红烧 <b>24万</b></span><span>折价SKU <b>8(深折)</b></span>',
   facts2='深折:280ML −19%、500ML −18%。最大缺口:500ML轻8克(0动销·缺43万)、500ML轻10克(0动销·缺30万)。',
   vcls='no',
   verdict='<b>没有,而且方向跑反了。</b>一个"提升形象"的子品牌却在 −18%~−19% 深度折价——折价正在<b>亲手摧毁</b>它要建的高端形象联想,意图与执行完全相反。而且和遵循自然(都主打轻盐/健康)严重重叠,消费者分不清。<b>更深的问题:用"销量达成45%"考一个形象品牌,本身就是错的KPI</b>——逼它去折价冲量,把形象做没了。',
   fix=['立刻停深折:折价 = 反形象,与意图直接冲突','改对KPI:形象担当考"品牌联想/认知/高端场景渗透",不是销量达成','理清 轻 vs 遵循自然 的定位重叠——差异化(轻=精准克数轻盐心智)或并线,二选一'],
   h2=['收折价、转形象投入(内容/高端陈列/场景体验)','先做定位决断(独立 or 并入遵循自然),再谈打法','小而精:不追销量规模,追"被高端人群记住"'],
   res='<b>形象型投入</b>(内容/陈列/KOL/场景),<b>不是降价补贴</b>。预算可以小,但每一分要花在"形象联想"上而非"出货量"上——这是衡量轻成败的唯一正确标尺。'),

 dict(file='infinity_os_ly_sub_natural.html', title='遵循自然(升级版)', stage='成长期·欠火', tagbg='rgba(74,222,128,.12)',tagc='#4ade80',
   intent='经典的更新升级版;目标市场=夺回流失的老顾客 + 拉新年轻用户。',
   dacheng=76,ac='r',shi=661,mu=870,share=22.5,ramp=1.10,rc='a',live=7,skutot=38,dead=26,
   facts='<span>生抽 <b>374万</b></span><span>鲜味 <b>146万</b></span><span>红烧 <b>141万</b></span><span>折价 <b>7</b></span>',
   facts2='接棒主力:1.8L轻盐生抽(145万/114%)、1.3L轻盐生抽(139万/95%)。最大缺口:1.8L鲜酱油(缺82万/61%)、<b>160ML轻盐生抽(铺了却0动销·缺77万)</b>。深折:1.3L −26%。',
   vcls='partial',
   verdict='<b>结构上在实现(确实在接棒——生抽换代已完成、占比已第二),但执行上欠火</b>(76%、26个铺了没动)。<b>关键盲区:"夺回流失老客+拉新年轻人"这个目标人群有没有真抓到,这份动销数据看不出来</b>——只知道卖了多少,不知道卖给了谁。要消费者数据(账A)才能验证意图核心。',
   fix=['208万缺口主攻:160ML轻盐生抽铺了却0动销 → 查铺货到位率/陈列/认知','26个"铺了没动"=铺太散、动销没跟上 → 聚焦少数主力规格做透,别散','1.8L大规格鲜酱油只61% → 大规格动销没起','补红烧换代规格(遵循自然红烧缺位,复制生抽换代的成功)','收深折(1.3L −26%)——升级版靠折价冲量会伤价值感','目标人群验证缺失 <span class="ph">需账A</span>:有没有抓到流失老客/年轻人,无数据'],
   h2=['抢成长:集中火力关208万缺口(主攻160ML动销、1.8L大规格)','补红烧换代规格,把生抽的成功复制过去','收折价→转价值沟通(0添加/健康),聚焦主力SKU不再散铺'],
   res='<b>重点投入(优先/成长担当)</b>,但钱要投在"已铺却不动销的SKU(160ML等)"和"红烧换代补位"上,<b>不是普惠降价</b>。同时尽快接消费者数据,验证有没有真的抓到流失老客与年轻人——这是它的存在理由。'),

 dict(file='infinity_os_ly_sub_organic.html', title='有机', stage='特色·早期信号好但薄', tagbg='rgba(167,139,250,.14)',tagc='#a78bfa',
   intent='面向更高端、有信念(健康/价值观)的人群——高端心智担当。',
   dacheng=192,ac='g',shi=139,mu=72,share=4.7,ramp=7.78,rc='r',live=1,skutot=5,dead=1,
   facts='<span>有机 <b>139万</b></span><span>唯一动销=纯松茸有机生抽</span><span>折价 <b>1(−10%)</b></span>',
   facts2='500ML纯松茸有机生抽:139万/达成204%——整个有机就靠它<b>一个SKU</b>在扛。H2目标560万(8倍爬坡)。',
   vcls='ok',
   verdict='<b>早期信号好(超额192%),但极度脆弱——整个有机靠1个SKU撑着。</b>H2要8倍(560万),用1个活SKU去扛8倍 = 空中楼阁,产品线太薄。LRC(更高一层)在大润发干脆没铺,"更高人群"这条线整体单薄。"有信念人群"是否抓到 <span class="ph">需账A</span>。',
   fix=['产品线太薄(1活/5):H2要8倍,必须铺更多有机SKU,否则8倍是空话','LRC缺位:"更高人群"的顶层旗舰没进渠道 → 评估是否进KA','守住高端价(目前仅1个折价,好,继续守)','信念人群验证缺失 <span class="ph">需账A</span>'],
   h2=['扩有机产品线(规格/品类),把"1个SKU的成功"复制成"一个系列",支撑8倍爬坡','评估 LRC 进 KA 的时机','守价 + 信念/价值观内容沟通,绝不降价'],
   res='<b>该加预算抢的唯一方向</b>(特色担当)。钱投在"铺更多有机SKU"+"信念内容/高端场景",<b>不是降价</b>。这是六月鲜未来高端心智的种子,但现在太薄,H2的8倍目标必须靠扩线撑起来。'),
]

import os
os.makedirs('/mnt/user-data/outputs',exist_ok=True)
for d in DATA:
    html=page(d)
    open(d['file'],'w',encoding='utf-8').write(html)
    open('/mnt/user-data/outputs/'+d['file'],'w',encoding='utf-8').write(html)
    print('生成', d['file'], len(html),'字节 | div', html.count('<div'),'/',html.count('</div>'))
