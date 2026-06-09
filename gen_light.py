# -*- coding: utf-8 -*-
import pandas as pd, re
g=pd.read_csv('ly_grid.csv')
for c in ['实际','目标15','销量']: g[c]=pd.to_numeric(g[c],errors='coerce').fillna(0)
g=g[g['目标15']>0].copy()
g['做了']=(g['实价'].notna())&(g['实价'].astype(str)!='')&(g['销量']>0)
g['达成']=g['实际']/g['目标15']*100
def clamp(v,a,b): return max(a,min(b,v))
def mapY(d):
    d=clamp(d,0,220); return 8+d*0.42 if d<=100 else clamp(50+(d-100)/120*42,50,92)
def spec_ml(s):
    s=str(s); m=re.findall(r'[\d.]+',s)
    if not m: return 99999
    v=float(m[0])
    if 'KG' in s or ('L' in s and 'ML' not in s): return v*1000
    return v
# 鲜明品类色(白底)
CAT={'鲜味':'#e8890c','生抽':'#2563eb','红烧':'#dc2626','老抽':'#7c3aed','蒸鱼':'#0891b2','有机':'#16a34a'}
def rgba(h,a):
    h=h.lstrip('#'); r,gg,b=int(h[0:2],16),int(h[2:4],16),int(h[4:6],16); return f'rgba({r},{gg},{b},{a})'
INTENT={'经典':'成熟衰退·现金牛','轻':'细分小众·提升品牌形象','遵循自然':'经典升级版·夺回老客+拉新','有机':'更高·有信念人群'}

LIGHT_CSS="""<style>:root{--bg:#f4f6f9;--card:#ffffff;--ink:#1b2230;--ink2:#5a6678;--ink3:#9aa4b4;--line:#e4e8ef;--amber:#d97706;}
*{margin:0;padding:0;box-sizing:border-box}body{background:var(--bg);color:var(--ink);font-family:'Noto Sans SC',sans-serif;line-height:1.5;padding-bottom:40px}
.wrap{max-width:700px;margin:0 auto;padding:0 13px}
.top{position:sticky;top:0;z-index:9;background:rgba(255,255,255,.95);backdrop-filter:blur(12px);border-bottom:1px solid var(--line);padding:10px 13px;display:flex;align-items:center;gap:9px}
.sym{width:25px;height:25px;border-radius:7px;background:linear-gradient(135deg,#f5a623,#ff7c38);display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:12px;font-family:'Syne'}
.bd{font-family:'Syne';font-weight:700;font-size:12px}.bd span{color:var(--amber)}.ver{margin-left:auto;font-family:'Space Mono';font-size:10px;color:var(--ink3)}
.hero{padding:16px 0 8px;border-bottom:1px solid var(--line)}.kk{font-family:'Space Mono';font-size:10px;color:var(--amber);letter-spacing:.06em;text-transform:uppercase}
h1{font-family:'Syne';font-size:22px;font-weight:800;margin:4px 0 5px}h1 span{color:var(--amber)}.sub{font-size:12px;color:var(--ink2)}
.leg{display:flex;flex-wrap:wrap;gap:9px;margin:10px 0 2px;font-size:11px}.leg span{display:flex;align-items:center;gap:5px;color:var(--ink2)}.ld{width:12px;height:12px;border-radius:50%}
.plotwrap{margin:14px 0 6px;padding-left:26px;padding-bottom:26px;position:relative}
.ylab{position:absolute;left:0;top:0;bottom:26px;width:20px;display:flex;align-items:center;justify-content:center}.ylab span{writing-mode:vertical-rl;transform:rotate(180deg);font-size:10px;color:var(--ink2);font-family:'Space Mono'}
.xlab{position:absolute;left:26px;right:0;bottom:2px;text-align:center;font-size:10px;color:var(--ink2);font-family:'Space Mono'}
.plot{position:relative;width:100%;padding-bottom:92%;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff}
.zone{position:absolute;width:50%;height:50%;padding:5px 7px}
.zTL{top:0;left:0;background:rgba(37,99,235,.04)}.zTR{top:0;left:50%;background:rgba(22,163,74,.05)}
.zBL{top:50%;left:0;background:rgba(217,119,6,.05)}.zBR{top:50%;left:50%;background:rgba(220,38,38,.045)}
.zl{font-family:'Space Mono';font-size:9px;color:var(--ink3)}.zn{font-family:'Syne';font-size:10px;font-weight:700;color:var(--ink3);margin-top:1px}
.vline{position:absolute;left:50%;top:0;bottom:0;width:1px;background:#cbd2dc}.hline{position:absolute;top:50%;left:0;right:0;height:1px;background:#cbd2dc}
.htxt{position:absolute;top:50%;left:3px;transform:translateY(-50%);font-size:8px;color:var(--ink3);font-family:'Space Mono';background:#fff;padding:0 2px;z-index:3}
.bub{position:absolute;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;transform:translate(-50%,50%);border:2px solid #fff;font-family:'Space Mono';font-size:7.5px;color:#fff;font-weight:700;line-height:1;z-index:5;box-shadow:0 1px 4px rgba(0,0,0,.18)}
.note{margin:8px 0;padding:10px 13px;border-radius:10px;background:var(--card);border:1px solid var(--line);font-size:12.5px;color:var(--ink2);line-height:1.6}.note b{color:var(--ink)}
.foot{margin-top:14px;padding-top:11px;border-top:1px solid var(--line);font-size:9.5px;color:var(--ink3);font-family:'Space Mono'}</style>"""

