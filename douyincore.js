/* ============================================================
   douyincore.js · 抖音双主线经营 · 同源业务内核(自 douyinv20 逐字抽取)
   数据/规则/判级/SOP/归因 唯一权威 · 手机壳(douyinv20)与 PC 壳(douyinpcv1)共用
   接真实数据时:只改本文件(MOCK_DATA → real / hybrid_real),两壳零改动
   禁止:在壳文件里另写一套业务规则
   ============================================================ */

const CHANNEL = {
  key:"douyin", name:"抖音", axis:"SKU/内容成交轴",
  role:"双前线经营", who:"抖音双前线",
  sentinel:"流量效率×成交效率×人群资产 · 断=素材疲劳/直播模型失效",
  consumer:{ funnel:"5A", steps:["A1 了解","A2 吸引","A3 种草","A4 购买","A5 忠诚"] },
  winwin:"平台要成交效率 × 品牌要人群资产沉淀",
  // 那点差异(Autonomy第②处):抖音是唯一必须两条一线同时作战的渠道
  frontlines:{
    seed_kol:{ nm:"种草达人岗", team:"种草团队", range:"A1→A3", def:"制造购买理由", out:"达人筛选·内容共创·自然数据·投放放量·素材授权" },
    commerce_kol:{ nm:"带货达人岗", team:"卖货团队", range:"A3→A5", def:"完成购买动作(达人带货)", out:"选品·邀约·素材制作·发布监控·视频加热" },
    live_room:{ nm:"直播间岗", team:"卖货团队", range:"A3→A5", def:"完成购买动作(直播)", out:"目标·货组·话术·场景·投流·场次复盘" },
    ops:{ nm:"数据/Agent作战官", def:"一条龙看 N0–N6 协同", out:"红黄绿判断·断点诊断·任务派发·复盘沉淀" }
  },
  // 6开关抖音口径翻译(Autonomy第①处)
  dialect:{ 陈列:"商品卡坑位/货盘上架", 动销:"商品点击·GPM·成交转化", 认知:"3秒率/完播·A1-A2",
            有货:"抖店库存·直播货盘", 复购:"A4→A5·复购率·LTV", 口碑:"体验分·互动质量" },
  money:["投流(千川等)","达人采买(星图/精选联盟/纯佣/付费)","直播加热","优惠券","组合装/货盘变更"],
  sku_anchor:["六月鲜轻10克盐减盐酱油","味达美味极鲜酱油","禾然有机酱油"],
  residual_cap:{ amount:2000, roi:1.5 },   // 渠道锁定:抖音残值复投 ≤¥2,000 · ROI≥1.5
  platform_links:[{nm:"巨量云图",url:"https://yuntu.oceanengine.com"},{nm:"巨量星图",url:"https://www.xingtu.cn"},{nm:"巨量千川",url:"https://qianchuan.jinritemai.com"},{nm:"抖店",url:"https://fxg.jinritemai.com"},{nm:"电商罗盘/灵犀",url:"https://compass.jinritemai.com"}]
};

const VERSION={app_version:"douyinv20",theme:"抖音团队反馈修订版",data_mode:"mock / hybrid_ready",platform_priority:"PC Web first",mobile_app:"later adaptation",based_on:"douyinv19 / 数据接入 SOP v0.4.1"};

const JOINT_LEDGER={bridge:"A3",cards:[
  {key:"a3_to_product_click_rate",formula:"product_click_users_from_new_a3 / new_a3_users"},
  {key:"a3_to_order_conversion_rate",formula:"paid_users_from_new_a3 / new_a3_users"},
  {key:"a3_to_new_customer_repurchase_rate",formula:"repurchased_new_customers_from_new_a3 / new_customers_from_new_a3"}]};

const SKU_NPS={
  import:{v:null,src:"order_system(待接入)"}, growth:{v:0.36,promoter:118,detractor:34,n:233,src:"order_system"},
  mature:{v:0.52,promoter:412,detractor:96,n:608,src:"order_system"}, decline:{v:0.18,promoter:41,detractor:26,n:83,src:"manual_import"},
  renewal:{v:null,src:"order_system(待接入)"}, retire:{v:0.41,promoter:22,detractor:8,n:34,src:"manual_import"}};

const BRAND_OBS={words:["减盐","零添加","一勺出味","原酿","有机酱油","儿童酱油","轻盐"],search_volume:128400,search_trend:"↗ +12%/周",sov:0.226,reputation:86.4,aiq:71,aico:64};

const FIELDS_NEW=[
 ["search_after_view_rate","看后搜率","mock有基线(账本键post_search)"],["blue_word_click_rate","小蓝词点击率","mock有基线(账本键blue_word)"],
 ["cpa3","新增A3成本 CPA3","mock有基线"],["new_a3_users","新增A3人群","mock有基线(账本键new_a3)"],
 ["a3_to_product_click_rate","新增A3人群→商品点击率","mock有基线(联合账)"],["a3_to_order_conversion_rate","新增A3人群→成交转化率","mock有基线(联合账)"],
 ["a3_to_new_customer_repurchase_rate","新增A3人群→新客复购率","mock有基线(联合账)"],["sku_nps","SKU级NPS","hybrid·缺失显示灰·可手工导入"],
 ["content_quality_score","内容质量评分","SOP复盘步mock"],["comment_quality_score","评论质量评分","SOP监测步mock"],
 ["creator_fit_score","达人匹配度","SOP筛选步mock"],["historical_best_value","历史最佳值","SOP每步已带"],["target_value","目标值","SOP每步已带"]];

const SEED_TODAY=[
  {lk:"retain_3s",label:"三秒率"},
  {lk:"completion",label:"完播率"},
  {lk:"post_search",label:"看后搜率/小蓝词点击率"},
  {lk:"cpa3",label:"新增A3成本 CPA3"}];

const TEAM={seed_kol:"种草达人岗",commerce_kol:"带货达人岗",live_room:"直播间岗",joint:"联合(作战官)"};

const OP_ROLES={seed_kol:"种草达人岗",commerce_kol:"带货达人岗",live_room:"直播间岗",ops:"作战官",mgr:"主管"};

const N2_SOURCES=["星图达人","精选联盟达人","纯佣达人","付费达人","千川","种草通","品牌投流工具","随心推","直播排期(自播/达播)","自然流内容"];

const HS_KOL={import:"种草达人为主(二级来源:星图/纯佣)",growth:"三岗并进(种草+带货+直播)",mature:"带货/直播为主·只留高ROI",decline:"不适用(停投)",renewal:"历史高ROI达人受控重启",retire:"不适用(零采买)"};

const N3_CHECK=[
  ["商品卡是否绑定","未绑定 = 不准投放"],["抖店是否可售","不可售 = 不准放大"],["库存可售天数≥7","不足 = 不准加投"],
  ["SKU价格是否合理","异常 = 回商品运营"],["详情页是否完整","不完整 = 回N3修"],["直播货盘是否匹配","不匹配 = 不准直播放量"],
  ["客服响应是否达标","不达标 = 风险"],["评价分是否达标","不达标 = 质量门"],["购买路径是否有断点","有断点 = 回修"]];

const METRIC_DICT=[
  ["三秒率","观看≥3秒人数","有效播放人数","正在消耗活跃视频","日/7日","大盘均值+自身历史"],
  ["完播率","看满60秒或整条完播","有效播放人数","活跃视频","日/7日","按视频时长校准"],
  ["互动率","点赞+评论+分享","有效播放人数","活跃视频","日/7日","品类基准"],
  ["CPM","投放费用","曝光量/1000","投放计划","日/7日","品类/阶段基准"],
  ["短视频GPM","短视频成交GMV","短视频曝光/1000","短视频","日/7日","阶段目标"],
  ["直播GPM","直播成交GMV","直播曝光/1000","直播间","场次/日","阶段目标"],
  ["CPA3","达人/投放费用","新增A3人群量","种草达人/投放","活动期","历史+预算"],
  ["看后搜率","看后搜次数","播放量","挂小蓝词内容","日/活动期","品牌基准"],
  ["小蓝词点击率","小蓝词点击次数","小蓝词曝光量","不挂车内容主口径","日/活动期","品牌基准"],
  ["SKU级NPS","推荐者数−贬损者数","有效问卷数","订单系统/手工导入(hybrid)","月/活动期","品类基准·不进Gate主判"],
  ["商品点击率","商品点击人数","内容观看人数","挂车内容","日/7日","阶段目标"],
  ["加购率","加购人数","商品点击人数","商品卡","日/7日","阶段目标"],
  ["转化率","支付人数","商品点击人数","商品卡/直播","日/场次","阶段目标"],
  ["内容数量口径","活跃视频(正在消耗)","—","非全部历史视频","日","口径声明"]];

const FORMULA_MOCK={
  import:{valid_crowd:0.86,decay:-0.05,fatigue:{days:1,reuse:1.2}},
  growth:{valid_crowd:0.81,decay:-0.12,fatigue:{days:2,reuse:2.0}},
  mature:{valid_crowd:0.84,decay:-0.08,fatigue:{days:4,reuse:4.6}},
  decline:{valid_crowd:0.88,decay:0,fatigue:{days:0,reuse:0}},
  renewal:{valid_crowd:0.82,decay:-0.06,fatigue:{days:1,reuse:1.0}},
  retire:{valid_crowd:0,decay:0,fatigue:{days:0,reuse:0}}};

const COST_DRILL={
  import:{rows:[["基础预算(冷启/测试)",6000],["放量预算",0],["种草达人预算(达人采买/BGC)",4000],["带货达人预算(纯佣/付费)",2000],["自播预算(素材/场景/加热)",1500],["投流预算(千川·短视频/直播)",1000],["优惠券预算(券/组合装)",500]],spent:4200,trend:[["近7日 ROI","1.05 → 1.30","↗"],["近7日 GMV","1.2万 → 2.6万/日","↗"],["近7日消耗","¥800 → ¥1,400/日","↗"],["近7日 A3→A4","9% → 11%","↗"]]},
  growth:{rows:[["基础预算",4000],["放量预算",26000],["种草达人预算",9000],["带货达人预算",8000],["自播预算",6000],["投流预算(千川)",5000],["优惠券预算",2000]],spent:31000,trend:[["近7日 ROI","1.18 → 1.24","↗"],["近7日 GMV","8.9万 → 14.2万/日","↗"],["近7日消耗","¥3,800 → ¥5,600/日","↗"],["近7日 A3→A4","8% → 9%","↗"]]},
  mature:{rows:[["基础预算",2000],["放量预算",0],["种草达人预算",3000],["带货达人预算",6000],["自播预算",8000],["投流预算(千川)",5000],["优惠券预算",1000]],spent:9800,trend:[["近7日 ROI","1.30 → 1.27","→"],["近7日 GMV","18.8万 → 19.2万/日","→"],["近7日消耗","¥3,000 → ¥2,700/日","↘"],["近7日 A3→A4","12% → 12%","→"]]},
  decline:{rows:[["残值复投池(例外·≤¥2,000·ROI≥1.5)",2000],["其余预算",0]],spent:0,trend:[["近7日 ROI","—(停投)","—"],["近7日 GMV","5.8千 → 5.2千/日","↘"],["近7日消耗","¥0","—"],["近7日 A3→A4","10% → 10%","→"]]},
  renewal:{rows:[["受控重启预算(投流·历史高ROI素材)",4000],["种草达人预算",2500],["自播预算",1000],["优惠券预算",500]],spent:2600,trend:[["近7日 ROI","0.92 → 1.25","↗"],["近7日 GMV","1.4万 → 3.1万/日","↗"],["近7日消耗","¥500 → ¥900/日","↗"],["近7日 A3→A4","8% → 10%","↗"]]},
  retire:{rows:[["零投放",0]],spent:0,trend:[["近7日 ROI","—","—"],["近7日 GMV","清尾","↘"],["近7日消耗","¥0","—"],["近7日 A3→A4","—","—"]]}};

const STAGE_OPS={
  import:["CPM 口径(人群精准度+量级)","内容胜率(不只看三秒/完播)","CPA3 / 看后搜率(已入种草账)","内容数量口径=活跃视频","商品点击后的转化率(痛点是否真实)"],
  growth:["短视频GPM(已入卖货账)","当日GMV(放量规模)","O/A1/A2→A4 直接转化(不只看A3→A4)","素材消耗能力(能否跑量)","放量衰减公式+有效人群定义(见 N0–N6 判定公式卡)"],
  mature:["SKU包装规格结构(SKU锚·DS定调不可动)","SPU下钻仅参考·不替代SKU","商品卡自然成交占比(自然接棒)","直播依赖:自播/达播分开","人群流失率 + A4种子池复用(新品内测)"],
  decline:["外部趋势/热点/竞品热词(残值复投机会)","停播降频标准明确","残值真实性公式(防假残值)","A5迁移目标SKU(老客不丢)","替代SKU推荐(旧品导流新品)"],
  renewal:["新客拉新率(已入种草账·抖音更看新客)","素材消耗能力(只看老客唤醒不够)","换新次数可配置(默认≤2)","根因六类明确化","老客包→私域/会员召回,不喂千川"],
  retire:["素材数据归档可查(视频下架后)","数据下载/Excel留档(防平台过期)","合同结清状态(达人/直播/投放)","迁移结果(A5是否迁移成功)","不可复活确认留痕"]};

const SOP_DECISIONS=["继续","回修","放大","停止"];

