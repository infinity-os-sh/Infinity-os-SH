# INFINITY OS · Spec-First 开发规范 V1.0

**强制规范 · 适用于所有INFINITY OS相关代码**

---

## 📢 发布信息

| 项目 | 内容 |
|------|------|
| 发布人 | DS |
| 发布日期 | 2026-04-22 |
| 适用范围 | INFINITY OS项目全部代码 · 无例外 |
| 生效日期 | 立即生效 |
| 违反后果 | 代码被退回 · 不予合并 |

---

## 🎯 核心原则 · 一句话

> **不写Spec的代码 · 一行都不能合并到主分支。**

---

## 📋 Part 1 · 为什么必须Spec-First

### INFINITY OS是<strong>生产级系统</strong> · 不是原型

- 要跑3年以上(2026-2029年2亿瓶目标)
- 涉及真金白银(Omakase推单·一笔可能几十万)
- 团队多人协作(DS + Tech Lead + 郭工 + 开发团队 + 业务团队)
- 核心算法不能错(心跳公式·4类失真·价值分配)

### Vibe Coding的3大灾难

1. **算法错误无人发现** — AI可能把a=r×T写成a=r+T · 没Spec约束就错到生产
2. **3个月后没人看懂** — "这段if为什么这样写?" 没人知道
3. **集成时团队打架** — 每人理解不同 · 代码对不上

---

## 📋 Part 2 · 强制要求(5条铁律)

### 铁律1 · <strong>任何新功能 · 必须先有Spec</strong>

```
错误做法:
  开发者:"我先写代码·完了补文档"
  → 后补的文档都是糊弄
  
正确做法:
  开发者:"我先写Spec·DS审完·再写代码"
  → Spec即合约 · 代码按Spec实现
```

**违反 → 代码退回 · 重写Spec**

---

### 铁律2 · <strong>Kiro必须用Spec模式 · 禁止Vibe模式</strong>

```
打开Kiro新对话时:
  ✅ 选择 "Spec Mode"
  ❌ 不允许选 "Vibe Mode"
```

**唯一例外:**
- 纯粹的"一次性探索脚本"(写完就删)
- 明确标注 `# VIBE: throwaway` 的临时文件

**违反 → 代码不予Code Review**

---

### 铁律3 · <strong>Spec必须包含3个文件</strong>

每个功能的Spec目录(`.kiro/specs/<feature-name>/`)必须有:

```
.kiro/specs/<feature-name>/
├── requirements.md   ← 需求文档(为什么做)
├── design.md         ← 设计文档(怎么做)
└── tasks.md          ← 任务清单(做哪些)
```

**任何一个文件缺失 → Spec不完整 → 不允许写代码**

---

### 铁律4 · <strong>代码必须引用Spec</strong>

每个函数的docstring必须引用Spec:

```python
def calculate_heartbeat_unit(r: float, t: int) -> float:
    """
    计算心跳单元 a = r × T
    
    Spec: .kiro/specs/heartbeat-core/requirements.md 第2.1节
    Design: .kiro/specs/heartbeat-core/design.md 第3节
    
    Args:
        r: 日销率(瓶/天)
        t: 周转周期(天)
    Returns:
        a值(瓶)
    """
    return r * t
```

**违反 → 代码退回**

---

### 铁律5 · <strong>验收标准必须变成测试</strong>

requirements.md里的"验收标准" → tests/目录里必须有对应test

```markdown
# requirements.md
## 验收标准
- ✅ 输入 r=10 T=7 → 输出 a=70
- ✅ 输入 r=0 T=7 → 输出 a=0
- ✅ 输入 r=10 T=0 → 抛异常
```

```python
# test_heartbeat.py
def test_normal_case():
    assert calculate_heartbeat_unit(10, 7) == 70

def test_zero_r():
    assert calculate_heartbeat_unit(0, 7) == 0

def test_zero_t_raises():
    with pytest.raises(ValueError):
        calculate_heartbeat_unit(10, 0)
```

**违反 → Code Review不通过**

---

## 📋 Part 3 · Spec三件套 · 标准模板

### 📄 模板1 · `requirements.md`

```markdown
# [功能名称] · 需求文档

## 业务目标
[一句话说清楚·为什么做这个]

## 用户故事(EARS语法)
WHEN [触发条件]
WHILE [前置状态]
THE SYSTEM SHALL [执行动作]
AND [额外动作]

## 验收标准
- ✅ [标准1 · 具体可测]
- ✅ [标准2 · 具体可测]
- ✅ [标准3 · 具体可测]

## 边界条件
- 异常场景1 → 处理方式
- 异常场景2 → 处理方式

## 非功能需求
- 性能:[响应时间要求]
- 安全:[数据保护要求]
- 可靠性:[容错要求]

## 依赖
- 上游系统:[依赖的其他系统]
- 下游系统:[影响的其他系统]

## 审阅记录
- 需求提出人:XXX
- DS审阅:✅ 2026-XX-XX
- Tech Lead审阅:✅ 2026-XX-XX
```