def chart(sb,fn):
    d=g[g['子品牌']==sb].copy()
    cats=[c for c in CAT if c in d['品类'].values]
    done=d[d['做了']].sort_values(['品类','达成'],ascending=[True,False]).reset_index(drop=True)
    notd=d[~d['做了']].sort_values(['品类','目标15'],ascending=[True,False]).reset_index(drop=True)
    bubs=[]
    for i,r in done.iterrows():
        v=max(r['实际'],r['目标15'])/10000; dia=clamp(16+v**0.5*5,16,58)
        x=57+(i%4)*9.5; y=mapY(r['达成']); c=CAT.get(r['品类'],'#888')
        lab=str(r['规格']) if dia>=32 else ''
        bubs.append((x,y,dia,c,lab))
    for j,r in notd.iterrows():
        v=r['目标15']/10000; dia=clamp(13+v**0.5*5,13,44)
        col=j%5; row=j//5; x=10+col*8.2; y=clamp(32-row*6,5,46); c=CAT.get(r['品类'],'#888')
        lab=str(r['规格']) if dia>=30 else ''
        bubs.append((x,y,dia,c,lab))
    bub=''.join(f'<div class="bub" style="left:{x}%;bottom:{y}%;width:{dia:.0f}px;height:{dia:.0f}px;background:{c}">{lab}</div>' for x,y,dia,c,lab in bubs)
    leg=''.join(f'<span><span class="ld" style="background:{CAT[c]}"></span>{c}</span>' for c in cats)
    html=f"""<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>六月鲜·{sb} 品类象限(白底)</title><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap" rel="stylesheet">{LIGHT_CSS}</head><body>
<div class="top"><div class="sym">&#8734;</div><div class="bd">INFINITY <span>OS</span> · {sb} 品类象限</div><div class="ver">白底·色=品类</div></div>
<div class="wrap"><div class="hero"><div class="kk">六月鲜·{sb} · 按品类上色</div>
<h1>{sb} · <span>品类×SKU 象限</span></h1><div class="sub">战略意图:{INTENT[sb]} · 横=执行 纵=达成 · <b>颜色=品类</b> · 气泡=规格SKU(大小=目标额)</div></div>
<div class="leg">{leg}</div>
<div class="plotwrap"><div class="ylab"><span>达成 低 → 高</span></div>
<div class="plot">
<div class="zone zTL"><div class="zl">没做×好</div><div class="zn">D</div></div><div class="zone zTR"><div class="zl">做了×好</div><div class="zn">A</div></div>
<div class="zone zBL"><div class="zl">没做×差</div><div class="zn">C</div></div><div class="zone zBR"><div class="zl">做了×差</div><div class="zn">B</div></div>
<div class="vline"></div><div class="hline"></div><div class="htxt">达成100%</div>
{bub}
</div><div class="xlab">执行 · 没做 ← → 做了</div></div>
<div class="note"><b>怎么看:</b>气泡<b>颜色=品类</b>,<b>位置=象限</b>(右上A好/右下B因果/左下C执行),<b>大小=目标额</b>。看同色气泡聚在哪个象限,就知道这个品类整体做得怎样。</div>
<div class="foot">六月鲜·{sb} 品类×SKU象限(白底)· 大润发动销1-5月 · 署名 DS</div>
</div></body></html>"""
    open(fn,'w',encoding='utf-8').write(html); open('/mnt/user-data/outputs/'+fn,'w',encoding='utf-8').write(html)
    print('①白底',fn,len(html))

for sb,en in {'经典':'classic','轻':'light','遵循自然':'natural','有机':'organic'}.items():
    chart(sb,f'infinity_os_ly_catquad_{en}.html')

# ---- 热力网格 白底 ----
sb='遵循自然'; d=g[g['子品牌']==sb].copy()
specs=sorted(d['规格'].unique(), key=spec_ml)
cats=[c for c in ['生抽','红烧','鲜味','老抽','蒸鱼'] if c in d['品类'].values]
def cell(cat,spec):
    rows=d[(d['品类']==cat)&(d['规格']==spec)]
    if len(rows)==0: return '<td></td>'
    r=rows.iloc[0]
    if not r['做了']: return '<td class="g"><span>没动</span></td>'
    a=r['达成']; cls='gr' if a>=100 else ('am' if a>=50 else 'rd')
    return f'<td class="{cls}"><span>{a:.0f}%</span></td>'