const SOPS=[
 {id:"sop_seed",nm:"达人种草 SOP",owner:"seed_kol",range:"A1→A3",steps:[
  {s:1,env:"达人筛选",i:"人群/场景/SKU锚",p:"类目匹配+粉丝画像+历史CPA3",o:"达人候选表",k:"匹配度/历史CPA3",
   kq:[["达人匹配度(creator_fit_score)","≥80","92","85",true],["历史CPA3","≤¥8","¥5.2","¥6.8",true]],
   kl:["类目匹配贴合","粉丝画像与目标人群一致"],judge:"匹配度达标 且 历史CPA3优于目标",d:"继续/回修",hitl:false},
  {s:2,env:"达人合作(通道:星图/非星图/水下)",i:"候选表+预算",p:"三通道询价(星图/非星图/水下)·合规留痕·涉钱",o:"合作清单(涉钱→HITL)",k:"CPA3预估",
   kq:[["CPA3预估","≤¥8","¥5.5","¥7.2",true],["询价降幅","≥10%","22%","14%",true]],
   kl:["通道合规留痕(星图/非星图/水下)"],judge:"预估CPA3≤目标 且 通道合规",d:"继续/停止",hitl:true},
  {s:3,env:"内容制作(内容胜率拆四)",i:"内容假设(N1↔N2握手)",p:"脚本共创+3秒钩子+信任证据",o:"成片",k:"内容胜率(四拆项)",
   kq:[["爆文潜质分","≥70","88","76",true],["历史同型CTR","≥6%","9.4%","7.1%",true]],
   kl:["内容准确性(卖点无夸大)","品牌调性契合","爆文潜质结构","历史数据对标"],judge:"内容胜率不写大词·四拆项全过",d:"继续/回修",hitl:false},
  {s:4,env:"视频发布(SKU绑定:挂车/小蓝词/搜索词组件)",i:"成片+组件选择",p:"发布+按内容类型绑组件(不挂车→必挂小蓝词/搜索词组件)",o:"上线视频",k:"看后搜率",
   kq:[["组件绑定完成率","100%","100%","100%",true],["发布合规率","100%","100%","100%",true]],
   kl:["挂车vs小蓝词选择正确(不挂车内容不考商品点击)"],judge:"组件适配内容类型",d:"继续",hitl:false},
  {s:5,env:"自然数据监测(24–72h)",i:"24–72h自然数据",p:"3秒率/完播/互动/看后搜/评论区质量",o:"自然胜率判定",k:"三秒率/看后搜率/评论质量",
   kq:[["三秒率","≥20%","41%","32%",true],["完播率","≥25%","33%","28%",true],["看后搜率","≥1.5%","3.4%","2.1%",true],["评论质量评分(comment_quality_score)","≥65","82","72",true]],
   kl:["评论区质量:正向/答疑占比·不只看互动率"],judge:"自然门:四项全过才许投放",d:"放大/回修/停止",hitl:false},
  {s:6,env:"投流加热(种草通/品牌投流工具/千川)",i:"过自然门的视频",p:"按目标选工具:种草通(A3)/品牌投流工具/千川·握手预算内·涉钱",o:"投放计划",k:"CPM/CPA3",
   kq:[["CPM","≤¥45","¥28","¥36",true],["CPA3","≤¥8","¥5.2","¥6.5",true]],
   kl:["工具口径与目标匹配(种草目标不用GMV ROI工具考核)"],judge:"CPA3守线才续投",d:"继续/停止",hitl:true},
  {s:7,env:"放量(衰减公式四线同守)",i:"ROI/衰减数据",p:"放量衰减公式:CPA3上浮/CPM漂移/看后搜率/素材疲劳四线同守",o:"放量计划",k:"CPA3上浮/看后搜/疲劳",
   kq:[["CPA3上浮","≤15%","+4%","+9%",true],["CPM漂移","≤10%","+3%","+6%",true],["看后搜率","≥1.5%","3.4%","1.8%",true],["素材复用(疲劳)","≤4次","2.0次","2.6次",true]],
   kl:["疲劳前轻刷新·不硬扛"],judge:"四线任一破→冻结加投回滚",d:"放大/回修",hitl:false},
  {s:8,env:"复盘(分层:曝光/内容质量/种草深度)",i:"全量数据",p:"三层拆:曝光层达成/内容质量层(content_quality_score)/种草深度层(新增A3·CPA3)",o:"复盘结论(枚举)",k:"新增A3/CPA3",
   kq:[["曝光达成率","≥100%","164%","118%",true],["内容质量评分(content_quality_score)","≥70","86","74",true],["新增A3达成率","≥100%","136%","112%",true]],
   kl:["KPI分层不混算"],judge:"验果=看新增A3动没动·非发了几条",d:"继续/回修",hitl:false},
  {s:9,env:"素材授权(全量入库·高胜率打标)",i:"全量素材",p:"全量入库(不只收高胜率)+高胜率打标复用",o:"素材资产库",k:"入库率/打标数",
   kq:[["全量入库率","100%","100%","100%",true],["高胜率打标数","≥3","7","4",true]],
   kl:["低胜率素材留档供反例学习"],judge:"全量入库·高胜率打标",d:"继续",hitl:false}]},
 {id:"sop_comm",nm:"带货达人 SOP",owner:"commerce_kol",range:"A3→A5",steps:[
  {s:1,env:"选品(引流款/利润款/新品/老品)",i:"货盘/SKU锚",p:"四分定位:引流/利润/新品/老品·角色不同考核不同",o:"选品表",k:"预估GPM",
   kq:[["佣金率×转化预估GPM","≥¥300","¥520","¥380",true]],kl:["商品角色四分定位清晰"],judge:"角色定位与考核匹配",d:"继续/回修",hitl:false},
  {s:2,env:"内容策划(纯佣/付费分流)",i:"选品表+A3人群",p:"卖点→场景话术·纯佣达人/付费达人两版分流",o:"带货脚本×2",k:"脚本过检率",
   kq:[["脚本过检率","≥90%","100%","95%",true]],kl:["纯佣/付费两版脚本分流到位"],judge:"两类达人脚本不混用",d:"继续/回修",hitl:false},
  {s:3,env:"达人筛选(购买力/历史GPM/佣金率/服务费)",i:"带货达人库",p:"四维筛:粉丝购买力+历史GPM+佣金率+基础服务费",o:"候选表",k:"预估GPM",
   kq:[["历史GPM","≥¥300","¥760","¥410",true],["粉丝购买力指数","≥60","81","68",true],["佣金率","≤25%","18%","22%",true],["基础服务费","≤¥3,000","¥0","¥1,500",true]],
   kl:["达人匹配度(creator_fit_score)"],judge:"四维全过入候选",d:"继续",hitl:false},
  {s:4,env:"邀约(纯佣/付费不同流程)",i:"候选表",p:"纯佣:佣金谈判 · 付费:服务费+佣金双谈(涉钱→HITL)",o:"合作确认",k:"成本",
   kq:[["邀约响应率","≥30%","52%","38%",true],["合作成本vs预算","≤100%","68%","85%",true]],kl:["纯佣与付费流程分开留痕"],judge:"成本入预算·流程合规",d:"继续/停止",hitl:true},
  {s:5,env:"素材制作+发布(挂车准确性检查)",i:"脚本+样品",p:"拍摄+挂车准确性三查(SKU对/规格对/价格对)",o:"带货视频",k:"商品点击率预判",
   kq:[["挂车准确率","100%","100%","100%",true],["商品点击率预判","≥6%","9.2%","7.0%",true]],kl:["详情与内容承诺一致"],judge:"挂错车=直接回修",d:"继续/回修",hitl:false},
  {s:6,env:"发布监控",i:"上线视频",p:"点击/加购/转化实时监控",o:"监控日报",k:"商品点击率/加购率",
   kq:[["商品点击率","≥6%","9.0%","8.5%",true],["加购率","≥3.5%","5.8%","5.2%",true]],kl:["异常波动2小时内响应"],judge:"实时线守住才加热",d:"放大/回修",hitl:false},
  {s:7,env:"视频加热(千川+随心推·GMV+ROI+GPM三看)",i:"过门视频",p:"千川+随心推组合加热·握手预算内·涉钱·不只看ROI",o:"加热计划",k:"GPM/ROI",
   kq:[["GMV达成率","≥100%","148%","112%",true],["ROI","≥1.2","1.8","1.24",true],["GPM","≥¥300","¥520","¥360",true]],
   kl:["GMV+ROI+GPM三指标同看·防单ROI误导"],judge:"三看齐达标才放大",d:"放大/回修",hitl:true},
  {s:8,env:"复盘(佣金/基础服务费/单达人效率)",i:"全量数据",p:"验果=A3→A4动没动+佣金/基础服务费/单达人效率三项入账",o:"复盘结论",k:"转化率/单达人效率",
   kq:[["单达人GMV/成本效率","≥1.5","2.6","1.8",true],["佣金+服务费占比","≤30%","19%","24%",true]],
   kl:["高效达人进白名单·低效达人记原因"],judge:"验果=A3→A4动没动",d:"继续/停止",hitl:false}]},
 {id:"sop_live",nm:"直播间 SOP",owner:"live_room",range:"A3→A5",steps:[
  {s:1,env:"目标制定(GMV/GPM/ROI/A3承接目标)",i:"阶段定标↓",p:"场次四目标:GMV/GPM/ROI/A3承接人数",o:"场次目标卡",k:"GPM目标",
   kq:[["场次GPM目标","≥¥500","¥780","¥650",true],["ROI目标","≥1.2","1.8","1.3",true],["A3承接人数目标","按握手卡","+2,400","+1,800",true]],
   kl:["目标从定标↓来·不用实际倒推"],judge:"四目标齐备才开播",d:"继续",hitl:false},
  {s:2,env:"货组制定(引流款/主推款/利润款)",i:"货盘+库存(N3检查表)",p:"三类款排布+客单结构",o:"货组表",k:"客单结构",
   kq:[["三类款齐备率","100%","100%","100%",true],["利润款占比","≥20%","32%","24%",true]],kl:["货组与人群匹配"],judge:"三类款齐备",d:"继续/回修",hitl:false},
  {s:3,env:"直播话术(A3疑虑承接+促单段位)",i:"内容假设+A3疑虑清单",p:"开场/演示/解释/促单/收尾五段+A3疑虑逐条承接+促单段位设计",o:"话术脚本",k:"停留/互动",
   kq:[["预期停留","≥40s","96s","52s",true],["促单段位齐备","5/5","5/5","5/5",true]],
   kl:["A3疑虑清单逐条有承接话术","促单段位分层(轻促/重促)"],judge:"A3疑虑无遗漏",d:"继续/回修",hitl:false},
  {s:4,env:"场景搭建(进房率/停留时长)",i:"场地+SKU",p:"场景还原(做饭/试吃)·以进房率与停留验证",o:"直播间场景",k:"进房率",
   kq:[["进房率","≥8%","12.4%","9.1%",true],["停留时长","≥40s","96s","52s",true]],kl:["场景与内容假设一致"],judge:"两项达标场景成立",d:"继续",hitl:false},
  {s:5,env:"切片素材(切片GPM/切片A4贡献)",i:"直播切片",p:"高光切片二创·量化切片GPM与切片A4贡献",o:"切片素材",k:"切片GPM",
   kq:[["切片GPM","≥¥300","¥520","¥340",true],["切片A4贡献占比","≥10%","18%","12%",true]],kl:["切片保留信任证据段"],judge:"切片贡献量化",d:"继续",hitl:false},
  {s:6,env:"直播复盘(停留/互动/成交/促单断点)",i:"场次数据",p:"四断点诊断:停留/互动/成交/促单",o:"场次复盘",k:"直播GPM/成交率",
   kq:[["直播GPM","≥¥500","¥780","¥650",true],["直播成交率","≥2%","3.6%","2.8%",true]],
   kl:["促单断点定位到分钟段"],judge:"断点定位到段位",d:"放大/回修",hitl:false},
  {s:7,env:"投流加热(千川直播/短视频引流)",i:"过门场次",p:"千川直播加热+短视频引流双通道·握手预算内·涉钱",o:"加热计划",k:"ROI",
   kq:[["ROI","≥1.2","1.8","1.3",true],["引流进房成本","≤¥1.5","¥0.8","¥1.2",true]],kl:["双通道分开记账"],judge:"ROI守线",d:"放大/回修",hitl:true},
  {s:8,env:"切片复盘(A3→A4/A4→A5效率)",i:"切片数据",p:"验果=切片带来的A3→A4与A4→A5效率",o:"复盘结论",k:"切片GPM",
   kq:[["A3→A4","≥8%","16%","11%",true],["A4→A5","≥12%","21%","14%",true]],kl:["效率归因回内容/货组/话术"],judge:"验果=A3→A4/A4→A5动没动",d:"继续/停止",hitl:false}]}];

function sopSuggest(st){
  const opts=(st.d||"继续").split("/");
  if(!st.kq||!st.kq.length) return opts[0];
  const allPass=st.kq.every(q=>q[4]===true);
  if(allPass) return opts.indexOf("放大")>=0?"放大":(opts.indexOf("继续")>=0?"继续":opts[0]);
  return opts.indexOf("回修")>=0?"回修":(opts.indexOf("停止")>=0?"停止":opts[opts.length-1]);
}

