import type { StoicTextMap } from './types';

export const zh: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: '本月超出了计划',
      message:
        '您计划花 {{plannedAmount}}，实际已花 {{spentAmount}}，多出 {{percent}}%。计划是在头脑清醒时定下的，让它的声音盖过一时的冲动。',
    },
    {
      title: '比打算多花了 {{percent}}%',
      message:
        '支出已达 {{spentAmount}}，而计划是 {{plannedAmount}}。看看哪个限度最先失守——教训就在那里。',
    },
    {
      title: '计划与这个月意见不合',
      message:
        '已花 {{spentAmount}}，原打算 {{plannedAmount}}。要么计划对现实要求太少，要么现实对您要求太多——冷静地判断是哪一种。',
    },
    {
      title: '花出去的比您允许的多',
      message:
        '本月比您设定的 {{plannedAmount}} 超出了 {{percent}}%。现在停下，什么也不会失去；假装没发生，失去的会很多。',
    },
    {
      title: '自己定的限度，自己越过了',
      message:
        '您本想花 {{plannedAmount}}，实际是 {{spentAmount}}。自制不是从不失足，而是及早察觉、回到正路。',
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: '休闲花得比计划多',
      message:
        '您计划让休闲占支出的 {{planned}}%，本月却达到了 {{actual}}%。快乐作为客人很好，但不该成为一家之主。',
    },
    {
      title: '休闲 {{actual}}%，计划 {{planned}}%',
      message: '休息若能让人恢复，便值得。问问这个月哪些享乐真正让您恢复了，其余的不必遗憾地放下。',
    },
    {
      title: '安逸正在超过意图',
      message:
        '休闲占支出的 {{actual}}%，而您选择的是 {{planned}}%。节制不是拒绝快乐，而是让快乐保持您决定的分量。',
    },
    {
      title: '舒适挤占了计划',
      message:
        '您给休闲的是计划的 {{planned}}%，它却拿走了 {{actual}}%。轻易就能享受的东西，在它变成必需之前值得再看一眼。',
    },
    {
      title: '休闲越过了界线',
      message: '本月 {{actual}}% 用于休闲，本意是 {{planned}}%。界线由您划定，也由您守住。',
    },
  ],
  'stoic.leisure_habit': [
    {
      title: '休闲再次超出计划',
      message:
        '在最近 {{window}} 个月中，休闲有 {{months}} 个月超出计划。重复就不再是偶然，而是值得审视的习惯。',
    },
    {
      title: '{{window}} 个月中有 {{months}} 个月休闲超计划',
      message: '发生一次是境遇；发生 {{months}} 次，就是正在成形的品性。请有意识地选择这种品性。',
    },
    {
      title: '同样的失误，一月又一月',
      message:
        '{{window}} 个月里有 {{months}} 个月休闲超出计划。要么诚实地提高计划，要么改变习惯——夹在两者之间代价最大。',
    },
    {
      title: '这是模式，不是偶然失误',
      message:
        '最近 {{window}} 个月中有 {{months}} 个月，休闲拿走的比您给的多。留意做决定的那一刻，而不只是事后的账单。',
    },
    {
      title: '习惯正在投票反对您的计划',
      message:
        '{{window}} 个月里休闲 {{months}} 次胜过计划。习惯是一次次选择建立起来的，改掉它也是如此。',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: '美德得到的比预想少',
      message:
        '您为健康、学习和他人预留了 {{planned}}% 的预算，目前只花了 {{actual}}%。意图只有付诸行动才算数。',
    },
    {
      title: '美德 {{actual}}%，计划 {{planned}}%',
      message: '您留给让自己变得更好的钱还在等着。要把它花好，没有比这个月更好的时候。',
    },
    {
      title: '您计划的善事还没花出去',
      message:
        '健康、学习和慷慨本应占支出的 {{planned}}%，实际只有 {{actual}}%。这周就有意识地做其中一件。',
    },
    {
      title: '有意图，无行动',
      message:
        '美德占支出的 {{actual}}%，而您选择的是 {{planned}}%。我们珍视什么，体现在我们真正为什么付钱。',
    },
    {
      title: '还有空间留给重要的事',
      message:
        '虽然计划了 {{planned}}%，美德只得到 {{actual}}%。一本书、一次体检、一份给需要之人的礼物——计划早已同意。',
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: '美德一再被推迟',
      message:
        '健康、学习和他人方面的支出已连续 {{months}} 个月低于计划。一直推迟的事，实际上您已经放弃了。',
    },
    {
      title: '推迟美德已 {{months}} 个月',
      message:
        '每个月计划都为让您变得更好的事留了位置，每个月它都没被用上。时间是唯一无法做两次预算的东西。',
    },
    {
      title: '更好的自己仍在等待',
      message: '美德已连续 {{months}} 个月低于计划。宁可从小而确定的开始，也不要宏大而遥远。',
    },
    {
      title: '好的意图正在变老',
      message:
        '{{months}} 个月来，健康、学习和慷慨得到的都少于计划。下个月挑一项，先于其他一切为它拨款。',
    },
    {
      title: '美德总是输给“以后”',
      message: '连续 {{months}} 个月低于计划。“以后”是好意图被遗忘的地方——给它定个日子。',
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: '您的计划里没有美德的位置',
      message:
        '您的预算中没有一项服务于健康、学习或他人。计划体现我们看重什么——考虑给美德单独设一项。',
    },
    {
      title: '样样有预算，唯独善事没有',
      message: '必需、工作和休闲都有限度，美德却没有。从不计划的事，往往永远不会发生。',
    },
    {
      title: '为让您变得更好的事做计划',
      message: '美德类别下还没有预算。哪怕很小——书、运动、一笔捐赠——也能把愿望变成承诺。',
    },
    {
      title: '计划对美德只字未提',
      message:
        '您为必须的和喜欢的做预算，却还没为想成为的人做预算。一个适度的美德预算就能改变这一点。',
    },
    {
      title: '美德没有预算',
      message: '健康、学习或他人方面的支出在任何地方都没有计划。挑一项，给它一个您乐于达到的限度。',
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: '必需开支超出计划',
      message:
        '您计划必需占支出的 {{planned}}%，实际占了 {{actual}}%。检查每一项是否仍是需要，还是已悄悄变成了享受。',
    },
    {
      title: '必需 {{actual}}%，计划 {{planned}}%',
      message: '生活真正需要的，通常少于我们习惯的。用新的眼光审视最大的那项必需开支。',
    },
    {
      title: '基本开支在膨胀',
      message:
        '必需占本月的 {{actual}}%，而您预期的是 {{planned}}%。一个不断增长的需要，值得问一问。',
    },
    {
      title: '需要正在撑破计划',
      message:
        '计划 {{planned}}%，实际 {{actual}}%。要么计划低估了真实成本，要么有些欲望借着需要的名义混了进来。',
    },
    {
      title: '花在“必须”上的比本意多',
      message:
        '必需占了支出的 {{actual}}%，而不是 {{planned}}%。把真正必须的和只是向来如此的分开。',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: '必需开支在悄悄上涨',
      message:
        '必需开支已连续 {{months}} 个月上升，累计上涨 {{percent}}%。没人要求需要证明自己时，它们就会悄悄长大。',
    },
    {
      title: '{{months}} 个月内必需开支 +{{percent}}%',
      message:
        '每一步看起来都很小，合起来却不小。拿出最大的一项固定必需开支，问问它是否仍必须花这么多。',
    },
    {
      title: '您支出的底线在抬高',
      message:
        '必需开支连续 {{months}} 个月增长（+{{percent}}%）。底线越高，留给您自由选择的空间就越少。',
    },
    {
      title: '需要在扩张',
      message:
        '增长了 {{months}} 个月，累计 {{percent}}%。斯多葛式的检验很简单：知道了价格，今天您还会再选它吗？',
    },
    {
      title: '小幅上涨，方向稳定',
      message:
        '必需开支 {{months}} 个月上涨了 {{percent}}%。方向比任何单月都重要——这个方向值得及早纠正。',
    },
  ],
  'stoic.work_over_plan': [
    {
      title: '工作开支超出计划',
      message:
        '您计划工作占支出的 {{planned}}%，实际占了 {{actual}}%。工具和服务应当物有所值——看看哪些做到了。',
    },
    {
      title: '工作开支 {{actual}}%，计划 {{planned}}%',
      message: '对工作的投入，有回报才是好投入。检查一下那些付了钱却不再使用的东西。',
    },
    {
      title: '工作预算吃紧',
      message:
        '工作占了 {{actual}}%，而不是 {{planned}}%。勤勉是把工作做好，而不是为它买下每一件工具。',
    },
    {
      title: '工具花费超出计划',
      message:
        '工作方面计划 {{planned}}%，实际 {{actual}}%。对每笔开支问一句：它是在帮我做事，还是只是让我感觉在进步？',
    },
    {
      title: '工作开支在漂移',
      message:
        '工作占支出的 {{actual}}%，本意是 {{planned}}%。现在做个快速检查，能省下以后更大的清理。',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '“{{category}}”再次超出限度',
      message:
        '在最近 {{window}} 个月中，“{{category}}”有 {{months}} 个月超出预算。要么限度不对，要么欲望不对——请决定是哪一个。',
    },
    {
      title: '“{{category}}”：{{window}} 个月中 {{months}} 个月超预算',
      message: '总被越过的限度不是限度，只是愿望。让它诚实起来——有意提高它，或有意守住它。',
    },
    {
      title: '同一项预算又失守了',
      message:
        '“{{category}}”在 {{window}} 个月里 {{months}} 次超出限度。重复本身就是信息，好好利用它。',
    },
    {
      title: '“{{category}}”需要您的关注',
      message:
        '{{window}} 个月中有 {{months}} 个月超预算。留意购买前的那一刻——那是唯一能改变习惯的地方。',
    },
    {
      title: '“{{category}}”中的一种模式',
      message:
        '{{window}} 个月里超支 {{months}} 次。我们反复做什么，就成为什么；想想您希望这个类别如何说明您。',
    },
  ],
  'stoic.budget_pace': [
    {
      title: '“{{category}}”将在{{day}}日用完',
      message:
        '{{limitAmount}} 中已花 {{spentAmount}}，照此速度，限额将在{{day}}日左右用完。现在放慢，比以后停下容易。',
    },
    {
      title: '“{{category}}”跑在了月份前面',
      message:
        '{{limitAmount}} 的限额已用去 {{spentAmount}}。照这个速度，{{day}}日就会用尽——这个月剩下的日子仍由您来安排。',
    },
    {
      title: '速度检查：“{{category}}”',
      message: '按当前速度，{{limitAmount}} 的预算大约能撑到{{day}}日。远见是最便宜的自律。',
    },
    {
      title: '“{{category}}”在透支未来',
      message:
        '{{limitAmount}} 中已花 {{spentAmount}}；限额将在{{day}}日前后用完。这周怎么做，决定这是否会发生。',
    },
    {
      title: '“{{category}}”的提前预警',
      message:
        '按当前速度，{{limitAmount}} 的限额撑不到月底——大约{{day}}日就会用完。趁代价还小时调整。',
    },
  ],
  'stoic.budget_unused': [
    {
      title: '“{{category}}”一直没有使用',
      message:
        '“{{category}}”的预算已有 {{months}} 个月没有任何支出。要么您已不再需要它，要么它是一个仍在等待的意图——决定是哪一种。',
    },
    {
      title: '一项空着的预算：“{{category}}”',
      message:
        '{{months}} 个月没有一笔开支。计划应当描述您正在过的生活，或您正在建设的生活——这是哪一种？',
    },
    {
      title: '“{{category}}”闲置着',
      message: '这里已 {{months}} 个月没有花费。如果是克制，做得好；如果是疏忽，就行动起来。',
    },
    {
      title: '有计划，却没有过上',
      message:
        '“{{category}}”设了限额，却已 {{months}} 个月没有支出。让计划保持真实：要么删掉，要么用起来。',
    },
    {
      title: '“{{category}}”：安静的 {{months}} 个月',
      message: '从未动用的预算仍占着计划里的位置。要么腾出这个位置，要么兑现这个意图。',
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: '{{percent}}% 的支出没有限度',
      message: '本月有 {{unbudgetedAmount}} 流向了没有预算看管的类别。无法衡量的东西，很难驾驭。',
    },
    {
      title: '这个月大部分没有计划',
      message:
        '{{percent}}% 的支出（{{unbudgetedAmount}}）不在任何预算之内。给其中最大的一项设个限度，计划就能看到更多您的生活。',
    },
    {
      title: '计划之外的支出',
      message:
        '预算只覆盖了您支出的一部分；{{unbudgetedAmount}}（{{percent}}%）无人衡量。把计划延伸到钱真正流去的地方。',
    },
    {
      title: '计划只看到了局部',
      message: '本月 {{percent}}% 的支出没有预算。先看清，才能判断得好。',
    },
    {
      title: '{{unbudgetedAmount}} 花在了限度之外',
      message: '这占本月的 {{percent}}%。您不必限制它——只需决定其中多少是您真正想要的。',
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '“{{category}}”占了您休闲的大头',
      message:
        '休闲支出的 {{percent}}% 花在了“{{category}}”上。休息多样一些，比依赖单一的快乐更健康。',
    },
    {
      title: '一种快乐占了上风',
      message:
        '“{{category}}”占您全部休闲支出的 {{percent}}%。问问它是否仍让您愉悦，还是已成了例行公事。',
    },
    {
      title: '休闲倚靠着“{{category}}”',
      message: '{{percent}}% 的休闲集中在一处。离不开的东西会牵制我们——看看它的牵制是否仍然轻微。',
    },
    {
      title: '“{{category}}”：休闲的 {{percent}}%',
      message: '单一的享乐来源几乎占了全部。这个月试一种更便宜、不同的快乐，比较一下。',
    },
    {
      title: '您的休息只有一个去处',
      message: '大部分休闲的钱——{{percent}}%——流向“{{category}}”。自由也包括能享受别的东西。',
    },
  ],
  'stoic.unclassified': [
    {
      title: '部分支出尚未评判',
      message: '未归类的类别：{{count}} 个。请在“预算”中决定哪些是必需、工作、美德或休闲。',
    },
    {
      title: '{{count}} 个类别等待您的判断',
      message: '它们有支出却未归入任何一类，建议因此无法衡量它们。在“预算”里花一分钟就能解决。',
    },
    {
      title: '说出您的钱在为什么服务',
      message: '仍有 {{count}} 个类别未归类。判断始于正确地称呼事物。',
    },
    {
      title: '未经判断的支出：{{count}} 个类别',
      message: '它是需要、您的工作、美德还是享乐？只有您能回答——一旦回答，计划就更清晰。',
    },
    {
      title: '有几个类别没有归类',
      message:
        '{{count}} 个类别不在四类之中。请在“预算”中为它们归类，让每一笔开支都被看清本来面目。',
    },
  ],
  'stoic.small_purchases': [
    {
      title: '在 {{merchant}} 的 {{count}} 笔小额消费',
      message:
        '每一笔都显得微不足道；合起来本月达到 {{totalAmount}}。未经审视的小习惯，正是大部分钱悄悄流走的地方。',
    },
    {
      title: '{{merchant}}：本月 {{count}} 次',
      message: '小额累计 {{totalAmount}}。问问每次光顾是选择还是反射——只有前者才是自由。',
    },
    {
      title: '积少成多：{{totalAmount}}',
      message:
        '在 {{merchant}} 消费 {{count}} 次。单独哪一笔都不重要，重要的是习惯。决定您真正想要多频繁。',
    },
    {
      title: '{{merchant}} 的一个习惯',
      message: '{{count}} 笔消费，共 {{totalAmount}}。这个月试着每三次省掉一次，看看您是否会想念。',
    },
    {
      title: '小事会积累',
      message:
        '您在 {{merchant}} 消费了 {{count}} 次，共 {{totalAmount}}。驾驭大决定的能力，正建立在这样的小决定之上。',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: '周末占了休闲的 {{percent}}%',
      message: '您的休闲支出大多发生在周六和周日。休息是好事；看看那是休息，而不是对一周的补偿。',
    },
    {
      title: '休闲集中在周末',
      message: '{{percent}}% 的休闲支出落在周末。稍微计划一下周末，它会花得更少、给得更多。',
    },
    {
      title: '周末在为整周买单',
      message: '周末占您休闲支出的 {{percent}}%。如果每个周六都要修补这一周，那就看看这一周本身。',
    },
    {
      title: '周六和周日：休闲的 {{percent}}%',
      message: '空闲的日子容易引来随意的花费。周末之前先想好它为何而过，让钱跟着走。',
    },
    {
      title: '周末模式',
      message: '{{percent}}% 的休闲支出发生在周末。工作日过得从容些，周末往往就不那么昂贵。',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}} 拿走了本月的 {{percent}}%',
      message:
        '{{totalAmount}} 的休闲支出流向了同一家商户。当一个地方拿走您这么多钱时，问问它还占了您多少注意力。',
    },
    {
      title: '一个地方，{{totalAmount}}',
      message: '{{merchant}} 占本月支出的 {{percent}}%。它值得您辛劳所得的这么大一份吗？',
    },
    {
      title: '{{merchant}} 领跑您的支出',
      message:
        '本月的 {{percent}}%——{{totalAmount}}——花在了那里。享受它没有错，只要您愿意再次选择它。',
    },
    {
      title: '{{merchant}} 占了很大一份',
      message:
        '在同一个休闲场所花了 {{totalAmount}}，即支出的 {{percent}}%。冷静地把快乐与价格放在一起衡量。',
    },
    {
      title: '{{percent}}% 花在 {{merchant}}',
      message: '这一家商户拿走了 {{totalAmount}}。自由，是在您愿意时能从它面前走过。',
    },
  ],
  'stoic.income_drop': [
    {
      title: '收入下降，支出没有',
      message:
        '收入下降 {{percent}}% 至 {{incomeAmount}}，支出却仍是 {{expenseAmount}}。命运改了主意，您的支出还没察觉。',
    },
    {
      title: '收入下降 {{percent}}%',
      message:
        '进账 {{incomeAmount}}，出账 {{expenseAmount}}。命运给的，也可能收回——让支出适应现在，而不是过去。',
    },
    {
      title: '更紧的一个月，同样的习惯',
      message:
        '收入低了 {{percent}}%（{{incomeAmount}}），支出却维持在 {{expenseAmount}}。收入不在您的掌控之中，回应却在。',
    },
    {
      title: '命运转了向',
      message:
        '您比平时少挣了 {{percent}}%，却照旧花了 {{expenseAmount}}。现在就削减，趁它还是选择而不是不得已。',
    },
    {
      title: '支出没有跟上收入的变化',
      message:
        '收入降到 {{incomeAmount}}（下降 {{percent}}%）；支出是 {{expenseAmount}}。按您真正拥有的风来调整帆。',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: '订阅：每月 {{monthlyAmount}}',
      message:
        '{{count}} 项订阅占您每月支出的 {{percent}}%。每一项都不问您就自动续费——那就由您自己逐一问问它们。',
    },
    {
      title: '{{percent}}% 的支出在自动续订',
      message: '{{count}} 项订阅，每月 {{monthlyAmount}}。只保留那些今天您仍会重新订阅的。',
    },
    {
      title: '安静、循环的 {{monthlyAmount}}',
      message: '{{count}} 项订阅花掉您一个月的 {{percent}}%。便利是好仆人，却是昂贵的主人。',
    },
    {
      title: '{{count}} 项订阅待检视',
      message:
        '它们合计每月 {{monthlyAmount}}，占支出的 {{percent}}%。取消一项几乎不用的，看看您有多不想念它。',
    },
    {
      title: '那些自动续订的',
      message: '{{count}} 项订阅每月共 {{monthlyAmount}}。自动的支出，值得一次有意识的检视。',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: '您的成功可以惠及更远一些',
      message:
        '过去 {{months}} 个月，您留住了收入的 {{savingsPercent}}%，却几乎没有分给他人。财富放在张开的手中最为安稳——这个月也许可以送一份礼物或做一次捐赠？',
    },
    {
      title: '收入不少，给予不多',
      message:
        '{{months}} 个月里收入 {{incomeAmount}}，给予他人 {{givenAmount}}。如果您以本应用看不到的方式帮助他人，请忽略这条；如果没有，计划里也留有这份余地。',
    },
    {
      title: '正是慷慨的好时候',
      message:
        '您存下了收入的 {{savingsPercent}}%，说明您手很稳。把其中一小部分给需要的人，这份稳健会更有意义。',
    },
    {
      title: '画面里还没有别人',
      message:
        '最近 {{months}} 个月显示您用心赚钱、认真储蓄，却没有慈善捐赠或礼物。人生来是为了彼此；一份小小的礼物就足以开始。',
    },
    {
      title: '为善意留点空间',
      message:
        '{{incomeAmount}} 中只有 {{givenAmount}} 用于帮助他人。不妨考虑一笔小额的定期捐赠——慷慨和每一种美德一样，成了习惯就更容易。',
    },
  ],
  'stoic.goal_behind': [
    {
      title: '“{{goal}}”进度落后',
      message:
        '它每月需要 {{requiredAmount}}，您大约投入 {{paceAmount}}。照此速度，将晚 {{monthsLate}} 个月达成。',
    },
    {
      title: '“{{goal}}”：照此速度晚 {{monthsLate}} 个月',
      message:
        '每月需要 {{requiredAmount}}，实际约 {{paceAmount}}。要么诚实地推迟日期，要么有意识地多投入些钱。',
    },
    {
      title: '目标与步伐意见不合',
      message:
        '“{{goal}}”每月需要 {{requiredAmount}}，实际得到 {{paceAmount}}。目标有多真实，取决于每月迈向它的那一步。',
    },
    {
      title: '“{{goal}}”需要更坚实的一步',
      message:
        '每月 {{paceAmount}}，而它需要 {{requiredAmount}}。下个月先为目标付钱，再考虑任何可有可无的开支。',
    },
    {
      title: '“{{goal}}”落后了',
      message:
        '按目前的速度（每月 {{paceAmount}}），它将晚 {{monthsLate}} 个月。现在的小幅增加，胜过以后的巨大牺牲。',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: '“{{goal}}”放不进计划',
      message:
        '它每月需要 {{requiredAmount}}，但扣除预算后只有 {{freeAmount}} 可用。改日期、改目标或改预算——指望不是计划。',
    },
    {
      title: '“{{goal}}”要的比您空余的多',
      message:
        '每月需要 {{requiredAmount}}，可用 {{freeAmount}}。什么都想同时要，结果什么都做不成；做出选择。',
    },
    {
      title: '数字说不——暂时如此',
      message:
        '“{{goal}}”每月需要 {{requiredAmount}}；您的空闲资金是 {{freeAmount}}。调整您能掌控的：期限或其他限额。',
    },
    {
      title: '“{{goal}}”需要一个决定',
      message:
        '每月 {{requiredAmount}}，超过了预算之后剩下的 {{freeAmount}}。睁着眼睛选定的目标，胜过靠一厢情愿维持的目标。',
    },
    {
      title: '“{{goal}}”的步伐无法实现',
      message:
        '每月需要 {{requiredAmount}}，空余 {{freeAmount}}。现在诚实地算账，能免去以后的失望。',
    },
  ],
  'stoic.shortfall': [
    {
      title: '{{date}}您的余额将跌破零',
      message:
        '即将到来的 {{committedAmount}} 付款会让预计余额降到 {{lowestAmount}}。趁它还只是预测，现在就做准备。',
    },
    {
      title: '资金缺口将至：{{date}}',
      message:
        '已承诺的付款（{{committedAmount}}）超过余额，最低将降到 {{lowestAmount}}。预见困难，是让困难失去力量的方式。',
    },
    {
      title: '为{{date}}做好计划',
      message:
        '那一天预计余额将降到 {{lowestAmount}}。推迟一笔付款、搁置一个欲望或预留现金——今天这些都在您的掌控之中。',
    },
    {
      title: '承诺超过了余额',
      message:
        '{{committedAmount}} 即将到期，余额将在{{date}}前后降到 {{lowestAmount}}。冷静的应对，就是及早的应对。',
    },
    {
      title: '预见{{date}}的缺口',
      message: '预计最低余额：{{lowestAmount}}。预见到的事可以从容应对；让我们措手不及的，很少能。',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: '您守住了对自己的承诺',
      message: '已连续 {{months}} 个月，支出都在您自己设定的计划之内。这就是自制的样子。',
    },
    {
      title: '{{months}} 个月都在计划之内',
      message: '一月又一月，您的打算和您的行动一致。坚持比意志力更安静，也更持久。',
    },
    {
      title: '计划与生活一致',
      message:
        '连续 {{months}} 个月守在限度之内。守得这么好的计划已不再是约束——它就是您的生活方式。',
    },
    {
      title: '稳定了 {{months}} 个月',
      message: '您的预算已连续 {{months}} 个月守住。保持同样的专注，它正在奏效。',
    },
    {
      title: '持续的自律',
      message: '{{months}} 个月没有打破计划。很少有什么比信任自己的决定更让人自由。',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: '您的钱追随您的价值观',
      message: '美德占了支出的 {{actual}}%，不低于计划的 {{planned}}%。花得好。',
    },
    {
      title: '美德得到了应得的全部',
      message:
        '{{actual}}% 用于健康、学习和他人，计划是 {{planned}}%。您看重什么，就为什么付了钱。',
    },
    {
      title: '花在变得更好上',
      message:
        '本月美德占支出的 {{actual}}%（计划 {{planned}}%）。这笔钱在花掉之后很久仍在为您效力。',
    },
    {
      title: '意图已付诸实行',
      message:
        '您为美德计划了 {{planned}}%，实际花了 {{actual}}%。好的意图很少能撑过一个月——您的撑过了。',
    },
    {
      title: '钱最好的用处',
      message: '{{actual}}% 用在了让您和他人变得更好的事上。继续这样选择。',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: '休闲各得其所',
      message: '休闲占支出的 {{actual}}%，低于您给它的 {{planned}}%。您享受事物，却不受其支配。',
    },
    {
      title: '快乐，保持分寸',
      message: '休闲占了 {{actual}}%，计划是 {{planned}}%。节制不是错过——而是选择。',
    },
    {
      title: '休息而不过度',
      message: '休闲 {{actual}}%，低于您 {{planned}}% 的限度。享受不当家时，味道更好。',
    },
    {
      title: '安静的节制',
      message: '您给了休闲 {{planned}}%，它只用了 {{actual}}%。这份余地，是您保住的自由。',
    },
    {
      title: '休闲低于计划',
      message: '休闲占支出的 {{actual}}%，守在您设定的 {{planned}}% 之下。守得好。',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: '比计划少 {{percent}}%',
      message:
        '本月您比允许自己的少花了 {{savedAmount}}。不需要所有能拥有的东西，本身就是一种富足。',
    },
    {
      title: '{{savedAmount}} 没有花出去',
      message: '本月比计划低 {{percent}}%。没花掉的钱仍由您来安排去向。',
    },
    {
      title: '少于您允许的',
      message:
        '支出比计划低 {{percent}}%——留住了 {{savedAmount}}。在习惯占领它之前，给这份余地一个用途。',
    },
    {
      title: '计划还有富余',
      message: '本月比您的限度少花 {{savedAmount}}。轻松的克制，才是持久的克制。',
    },
    {
      title: '比计划更轻',
      message: '您比预算少用了 {{percent}}%。考虑把这 {{savedAmount}} 投向一个目标。',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '“{{goal}}”按计划推进',
      message: '您已完成 {{percent}}%，步伐正是目标所需。每月稳步前行，能走得很远。',
    },
    {
      title: '“{{goal}}”在正轨上',
      message: '已完成 {{percent}}%，步伐稳定。继续先为目标付钱，这正在奏效。',
    },
    {
      title: '“{{goal}}”：{{percent}}%，稳步前进',
      message: '目标每个月都得到了它需要的。耐心正在发挥作用。',
    },
    {
      title: '目标如期推进',
      message:
        '“{{goal}}”已筹得 {{percent}}%，进度准时。每月做一点的事，不会被一个糟糕的星期打断。',
    },
    {
      title: '值得信赖的进展',
      message: '“{{goal}}”已达 {{percent}}%，步伐如期。您正用唯一行得通的方式建设它——循序渐进。',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: '在 {{merchant}} 的冲动消费变少了',
      message: '从上个月的 {{before}} 次减少到本月约 {{after}} 次。松开一个习惯，就赢得一份自由。',
    },
    {
      title: '{{merchant}}：{{before}} → {{after}}',
      message: '您去得比以前少了。每一次忍住的反射，都是选择对习惯的小小胜利。',
    },
    {
      title: '小习惯在缩小',
      message:
        '在 {{merchant}} 的消费从 {{before}} 次降到约 {{after}} 次。继续下去——会越来越容易。',
    },
    {
      title: '选择胜过反射',
      message:
        '在 {{merchant}}，您从 {{before}} 次消费减到约 {{after}} 次。这就是一次次决定积累起来的自主。',
    },
    {
      title: '小开销少了',
      message: '您在 {{merchant}} 消费了约 {{after}} 次，而不是 {{before}} 次。小胜利会不断累积。',
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: '您适应了更紧的一个月',
      message:
        '收入下降 {{incomePercent}}%，您把支出削减了 {{expensePercent}}%。命运变了，您也调整了航向。',
    },
    {
      title: '收入下滑时保持镇定',
      message:
        '收入降 {{incomePercent}}%，支出降 {{expensePercent}}%。您适应的是现在，而不是过去。',
    },
    {
      title: '命运变了，您也变了',
      message:
        '收入下降 {{incomePercent}}%，支出随之下降 {{expensePercent}}%。这就是用数字写成的泰然。',
    },
    {
      title: '掌舵得当',
      message:
        '收入下降 {{incomePercent}}% 时，支出也跟着减少了 {{expensePercent}}%。风不由您，帆由您。',
    },
    {
      title: '支出随收入一起下调',
      message:
        '收入下降 {{incomePercent}}%，您少花了 {{expensePercent}}%。及早适应，是平静度过的方式。',
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: '必需开支保持稳定',
      message: '{{months}} 个月来，您的基本开支几乎没有变化。稳定的底线，让您在其上拥有自由。',
    },
    {
      title: '需要得到了控制',
      message: '必需开支已持平 {{months}} 个月。不再增长的需要，就是您掌控的需要。',
    },
    {
      title: '{{months}} 个月基本开支稳定',
      message: '房租、饮食和账单都保持原样。安静的稳定，也是一种成就。',
    },
    {
      title: '必需开支没有悄悄上涨',
      message: '{{months}} 个月来，生活所需没有漂移。在这样的基础上，其他一切都更容易计划。',
    },
    {
      title: '坚实的底线',
      message: '基本开支已稳定 {{months}} 个月。您没有让享受冒充需要。',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: '对所得慷慨',
      message:
        '过去 {{months}} 个月，您收入的 {{percent}}%，即 {{givenAmount}}，用于帮助他人。这是钱最好的用处。',
    },
    {
      title: '已给予他人 {{givenAmount}}',
      message:
        '{{months}} 个月里，您分享了收入的 {{percent}}%。体现在数字里的善意，是践行的善意，而不只是心里的善意。',
    },
    {
      title: '张开的手',
      message:
        '近来慈善和礼物占了您收入的 {{percent}}%。您给出去的，是财富中任何不幸都夺不走的那一部分。',
    },
    {
      title: '慷慨是您计划的一部分',
      message:
        '{{months}} 个月里给予他人 {{givenAmount}}。请保持下去——您为他人做的好事，也是为自己做的好事。',
    },
    {
      title: '给得其所',
      message: '您所赚的 {{percent}}% 用于帮助他人。很少有习惯比这更能说明一个人。',
    },
  ],
  'stoic.praise_steady': [
    {
      title: '无需纠正',
      message: '您的支出与您的打算一致。继续保持。',
    },
    {
      title: '意图与行动一致',
      message: '这个月的样子正是您计划的样子。这种一致，正是一切的意义所在。',
    },
    {
      title: '平静的一个月',
      message: '没有值得一提的过度，也没有疏忽。做得好——把同样的专注带到下个月。',
    },
    {
      title: '一切井然',
      message: '计划守住了，没有什么需要纠正。享受您赢得的这份平静。',
    },
    {
      title: '稳健的手',
      message: '这个月按您的计划进行。好习惯让好月份看起来平平无奇。',
    },
  ],
  'expert.pay_yourself_first': [
    {
      title: '先支付给自己',
      message:
        '乔治·S·克拉森的法则：您所赚的一切中，有一部分是您自己该留下的——至少十分之一。过去 {{months}} 个月，您留下了 {{savingsPercent}}%。收入到账当天，先存下 {{tenthAmount}}，再做别的。',
    },
    {
      title: '十分之一归您自己',
      message:
        '在《巴比伦最富有的人》中，治愈钱包干瘪的第一个良方是：每赚十枚硬币，留下一枚。您的储蓄率是 {{savingsPercent}}%；每月存 {{tenthAmount}} 就能养成这个习惯。',
    },
    {
      title: '先储蓄，再消费',
      message:
        '克拉森的建议很简单：先支付给自己。最近您的收入中有 {{savingsPercent}}% 留了下来。发薪日先转出 {{tenthAmount}}，让开支去适应剩下的部分。',
    },
    {
      title: '第一枚硬币属于您',
      message:
        '克拉森说，所赚的一切中应有一部分留给自己——不少于十分之一。过去 {{months}} 个月，您留下了 {{savingsPercent}}%。从每月自动存下 {{tenthAmount}} 开始吧。',
    },
    {
      title: '已留下 {{savingsPercent}}%——法则要求 10%',
      message:
        '正如《巴比伦最富有的人》所说，先支付给自己：每月 {{tenthAmount}}，在支付任何账单之前存下。先存下的钱，不取决于最后还剩多少。',
    },
  ],
  'expert.rule_50_30_20': [
    {
      title: '您的 50/30/20 检查',
      message:
        '伊丽莎白·沃伦和阿米莉亚·沃伦·蒂亚吉建议：税后收入的 50% 用于必需品，30% 用于想要的东西，20% 用于储蓄。您的比例：{{needsPercent}}% / {{wantsPercent}}% / {{savingsPercent}}%。',
    },
    {
      title: '必需 {{needsPercent}}%，想要 {{wantsPercent}}%，储蓄 {{savingsPercent}}%',
      message:
        '《All Your Worth》以 50/30/20 来平衡金钱。找出离目标最远的那一项，对照您的计划——在那里做一处调整，效果最大。',
    },
    {
      title: '您的收入如何分配',
      message:
        '必需品占收入的 {{needsPercent}}%，想要的东西占 {{wantsPercent}}%，储蓄了 {{savingsPercent}}%。《All Your Worth》中的 50/30/20 平衡是一面有用的镜子，而不是判决。',
    },
    {
      title: '平衡的金钱公式',
      message:
        '沃伦和蒂亚吉的公式：一半用于无论如何都必须支付的东西，30% 用于想要的东西，20% 留给未来。您目前是 {{needsPercent}}/{{wantsPercent}}/{{savingsPercent}}。',
    },
    {
      title: '对照 50/30/20',
      message:
        '您的分配是：必需品 {{needsPercent}}%，想要的东西 {{wantsPercent}}%，储蓄 {{savingsPercent}}%。书中判断必需品的方法：如果明天失业了，您还会继续支付它吗？',
    },
  ],
  'expert.room_for_error': [
    {
      title: '为意外留出余地',
      message:
        '摩根·豪泽尔的建议：为事情不按计划进行做好计划。您的余额大约够支撑 {{cushionDays}} 天的开支；常见的标准是三个月——{{targetAmount}}。',
    },
    {
      title: '{{cushionDays}} 天的缓冲',
      message:
        '《金钱心理学》称之为“容错空间”——让您挺过意外的余量。逐步攒到 {{targetAmount}}，即三个月的开支，能让计划有机会经受住现实的考验。',
    },
    {
      title: '家庭里的安全边际',
      message:
        '豪泽尔把格雷厄姆的安全边际借用到个人理财上。储备只够 {{cushionDays}} 天开支时，一个糟糕的月份就可能毁掉一个好计划。目标是 {{targetAmount}}。',
    },
    {
      title: '为意料之外留出空间',
      message:
        '您的储备大约能维持 {{cushionDays}} 天。意外是唯一确定的事；三个月的开支（{{targetAmount}}）是一个被广泛采用的目标。',
    },
    {
      title: '在需要之前积累余量',
      message:
        '用摩根·豪泽尔的话说，容错空间让您留在牌局中。目前大约覆盖 {{cushionDays}} 天；{{targetAmount}} 可以覆盖三个月。',
    },
  ],
  'expert.lifestyle_creep': [
    {
      title: '开支跑在了收入前面',
      message:
        '上个季度开支增长了 {{expenseGrowth}}%，而收入变化了 {{incomeGrowth}}%。《邻家的百万富翁》的第一条规则：无论收入多少，都要让生活低于您的财力。',
    },
    {
      title: '过得更阔绰，却没有更富有',
      message:
        '斯坦利和丹科发现，财富是您积累下来的，而不是花掉的。您的开支增长了 {{expenseGrowth}}%，收入增长了 {{incomeGrowth}}%——这个差距正是财富流失的地方。',
    },
    {
      title: '生活方式膨胀：+{{expenseGrowth}}%',
      message:
        '开支的增速超过了收入（{{incomeGrowth}}%）。《邻家的百万富翁》中的人们之所以保持富有，是因为让收入增长，却不让开支跟着涨。',
    },
    {
      title: '目标在不断移动',
      message:
        '开支环比上涨了 {{expenseGrowth}}%，而收入是 {{incomeGrowth}}%。斯坦利和丹科说：让生活低于您的财力——无论财力是多少。',
    },
    {
      title: '财富是您留下的部分',
      message:
        '收入再好，全部花光也不会让人更富有。上个季度您的开支增长了 {{expenseGrowth}}%，收入增长了 {{incomeGrowth}}%——值得在它成为新常态之前看一看。',
    },
  ],
  'expert.life_energy': [
    {
      title: '{{merchant}} 花掉了您 {{hours}} 小时的生命',
      message:
        '维姬·罗宾和乔·多明格斯建议用生命能量来衡量事物的价格——也就是它们花费您多少小时的工作。本月在 {{merchant}} 的 {{totalAmount}} 大约是 {{hours}} 小时。值得吗？',
    },
    {
      title: '在 {{merchant}} 的 {{hours}} 小时',
      message:
        '《要钱还是要命》请您把金钱看作用时间换来的东西。按您的平均时薪计算，在那里花的 {{totalAmount}} 大约相当于 {{hours}} 个工作小时。',
    },
    {
      title: '用小时来衡量价格',
      message:
        '在 {{merchant}} 的 {{totalAmount}} 大约是 {{hours}} 小时的工作。罗宾和多明格斯称之为生命能量——唯一无法再赚回来的货币。',
    },
    {
      title: '{{merchant}} 真正花掉了什么',
      message:
        '金钱是我们用生命能量换来的东西。本月 {{merchant}} 占用了您大约 {{hours}} 小时（{{totalAmount}}）。带来的愉悦与这些小时相称吗？',
    },
    {
      title: '生命能量检查',
      message:
        '按您的平均时薪换算，在 {{merchant}} 花的 {{totalAmount}} 大约是 {{hours}} 小时。《要钱还是要命》建议问问自己：它带来的满足是否与之相称。',
    },
  ],
};
