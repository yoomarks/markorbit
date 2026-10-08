# Easel — MO 三总监独立评审与具体迁移记录

日期：2026-10-09（北京时间）。Owner 请求：此前讨论过 ZJU-REAL/Easel，按现行规矩重新组织三总监评审，具体到环节与功能，并保留沟通记录。
固定源码：`fb80ae6dd6fc26f5553efcb293ee6d93ef253f02`。评审由三个独立 AI 评审任务分别承担产品、UI/体验设计、技术架构角色，再由主任务交叉核验并形成联合结论；不表示三位真人签署。

## 1. 联合裁决

**Easel 有较高参考价值，重点采纳“有业务上下文的对话工作、分阶段创作、可修改成果与反馈”的产品合同；不直接接入其整套服务或复制113个技能。**

保留此前 Owner 已采纳的“自然语言＋结构化控件逐步完成任务”，覆盖注册、OA、图文/视频和商标美化。当前仅形成规格增量；M01–M26 v0.3 仍待具体小节 APPROVED/FROZEN，研究记录不授予开发权限。图文优先 WS-1.0，视频 MR-1.5，真实发布依赖既有 Channels 审批与执行合同。

最优先完善的四项：品牌/对象上下文版本、可恢复且留痕的问答、3方向×2图与单页修改、任务→产物→审核的来源链。这些分别落到现有 Workbench、Content Studio、Trading Studio、Brain/M22/M23，不建第二套 Agent/Skill 平台。

## 2. 历史承接与现有权威记录

检索到9月29日 Owner 采纳上述交互原则的历史，以及此前助手“不直接集成 Easel、不建第二套 OpenClaw runtime、不搬浏览器自动发布”的建议。历史检索为摘要，未取得完整原始对话；本次保留意图并重新依据源码和仓库记录评审，不把摘要日期当新审批。

实际重新读取了以下已完成 Issue 的边界：