const SCREENS=[
  {id:"today",  no:1, nm:"今日",                    mods:["M1 今日运营"]},
  {id:"dual",   no:2, nm:"双前线 · J0–J6 经营旅程", mods:["M2 人群场景池","M3 内容×商品共创","M4 兴趣测试","M5 信任转化","M6 直播/成交","M7 体验反馈","M8 复购资产"]},
  {id:"pipe",   no:3, nm:"N0–N6 引擎槽",            mods:["(引擎槽·系统处理管道)"]},
  {id:"collect",no:4, nm:"量实",                    mods:["N0 Triage","6开关抖音口径","去假校准"]},
  {id:"ledger", no:5, nm:"三本账",                  mods:["种草账/卖货账/联合账(A3桥)","A1–A5联合资产 + SKU NPS","预算 + HITL"]},
  {id:"task",   no:6, nm:"任务/复盘",               mods:["M9 任务中心","M10 复盘中心","M11 三岗 SOP(泡面级KPI:目标值/历史最佳值)"]},
  {id:"cockpit",no:7, nm:"驾驶舱",                  mods:["一线视角/主管视角","HUMAN_GATE_QUEUE + 核定留痕"]}
];

const LEDGER_5A=[
  {book:"种草账",metrics:"曝光、3秒留存、完播",a:"A1"},
  {book:"种草账",metrics:"互动、评论、收藏",a:"A2"},
  {book:"种草账",metrics:"搜索增长、加购、深度评论",a:"A3"},
  {book:"卖货账",metrics:"下单人数、成交转化率、GMV",a:"A4"},
  {book:"联合账",metrics:"新增A3人群→商品点击率",a:"A2→A3"},
  {book:"联合账",metrics:"新增A3人群→成交转化率",a:"A3→A4"},
  {book:"联合账",metrics:"新增A3人群→新客复购率",a:"A4→A5"}
];

const A5A_SOURCE_LABEL={short_video:"短视频",live:"直播",search:"搜索",shop_card:"商品卡",kol:"达人"};

const JN_MAP=[
  {n:"N0",sys:"数据上报 Triage",               j:"J2 兴趣测试 / J5 体验反馈(回流入口)"},
  {n:"N1",sys:"内容 / 素材计划",               j:"J0 人群场景定义 / J1 内容×商品共创"},
  {n:"N2",sys:"达人 / 投流 / 直播排期",        j:"J1 内容×商品共创(涉钱→HITL)"},
  {n:"N3",sys:"站内承接:商品卡/店铺/直播",     j:"J4 交易转化"},
  {n:"N4",sys:"质量可信门",                    j:"J2 兴趣测试 / J3 信任建立 / J5 体验反馈"},
  {n:"N5",sys:"人群资产 / 迁移",               j:"J6 复购资产"},
  {n:"N6",sys:"判级 / 裁决",                   j:"(不对应 J · 裁决层:Gate1-4/R/T)"}
];

const VERDICT_OPTIONS=["有效","无效","继续测试","固化SOP"];

const JOURNEY=[
  {j:"J0",nm:"人群场景定义",mod:"M2 人群场景池",slot:"N1(计划)·定标↓",keys:["search_growth"],
   seed:"找人群、场景、痛点",sell:"判断购买力和货盘机会"},
  {j:"J1",nm:"内容 × 商品共创",mod:"M3 内容×商品共创",slot:"N1(计划)",keys:["content_ctr"],
   seed:"脚本、达人、短视频、直播主题",sell:"商品卡、组合装、价格机制"},
  {j:"J2",nm:"兴趣测试",mod:"M4 兴趣测试",slot:"N0(量实)+N4(门)",keys:["retain_3s","completion","interact","collect"],
   seed:"播放、完播、互动、收藏",sell:"点击、进店、加购"},
  {j:"J3",nm:"信任建立",mod:"M5 信任转化",slot:"N4(质量可信门)",keys:["comment_howto","add_cart"],
   seed:"配料、试吃、评论、真实反馈",sell:"加购、询单、直播停留"},
  {j:"J4",nm:"交易转化",mod:"M6 直播/成交",slot:"N3(站内承接)",keys:["cvr","live_stay","live_cvr"],
   seed:"直播中继续讲场景价值",sell:"下单、GMV、客单、转化率"},
  {j:"J5",nm:"体验反馈",mod:"M7 体验反馈",slot:"N0(回流)+N4(体验硬红线)",keys:["refund_rate","good_review"],
   seed:"好评、晒单、使用场景再传播",sell:"退款、差评、客服、物流"},
  {j:"J6",nm:"复购资产",mod:"M8 复购资产",slot:"N5(人群资产/迁移)",keys:["repurchase","a3_to_new_customer_repurchase_rate"],
   seed:"内容、人群、品牌词资产",sell:"会员、复购、家庭装、利润品"}
];

const RULES=[
  {id:"R1",node:"J2",nm:"热但不卖",a5a:"A1/A2 有效,但 A2→A3 断",sopref:[{id:"sop_seed",s:3},{id:"sop_seed",s:5}],cond:"播放高 · 完播高 · 商品点击率低",kpi:"content_ctr",
   when:m=>m.retain_3s.pass&&m.completion.pass&&!m.content_ctr.pass,
   judge:"内容有吸引力,但商品钩子弱(种草没接住卖货)",
   tasks:[{t:"把产品出现点前置到第5秒",team:"seed_kol"},{t:"商品卡主图改「一勺出味」",team:"commerce_kol"},
          {t:"评论区置顶购买理由",team:"seed_kol"},{t:"直播增加该场景讲解段",team:"live_room"}]},
  {id:"R2",node:"J3",nm:"点得动·加不动",a5a:"A2→A3 断",sopref:[{id:"sop_comm",s:5}],extra:"N3 承接检查表",cond:"商品点击率高 · 加购率低",kpi:"add_cart",
   when:m=>m.product_ctr.pass&&!m.add_cart.pass,
   judge:"用户有兴趣,但商品承接不足",
   tasks:[{t:"商品标题补场景词",team:"commerce_kol"},{t:"内容补使用场景演示",team:"seed_kol"},
          {t:"商品卡增加评价证据",team:"commerce_kol"},{t:"检查价格与组合装(涉钱)",team:"commerce_kol",money:1500}]},
  {id:"R3",node:"J5",nm:"卖得动·退得多",a5a:"A4 质量风险",sopref:[{id:"sop_live",s:3},{id:"sop_comm",s:5}],extra:"N3 详情一致性",cond:"成交转化达标 · 退款率超线",kpi:"refund_rate",
   when:m=>m.cvr.pass&&!m.refund_rate.pass,
   judge:"卖出去了,但体验或预期有问题(内容承诺过度)",
   tasks:[{t:"回看直播话术是否夸大",team:"live_room"},{t:"检查商品详情一致性",team:"commerce_kol"},
          {t:"差评关键词聚类",team:"joint"},{t:"包裹加使用说明+菜谱卡(涉钱)",team:"commerce_kol",money:3000}]},
  {id:"R4",node:"J4",nm:"收藏高·成交低",a5a:"A3→A4 断",sopref:[{id:"sop_live",s:3},{id:"sop_comm",s:2}],cond:"收藏率高 · 成交转化率低",kpi:"cvr",
   when:m=>m.collect.pass&&!m.cvr.pass,
   judge:"用户觉得有用,但购买紧迫感不足",
   tasks:[{t:"直播承接该收藏人群",team:"live_room"},{t:"限时券(涉钱·HITL)",team:"commerce_kol",money:8000},
          {t:"打「今天为什么买」话术",team:"seed_kol"},{t:"设计体验装(货盘变更·不可逆)",team:"commerce_kol",irr:true}]},
  {id:"R5",node:"J6",nm:"好评高·复购低",a5a:"A4→A5 断",sopref:[{id:"sop_comm",s:1},{id:"sop_live",s:2}],cond:"好评率高 · 复购率低",kpi:"repurchase",
   when:m=>m.good_review.pass&&!m.repurchase.pass,
   judge:"产品体验不错,但复购机制不足",
   tasks:[{t:"复购券定向老客(涉钱)",team:"commerce_kol",money:12000},{t:"推出家庭装(货盘变更·不可逆)",team:"commerce_kol",irr:true},
          {t:"会员召回",team:"joint"},{t:"拍老客使用场景内容",team:"seed_kol"}]},
  {id:"R6",node:"J3",nm:"评论集中问「怎么用」",a5a:"A3 信任问题",sopref:[{id:"sop_seed",s:3},{id:"sop_live",s:3}],cond:"「怎么用」评论占比超线",kpi:"comment_howto",
   when:m=>!m.comment_howto.pass,
   judge:"使用教育不足(信任卡在不会用)",
   tasks:[{t:"拍 3 条菜谱视频",team:"seed_kol"},{t:"商品详情增加使用方式",team:"commerce_kol"},
          {t:"直播增加演示段",team:"live_room"}]},
  {id:"R7",node:"J4",nm:"停留高·促单弱",a5a:"A3→A4 直播转化弱",sopref:[{id:"sop_live",s:3},{id:"sop_live",s:6}],cond:"直播停留高 · 直播成交率低",kpi:"live_cvr",
   when:m=>m.live_stay.pass&&m.live_stay.v>0&&!m.live_cvr.pass,
   judge:"讲得有吸引力,但促单弱",
   tasks:[{t:"直播增加商品利益点",team:"live_room"},{t:"限时机制+组合装解释(涉钱)",team:"live_room",money:5000},
          {t:"购买路径提示",team:"commerce_kol"},{t:"场景强化话术",team:"seed_kol"}]}
];

const MOCK_MODE = true;

