# MO 创意仓库新增记录与 adu-motion-video 深度评估

评估日期：2026-10-09（北京时间）。状态：RESEARCH；建议进入 MR-1.5 内部验证候选。Owner 已要求加入参考名单和评价价值；尚未批准运行时接入。本记录不修改已批准产品基线。

## 结论

值得重点参考，尤其适合“口播＋精确图文＋真实证据视频”的商业说明片。价值主要在完整镜头组合同、素材绑定、时钟编译、局部修订和交付治理。它不是通过模型生成任意视频的云 API，也不是 MO 的完整创意平台。建议先借鉴合同和验收机制，再对少数稳定组做隔离验证；不把全部风格整体接入。

固定源码：`aba8bf95f8d8ce502af95ec279778e781de51ccd`。package.json 为 3.14.0-rc.1；同名预发布不能与后续 main 树视作相同字节。阅读了目录树及核心源码、模板目录、接入合同、自动选型、素材、许可和验证记录。实际仅在隔离目录复跑原仓库 test_narration_edit_map.py：5/5 通过，覆盖多次剪切、逆映射边界、篡改拒绝及长时间轴整数累计。未执行全量测试、未渲染或观看完整声画成片；以下视觉质量判断仅为适用性推断。

## Owner 沟通记录

| 原始意图                                                | 本次落实                                                                           | 状态                                       |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------ |
| 借鉴要具体到功能和环节                                  | 下表列出源码、业务触发、输入输出、验收                                             | 已形成研究记录                             |
| 新增 adunext/adu-motion-video                           | 本文新增到创意仓库参考记录，保留固定版本                                           | 已记录，未采用                             |
| ICP 成为 capability；联系人邮箱采购渠道转为 MO provider | 保留为 M22/M23 方向，供应商身份与条款继续沿用专项核实；本仓库不承担 ICP/联系人采购 | Owner 方向，避免混入视频能力               |
| 三总监取舍，沟通不遗忘                                  | 分别记录产品、体验、架构视角和联合建议                                             | 角色视角评估，不声称已由三位独立评审者审核 |

## 内容如何进入具体功能

以下均为待规格审阅的提案，不是已实现功能。

| 上游内容与源码                                                         | MO 环节/功能                          | 具体应用及输入输出                                                                                     | 验收/取舍                                                                                |
| ---------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| 完整原子镜头组；adaptation.py；adaptation-profiles                     | M16 视频方案卡、M22 能力合同          | 将“主张→证据→结论”等表达关系转成镜头组；输入文案阶段、品牌、真实素材、画幅；输出镜头计划与具体缺项     | 合同含文字容量、数量、进出依赖、声音边界；不能只注册“会做视频”                           |
| semantic_inputs.py 的 inputPath/inputTemplate、未消费字段拒绝          | M16 文案/素材提交与校验               | 商标名、类别、价格、服务信息映射到声明槽位；多处显示共用同一语义字段；多交一张图或拼错字段不能静默丢弃 | 超容量须拆段或换组；商标名、价格、日期不得由动画示例补齐                                 |
| adapt_project.py 动作保护窗；narration_edit_map.py                     | M16 口播导入、字幕同步与节奏安排      | 剪辑后的口播用输出时钟；原动画用源编舞时钟；关键词关联动作落点；动作区保持原速、允许停留区延长         | 口型和字幕不能跟随旧模板时间；源码剪辑映射固定 60fps/48kHz，MO 合同须明确支持范围        |
| rematch_macro_project.py、rematch.py                                   | M16“只修改这一段”                     | 用户要求更换第三段效果；输出候选差异、受影响素材/声音/接缝，新版本工程保留旧版                         | apply 校验原 spec 字节摘要和目录；底稿已改则重新提案；不将“自动局部修改”夸大成无影响修改 |
| source_registry.py、extract_authored_pack.py、publish_reviewed_pack.py | 模板接入、版本管理与复用              | 完成项目先冻结源码/媒体身份，再提取完整镜头组；验收绑定具体来源、包版本和组范围                        | received→replayable→candidate→new-content-verified→releasable；只升级通过的组            |
| render_project.mjs、export_project.py、verify_delivery.py              | M16 渲染队列与交付卡                  | 本地资源、renderAt(t)、整数帧、显式音频生成 MP4；输出工程版本、输入摘要、帧数/音轨/颜色检查结果        | 技术通过另加完整声画审阅；仅把视口改成竖屏不能证明布局正确                               |
| font_policy.py、typography_audit.mjs、portrait 布局                    | M16 跨语言字幕/画幅；M18 商标营销展示 | 保存实际字体和许可；按真实中文长标题检验断行、遮挡、安全区；横竖版分别声明合同                         | 字符数不是排版验收；回退字体不保证原视觉一致；Canvas 字形另验                            |
| content_evidence.py、素材 SHA、fact bindings                           | M18 商标解释/商业化视频中的事实追溯   | 将品牌、注册信息、比较数字关联业务来源；真实录屏与示意动画区分，缺依据字段不生成断言                   | 结构和摘要检查不证明语义正确；Brain 推断不能成为官方事实                                 |
| mix_recipe.py、music_policy.py、macro_audio.py                         | M16 配音/背景音乐/动作音效            | 保存本次显式配乐、音量、混音配方与摘要；换镜头重新检查音效尾音、声画落点                               | 无音乐需明确选择，不能缺项偷偷静音；许可独立检查                                         |
| Lottie 目录 API、references/lottie-assets.md                           | M23 可选动画素材 Provider             | 检索注解→选择单个动画→下载/缓存→记录来源许可→绑定支持的播放器或转换流程                                | 不自动进入所有模板；缺许可不默认商用，429 停止/延期，不轮换 IP                           |