| 记录                                                                                    | 已有决定                                                                                                                                | 本次必须保留                                                                                            |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [#1401 Context-first Workbench](https://github.com/yoomarks/markorbit/issues/1401)      | 对象列表/卡片定位→上下文工作台；证据/currentness、有限问题、工作状态、预览、结构化确认与回执；复用 Owner/Prepared Action                | 不重新立项通用聊天平台；聊天记录是工作证据，不能直接改变正式状态                                        |
| [#372 Content Studio projection](https://github.com/yoomarks/markorbit/issues/372)      | 稳定身份为 contentOpportunityId＋版本；既有 ContentOpportunity→ContentDraft→ContentReviewDecision→PublishPackage→ProductLoopUseFeedback | 不新增 ContentProject/StudioRecord 的重复持久生命周期；用户使用反馈不等于外部发布已证实                 |
| [#1283 Trading Deep Build prototype](https://github.com/yoomarks/markorbit/issues/1283) | 保留3方向模型；封面/资产拼图后扩包装、网站、电商等；明确隔离 prototype 与 live owner truth                                              | Issue完成不证明完整 Deep Build runtime 已上线；不能让浏览器制造 AI refinement、Brand Bible 或已发布真值 |

以上状态是在本次读取时 closed/completed；这里只承接其具体成果范围，不由关闭状态推导整个平台生产完成。

## 3. 产品总监独立评审

产品意见：Easel 的价值在“创作过程有合同”，并非工具越多越好。应从真实 MO 任务产生能力需求。

| 上游机制/证据                                                                                                                                                                 | MO 触发与功能                              | 输入→输出→用户动作                                                                    | 取舍/阶段                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [brand-onboarding](https://github.com/ZJU-REAL/Easel/blob/fb80ae6dd6fc26f5553efcb293ee6d93ef253f02/skills/openclaw/skill-brand-onboarding/SKILL.md) 的已知信息预填和缺口访谈  | M16 机构/品牌内容档案；M18 商标品牌基础    | 现有商标资料、可选参考→有来源事实、风格/受众/禁用项候选→用户纠正确认                  | WS1规格；不照搬必须Logo/品牌色/产品实拍图才能开始的门槛                    |
| [persona.py](https://github.com/ZJU-REAL/Easel/blob/fb80ae6dd6fc26f5553efcb293ee6d93ef253f02/easel/persona.py) 的请求级画像前缀                                               | M08/M13 从申请人、机构、商标进入工作台     | 主体＋业务对象＋档案版本→上下文摘要→只补缺项                                          | 复用现有归属/权限；品牌偏好与申请人事实分开                                |
| [carousel-planner](https://github.com/ZJU-REAL/Easel/blob/fb80ae6dd6fc26f5553efcb293ee6d93ef253f02/skills/openclaw/skill-carousel-planner/SKILL.md) 的逐页意图与规划/渲染分离 | M16 商标知识文章转图集                     | 经核验源文＋受众/画幅→分页文案与素材方向→用户调整顺序再生成                           | WS1；不套固定9页、20字及点击导向规则；商标知识不得为短文案删必要条件       |
| card-xiaohongshu / poster-hero 的不同图形用途                                                                                                                                 | M16 图集、单张海报；M18 品牌封面和资产拼图 | 同一确认 brief→不同模板和准确文字层→预览/单图修改/导出                                | 图像模型做视觉，商标名/价格/日期等由准确文字层承载                         |
| 分页合同转为方向合同                                                                                                                                                          | M18 方向探索→选1个→Deep Build              | 商标＋类别＋可选想法素材→3方向各2图（封面、资产拼图）→选1个扩包装/场景/电商/网站/社媒 | 保留现有3方向/选择Owner；具体增量规格待批准                                |
| [persona-check](https://github.com/ZJU-REAL/Easel/blob/fb80ae6dd6fc26f5553efcb293ee6d93ef253f02/skills/openclaw/skill-persona-check/SKILL.md) 的引用偏离与修改建议            | M16/M18 品牌一致性复核                     | 当前档案＋成品版本→偏离证据/修改建议→接受或保留用户选择                               | M22 Critic候选；缺档案显示信息不足；不能证明法律合规或授权                 |
| 内容改编与平台分派                                                                                                                                                            | M16 已确认母版转公众号/小红书版本          | 确认母版＋平台规则版本→派生文案/比例/差异→逐个平台审核/导出                           | 先平台改编；真实发布复用 Channels，不为Easel新增发布总线                   |
| [video-production](https://github.com/ZJU-REAL/Easel/blob/fb80ae6dd6fc26f5553efcb293ee6d93ef253f02/skills/openclaw/video-production/SKILL.md) 的原片包装与审阅停点            | M16 原片视频加工                           | 自有原片＋转录→分场/设计表→预览审阅→成片/工程/报告                                    | MR-1.5；按原片包装、主题出片、图组幻灯片、长片切短片分路，不能全部套重流程 |

产品挑战：Easel carousel-planner 明文“封面不放logo”与 MO 商标展示目标冲突；品牌主体必须保留。互动分、夸张Hook或自动评分不能取代专业价值、买家决策和准确事实。品牌档案是增强项，不能成为基本创作必填手续。

## 4. 体验设计总监独立评审

设计意见：采纳任务过程可见、结构化澄清、成果可管理、偏好可编辑四种机制。现有 #1401 是工作台入口，不再复制社媒门户。

| MO 场景         | 具体交互合同                                                                            | 状态/异常与验收                                                                          |
| --------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 直客注册缺项    | 已绑定申请人/商标开场，说明已知资料；商品多选＋自填；只问缺口，用户点击提交后才形成答案 | 推荐项不代替真实业务值；提交失败保留输入；最终递交另有准确预览/授权                      |
| OA解读/证据澄清 | 每题关联OA段落、证据、主体与版本；已答题折叠成可展开摘要                                | 源文档/主体变化后旧回答保留历史但失效；不能从聊天直接产生官方期限或递交                  |
| 商标美化        | 3方向各两张图并列，显示用途/保留元素；选1个后深度制作，广告语/背景/布局可局部修改       | 不默认把“更美观”理解为更改注册图样；只改广告语保留原商标图样和旧版；实际变更范围进入规格 |
| 图文制作        | 整理资料→选方案→制作→校验→待审；显示当前成果和阶段，切页/刷新可续接                     | 区分运行、等待回答、恢复、失败、停止请求中、已停止；心跳不等于成功                       |
| 成果管理        | 先展示用户要用的成品，源文件/素材展开；成果直达当前商标、方案、版本、审核与使用记录     | 不要求用户寻找本地路径；生成完成、已审核、发布中、已发布分别有证据                       |
| 个性化/品牌偏好 | 分开品牌事实、视觉风格、目标受众、平台、禁用项、采纳经验                                | 字段级来源/适用范围/确认时间；AI自动采集为候选，不静默改已确认事实                       |

源码中已核验的差异：

- [QuestionCards.tsx](https://github.com/ZJU-REAL/Easel/blob/fb80ae6dd6fc26f5553efcb293ee6d93ef253f02/web/frontend/src/components/QuestionCards.tsx) 顶部注释称自动提交，实际是显式“提交”按钮；以实现为准。答案成功后题卡从当前流移除。
- [store.ts](https://github.com/ZJU-REAL/Easel/blob/fb80ae6dd6fc26f5553efcb293ee6d93ef253f02/web/frontend/src/lib/store.ts) 的持久 ChatMessage 无结构化 questions/answers 字段，localStorage会话封顶100条。不能因此断言后端从不存回答，但该前端合同不足以证明“沟通已完整入库”。
- App.tsx 将流式状态放在页面外并按turn/eventId恢复，值得借鉴；重试本地截断最后轮不适合作为 MO 审计模型，应以新尝试关联旧尝试。
- 附件指令与正文分离有益；MO需隐藏内部路径但保留附件名称、实际使用情况和来源关联。
- persona切换只是前缀改变；MO切换Workspace/申请人/商标需权限与currentness复核，不能等同换语气。
- 静态评审发现固定264px侧栏缺统一手机折叠合同，组件中文硬编码；README_EN不证明UI双语。问答选项缺完整radio/checkbox或aria-pressed语义，错误/忙碌缺live-region合同。
- 中文输入法 composing/keyCode229保护值得保留；滚动跟随应尊重正在阅读历史的用户与 reduced-motion。

设计验收：390px＋软键盘、中英文长文本、键盘/读屏可完成问答→成果→返回；回答失败不丢选择，成功后可找回；刷新不重复生成或重复确认；停止须等待执行层确认。

## 5. 技术架构总监独立评审

技术意见：参考合同与恢复机制，执行仍复用 MO 既有 Owner、PreparedAction、Execution、CHANNELS、Artifact 和Provider治理。Easel面向本地创作者的实现不能直接承载MO多租户生产。

| 实证机制                                                                                                                                                                                            | 可用价值                           | MO 必须补强/不迁移的部分                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [manifest.py](https://github.com/ZJU-REAL/Easel/blob/fb80ae6dd6fc26f5553efcb293ee6d93ef253f02/skills/shared/scripts/manifest.py) 登记layer/skill/upstream/outputs/done/failed，临时文件后os.replace | 阶段和产物关联、恢复定位           | 主要为路径，缺内容摘要/版本/CAS；latest返回最近一步，可能是failed；不当durable Owner或并发/幂等证明         |
| [web/app.py](https://github.com/ZJU-REAL/Easel/blob/fb80ae6dd6fc26f5553efcb293ee6d93ef253f02/web/app.py) supervisor与SSE、eventId/after与terminal snapshot                                          | 断线不等于执行终止，续接有事件游标 | MO须从既有Execution状态恢复并验证Principal；turn/session ID不等于权限，localStorage不当跨设备真值           |
| 相同文件的PROFILES/OUTPUTS目录、全局浏览器profile、.env与local_write_guard                                                                                                                          | 本地环境可用的防跨站措施           | 中间件明确只防浏览器跨站，不构成网络用户认证；不能直接暴露给多Workspace，不能靠Prompt禁止跨画像替代访问控制 |
| [gateway_questions.py](https://github.com/ZJU-REAL/Easel/blob/fb80ae6dd6fc26f5553efcb293ee6d93ef253f02/easel/gateway_questions.py) 对OpenClaw question RPC的桥接                                    | 问答有稳定ID、错误与答复边界       | 不引入第二套OpenClaw网关/运行时；MO使用现有业务问答和持久记录                                               |
| [publish_dispatch.py](https://github.com/ZJU-REAL/Easel/blob/fb80ae6dd6fc26f5553efcb293ee6d93ef253f02/skills/openclaw/skill-cross-platform-publish/scripts/publish_dispatch.py) 平台差异与warnings  | 形成可审阅平台派生稿               | 越限仍可ok:true；MO确定性的发布硬条件另验证，warnings不是执行许可                                           |
| [publish_queue.py](https://github.com/ZJU-REAL/Easel/blob/fb80ae6dd6fc26f5553efcb293ee6d93ef253f02/skills/openclaw/skill-publish-scheduler/scripts/publish_queue.py) 排期项目与派发计划             | 提醒/排期规格参考                  | --exec仍委派上层并待回填，不能称成熟持久scheduler；排期/失败恢复走现有Channels/Execution                    |
| video-pipeline-sdk的步骤与checkpoint回答文件                                                                                                                                                        | 原片包装过程明确、有质量门         | 审批值approve不能替代绑定成品摘要/版本/权限的PreparedAction；done跳过须检查输入未漂移；最终交付证据需完整   |

外部模型、TTS、ASR、图像/视频工具可以分别是 M23 Provider实现；Easel前端交互是MO本体参考，不是Provider。启停、timeout/预算、可控降级分别作用于能力和Provider：某平台离线保留母版、可编辑工程和导出；不能所有渠道一起重发或所有创作一起停摆。不自动以 Provider Return 修改正式事实、发布状态或Capability验证状态。

依赖与许可：根代码Apache-2.0，gzh-design内置包明确AGPL-3.0-or-later，video-pipeline-sdk为MIT但依赖/资产另有许可，不能全仓按Apache概括。[ACKNOWLEDGMENTS](https://github.com/ZJU-REAL/Easel/blob/fb80ae6dd6fc26f5553efcb293ee6d93ef253f02/docs/ACKNOWLEDGMENTS.md)还存在待核实来源；借鉴机制与直接分发组件必须分别判断。此处为来源核验，不作为许可法律意见。

## 6. 三总监分歧与联合修订

| 分歧/挑战                                  | 联合结论                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| 品牌画像越完整越贴合，是否先强制建档？     | 基本任务可从一句话/已绑定商标开始；仅品牌一致性检查依赖档案。临时假设可见，不编造                 |
| 自动采集画像是否可立即保存为事实？         | 保存为带来源候选；用户确认后进入相应Owner，AI推断不覆盖申请人/注册事实                            |
| 问答卡交互顺滑是否已等于沟通入库？         | 不等于。持久存问题、答案、业务值、依据版本、提交者、时间与失效/替代关系；已答摘要可复核           |
| 内容复盘能否自动更新“已验证经验”？         | 先记录具体成品/渠道/时间段/指标/来源及混杂因素，形成Brain候选；接受后才影响偏好，不把相关性当因果 |
| 借用项目manifest是否要新建ContentProject？ | 不建；映射#372既有身份和生命周期，只补必要Projection/Artifact关联规格                             |
| Easel发布能力是否加速MO？                  | 借平台适配/检查清单，执行交给既有Channels；任何新Provider需要边界核验，浏览器自动发布不直接搬     |
| 统一视频产线是否方便？                     | 按任务类型分路；MR-1.5先自有原片包装与有限模板，简单图文不承受视频完整流程                        |

## 7. ICP、Capability和前一仓库的关系

Owner提出ICP成为Capability、联系人邮箱购买渠道成为Provider：Easel的audience/brand-onboarding可消费ICP结果，但社媒受众档案不等于B2B购买角色或联系人名单。ICP稳定输出可包括行业/地区/规模、购买角色、痛点、排除项和依据；邮箱采购/验证/富集分别是M23供应端。创意brief引用ICP版本用于内容深度/CTA，不能把推断画像当已核实客户。

M22候选结果合同包括“生成平台适配图文”“品牌一致性评估”“口播动效视频制作”；业务需求来自批准的M16/M18小节。组合保持1 Primary、0–3 Support、0–1 Critic，不因113个skill把长工具链暴露给用户。

Easel与adu-motion-video职责不同：Easel重点参考任务策划/上下文/问答/阶段和成果组织；adu重点参考完整镜头组、素材绑定、双时钟与本地渲染。Easel内置视频SDK使用另一渲染路线，不把它与adu强行串联。先规定MO结果合同，再比较实现；Remotion/ComfyUI/图像模型等仍是各自职责的候选。

## 8. 建议阶段与具体验收

| 阶段                 | 增量规格                                                           | 证明成立的场景                                                           |
| -------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| WS-1.0规格优先       | 已知上下文/缺口问答及完整留痕；图文方案、准确文字层、单页/单图修订 | 已有材料不重复询问；失败/刷新不丢历史或重复调用；一次修订只改指定产物    |
| WS-1.0 M18规格优先   | 3方向×2图→选1→深化，与实际Owner/Prototype边界对齐                  | 商标主体和事实保留；方向选择可恢复；所有生成与prototype状态如实展示      |
| 后续已有Channels范围 | 确认母版的多平台派生稿、审核、导出、明确发布反馈                   | 失败平台可单独处理；用户报告使用与外部证实发布区别；禁用Provider仍能导出 |
| MR-1.5预研           | 原片/主题/图组/剪辑分路，设计表/预览/完整声画和可编辑工程          | 成片/配方/授权媒体可追溯；输入变化使旧审批失效；目标环境实测后才升级     |
| RESEARCH             | 热点雷达、自动排期、归因自动沉淀                                   | 先与既有机会/频道/反馈Owner差距核对；不另立通用运营平台                  |

注册/OA交互只是承接已认可原则，具体字段、法规、官方递交等仍由对应批准小节和业务Owner决定，不从Easel推导法律流程。

本次实际验证：隔离目录复跑原始 manifest.py selftest 与 persona_gate.py selftest，均退出0并输出OK；manifest测试中非法kind产生预期负例。persona测试证实低分依然warn且publish_allowed=true，说明它是提醒而不是审批。没有安装OpenClaw、没有模型付费调用、没有渲染视频/浏览器真实发布，也未运行完整Easel测试或手机UI。以上建议以源码审阅和有限脚本测试为范围。

## 9. 入库与后续状态

- 本文件新增到 `docs/research/tech-radar/easel.md`，独立研究记录保留Owner请求、历史决定、三份评审、分歧、联合裁决与验收。
- 状态：交互原则继承既有Owner方向；具体增量为DRAFT FOR OWNER REVIEW / RESEARCH，不自动修改Approved/Frozen基线。
- DecisionLog/IdeaRegister/Roadmap由正在持有中央文件的规格任务统一吸收；本任务不抢占编号，不把研究建议标为已批准/已实现。
- 下一步应做既有工作台/Content/Trading/Channels的逐项差距审计，再形成有范围的小节修改，不新建重复产品生命周期。
