# -*- coding: utf-8 -*-
import pandas as pd, re
g=pd.read_csv('ly_grid.csv')
for c in ['实际','目标15','销量']: g[c]=pd.to_numeric(g[c],errors='coerce').fillna(0)
g=g[g['目标15']>0].copy()
g['做了']=(g['实价'].notna())&(g['实价'].astype(str)!='')&(g['销量']>0)
g['达成']=g['实际']/g['目标15']*100
def spec_ml(s):
    s=str(s); m=re.findall(r'[\d.]+',s)
    if not m: return 99999
    v=float(m[0])
    if 'KG' in s or ('L' in s and 'ML' not in s): return v*1000
    return v
sb='遵循自然'
d=g[g['子品牌']==sb].copy()
d['ml']=d['规格'].map(spec_ml)
specs=sorted(d['规格'].unique(), key=spec_ml)
cats=['生抽','红烧','鲜味','老抽','蒸鱼']; cats=[c for c in cats if c in d['品类'].values]
def cell(cat,spec):
    rows=d[(d['品类']==cat)&(d['规格']==spec)]
    if len(rows)==0: return '<td></td>'
    r=rows.iloc[0]
    if not r['做了']:
        return f'<td class="g"><span>没动</span></td>'  # 没做/铺货存疑
    a=r['达成']
    cls='gr' if a>=100 else ('am' if a>=50 else 'rd')
    return f'<td class="{cls}"><span>{a:.0f}%</span></td>'
head='<tr><th>品类＼规格</th>'+''.join(f'<th>{s}</th>' for s in specs)+'</tr>'
body=''.join('<tr><td class="cat">'+c+'</td>'+''.join(cell(c,s) for s in specs)+'</tr>' for c in cats)
HTML=f"""<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>遵循自然 · 品类×规格 达成热力网格(更好的方法demo)</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap" rel="stylesheet">
<style>:root{{--bg:#09090f;--card:#141820;--border:rgba(255,255,255,.06);--text:#e8ecf5;--text2:#8a95aa;--text3:#4a5468;--amber:#f5a623;--green:#4ade80;--red:#ff5f5f;}}
*{{margin:0;padding:0;box-sizing:border-box}}body{{background:var(--bg);color:var(--text);font-family:'Noto Sans SC',sans-serif;padding-bottom:40px}}
.wrap{{max-width:880px;margin:0 auto;padding:0 13px}}
.top{{position:sticky;top:0;z-index:9;background:rgba(9,9,15,.94);backdrop-filter:blur(14px);border-bottom:1px solid var(--border);padding:10px 13px;display:flex;align-items:center;gap:9px}}
.sym{{width:25px;height:25px;border-radius:7px;background:linear-gradient(135deg,#f5a623,#ff7c38);display:flex;align-items:center;justify-content:center;font-weight:800;color:#000;font-size:12px;font-family:'Syne'}}
.bd{{font-family:'Syne';font-weight:700;font-size:12px}}.bd span{{color:var(--amber)}}.ver{{margin-left:auto;font-family:'Space Mono';font-size:10px;color:var(--text3)}}
.hero{{padding:16px 0 10px;border-bottom:1px solid var(--border)}}.kk{{font-family:'Space Mono';font-size:10px;color:var(--amber);letter-spacing:.08em;text-transform:uppercase}}
h1{{font-family:'Syne';font-size:22px;font-weight:800;margin:4px 0 6px}}h1 span{{color:var(--amber)}}.sub{{font-size:12px;color:var(--text2);line-height:1.5}}
.leg{{display:flex;gap:12px;flex-wrap:wrap;margin:12px 0;font-size:11px;color:var(--text2)}}.leg span{{display:flex;align-items:center;gap:5px}}.sw{{width:14px;height:14px;border-radius:3px}}
.tw{{overflow-x:auto;margin:6px 0}}
table{{border-collapse:collapse;font-size:11px;width:100%}}
th{{background:rgba(255,255,255,.04);color:var(--text3);padding:6px 5px;font-family:'Space Mono';font-size:9.5px;white-space:nowrap;border:1px solid var(--border);position:sticky;text-align:center}}
td{{padding:0;border:1px solid rgba(255,255,255,.05);text-align:center;height:34px;min-width:46px}}
td span{{display:flex;align-items:center;justify-content:center;height:100%;font-family:'Space Mono';font-size:10px;font-weight:700}}
td.cat{{background:rgba(78,205,196,.08);color:var(--text);font-weight:700;font-family:'Noto Sans SC';white-space:nowrap;padding:0 8px}}
td.gr span{{background:rgba(74,222,128,.22);color:#9ff0bf}}
td.am span{{background:rgba(245,166,35,.22);color:#ffd98a}}
td.rd span{{background:rgba(255,95,95,.22);color:#ffb3b3}}
td.g span{{background:rgba(120,130,150,.12);color:var(--text3)}}
.note{{margin:12px 0;padding:11px 14px;border-radius:10px;background:var(--card);border:1px solid var(--border);font-size:12.5px;color:var(--text2);line-height:1.65}}.note b{{color:var(--text)}}
.foot{{margin-top:14px;padding-top:11px;border-top:1px solid var(--border);font-size:9.5px;color:var(--text3);font-family:'Space Mono'}}</style></head><body>
<div class="top"><div class="sym">&#8734;</div><div class="bd">INFINITY <span>OS</span> · 达成热力网格</div><div class="ver">更好的方法·demo</div></div>
<div class="wrap"><div class="hero"><div class="kk">② 更好的方法 · 以 遵循自然 为样</div>
<h1>遵循自然 · <span>品类×规格 达成热力网格</span></h1>
<div class="sub">行=品类 · 列=规格(小→大)· 每格=一个SKU,颜色=达成率。<b>没有重叠、没有退化的轴,每个SKU都精确落在它真实的"品类×规格"位置上</b>——这是把象限图的信息装进网格,更清楚。</div></div>
<div class="leg"><span><span class="sw" style="background:rgba(74,222,128,.4)"></span>达成≥100(A)</span><span><span class="sw" style="background:rgba(245,166,35,.4)"></span>50-99(欠)</span><span><span class="sw" style="background:rgba(255,95,95,.4)"></span>&lt;50(差·B)</span><span><span class="sw" style="background:rgba(120,130,150,.25)"></span>没动(C·铺货存疑)</span></div>
<div class="tw"><table>{head}{body}</table></div>
<div class="note"><b>一眼读出来的:</b>① <b>生抽行</b>大规格(1.3L/1.8L)绿=换代主力成了;小规格(160ML)灰=没动(铺货存疑)。② <b>红烧行</b>大片灰/缺=遵循自然红烧换代<b>没跟上</b>(规格都没铺起来)。③ <b>鲜味行</b>红/橙=投了没达标(B,要因果)。<b>比象限气泡图多了"规格"这条真实的轴,品类的强弱、缺哪个规格,一目了然。</b></div>
<div class="foot">遵循自然 品类×规格达成热力网格 · 行品类·列规格(小→大)·色达成 · 大润发动销1-5月 · 署名 DS</div>
</div></body></html>"""
open('infinity_os_ly_heatgrid_natural.html','w',encoding='utf-8').write(HTML)
open('/mnt/user-data/outputs/infinity_os_ly_heatgrid_natural.html','w',encoding='utf-8').write(HTML)
print('②生成 heatgrid', len(HTML), '| 列(规格)数', len(specs), '| 行(品类)', cats)