M16 的 WS-1.0 仍保持图文范围；视频试验放 MR-1.5。M18 可先沿用准确文本层和资产来源合同，但该仓库不是海报/商标拼图的现成引擎。

## Capability 与 Provider 如何分开

建议能力名称“口播动效视频制作”，需求从 M16 的已批准视频小节产生，输入是内容、真实媒体、品牌、字幕、画幅，结果是可预览视频及可编辑工程。内部实现可以使用 adu 工具，也可换成现有渲染方案；capability 不以 GitHub 仓库名命名。

adu 核心是本地工具实现/模板来源，不是现成外部 Provider。若做受控渲染 worker，可在 M23 中将它登记为实现候选；worker、任务调度、超时、权限和成本是 MO 需要补的部分。Lottie 外部 API 则是独立素材 Provider；图像/视频模型、TTS、数字人是另外的 Provider。

它没有提供完整 SaaS 的多租户隔离、队列/取消/预算、云凭据、计费与平台发布。其 HTML/JS 渲染会执行配方代码，“阻止 HTTP”不等于安全沙箱；MO 若允许上传自定义工程，必须在执行层隔离文件访问、网络、进程和资源。

## 成熟度不能按展示风格统一判断

固定目录的 11 种风格中：01-A/B/C、02-A/B 当前选择为 released；01-D/E、03-A、04-A、05-A、06-A 当前选择为 candidate。01-D/E 有历史稳定子集，但当前选中的新版本仍为候选。许多竖屏选择另为候选。02-A 的 released 仅一个续接组，02-B 仅两个已验收组，并不代表整条路线成立。自动混合选型本身为 experimental。