const MOCK_DATA = {
  import : { id:"DY-LYX-Q10", spu:"SPU_减盐系列", name:"六月鲜轻10克盐减盐酱油", stage:"import",
    scene:{crowd:"控盐家庭",scene:"爸妈日常炒菜",pain:"想少盐又怕没味",reason:"少盐但有鲜味",priority:"高",status:"测试中"},
    metrics:[ {k:"play_3s_rate",label:"3秒率",v:0.32,raw:0.41,t:0.20,dir:"gt"},
              {k:"completion_rate",label:"完播率",v:0.28,t:0.25,dir:"gt"},
              {k:"product_ctr",label:"商品点击率",v:0.09,t:0.06,dir:"gt"},
              {k:"roi",label:"冷启ROI",v:1.3,t:1.0,dir:"gt"} ],
    ledger3:{
      seed:[ {k:"exposure",label:"曝光量",v:820000,raw:1150000,t:500000,dir:"gt",u:""},
             {k:"retain_3s",label:"3秒留存",v:0.32,raw:0.41,t:0.20,dir:"gt",u:"%"},
             {k:"completion",label:"完播率",v:0.28,t:0.25,dir:"gt",u:"%"},
             {k:"interact",label:"互动率",v:0.052,raw:0.081,t:0.04,dir:"gt",u:"%"},
             {k:"collect",label:"收藏率",v:0.031,t:0.025,dir:"gt",u:"%"},
             {k:"comment_howto",label:"评论「怎么用」占比",v:0.34,t:0.20,dir:"lt",u:"%"},
             {k:"content_ctr",label:"内容带出商品点击率",v:0.09,t:0.06,dir:"gt",u:"%"},
             {k:"search_growth",label:"搜索增长",v:0.18,t:0.10,dir:"gt",u:"%"},
             {k:"new_a3",label:"新增A3人群",v:6800,t:5000,dir:"gt",u:""},
             {k:"cpa3",label:"CPA3",v:5.8,t:8,dir:"lt",u:"¥"},
             {k:"post_search",label:"看后搜率",v:0.021,t:0.015,dir:"gt",u:"%"},
             {k:"blue_word",label:"小蓝词点击率",v:0.018,t:0.015,dir:"gt",u:"%"},
             {k:"iq",label:"互动质量(正向占比)",v:0.72,t:0.65,dir:"gt",u:"%"} ],
      sell:[ {k:"product_ctr",label:"商品点击率",v:0.09,t:0.06,dir:"gt",u:"%"},
             {k:"add_cart",label:"加购率",v:0.021,t:0.035,dir:"gt",u:"%"},
             {k:"cvr",label:"成交转化率",v:0.031,t:0.025,dir:"gt",u:"%"},
             {k:"gmv",label:"GMV",v:186000,t:120000,dir:"gt",u:"¥"},
             {k:"aov",label:"客单价",v:58,t:45,dir:"gt",u:"¥"},
             {k:"refund_rate",label:"退款率",v:0.05,t:0.08,dir:"lt",u:"%"},
             {k:"good_review",label:"好评率",v:0.96,t:0.92,dir:"gt",u:"%"},
             {k:"repurchase",label:"复购率",v:0.06,t:0.05,dir:"gt",u:"%"},
             {k:"live_stay",label:"直播停留",v:52,t:40,dir:"gt",u:"s"},
             {k:"live_cvr",label:"直播成交率",v:0.028,t:0.02,dir:"gt",u:"%"} ],
      joint:[{k:"a3_to_product_click_rate",label:"新增A3人群→商品点击率",v:0.09,raw:0.064,t:0.06,dir:"gt",u:"%"},
             {k:"a3_to_order_conversion_rate",label:"新增A3人群→成交转化率",v:0.0028,t:0.0020,dir:"gt",u:"%"},
             {k:"a3_to_new_customer_repurchase_rate",label:"新增A3人群→新客复购率",v:0.06,t:0.05,dir:"gt",u:"%"}] },
    fiveA:{
      A1:{label:"了解",people:820000,new_people:120000,rate_to_next:0.18},
      A2:{label:"吸引",people:147600,new_people:26000,rate_to_next:0.22},
      A3:{label:"种草",people:32472,new_people:6800,rate_to_next:0.11},
      A4:{label:"购买",people:3572,new_people:760,rate_to_next:0.06},
      A5:{label:"忠诚",people:214,new_people:38,rate_to_next:null} },
    fiveA_source:{
      short_video:{A1:520000,A2:78000,A3:14000,A4:1200},
      live:{A1:180000,A2:42000,A3:11000,A4:1800},
      search:{A1:60000,A2:15000,A3:5200,A4:420},
      shop_card:{A1:40000,A2:8600,A3:2200,A4:152},
      kol:{A1:20000,A2:4000,A3:72,A4:0} },
    node_outputs:{ 1:{hook_3s:"凉拌菜一勺封神",product_card_bound:true},
                   3:{gpm:420,cvr:0.031,channel_type:"in_app_closed_loop"},
                   5:{a1_grow:0.35,a2_grow:0.22,seed_pools:{product_clicker_pool:1800,add_to_cart_pool:260,first_buyer_pool:95}} },
    gate_result:{ gate:"Gate1", gate1_pass:true, next_stage:"growth",
      hard_redline:{experience_score:4.7,refund_rate:0.05,bad_review_rate:0.03,pass:true},
      verify_up:"品类层A1-A2人群资产上移" },
    human_gate_actions:[] },
  growth : { id:"DY-WDM-WJX", spu:"SPU_味极鲜", name:"味达美味极鲜酱油", stage:"growth",
    scene:{crowd:"一人食白领",scene:"下班十分钟晚餐",pain:"不想复杂做饭又不想将就",reason:"一勺出饭店味",priority:"高",status:"放大中"},
    metrics:[ {k:"exposure_growth",label:"曝光增长",v:2.6,t:2.0,dir:"gt"},
              {k:"live_gpm",label:"直播GPM",v:650,raw:780,t:500,dir:"gt"},
              {k:"a3_to_a4",label:"A3→A4",v:0.11,t:0.08,dir:"gt"},
              {k:"roi_at_scale",label:"放量ROI",v:1.22,t:1.2,dir:"gt"} ],
    ledger3:{
      seed:[ {k:"exposure",label:"曝光量",v:2400000,raw:3100000,t:1500000,dir:"gt",u:""},
             {k:"retain_3s",label:"3秒留存",v:0.30,raw:0.38,t:0.22,dir:"gt",u:"%"},
             {k:"completion",label:"完播率",v:0.26,t:0.25,dir:"gt",u:"%"},
             {k:"interact",label:"互动率",v:0.061,raw:0.092,t:0.045,dir:"gt",u:"%"},
             {k:"collect",label:"收藏率",v:0.048,t:0.030,dir:"gt",u:"%"},
             {k:"comment_howto",label:"评论「怎么用」占比",v:0.16,t:0.20,dir:"lt",u:"%"},
             {k:"content_ctr",label:"内容带出商品点击率",v:0.085,t:0.06,dir:"gt",u:"%"},
             {k:"search_growth",label:"搜索增长",v:0.32,t:0.15,dir:"gt",u:"%"},
             {k:"new_a3",label:"新增A3人群",v:24500,t:20000,dir:"gt",u:""},
             {k:"cpa3",label:"CPA3",v:6.5,t:8,dir:"lt",u:"¥"},
             {k:"post_search",label:"看后搜率",v:0.034,t:0.020,dir:"gt",u:"%"},
             {k:"blue_word",label:"小蓝词点击率",v:0.026,t:0.018,dir:"gt",u:"%"},
             {k:"iq",label:"互动质量(正向占比)",v:0.69,t:0.65,dir:"gt",u:"%"} ],
      sell:[ {k:"product_ctr",label:"商品点击率",v:0.085,t:0.06,dir:"gt",u:"%"},
             {k:"add_cart",label:"加购率",v:0.052,t:0.035,dir:"gt",u:"%"},
             {k:"cvr",label:"成交转化率",v:0.018,t:0.028,dir:"gt",u:"%"},
             {k:"gmv",label:"GMV",v:940000,t:600000,dir:"gt",u:"¥"},
             {k:"sv_gpm",label:"短视频GPM",v:380,t:300,dir:"gt",u:"¥"},
             {k:"aov",label:"客单价",v:62,t:50,dir:"gt",u:"¥"},
             {k:"refund_rate",label:"退款率",v:0.06,t:0.08,dir:"lt",u:"%"},
             {k:"good_review",label:"好评率",v:0.95,t:0.92,dir:"gt",u:"%"},
             {k:"repurchase",label:"复购率",v:0.09,t:0.08,dir:"gt",u:"%"},
             {k:"live_stay",label:"直播停留",v:96,t:60,dir:"gt",u:"s"},
             {k:"live_cvr",label:"直播成交率",v:0.012,t:0.025,dir:"gt",u:"%"} ],
      joint:[{k:"a3_to_product_click_rate",label:"新增A3人群→商品点击率",v:0.085,raw:0.066,t:0.06,dir:"gt",u:"%"},
             {k:"a3_to_order_conversion_rate",label:"新增A3人群→成交转化率",v:0.0015,t:0.0020,dir:"gt",u:"%"},
             {k:"a3_to_new_customer_repurchase_rate",label:"新增A3人群→新客复购率",v:0.09,t:0.08,dir:"gt",u:"%"}] },
    fiveA:{
      A1:{label:"了解",people:2400000,new_people:640000,rate_to_next:0.21},
      A2:{label:"吸引",people:504000,new_people:118000,rate_to_next:0.19},
      A3:{label:"种草",people:95760,new_people:24500,rate_to_next:0.09},
      A4:{label:"购买",people:8618,new_people:2100,rate_to_next:0.09},
      A5:{label:"忠诚",people:776,new_people:190,rate_to_next:null} },
    fiveA_source:{
      short_video:{A1:1300000,A2:255000,A3:38000,A4:2400},
      live:{A1:720000,A2:172000,A3:41000,A4:5100},
      search:{A1:190000,A2:42000,A3:10500,A4:820},
      shop_card:{A1:120000,A2:24000,A3:5100,A4:280},
      kol:{A1:70000,A2:11000,A3:1160,A4:18} },
    node_outputs:{ 1:{validated_hook:"一勺出饭店味",material_matrix:8,material_fatigue:{avg_reuse:2.0}},
                   3:{landing_split:{live_gpm:650,entry_rate:0.045,live_pay_cvr:0.036,card_gmv_share:0.18}},
                   5:{a3_to_a4_rate:0.11,new_customer_rate:0.12,seed_pools_refresh:{first_buyer_pool:1010}} },
    gate_result:{ gate:"Gate2", gate2_pass:true, next_stage:"mature",
      hard_redline:{experience_score:4.7,refund_rate:0.05,bad_review_rate:0.03,pass:true},
      roi_lines:{roi_stoploss_line:1.0,roi_growth_hold_line:1.2},
      entry_gmv_split:{live_gmv_share:0.62,short_video_gmv_share:0.20,card_gmv_share:0.18} },
    human_gate_actions:[{k:"投流放量加投(跨档)",amt:25000,irr:false},{k:"直播加热",amt:6000,irr:false}] },
  mature : { id:"DY-LYX-TJ", spu:"SPU_六月鲜", name:"六月鲜特级原酿酱油", stage:"mature",
    scene:{crowd:"品质家庭",scene:"日常炒菜/蒸鱼",pain:"要好酱油但不想踩坑",reason:"原酿本味",priority:"中",status:"SOP"},
    metrics:[ {k:"contribution_margin",label:"贡献利润率",v:0.175,t:0.15,dir:"gt"},
              {k:"card_gmv_share",label:"商品卡占比",v:0.31,t:0.25,dir:"gt"},
              {k:"a4_to_a5",label:"A4→A5",v:0.16,t:0.12,dir:"gt"},
              {k:"stable_roi",label:"稳定ROI",v:1.28,t:1.2,dir:"gt"} ],
    ledger3:{
      seed:[ {k:"exposure",label:"曝光量",v:1650000,t:1000000,dir:"gt",u:""},
             {k:"retain_3s",label:"3秒留存",v:0.27,t:0.22,dir:"gt",u:"%"},
             {k:"completion",label:"完播率",v:0.25,t:0.24,dir:"gt",u:"%"},
             {k:"interact",label:"互动率",v:0.048,t:0.040,dir:"gt",u:"%"},
             {k:"collect",label:"收藏率",v:0.034,t:0.030,dir:"gt",u:"%"},
             {k:"comment_howto",label:"评论「怎么用」占比",v:0.12,t:0.20,dir:"lt",u:"%"},
             {k:"content_ctr",label:"内容带出商品点击率",v:0.078,t:0.06,dir:"gt",u:"%"},
             {k:"search_growth",label:"搜索增长",v:0.11,t:0.08,dir:"gt",u:"%"},
             {k:"new_a3",label:"新增A3人群",v:8200,t:6000,dir:"gt",u:""},
             {k:"cpa3",label:"CPA3",v:7.2,t:9,dir:"lt",u:"¥"},
             {k:"post_search",label:"看后搜率",v:0.018,t:0.012,dir:"gt",u:"%"},
             {k:"blue_word",label:"小蓝词点击率",v:0.015,t:0.012,dir:"gt",u:"%"},
             {k:"iq",label:"互动质量(正向占比)",v:0.74,t:0.65,dir:"gt",u:"%"} ],
      sell:[ {k:"product_ctr",label:"商品点击率",v:0.078,t:0.06,dir:"gt",u:"%"},
             {k:"add_cart",label:"加购率",v:0.058,t:0.040,dir:"gt",u:"%"},
             {k:"cvr",label:"成交转化率",v:0.034,t:0.028,dir:"gt",u:"%"},
             {k:"gmv",label:"GMV",v:1380000,t:1000000,dir:"gt",u:"¥"},
             {k:"aov",label:"客单价",v:71,t:60,dir:"gt",u:"¥"},
             {k:"refund_rate",label:"退款率",v:0.04,t:0.06,dir:"lt",u:"%"},
             {k:"good_review",label:"好评率",v:0.97,t:0.93,dir:"gt",u:"%"},
             {k:"repurchase",label:"复购率",v:0.10,t:0.18,dir:"gt",u:"%"},
             {k:"live_stay",label:"直播停留",v:78,t:60,dir:"gt",u:"s"},
             {k:"live_cvr",label:"直播成交率",v:0.031,t:0.025,dir:"gt",u:"%"} ],
      joint:[{k:"a3_to_product_click_rate",label:"新增A3人群→商品点击率",v:0.078,t:0.06,dir:"gt",u:"%"},
             {k:"a3_to_order_conversion_rate",label:"新增A3人群→成交转化率",v:0.0027,t:0.0022,dir:"gt",u:"%"},
             {k:"a3_to_new_customer_repurchase_rate",label:"新增A3人群→新客复购率",v:0.10,t:0.18,dir:"gt",u:"%"}] },
    fiveA:{
      A1:{label:"了解",people:1650000,new_people:180000,rate_to_next:0.20},
      A2:{label:"吸引",people:330000,new_people:41000,rate_to_next:0.17},
      A3:{label:"种草",people:56100,new_people:8200,rate_to_next:0.12},
      A4:{label:"购买",people:6732,new_people:930,rate_to_next:0.16},
      A5:{label:"忠诚",people:1077,new_people:145,rate_to_next:null} },
    fiveA_source:{
      short_video:{A1:620000,A2:112000,A3:16000,A4:1500},
      live:{A1:520000,A2:118000,A3:22000,A4:2900},
      search:{A1:280000,A2:58000,A3:12000,A4:1400},
      shop_card:{A1:180000,A2:35000,A3:5600,A4:880},
      kol:{A1:50000,A2:7000,A3:500,A4:52} },
    node_outputs:{ 2:{invest_mode:"harvest",invest_ratio:0.22,plans_cut:7},
                   3:{contribution_profit:45600,gmv_split:{live_gmv_share:0.48,card_gmv_share:0.31},natural_traffic_share:0.42},
                   4:{live_dependence_gate:{live_gmv_share:0.48,live_gmv_share_max:0.55,pass:true},portfolio_guard:{crowd_overlap:0.38,overlap_max:0.45,pass:true}},
                   5:{a4_to_a5_rate:0.16,repurchase_rate:0.21,member_ltv:175} },
    gate_result:{ gate:"Gate3", gate3_pass:true, gate3_verdict:"stable_keep", next_action:"stay_mature_next_cycle",
      hard_redline:{experience_score:4.8,refund_rate:0.04,bad_review_rate:0.02,pass:true},
      options:["stable_keep","stable_reduce_spend","refresh_restart","decline_stoploss","retire_archive"], portfolio_escalation:false },
    human_gate_actions:[{k:"降投维护(stable_reduce_spend)",amt:0,irr:true},{k:"组合内耗·升品类会诊",amt:0,irr:true}] },
  decline: { id:"DY-CVN-OLD", spu:"SPU_葱伴侣", name:"葱伴侣经典黄豆酱(老装)", stage:"decline",
    scene:{crowd:"存量老客",scene:"东北菜蘸酱",pain:"老装规格不合适",reason:"习惯口味",priority:"低",status:"暂停"},
    metrics:[ {k:"natural_gmv",label:"残值自然GMV",v:38000,t:20000,dir:"gt"},
              {k:"card_gmv_share",label:"商品卡占比",v:0.71,t:0.50,dir:"gt"},
              {k:"refund_rate",label:"退款率",v:0.05,t:0.08,dir:"lt"},
              {k:"contribution_profit",label:"残值利润",v:6800,t:0,dir:"gt"} ],
    ledger3:{
      seed:[ {k:"exposure",label:"曝光量(自然)",v:210000,t:100000,dir:"gt",u:""},
             {k:"retain_3s",label:"3秒留存",v:0.18,t:0.15,dir:"gt",u:"%"},
             {k:"completion",label:"完播率",v:0.21,t:0.18,dir:"gt",u:"%"},
             {k:"interact",label:"互动率",v:0.019,t:0.015,dir:"gt",u:"%"},
             {k:"collect",label:"收藏率",v:0.012,t:0.010,dir:"gt",u:"%"},
             {k:"comment_howto",label:"评论「怎么用」占比",v:0.09,t:0.20,dir:"lt",u:"%"},
             {k:"content_ctr",label:"内容带出商品点击率",v:0.052,t:0.040,dir:"gt",u:"%"},
             {k:"search_growth",label:"搜索增长",v:-0.12,t:-0.30,dir:"gt",u:"%"},
             {k:"new_a3",label:"新增A3人群(自然)",v:120,t:100,dir:"gt",u:""},
             {k:"cpa3",label:"CPA3(停投=0)",v:0,t:9,dir:"lt",u:"¥"},
             {k:"post_search",label:"看后搜率",v:0.006,t:0.004,dir:"gt",u:"%"},
             {k:"blue_word",label:"小蓝词点击率",v:0.005,t:0.004,dir:"gt",u:"%"},
             {k:"iq",label:"互动质量(正向占比)",v:0.66,t:0.60,dir:"gt",u:"%"} ],
      sell:[ {k:"product_ctr",label:"商品点击率",v:0.052,t:0.040,dir:"gt",u:"%"},
             {k:"add_cart",label:"加购率",v:0.033,t:0.025,dir:"gt",u:"%"},
             {k:"cvr",label:"成交转化率",v:0.026,t:0.020,dir:"gt",u:"%"},
             {k:"gmv",label:"残值GMV",v:38000,t:20000,dir:"gt",u:"¥"},
             {k:"aov",label:"客单价",v:49,t:40,dir:"gt",u:"¥"},
             {k:"refund_rate",label:"退款率",v:0.05,t:0.08,dir:"lt",u:"%"},
             {k:"good_review",label:"好评率",v:0.94,t:0.90,dir:"gt",u:"%"},
             {k:"repurchase",label:"复购率",v:0.07,t:0.15,dir:"gt",u:"%"},
             {k:"live_stay",label:"直播停留(已停播)",v:0,t:0,dir:"gt",u:"s"},
             {k:"live_cvr",label:"直播成交率(已停播)",v:0,t:0,dir:"gt",u:"%"} ],
      joint:[{k:"a3_to_product_click_rate",label:"新增A3人群→商品点击率",v:0.052,t:0.040,dir:"gt",u:"%"},
             {k:"a3_to_order_conversion_rate",label:"新增A3人群→成交转化率",v:0.0014,t:0.0012,dir:"gt",u:"%"},
             {k:"a3_to_new_customer_repurchase_rate",label:"新增A3人群→新客复购率",v:0.07,t:0.15,dir:"gt",u:"%"}] },
    fiveA:{
      A1:{label:"了解",people:210000,new_people:8000,rate_to_next:0.11},
      A2:{label:"吸引",people:23100,new_people:900,rate_to_next:0.14},
      A3:{label:"种草",people:3234,new_people:120,rate_to_next:0.10},
      A4:{label:"购买",people:323,new_people:31,rate_to_next:0.07},
      A5:{label:"忠诚",people:412,new_people:2,rate_to_next:null} },
    fiveA_source:{
      short_video:{A1:60000,A2:5200,A3:620,A4:40},
      live:{A1:0,A2:0,A3:0,A4:0},
      search:{A1:90000,A2:11000,A3:1800,A4:180},
      shop_card:{A1:60000,A2:6900,A3:814,A4:103},
      kol:{A1:0,A2:0,A3:0,A4:0} },
    node_outputs:{ 1:{new_material_target:0,organic_asset_keep_count:6},
                   2:{qianchuan_mode:"stopped",live_wind_down:{sessions_per_week:0,mode:"stopped"}},
                   4:{residual_authenticity_gate:{natural_traffic_verified:true,pass:true},bleed_gate:{negative_comment_ratio:0.06,pass:true}},
                   5:{migration_target_sku:"SKU_葱伴侣黄豆酱_新装260g",a5_migrate_ready:0.62} },
    gate_result:{ gate:"Gate4", gate4_verdict:"stoploss_hold",
      hard_redline:{experience_score:4.6,brand_residual_risk_score:0.2,pass:true},
      chain:{ residual_signal:{natural_gmv:38000,card_gmv_share:0.71,pass:true},
              cost_squeeze:{new_spend:0,live_sessions:0,new_material_count:0,squeeze_executed:true,pass:true},
              bleed_control:{negative_comment_ratio:0.06,refund_rate_actual:0.05,pass:true},
              migration_ready:{migration_target_sku:"SKU_葱伴侣黄豆酱_新装260g",a5_migrate_ready:0.62,pass:true} },
      stoploss_timer:{max_stoploss_hold_cycles:4,cycle_unit:"investment_cycle",current_hold_cycle:1,must_rejudge_after_cycle:true},
      options:["stoploss_hold","refresh_restart","retire_archive"], structural_decline:false,
      formula_note:"cost_squeeze.pass 必须在先·没关掉付费引擎不许判 stoploss_hold" },
    human_gate_actions:[{k:"砍投(负贡献即砍)",amt:0,irr:true},{k:"焕新重启",amt:0,irr:true}] },
  renewal: { id:"DY-HR-YJ", spu:"SPU_禾然有机", name:"禾然有机酱油", stage:"renewal",
    scene:{crowd:"儿童家庭",scene:"给孩子做饭",pain:"配料表看不懂",reason:"有机·零添加",priority:"高",status:"测试中"},
    metrics:[ {k:"play_3s_rate",label:"重启3秒率",v:0.29,t:0.20,dir:"gt"},
              {k:"product_ctr",label:"商品点击率",v:0.07,t:0.05,dir:"gt"},
              {k:"a5_wakeup",label:"老客唤醒率",v:0.14,t:0.10,dir:"gt"},
              {k:"restart_roi",label:"重启ROI",v:1.25,t:1.0,dir:"gt"} ],
    ledger3:{
      seed:[ {k:"exposure",label:"曝光量",v:640000,raw:810000,t:400000,dir:"gt",u:""},
             {k:"retain_3s",label:"3秒留存",v:0.29,t:0.20,dir:"gt",u:"%"},
             {k:"completion",label:"完播率",v:0.27,t:0.24,dir:"gt",u:"%"},
             {k:"interact",label:"互动率",v:0.055,t:0.040,dir:"gt",u:"%"},
             {k:"collect",label:"收藏率",v:0.036,t:0.030,dir:"gt",u:"%"},
             {k:"comment_howto",label:"评论「怎么用」占比",v:0.28,t:0.20,dir:"lt",u:"%"},
             {k:"content_ctr",label:"内容带出商品点击率",v:0.048,t:0.050,dir:"gt",u:"%"},
             {k:"search_growth",label:"搜索增长",v:0.21,t:0.10,dir:"gt",u:"%"},
             {k:"new_a3",label:"新增A3人群",v:5200,t:4000,dir:"gt",u:""},
             {k:"cpa3",label:"CPA3",v:7.0,t:8,dir:"lt",u:"¥"},
             {k:"new_pull",label:"新客拉新率",v:0.46,t:0.40,dir:"gt",u:"%"},
             {k:"post_search",label:"看后搜率",v:0.019,t:0.012,dir:"gt",u:"%"},
             {k:"blue_word",label:"小蓝词点击率",v:0.016,t:0.012,dir:"gt",u:"%"},
             {k:"iq",label:"互动质量(正向占比)",v:0.70,t:0.65,dir:"gt",u:"%"} ],
      sell:[ {k:"product_ctr",label:"商品点击率",v:0.048,t:0.050,dir:"gt",u:"%"},
             {k:"add_cart",label:"加购率",v:0.030,t:0.028,dir:"gt",u:"%"},
             {k:"cvr",label:"成交转化率",v:0.022,t:0.020,dir:"gt",u:"%"},
             {k:"gmv",label:"GMV",v:96000,t:60000,dir:"gt",u:"¥"},
             {k:"aov",label:"客单价",v:66,t:55,dir:"gt",u:"¥"},
             {k:"refund_rate",label:"退款率",v:0.05,t:0.08,dir:"lt",u:"%"},
             {k:"good_review",label:"好评率",v:0.95,t:0.92,dir:"gt",u:"%"},
             {k:"repurchase",label:"复购率",v:0.11,t:0.10,dir:"gt",u:"%"},
             {k:"live_stay",label:"直播停留",v:61,t:50,dir:"gt",u:"s"},
             {k:"live_cvr",label:"直播成交率",v:0.026,t:0.020,dir:"gt",u:"%"} ],
      joint:[{k:"a3_to_product_click_rate",label:"新增A3人群→商品点击率",v:0.048,raw:0.038,t:0.050,dir:"gt",u:"%"},
             {k:"a3_to_order_conversion_rate",label:"新增A3人群→成交转化率",v:0.0011,t:0.0010,dir:"gt",u:"%"},
             {k:"a3_to_new_customer_repurchase_rate",label:"新增A3人群→新客复购率",v:0.11,t:0.10,dir:"gt",u:"%"}] },
    fiveA:{
      A1:{label:"了解",people:640000,new_people:210000,rate_to_next:0.16},
      A2:{label:"吸引",people:102400,new_people:31000,rate_to_next:0.15},
      A3:{label:"种草",people:15360,new_people:5200,rate_to_next:0.10},
      A4:{label:"购买",people:1536,new_people:520,rate_to_next:0.14},
      A5:{label:"忠诚",people:215,new_people:72,rate_to_next:null} },
    fiveA_source:{
      short_video:{A1:380000,A2:58000,A3:8200,A4:700},
      live:{A1:110000,A2:22000,A3:4100,A4:520},
      search:{A1:70000,A2:12000,A3:2200,A4:200},
      shop_card:{A1:50000,A2:7400,A3:800,A4:110},
      kol:{A1:30000,A2:3000,A3:60,A4:6} },
    node_outputs:{ 1:{root_cause_type:"material_fatigue",matched_action:"new_material_restart"},
                   2:{qianchuan_mode:"controlled_restart",budget:4000,creative_source:"历史高ROI素材",a5_usage:"private_recall_only",qianchuan_note:"千川不圈老客包"},
                   4:{relapse_check:{same_pattern_detected:false,pass:true}},
                   5:{a5_wakeup_rate:0.14,early_repurchase_signal:true} },
    gate_result:{ gate:"Gate-R", gate_r_verdict:"back_to_growth", internal_status:null,
      hard_redline:{experience_score:4.6,refund_rate:0.05,pass:true},
      options:["back_to_growth","retire_archive"], internal_status_options:["stay_renewal_fix"],
      root_cause_resolved:true, relapse_free:true, renewal_attempt_count:1, max_renewal_attempts:2 },
    human_gate_actions:[{k:"焕新采买(controlled_restart)",amt:4000,irr:false},{k:"二次淘汰",amt:0,irr:true}] },
  retire : { id:"DY-ZXZR-DIS", spu:"SPU_遵循自然", name:"遵循自然零添加(停产装)", stage:"retire",
    scene:{crowd:"存量忠诚客",scene:"—",pain:"—",reason:"—",priority:"低",status:"暂停"},
    no_new_task:true,
    metrics:[ {k:"member_migration",label:"忠诚迁移率",v:0.28,t:0.20,dir:"gt"},
              {k:"settlement_done",label:"三件套结清",v:1,t:1,dir:"gt"},
              {k:"archive_kept",label:"归档不删",v:1,t:1,dir:"gt"} ],
    ledger3:{
      seed:[ {k:"exposure",label:"曝光量(残余)",v:42000,t:0,dir:"gt",u:""},
             {k:"retain_3s",label:"3秒留存",v:0.12,t:0,dir:"gt",u:"%"},
             {k:"completion",label:"完播率",v:0.15,t:0,dir:"gt",u:"%"},
             {k:"interact",label:"互动率",v:0.008,t:0,dir:"gt",u:"%"},
             {k:"collect",label:"收藏率",v:0.004,t:0,dir:"gt",u:"%"},
             {k:"comment_howto",label:"评论「怎么用」占比",v:0.05,t:0.20,dir:"lt",u:"%"},
             {k:"content_ctr",label:"内容带出商品点击率",v:0.020,t:0,dir:"gt",u:"%"},
             {k:"search_growth",label:"搜索增长",v:-0.40,t:-1,dir:"gt",u:"%"},
             {k:"new_a3",label:"新增A3人群(归零)",v:0,t:0,dir:"gt",u:""},
             {k:"cpa3",label:"CPA3(零投放)",v:0,t:9,dir:"lt",u:"¥"},
             {k:"post_search",label:"看后搜率",v:0.001,t:0,dir:"gt",u:"%"},
             {k:"blue_word",label:"小蓝词点击率(零投放)",v:0.001,t:0,dir:"gt",u:"%"},
             {k:"iq",label:"互动质量(正向占比)",v:0.60,t:0,dir:"gt",u:"%"} ],
      sell:[ {k:"product_ctr",label:"商品点击率",v:0.020,t:0,dir:"gt",u:"%"},
             {k:"add_cart",label:"加购率",v:0.010,t:0,dir:"gt",u:"%"},
             {k:"cvr",label:"成交转化率",v:0.012,t:0,dir:"gt",u:"%"},
             {k:"gmv",label:"清尾GMV",v:4200,t:0,dir:"gt",u:"¥"},
             {k:"aov",label:"客单价",v:44,t:0,dir:"gt",u:"¥"},
             {k:"refund_rate",label:"退款率",v:0.03,t:0.08,dir:"lt",u:"%"},
             {k:"good_review",label:"好评率",v:0.93,t:0.90,dir:"gt",u:"%"},
             {k:"repurchase",label:"忠诚迁移率",v:0.28,t:0.20,dir:"gt",u:"%"},
             {k:"live_stay",label:"直播停留(永久停播)",v:0,t:0,dir:"gt",u:"s"},
             {k:"live_cvr",label:"直播成交率(永久停播)",v:0,t:0,dir:"gt",u:"%"} ],
      joint:[{k:"a3_to_product_click_rate",label:"新增A3人群→商品点击率",v:0.020,t:0,dir:"gt",u:"%"},
             {k:"a3_to_order_conversion_rate",label:"新增A3人群→成交转化率",v:0.0006,t:0,dir:"gt",u:"%"},
             {k:"a3_to_new_customer_repurchase_rate",label:"忠诚迁移率",v:0.28,t:0.20,dir:"gt",u:"%"}] },
    fiveA:{
      A1:{label:"了解",people:42000,new_people:0,rate_to_next:0.08},
      A2:{label:"吸引",people:3360,new_people:0,rate_to_next:0.10},
      A3:{label:"种草",people:336,new_people:0,rate_to_next:0.09},
      A4:{label:"购买",people:30,new_people:0,rate_to_next:0.28},
      A5:{label:"忠诚",people:186,new_people:0,rate_to_next:null,migrating:true} },
    fiveA_source:{
      short_video:{A1:12000,A2:900,A3:80,A4:6},
      live:{A1:0,A2:0,A3:0,A4:0},
      search:{A1:18000,A2:1500,A3:180,A4:16},
      shop_card:{A1:12000,A2:960,A3:76,A4:8},
      kol:{A1:0,A2:0,A3:0,A4:0} },
    node_outputs:{ 1:{videos_delisted_or_hidden:true,records_kept_queryable:true},
                   2:{live_permanently_stopped:true,star_kol_contracts_closed:true,outstanding_payment:0},
                   3:{product_card_delisted:true,douyin_shop_sku_removed:true},
                   5:{migration_target_sku:"SKU_禾然有机酱油_500ml",migrated_member_rate:0.28} },
    gate_result:{ gate:"Gate-T", gate_t_verdict:"terminal_archive", options:["terminal_archive"],
      delist_checklist:{content_delisted:true,spend_settled:true,live_permanently_stopped:true,kol_contracts_closed:true,product_card_delisted:true,shop_sku_removed:true,inventory_cleared:true},
      archive:{keep_record:true,"delete":false,lessons_to_memory:["品类结构性下滑未及时转型","直播模型失效后重启过晚"],reusable_assets_retained:["高胜率素材","A5老客包","SEO词"]},
      terminal:true, archive_delete:false, reactivation_forbidden:true, reactivation_requires_new_sku_id:true, hitl_required:true },
    human_gate_actions:[{k:"下架归档(delete=false)",amt:0,irr:true},{k:"不可复活确认",amt:0,irr:true}] }
};