---

### 📄 模板2 · `design.md`

```markdown
# [功能名称] · 设计文档

## 架构
[简单架构图·说明数据流向]

## 关键组件
| 组件 | 职责 | 技术选型 |
|------|------|---------|
| X | Y | Python / FastAPI |

## 数据模型
[关键数据表结构·字段定义]

## 接口定义
[REST API / 函数签名]

## 算法说明
[核心算法的文字描述 + 公式]

## 异常处理策略
[各种异常的处理逻辑]

## 性能考量
[预估QPS · 数据量 · 响应时间]

## 安全考量
[权限·加密·审计]
```

---

### 📄 模板3 · `tasks.md`

```markdown
# [功能名称] · 任务清单

## 任务分解(依赖顺序)

- [ ] 1. 环境准备
  - [ ] 1.1 安装依赖
  - [ ] 1.2 配置数据源
- [ ] 2. 核心代码
  - [ ] 2.1 xxx.py
  - [ ] 2.2 yyy.py
- [ ] 3. 测试
  - [ ] 3.1 单元测试
  - [ ] 3.2 集成测试
- [ ] 4. 部署
  - [ ] 4.1 打包
  - [ ] 4.2 上线

## 预计工时
总计:X天

## 负责人
- 主要负责:XXX
- 协助:XXX
- Code Review:DS / Tech Lead
```

---

## 📋 Part 4 · Code Review 流程

### 🔍 审核顺序(不可颠倒)

```
Step 1 · 先审 Spec
  · requirements清晰吗?
  · design合理吗?
  · tasks完整吗?
  ❌ Spec不过 → 驳回 · 不看代码
  ✅ Spec过 → Step 2

Step 2 · 再审代码
  · 代码是否按Spec实现?
  · 有没有"Spec里没写·代码却做了"?
  · 有没有"Spec里要求·代码没实现"?
  ❌ 代码不符合Spec → 驳回
  ✅ 代码符合Spec → Step 3

Step 3 · 审测试
  · 验收标准都有test吗?
  · test能跑通吗?
  · 覆盖率达标吗?
  ❌ 测试不全 → 驳回
  ✅ 测试完整 → 合并
```

---

### 📋 Code Review 检查表

```
□ Spec三件套完整(requirements + design + tasks)
□ DS / Tech Lead已审阅Spec
□ 代码每个函数都引用Spec
□ 验收标准100%对应test
□ test全部通过
□ 没有硬编码(魔法数字来源在design.md)
□ 没有空catch(异常处理在design.md)
□ 文档更新(README + docstring)
□ 日志规范(INFO/WARN/ERROR分级)
□ 没有密钥泄露(密码/API Key)
```

---

## 📋 Part 5 · Kiro Spec模式 · 操作手册

### 🖥️ 新功能的标准工作流

#### Step 1 · 在Kiro打开项目

```
打开Kiro IDE
File → Open Folder → 选择INFINITY OS项目目录
```

#### Step 2 · 新建Spec对话

```
点击右上角 [+ New Chat]
选择模式 → 选择 "Spec Mode" (不是Vibe Mode!)
```

#### Step 3 · 输入需求

```
在对话框输入:
"我要做[功能名称]·[业务目的]·关键点是[核心约束]"

例如:
"我要做汉询数据接入·每天凌晨5点从汉询读rixiao字段·
计算r值·写入inf_heartbeat表·关键点是要排除断货日"
```

#### Step 4 · Kiro自动生成3个文件

```
Kiro会在 .kiro/specs/<feature-name>/ 目录下生成:
  · requirements.md
  · design.md
  · tasks.md
```

#### Step 5 · 人工审阅·迭代修改

```
打开3个md文件·仔细阅读
有问题 → 在对话框说"requirements里xxx要改成yyy"
Kiro会自动更新
直到3个文档都OK
```

#### Step 6 · 发给DS / Tech Lead审阅

```
commit Spec到Git
推送到GitHub
在对应PR里 @DS @TechLead 请求审阅
```

#### Step 7 · DS确认后 · Kiro生成代码

```
Spec审核通过
在Kiro对话框说"按tasks.md第1项开始写代码"
Kiro会严格按照Spec写代码
每段代码都引用Spec
```

#### Step 8 · 人工测试·迭代

