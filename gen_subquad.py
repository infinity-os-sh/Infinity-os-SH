# -*- coding: utf-8 -*-
import pandas as pd
g=pd.read_csv('ly_grid.csv')
for c in ['实际','目标15','销量']: g[c]=pd.to_numeric(g[c],errors='coerce').fillna(0)
g=g[g['目标15']>0].copy()
g['做了']=(g['实价'].notna())&(g['实价'].astype(str)!='')&(g['销量']>0)
g['达成']=(g['实际']/g['目标15']*100)
def quad(r):
    good=r['实际']>=r['目标15']*0.8
    if r['做了'] and good: return 'A'
    if r['做了']: return 'B'
    if not good: return 'C'
    return 'D'
g['Q']=g.apply(quad,axis=1)
import math
def clamp(v,a,b): return max(a,min(b,v))
def mapY(d):
    d=clamp(d,0,220)
    return 8+d*0.42 if d<=100 else clamp(50+(d-100)/120*42,50,92)
COL={'A':('rgba(74,222,128,.16)','#4ade80'),'B':('rgba(255,95,95,.16)','#ff5f5f'),'C':('rgba(245,166,35,.15)','#f5a623'),'D':('rgba(96,165,250,.12)','#60a5fa')}
INTENT={'经典':'成熟衰退·现金牛','轻':'细分小众·提升品牌形象','遵循自然':'经典升级版·夺回老客+拉新年轻','有机':'更高·有信念人群'}
NOTE={
 '经典':'几个大气泡稳在 A(现金牛在扛),左下 C 一片小气泡=21个该瘦身的僵尸SKU。',
 '轻':'几乎全堆在左下 C——一半SKU没真上架、达成又差。形象担当连货架存在感都没有。',
 '遵循自然':'右上有几个 A 主力(1.8L/1.3L轻盐生抽接棒成功),但左下 C 一大片(铺货没到位),右下 2个 B(投了还欠)。',
 '有机':'就 1 个 A(纯松茸,超额)+ 1 个 C。全部身家押 1 个气泡=太薄。',
}
CSS="""<style>:root{--bg:#09090f;--card:#141820;--bg3:#13161f;--border:rgba(255,255,255,.06);--text:#e8ecf5;--text2:#8a95aa;--text3:#4a5468;--amber:#f5a623;--teal:#4ecdc4;--red:#ff5f5f;--green:#4ade80;--blue:#60a5fa;--purple:#a78bfa;}
*{margin:0;padding:0;box-sizing:border-box}body{background:var(--bg);color:var(--text);font-family:'Noto Sans SC',sans-serif;line-height:1.5;padding-bottom:40px}
.wrap{max-width:680px;margin:0 auto;padding:0 13px}
.top{position:sticky;top:0;z-index:9;background:rgba(9,9,15,.94);backdrop-filter:blur(14px);border-bottom:1px solid var(--border);padding:10px 13px;display:flex;align-items:center;gap:9px}
.sym{width:25px;height:25px;border-radius:7px;background:linear-gradient(135deg,#f5a623,#ff7c38);display:flex;align-items:center;justify-content:center;font-weight:800;color:#000;font-size:12px;font-family:'Syne'}
.bd{font-family:'Syne';font-weight:700;font-size:12px}.bd span{color:var(--amber)}
.ver{margin-left:auto;font-family:'Space Mono';font-size:10px;color:var(--text3)}
.hero{padding:16px 0 8px;border-bottom:1px solid var(--border)}
.kk{font-family:'Space Mono';font-size:10px;color:var(--amber);letter-spacing:.08em;text-transform:uppercase}
h1{font-family:'Syne';font-size:22px;font-weight:800;margin:4px 0 5px}h1 span{color:var(--amber)}
.sub{font-size:12px;color:var(--text2)}
.plotwrap{margin:18px 0 6px;padding-left:26px;padding-bottom:26px;position:relative}
.ylab{position:absolute;left:0;top:0;bottom:26px;width:20px;display:flex;align-items:center;justify-content:center}
.ylab span{writing-mode:vertical-rl;transform:rotate(180deg);font-size:10px;color:var(--text2);font-family:'Space Mono'}
.xlab{position:absolute;left:26px;right:0;bottom:2px;text-align:center;font-size:10px;color:var(--text2);font-family:'Space Mono'}
.plot{position:relative;width:100%;padding-bottom:92%;border:1px solid rgba(255,255,255,.12);border-radius:10px;overflow:hidden;background:var(--bg3)}
.zone{position:absolute;width:50%;height:50%;padding:6px 8px}
.zTL{top:0;left:0;background:rgba(96,165,250,.04)}.zTR{top:0;left:50%;background:rgba(74,222,128,.05)}
.zBL{top:50%;left:0;background:rgba(245,166,35,.05)}.zBR{top:50%;left:50%;background:rgba(255,95,95,.06)}
.zl{font-family:'Space Mono';font-size:9px}.zTL .zl{color:var(--blue)}.zTR .zl{color:var(--green)}.zBL .zl{color:var(--amber)}.zBR .zl{color:var(--red)}
.zn{font-family:'Syne';font-size:11px;font-weight:700;margin-top:1px}.zTL .zn{color:var(--blue)}.zTR .zn{color:var(--green)}.zBL .zn{color:var(--amber)}.zBR .zn{color:var(--red)}
.vline{position:absolute;left:50%;top:0;bottom:0;width:1px;background:rgba(255,255,255,.13)}.hline{position:absolute;top:50%;left:0;right:0;height:1px;background:rgba(255,255,255,.13)}
.htxt{position:absolute;top:50%;left:3px;transform:translateY(-50%);font-size:8px;color:var(--text3);font-family:'Space Mono';background:var(--bg3);padding:0 2px;z-index:3}
.bub{position:absolute;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;transform:translate(-50%,50%);border:1.4px solid;font-family:'Space Mono';font-size:8px;color:#fff;font-weight:700;line-height:1;z-index:5}
.cnt{margin:8px 0;display:flex;gap:7px;flex-wrap:wrap;font-size:11px}
.pill{border-radius:8px;padding:3px 9px;border:1px solid}
.note{margin:8px 0;padding:10px 13px;border-radius:10px;background:var(--card);border:1px solid var(--border);font-size:12.5px;color:var(--text2);line-height:1.6}.note b{color:var(--text)}
.foot{margin-top:14px;padding-top:11px;border-top:1px solid var(--border);font-size:9.5px;color:var(--text3);font-family:'Space Mono'}</style>"""