[目录](https://github.com/adunext/adu-motion-video/blob/aba8bf95f8d8ce502af95ec279778e781de51ccd/references/template-catalog.json)、[完整验证历史](https://github.com/adunext/adu-motion-video/blob/aba8bf95f8d8ce502af95ec279778e781de51ccd/docs/validation.md)明确保存了部分严格栅格审计失败/差异，并未因人工认可抹去。03-A 还记录过 HDR→JPEG 偏色的发现与修复。这种证据诚实值得借鉴，但也证明 MO 必须按实际环境和新内容复验。

[3.14 兼容报告](https://github.com/adunext/adu-motion-video/blob/aba8bf95f8d8ce502af95ec279778e781de51ccd/docs/compatibility-3.14.md)记录 macOS 上 241 项 Python 回归通过；这是上游报告，不是本次复跑结果。Windows 只验证了依赖解析/路径合同，未验真机整片；Linux 也缺本期声画验收。字体/布局检查与 Canvas/最终成片验收分开。候选版本更新快，应锁提交和包哈希，不跟 main 自动升级。

## 素材与许可边界

代码 MIT 不覆盖私人真人、声音、音乐、展示作品或外部动画。Noto/OFL 字体保留声明；旧字体说明与 3.14 回退策略必须按当前版本区分。外部 Lottie 的来源/许可字段可能缺失，无鉴权不能推导免费商用。

上游文档所述 API 限额为每 IP 每天20次、全接口每天2000次，目录、注解与下载共享；服务端配置和响应头才是实际依据。本次没有调用接口或核实在线额度。11,028 是其2026-10-01目录快照，不能等同于 MO 的已授权素材库存。无公开素材生成端点。应缓存目录及获准素材，服务失效时回落自有素材/已绑定模板，不能阻断已有工程。

公开包有提取脚本与合同文档，但作者完整本地“提炼方法 Skill”不随仓库分发；不能承诺一键把任意工程变成可靠模板。不同源码契约仍可能需要专用 adapter。

## 三个总监视角与联合取舍

| 视角     | 支持                                                 | Challenge                                                                           | 结论                                        |
| -------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------- |
| 产品     | 商标/服务解释、成果展示可复用同系列镜头              | 不能因效果丰富扩张 WS-1.0；真实素材和口播准备影响自动化率                           | 保留图文首发，视频进入 MR-1.5 内部验证      |
| UI/体验  | 效果预览＋缺项卡＋单段修改，适合业务对话操作         | 不把 sceneId、motionWindow、SHA 或 JSON 暴露给普通用户；不能用静音 GIF 代替完整预览 | 用户只选择效果和提交材料，合同由系统维护    |
| 技术架构 | 版本锁定、输入消费、时钟边界与可追溯交付具有复用价值 | 当前为本地脚本工具，缺生产执行层；跨环境、栅格差异与资源扩张待验证                  | 先合同迁移和受控 worker POC，少量稳定组起步 |

联合建议：RESEARCH，优先级较高；拟进入 MR-1.5 dogfood，但升级需要验收，不视作 Owner 已批准。拒绝“11种风格全可生产”“11028素材可直接商用”“能取代全部视频生成 Provider”三项推论。

## 最小验证方案与停止条件

1. 选 01-A/B 的已验收横屏组，用 MO 自有30–45秒口播、商标解释和真实演示视频做一条完整短片；记录固定代码/包版本。
2. 同稿在 MO 现有渲染候选上对照；比较完整制作工时、人工修订次数、失败恢复、文字准确性、口型/字幕、声画、成本和可迁移性；不比较示例 GIF 漂亮程度。
3. 改长标题、换三段真实媒体、缩短口播、局部换一组；检查超容量/缺项拒绝、事实未丢、动作原速、接缝、音效尾音。
4. 在目标 Windows 环境做 doctor、完整导出、重新打开工程和最终声画验收；竖屏另建合同和样片，不自动继承横屏结果。
5. 模拟外部素材服务失效、版权缺项、素材摘要变化、浏览器崩溃和任务超时；工程仍可恢复，降级必须可解释。

停止：新内容需要频繁改组内部源码、无法保留准确文字、目标系统成片不可复现、许可不足或资源成本不可控。通过后只升级实测的组/画幅/环境，随后提交具体 M16/M22/M23 小节供 Owner 审阅。

## 创意参考清单增量

新增：**adunext/adu-motion-video**，Owner 本次明确指定，研究定位为“口播动效视频的镜头合同与本地制作实现”。与此前 Remotion/HyperFrames 渲染参考、Satori/resvg 准确图文、ComfyUI 图像生成、MOKI 图文技能等保持不同职责，不因新增仓库删除原候选。原历史名单中的模糊 owner/repo 仍需核对，不由本次补猜。

本文件可作为仓库 docs/research/tech-radar/adu-motion-video.md 的独立新增记录；不抢占正在审阅的主规格、DecisionLog 或 IdeaRegister 编号。后续统一合并时，由持有登记文件的任务同步本结论。

## 主要源码依据

- [选型与适配合同](https://github.com/adunext/adu-motion-video/blob/aba8bf95f8d8ce502af95ec279778e781de51ccd/scripts/adaptation.py)
- [语义输入消费检查](https://github.com/adunext/adu-motion-video/blob/aba8bf95f8d8ce502af95ec279778e781de51ccd/scripts/semantic_inputs.py)
- [口播编辑映射](https://github.com/adunext/adu-motion-video/blob/aba8bf95f8d8ce502af95ec279778e781de51ccd/scripts/narration_edit_map.py)
- [局部重配提案与应用](https://github.com/adunext/adu-motion-video/blob/aba8bf95f8d8ce502af95ec279778e781de51ccd/scripts/rematch_macro_project.py)
- [确定性帧渲染](https://github.com/adunext/adu-motion-video/blob/aba8bf95f8d8ce502af95ec279778e781de51ccd/scripts/render_project.mjs)
- [交付证据校验](https://github.com/adunext/adu-motion-video/blob/aba8bf95f8d8ce502af95ec279778e781de51ccd/scripts/verify_delivery.py)
- [持续模板接入](https://github.com/adunext/adu-motion-video/blob/aba8bf95f8d8ce502af95ec279778e781de51ccd/references/template-intake.md)
- [第三方许可](https://github.com/adunext/adu-motion-video/blob/aba8bf95f8d8ce502af95ec279778e781de51ccd/THIRD_PARTY.md)
- [Lottie接口与额度说明](https://github.com/adunext/adu-motion-video/blob/aba8bf95f8d8ce502af95ec279778e781de51ccd/references/lottie-assets.md)