function curSKU(){ return MOCK_DATA[S.stage]; }

const SKU = new Proxy({}, { get:(_,k)=> curSKU()[k] });

const STAGES = {
  import:{ name:"导入期", tail:"算法冷启·内容拦人·初步成交", invest:"投流小额冷启·防未验证烧钱(工具:千川)", gate:"Gate1",
    verdict:"opp", vtext:"冷启要抓", field:"短视频脚本 / 3秒钩子 / 商品卡绑定",
    guard:{ name:"假流量门+互动质量门+体验分门(硬红线)", items:["刷量播放不算·疑刷量→未判级","体验分/退款/差评=毕业硬红线(低了限流)"] },
    chain:[["内容拦人",1],["算法冷启",1],["初步成交",1],["成本可控",1]],
    nodes:["短视频/直播/商品卡数据上报(N0 Triage)","短视频脚本+3秒钩子+完播结构","达人测试+投流小额冷启(二级来源:星图/纯佣/千川)","商品卡/抖店承接(站内闭环)","假流量+互动质量+体验分门","A1/A2冷启+种子池沉淀","Gate1:四判+体验红线才毕业"],
    ring:5, inc:40 },
  growth:{ name:"成长期", tail:"放量·直播起量·A3→A4", invest:"投流放量+高意向人群再验证≥80%", gate:"Gate2",
    verdict:"opp", vtext:"放量验守线", field:"素材矩阵 / 直播排期 / 种子池再营销",
    guard:{ name:"放量衰减门+有效人群门", items:["放量后ROI衰减≤0.30·超限冻结加投回滚","泛流量≤20%不算有效放大·ROI双线(止损1.0/进成熟1.2)"] },
    chain:[["短视频放量",1],["直播起量",1],["转化验证",1],["ROI守线",1]],
    nodes:["含投流回流数据上报(N0)","validated hook批量二创+防疲劳","投流放量(种子池再营销)+直播排期","直播/短视频/商品卡三入口承接","假流量+有效人群+放量衰减+体验门","A3→A4转化+种子池刷新","Gate2:放大后效率仍成立才毕业"],
    ring:5, inc:50 },
  mature:{ name:"成熟期", tail:"守利收忠·自然成交接棒", invest:"投放收口20-25%·只留高ROI", gate:"Gate3",
    verdict:"ok", vtext:"稳守现金牛", field:"稳定素材 / 商品卡SEO / 会员私域",
    guard:{ name:"直播依赖门+组合防内耗", items:["直播占比≤0.55·付费直播≤0.40(增长是租来的?)","同品牌SKU人群重叠≤0.45·投流抬价→升品类会诊"] },
    chain:[["利润守线",1],["三入口稳定",1],["忠诚沉淀",1],["效率稳定",1]],
    nodes:["三入口成交/罗盘数据上报(N0)","稳定复用+疲劳监测+轻刷新","投放收口:砍低效计划(不可逆HITL)","可归因贡献利润+商品卡占比提升","直播依赖+疲劳+组合内耗+体验门","A4→A5+复购+LTV+私域","Gate3五出口:守/收/焕/退/淘"],
    ring:5, inc:60, verdictOut:"stable_keep" },
  decline:{ name:"衰退期", tail:"停投停播·榨残值·Gate4", invest:"默认停投·残值复投=例外", gate:"Gate4",
    verdict:"ok", vtext:"止损维持", field:"Always-on存量 / 商品卡SEO词",
    guard:{ name:"止损计时+残值真实性门", items:["stoploss_hold最长4投放周期·到期必重裁","先关付费引擎才判残值·假残值(刷单撑的)不算"] },
    chain:[["残值成立",1],["成本挤干",1],["止血守线",1],["迁移就绪",1]],
    nodes:["残值GMV/退款差评上报(N0)","停新产·保Always-on存量","默认停投·停播降频·残值复投=例外必核定","仅守ROI维持线·商品卡残值为主体","止血门+残值真实性门+体验门","榨存量·A5/私域迁移→替代SKU","Gate4退出裁决(先关引擎才判)"],
    ring:5, inc:0, verdictOut:"stoploss_hold" },
  renewal:{ name:"焕新期", tail:"带资产二次导入·根因门", invest:"投30-60%·controlled_restart", gate:"Gate-R",
    verdict:"opp", vtext:"根因已解·重启", field:"根因匹配动作(6类)",
    guard:{ name:"根因门(6类)+失败复检", items:["素材疲劳→新素材重启·直播模型失效→脚本重启·体验/价盘→升一层","焕新≤2次·同雷再踩即停(relapse_stoploss)"] },
    chain:[["根因已解",1],["内容重启",1],["成交信号",1],["成本守线",1]],
    nodes:["吃refresh_restart带资产入口(N0)","过根因门→按根因匹配动作","老客包→私域/会员召回+内容洞察 · 投流(千川)仅用历史高ROI素材受控重启","商品卡/直播货盘重验承接","假流量+失败复检(同雷不再踩)+体验门","唤醒A5老客/私域+种子池重建","Gate-R:根因解+链再成立+≤2次"],
    ring:5, inc:40, note:"焕新第 1/2 次" },
  retire:{ name:"淘汰期", tail:"收尾三件套·归档不删·不可复活", invest:"零投放·永久停播", gate:"Gate-T",
    verdict:"ok", vtext:"体面收尾", field:"下架checklist(七项)",
    guard:{ name:"收尾三件套+不可复活", items:["停播/停投结清/达人合同结清+商品卡撤+抖店下架","delete=false·教训入memory·重启须开新SKU ID"] },
    chain:[["停播结清",1],["商品下架",1],["忠诚迁移",1],["归档终态",1]],
    nodes:["吃retire_archive入口(N0)","全停新产·存量视频下架(保留可查)","停投结清+合同关闭+永久停播","商品卡撤+抖店SKU下架+清库存","下架期负评止血","A5/私域/粉丝迁移→替代SKU(例外四层)","Gate-T终态:checklist七项+不可复活"],
    ring:5, inc:0, verdictOut:"terminal_archive" }
};

