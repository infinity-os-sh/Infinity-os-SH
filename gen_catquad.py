# -*- coding: utf-8 -*-
import pandas as pd, re, math
g=pd.read_csv('ly_grid.csv')
for c in ['实际','目标15','销量']: g[c]=pd.to_numeric(g[c],errors='coerce').fillna(0)
g=g[g['目标15']>0].copy()
g['做了']=(g['实价'].notna())&(g['实价'].astype(str)!='')&(g['销量']>0)
g['达成']=g['实际']/g['目标15']*100
def clamp(v,a,b): return max(a,min(b,v))
def mapY(d):
    d=clamp(d,0,220); return 8+d*0.42 if d<=100 else clamp(50+(d-100)/120*42,50,92)
CAT={'鲜味':'#f5a623','生抽':'#60a5fa','红烧':'#ff7c48','老抽':'#a78bfa','蒸鱼':'#4ecdc4','有机':'#4ade80'}
def rgba(hexc,a):
    h=hexc.lstrip('#'); r,gg,b=int(h[0:2],16),int(h[2:4],16),int(h[4:6],16); return f'rgba({r},{gg},{b},{a})'
INTENT={'经典':'成熟衰退·现金牛','轻':'细分小众·提升品牌形象','遵循自然':'经典升级版·夺回老客+拉新','有机':'更高·有信念人群'}
CSS=open('quad_css.txt').read() if False else """<style>:root{--bg:#09090f;--card:#141820;--bg3:#13161f;--border:rgba(255,255,255,.06);--text:#e8ecf5;--text2:#8a95aa;--text3:#4a5468;--amber:#f5a623;}
*{margin:0;padding:0;box-sizing:border-box}body{background:var(--bg);color:var(--text);font-family:'Noto Sans SC',sans-serif;line-height:1.5;padding-bottom:40px}
.wrap{max-width:680px;margin:0 auto;padding:0 13px}
.top{position:sticky;top:0;z-index:9;background:rgba(9,9,15,.94);backdrop-filter:blur(14px);border-bottom:1px solid var(--border);padding:10px 13px;display:flex;align-items:center;gap:9px}
.sym{width:25px;height:25px;border-radius:7px;background:linear-gradient(135deg,#f5a623,#ff7c38);display:flex;align-items:center;justify-content:center;font-weight:800;color:#000;font-size:12px;font-family:'Syne'}
.bd{font-family:'Syne';font-weight:700;font-size:12px}.bd span{color:var(--amber)}.ver{margin-left:auto;font-family:'Space Mono';font-size:10px;color:var(--text3)}
.hero{padding:16px 0 8px;border-bottom:1px solid var(--border)}.kk{font-family:'Space Mono';font-size:10px;color:var(--amber);letter-spacing:.08em;text-transform:uppercase}
h1{font-family:'Syne';font-size:22px;font-weight:800;margin:4px 0 5px}h1 span{color:var(--amber)}.sub{font-size:12px;color:var(--text2)}
.leg{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 2px;font-size:11px}.leg span{display:flex;align-items:center;gap:4px;color:var(--text2)}.ld{width:11px;height:11px;border-radius:50%;border:1.5px solid}
.plotwrap{margin:14px 0 6px;padding-left:26px;padding-bottom:26px;position:relative}
.ylab{position:absolute;left:0;top:0;bottom:26px;width:20px;display:flex;align-items:center;justify-content:center}.ylab span{writing-mode:vertical-rl;transform:rotate(180deg);font-size:10px;color:var(--text2);font-family:'Space Mono'}
.xlab{position:absolute;left:26px;right:0;bottom:2px;text-align:center;font-size:10px;color:var(--text2);font-family:'Space Mono'}
.plot{position:relative;width:100%;padding-bottom:92%;border:1px solid rgba(255,255,255,.12);border-radius:10px;overflow:hidden;background:var(--bg3)}
.zone{position:absolute;width:50%;height:50%;padding:5px 7px}.zone{background:rgba(255,255,255,.012)}
.zl{font-family:'Space Mono';font-size:9px;color:var(--text3)}.zn{font-family:'Syne';font-size:10px;font-weight:700;color:var(--text3);margin-top:1px}
.zTL{top:0;left:0}.zTR{top:0;left:50%}.zBL{top:50%;left:0}.zBR{top:50%;left:50%}
.vline{position:absolute;left:50%;top:0;bottom:0;width:1px;background:rgba(255,255,255,.13)}.hline{position:absolute;top:50%;left:0;right:0;height:1px;background:rgba(255,255,255,.13)}
.htxt{position:absolute;top:50%;left:3px;transform:translateY(-50%);font-size:8px;color:var(--text3);font-family:'Space Mono';background:var(--bg3);padding:0 2px;z-index:3}
.bub{position:absolute;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;transform:translate(-50%,50%);border:1.5px solid;font-family:'Space Mono';font-size:7.5px;color:#fff;font-weight:700;line-height:1;z-index:5}
.note{margin:8px 0;padding:10px 13px;border-radius:10px;background:var(--card);border:1px solid var(--border);font-size:12.5px;color:var(--text2);line-height:1.6}.note b{color:var(--text)}
.foot{margin-top:14px;padding-top:11px;border-top:1px solid var(--border);font-size:9.5px;color:var(--text3);font-family:'Space Mono'}</style>"""

