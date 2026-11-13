# Taxonomy duplicate audit — prod, 2026-09-22 (read-only)

Source: scratchpad `taxonomy_dupes.cjs` run on the prod box against 691 sections / 4149 topics / 2383 subtopics. "use" = references from classes, courseclasses (+apx placements), pdfs, questions, shorts, series, seriesquestionmaps, aitestpatterns, usertopicquestionlogs, learnlibrarytags, apxseriessectionmaps, ebooks; childTopics/childSubTopics = children still attached. **Removable = use is {} (nothing references it, no children).**


## Sections — duplicate name, removable (use {})

| id | path | status | created | use |
|---|---|---|---|---|
| `6a885af03aed5ba9f3a20fae` | Computer Knowledge | 0 | 2026-08-21T14:04 | {} |
| `6a885af03aed5ba9f3a20faf` | Computer Knowledge | 0 | 2026-08-21T14:04 | {} |
| `6a455ef2ebb42f585d9d8203` | REASONING CLASSES | 1 | 2026-07-01T18:39 | {} |
| `6a885af03aed5ba9f3a20f75` | Section III | 1 | 2026-08-21T14:04 | {} |
| `6a885af03aed5ba9f3a20f74` | Section III | 1 | 2026-08-21T14:04 | {} |
| `6a3d2ac13aed5ba9f3fe6c0b` | STATIC GK | 1 | 2026-06-25T13:18 | {} |
| `6a885af03aed5ba9f3a20f61` | Statistics | 1 | 2026-08-21T14:04 | {} |
| `6a885af03aed5ba9f3a20f63` | Statistics | 1 | 2026-08-21T14:04 | {} |
| `6a3d2ac13aed5ba9f3fe6c04` | test | 1 | 2026-06-25T13:18 | {} |

## Sections — duplicate name, ALL nodes (decide by hand)

| id | path | status | created | use |
|---|---|---|---|---|
| `6a9023049a9d53af06e3bf8e` | ADVANCE | 1 | 2026-08-27T11:44 | {"class":1,"courseclass":628,"pdf":1,"question":1,"childTopics":15} |
| `6a9047fb0bcee98f4c7f6696` | Advance | 1 | 2026-08-27T14:21 | {"class":1,"courseclass":441,"childTopics":8} |
| `6a885af03aed5ba9f3a20f98` | Arithmetic | 1 | 2026-08-21T14:04 | {"class":1,"pdf":1,"question":201,"series":1,"seriesqmap":1,"childTopics":2} |
| `6a885af03aed5ba9f3a20fe4` | Arithmetic | 1 | 2026-08-21T14:04 | {"question":112,"series":1,"seriesqmap":1,"childTopics":2} |
| `6a9023049a9d53af06e3bf8f` | ARITHMETIC | 1 | 2026-08-27T11:44 | {"class":4,"courseclass":686,"childTopics":25} |
| `6a9047fb0bcee98f4c7f6697` | Arithmetic | 1 | 2026-08-27T14:21 | {"class":1,"courseclass":490,"childTopics":14} |
| `6a9d0afa3aed5ba9f3f0395d` | Arithmetic | 1 | 2026-09-06T06:40 | {"question":4} |
| `6a885af03aed5ba9f3a20f27` | Biology | 1 | 2026-08-21T14:04 | {"question":76,"series":1,"seriesqmap":2,"childTopics":38} |
| `6a914daa709253fd90707de4` | Biology | 1 | 2026-08-28T08:58 | {"courseclass":18,"childTopics":1} |
| `6a455d36ebb42f585d9cd357` | Chemistry | 1 | 2026-07-01T18:32 | {"courseclass":52,"childTopics":7} |
| `6a885af03aed5ba9f3a20f28` | Chemistry | 1 | 2026-08-21T14:04 | {"question":53,"seriesqmap":1,"childTopics":3} |
| `6a4558d6ebb42f585d9a91ab` | Classes | 1 | 2026-07-01T18:13 | {"class":2151,"courseclass":2,"pdf":2916,"childTopics":344} |
| `6a455e7cebb42f585d9d5553` | CLASSES | 1 | 2026-07-01T18:37 | {"class":37,"pdf":28,"childTopics":29} |
| `6a45591cebb42f585d9ac3d3` | Computer | 1 | 2026-07-01T18:14 | {"class":96,"courseclass":250,"pdf":78,"childTopics":11} |
| `6a885af03aed5ba9f3a20f17` | Computer | 1 | 2026-08-21T14:04 | {"question":1,"childTopics":1} |
| `6a885af03aed5ba9f3a20f84` | Computer | 1 | 2026-08-21T14:04 | {"childTopics":1} |
| `6a885af03aed5ba9f3a20f21` | Computer Knowledge | 1 | 2026-08-21T14:04 | {"question":260,"seriesqmap":7,"childTopics":15} |
| `6a885af03aed5ba9f3a20fae` | Computer Knowledge | 0 | 2026-08-21T14:04 | {} |
| `6a885af03aed5ba9f3a20faf` | Computer Knowledge | 0 | 2026-08-21T14:04 | {} |
| `6a885af03aed5ba9f3a20fb0` | Computer Knowledge | 0 | 2026-08-21T14:04 | {"question":20} |
| `6a885af03aed5ba9f3a20fba` | Computer Knowledge | 1 | 2026-08-21T14:04 | {"question":38,"childTopics":1} |
| `6a3d2ac13aed5ba9f3fe6c0c` | Current Affairs | 1 | 2026-06-25T13:18 | {"class":219,"courseclass":253,"pdf":14,"childTopics":3} |
| `6a885af03aed5ba9f3a20f9c` | Current Affairs | 1 | 2026-08-21T14:04 | {"class":2,"childTopics":1} |
| `6a4cdfdf42211ae83977d84d` | E-BOOK | 1 | 2026-07-07T11:15 | {"pdf":35,"question":99,"series":13,"apxmap":12,"childTopics":7} |
| `6a946eb629f16f98cfd7caea` | E-Book | 1 | 2026-08-30T17:56 | {"pdf":8} |
| `6a4d1f003e29123ffb5eb0e5` | English | 1 | 2026-07-07T15:45 | {"courseclass":244,"question":684,"series":10,"apxmap":30,"childTopics":2} |
| `6a885af03aed5ba9f3a20f85` | English | 1 | 2026-08-21T14:04 | {"childTopics":1} |
| `6a4558c8ebb42f585d9a8801` | General Awareness | 1 | 2026-07-01T18:13 | {"class":197,"courseclass":347,"pdf":190,"question":2036,"series":25,"childTopics":13} |
| `6a455e17ebb42f585d9d2e6c` | GENERAL AWARENESS | 1 | 2026-07-01T18:36 | {"class":196,"courseclass":757,"pdf":123,"childTopics":83} |
| `6a885af03aed5ba9f3a20f19` | General Awareness | 1 | 2026-08-21T14:04 | {"question":10380,"series":387,"seriesqmap":1012,"childTopics":137} |
| `6a885af03aed5ba9f3a20f5f` | General Knowledge and Current Affairs | 1 | 2026-08-21T14:04 | {"question":40} |
| `6a885af03aed5ba9f3a20fa8` | General Knowledge and Current Affairs | 1 | 2026-08-21T14:04 | {"question":220,"childTopics":1} |
| `6a45605debb42f585d9e0e4c` | General Science | 1 | 2026-07-01T18:45 | {"courseclass":326,"childTopics":41} |
| `6a885af03aed5ba9f3a20f2a` | General Science | 1 | 2026-08-21T14:04 | {"question":2669,"series":135,"seriesqmap":196,"childTopics":2} |
| `6a9211ea6708f6e9bcfa334c` | GENERAL SCIENCE | 1 | 2026-08-28T22:55 | {"question":335,"childTopics":1} |
| `6a455d3eebb42f585d9cd648` | History | 1 | 2026-07-01T18:32 | {"courseclass":287,"childTopics":8} |
| `6a885af03aed5ba9f3a20f26` | History | 1 | 2026-08-21T14:04 | {"question":124,"childTopics":3} |
| `6a916a83e4114180890befde` | HISTORY | 1 | 2026-08-28T11:01 | {"courseclass":105,"childTopics":3} |
| `6a3d2ac13aed5ba9f3fe6c15` | INTRODUCTION | 1 | 2026-06-25T13:18 | {"class":13,"courseclass":5,"childTopics":2} |
| `6a8d68ddad4789cb1b01fa1c` | Introduction | 1 | 2026-08-25T10:05 | {"class":13,"courseclass":4,"childTopics":1} |
| `6a885af03aed5ba9f3a20f1b` | Logical Reasoning | 1 | 2026-08-21T14:04 | {"pdf":2,"question":11012,"series":109,"seriesqmap":424,"childTopics":134} |
| `6a91697d0ec8510cb6e0281c` | Logical Reasoning | 1 | 2026-08-28T10:57 | {"courseclass":14,"question":405,"childTopics":1} |
| `6a3d2ac13aed5ba9f3fe6c0e` | Maths | 1 | 2026-06-25T13:18 | {"class":1111,"courseclass":3959,"pdf":508,"childTopics":151} |
| `6a4ca8613e29123ffb5e1141` | maths | 1 | 2026-07-07T07:18 | {"question":337,"series":11,"apxmap":13,"childTopics":1} |
| `6a885af03aed5ba9f3a20f1f` | Maths | 1 | 2026-08-21T14:04 | {"question":174,"seriesqmap":8,"childTopics":21} |
| `6a91f62edce17876b773972c` | MATHS | 1 | 2026-08-28T20:57 | {"class":1,"courseclass":2,"childTopics":1} |
| `6a9047fb0bcee98f4c7f6698` | Miscellaneous | 1 | 2026-08-27T14:21 | {"courseclass":195,"childTopics":4} |
| `6aad1a2cea342a1e027519b3` | Miscellaneous | 1 | 2026-08-27T14:21 | {"childTopics":1} |
| `6a455d33ebb42f585d9cd1f3` | Physics | 1 | 2026-07-01T18:32 | {"courseclass":67,"childTopics":9} |
| `6a885af03aed5ba9f3a20f1e` | Physics | 1 | 2026-08-21T14:04 | {"question":150,"seriesqmap":1,"childTopics":17} |
| `6a885af03aed5ba9f3a20f29` | Physics | 1 | 2026-08-21T14:04 | {"question":10,"seriesqmap":1,"childTopics":8} |
| `6a71d830a7507c01f2c3f4d7` | Quantitative Aptitude | 1 | 2026-08-04T12:16 | {"childTopics":1} |
| `6a885af03aed5ba9f3a20f1a` | Quantitative Aptitude | 1 | 2026-08-21T14:04 | {"pdf":2,"question":10563,"series":121,"seriesqmap":736,"childTopics":53} |
| `6a4558c2ebb42f585d9a8333` | Reasoning | 1 | 2026-07-01T18:13 | {"class":533,"courseclass":1580,"pdf":512,"question":2379,"series":69,"childTopics":72} |
| `6a455e06ebb42f585d9d27d7` | REASONING | 1 | 2026-07-01T18:35 | {"class":2,"courseclass":222,"childTopics":39} |
| `6a885af03aed5ba9f3a20f86` | Reasoning | 1 | 2026-08-21T14:04 | {"childTopics":1} |
| `6a455ea3ebb42f585d9d6383` | Reasoning Classes | 1 | 2026-07-01T18:38 | {"class":21,"courseclass":719,"pdf":10,"childTopics":46} |
| `6a455ef2ebb42f585d9d8203` | REASONING CLASSES | 1 | 2026-07-01T18:39 | {} |
| `6a4558c2ebb42f585d9a8376` | Science | 1 | 2026-07-01T18:13 | {"class":199,"courseclass":419,"pdf":66,"question":694,"series":2,"childTopics":38} |
| `6a885af03aed5ba9f3a20fa4` | Science | 1 | 2026-08-21T14:04 | {"question":80,"seriesqmap":8} |
| `6a885af03aed5ba9f3a20f75` | Section III | 1 | 2026-08-21T14:04 | {} |
| `6a885af03aed5ba9f3a20f74` | Section III | 1 | 2026-08-21T14:04 | {} |
| `6a3d2ac13aed5ba9f3fe6c0b` | STATIC GK | 1 | 2026-06-25T13:18 | {} |
| `6a455d42ebb42f585d9cd77b` | Static GK | 1 | 2026-07-01T18:32 | {"class":79,"courseclass":198,"childTopics":1} |
| `6a4558c2ebb42f585d9a8348` | Static Gk / CA | 1 | 2026-07-01T18:13 | {"class":1,"courseclass":1,"pdf":1,"childTopics":1} |
| `6a4558c3ebb42f585d9a83fb` | Static GK / CA | 1 | 2026-07-01T18:13 | {"class":4,"pdf":4} |
| `6a885af03aed5ba9f3a20f61` | Statistics | 1 | 2026-08-21T14:04 | {} |
| `6a885af03aed5ba9f3a20f62` | Statistics | 1 | 2026-08-21T14:04 | {"childTopics":1} |
| `6a885af03aed5ba9f3a20f63` | Statistics | 1 | 2026-08-21T14:04 | {} |
| `6a3d2ac13aed5ba9f3fe6c04` | test | 1 | 2026-06-25T13:18 | {} |
| `6a885af03aed5ba9f3a20f97` | Test | 1 | 2026-08-21T14:04 | {"childTopics":1} |