head='<tr><th>品类＼规格</th>'+''.join(f'<th>{s}</th>' for s in specs)+'</tr>'
body=''.join('<tr><td class="cat">'+c+'</td>'+''.join(cell(c,s) for s in specs)+'</tr>' for c in cats)
H=f"""<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>遵循自然·达成热力网格(白底)</title><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap" rel="stylesheet">
<style>:root{{--bg:#f4f6f9;--card:#fff;--ink:#1b2230;--ink2:#5a6678;--ink3:#9aa4b4;--line:#e4e8ef;--amber:#d97706}}
*{{margin:0;padding:0;box-sizing:border-box}}body{{background:var(--bg);color:var(--ink);font-family:'Noto Sans SC',sans-serif;padding-bottom:40px}}
.wrap{{max-width:900px;margin:0 auto;padding:0 13px}}
.top{{position:sticky;top:0;z-index:9;background:rgba(255,255,255,.95);backdrop-filter:blur(12px);border-bottom:1px solid var(--line);padding:10px 13px;display:flex;align-items:center;gap:9px}}
.sym{{width:25px;height:25px;border-radius:7px;background:linear-gradient(135deg,#f5a623,#ff7c38);display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:12px;font-family:'Syne'}}
.bd{{font-family:'Syne';font-weight:700;font-size:12px}}.bd span{{color:var(--amber)}}.ver{{margin-left:auto;font-family:'Space Mono';font-size:10px;color:var(--ink3)}}
.hero{{padding:16px 0 10px;border-bottom:1px solid var(--line)}}.kk{{font-family:'Space Mono';font-size:10px;color:var(--amber);letter-spacing:.06em;text-transform:uppercase}}
h1{{font-family:'Syne';font-size:22px;font-weight:800;margin:4px 0 6px}}h1 span{{color:var(--amber)}}.sub{{font-size:12px;color:var(--ink2);line-height:1.5}}
.leg{{display:flex;gap:12px;flex-wrap:wrap;margin:12px 0;font-size:11px;color:var(--ink2)}}.leg span{{display:flex;align-items:center;gap:5px}}.sw{{width:14px;height:14px;border-radius:3px}}
.tw{{overflow-x:auto;margin:6px 0}}table{{border-collapse:collapse;font-size:11px;width:100%}}
th{{background:#eef1f6;color:var(--ink2);padding:7px 5px;font-family:'Space Mono';font-size:9.5px;white-space:nowrap;border:1px solid var(--line);text-align:center}}
td{{padding:0;border:1px solid var(--line);text-align:center;height:36px;min-width:48px}}
td span{{display:flex;align-items:center;justify-content:center;height:100%;font-family:'Space Mono';font-size:10px;font-weight:700}}
td.cat{{background:#e0f2fe;color:var(--ink);font-weight:700;font-family:'Noto Sans SC';white-space:nowrap;padding:0 8px}}
td.gr span{{background:#86efac;color:#065f46}}td.am span{{background:#fde047;color:#854d0e}}td.rd span{{background:#fca5a5;color:#991b1b}}td.g span{{background:#dde1e7;color:#6b7280}}
.note{{margin:12px 0;padding:11px 14px;border-radius:10px;background:var(--card);border:1px solid var(--line);font-size:12.5px;color:var(--ink2);line-height:1.65}}.note b{{color:var(--ink)}}
.foot{{margin-top:14px;padding-top:11px;border-top:1px solid var(--line);font-size:9.5px;color:var(--ink3);font-family:'Space Mono'}}</style></head><body>
<div class="top"><div class="sym">&#8734;</div><div class="bd">INFINITY <span>OS</span> · 达成热力网格</div><div class="ver">白底·更清楚</div></div>
<div class="wrap"><div class="hero"><div class="kk">更好的方法 · 以 遵循自然 为样</div>
<h1>遵循自然 · <span>品类×规格 达成热力网格</span></h1>
<div class="sub">行=品类 · 列=规格(小→大)· 每格=一个SKU,颜色=达成率。每个SKU精确落在真实的"品类×规格"位置,无重叠。</div></div>
<div class="leg"><span><span class="sw" style="background:#86efac"></span>达成≥100</span><span><span class="sw" style="background:#fde047"></span>50-99(欠)</span><span><span class="sw" style="background:#fca5a5"></span>&lt;50(差)</span><span><span class="sw" style="background:#dde1e7"></span>没动(铺货存疑)</span></div>
<div class="tw"><table>{head}{body}</table></div>
<div class="note"><b>一眼读出:</b>① 生抽行大规格(1.3L/1.8L)绿=换代主力成了,小规格(160ML)灰=没动;② 红烧行大片灰/缺=红烧换代<b>没跟上</b>;③ 鲜味行红/橙=投了没达标(要因果)。<b>比象限气泡多了"规格"这条真实的轴,缺哪个规格一目了然。</b></div>
<div class="foot">遵循自然 品类×规格达成热力网格(白底)· 行品类·列规格(小→大)·色达成 · 大润发动销1-5月 · 署名 DS</div>
</div></body></html>"""
open('infinity_os_ly_heatgrid_natural.html','w',encoding='utf-8').write(H)
open('/mnt/user-data/outputs/infinity_os_ly_heatgrid_natural.html','w',encoding='utf-8').write(H)
print('②白底 heatgrid', len(H))