const ORDER = ["import","growth","mature","decline","renewal","retire"];

const S = {
  stage:"import", role:"seed_kol", tab:"today",
  budget:15000, pending:[], history:[], hGot:0, done:false,
  ringLit:{}, metricEdited:{}, ledgerEdited:{}, triageJson:null,
  tasks:[], tid:0, sop:[], jOpen:{}, show5ASrc:false, hs:{}, n3Edited:{}, sopOpen:{}, attrOpen:null, npsManual:{}, jointAssetOpen:null,
  calib:true
};

function fmt(v){ if(v>=1000)return v.toLocaleString(); if(v<1&&v>0)return v.toString(); return v; }

function fmtU(v,u){
  if(u==='%') return (v*100).toFixed(Math.abs(v)<0.01?2:1)+'%';
  if(u==='¥') return '¥'+v.toLocaleString();
  if(u==='s') return v+'s';
  return v>=1000?v.toLocaleString():String(v);
}

function curMetrics(){
  const ms=curSKU().metrics;const ov=S.metricEdited[S.stage]||{};
  return ms.map(m=>{
    const v=(m.k in ov)?ov[m.k]:m.v;
    const pass=m.dir==="lt"?(v<m.t):(v>=m.t);      // 判级恒用校准值(MUST:算差前先去假)
    const show=(!S.calib && m.raw!=null)?m.raw:v;
    return {...m,v,show,pass,inflated:(!S.calib&&m.raw!=null)};
  });
}

function gatePass(){
  const metricPass = curMetrics().every(m=>m.pass);
  const gr = curSKU().gate_result||{};
  const redline = gr.hard_redline ? gr.hard_redline.pass===true : true;
  if(S.stage==='decline'){
    const c=gr.chain||{};
    return metricPass && redline
      && c.residual_signal?.pass===true
      && c.cost_squeeze?.pass===true && c.cost_squeeze?.squeeze_executed===true
      && c.bleed_control?.pass===true
      && c.migration_ready?.pass===true;
  }
  if(S.stage==='renewal'){
    return metricPass && redline && gr.root_cause_resolved===true && gr.relapse_free===true;
  }
  return metricPass && redline;
}

function led(){
  const L=curSKU().ledger3; const ov=S.ledgerEdited[S.stage]||{};
  const wrap=(arr,group)=>arr.map((m,i)=>{
    const v=(m.k in ov)?ov[m.k]:m.v;
    const pass=m.dir==='lt'?(v<m.t):(v>=m.t);            // 判级恒用校准值
    const show=(!S.calib&&m.raw!=null)?m.raw:v;           // 去假前露 raw 虚高
    return {...m,group,i,v,show,pass,inflated:(!S.calib&&m.raw!=null)};
  });
  return {seed:wrap(L.seed,'seed'),sell:wrap(L.sell,'sell'),joint:wrap(L.joint,'joint')};
}

function ledMap(){ const l=led(); const m={}; [...l.seed,...l.sell,...l.joint].forEach(x=>{ if(!(x.k in m)) m[x.k]=x; }); return m; }

function ruleFires(r){ const m=ledMap(); try{ return r.when(m); }catch(e){ return false; } }

function firedRules(){
  const m=ledMap();                       // MUST:恒用去假后的校准值
  if(curSKU().no_new_task) return [];     // 淘汰期不派新任务(只走收尾三件套)
  return RULES.filter(r=>{ try{ return r.when(m); }catch(e){ return false; } });
}

function jLight(node){
  const m=ledMap(); const ks=node.keys.filter(k=>m[k]);
  if(!ks.length) return 'g';
  const p=ks.filter(k=>m[k].pass).length;
  return p===ks.length?'g':(p===0?'r':'y');
}

function bumpKpi(k){
  const m=ledMap()[k]; if(!m) return null;
  const nv = m.dir==='lt' ? +(m.t*0.85).toFixed(4) : +(m.t*1.15).toFixed(4);
  S.ledgerEdited[S.stage]=S.ledgerEdited[S.stage]||{}; S.ledgerEdited[S.stage][k]=nv;
  return {label:m.label,nv,u:m.u};
}

function ownable(t){ return S.role==='ops'||S.role==='mgr'||t.team===S.role||t.team==='joint'; }

function findTask(id){ return S.tasks.find(t=>t.id===id); }

function hsState(){ if(!S.hs[S.stage]) S.hs[S.stage]={seed:null,commerce:null,live:null}; return S.hs[S.stage]; }

function hsExempt(){ return S.stage==='decline'||S.stage==='retire'; }