## Topics — same section name > topic name, removable

| id | path | status | created | use |
|---|---|---|---|---|
| `6a885c113aed5ba9f3a21725` | Child Pedagogy > Misc | 1 | 2026-08-21T14:09 | {} |
| `6a885c113aed5ba9f3a21726` | Child Pedagogy > Misc | 1 | 2026-08-21T14:09 | {} |
| `6a455ac5ebb42f585d9bba5b` | Classes > 16. MIX Topics | 1 | 2026-07-01T18:21 | {} |
| `6a455c7debb42f585d9c84f6` | Classes > Age | 1 | 2026-07-01T18:29 | {} |
| `6a455e8cebb42f585d9d5b2e` | CLASSES > Age | 1 | 2026-07-01T18:38 | {} |
| `6a455e85ebb42f585d9d58d6` | CLASSES > AP & GP Series Theory | 1 | 2026-07-01T18:37 | {} |
| `6a455e8cebb42f585d9d5b4d` | CLASSES > Average | 1 | 2026-07-01T18:38 | {} |
| `6a455e92ebb42f585d9d5d5e` | CLASSES > Boat & Stream | 1 | 2026-07-01T18:38 | {} |
| `6a4558e5ebb42f585d9a9d23` | Classes > Coding Decoding | 1 | 2026-07-01T18:13 | {} |
| `6a455a1bebb42f585d9b5f8d` | Classes > Computer | 1 | 2026-07-01T18:19 | {} |
| `6a455d29ebb42f585d9cce08` | Classes > DATA SUFFICIENCY | 1 | 2026-07-01T18:32 | {} |
| `6a455d86ebb42f585d9cf44c` | Classes > Data Sufficiency | 1 | 2026-07-01T18:33 | {} |
| `6a455e85ebb42f585d9d58b7` | CLASSES > Decimal | 1 | 2026-07-01T18:37 | {} |
| `6a455936ebb42f585d9ad55e` | Classes > Latest Questions 2026 | 1 | 2026-07-01T18:15 | {} |
| `6a45593debb42f585d9ad9f0` | Classes > Latest questions 2026 | 1 | 2026-07-01T18:15 | {} |
| `6a455a2eebb42f585d9b69a3` | Classes > Lcm & Hcf | 1 | 2026-07-01T18:19 | {} |
| `6a455e97ebb42f585d9d5f41` | CLASSES > Lcm & Hcf | 1 | 2026-07-01T18:38 | {} |
| `6a455eacebb42f585d9d673e` | Classes > Letter Arrangement Word Formation Miscellaneous | 1 | 2026-07-01T18:38 | {} |
| `6a455e8bebb42f585d9d5aec` | CLASSES > Mixture & Alligation | 1 | 2026-07-01T18:38 | {} |
| `6a455ea9ebb42f585d9d65fe` | Classes > Mock Test | 1 | 2026-07-01T18:38 | {} |
| `6a455eacebb42f585d9d6734` | Classes > Number Analogy | 1 | 2026-07-01T18:38 | {} |
| `6a455e93ebb42f585d9d5db8` | CLASSES > Number System | 1 | 2026-07-01T18:38 | {} |
| `6a455d2eebb42f585d9ccfce` | Classes > Order and Ranking | 1 | 2026-07-01T18:32 | {} |
| `6a455d7eebb42f585d9cf0e0` | Classes > Order And Ranking | 1 | 2026-07-01T18:33 | {} |
| `6a455eacebb42f585d9d670e` | Classes > ORDER AND RANKING | 1 | 2026-07-01T18:38 | {} |
| `6a455e8bebb42f585d9d5abf` | CLASSES > Partnership | 1 | 2026-07-01T18:38 | {} |
| `6a455e83ebb42f585d9d5844` | CLASSES > Percentage | 1 | 2026-07-01T18:37 | {} |
| `6a455e8febb42f585d9d5c36` | CLASSES > Pipe & Cistern | 1 | 2026-07-01T18:38 | {} |
| `6a455e86ebb42f585d9d5964` | CLASSES > Profit & Loss | 1 | 2026-07-01T18:37 | {} |
| `6a455e93ebb42f585d9d5d8b` | CLASSES > Race | 1 | 2026-07-01T18:38 | {} |
| `6a455e89ebb42f585d9d5a61` | CLASSES > Ratio & Proportion | 1 | 2026-07-01T18:38 | {} |
| `6a455e88ebb42f585d9d59cb` | CLASSES > Simple & Compound Interest | 1 | 2026-07-01T18:38 | {} |
| `6a455e85ebb42f585d9d58ee` | CLASSES > Simplification | 1 | 2026-07-01T18:37 | {} |
| `6a4558e4ebb42f585d9a9c6b` | Classes > Syllogism | 1 | 2026-07-01T18:13 | {} |
| `6a455e7eebb42f585d9d5632` | CLASSES > Syllogism | 1 | 2026-07-01T18:37 | {} |
| `6a455e8eebb42f585d9d5bca` | CLASSES > Time & Work | 1 | 2026-07-01T18:38 | {} |
| `6a455e8febb42f585d9d5c71` | CLASSES > Time,Speed & Distance | 1 | 2026-07-01T18:38 | {} |
| `6a455e91ebb42f585d9d5d00` | CLASSES > Train | 1 | 2026-07-01T18:38 | {} |
| `6a455d2eebb42f585d9cd01a` | Classes > VENN DIAGRAM | 1 | 2026-07-01T18:32 | {} |
| `6a455d80ebb42f585d9cf198` | Classes > Venn Diagram | 1 | 2026-07-01T18:33 | {} |
| `6a455e86ebb42f585d9d5953` | CLASSES > Venn diagram | 1 | 2026-07-01T18:37 | {} |
| `6a885be53aed5ba9f3a21545` | English > English | 1 | 2026-08-21T14:08 | {} |
| `6a885bb73aed5ba9f3a2131b` | English Language > Incorrectly Spelt | 1 | 2026-08-21T14:07 | {} |
| `6a885c113aed5ba9f3a21704` | General English > Misc | 1 | 2026-08-21T14:09 | {} |
| `6a885c113aed5ba9f3a21705` | General English > Misc | 1 | 2026-08-21T14:09 | {} |
| `6a885be53aed5ba9f3a214f9` | NDA GAT - Part B - General Knowledge > Polity | 1 | 2026-08-21T14:08 | {} |
| `6a885be53aed5ba9f3a214fa` | NDA GAT - Part B - General Knowledge > Polity | 0 | 2026-08-21T14:08 | {} |
| `6a885bae3aed5ba9f3a21263` | Physics > Gravitation | 1 | 2026-08-21T14:07 | {} |
| `6a456153ebb42f585d9e6a81` | RAILWAY REASONING FOUNDATION BATCH > REASONING CLASSES | 1 | 2026-07-01T18:49 | {} |
| `6a4558eeebb42f585d9aa32c` | Science > BIOLOGY | 0 | 2026-07-01T18:14 | {} |
| `6a885bee3aed5ba9f3a21561` | Section III - Computer Knowledge > Computer | 1 | 2026-08-21T14:08 | {} |

## SubTopics — same section > topic > subtopic, removable