def spec_ml(s):
    s=str(s); m=re.findall(r'[\d.]+',s)
    if not m: return 99999
    v=float(m[0])
    if 'KG' in s or ('L' in s and 'ML' not in s): return v*1000
    return v

def chart(sb,fn):
    d=g[g['子品牌']==sb].copy()
    cats=[c for c in CAT if c in d['品类'].values]
    done=d[d['做了']].copy(); notd=d[~d['做了']].copy()
    bubs=[]
    # 做了:右半,按品类分组聚集 + 达成定Y
    done=done.sort_values(['品类','达成'],ascending=[True,False]).reset_index(drop=True)
    for i,r in done.iterrows():
        v=max(r['实际'],r['目标15'])/10000; dia=clamp(15+v**0.5*5,15,56)
        x=57+(i%4)*9.5; y=mapY(r['达成']); c=CAT.get(r['品类'],'#888')
        lab=str(r['规格']) if dia>=32 else ''
        bubs.append((x,y,dia,c,lab))
    # 没做:左下网格,按品类排序
    notd=notd.sort_values(['品类','目标15'],ascending=[True,False]).reset_index(drop=True)
    for j,r in notd.iterrows():
        v=r['目标15']/10000; dia=clamp(13+v**0.5*5,13,44)
        col=j%5; row=j//5; x=10+col*8.2; y=clamp(32-row*6,5,46); c=CAT.get(r['品类'],'#888')
        lab=str(r['规格']) if dia>=29 else ''
        bubs.append((x,y,dia,c,lab))
    bub=''.join(f'<div class="bub" style="left:{x}%;bottom:{y}%;width:{dia:.0f}px;height:{dia:.0f}px;background:{rgba(c,.20)};border-color:{c}">{lab}</div>' for x,y,dia,c,lab in bubs)
    leg=''.join(f'<span><span class="ld" style="border-color:{CAT[c]};background:{rgba(CAT[c],.2)}"></span>{c}</span>' for c in cats)
    html=f"""<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>六月鲜·{sb} 品类象限</title><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap" rel="stylesheet">{CSS}</head><body>
<div class="top"><div class="sym">&#8734;</div><div class="bd">INFINITY <span>OS</span> · {sb} 品类象限</div><div class="ver">色=品类·气泡=规格SKU</div></div>
<div class="wrap"><div class="hero"><div class="kk">六月鲜·{sb} · 按品类上色</div>
<h1>{sb} · <span>品类×SKU 象限</span></h1><div class="sub">战略意图:{INTENT[sb]} · 横=执行 纵=达成 · <b>颜色=品类</b> · 每个气泡=一个规格SKU(大小=目标额)</div></div>
<div class="leg">{leg}</div>
<div class="plotwrap"><div class="ylab"><span>达成 低 → 高</span></div>
<div class="plot">
<div class="zone zTL"><div class="zl">没做×好</div><div class="zn">D</div></div><div class="zone zTR"><div class="zl">做了×好</div><div class="zn">A</div></div>
<div class="zone zBL"><div class="zl">没做×差</div><div class="zn">C</div></div><div class="zone zBR"><div class="zl">做了×差</div><div class="zn">B</div></div>
<div class="vline"></div><div class="hline"></div><div class="htxt">达成100%</div>
{bub}
</div><div class="xlab">执行 · 没做 ← → 做了</div></div>
<div class="note"><b>怎么看:</b>气泡<b>颜色</b>=品类,<b>位置</b>=象限(右上A好/右下B因果/左下C执行),<b>大小</b>=目标额。看同色气泡聚在哪个象限,就知道这个品类整体做得怎样——比如 {sb} 里某个品类全在C,说明那个品类铺货没到位。</div>
<div class="foot">六月鲜·{sb} 品类×SKU象限 · 色=品类·位=象限·大小=目标额 · 大润发动销1-5月 · 署名 DS</div>
</div></body></html>"""
    open(fn,'w',encoding='utf-8').write(html); open('/mnt/user-data/outputs/'+fn,'w',encoding='utf-8').write(html)
    print('①生成',fn,len(html))

for sb,en in {'经典':'classic','轻':'light','遵循自然':'natural','有机':'organic'}.items():
    chart(sb,f'infinity_os_ly_catquad_{en}.html')