```
跑test
验证验收标准
有问题 → Kiro改
直到全部通过
```

#### Step 9 · Code Review

```
PR里 @DS / @TechLead 审阅代码
审阅顺序:Spec → 代码 → 测试
通过后合并
```

---

## 📋 Part 6 · 常见问题

### ❓ Q1:写Spec太慢 · 影响交付

**答:** Spec慢 · 但后面快。

```
Vibe模式:
  写代码1天
  找Bug 3天
  改Bug 2天
  3个月后重写 5天
  总计 · 11天 + 维护噩梦

Spec模式:
  写Spec 1天
  写代码 1天
  测试 0.5天
  3个月后查Spec 0.5天就修复
  总计 · 3天 + 可维护
```

**慢就是快·快就是慢。**

---

### ❓ Q2:我写完Spec了 · 发现不合理 · 怎么办?

**答:** 改Spec · 不改代码。

```
Spec是代码的根
根错了·枝叶全错
改根·不改枝
```

**流程:**
1. 停止写代码
2. 回到Kiro Spec模式
3. 更新requirements / design / tasks
4. DS重新审阅
5. 通过后再改代码

---

### ❓ Q3:紧急Bug修复 · 也要写Spec吗?

**答:** 要 · 但可简化。

```
紧急bug修复流程:
1. 先hotfix(不写Spec·但打tag)
2. 24小时内补Spec:
   · requirements.md 说明Bug原因
   · design.md 说明修复方案
   · tasks.md 记录修复步骤
3. 下个迭代正式合并
```

---

### ❓ Q4:我能用Vibe模式写"小工具"吗?

**答:** 如果工具会进生产环境 · 不能。

```
判断标准:
  · 这段代码会被别人用? → 写Spec
  · 这段代码会跑在服务器? → 写Spec
  · 这段代码处理真实数据? → 写Spec
  · 这段代码今天写完今天删? → 可以Vibe·但标记 # VIBE: throwaway
```

---

### ❓ Q5:Kiro生成的Spec不对 · 我能直接写代码吗?

**答:** 不能。改Spec · 再生成代码。

```
Kiro Spec不对 · 是因为:
  · 你输入的需求不清楚
  · Kiro的理解有偏差

正确做法:
  · 继续和Kiro对话·让Spec正确
  · Spec对了·代码自然对

错误做法:
  · "算了我自己写吧"
  · → 失去了Spec的价值
  · → 违反铁律
```

---

## 📋 Part 7 · .kiro/ 目录标准结构

INFINITY OS项目的<strong>.kiro/目录必须长这样</strong>:

```
infinity_os/
├── .kiro/
│   ├── steering/                      ← 项目全局规则(让Kiro懂项目)
│   │   ├── product.md                 ← 产品定义(INFINITY OS是什么)
│   │   ├── structure.md               ← 代码结构
│   │   └── tech.md                    ← 技术栈
│   │
│   └── specs/                         ← 所有功能的Spec
│       ├── agent-01-a-value-calibration/
│       │   ├── requirements.md
│       │   ├── design.md
│       │   └── tasks.md
│       ├── agent-02-butterfly-effect/
│       │   ├── requirements.md
│       │   ├── design.md
│       │   └── tasks.md
│       ├── agent-03-omakase-recommend/
│       │   ├── requirements.md
│       │   ├── design.md
│       │   └── tasks.md
│       ├── data-import-hanxun/
│       │   └── ...
│       └── [其他功能]/
│
├── src/                               ← 实际代码
├── tests/                             ← 测试
└── README.md
```

---

## 📋 Part 8 · 违规处理

### 🚫 违规等级

| 等级 | 场景 | 处理 |
|------|------|------|
| L1 警告 | 首次没写Spec | PR驳回 · 要求补Spec |
| L2 严重 | 反复无Spec提交 | 该分支所有代码暂停合并 |
| L3 重大 | 生产出事故·是Vibe代码 | 团队全员Spec培训 |

---

### 🚫 DS的底线

```
INFINITY OS项目的代码:
  · 可以慢一点
  · 可以丑一点
  · 但必须"知道自己在干什么"

Spec-First = "知道自己在干什么"的保证

没有Spec的代码 = 不知道自己在干什么的代码
= DS不允许进入INFINITY OS
```

---

## 🎯 最后 · 送给团队的一句话

> 我们不是在写代码。
> 我们在建"<strong>欣和未来3年的战略基础设施</strong>"。
>
> 每一行代码 · 都关系到2亿瓶目标的实现。
> 
> 值得慢一点 · 值得认真一点 · 值得Spec-First。

---

**DS · 2026-04-22 · INFINITY OS架构师**