def chart(sb):
    d=g[g['子品牌']==sb].copy()
    done=d[d['做了']].sort_values('达成',ascending=False).reset_index(drop=True)
    notd=d[~d['做了']].sort_values('目标15',ascending=False).reset_index(drop=True)
    bubs=[]
    # 做了:右半,X按序错开,Y按达成
    for i,r in done.iterrows():
        v=max(r['实际'],r['目标15'])/10000
        dia=clamp(16+v**0.5*5,16,60)
        x=58+(i%4)*9
        y=mapY(r['达成'])
        c=COL[r['Q']]
        lab=str(r['规格']) if dia>=34 else ''
        bubs.append((x,y,dia,c,lab))
    # 没做:左下网格
    for j,r in notd.iterrows():
        v=r['目标15']/10000
        dia=clamp(14+v**0.5*5,14,46)
        col=j%5; row=j//5
        x=11+col*8; y=clamp(30-row*6,6,46)
        c=COL['C']
        lab=str(r['规格']) if dia>=30 else ''
        bubs.append((x,y,dia,c,lab))
    bubhtml=''.join(f'<div class="bub" style="left:{x}%;bottom:{y}%;width:{dia:.0f}px;height:{dia:.0f}px;background:{c[0]};border-color:{c[1]}">{lab}</div>' for x,y,dia,c,lab in bubs)
    # counts
    qc={Q:int((d['Q']==Q).sum()) for Q in 'ABCD'}
    pills=(f'<span class="pill" style="border-color:#4ade80;color:#4ade80">A 做了好 {qc["A"]}</span>'
           f'<span class="pill" style="border-color:#ff5f5f;color:#ff5f5f">B 做了差 {qc["B"]}</span>'
           f'<span class="pill" style="border-color:#f5a623;color:#f5a623">C 没做差 {qc["C"]}</span>')
    html=f"""<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>六月鲜·{sb} SKU象限</title><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap" rel="stylesheet">{CSS}</head><body>
<div class="top"><div class="sym">&#8734;</div><div class="bd">INFINITY <span>OS</span> · {sb} SKU象限</div><div class="ver">单独一张</div></div>
<div class="wrap"><div class="hero"><div class="kk">六月鲜·{sb} · 每个SKU一个气泡</div>
<h1>{sb} · <span>SKU 象限图</span></h1><div class="sub">战略意图:{INTENT[sb]} · 横=执行(做了没做)纵=业绩(达成)· 气泡大小=目标额</div></div>
<div class="cnt">{pills}</div>
<div class="plotwrap"><div class="ylab"><span>达成 低 → 高</span></div>
<div class="plot">
<div class="zone zTL"><div class="zl">没做×好</div><div class="zn">D 设计错</div></div>
<div class="zone zTR"><div class="zl">做了×好</div><div class="zn">A 有效</div></div>
<div class="zone zBL"><div class="zl">没做×差</div><div class="zn">C 执行</div></div>
<div class="zone zBR"><div class="zl">做了×差</div><div class="zn">B 因果</div></div>
<div class="vline"></div><div class="hline"></div><div class="htxt">达成100%</div>
{bubhtml}
</div><div class="xlab">执行 · 没做 ← → 做了</div></div>
<div class="note"><b>读图:</b>{NOTE[sb]}</div>
<div class="foot">六月鲜·{sb} SKU级象限 · 口径:大润发动销1-5月 · 气泡=目标额·色=象限 · 署名 DS</div>
</div></body></html>"""
    return html

fmap={'经典':'classic','轻':'light','遵循自然':'natural','有机':'organic'}
for sb,en in fmap.items():
    fn=f'infinity_os_ly_quad_{en}.html'
    h=chart(sb)
    open(fn,'w',encoding='utf-8').write(h)
    open('/mnt/user-data/outputs/'+fn,'w',encoding='utf-8').write(h)
    print('生成',fn,len(h),'字节')