| id | path | status | created | use |
|---|---|---|---|---|
| `6a885f283aed5ba9f3a21eea` | Biology > Biological Classification > Kingdom Protista | 1 | 2026-08-21T14:22 | {} |
| `6a885f283aed5ba9f3a21eeb` | Biology > Biological Classification > Kingdom Protista | 1 | 2026-08-21T14:22 | {} |
| `6a885f313aed5ba9f3a21f50` | Biology > Biomolecules > Miscellaneous | 1 | 2026-08-21T14:22 | {} |
| `6a885f313aed5ba9f3a21f51` | Biology > Biomolecules > Miscellaneous | 1 | 2026-08-21T14:22 | {} |
| `6a885f3a3aed5ba9f3a21ff4` | Biology > Chemical coordination and integration > Miscellaneous | 1 | 2026-08-21T14:22 | {} |
| `6a885f3a3aed5ba9f3a22001` | Biology > Chemical coordination and integration > Miscellaneous | 1 | 2026-08-21T14:22 | {} |
| `6a885f283aed5ba9f3a21ede` | Biology > Environmental Issues > People's participation in conservation of forests | 1 | 2026-08-21T14:22 | {} |
| `6a885f283aed5ba9f3a21edf` | Biology > Environmental Issues > People's participation in conservation of forests | 1 | 2026-08-21T14:22 | {} |
| `6a885f173aed5ba9f3a21df3` | Biology > Human Reproduction > Introduction | 1 | 2026-08-21T14:22 | {} |
| `6a885f173aed5ba9f3a21df2` | Biology > Human Reproduction > Introduction | 1 | 2026-08-21T14:22 | {} |
| `6a885f3b3aed5ba9f3a2202c` | Logical Reasoning > Mathematical Inequality > Coded Inequality | 1 | 2026-08-21T14:22 | {} |
| `6a885f3b3aed5ba9f3a2202d` | Logical Reasoning > Mathematical Inequality > Coded Inequality | 1 | 2026-08-21T14:22 | {} |
| `6a885f433aed5ba9f3a22061` | Logical Reasoning > Seating Arrangement > Multiple Row Arrangement | 1 | 2026-08-21T14:22 | {} |
| `6a885f4c3aed5ba9f3a220ae` | Logical Reasoning > Seating Arrangement > Multiple Row Arrangement | 1 | 2026-08-21T14:23 | {} |

## SubTopics — same section > topic > subtopic, in use (merge by hand)

| id | path | status | created | use |
|---|---|---|---|---|
| `cdfe3297dbcb9005a3368fe5` | Maths > Extra YouTube Content > DI | 1 | 2026-08-26T11:50 | {"class":5} |
| `6a904931dfb950424f54a2a2` | Maths > Extra Youtube Content > DI | 1 | 2026-08-27T14:26 | {"courseclass":15} |
| `4fa26301e6f76307ae03442e` | Maths > Extra YouTube Content > Exams Latest Questions | 1 | 2026-08-26T11:50 | {"class":15} |
| `6a904931dfb950424f54a2a3` | Maths > Extra Youtube Content > Exams Latest Questions | 1 | 2026-08-27T14:26 | {"courseclass":45} |
| `a0719f39ec2d6434c2a83c5e` | Maths > Extra YouTube Content > Exams Top Questions | 1 | 2026-08-26T11:50 | {"class":44} |
| `6a904931dfb950424f54a2a4` | Maths > Extra Youtube Content > Exams Top Questions | 1 | 2026-08-27T14:26 | {"courseclass":132} |
| `40357d084b47a29b0fecb520` | Maths > Extra YouTube Content > Short Videos | 1 | 2026-08-26T11:50 | {"class":2} |
| `6a904931dfb950424f54a2a5` | Maths > Extra Youtube Content > Short Videos | 1 | 2026-08-27T14:26 | {"courseclass":6} |
| `2d55f470e793c968a8c79e7a` | Maths > Extra YouTube Content > Unique Approach Classes | 1 | 2026-08-26T11:50 | {"class":21} |
| `6a904931dfb950424f54a2a6` | Maths > Extra Youtube Content > Unique Approach Classes | 1 | 2026-08-27T14:26 | {"courseclass":63} |

## SubTopics — same topic name > subtopic name across different sections (per-course trees; mostly legitimate)

