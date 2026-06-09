# -*- coding: utf-8 -*-
import pandas as pd, re
g=pd.read_csv('ly_grid.csv')
for c in ['实际','目标15','销量']: g[c]=pd.to_numeric(g[c],errors='coerce').fillna(0)
g=g[g['目标15']>0].copy()
def spec_ml(s):
    s=str(s); m=re.findall(r'[\d.]+',s)
    if not m: return 99999
    v=float(m[0])
    if 'KG' in s or ('L' in s and 'ML' not in s): return v*1000
    return v
INTENT={'经典':'成熟衰退·现金牛','轻':'细分小众·提升品牌形象','遵循自然':'经典升级版·夺回老客+拉新','有机':'更高·有信念人群'}
CATORDER=['生抽','鲜味','红烧','老抽','蒸鱼','有机']
NOTE={
 '经典':'鲜味、红烧两行的大规格基本是绿/黄(现金牛在扛);灰格=铺了没动(瘦身候选)。同格多SKU已合并(×N)。',
 '轻':'整张偏黄偏灰——形象担当大面积"没动"或没达标。生抽500ML聚了4个SKU也只是黄,深折还没换来动销。',
 '遵循自然':'生抽行大规格绿(换代成),小规格(160ML)灰=没动;红烧行大片灰/缺=红烧换代没跟上;鲜味红/橙=投了没达标。',
 '有机':'就两格:松茸有机生抽500ML绿(超额),另一格没动。线太短,撑不起H2目标。',
}
def heat(sb,fn):
    d=g[g['子品牌']==sb].copy()
    specs=sorted(d['规格'].astype(str).unique(), key=spec_ml)
    cats=[c for c in CATORDER if c in d['品类'].values]
    agg=d.groupby(['品类','规格']).agg(实际=('实际','sum'),目标=('目标15','sum'),销量=('销量','sum'),n=('规格','size')).reset_index()
    def cell(cat,spec):
        r=agg[(agg['品类']==cat)&(agg['规格'].astype(str)==spec)]
        if len(r)==0: return '<td></td>'
        r=r.iloc[0]; n=int(r['n']); tag=f'<i>×{n}</i>' if n>1 else ''
        if r['销量']<=0 or r['目标']<=0: return f'<td class="g"><span>没动{tag}</span></td>'
        a=r['实际']/r['目标']*100
        cls='gr' if a>=100 else ('am' if a>=50 else 'rd')
        return f'<td class="{cls}"><span>{a:.0f}%{tag}</span></td>'
    head='<tr><th>品类＼规格</th>'+''.join(f'<th>{s}</th>' for s in specs)+'</tr>'
    body=''.join('<tr><td class="cat">'+c+'</td>'+''.join(cell(c,s) for s in specs)+'</tr>' for c in cats)
    H=f"""<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>六月鲜·{sb} 达成热力网格</title><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap" rel="stylesheet">
<style>:root{{--bg:#f4f6f9;--card:#fff;--ink:#1b2230;--ink2:#5a6678;--ink3:#9aa4b4;--line:#e4e8ef;--amber:#d97706}}
*{{margin:0;padding:0;box-sizing:border-box}}body{{background:var(--bg);color:var(--ink);font-family:'Noto Sans SC',sans-serif;padding-bottom:40px}}
.wrap{{max-width:920px;margin:0 auto;padding:0 13px}}
.top{{position:sticky;top:0;z-index:9;background:rgba(255,255,255,.95);backdrop-filter:blur(12px);border-bottom:1px solid var(--line);padding:10px 13px;display:flex;align-items:center;gap:9px}}
.sym{{width:25px;height:25px;border-radius:7px;background:linear-gradient(135deg,#f5a623,#ff7c38);display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:12px;font-family:'Syne'}}
.bd{{font-family:'Syne';font-weight:700;font-size:12px}}.bd span{{color:var(--amber)}}.ver{{margin-left:auto;font-family:'Space Mono';font-size:10px;color:var(--ink3)}}
.hero{{padding:16px 0 10px;border-bottom:1px solid var(--line)}}.kk{{font-family:'Space Mono';font-size:10px;color:var(--amber);letter-spacing:.06em;text-transform:uppercase}}
h1{{font-family:'Syne';font-size:22px;font-weight:800;margin:4px 0 6px}}h1 span{{color:var(--amber)}}.sub{{font-size:12px;color:var(--ink2);line-height:1.5}}
.leg{{display:flex;gap:11px;flex-wrap:wrap;margin:12px 0;font-size:11px;color:var(--ink2)}}.leg span{{display:flex;align-items:center;gap:5px}}.sw{{width:14px;height:14px;border-radius:3px}}
.tw{{overflow-x:auto;margin:6px 0}}table{{border-collapse:collapse;font-size:11px;width:100%}}
th{{background:#eef1f6;color:var(--ink2);padding:7px 5px;font-family:'Space Mono';font-size:9.5px;white-space:nowrap;border:1px solid var(--line);text-align:center}}
td{{padding:0;border:1px solid var(--line);text-align:center;height:38px;min-width:50px}}
td span{{display:flex;align-items:center;justify-content:center;height:100%;font-family:'Space Mono';font-size:10px;font-weight:700;position:relative}}
td span i{{font-style:normal;font-size:7.5px;opacity:.7;margin-left:2px}}
td.cat{{background:#e0f2fe;color:var(--ink);font-weight:700;font-family:'Noto Sans SC';white-space:nowrap;padding:0 8px}}
td.gr span{{background:#86efac;color:#065f46}}td.am span{{background:#fde047;color:#854d0e}}td.rd span{{background:#fca5a5;color:#991b1b}}td.g span{{background:#dde1e7;color:#6b7280}}
.note{{margin:12px 0;padding:11px 14px;border-radius:10px;background:var(--card);border:1px solid var(--line);font-size:12.5px;color:var(--ink2);line-height:1.65}}.note b{{color:var(--ink)}}
.foot{{margin-top:14px;padding-top:11px;border-top:1px solid var(--line);font-size:9.5px;color:var(--ink3);font-family:'Space Mono'}}</style></head><body>
<div class="top"><div class="sym">&#8734;</div><div class="bd">INFINITY <span>OS</span> · {sb} 热力网格</div><div class="ver">白底·同格合并×N</div></div>
<div class="wrap"><div class="hero"><div class="kk">六月鲜·{sb} · 品类×规格 达成热力</div>
<h1>{sb} · <span>达成热力网格</span></h1>
<div class="sub">战略意图:{INTENT[sb]} · 行=品类 列=规格(小→大)· 每格=该品类该规格全部SKU合并,颜色=达成率 ·"×N"=该格有N个SKU合并。</div></div>
<div class="leg"><span><span class="sw" style="background:#86efac"></span>达成≥100</span><span><span class="sw" style="background:#fde047"></span>50-99(欠)</span><span><span class="sw" style="background:#fca5a5"></span>&lt;50(差)</span><span><span class="sw" style="background:#dde1e7"></span>没动(铺货存疑)</span></div>
<div class="tw"><table>{head}{body}</table></div>
<div class="note"><b>读图:</b>{NOTE[sb]}</div>
<div class="foot">六月鲜·{sb} 品类×规格达成热力(白底·同格合并)· 大润发动销1-5月 · 署名 DS</div>
</div></body></html>"""
    open(fn,'w',encoding='utf-8').write(H); open('/mnt/user-data/outputs/'+fn,'w',encoding='utf-8').write(H)
    print('热力图',sb,fn,'| 列',len(specs),'行',len(cats))
for sb,en in {'经典':'classic','轻':'light','遵循自然':'natural','有机':'organic'}.items():
    heat(sb,f'infinity_os_ly_heatgrid_{en}.html')
