# Loop 设计规则 · 运行层补充
### INFINITY OS Agent 设计项目 ｜ 可放入 Instructions 或知识库 Files ｜ v1.0

---

## 0 · 这份文件是什么 / 不是什么

- **是**:在本项目现有 **BEA Instructions(建造层)** 之上,补一层 **Loop(运行层)** 设计规则。从今往后,本项目设计的每一个节点 / Agent,除了「造对」(BEA),还要标清「怎么让它自己转」(Loop)。
- **不是**:不替代任何现有规则。现有的 BEA 六条、五范式、三轴、AgentLadder 五级全部继续有效且优先级更高。
- **底层逻辑一句话**:BEA 让 Agent 值得信任,Loop 让人能放心走开;但走开之前先装好记忆、分好审查、划好护栏。

---

## 1 · 总原则(写在最前,优先级最高)

1. **先 BEA,后 Loop。** 一个节点没按 BEA 造对(Workflow/Agent 归类、五范式、三轴、停止条件),不准进入 Loop 设计。
2. **简单性闸门(硬规则)。** 每给一个节点加一个 Loop 组件,必须先回答:**「它 demonstrably 让结果更好了吗?还是只是看起来更完整?」** 答不上来就不加。本项目历史上最大的风险是层叠太多——Loop 的 5+1 同样可能变成新的复杂度陷阱。
3. **能不 Loop 就不 Loop。** 默认仍是「写死 workflow + 人在场」。只有满足第 2 节三条件的节点才升级为 Loop。
4. **人不删除,只换位。** Loop 化是把人从「启动/确认/执行」位子上换到「读结果/拍板」位子上,不是把人删掉。验证永远是人的事。

---

## 2 · 判定:这个节点要不要 Loop 化?

一个节点**同时**满足以下三条,才值得 Loop 化(Addy 三条件):

- ☐ **会重复发生**(不是一次性任务)
- ☐ **有明确的「做完了」判定**(可验证的成功条件)
- ☐ **有东西能说「不对」**(测试 / 校验规则 / 真实报错 / 兜底范式)

缺任意一条 → 保持「workflow + 人工提示」,不 Loop 化,并在设计稿注明原因。

---

## 3 · Loop Spec 标准块(每个要 Loop 化的节点必填,可直接嵌进 SKILL.md)

```yaml
loop_spec:
  enable: true                  # 是否 Loop 化(false 则跳过本块)
  why_loop: ""                  # 过第2节三条件的简述;过不了简单性闸门则 enable=false

  # —— 5 + 1 组件:只填这个节点真正需要的,不需要的标 N/A 并说明 ——
  automation:                   # 心跳:谁启动循环
    trigger: ""                 # cron(如每日08:00)/ 阈值事件(如水位<2A)/ 手动
    inbox: ""                   # 结果落到哪个「待处理收件箱」
  worktree:                     # 隔离仓:多实例并行会不会互相污染
    needed: false               # 单店/单SKU 串行通常 false;批量并行才 true
  skill:                        # 技能池:本节点依赖哪个 SKILL.md
    ref: ""                     # SKILL.md 名;描述须简短朴素(决定自动匹配)
  connector:                    # 连接器:要不要真正「出手」动外部系统
    actions: []                 # 如 ["新增补货单"];只读探索阶段留空
  subagents:                    # 双子:执行者与审查者必须分离
    maker: ""                   # 执行者职责
    tracker: ""                 # 审查者职责(独立、可不同模型,合并前跑 dry run/校验)
  memory:                       # 记忆:会话外、跨轮
    writes: ""                  # 每轮写什么(做了/没做/为什么/待查)
    store: "[持久化存储]"        # 落库位置(占位,按实际填)

  # —— 4 道护栏:涉钱 / 高风险节点必填 ——
  acceptance_criteria: ""       # 明确 DoD:跑到什么可验证条件就停
  permission_boundary:          # 最小权限
    can: []                     # 系统可自动做的(尽量窄)
    cannot: []                  # 必须人工的(删改、超额、跨域)
  human_gate: ""                # 超过什么阈值自动挂起等人拍板
  observability: ""             # 留痕:谁判的/判了什么/为什么/结果,可审计
```