function hsPass(){ if(hsExempt()) return true; const h=hsState(); return !!h.seed && (!!h.commerce||!!h.live); }

function n3Items(){
  const ov=S.n3Edited[S.stage]||{};
  return N3_CHECK.map((c,i)=>({i,name:c[0],cons:c[1],pass:(i in ov)?ov[i]:true}));
}

function n3Pass(){ return n3Items().every(x=>x.pass); }

function formulaRows(){
  const fm=FORMULA_MOCK[S.stage];
  const ex=led().seed.find(m=>m.k==='exposure');
  const fake=(ex&&ex.raw!=null)?+( (ex.raw-ex.v)/ex.raw ).toFixed(3):0.03;
  const fat=fm.fatigue;
  const fatPass=(fat.reuse<=4)&&(fat.days<=3);
  return [
    {k:"fake",nm:"假流量率",f:"疑似无效播放 / 总播放",cur:(fake*100).toFixed(1)+"%",thr:"≤35%",pass:fake<=0.35,act:"超线→打flag未判级+清洗(TypeB),不进算差"},
    {k:"crowd",nm:"有效人群率",f:"目标人群A2/A3 / 总A2/A3",cur:(fm.valid_crowd*100).toFixed(0)+"%",thr:"≥80%",pass:fm.valid_crowd>=0.80,act:"泛流量>20%→收紧定向,不算有效放大"},
    {k:"decay",nm:"放量衰减率",f:"放量后ROI / 放量前ROI − 1",cur:(fm.decay*100).toFixed(0)+"%",thr:"≥−30%",pass:fm.decay>=-0.30,act:"超限→冻结加投·回滚·回N1更新素材"},
    {k:"fatigue",nm:"素材疲劳率",f:"连续N日CTR/GPM下滑 + 素材复用次数",cur:"下滑"+fat.days+"日·复用"+fat.reuse+"次",thr:"下滑≤3日 且 复用≤4次",pass:fatPass,act:"疲劳→轻刷新素材·砍低效计划(不可逆走HITL)"}
  ];
}

function sopStepOf(ref){
  const sp=SOPS.find(x=>x.id===ref.id); if(!sp)return null;
  const st=sp.steps.find(x=>x.s===ref.s); if(!st)return null;
  return {sop:sp,st};
}

function sopRefLabel(ref){
  const x=sopStepOf(ref); if(!x)return "";
  return x.sop.nm+" Step"+ref.s+" "+x.st.env;
}

function npsData(){
  const base=SKU_NPS[S.stage]||{v:null,src:"—"};
  const mv=(S.npsManual||{})[S.stage];
  return (base.v==null&&mv!=null)?Object.assign({},base,{v:mv,src:"manual_import(手工导入)",n:120}):base;
}

function statusBadge(t){
  if(t.status==='已驳回')return '<span class="badge rej">已驳回</span>';
  if(t.status==='待核定')return '<span class="badge money">待核定·HITL</span>';
  if(t.status==='已复盘')return `<span class="badge ${t.verdict==='无效'?'rej':'done'}">已复盘·${t.verdict}</span>`;
  if(t.status==='已完成')return '<span class="badge st">已完成·待复盘</span>';
  if(t.status==='进行中')return '<span class="badge st">进行中</span>';
  return '<span class="badge">待处理</span>';
}

function myTasks(){
  if(S.role==='ops'||S.role==='mgr') return S.tasks;
  return S.tasks.filter(t=>t.team===S.role||t.team==='joint');
}

const NODEDEF=[
  {n:"N0",nm:"数据上报 Triage",money:0},
  {n:"N1",nm:"内容/素材计划",money:0,posts:"种草达人岗主导 · 带货/直播岗共创货盘"},
  {n:"N2",nm:"达人/投流/直播排期",money:1,posts:"三岗共用采买通道(过握手后)"},
  {n:"N3",nm:"站内承接(卡/店/播)",money:0,posts:"带货/直播岗主责 · 商品运营协同"},
  {n:"N4",nm:"质量可信门",money:0,posts:"作战官主责(三岗数据汇口)"},
  {n:"N5",nm:"人群资产/迁移",money:0},
  {n:"N6",nm:"判级/裁决",money:0}
];

function n6Verdict(){
  const st=S.stage, g=gatePass();
  const gr=curSKU().gate_result;
  const passKey={import:"gate1_pass",growth:"gate2_pass",mature:"gate3_pass",decline:null,renewal:null,retire:null}[st];
  const l=led();
  const base={ sku_id:SKU.id, spu_id:SKU.spu, lifecycle_stage:st, channel:"douyin", calibrated:true,
    threshold_mode:"mock_baseline", calibration_required:true,
    calibration_by:["category","price_band","video_length","traffic_source"],
    dual_line:{ seed_pass:l.seed.every(m=>m.pass), sell_pass:l.sell.every(m=>m.pass), joint_pass:l.joint.every(m=>m.pass) },
    fiveA_snapshot:{ A1:curSKU().fiveA.A1.people, A2:curSKU().fiveA.A2.people, A3:curSKU().fiveA.A3.people, A4:curSKU().fiveA.A4.people, A5:curSKU().fiveA.A5.people },
    fiveA_breaks:firedRules().map(r=>r.a5a),
    sop_bindings:firedRules().map(r=>({rule:r.id,back_to:(r.sopref||[]).map(sopRefLabel)})),
    agent_red_lights:firedRules().map(r=>r.id),
    mock_gate_pass:(passKey?gr[passKey]:true), live_gate_pass:g };
  if(st==='import')  return {...base, ...gr, gate1_pass:g, next_stage:g?"growth":"stay_import"};
  if(st==='growth')  return {...base, ...gr, gate2_pass:g, next_stage:g?"mature":"stay_growth",
    roi_rule:"<1.0止损·1.0-1.2留修·≥1.2进成熟"};
  if(st==='mature')  return {...base, ...gr, gate3_pass:g, gate3_verdict:g?"stable_keep":"stable_reduce_spend",
    next_action:g?"stay_mature_next_cycle":"harvest_mode"};
  if(st==='decline') return {...base, ...gr, gate4_verdict:g?"stoploss_hold":"refresh_restart"};
  if(st==='renewal') return {...base, ...gr,
    gate_r_verdict:g?"back_to_growth":null, internal_status:g?null:"stay_renewal_fix"};
  return {...base, ...gr};
}

function nodeIO(i){
  const st=S.stage, stg=STAGES[st], ms=curMetrics(), no=curSKU().node_outputs||{};
  const IO=[
    { Input:"短视频/直播/商品卡/投流数据上报", Process:"路由→归一 SKU/字段·假流量打flag",
      Output:{ channel:"douyin", lifecycle_stage:st, sku_id:SKU.id, spu_id:SKU.spu, calibrated:true }, Next:"N1 / N4 / N6" },
    { Input:"N0.Output + 品类定标↓", Process:st==='import'?"3秒钩子+完播结构+商品卡绑定":(st==='renewal'?"过根因门→按根因匹配动作":stg.nodes[1]),
      Output:{ lifecycle_stage:st, field:stg.field, journey_slot:"J0/J1", ...(no[1]||{}) }, Next:"N2 / N3" },
    { Input:"N1.Output(素材/脚本)", Process:st==='decline'?"默认停投·停播降频·残值复投=例外":(st==='retire'?"停投结清+合同关闭+永久停播":"达人/投流策略→采买/排期(二级来源见N2)"),
      Output:{ lifecycle_stage:st, ...(no[2]||{spend_actual:0}), hitl_required:true }, Next:"N3" },
    { Input:"N1+N2.Output", Process:st==='retire'?"商品卡撤+抖店下架+清库存":"站内闭环承接(卡/店/播)",
      Output:{ lifecycle_stage:st, channel_type:"in_app_closed_loop", journey_slot:"J4", ...(no[3]||{landing:ms.slice(0,2).reduce((a,m)=>(a[m.k]=m.v,a),{})}) }, Next:"N4" },
    { Input:"N3.Output + 互动/订单回流", Process:"假流量门(TypeB)+ "+(stg.guard?stg.guard.name:"体验门"),
      Output:{ lifecycle_stage:st, fake_traffic_gate:{pass:true}, guard:stg.guard?stg.guard.name:"—", journey_slot:"J2/J3/J5", ...(no[4]||{}) }, Next:"N5" },
    { Input:"N4.Output", Process:st==='retire'?"A5/私域迁移→替代SKU(例外四层)":(st==='mature'?"A4→A5+复购+LTV":(st==='decline'?"榨存量+迁移准备":"5A人群+种子池")),
      Output:{ lifecycle_stage:st, journey_slot:"J6", ...(no[5]||{pass:true}) }, Next:"N6" },
    { Input:"N0…N5 全链回流(去假后)", Process:"算差→"+stg.gate+" 判级→裁决/分流",
      Output:n6Verdict(), Next:n6Next() }
  ];
  return IO[i];
}

function n6Next(){
  const st=S.stage,g=gatePass();
  if(st==='import')return g?"→ 成长期 N0":"留导入期修(关差定位断步)";
  if(st==='growth')return g?"→ 成熟期 N0(ROI≥1.2)":"留成长期修/止损";
  if(st==='mature')return g?"→ 继续成熟(stable_keep)":"五出口分流(HITL)";
  if(st==='decline')return "止损维持(计时4周期)/焕新/淘汰(全HITL)";
  if(st==='renewal')return g?"→ 回成长期":"留本期修(internal_status)/次数用尽→淘汰";
  return "终态·无出口(不可复活·重启须新SKU ID)";
}

function artFor(i){
  const io=nodeIO(i);
  return "// Input:  "+io.Input+"\n// Process:"+io.Process+"\n// Next:   "+io.Next+"\n"+JSON.stringify({Output:io.Output},null,1);
}

const INCOME_MODEL="SR收入 = 底薪 + 战功分(结果指标达标计分) + Gate毕业奖(整SKU阶段毕业) + 效率提成(CPA3/ROI省下的投放费按比例)";

