# SR app(大卖场销售终端)· 交付说明 — ICA 的兄弟脸,共用中台

> 一句话:SR = 在 ICA 已建好的中台上,**抽 XD 成共享件(一次)+ 写 SR 的 XM(接 L5-07)+ 加大卖场 checklist**。中台不重建,ICA 不 fork。scaffold·mock·不上线·线上文件零改动。

## 文件
| 文件 | 作用 |
|---|---|
| `sr-app-v0-wired.html`(根目录) | **SR app 新壳**(4 tab)·非 ICA 复制 |
| `infinity-cloudbase/shared-xd/shared-xd-mount.js` | 共享 XD 挂载件 `mountXD(slot,{storeType,identity,store_id})`,XD 底座唯一= `inf-xd-v6712-0601-wired.html` |
| `inf-xd-v6712-0601-wired.html`(wired) | 共享 XD:加 storeType 门控的 ②③ 大卖场 checklist(默认关→ICA 零变化) |
| 复用(import 不重写) | `field-dictionary.js v1.1` / `cloudbase-client.js` / `l5_07_planner.js` |

## 交付确认(逐条)
1. **没 fork ICA 吧?** —— **没有**。`sr-app-v0-wired.html` 是全新壳子(SR 蓝主题、4 tab、自己的 XM/XL/XP),没有复制 `ica-*.html`。两者共用同一中台(`field-dictionary`/`cloudbase-client`/`l5_07_planner`/共享 XD)。
2. **XD 真抽成共享件了吗?** —— **是**。`mountXD()` 统一挂载唯一 XD 底座 `inf-xd-v6712-0601-wired.html`;ICA 与 SR 都挂它。**ICA 原回路不退化**:ICA 登录时把 `inf_cb_store_type` 置空 → 共享 XD 不显示 ②③ → ICA 行为零变化(登录→盘点→签退→写 `inventory_snapshot`→汇总查到 张三 那条不变;已校验线上文件 byte-identical)。
3. **SR 的 XM 真读 L5-07 输出吗?** —— **是**。XM 直接调 `VisitPlannerL507.planL507(input)`,渲染 `visit_list` 的 `store_id/reason/vps/vps_breakdown/est_minutes` + 路线,**不另算 VPS**,只显示并标来源(常规到期度 / 救火紧急度 CHS=L1-06、SHS=地基③)。
4. **大卖场 checklist 只加在 ③ 层吗?** —— **是**。① 层 6 开关(上架/有货/陈列/动销/复购/毛利)口径**没动**;`storeType=大卖场` 时共享 XD 底部额外弹 ②③ 面板(堆头/端架/黄金位、KA账期、促销档期、竞品堆头/价格、大客户对接),签退写入 `source_ref.ka_checklist`(②③,**不入 ① 开关**)。
5. **还 pending 什么?** 见下。

## 命门守住(从 ICA / L5-07 延续)
- **登录身份绑定**:SR 复用 `cloudbase-client.resolveIdentity`(display_name),reporter 跟登录的人走(经共享 XD 写入)。
- **VQS 对事不对人**:XP 复盘只显示 L5-07 `learning_emits`「拨动门店状态」(对事),**无个人绩效分/排名/主管介入**。
- **no_data ≠ false**:动销/复购/毛利现场采不到 → 共享 XD 写 `no_data`,XL/汇总显示「—」。
- **`oos_flag = !有货`**:沿用字典 v1.1(有货 ON ⇒ oos_flag=false)。

## 仍 pending(等真后端)
- **环境ID(真后端)**:未配 → 全程 `双轨·mock`(徽标+底栏明示,不推真人)。
- **L5-07 真数据**:门店档案 L0-04 / 拜访历史 / CHS(L1-06)/ SHS(地基③ vitality)—— 现 XM 用 mock 输入。
- **D-003 政策数字**:分级频率/产能16/配额(保底11+救火5)/VPS权重 1:1 = provisional,标 `D003_pending`。
- **XL 收入口径**:mock 占位(真口径待后端)。
- **SKU 主数据**:抢单 SKU 自动进盘点页/下拉 = 长期(等环境ID)。