> **填写顺序铁律:护栏先于自动化。** `acceptance_criteria` + `permission_boundary` + `human_gate` 没填,不准把 `automation.trigger` 设成自动——否则就是无限烧 token(Token bleeding)与权限失控的风险口。

---

## 4 · 术语对照(Loop 原典 ↔ 本系统已有词汇)

| Addy 5+1 原词 | 本系统对应说法 | 备注 |
|---|---|---|
| Automation | 心跳 / 心跳水位触发 | 心跳「a 值」目前是信号,要升级成「触发器」才算 automation |
| Worktree | 隔离仓 | 多 SKU / 多店并行时才需要 |
| Skill | 技能池 / SKILL.md | 本项目核心产物,已对齐;跨场景共享时打包成 plugin |
| Connector | 连接器 / 外部触手 | MCP / API;「让 Agent 出手」而非只「数据进」 |
| Sub-agents | 双子博弈 / Maker·Tracker | 执行与审查分离,防过拟合 |
| Memory | 记忆仓 | 必须会话外、写在仓库里;「vs 上次拜访」差异是其雏形 |

---

## 5 · 与现有规则的衔接(必须照此扣回)

- **五范式 → 护栏映射**:
  - `涉钱类(unknown 退保守)` → 必须配 **human_gate**(金额阈值)+ 收紧的 **permission_boundary**。
  - `HITL类(unknown 出全部)` → 即 **human_gate** 的设计依据。
  - `预警类(unknown 照报)` / `事实类(unknown 照列)` → 写入 **memory** 供下一轮复盘。
  - `判级类(unknown 不判)` → 进 **tracker** 的兜底校验逻辑。
- **三轴定位不变**:Loop 是「怎么让它转」,不动晶体管为锚的芯片纵深 / AgentLadder / OneTransistor 三轴。Loop Spec 是挂在节点上的第四类信息,**不是第四根轴**。
- **AgentLadder 五级**:Agent 能力越高(越往自主端),`human_gate` 与 `tracker` 要求越严,不是越松。

---

## 6 · 参考实例(断货门店自动补货 · 已填好的 Loop Spec)

```yaml
loop_spec:
  enable: true
  why_loop: "每日每店重复;done=该补的补、该挂的挂;有2A线+压货规则能说不对 → 三条件满足"
  automation:
    trigger: "每日08:00 cron;或水位<2A 事件触发"
    inbox: "补货待处理收件箱(已下单/待批/已派工 三类)"
  worktree:
    needed: true   # 一次跑一批店,需各店副本隔离
  skill:
    ref: "SKILL_断货补货.md"
  connector:
    actions: ["新增补货单"]   # 只开新增,不给删改
  subagents:
    maker: "INF-VL识别+算水位+出补货建议(补92瓶¥9080)"
    tracker: "对照后仓压货/窜货/价异常验;禾然后仓36瓶>2A → 推翻为'先消化不补'+派工"
  memory:
    writes: "本店每条:补了什么/没补什么/为什么/待查项"
    store: "[持久化存储]"
  acceptance_criteria: "一批店全自动走完识别→建议→审查→下单/挂起,产出三类结果"
  permission_boundary:
    can: ["读库存/销量", "生成补货单", "阈值内自动下单", "派工"]
    cannot: ["超额下单", "取消/删除订单", "跨店调拨", "改主数据"]
  human_gate: "单店补货总额 > ¥10,000 → 挂起,推手机等人拍板"
  observability: "每条建议留痕:谁判/判什么/为什么/结果,可审计回溯"
```

---

## 7 · 给本项目设计时的一句话

> 以后设计任何节点:先用 BEA 把它造对,再问「要不要 Loop 化」;要,就填上面那张 Loop Spec,且**护栏先于自动化、简单性闸门优先于一切**。Loop 让系统自己转,但读结果、拍板的人永远是你。

---
*定位说明:本文件是「设计时的标准规则」。与之配套的另两份——《Loop Engineering 工作规则 v1》(概念总纲)、《断货补货循环 · TechLead 需求说明 v1》(单场景落地实例)——分别管「为什么」和「怎么落」。三者可同放知识库。*