const ATTR={
  play_3s_rate:{inc:"3秒率进 Gate 判据 → 达标计【内容战功分】;整期达标助 Gate 毕业 → 毕业奖",
    up:["3秒钩子放在痛点上(凉拌菜场景一勺封神)","前3秒产品/利益点出现,没有慢热开场","封面与首帧同一信息,不骗点"],
    upNext:"把这条钩子写进内容模板库→下条视频直接复用,省一轮测试",
    down:[{why:"开场慢热/钩子晚于5秒",act:"产品出现点前置到第5秒内",sop:{id:"sop_seed",s:3}},{why:"封面与内容不符,点进即划走",act:"封面首帧统一利益点",sop:{id:"sop_seed",s:3}}]},
  completion_rate:{inc:"完播率进 Gate 判据 → 内容战功分 + 助毕业奖",
    up:["完播结构:钩子→演示→反转→收尾,没有中段拖沓","时长按信息量裁,不凑30秒"],
    upNext:"该结构进 SOP 模板,新素材按结构填空",
    down:[{why:"中段信息密度掉,第8-15秒流失",act:"砍过场,演示直接上结果",sop:{id:"sop_seed",s:3}},{why:"时长虚胖",act:"按完播曲线裁时长",sop:{id:"sop_seed",s:5}}]},
  product_ctr:{inc:"商品点击率=内容带货的钱眼 → 达标计【联动战功分】(种草+卖货共享)",
    up:["商品钩子与内容痛点同一句话(一勺出味)","挂车时机在演示高点,不在片尾"],
    upNext:"把该挂车时机固化为规则→同类素材统一",
    down:[{why:"内容热但商品钩子弱(R1)",act:"主图/标题改成内容同款话术",sop:{id:"sop_comm",s:5}},{why:"挂车位置在片尾,流量到不了",act:"挂车前移到演示高点",sop:{id:"sop_seed",s:4}}]},
  roi:{inc:"冷启ROI≥1 → 投放费没白烧 → 计【效率提成】基数;不达标烧的是预算池",
    up:["小额冷启守住了(未验证不加钱)","只给过自然门的素材投放"],
    upNext:"把过门素材的共性写进达人筛选标准,降低下轮CPA3",
    down:[{why:"未过自然门就投,CPM买了泛流量",act:"停投→回自然数据门重测",sop:{id:"sop_seed",s:5}},{why:"定向过宽",act:"收紧定向到目标人群包",sop:{id:"sop_seed",s:6}}]},
  exposure_growth:{inc:"曝光增长=放量凭证 → 助 Gate2 毕业奖",
    up:["validated hook 批量二创,素材消耗能力跟上了","投流放量绑了种子池再验证"],
    upNext:"二创模板沉淀→下轮放量不缺素材",
    down:[{why:"素材供给跟不上消耗",act:"二创矩阵补量",sop:{id:"sop_seed",s:3}},{why:"放量衰减超线被冻结",act:"回N1更新素材再放",sop:{id:"sop_seed",s:7}}]},
  live_gpm:{inc:"直播GPM=直播间岗核心战功分;达标计入场次奖金",
    up:["货组排布对(引流款拉人·主推款成交)","促单段在停留高点打出"],
    upNext:"该场话术五段沉淀为直播间SOP话术模板",
    down:[{why:"停留高但促单弱(R7)",act:"促单话术+限时机制重打",sop:{id:"sop_live",s:3}},{why:"货组与人群不配",act:"回货组制定重排",sop:{id:"sop_live",s:2}}]},
  a3_to_a4:{inc:"A3→A4=种草变成钱的那一跳 → 联动战功分(两组共享·防内耗)",
    up:["直播/商品卡承接了种草人群,没漏","收藏人群被定向承接"],
    upNext:"承接链路固化:每条种草内容发布即绑承接位",
    down:[{why:"收藏高成交低(R4)·紧迫感不足",act:"限时机制+今天为什么买话术",sop:{id:"sop_live",s:3}},{why:"承接位没备好(N3)",act:"过N3九项检查再放量",sop:{id:"sop_comm",s:6}}]},
  roi_at_scale:{inc:"放量ROI守住 → 效率提成放大;跌破线冻结加投,提成基数归零",
    up:["放量衰减率守在-30%内","素材疲劳前轻刷新"],
    upNext:"衰减监测节奏(日看)写进个人清单",
    down:[{why:"放量后ROI跳水",act:"冻结加投·回滚上一档",sop:{id:"sop_seed",s:7}},{why:"素材复用过度疲劳",act:"轻刷新素材",sop:{id:"sop_seed",s:3}}]},
  contribution_margin:{inc:"贡献利润率=成熟期战功主指标 → 直接挂季度奖",
    up:["投放降到25%档,自然成交接棒","高ROI计划留,低效计划砍了"],
    upNext:"砍计划的判断标准固化→下季度不用重学",
    down:[{why:"还在用成长期投法,费用吃利润",act:"cost_squeeze:降投放档位",sop:{id:"sop_comm",s:7}},{why:"促销过度透支",act:"promo_off_test 验自然力",sop:{id:"sop_live",s:6}}]},
  card_gmv_share:{inc:"商品卡自然成交占比=不花钱的收入 → 效率提成大头",
    up:["搜索词/详情页承接住了品牌搜索","卡片评价分维护到位"],
    upNext:"高转化详情结构模板化",
    down:[{why:"点击高转化低,详情页断点",act:"回N3查详情一致性",sop:{id:"sop_comm",s:5}},{why:"评价分掉,质量门预警",act:"差评聚类回修",sop:{id:"sop_comm",s:8}}]},
  a4_to_a5:{inc:"A4→A5=复购资产 → 长效战功分(权重逐季上调)",
    up:["复购机制在包裹/会员位埋了钩子","老客内容持续供给"],
    upNext:"复购钩子清单固化到发货SOP",
    down:[{why:"好评高复购低(R5)·机制缺",act:"复购券/家庭装设计(HITL)",sop:{id:"sop_comm",s:1}},{why:"老客无触达",act:"会员召回+老客内容",sop:{id:"sop_live",s:2}}]},
  stable_roi:{inc:"稳定ROI=成熟期效率提成基数(连续达标才计)",
    up:["三稳窗口≥4周期,结构没漂","直播依赖降到自播为主"],upNext:"稳定结构写进季度BP",
    down:[{why:"付费依赖回升",act:"降付费档·验自然力",sop:{id:"sop_live",s:7}}]},
  natural_gmv:{inc:"残值自然GMV=停投后的白拿收入 → 残值战功(小而真)",
    up:["停投停播执行到位,自然位没拆","历史素材长尾还在带货"],upNext:"残值口径周报,防假残值",
    down:[{why:"自然位被下架误伤",act:"恢复自然承接位",sop:{id:"sop_comm",s:6}}]},
  refund_rate:{inc:"退款率=质量红线;超线扣联动战功,连累两组",
    up:["话术没夸大,详情与实物一致","包裹加了使用说明"],upNext:"预期管理话术进模板",
    down:[{why:"话术夸大(R3)",act:"回看直播话术修正",sop:{id:"sop_live",s:3}},{why:"详情与实物不符",act:"详情一致性修复",sop:{id:"sop_comm",s:5}}]},
  contribution_profit:{inc:"残值利润>0 才允许残值复投(≤¥2,000·ROI≥1.5) → 例外池不占战功",
    up:["残值复投全走HITL,没私投"],upNext:"残值真实性公式周检",
    down:[{why:"假残值(清库存冲量)",act:"残值真实性公式复核",sop:{id:"sop_comm",s:8}}]},
  a5_wakeup:{inc:"老客唤醒率=焕新期战功主指标(唤醒成本远低于拉新)",
    up:["老客包走私域/会员召回,没喂千川","唤醒内容用老客场景"],upNext:"唤醒话术模板沉淀",
    down:[{why:"只发券不给理由",act:"老客内容+召回组合",sop:{id:"sop_seed",s:3}}]},
  product_ctr_renewal:{inc:"",up:[],down:[]},
  restart_roi:{inc:"重启ROI≥1 → 焕新毕业奖;≤2次机会,烧完转淘汰",
    up:["只用历史高ROI素材受控重启","根因先过门再花钱"],upNext:"重启素材白名单固化",
    down:[{why:"根因没解就重启",act:"回根因门(六类)重判",sop:{id:"sop_seed",s:8}}]},
  member_migration:{inc:"忠诚迁移率=退出战功(老客不丢=下个SKU的冷启资产)",
    up:["A5迁移目标SKU提前定好","迁移话术在会员位跑"],upNext:"迁移清单进新SKU导入包",
    down:[{why:"无目标SKU承接",act:"定替代SKU再迁移",sop:{id:"sop_comm",s:1}}]},
  settlement_done:{inc:"三件套结清=合规底线;未结清冻结该SKU全部战功结算",
    up:["达人/直播/投放合同全关闭"],upNext:"结清清单模板化",
    down:[{why:"合同尾款挂账",act:"财务结清+留痕",sop:{id:"sop_comm",s:4}}]},
  archive_kept:{inc:"归档不删=数据资产;归档完成计【资产战功】",
    up:["视频下架但数据Excel留档","记录可查"],upNext:"归档模板下轮直接套",
    down:[{why:"平台数据过期没下载",act:"补数据下载留档",sop:{id:"sop_seed",s:8}}]},
  a3_to_product_click_rate:{inc:"新增A3人群→商品点击率=A2→A3 交接 KPI → 【联动战功分】种草×带货五五共享(同源消费者·非零和·防内耗)",
    joint:true,
    up:["【种草侧】内容痛点与商品钩子同一句话,用户看完就想点","【卖货侧】商品卡主图/标题用了内容同款话术,点进不落差","【交接】挂车放在演示高点,不在片尾"],
    upNext:"把「内容话术=商品话术」写进握手卡内容假设 → 每条新内容发布前对一次口径",
    down:[{why:"【种草侧】内容热但商品钩子弱(R1)·用户被内容拦住却没理由点商品",act:"产品出现点前置+钩子改成购买理由",sop:{id:"sop_seed",s:3}},
          {why:"【卖货侧】主图/标题与内容脱节,点进即退",act:"主图标题改成内容同款话术",sop:{id:"sop_comm",s:5}}]},
  a3_to_order_conversion_rate:{inc:"新增A3人群→成交转化率=A3→A4 交接 KPI → 【联动战功大头】+ 直播场次奖金挂它",
    joint:true,
    up:["【种草侧】种出来的是精准A3(有效人群率≥80%),不是泛流量","【卖货侧】直播/商品卡承接了种草人群·货组价格与内容承诺一致","【交接】N3 九项检查全过,购买路径无断点"],
    upNext:"承接链路固化:每条种草内容发布即绑定承接位(握手卡第⑨项)",
    down:[{why:"【卖货侧】收藏高成交低(R4)·紧迫感不足",act:"限时机制+「今天为什么买」话术",sop:{id:"sop_live",s:3}},
          {why:"【交接】承接位没备好·点了没地方买",act:"过N3九项检查再放量",sop:{id:"sop_comm",s:6}},
          {why:"【种草侧】种的是泛人群·到承接就漏",act:"收紧定向·回有效人群门",sop:{id:"sop_seed",s:6}}]},
  a3_to_new_customer_repurchase_rate:{inc:"新增A3人群→新客复购率=A4→A5 交接 KPI → 【长效战功分】(权重逐季上调)+会员资产分·两组共享",
    joint:true,
    up:["【卖货侧】包裹/会员位埋了复购钩子(菜谱卡/组合装)","【种草侧】老客场景内容持续供给,买过的人还被内容触达","【交接】体验与内容承诺一致·退款率守住(R3没亮)"],
    upNext:"复购钩子清单进发货SOP·老客内容排进内容日历",
    down:[{why:"【卖货侧】好评高复购低(R5)·机制缺",act:"复购券/家庭装设计(涉钱·HITL)",sop:{id:"sop_comm",s:1}},
          {why:"【种草侧】买完即失联·无老客内容",act:"拍老客使用场景内容+会员召回",sop:{id:"sop_seed",s:3}},
          {why:"【交接】体验落差·话术透支预期",act:"预期管理话术修正",sop:{id:"sop_live",s:3}}]},
  new_a3:{inc:"新增A3=种草达人岗核心战功分(按人头计)",
    up:["达人选得准(类目匹配+历史CPA3)","内容假设过握手,不是盲拍"],upNext:"高产达人进白名单",
    down:[{why:"达人泛,A3种不出来",act:"回达人筛选重选",sop:{id:"sop_seed",s:1}}]},
  retain_3s:{inc:"三秒率进 Gate 判据 → 达标计【内容战功分】;整期达标助 Gate 毕业 → 毕业奖",
    up:["3秒钩子放在痛点上(凉拌菜场景一勺封神)","前3秒产品/利益点出现,没有慢热开场","封面与首帧同一信息,不骗点"],
    upNext:"把这条钩子写进内容模板库→下条视频直接复用,省一轮测试",
    down:[{why:"开场慢热/钩子晚于5秒",act:"产品出现点前置到第5秒内",sop:{id:"sop_seed",s:3}},{why:"封面与内容不符,点进即划走",act:"封面首帧统一利益点",sop:{id:"sop_seed",s:3}}]},
  completion:{inc:"完播率进 Gate 判据 → 内容战功分 + 助毕业奖",
    up:["完播结构:钩子→演示→反转→收尾,没有中段拖沓","时长按信息量裁,不凑30秒"],
    upNext:"该结构进 SOP 模板,新素材按结构填空",
    down:[{why:"中段信息密度掉,第8-15秒流失",act:"砍过场,演示直接上结果",sop:{id:"sop_seed",s:3}},{why:"时长虚胖",act:"按完播曲线裁时长",sop:{id:"sop_seed",s:5}}]},
  blue_word:{inc:"小蓝词点击率=不挂车内容的搜索承接凭证 → 品牌心智战功(与看后搜率同族·种草岗主KPI之一)",
    up:["小蓝词与内容记忆点同词","发布即挂词,不漏配(不挂车内容必挂小蓝词/搜索词组件)"],
    upNext:"高点击小蓝词进搜索词库→下条内容直接复用",
    down:[{why:"词与内容无关,点击率低",act:"换成内容同款记忆词",sop:{id:"sop_seed",s:4}},{why:"不挂车又没挂词,搜索流量漏光",act:"补挂小蓝词/搜索词组件",sop:{id:"sop_seed",s:4}}]},
  cpa3:{inc:"CPA3(新增A3成本) 每降¥1 → 省下的投放费按比例计【效率提成】(直接是钱)·种草岗主KPI",
    up:["自然门先过再投,没买泛流量","四通道询价压了达人成本"],upNext:"高效达人组合固化",
    down:[{why:"未过门就投放",act:"回自然数据监测",sop:{id:"sop_seed",s:5}},{why:"达人报价虚高",act:"四通道重询价",sop:{id:"sop_seed",s:2}}]},
  post_search:{inc:"看后搜率=品牌心智战功(季度权重上调中)",
    up:["小蓝词挂对了,搜索承接住"],upNext:"高看后搜内容进模板库",
    down:[{why:"内容没给搜索理由",act:"埋品牌记忆点+小蓝词",sop:{id:"sop_seed",s:4}}]},
  iq:{inc:"互动质量(正向占比)=去假后的真战功;刷出来的互动不计分",
    up:["评论区运营在答疑,正向沉淀"],upNext:"高频疑问进内容选题",
    down:[{why:"「怎么用」扎堆(R6)",act:"拍菜谱/使用教育内容",sop:{id:"sop_seed",s:3}}]}
};

function metricRules(lk){
  const rs=RULES.filter(r=>r.kpi===lk).map(r=>r.id+" "+r.nm);
  return rs.length?(" · 触发规则:"+rs.join("/")):"";
}

function attrMetricOf(k){
  const gm=curMetrics().find(m=>m.k===k); if(gm) return gm;
  const lm=ledMap()[k]; if(lm) return lm;
  return null;
}

const LEDGER_TWIN={retain_3s:"play_3s_rate",completion:"completion_rate",exposure:"exposure_growth",cvr:"a3_to_order_conversion_rate",add_cart:"a3_to_order_conversion_rate",live_cvr:"live_gpm",live_stay:"live_gpm",gmv:"roi"};

function ledgerOwn(k){
  const L=led();
  if(L.joint.some(m=>m.k===k)) return "两组共享(联动战功)";
  if(L.sell.some(m=>m.k===k)) return /live/.test(k)?"直播间岗":"带货达人岗";
  return "种草达人岗";
}

function canAttr(k){
  if(!k||!ATTR[k]||!ATTR[k].inc) return false;
  if(ATTR[k].joint) return !!ledMap()[k];
  if(['new_a3','cpa3','post_search','iq','retain_3s','completion','blue_word'].indexOf(k)>=0) return !!ledMap()[k];
  return curMetrics().some(m=>m.k===k);
}

const STEP_KPI_WORDS=["三秒率","完播","CPA3","看后搜","商品点击率","加购","转化率","直播GPM","GPM","CPM"];

const STEP_KPI_MAP={"完播":"完播率","看后搜":"看后搜率","加购":"加购率","GPM":"直播GPM"};