```
SCREENSHOT 6a920e5df098a32b29909fa7 Maths Classes > ARITHMETIC > 3.AP & GP Series Theory 1 2026-08-28T22:40 {"courseclass":3}
SCREENSHOT 6a92bbbe10324f60e5d9b9d3 Railway Maths Complete Foundation > ARITHMETIC > 3.AP & GP Series Theory 1 2026-08-29T11:00 {"courseclass":3}
SUBTOPICS same topic-name > sub-name: { groups: 264, nodes: 793, unused: 175, resolvable: 80 }
* advance > algebra (7, unused 0) Maths:bf4eb3df:53 | Maths Classes:29909f8b:138 | Complete Practice (ATM) Batch:e5d9b9a2:6 | Maths ATM BAtch:e5d9b929:6 | Railway Maths Complete Foundation:e5d9b9bb:46 | Average To Master (ATM) Full BATCH:83e43916:12 | RAILWAY MATHS FOUNDATION BATCH:e1e3c914:46
* advance > coordinate geometry (7, unused 1) Maths:4807a962:10 | Maths Classes:29909f8c:25 | Railway Maths Complete Foundation:e5d9b9bc:7 | Maths ATM BAtch:e5d9b92a:2 | Complete Practice (ATM) Batch:e5d9b9a3:2 | Average To Master (ATM) Full BATCH:83e43917:0 | RAILWAY MATHS FOUNDATION BATCH:e1e3c915:7
* advance > elementry statistics (6, unused 3) Maths Classes:29909f8d:32 | Maths ATM BAtch:e5d9b92b:16 | Railway Maths Complete Foundation:e5d9b9bd:0 | Complete Practice (ATM) Batch:e5d9b9a4:16 | Average To Master (ATM) Full BATCH:83e43918:0 | RAILWAY MATHS FOUNDATION BATCH:e1e3c916:0
* advance > geometry (7, unused 0) Maths:72951684:64 | Maths Classes:29909f8e:3 | Maths ATM BAtch:e5d9b92c:3 | Complete Practice (ATM) Batch:e5d9b9a5:3 | Railway Maths Complete Foundation:e5d9b9be:1 | Average To Master (ATM) Full BATCH:83e43919:6 | RAILWAY MATHS FOUNDATION BATCH:e1e3c917:1
* advance > geometry > circle (2, unused 0) Maths Classes:29909f8f:34 | Railway Maths Complete Foundation:0016828b:17
* advance > geometry > line & angles (2, unused 0) Maths Classes:29909f90:10 | Railway Maths Complete Foundation:0016828c:5
* advance > geometry > quadrilateral (2, unused 0) Maths Classes:29909f91:22 | Railway Maths Complete Foundation:0016828d:11
* advance > geometry > triangle (2, unused 0) Maths Classes:29909f92:54 | Railway Maths Complete Foundation:0016828e:27
* advance > height & distance (7, unused 3) Maths:efcf8666:4 | Maths Classes:29909f93:6 | Complete Practice (ATM) Batch:e5d9b9a6:3 | Maths ATM BAtch:e5d9b92d:3 | Railway Maths Complete Foundation:e5d9b9bf:0 | Average To Master (ATM) Full BATCH:83e4391a:0 | RAILWAY MATHS FOUNDATION BATCH:e1e3c918:0
* advance > inverse trigonometry (4, unused 0) Maths:1dcf956c:3 | Maths Classes:29909f94:8 | Railway Maths Complete Foundation:e5d9b9c0:3 | RAILWAY MATHS FOUNDATION BATCH:e1e3c919:3
* advance > lcm & hcf (3, unused 0) Maths Classes:29909f95:39 | Railway Maths Complete Foundation:e5d9b9c1:13 | RAILWAY MATHS FOUNDATION BATCH:e1e3c91a:13
* advance > mensuration (3, unused 0) Complete Practice (ATM) Batch:e5d9b9a7:12 | Maths ATM BAtch:e5d9b92e:12 | Average To Master (ATM) Full BATCH:83e4391b:24
* advance > mensuration 2d (4, unused 0) Maths:f365e5c6:30 | Maths Classes:29909f96:69 | Railway Maths Complete Foundation:e5d9b9c2:23 | RAILWAY MATHS FOUNDATION BATCH:e1e3c91b:23
* advance > mensuration 3d (4, unused 0) Maths:659d506c:27 | Maths Classes:29909f97:48 | Railway Maths Complete Foundation:e5d9b9c3:16 | RAILWAY MATHS FOUNDATION BATCH:e1e3c91c:16
* advance > number system (3, unused 0) Maths Classes:29909f98:126 | Railway Maths Complete Foundation:e5d9b9c4:42 | RAILWAY MATHS FOUNDATION BATCH:e1e3c91d:42
* advance > permutation & combination (3, unused 0) Maths Classes:29909f99:57 | Railway Maths Complete Foundation:e5d9b9c5:19 | RAILWAY MATHS FOUNDATION BATCH:e1e3c91e:19
* advance > probability (3, unused 0) Maths Classes:29909f9a:33 | Railway Maths Complete Foundation:e5d9b9c6:11 | RAILWAY MATHS FOUNDATION BATCH:e1e3c91f:11
* advance > trigonometry (7, unused 0) Maths:845b3eba:30 | Maths Classes:29909f9b:82 | Maths ATM BAtch:e5d9b92f:8 | Railway Maths Complete Foundation:e5d9b9c7:27 | Complete Practice (ATM) Batch:e5d9b9a8:8 | Average To Master (ATM) Full BATCH:83e4391c:16 | RAILWAY MATHS FOUNDATION BATCH:e1e3c920:27
* ancient history > indus valley civilisation - सिंधु घाटी सभ्यता (6, unused 3) HISTORY:890befe6:24 | HISTORY- इतिहास  BY BHAWANI SIR:b98f6ada:51 | GENERAL AWARENESS:63540cab:0 | Gk Classes:83e4399a:24 | RRB  GENERAL AWARENESS FOUNDATION BATCH (CBT 1 & CBT 2):e1e3c940:0 | Railway Gk Foundation Batch:e1e3c913:0
* arithmetic > 1.simplification (2, unused 0) Maths Classes:29909f9c:14 | Railway Maths Complete Foundation:e5d9b9c8:14
* arithmetic > 10.mixture & alligation (2, unused 0) Maths Classes:29909f9d:9 | Railway Maths Complete Foundation:e5d9b9c9:9
* arithmetic > 11.age (2, unused 0) Maths Classes:29909f9e:4 | Railway Maths Complete Foundation:e5d9b9ca:4
* arithmetic > 12.average (2, unused 0) Maths Classes:29909f9f:17 | Railway Maths Complete Foundation:e5d9b9cb:17
* arithmetic > 13.time & work (2, unused 0) Maths Classes:29909fa0:15 | Railway Maths Complete Foundation:e5d9b9cc:15
* arithmetic > 14.pipe & cistern (2, unused 0) Maths Classes:29909fa1:8 | Railway Maths Complete Foundation:e5d9b9cd:8
* arithmetic > 15.time,speed & distance (2, unused 0) Maths Classes:29909fa2:20 | Railway Maths Complete Foundation:e5d9b9ce:20
* arithmetic > 16.train (2, unused 0) Maths Classes:29909fa3:13 | Railway Maths Complete Foundation:e5d9b9cf:13
* arithmetic > 17.boat & stream (2, unused 0) Maths Classes:29909fa4:6 | Railway Maths Complete Foundation:e5d9b9d0:6
* arithmetic > 18.race (2, unused 0) Maths Classes:29909fa5:6 | Railway Maths Complete Foundation:e5d9b9d1:6
* arithmetic > 2.decimal (2, unused 0) Maths Classes:29909fa6:4 | Railway Maths Complete Foundation:e5d9b9d2:4
* arithmetic > 3.ap & gp series theory (2, unused 0) Maths Classes:29909fa7:3 | Railway Maths Complete Foundation:e5d9b9d3:3
* arithmetic > 4.percentage (2, unused 0) Maths Classes:29909fa8:16 | Railway Maths Complete Foundation:e5d9b9d4:16
* arithmetic > 5.venn diagram (2, unused 0) Maths Classes:29909fa9:2 | Railway Maths Complete Foundation:e5d9b9d5:2
* arithmetic > 6.profit & loss (2, unused 0) Maths Classes:29909faa:14 | Railway Maths Complete Foundation:e5d9b9d6:14
* arithmetic > 7.simple & compound interest (2, unused 0) Maths Classes:29909fab:21 | Railway Maths Complete Foundation:e5d9b9d7:21
* arithmetic > 8.ratio & proportion (2, unused 0) Maths Classes:29909fac:13 | Railway Maths Complete Foundation:e5d9b9d8:13
* arithmetic > 9.partnership (2, unused 0) Maths Classes:29909fad:6 | Railway Maths Complete Foundation:e5d9b9d9:6
* arithmetic > age (8, unused 1) Maths:88c5983a:10 | Class:978e438a:4 | MATHS ( LIVE + VOD ):63540cd1:0 | Maths Classes:f7313441:8 | Complete Practice (ATM) Batch:e5d9b9a9:3 | Maths ATM BAtch:e5d9b930:3 | Average To Master (ATM) Full BATCH:83e4391d:6 | RAILWAY MATHS FOUNDATION BATCH:e1e3c921:4
* arithmetic > ap & gp series theory (4, unused 1) Class:978e438b:3 | MATHS ( LIVE + VOD ):63540cd2:0 | Maths Classes:f7313442:6 | RAILWAY MATHS FOUNDATION BATCH:e1e3c922:3
* arithmetic > average (8, unused 1) Maths:24ab7381:32 | Class:978e438c:17 | MATHS ( LIVE + VOD ):63540cd3:0 | Maths Classes:f7313443:33 | Maths ATM BAtch:e5d9b931:10 | Complete Practice (ATM) Batch:e5d9b9aa:10 | Average To Master (ATM) Full BATCH:83e4391e:20 | RAILWAY MATHS FOUNDATION BATCH:e1e3c923:17
* arithmetic > boat & stream (8, unused 1) Maths:c311e882:8 | Class:978e438d:6 | MATHS ( LIVE + VOD ):63540cd4:0 | Maths Classes:f7313444:12 | Maths ATM BAtch:e5d9b932:4 | Complete Practice (ATM) Batch:e5d9b9ab:4 | Average To Master (ATM) Full BATCH:83e4391f:8 | RAILWAY MATHS FOUNDATION BATCH:e1e3c924:6
* arithmetic > compound interest (3, unused 0) Maths ATM BAtch:e5d9b933:6 | Complete Practice (ATM) Batch:e5d9b9ac:6 | Average To Master (ATM) Full BATCH:83e43920:12
* arithmetic > decimal (4, unused 1) Class:978e438e:4 | MATHS ( LIVE + VOD ):63540cd5:0 | Maths Classes:f7313445:8 | RAILWAY MATHS FOUNDATION BATCH:e1e3c925:4
* arithmetic > lcm hcf (3, unused 0) Maths ATM BAtch:e5d9b934:5 | Complete Practice (ATM) Batch:e5d9b9ad:5 | Average To Master (ATM) Full BATCH:83e43921:10
* arithmetic > mixture & alligation (7, unused 1) Class:978e438f:9 | MATHS ( LIVE + VOD ):63540cd6:0 | Maths Classes:f7313446:17 | Maths ATM BAtch:e5d9b935:2 | Complete Practice (ATM) Batch:e5d9b9ae:2 | Average To Master (ATM) Full BATCH:83e43922:4 | RAILWAY MATHS FOUNDATION BATCH:e1e3c926:9
* arithmetic > number system (3, unused 0) Maths ATM BAtch:e5d9b936:9 | Complete Practice (ATM) Batch:e5d9b9af:9 | Average To Master (ATM) Full BATCH:83e43923:18
* arithmetic > partnership (8, unused 1) Maths:553964e9:11 | Class:978e4390:6 | MATHS ( LIVE + VOD ):63540cd7:0 | Maths Classes:f7313447:12 | Maths ATM BAtch:e5d9b937:2 | Complete Practice (ATM) Batch:e5d9b9b0:2 | Average To Master (ATM) Full BATCH:83e43924:4 | RAILWAY MATHS FOUNDATION BATCH:e1e3c927:6
* arithmetic > percentage (8, unused 1) Maths:a4ca3ee7:30 | Class:978e4391:16 | MATHS ( LIVE + VOD ):63540cd8:0 | Maths Classes:f7313448:32 | Maths ATM BAtch:e5d9b938:7 | Complete Practice (ATM) Batch:e5d9b9b1:7 | Average To Master (ATM) Full BATCH:83e43925:14 | RAILWAY MATHS FOUNDATION BATCH:e1e3c928:16
* arithmetic > pipe & cistern (8, unused 1) Maths:3402ea82:8 | Class:978e4392:8 | MATHS ( LIVE + VOD ):63540cd9:0 | Maths Classes:f7313449:16 | Complete Practice (ATM) Batch:e5d9b9b2:4 | Maths ATM BAtch:e5d9b939:4 | Average To Master (ATM) Full BATCH:83e43926:8 | RAILWAY MATHS FOUNDATION BATCH:e1e3c929:8
* arithmetic > profit & loss (7, unused 1) Class:978e4393:14 | MATHS ( LIVE + VOD ):63540cda:0 | Maths Classes:f731344a:28 | Complete Practice (ATM) Batch:e5d9b9b3:9 | Maths ATM BAtch:e5d9b93a:9 | Average To Master (ATM) Full BATCH:83e43927:18 | RAILWAY MATHS FOUNDATION BATCH:e1e3c92a:14
* arithmetic > race (8, unused 1) Maths:48abda7a:7 | Class:978e4394:6 | MATHS ( LIVE + VOD ):63540cdb:0 | Maths Classes:f731344b:12 | Maths ATM BAtch:e5d9b93b:4 | Complete Practice (ATM) Batch:e5d9b9b4:4 | Average To Master (ATM) Full BATCH:83e43928:8 | RAILWAY MATHS FOUNDATION BATCH:e1e3c92b:6
* arithmetic > ratio & proportion (5, unused 1) Maths:28ce9369:25 | Class:978e4395:13 | MATHS ( LIVE + VOD ):63540cdc:0 | Maths Classes:f731344c:26 | RAILWAY MATHS FOUNDATION BATCH:e1e3c92c:13
* arithmetic > ratio proportion (3, unused 0) Maths ATM BAtch:e5d9b93c:9 | Complete Practice (ATM) Batch:e5d9b9b5:9 | Average To Master (ATM) Full BATCH:83e43929:18
* arithmetic > simple & compound interest (4, unused 1) Class:978e4396:21 | MATHS ( LIVE + VOD ):63540cdd:0 | Maths Classes:f731344d:41 | RAILWAY MATHS FOUNDATION BATCH:e1e3c92d:21
* arithmetic > simple interest (3, unused 0) Maths ATM BAtch:e5d9b93d:7 | Complete Practice (ATM) Batch:e5d9b9b6:7 | Average To Master (ATM) Full BATCH:83e4392a:14
* arithmetic > simplification (7, unused 1) Class:978e4397:14 | MATHS ( LIVE + VOD ):63540cde:0 | Maths Classes:f731344e:28 | Complete Practice (ATM) Batch:e5d9b9b7:12 | Maths ATM BAtch:e5d9b93e:12 | Average To Master (ATM) Full BATCH:83e4392b:24 | RAILWAY MATHS FOUNDATION BATCH:e1e3c92e:12
* arithmetic > time & work (8, unused 1) Maths:55e9125d:24 | Class:978e4398:15 | MATHS ( LIVE + VOD ):63540cdf:0 | Maths Classes:f731344f:29 | Complete Practice (ATM) Batch:e5d9b9b8:6 | Maths ATM BAtch:e5d9b93f:6 | Average To Master (ATM) Full BATCH:83e4392c:12 | RAILWAY MATHS FOUNDATION BATCH:e1e3c92f:15
* arithmetic > time , speed & distance (3, unused 0) Maths ATM BAtch:e5d9b940:10 | Complete Practice (ATM) Batch:e5d9b9b9:10 | Average To Master (ATM) Full BATCH:83e4392d:20
* arithmetic > time,speed & distance (4, unused 1) Class:978e4399:20 | MATHS ( LIVE + VOD ):63540ce0:0 | Maths Classes:f7313450:39 | RAILWAY MATHS FOUNDATION BATCH:e1e3c930:20
* arithmetic > train (8, unused 1) Maths:a3d7610c:8 | Class:978e439a:13 | MATHS ( LIVE + VOD ):63540ce1:0 | Maths Classes:f7313451:26 | Maths ATM BAtch:e5d9b941:4 | Complete Practice (ATM) Batch:e5d9b9ba:4 | Average To Master (ATM) Full BATCH:83e4392e:8 | RAILWAY MATHS FOUNDATION BATCH:e1e3c931:13
* arithmetic > venn diagram (4, unused 1) Class:978e439b:2 | MATHS ( LIVE + VOD ):63540ce2:0 | Maths Classes:f7313452:4 | RAILWAY MATHS FOUNDATION BATCH:e1e3c932:2
* biological classification > kingdom protista (2, unused 2) Biology:f3a21eea:0 | Biology:f3a21eeb:0
* biology > blood circulatory system (2, unused 1) Science ATM Batch:e5d9b948:0 | Average To Master (ATM) Full BATCH:83e4392f:9
* biology > botany (2, unused 1) Science ATM Batch:e5d9b949:0 | Average To Master (ATM) Full BATCH:83e43930:11
* biology > digestive system (पाचन तंत्र) (2, unused 1) Science ATM Batch:e5d9b94a:0 | Average To Master (ATM) Full BATCH:83e43931:6
* biology > excretory  system (2, unused 1) Science ATM Batch:e5d9b94b:0 | Average To Master (ATM) Full BATCH:83e43932:8
* biology > harmones (2, unused 1) Science ATM Batch:e5d9b94c:0 | Average To Master (ATM) Full BATCH:83e43933:8
* biology > nervous system (2, unused 1) Science ATM Batch:e5d9b94e:0 | Average To Master (ATM) Full BATCH:83e43934:16
* biology > reproduction (2, unused 1) Science ATM Batch:e5d9b950:0 | Average To Master (ATM) Full BATCH:83e43935:8
* biology > respiratory system (2, unused 1) Science ATM Batch:e5d9b951:0 | Average To Master (ATM) Full BATCH:83e43936:6
* biology > skeleton system (2, unused 1) Science ATM Batch:e5d9b952:0 | Average To Master (ATM) Full BATCH:83e43937:4
* biomolecules > miscellaneous (2, unused 2) Biology:f3a21f50:0 | Biology:f3a21f51:0
* chemical coordination and integration > miscellaneous (2, unused 2) Biology:f3a21ff4:0 | Biology:f3a22001:0
* chemistry > acid base (3, unused 2) Complete Practice (ATM) Batch:e5d9b8e6:0 | Science ATM Batch:e5d9b953:0 | Average To Master (ATM) Full BATCH:83e43938:10
* chemistry > atomic structure (परमाणु संरचना) (3, unused 2) Complete Practice (ATM) Batch:e5d9b8e7:0 | Science ATM Batch:e5d9b954:0 | Average To Master (ATM) Full BATCH:83e43939:16
* chemistry > classes > acid base (2, unused 0) Science ATM Batch:2f090f9f:5 | Complete Practice (ATM) Batch:75b50545:5
* chemistry > classes > atomic structure (परमाणु संरचना) (2, unused 0) Science ATM Batch:2f090fa0:8 | Complete Practice (ATM) Batch:75b50546:8
* chemistry > classes > metals and non-metals (2, unused 0) Science ATM Batch:2f090fa1:8 | Complete Practice (ATM) Batch:75b50547:7
* chemistry > classes > organic chemistry (2, unused 0) Science ATM Batch:2f090fa2:6 | Complete Practice (ATM) Batch:75b50548:6
* chemistry > classes > periodic table (2, unused 0) Science ATM Batch:2f090fa3:6 | Complete Practice (ATM) Batch:75b50549:6
* chemistry > classes > state of matter (वस्तुस्थिति) (2, unused 0) Science ATM Batch:2f090fa4:8 | Complete Practice (ATM) Batch:75b5054a:8
* chemistry > metals and non-metals (3, unused 2) Complete Practice (ATM) Batch:e5d9b8e8:0 | Science ATM Batch:e5d9b955:0 | Average To Master (ATM) Full BATCH:83e4393a:16
* chemistry > organic chemistry (3, unused 2) Complete Practice (ATM) Batch:e5d9b8e9:0 | Science ATM Batch:e5d9b956:0 | Average To Master (ATM) Full BATCH:83e4393b:12
* chemistry > periodic table (3, unused 2) Science ATM Batch:e5d9b957:0 | Complete Practice (ATM) Batch:e5d9b8ea:0 | Average To Master (ATM) Full BATCH:83e4393c:12
* chemistry > state of matter (वस्तुस्थिति) (3, unused 2) Science ATM Batch:e5d9b958:0 | Complete Practice (ATM) Batch:e5d9b8eb:0 | Average To Master (ATM) Full BATCH:83e4393d:16
* data analysis & interpretation (di) > 1. basics of data interpretation (5, unused 1) Maths:054df645:20 | Maths Classes:29909fae:15 | 1. Analytical and Mathematical Capability:e5d9b96b:0 | Railway Maths Complete Foundation:e5d9b9da:5 | RAILWAY MATHS FOUNDATION BATCH:e1e3c933:5
* data analysis & interpretation (di) > 10. scatter plot di (2, unused 1) 1. Analytical and Mathematical Capability:e5d9b96c:0 | Maths:9a8563b1:9
* data analysis & interpretation (di) > 11. statistical curve distribution (2, unused 1) 1. Analytical and Mathematical Capability:e5d9b96d:0 | Maths:9a8563b2:6
* data analysis & interpretation (di) > 2. table di (5, unused 1) Maths:054df647:52 | Maths Classes:29909faf:39 | 1. Analytical and Mathematical Capability:e5d9b96e:0 | Railway Maths Complete Foundation:e5d9b9db:13 | RAILWAY MATHS FOUNDATION BATCH:e1e3c934:13
* data analysis & interpretation (di) > 3. bar graph di (5, unused 1) Maths:054df648:28 | Maths Classes:29909fb0:21 | 1. Analytical and Mathematical Capability:e5d9b96f:0 | Railway Maths Complete Foundation:e5d9b9dc:7 | RAILWAY MATHS FOUNDATION BATCH:e1e3c935:7
* data analysis & interpretation (di) > 4. line graph di (5, unused 1) Maths:054df649:12 | Maths Classes:29909fb1:9 | 1. Analytical and Mathematical Capability:e5d9b970:0 | Railway Maths Complete Foundation:e5d9b9dd:3 | RAILWAY MATHS FOUNDATION BATCH:e1e3c936:3
* data analysis & interpretation (di) > 5. pie chart di (5, unused 1) Maths:054df64a:24 | Maths Classes:29909fb2:18 | 1. Analytical and Mathematical Capability:e5d9b971:0 | Railway Maths Complete Foundation:e5d9b9de:6 | RAILWAY MATHS FOUNDATION BATCH:e1e3c937:6
* data analysis & interpretation (di) > 6. mix di (5, unused 1) Maths:054df64b:12 | Maths Classes:29909fb3:9 | 1. Analytical and Mathematical Capability:e5d9b972:0 | Railway Maths Complete Foundation:e5d9b9df:3 | RAILWAY MATHS FOUNDATION BATCH:e1e3c938:3
* data analysis & interpretation (di) > 7. caselets di (5, unused 1) Maths:054df64c:12 | Maths Classes:29909fb4:9 | 1. Analytical and Mathematical Capability:e5d9b973:0 | Railway Maths Complete Foundation:e5d9b9e0:3 | RAILWAY MATHS FOUNDATION BATCH:e1e3c939:3
* data analysis & interpretation (di) > 8. venn diagram (5, unused 1) Maths:054df64d:16 | Maths Classes:29909fb5:12 | 1. Analytical and Mathematical Capability:e5d9b974:0 | Railway Maths Complete Foundation:e5d9b9e1:4 | RAILWAY MATHS FOUNDATION BATCH:e1e3c93a:4
* data analysis & interpretation (di) > 9. topic wise di (5, unused 1) Maths:054df64e:8 | Maths Classes:29909fb6:6 | Railway Maths Complete Foundation:e5d9b9e2:2 | 1. Analytical and Mathematical Capability:e5d9b975:0 | RAILWAY MATHS FOUNDATION BATCH:e1e3c93b:2
* engineering drawing > drawing instruments (2, unused 0) BASIC SCIENCE & ENG DRAWING PRACTICE:04e5ea4e:8 | Basic Science & Engineering Drawing:b485b7f5:4
* engineering drawing > geometric figures for engineering drawing (2, unused 0) BASIC SCIENCE & ENG DRAWING PRACTICE:04e5ea4f:6 | Basic Science & Engineering Drawing:b485b7f6:3
* engineering drawing > lines  engineering drawing (2, unused 0) BASIC SCIENCE & ENG DRAWING PRACTICE:04e5ea50:6 | Basic Science & Engineering Drawing:b485b7f7:3
* engineering drawing > projection plane (2, unused 0) BASIC SCIENCE & ENG DRAWING PRACTICE:04e5ea51:10 | Basic Science & Engineering Drawing:b485b7f8:5
* engineering drawing > symbolic representation | (2, unused 0) BASIC SCIENCE & ENG DRAWING PRACTICE:04e5ea52:4 | Basic Science & Engineering Drawing:b485b7f9:2
* environment -पर्यावरण > biosphere (2, unused 0) BASIC SCIENCE & ENG DRAWING PRACTICE:04e5ea53:10 | Railway Gk Foundation Batch:b485b81e:5
* environment -पर्यावरण > ecology (2, unused 0) BASIC SCIENCE & ENG DRAWING PRACTICE:04e5ea54:10 | Railway Gk Foundation Batch:b485b81f:5
* environment -पर्यावरण > food chain (2, unused 0) BASIC SCIENCE & ENG DRAWING PRACTICE:04e5ea55:4 | Railway Gk Foundation Batch:b485b820:2
* environment -पर्यावरण > forest and wild life conservation (2, unused 0) BASIC SCIENCE & ENG DRAWING PRACTICE:04e5ea56:18 | Railway Gk Foundation Batch:b485b821:9
* environment -पर्यावरण > lakes and ramsaar sites (2, unused 0) BASIC SCIENCE & ENG DRAWING PRACTICE:04e5ea57:2 | Railway Gk Foundation Batch:b485b822:1
* environment -पर्यावरण > pollution (2, unused 0) BASIC SCIENCE & ENG DRAWING PRACTICE:04e5ea58:16 | Railway Gk Foundation Batch:b485b823:8
* environment > biosphere (3, unused 1) GENERAL AWARENESS:63540cac:0 | Railway Science Complete Foundation:e5d9b918:5 | Gk Classes:83e4399b:5
* environment > ecology (3, unused 1) GENERAL AWARENESS:63540cad:0 | Railway Science Complete Foundation:e5d9b91a:5 | Gk Classes:83e4399c:5
* environment > food chain (2, unused 1) GENERAL AWARENESS:63540cae:0 | Gk Classes:83e4399d:2
* environment > forest and wild life conservation (3, unused 0) GENERAL AWARENESS:63540caf:1 | Railway Science Complete Foundation:e5d9b91b:9 | Gk Classes:83e4399e:9
* environment > lakes and ramsaar sites (3, unused 1) GENERAL AWARENESS:63540cb0:0 | Railway Science Complete Foundation:e5d9b91c:1 | Gk Classes:83e4399f:1
* environment > pollution (3, unused 1) GENERAL AWARENESS:63540cb1:0 | Railway Science Complete Foundation:e5d9b91d:8 | Gk Classes:83e439a0:8
* environmental issues > people's participation in conservation of forests (2, unused 2) Biology:f3a21ede:0 | Biology:f3a21edf:0
* extra free content > railway exams 2024 topic wise questions (2, unused 0) MATH EXPECTED PAPER (ALP CBT-2):9d8d0f08:32 | Average To Master (ATM) Full BATCH:83e4393e:1
* extra free content > rrb alp 2024 all shifts paper solution (2, unused 1) MATH EXPECTED PAPER (ALP CBT-2):9d8d0f09:10 | Average To Master (ATM) Full BATCH:83e4393f:0
* extra free content > unique approach classes (2, unused 1) MATH EXPECTED PAPER (ALP CBT-2):9d8d0f0a:42 | Average To Master (ATM) Full BATCH:83e43940:0
* extra youtube content > di (7, unused 1) Maths:a3368fe5:5 | Maths:4f54a2a2:15 | 1. Analytical and Mathematical Capability:e5d9b977:5 | Maths ATM BAtch:e5d9b942:5 | Maths Classes:83e439bb:5 | RAILWAY MATHS FOUNDATION BATCH:b485b840:5 | Average To Master (ATM) Full BATCH:e1e3c907:0
* extra youtube content > exams latest questions (7, unused 1) Maths:ae03442e:15 | Maths:4f54a2a3:45 | 1. Analytical and Mathematical Capability:e5d9b978:15 | Maths ATM BAtch:e5d9b943:15 | Maths Classes:83e439bc:15 | RAILWAY MATHS FOUNDATION BATCH:b485b841:15 | Average To Master (ATM) Full BATCH:e1e3c908:0
* extra youtube content > exams top questions (7, unused 0) Maths:c2a83c5e:44 | Maths:4f54a2a4:132 | Maths ATM BAtch:e5d9b944:44 | 1. Analytical and Mathematical Capability:e5d9b979:44 | Maths Classes:83e439bd:22 | RAILWAY MATHS FOUNDATION BATCH:b485b842:35 | Average To Master (ATM) Full BATCH:e1e3c909:9
* extra youtube content > short videos (7, unused 1) Maths:0fecb520:2 | Maths:4f54a2a5:6 | Maths ATM BAtch:e5d9b945:2 | 1. Analytical and Mathematical Capability:e5d9b97a:2 | Maths Classes:83e439be:2 | RAILWAY MATHS FOUNDATION BATCH:b485b843:2 | Average To Master (ATM) Full BATCH:e1e3c90a:0
* extra youtube content > unique approach classes (7, unused 2) Maths:a8c79e7a:21 | Maths:4f54a2a6:63 | Maths ATM BAtch:e5d9b946:21 | 1. Analytical and Mathematical Capability:e5d9b97b:21 | Maths Classes:83e439bf:0 | RAILWAY MATHS FOUNDATION BATCH:b485b844:21 | Average To Master (ATM) Full BATCH:e1e3c90b:0
* geometry > circle (7, unused 3) Quantitative Aptitude:f3a21dd6:0 | ADVANCE:06e3bfbb:34 | Maths:edda95b6:17 | 1. Analytical and Mathematical Capability:e5d9b97c:0 | Railway Maths Complete Foundation:e5d9b9e3:0 | Maths Classes:83e439c0:17 | RAILWAY MATHS FOUNDATION BATCH:e1e3c93c:17
* geometry > line & angles (6, unused 2) ADVANCE:06e3bfbc:10 | Maths:edda95b7:5 | Railway Maths Complete Foundation:e5d9b9e4:0 | 1. Analytical and Mathematical Capability:e5d9b97e:0 | Maths Classes:83e439c1:5 | RAILWAY MATHS FOUNDATION BATCH:e1e3c93d:5
* geometry > quadrilateral (6, unused 2) ADVANCE:06e3bfbd:22 | Maths:edda95b8:11 | 1. Analytical and Mathematical Capability:e5d9b97f:0 | Railway Maths Complete Foundation:e5d9b9e5:0 | Maths Classes:83e439c2:11 | RAILWAY MATHS FOUNDATION BATCH:e1e3c93e:11
* geometry > triangle (7, unused 3) Quantitative Aptitude:f3a21dd5:0 | ADVANCE:06e3bfbe:54 | Maths:edda95b9:27 | Railway Maths Complete Foundation:e5d9b9e6:0 | 1. Analytical and Mathematical Capability:e5d9b980:0 | Maths Classes:83e439c3:27 | RAILWAY MATHS FOUNDATION BATCH:e1e3c93f:26
* history > ancient history (3, unused 0) GK/GS:a0186448:170 | GK + GS:61ec4a06:3 | Railway GK/GS Complete Foundation:e25bd926:24
* history > medieval indian history (2, unused 1) RRB  GENERAL AWARENESS FOUNDATION BATCH (CBT 1 & CBT 2):b485b898:0 | Railway GK/GS Complete Foundation:7bf8c1f7:44
* history > modern indian history (2, unused 0) RRB  GENERAL AWARENESS FOUNDATION BATCH (CBT 1 & CBT 2):b485b899:1 | Railway GK/GS Complete Foundation:62b71084:44
* history by bhawani sir > medieval indian history (2, unused 0) GENERAL AWARENESS:63540cb7:5 | Gk Classes:83e439a1:38
* history by bhawani sir > modern indian history (2, unused 0) GENERAL AWARENESS:63540cb8:1 | Gk Classes:83e439a2:42
* history by bhawani sir > static gk (2, unused 0) GENERAL AWARENESS:63540cb9:4 | Gk Classes:83e439a3:98
* human reproduction > introduction (2, unused 2) Biology:f3a21df3:0 | Biology:f3a21df2:0
* indian geography > agriculture (2, unused 1) GENERAL AWARENESS:63540cbc:0 | Gk Classes:83e439a6:2
* indian geography > indian island + gulf  - भारतीय द्वीप + खाड़ी (2, unused 1) GENERAL AWARENESS:63540cbd:0 | Gk Classes:83e439a7:4
* indian geography > indian monsoon (2, unused 1) GENERAL AWARENESS:63540cbe:0 | Gk Classes:83e439a8:4
* indian geography > introduction (2, unused 1) GENERAL AWARENESS:63540cbf:0 | Gk Classes:83e439a9:4
* indian geography > minerals in india (2, unused 1) GENERAL AWARENESS:63540cc0:0 | Gk Classes:83e439aa:5
* indian geography > national parks (2, unused 1) GENERAL AWARENESS:63540cc1:0 | Gk Classes:83e439ab:4
* indian geography > rivers in india (2, unused 1) GENERAL AWARENESS:63540cc2:0 | Gk Classes:83e439ac:7
* indian geography > soil in india (2, unused 1) GENERAL AWARENESS:63540cc3:0 | Gk Classes:83e439ad:4
* indian geography > transportation in india (2, unused 1) GENERAL AWARENESS:63540cc4:0 | Gk Classes:83e439ae:4
* indian geography > प्रायद्वीपीय पठार (peninsular plateau) (2, unused 1) GENERAL AWARENESS:63540cba:0 | Gk Classes:83e439a4:4
* indian geography > 🔴 himalaya (2, unused 1) GENERAL AWARENESS:63540cbb:0 | Gk Classes:83e439a5:5
* machine input output > machine input output (4, unused 1) REASONING EXPECTED PAPER ( ALP CBT - 2 ):29b50f33:14 | Complete Practice (ATM) Batch:4d624dfd:7 | Reasoning ATM Batch:e5d9b947:7 | Average To Master (ATM) Full BATCH:83e43941:0
* mathematical inequality > coded inequality (2, unused 2) Logical Reasoning:f3a2202c:0 | Logical Reasoning:f3a2202d:0
* ms office > ms excel (2, unused 0) Computer Foundation Batch:b1414b58:20 | Computer:054df633:21
* ms office > ms power point (2, unused 0) Computer Foundation Batch:b1414b59:6 | Computer:054df634:6
* ms office > ms word (2, unused 0) Computer Foundation Batch:b1414b5a:20 | Computer:054df635:23
* number system > number system (2, unused 1) Maths:997d6470:42 | Quantitative Aptitude:f3e4afd8:0
* physics > classes > electricity (2, unused 0) Science ATM Batch:2f090fa5:9 | Complete Practice (ATM) Batch:75b5054b:9
* physics > classes > pressure (2, unused 0) Science ATM Batch:2f090fa9:5 | Complete Practice (ATM) Batch:75b5054f:5
* physics > electricity (3, unused 2) Complete Practice (ATM) Batch:e5d9b8ec:0 | Science ATM Batch:e5d9b959:0 | Average To Master (ATM) Full BATCH:83e43944:18
* physics > gravitation (2, unused 1) Complete Practice (ATM) Batch:e5d9b8ed:0 | Average To Master (ATM) Full BATCH:83e43945:3
* physics > gravitation - गुरुत्वाकर्षण (2, unused 1) Science ATM Batch:e5d9b95a:0 | Average To Master (ATM) Full BATCH:e1e3c90c:3
* physics > heat and temperature  / thermodynamics -  ऊष्मा एवं तापमान / ऊष्मप्रवैगिकी (2, unused 1) Science ATM Batch:e5d9b95b:0 | Average To Master (ATM) Full BATCH:e1e3c90d:2
* physics > heat and temperature (2, unused 1) Complete Practice (ATM) Batch:e5d9b8ee:0 | Average To Master (ATM) Full BATCH:83e43946:2
* physics > light & optics  प्रकाश एवं प्रकाशिकी (2, unused 1) Science ATM Batch:e5d9b95c:0 | Average To Master (ATM) Full BATCH:e1e3c90e:7
* physics > light (2, unused 1) Complete Practice (ATM) Batch:e5d9b8ef:0 | Average To Master (ATM) Full BATCH:83e43947:7
* physics > pressure (3, unused 2) Science ATM Batch:e5d9b95d:0 | Complete Practice (ATM) Batch:e5d9b8f0:0 | Average To Master (ATM) Full BATCH:83e43948:10
* physics > sound and wave (2, unused 1) Complete Practice (ATM) Batch:e5d9b8f1:0 | Average To Master (ATM) Full BATCH:83e43949:6
* physics > sound and wave - ध्वनि और तरंग (2, unused 1) Science ATM Batch:e5d9b95e:0 | Average To Master (ATM) Full BATCH:e1e3c90f:6
* physics > unit and dimension (2, unused 1) Complete Practice (ATM) Batch:e5d9b8f2:0 | Average To Master (ATM) Full BATCH:83e4394a:12
* physics > unit and measurement / mechanics / force - इकाई और माप / यांत्रिकी / बल (2, unused 1) Science ATM Batch:e5d9b95f:0 | Average To Master (ATM) Full BATCH:e1e3c910:10
* physics > work-power-energy (2, unused 1) Complete Practice (ATM) Batch:e5d9b8f3:0 | Average To Master (ATM) Full BATCH:83e4394b:2
* physics > work-power-energy - कार्य-शक्ति-ऊर्जा (2, unused 1) Science ATM Batch:e5d9b960:0 | Average To Master (ATM) Full BATCH:e1e3c911:2
* polity > samvidhan sabha (संविधान सभा) (2, unused 1) GENERAL AWARENESS:63540ccf:0 | Gk Classes:83e439b9:4
* polity > भाग 1 - संघ और राज्य क्षेत्र - union and state territories (2, unused 1) GENERAL AWARENESS:63540cc5:0 | Gk Classes:83e439af:3
* polity > भाग 2 नागरिकता.. नागरिकता || bhag 2 nagrikta .. citizenship (2, unused 1) GENERAL AWARENESS:63540cc6:0 | Gk Classes:83e439b0:4
* polity > भाग 3-मौलिक अधिकार (2, unused 1) GENERAL AWARENESS:63540cc7:0 | Gk Classes:83e439b1:13
* polity > भाग 4-राज्य के नीति निदेशक सिद्धांत (dpsp ) (2, unused 1) GENERAL AWARENESS:63540cc8:0 | Gk Classes:83e439b2:1
* polity > भाग 5-the union (2, unused 1) GENERAL AWARENESS:63540cc9:0 | Gk Classes:83e439b3:22
* polity > भारत में वरीयता क्रम (order of precedence in india) +  भारतीय संविधान के स्रोत (sources of indian constitution) (2, unused 1) GENERAL AWARENESS:63540ccb:0 | Gk Classes:83e439b5:1
* polity > भारतीय संविधान की अनुसूचियाँ (schedules of indian constitution) (2, unused 1) GENERAL AWARENESS:63540ccc:0 | Gk Classes:83e439b6:2
* polity > भारतीय संविधान की प्रस्तावना | preamble of indian constitution (2, unused 1) GENERAL AWARENESS:63540ccd:0 | Gk Classes:83e439b7:3
* polity > संवैधानिक आयोग (2, unused 1) GENERAL AWARENESS:63540cce:0 | Gk Classes:83e439b8:9
* reasoning classes > all exams expected mock (2, unused 0) Railway Reasoning Complete Foundation:4d624dfe:7 | RAILWAY REASONING FOUNDATION BATCH:b485b871:7
* reasoning classes > all exams pyps (2, unused 0) Railway Reasoning Complete Foundation:4d624dff:6 | RAILWAY REASONING FOUNDATION BATCH:b485b872:6
* reasoning classes > analogy (2, unused 0) Railway Reasoning Complete Foundation:4d624e00:5 | RAILWAY REASONING FOUNDATION BATCH:b485b873:5
* reasoning classes > blood relation (2, unused 0) Railway Reasoning Complete Foundation:4d624e01:10 | RAILWAY REASONING FOUNDATION BATCH:b485b874:10
* reasoning classes > calendar (2, unused 0) Railway Reasoning Complete Foundation:4d624e02:10 | RAILWAY REASONING FOUNDATION BATCH:b485b875:10
* reasoning classes > cause and effect (2, unused 0) Railway Reasoning Complete Foundation:4d624e03:3 | RAILWAY REASONING FOUNDATION BATCH:b485b876:3
* reasoning classes > classificaton (2, unused 0) Railway Reasoning Complete Foundation:4d624e04:4 | RAILWAY REASONING FOUNDATION BATCH:b485b877:4
* reasoning classes > clock (2, unused 0) Railway Reasoning Complete Foundation:4d624e05:8 | RAILWAY REASONING FOUNDATION BATCH:b485b878:8
* reasoning classes > coding decoding (2, unused 0) Railway Reasoning Complete Foundation:4d624e06:10 | RAILWAY REASONING FOUNDATION BATCH:b485b879:10
* reasoning classes > cube cutting (2, unused 0) Railway Reasoning Complete Foundation:4d624e07:4 | RAILWAY REASONING FOUNDATION BATCH:b485b87a:4
* reasoning classes > data sufficiency (2, unused 0) Railway Reasoning Complete Foundation:4d624e08:6 | RAILWAY REASONING FOUNDATION BATCH:b485b87b:6
* reasoning classes > decision making (2, unused 0) Railway Reasoning Complete Foundation:4d624e09:3 | RAILWAY REASONING FOUNDATION BATCH:b485b87c:3
* reasoning classes > dice (2, unused 0) Railway Reasoning Complete Foundation:4d624e0a:7 | RAILWAY REASONING FOUNDATION BATCH:b485b87d:7
* reasoning classes > direction and distance (2, unused 0) Railway Reasoning Complete Foundation:4d624e0b:5 | RAILWAY REASONING FOUNDATION BATCH:b485b87e:5
* reasoning classes > doubt clearing and e-book solution (2, unused 0) Railway Reasoning Complete Foundation:4d624e0c:2 | RAILWAY REASONING FOUNDATION BATCH:b485b87f:2
* reasoning classes > figure counting (2, unused 0) Railway Reasoning Complete Foundation:4d624e0d:8 | RAILWAY REASONING FOUNDATION BATCH:b485b880:8
* reasoning classes > inequality (2, unused 0) Railway Reasoning Complete Foundation:4d624e0e:5 | RAILWAY REASONING FOUNDATION BATCH:b485b881:5
* reasoning classes > machine input output (2, unused 1) Railway Reasoning Complete Foundation:4d624e0f:0 | RAILWAY REASONING FOUNDATION BATCH:b485b882:7
* reasoning classes > mathematical operator (2, unused 0) Railway Reasoning Complete Foundation:4d624e10:2 | RAILWAY REASONING FOUNDATION BATCH:b485b883:2
* reasoning classes > matrix (2, unused 0) Railway Reasoning Complete Foundation:4d624e11:2 | RAILWAY REASONING FOUNDATION BATCH:b485b884:2
* reasoning classes > mirror and water image (2, unused 0) Railway Reasoning Complete Foundation:4d624e12:4 | RAILWAY REASONING FOUNDATION BATCH:b485b885:4
* reasoning classes > miscellaneous (2, unused 0) Railway Reasoning Complete Foundation:4d624e13:5 | RAILWAY REASONING FOUNDATION BATCH:b485b886:5
* reasoning classes > missing number (2, unused 0) Railway Reasoning Complete Foundation:4d624e15:6 | RAILWAY REASONING FOUNDATION BATCH:b485b887:6
* reasoning classes > non verbal (2, unused 0) Railway Reasoning Complete Foundation:4d624e16:3 | RAILWAY REASONING FOUNDATION BATCH:b485b888:3
* reasoning classes > number series (2, unused 0) Railway Reasoning Complete Foundation:4d624e17:3 | RAILWAY REASONING FOUNDATION BATCH:b485b889:3
* reasoning classes > order and ranking (2, unused 0) Railway Reasoning Complete Foundation:4d624e18:8 | RAILWAY REASONING FOUNDATION BATCH:b485b88a:8
* reasoning classes > paper folding and cutting (2, unused 0) Railway Reasoning Complete Foundation:4d624e19:3 | RAILWAY REASONING FOUNDATION BATCH:b485b88b:3
* reasoning classes > puzzle (2, unused 0) Railway Reasoning Complete Foundation:4d624e1a:5 | RAILWAY REASONING FOUNDATION BATCH:b485b88c:5
* reasoning classes > rapid fire session (2, unused 0) Railway Reasoning Complete Foundation:4d624e1b:14 | RAILWAY REASONING FOUNDATION BATCH:b485b88d:14
* reasoning classes > sitting arrangement (2, unused 0) Railway Reasoning Complete Foundation:4d624e1c:12 | RAILWAY REASONING FOUNDATION BATCH:b485b88f:12
* reasoning classes > ssc cgl / chsl mains preparation (2, unused 0) Railway Reasoning Complete Foundation:4d624e1d:14 | RAILWAY REASONING FOUNDATION BATCH:b485b890:14
* reasoning classes > statement and action (2, unused 0) Railway Reasoning Complete Foundation:4d624e1e:1 | RAILWAY REASONING FOUNDATION BATCH:b485b891:1
* reasoning classes > statement and ancillary  ( logical sequence of statement (2, unused 0) Railway Reasoning Complete Foundation:4d624e1f:1 | RAILWAY REASONING FOUNDATION BATCH:b485b892:1
* reasoning classes > statement and argument (2, unused 0) Railway Reasoning Complete Foundation:4d624e20:3 | RAILWAY REASONING FOUNDATION BATCH:b485b893:3
* reasoning classes > statement and assumption (2, unused 0) Railway Reasoning Complete Foundation:4d624e21:4 | RAILWAY REASONING FOUNDATION BATCH:b485b894:4
* reasoning classes > statement and conclusion (2, unused 0) Railway Reasoning Complete Foundation:4d624e22:3 | RAILWAY REASONING FOUNDATION BATCH:b485b895:3
* reasoning classes > syllogism (2, unused 0) Railway Reasoning Complete Foundation:4d624e23:9 | RAILWAY REASONING FOUNDATION BATCH:b485b896:11
* reasoning classes > venn diagram (2, unused 0) Railway Reasoning Complete Foundation:4d624e24:3 | RAILWAY REASONING FOUNDATION BATCH:b485b897:3
* seating arrangement > multiple row arrangement (2, unused 2) Logical Reasoning:f3a22061:0 | Logical Reasoning:f3a220ae:0
* world geography > continents (महाद्वीप) (2, unused 1) GENERAL AWARENESS:63540cd0:0 | Gk Classes:83e439ba:4
* जीव विज्ञान -biology > animal kingdom (जन्तु जगत ) (4, unused 1) GENERAL AWARENESS:63540c91:0 | Railway Science Complete Foundation:e5d9b8fd:9 | General Science:83e43980:9 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b803:9
* जीव विज्ञान -biology > cell (कोशिका) (4, unused 1) GENERAL AWARENESS:63540c92:0 | Railway Science Complete Foundation:e5d9b8fe:14 | General Science:83e43981:15 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b804:14
* जीव विज्ञान -biology > digestive system (पाचन तंत्र) (5, unused 2) GENERAL AWARENESS:63540c93:0 | Railway Science Complete Foundation:e5d9b8ff:5 | Complete Practice (ATM) Batch:e5d9b8df:0 | General Science:83e43982:5 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b805:5
* जीव विज्ञान -biology > plant (पादप) (4, unused 1) GENERAL AWARENESS:63540c94:0 | Railway Science Complete Foundation:e5d9b900:23 | General Science:83e43983:23 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b806:23
* जीव विज्ञान -biology > practice classes (4, unused 1) GENERAL AWARENESS:63540c95:0 | Railway Science Complete Foundation:e5d9b901:38 | General Science:83e43984:36 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b807:38
* जीव विज्ञान -biology > अंतःस्रावी तंत्र (endocrine system) (4, unused 1) GENERAL AWARENESS:63540c88:0 | Railway Science Complete Foundation:e5d9b8f4:9 | General Science:83e43977:9 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b7fa:9
* जीव विज्ञान -biology > उत्सर्जन तन्त्र ( excretory system ) (4, unused 1) GENERAL AWARENESS:63540c89:0 | Railway Science Complete Foundation:e5d9b8f5:4 | General Science:83e43978:4 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b7fb:4
* जीव विज्ञान -biology > कंकाल तंत्र (skeleton system) (4, unused 1) GENERAL AWARENESS:63540c8a:0 | Railway Science Complete Foundation:e5d9b8f6:5 | General Science:83e43979:3 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b7fc:5
* जीव विज्ञान -biology > तंत्रिका तंत्र | nervous system (4, unused 1) GENERAL AWARENESS:63540c8b:0 | Railway Science Complete Foundation:e5d9b8f7:8 | General Science:83e4397a:8 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b7fd:8
* जीव विज्ञान -biology > पोषक पदार्थ ( nutrients ) (4, unused 1) GENERAL AWARENESS:63540c8c:0 | Railway Science Complete Foundation:e5d9b8f8:5 | General Science:83e4397b:5 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b7fe:5
* जीव विज्ञान -biology > प्रजनन तंत्र (reproductive system) (4, unused 1) GENERAL AWARENESS:63540c8d:0 | Railway Science Complete Foundation:e5d9b8f9:11 | General Science:83e4397c:11 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b7ff:11
* जीव विज्ञान -biology > मानव रोग | human diseases (4, unused 0) GENERAL AWARENESS:63540c8e:1 | Railway Science Complete Foundation:e5d9b8fa:8 | General Science:83e4397d:3 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b800:8
* जीव विज्ञान -biology > रक्त परिसंचरण तंत्र (circulatory system) (4, unused 1) GENERAL AWARENESS:63540c8f:0 | Railway Science Complete Foundation:e5d9b8fb:8 | General Science:83e4397e:8 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b801:9
* जीव विज्ञान -biology > श्वसन तंत्र | respiratory system (4, unused 1) GENERAL AWARENESS:63540c90:0 | Railway Science Complete Foundation:e5d9b8fc:6 | General Science:83e4397f:6 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b802:6
* भौतिक विज्ञान ( phyiscs) > electricity (बिजली) (2, unused 1) GENERAL AWARENESS:63540c98:0 | General Science:83e43987:12
* भौतिक विज्ञान ( phyiscs) > gravitation (गुरुत्वाकर्षण) (2, unused 1) GENERAL AWARENESS:63540c99:0 | General Science:83e43988:6
* भौतिक विज्ञान ( phyiscs) > heat (ऊष्मा/गर्मी) (2, unused 1) GENERAL AWARENESS:63540c9a:0 | General Science:83e43989:5
* भौतिक विज्ञान ( phyiscs) > magnet (चुंबक) (2, unused 1) GENERAL AWARENESS:63540c9b:0 | General Science:83e4398a:4
* भौतिक विज्ञान ( phyiscs) > newton's laws of motion (न्यूटन के गति के नियम) (2, unused 1) GENERAL AWARENESS:63540c9c:0 | General Science:83e4398b:3
* भौतिक विज्ञान ( phyiscs) > optics light  (प्रकाशिकी ) (2, unused 0) GENERAL AWARENESS:63540c9d:1 | General Science:83e4398c:17
* भौतिक विज्ञान ( phyiscs) > pressure (दबाव) (2, unused 1) GENERAL AWARENESS:63540c9e:0 | General Science:83e4398d:7
* भौतिक विज्ञान ( phyiscs) > sound (ध्वनि) (2, unused 1) GENERAL AWARENESS:63540c9f:0 | General Science:83e4398e:6
* भौतिक विज्ञान ( phyiscs) > thermodynamics (ऊष्मप्रवैगिकी) (2, unused 1) GENERAL AWARENESS:63540ca0:0 | General Science:83e4398f:5
* भौतिक विज्ञान ( phyiscs) > work power and energy (कार्य शक्ति और ऊर्जा) (2, unused 1) GENERAL AWARENESS:63540ca1:0 | General Science:83e43990:3
* भौतिक विज्ञान ( phyiscs) > मात्रक एवं मापन | units and measurement (2, unused 1) GENERAL AWARENESS:63540c96:0 | General Science:83e43985:2
* भौतिक विज्ञान ( phyiscs) > यांत्रिकी (mechanics) (2, unused 1) GENERAL AWARENESS:63540c97:0 | General Science:83e43986:5
* भौतिक विज्ञान ( physics) > electricity (बिजली) (2, unused 0) Railway Science Complete Foundation:e5d9b904:12 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b80a:7
* भौतिक विज्ञान ( physics) > gravitation (गुरुत्वाकर्षण) (2, unused 0) Railway Science Complete Foundation:e5d9b905:7 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b80b:7
* भौतिक विज्ञान ( physics) > heat (ऊष्मा/गर्मी) (2, unused 1) Railway Science Complete Foundation:e5d9b906:5 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b80c:0
* भौतिक विज्ञान ( physics) > magnet (चुंबक) (2, unused 0) Railway Science Complete Foundation:e5d9b907:4 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b80d:4
* भौतिक विज्ञान ( physics) > newton's laws of motion (न्यूटन के गति के नियम) (2, unused 0) Railway Science Complete Foundation:e5d9b908:5 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b80e:5
* भौतिक विज्ञान ( physics) > optics light  (प्रकाशिकी ) (2, unused 0) Railway Science Complete Foundation:e5d9b909:17 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b80f:17
* भौतिक विज्ञान ( physics) > pressure (दबाव) (2, unused 0) Railway Science Complete Foundation:e5d9b90a:7 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b810:5
* भौतिक विज्ञान ( physics) > sound (ध्वनि) (2, unused 0) Railway Science Complete Foundation:e5d9b90b:6 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b811:6
* भौतिक विज्ञान ( physics) > thermodynamics (ऊष्मप्रवैगिकी) (2, unused 1) Railway Science Complete Foundation:e5d9b90c:5 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b812:0
* भौतिक विज्ञान ( physics) > work power and energy (कार्य शक्ति और ऊर्जा) (2, unused 0) Railway Science Complete Foundation:e5d9b90d:3 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b813:3
* भौतिक विज्ञान ( physics) > मात्रक एवं मापन | units and measurement (2, unused 1) Railway Science Complete Foundation:e5d9b902:6 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b808:0
* भौतिक विज्ञान ( physics) > यांत्रिकी (mechanics) (2, unused 0) Railway Science Complete Foundation:e5d9b903:13 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b809:6
* रसायन विज्ञान (chemistry) > acid base (अम्ल क्षार) (4, unused 1) GENERAL AWARENESS:63540ca2:0 | Railway Science Complete Foundation:e5d9b90e:8 | General Science:83e43991:8 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b814:8
* रसायन विज्ञान (chemistry) > atomic structure (परमाणु संरचना) (4, unused 1) GENERAL AWARENESS:63540ca3:0 | Railway Science Complete Foundation:e5d9b90f:12 | General Science:83e43992:12 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b815:12
* रसायन विज्ञान (chemistry) > carbon and its compound (कार्बन और उसके यौगिक) (4, unused 1) GENERAL AWARENESS:63540ca4:0 | Railway Science Complete Foundation:e5d9b910:5 | General Science:83e43993:5 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b816:5
* रसायन विज्ञान (chemistry) > chemical bond (रासायनिक बंध) (4, unused 1) GENERAL AWARENESS:63540ca5:0 | Railway Science Complete Foundation:e5d9b911:6 | General Science:83e43994:5 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b817:6
* रसायन विज्ञान (chemistry) > chemical reaction and equation (रासायनिक प्रतिक्रिया और समीकरण) (4, unused 1) GENERAL AWARENESS:63540ca6:0 | Railway Science Complete Foundation:e5d9b912:5 | General Science:83e43995:5 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b818:5
* रसायन विज्ञान (chemistry) > chemistry in daily life (दैनिक जीवन में रसायन विज्ञान) (2, unused 0) Railway Science Complete Foundation:e5d9b913:1 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b819:1
* रसायन विज्ञान (chemistry) > metal or non-metal(धातु या अधातु) (4, unused 1) GENERAL AWARENESS:63540ca7:0 | Railway Science Complete Foundation:e5d9b914:20 | General Science:83e43996:20 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b81a:20
* रसायन विज्ञान (chemistry) > organic chemistry (कार्बनिक रसायन विज्ञान) (4, unused 1) GENERAL AWARENESS:63540ca8:0 | Railway Science Complete Foundation:e5d9b915:17 | General Science:83e43997:17 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b81b:17
* रसायन विज्ञान (chemistry) > periodic table (आवर्त सारणी) (4, unused 1) GENERAL AWARENESS:63540ca9:0 | Railway Science Complete Foundation:e5d9b916:10 | General Science:83e43998:10 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b81c:10
* रसायन विज्ञान (chemistry) > state of matter (पदार्थ की अवस्थाएँ  ) (4, unused 1) GENERAL AWARENESS:63540caa:0 | Railway Science Complete Foundation:e5d9b917:13 | General Science:83e43999:13 | RAILWAY GENERAL SCIENCE  FOUNDATION BATCH:b485b81d:13
```
