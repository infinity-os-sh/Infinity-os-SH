# -*- coding: utf-8 -*-
# qzcv5 真点测试套(可移植·合并版)
# 覆盖 = 回归段R(五屏/五本账/归因卡/校准闸/六期Gate/HITL/收入四段) + 差距经营段G(十问/状态机/HITL锁执行/验果引擎/根因记忆)
# 诚实计数:本文件实际运行多少项就报多少项,不虚报。
# 运行:python3 qzcv5test.py   (同目录放 qzcv5.html;浏览器默认 pw.chromium.launch(),
#       可用环境变量 QZC_CHROMIUM 指定 executable_path,兼容 PLAYWRIGHT_BROWSERS_PATH)
import os, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

HTML = Path(__file__).with_name("qzcv5.html")
assert HTML.exists(), f"missing {HTML}"
URL = HTML.as_uri()

R=[]
def ck(n,c):
    R.append((n,bool(c)))
    if not c: print("FAIL:",n)

def launch(pw):
    exe = os.environ.get("QZC_CHROMIUM")
    if exe: return pw.chromium.launch(executable_path=exe)
    try:
        return pw.chromium.launch()
    except Exception:
        # 兜底:在 PLAYWRIGHT_BROWSERS_PATH 下自动寻找 headless_shell
        base = os.environ.get("PLAYWRIGHT_BROWSERS_PATH","/opt/pw-browsers")
        for d in sorted(Path(base).glob("chromium_headless_shell-*/chrome-linux/headless_shell")):
            return pw.chromium.launch(executable_path=str(d))
        raise

with sync_playwright() as pw:
    b=launch(pw)

    # ═══════════ 回归段 R(SR-6604 员工视角)═══════════
    E1=[]
    pg=b.new_page(viewport={"width":420,"height":950})
    pg.on("pageerror",lambda e:E1.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(400)
    ck("R01 加载零JS错误", len(E1)==0)
    ck("R02 五屏Tab在", pg.locator(".tab").count()==5)
    ck("R03 水印=qzcv5", "qzcv5" in pg.inner_text(".wm"))
    ck("R04 Tab标签=五本账", "五本账" in pg.inner_text('.tab[data-s="scrledger"]'))

    # 五本账
    pg.click('.tab[data-s="scrledger"]'); pg.wait_for_timeout(80)
    ck("R05 五本账选择器=5账", pg.locator("#ledgersel .l").count()==5)
    names=pg.inner_text("#ledgersel")
    ck("R06 五账齐:需求/供给/履约/体验/用户资产", all(x in names for x in ["需求账","供给账","履约账","体验账","用户资产账"]))
    ok=True
    for i in range(5):
        pg.evaluate(f"()=>pickLedger({i})"); pg.wait_for_timeout(60)
        if pg.locator("#ledgergrid .mt").count()<4: ok=False
    ck("R07 每账渲染≥4指标块", ok)
    ck("R08 全账无undefined/NaN泄漏", all(x not in pg.inner_text("#scrledger") for x in ["undefined","NaN","[object"]))

    # 归因卡(供给账 zsgap)
    pg.evaluate("()=>pickLedger(1)"); pg.wait_for_timeout(60)
    pg.click("#mt_zsgap"); pg.wait_for_timeout(100)
    ck("R09 归因卡展开·四段结构", "show" in pg.get_attribute("#attrcard","class") and "差值→收入关系" in pg.inner_text("#attrcard"))
    # 归因出口→差距经营中心(zsgap→GAP-QZC-03)
    pg.locator("#attrcard .dwn .go").first.click(); pg.wait_for_timeout(250)
    ck("R10 归因出口→差距经营overlay", "show" in pg.get_attribute("#gapov","class"))
    ck("R11 且定位关联GAP(可售率)", "可售率" in pg.inner_text("#gapovbody"))
    pg.click("#gapov .cls"); pg.wait_for_timeout(60)

    # 双端盘:六开关 + 校准闸
    pg.click('.tab[data-s="scrxd"]'); pg.wait_for_timeout(80)
    st0=pg.evaluate("()=>SKUS[curSku].six.listed")
    pg.click("#sw_listed"); pg.wait_for_timeout(60)
    ck("R12 六开关点击真翻转", pg.evaluate("()=>SKUS[curSku].six.listed")!=st0)
    pg.click("#sw_listed"); pg.wait_for_timeout(40)
    ck("R13 算差按钮校准前锁定", pg.locator("#btngap").is_disabled())
    for k in ["stuffing","phantom","weather","subsidy"]:
        pg.click(f"#tb_{k}"); pg.wait_for_timeout(30)
    pg.click("#btncalib"); pg.wait_for_timeout(60)
    ck("R14 四假剥除+确认→算差解锁", not pg.locator("#btngap").is_disabled())
    pg.click("#btngap"); pg.wait_for_timeout(80)
    ck("R15 算差输出公式与口径", "算差 = 定标" in pg.inner_text("#gapout"))

    # 判级:六期各SKU verdict 渲染
    pg.click('.tab[data-s="scrgate"]'); pg.wait_for_timeout(80)
    ok=True
    for i in range(6):
        pg.evaluate(f"()=>pickGateSku({i})"); pg.wait_for_timeout(60)
        t=pg.inner_text("#gatebox")
        if "verdict:" not in t or "live_gate_pass" not in t: ok=False
    ck("R16 六期Gate链全渲染(verdict+live_gate)", ok)
    ck("R17 淘汰期归档不删除", "归档不删除" in pg.inner_text("#gatebox"))

    # HITL 员工视角
    ck("R18 员工见待拍板·无批准钮", pg.locator("#hitlbox .hq").count()>=3 and pg.locator("#hitlbox button:has-text('批准')").count()==0)

    # 我的:收入四段 + 契约版本
    pg.click('.tab[data-s="scrme"]'); pg.wait_for_timeout(80)
    ck("R19 收入四段渲染", pg.locator("#incbox .b").count()==4)
    spec=pg.inner_text("#specbox")
    ck("R20 契约版本统一qzcv5", all(x in spec for x in ['"file_version": "qzcv5"','"product_version": "0.5.0-trial"','"spec_version": "O2O-Agent-V3.1"','qzcv5-contract-0.1']))
    ck("R21 契约含状态机+验果引擎+对象链", all(x in spec for x in ["task_state_machine","verification_engine","object_chain","ledgers_v5"]))
    ck("R22 根因记忆卡初始空态", "暂无验果回流案例" in pg.inner_text("#rcmembox"))
    ck("R23 回归段全程零JS错误", len(E1)==0)

    # ═══════════ 差距经营段 G-A(SR-6604 员工:十问/闸断/锁执行/驳数据)═══════════
    pg.click('.tab[data-s="scrhome"]'); pg.wait_for_timeout(80)
    ck("G01 差距经营中心=10卡(十问全覆盖)", pg.locator("#gapcenter .gapcard").count()==10)
    allids=all(pg.locator(f"#gc_GAP-QZC-{i:02d}").count()==1 for i in range(1,11))
    ck("G02 GAP-QZC-01…10 全在列", allids)
    hometxt=pg.inner_text("#gapcenter")
    ck("G03 五账主责均出现", all(x in hometxt for x in ["需求账","供给账","履约账","体验账","用户资产账"]))

    # GAP-02 完整经营链
    pg.click("#gc_GAP-QZC-02"); pg.wait_for_timeout(150)
    body=pg.inner_text("#gapovbody")
    ck("G04 七段齐:目标/实际/差距/根因/举措/验果引擎", all(x in body for x in ["目标 Target","实际 Actual","差距 Gap","根因穿透","多举措比较","验果引擎"]))
    ck("G05 对象链ID显性:TGT/ACT/DGN/RC/VER", all(x in body for x in ["TGT-QZC-02","ACT-QZC-02","DGN-QZC-02","RC-QZC-02","VER-QZC-02"]))
    ck("G06 三举措矩阵+三优先级", pg.locator("#gapovbody .mtx .mrow").count()==3 and all(x in body for x in ["推荐","备选","不推荐"]))
    ck("G07 成功率带样本数(wins/cases)", "78%(7/9)" in body)
    ck("G08 验果引擎五条件布尔行", all(x in body for x in ["window_complete","evidence_complete","data_quality_pass","primary_metric_pass","guard_metrics_pass"]))
    ck("G09 无人工判定有效/无效按钮(P0-3)", pg.locator("#gapovbody button:has-text('判定有效')").count()==0 and pg.locator("#gapovbody button:has-text('判定无效')").count()==0)

    # 不推荐举措:越权须理由(M-02c)
    pg.locator("#gapovbody .mrow.not_recommended ~ tr button:has-text('选此举措')").first.click(); pg.wait_for_timeout(120)
    ck("G10 不推荐→先弹理由框·不直接选中", pg.locator("#ovr_M-02c").count()==1 and pg.evaluate("()=>GAPS[1].chosen")==None)
    pg.fill("#ovr_M-02c","推荐举措供应商无法配合·兜底收缩"); 
    pg.locator("#gapovbody button:has-text('确认选用')").click(); pg.wait_for_timeout(120)
    ck("G11 越权确认→入HITL·approval=pending", pg.evaluate("()=>GAPS[1].measures.find(m=>m.id==='M-02c').approval_status")=="pending" and pg.evaluate("()=>HITL.some(q=>q.mid==='M-02c'&&q.status==='pending')"))
    ck("G12 越权理由已记录", "供应商无法配合" in pg.evaluate("()=>GAPS[1].measures.find(m=>m.id==='M-02c').override_reason"))
    hq0=pg.evaluate("()=>HITL.filter(x=>x.status=='pending').length")
    pg.evaluate("()=>pickMeasure('GAP-QZC-02','M-02c')"); pg.wait_for_timeout(80)
    ck("G13 HITL幂等:重复选不重复入队", pg.evaluate("()=>HITL.filter(x=>x.status=='pending').length")==hq0)

    # 锁执行:派草稿→execution_locked→点击被拒
    pg.locator("#gapovbody button:has-text('派发(草稿)')").first.click(); pg.wait_for_timeout(120)
    ck("G14 未批可派草稿·execution_locked=true", pg.evaluate("()=>TASKS.find(t=>t.id==='TK-02c1').execution_locked")==True)
    st=pg.evaluate("()=>TASKS.find(t=>t.id==='TK-02c1').status")
    pg.evaluate("()=>taskAct('TK-02c1')"); pg.wait_for_timeout(60)
    ck("G15 锁定任务点击不推进状态(审批先于执行)", pg.evaluate("()=>TASKS.find(t=>t.id==='TK-02c1').status")==st)
    ck("G16 作战台显示HITL锁定标识", "HITL未批·锁定" in pg.inner_text("#tasklist"))
    pg.click("#gapov .cls"); pg.wait_for_timeout(60)

    # dq闸断:GAP-07
    pg.click("#gc_GAP-QZC-07"); pg.wait_for_timeout(120)
    body=pg.inner_text("#gapovbody")
    ck("G17 dq=suspect→举措闸断·无矩阵", "已闸断" in body and pg.locator("#gapovbody .mtx").count()==0)
    ck("G18 验果态=blocked_data_quality", "blocked_data_quality" in body)
    pg.click("#gapov .cls"); pg.wait_for_timeout(60)

    # 驳回数据质量:GAP-08 选举措后驳数据→闸断
    pg.click("#gc_GAP-QZC-08"); pg.wait_for_timeout(120)
    pg.locator("#gapovbody button:has-text('选此举措')").first.click(); pg.wait_for_timeout(100)
    pg.locator("#gapovbody button:has-text('驳回数据质量')").click(); pg.wait_for_timeout(120)
    ck("G19 驳回数据→dq=suspect·闸断回落", pg.evaluate("()=>GAPS[7].actual.dq")=="suspect" and "已闸断" in pg.inner_text("#gapovbody"))
    pg.click("#gapov .cls"); pg.wait_for_timeout(60)
    ck("G20 员工页全程零JS错误", len(E1)==0)

    # ═══════════ 差距经营段 G-B(SR-6605 主管:批驳/全链闭环/验果引擎)═══════════
    E2=[]
    pg2=b.new_page(viewport={"width":420,"height":950})
    pg2.on("pageerror",lambda e:E2.append(str(e)))
    pg2.goto(URL+"?sr=SR-6605"); pg2.wait_for_timeout(400)
    ck("G21 主管页加载零JS错误", len(E2)==0)

    # 涉钱举措批准→解锁(GAP-10 M-10b)
    pg2.click("#gc_GAP-QZC-10"); pg2.wait_for_timeout(150)
    pg2.locator("#gapovbody button:has-text('选此举措(涉钱→HITL)')").first.click(); pg2.wait_for_timeout(120)
    ck("G22 涉钱举措→pending+HITL入队", pg2.evaluate("()=>GAPS[9].measures.find(m=>m.id==='M-10b').approval_status")=="pending")
    pg2.locator("#gapovbody button:has-text('派发(草稿)')").first.click(); pg2.wait_for_timeout(100)
    ck("G23 草稿任务已锁", pg2.evaluate("()=>TASKS.find(t=>t.id==='TK-10b1').execution_locked")==True)
    pg2.click("#gapov .cls"); pg2.wait_for_timeout(60)
    pg2.click('.tab[data-s="scrgate"]'); pg2.wait_for_timeout(100)
    ck("G24 主管见批准/驳回钮", pg2.locator("#hitlbox button:has-text('批准')").count()>=1)
    pg2.locator("#hqHQ-M-10b button:has-text('批准')").click(); pg2.wait_for_timeout(120)
    ck("G25 批准→approval=approved·任务解锁", pg2.evaluate("()=>GAPS[9].measures.find(m=>m.id==='M-10b').approval_status")=="approved" and pg2.evaluate("()=>TASKS.find(t=>t.id==='TK-10b1').execution_locked")==False)

    # 涉钱举措驳回→退回(GAP-04 M-04a)
    pg2.click('.tab[data-s="scrhome"]'); pg2.wait_for_timeout(60)
    pg2.click("#gc_GAP-QZC-04"); pg2.wait_for_timeout(120)
    pg2.locator("#gapovbody button:has-text('选此举措(涉钱→HITL)')").first.click(); pg2.wait_for_timeout(100)
    pg2.locator("#gapovbody button:has-text('派发(草稿)')").first.click(); pg2.wait_for_timeout(100)
    pg2.click("#gapov .cls"); pg2.wait_for_timeout(50)
    pg2.click('.tab[data-s="scrgate"]'); pg2.wait_for_timeout(80)
    pg2.locator("#hqHQ-M-04a button:has-text('驳回')").click(); pg2.wait_for_timeout(120)
    ck("G26 驳回→rejected·chosen清空·草稿关闭", pg2.evaluate("()=>GAPS[3].measures.find(m=>m.id==='M-04a').approval_status")=="rejected" and pg2.evaluate("()=>GAPS[3].chosen")==None and pg2.evaluate("()=>TASKS.find(t=>t.id==='TK-04a1').status")=="closed")

    # ── 全链闭环:GAP-02 选推荐→派2任务→状态机走全→验果引擎判effective ──
    pg2.click('.tab[data-s="scrhome"]'); pg2.wait_for_timeout(60)
    pg2.click("#gc_GAP-QZC-02"); pg2.wait_for_timeout(120)
    pg2.locator("#gapovbody .mrow.recommended ~ tr button:has-text('选此举措')").first.click(); pg2.wait_for_timeout(120)
    ck("G27 推荐举措=无需审批直选", pg2.evaluate("()=>GAPS[1].chosen")=="M-02a" and pg2.evaluate("()=>GAPS[1].measures[0].approval_status")=="not_required")
    t0=pg2.evaluate("()=>TASKS.length")
    pg2.locator("#gapovbody button:has-text('派发')").first.click(); pg2.wait_for_timeout(100)
    pg2.locator("#gapovbody button:has-text('派发')").first.click(); pg2.wait_for_timeout(100)
    ck("G28 两任务真入作战台(Owner/SOP/SLA)", pg2.evaluate("()=>TASKS.length")==t0+2 and pg2.evaluate("()=>TASKS.find(t=>t.id==='TK-02a1').sop")=="SOP-FCST-03")
    # 状态机:领取→开始→提交→(主管)验收→待验果
    for tid in ["TK-02a1","TK-02a2"]:
        seq=[]
        for _ in range(4):
            pg2.evaluate(f"()=>taskAct('{tid}')"); pg2.wait_for_timeout(50)
            seq.append(pg2.evaluate(f"()=>TASKS.find(t=>t.id==='{tid}').status"))
    ck("G29 状态机全序:claimed→in_progress→pending_review→pending_verification", seq==["claimed","in_progress","pending_review","pending_verification"])
    ck("G30 领取≠关差:途中无effective/done", "effective" not in seq)
    ck("G31 证据对象已附", pg2.evaluate("()=>!!TASKS.find(t=>t.id==='TK-02a1').evidence"))
    # 验果:窗口未走完→observing;推进3次→引擎判effective
    ck("G32 evidence_complete=true·window未完仍observing", pg2.evaluate("()=>evaluateVerification(GAPS[1]).evidence_complete")==True and pg2.evaluate("()=>GAPS[1].verification.result")=="observing")
    pg2.evaluate("()=>openGap('GAP-QZC-02')"); pg2.wait_for_timeout(100)
    for _ in range(3):
        pg2.locator("#gapovbody button:has-text('推进窗口')").click(); pg2.wait_for_timeout(120)
    ck("G33 窗口走完→引擎自动判effective(非人工按钮)", pg2.evaluate("()=>GAPS[1].verification.result")=="effective" and pg2.evaluate("()=>GAPS[1].verification.closed")==True)
    body=pg2.inner_text("#gapovbody")
    ck("G34 五条件全真显性可读", body.count("true")>=5 and "effective" in body)
    ck("G35 任务级联→effective·关差落地", pg2.evaluate("()=>TASKS.find(t=>t.id==='TK-02a1').status")=="effective" and pg2.evaluate("()=>TASKS.find(t=>t.id==='TK-02a2').status")=="effective")
    ck("G36 成功率真实累积:7/9→8/10", pg2.evaluate("()=>GAPS[1].measures[0].wins")==8 and pg2.evaluate("()=>GAPS[1].measures[0].cases")==10 and pg2.evaluate("()=>GAPS[1].measures[0].succ")==0.8)
    ck("G37 根因记忆真实回流(非Toast)", pg2.evaluate("()=>RC_MEMORY['RC-QZC-02'].success")==1 and pg2.evaluate("()=>RC_MEMORY['RC-QZC-02'].rate")==1)
    pg2.click("#gapov .cls"); pg2.wait_for_timeout(50)
    pg2.click('.tab[data-s="scrme"]'); pg2.wait_for_timeout(80)
    ck("G38 根因记忆卡渲染回流案例", "RC-QZC-02" in pg2.inner_text("#rcmembox"))
    pg2.click('.tab[data-s="scrhome"]'); pg2.wait_for_timeout(60)
    ck("G39 差距卡状态=已关差", "验果=effective·已关差" in pg2.inner_text("#gc_GAP-QZC-02"))

    # ── 反向闭环:GAP-01 证据链不齐→窗口走完=ineffective→回根因 ──
    pg2.click("#gc_GAP-QZC-01"); pg2.wait_for_timeout(120)
    pg2.locator("#gapovbody .mrow.recommended ~ tr button:has-text('选此举措')").first.click(); pg2.wait_for_timeout(100)
    pg2.locator("#gapovbody button:has-text('派发')").first.click(); pg2.wait_for_timeout(80)
    # 任务只领取不提交 → evidence_complete=false
    pg2.evaluate("()=>taskAct('TK-01a1')"); pg2.wait_for_timeout(50)
    for _ in range(2):
        pg2.locator("#gapovbody button:has-text('推进窗口')").click(); pg2.wait_for_timeout(120)
    ck("G40 证据链不齐→引擎判ineffective(不许糊弄过关)", pg2.evaluate("()=>GAPS[0].verification.result")=="ineffective")
    ck("G41 无效→chosen清空·回根因·任务ineffective", pg2.evaluate("()=>GAPS[0].chosen")==None and pg2.evaluate("()=>GAPS[0].diagnosis.status")=="hypothesis" and pg2.evaluate("()=>TASKS.find(t=>t.id==='TK-01a1').status")=="ineffective")
    ck("G42 失败案例也回流根因记忆", pg2.evaluate("()=>RC_MEMORY['RC-QZC-01'].cases")==1 and pg2.evaluate("()=>RC_MEMORY['RC-QZC-01'].success")==0)
    pg2.click("#gapov .cls"); pg2.wait_for_timeout(50)

    # 延长窗口 + 申诉留痕(人只换位不删除)
    pg2.click("#gc_GAP-QZC-09"); pg2.wait_for_timeout(120)
    pg2.locator("#gapovbody .mrow.recommended ~ tr button:has-text('选此举措')").first.click(); pg2.wait_for_timeout(100)
    w0=pg2.evaluate("()=>GAPS[8].verification.window.total")
    pg2.locator("#gapovbody button:has-text('延长窗口+1')").click(); pg2.wait_for_timeout(100)
    ck("G43 延长窗口真+1", pg2.evaluate("()=>GAPS[8].verification.window.total")==w0+1)
    pg2.locator("#gapovbody button:has-text('申诉留痕')").click(); pg2.wait_for_timeout(100)
    ck("G44 申诉入留痕归档", pg2.evaluate("()=>HIST.some(x=>x.act==='appeal'&&x.id==='AP-GAP-QZC-09')"))
    pg2.click("#gapov .cls"); pg2.wait_for_timeout(50)
    ck("G45 主管页全程零JS错误", len(E2)==0)

    b.close()

p=sum(1 for _,v in R if v)
print(f"\n===== qzcv5 {p}/{len(R)} PASS(回归R23 + 差距经营G45合并·实测实报)=====")
if p<len(R): sys.exit(1)
