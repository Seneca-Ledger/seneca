import type { StoicTextMap } from './types';

export const ko: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: '이번 달이 계획을 넘어섰습니다',
      message:
        '{{plannedAmount}}을(를) 계획했는데 {{spentAmount}}을(를) 썼습니다. {{percent}}% 더 많습니다. 계획은 맑은 정신으로 세운 것입니다. 순간의 기분보다 계획의 목소리를 더 크게 들으세요.',
    },
    {
      title: '생각보다 {{percent}}% 더 썼습니다',
      message:
        '계획 {{plannedAmount}}에 대해 지출은 {{spentAmount}}입니다. 어떤 한도가 가장 먼저 무너졌는지 보세요. 교훈은 거기에 있습니다.',
    },
    {
      title: '계획과 이번 달이 어긋납니다',
      message:
        '쓴 돈은 {{spentAmount}}, 의도한 돈은 {{plannedAmount}}입니다. 계획이 현실에 너무 적게 요구했는지, 현실이 당신에게 너무 많이 요구했는지 차분히 판단하세요.',
    },
    {
      title: '허락한 것보다 많이 나갔습니다',
      message:
        '이번 달은 정해 둔 {{plannedAmount}}보다 {{percent}}% 많습니다. 지금 멈춘다고 잃는 것은 없습니다. 없었던 일처럼 넘기면 많은 것을 잃습니다.',
    },
    {
      title: '스스로 정한 한도를 스스로 넘었습니다',
      message:
        '{{plannedAmount}}을(를) 쓰려 했는데 {{spentAmount}}이(가) 되었습니다. 자기 절제란 한 번도 미끄러지지 않는 것이 아니라, 일찍 알아차리고 길로 돌아오는 것입니다.',
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: '여가가 계획보다 많이 가져갑니다',
      message:
        '여가를 지출의 {{planned}}%로 정했지만 이번 달은 {{actual}}%입니다. 즐거움은 손님으로는 반갑지만, 집주인이 되어서는 안 됩니다.',
    },
    {
      title: '여가 {{actual}}%, 계획 {{planned}}%',
      message:
        '휴식은 당신을 회복시킬 때 제 몫을 합니다. 이번 달의 즐거움 중 무엇이 정말 회복을 주었는지 묻고, 나머지는 아쉬움 없이 놓아 주세요.',
    },
    {
      title: '편안함이 의도를 앞지르고 있습니다',
      message:
        '여가가 지출의 {{actual}}%로, 선택한 {{planned}}%를 넘었습니다. 절제는 즐거움을 거부하는 것이 아니라, 정해 둔 크기로 지키는 것입니다.',
    },
    {
      title: '편한 것이 계획을 밀어냅니다',
      message:
        '여가에 계획의 {{planned}}%를 주었는데 {{actual}}%를 가져갔습니다. 쉽게 즐기는 것은 필요한 것이 되기 전에 한 번 더 살펴볼 만합니다.',
    },
    {
      title: '여가가 선을 넘었습니다',
      message:
        '이번 달의 {{actual}}%가 여가로 갔고, 의도는 {{planned}}%였습니다. 선을 그은 것도 당신이고, 지키는 것도 당신입니다.',
    },
  ],
  'stoic.leisure_habit': [
    {
      title: '여가가 또 계획을 넘었습니다',
      message:
        '최근 {{window}}개월 중 {{months}}개월 동안 여가가 계획을 넘었습니다. 반복은 더 이상 우연이 아니라 살펴볼 만한 습관입니다.',
    },
    {
      title: '{{window}}개월 중 {{months}}개월 여가 계획 초과',
      message:
        '한 번 일어난 일은 상황입니다. {{months}}번 일어난 일은 만들어지고 있는 성품입니다. 그 성품을 의도적으로 고르세요.',
    },
    {
      title: '매달 같은 실수',
      message:
        '{{window}}개월 중 {{months}}개월 동안 여가가 계획을 넘었습니다. 계획을 솔직하게 올리거나 습관을 바꾸세요. 그 사이에 머무는 것이 가장 비쌉니다.',
    },
    {
      title: '실수가 아니라 패턴입니다',
      message:
        '최근 {{window}}개월 중 {{months}}개월 동안 여가가 받은 것보다 많이 가져갔습니다. 나중에 오는 청구서만이 아니라, 결정이 내려지는 순간을 알아차리세요.',
    },
    {
      title: '습관이 계획에 반대표를 던지고 있습니다',
      message:
        '{{window}}개월 동안 여가가 {{months}}번 계획을 이겼습니다. 습관은 선택 하나하나로 쌓이고, 무너뜨리는 것도 마찬가지입니다.',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: '덕에 의도보다 적게 쓰고 있습니다',
      message:
        '건강, 배움, 타인을 위해 예산의 {{planned}}%를 떼어 두었지만 지금까지 {{actual}}%입니다. 의도는 실행될 때 비로소 의미가 있습니다.',
    },
    {
      title: '덕 {{actual}}%, 계획 {{planned}}%',
      message:
        '당신을 더 나아지게 할 돈이 아직 기다리고 있습니다. 그 돈을 잘 쓰기에 이번 달보다 좋은 때는 없습니다.',
    },
    {
      title: '계획한 선한 일에 아직 돈을 쓰지 않았습니다',
      message:
        '건강, 배움, 너그러움에 지출의 {{planned}}%를 쓰기로 했지만 {{actual}}%에 그쳤습니다. 이번 주에 그중 하나를 의식적으로 해 보세요.',
    },
    {
      title: '의도는 있고 행동은 없습니다',
      message:
        '덕은 지출의 {{actual}}%로, 선택한 {{planned}}%에 못 미칩니다. 무엇을 소중히 여기는지는 실제로 무엇에 돈을 내는지에 드러납니다.',
    },
    {
      title: '중요한 것을 위한 자리가 남아 있습니다',
      message:
        '{{planned}}%를 계획했지만 덕에는 {{actual}}%만 갔습니다. 책 한 권, 건강검진 한 번, 도움이 필요한 사람에게 주는 선물. 계획은 이미 허락했습니다.',
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: '덕이 계속 미뤄지고 있습니다',
      message:
        '건강, 배움, 타인을 위한 지출이 {{months}}개월 연속 계획에 못 미칩니다. 계속 미루는 것은 사실상 이미 거절한 것입니다.',
    },
    {
      title: '{{months}}개월째 미뤄진 덕',
      message:
        '매달 계획은 당신을 더 나아지게 할 자리를 마련했고, 매달 그 자리는 비어 있었습니다. 시간은 두 번 예산에 넣을 수 없는 유일한 것입니다.',
    },
    {
      title: '더 나은 자신이 아직 기다립니다',
      message:
        '덕이 {{months}}개월 연속 계획에 못 미쳤습니다. 거창하게 나중에 하기보다 작고 확실하게 지금 시작하세요.',
    },
    {
      title: '좋은 의도가 낡아 갑니다',
      message:
        '{{months}}개월 동안 건강, 배움, 너그러움에 계획보다 적게 썼습니다. 다음 달에는 하나를 골라 무엇보다 먼저 돈을 배정하세요.',
    },
    {
      title: '덕이 계속 ‘나중에’에 밀립니다',
      message:
        '{{months}}개월 연속 계획 미만입니다. ‘나중에’는 좋은 의도가 잊히는 곳입니다. 이것에는 날짜를 정해 주세요.',
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: '계획에 덕의 자리가 없습니다',
      message:
        '건강, 배움, 타인을 위한 예산이 하나도 없습니다. 계획은 우리가 무엇을 소중히 여기는지 보여 줍니다. 덕에 별도의 항목을 주는 것을 생각해 보세요.',
    },
    {
      title: '모든 것에 예산이 있는데, 선한 일에는 없습니다',
      message:
        '필수, 일, 여가에는 한도가 있지만 덕에는 없습니다. 한 번도 계획하지 않은 일은 대개 끝내 일어나지 않습니다.',
    },
    {
      title: '당신을 더 낫게 하는 것을 계획하세요',
      message:
        '덕 분류에는 아직 예산이 없습니다. 책, 운동, 기부처럼 작은 예산이라도 바람을 약속으로 바꿉니다.',
    },
    {
      title: '계획이 덕에 대해 침묵합니다',
      message:
        '해야 하는 것과 즐기는 것에는 예산을 세웠지만, 되고 싶은 사람을 위한 예산은 아직 없습니다. 소박한 덕 예산 하나면 달라집니다.',
    },
    {
      title: '덕에 예산이 없습니다',
      message:
        '건강, 배움, 타인을 위한 지출이 어디에도 계획되어 있지 않습니다. 하나를 골라, 도달하면 기쁠 한도를 정하세요.',
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: '필수 지출이 계획보다 많습니다',
      message:
        '필수에 지출의 {{planned}}%를 계획했는데 {{actual}}%를 차지합니다. 하나하나가 아직 필요한지, 슬그머니 편의가 되지는 않았는지 확인하세요.',
    },
    {
      title: '필수 {{actual}}%, 계획 {{planned}}%',
      message:
        '삶이 실제로 요구하는 것은 대개 우리가 익숙해진 것보다 적습니다. 가장 큰 필수 지출을 새로운 눈으로 다시 보세요.',
    },
    {
      title: '기본 지출이 불어나고 있습니다',
      message:
        '필수가 이번 달의 {{actual}}%로, 예상한 {{planned}}%를 넘었습니다. 계속 커지는 필요에는 질문을 던질 만합니다.',
    },
    {
      title: '필요가 계획을 넘어 자랍니다',
      message:
        '계획 {{planned}}%, 실제 {{actual}}%. 계획이 실제 비용을 낮게 잡았거나, 원하는 것 일부가 필요라는 이름으로 섞여 들어왔습니다.',
    },
    {
      title: '‘꼭 필요한 것’에 생각보다 많이 썼습니다',
      message:
        '필수가 지출의 {{planned}}%가 아니라 {{actual}}%를 차지했습니다. 정말 필요한 것과 그저 늘 그래 왔던 것을 가려내세요.',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: '필수 지출이 조금씩 오릅니다',
      message:
        '필수 지출이 {{months}}개월 연속 늘어 모두 {{percent}}% 올랐습니다. 아무도 이유를 묻지 않으면 필요는 조용히 자랍니다.',
    },
    {
      title: '{{months}}개월 동안 필수 +{{percent}}%',
      message:
        '한 걸음씩은 작아 보였지만 모이면 작지 않습니다. 가장 큰 고정 필수 지출을 골라, 아직도 이만큼 들어야 하는지 물어보세요.',
    },
    {
      title: '지출의 바닥이 올라가고 있습니다',
      message:
        '필수가 {{months}}개월 연속 늘었습니다(+{{percent}}%). 바닥이 높아질수록 자유롭게 고를 수 있는 여지는 줄어듭니다.',
    },
    {
      title: '필요가 넓어지고 있습니다',
      message:
        '{{months}}개월 동안 늘어 전체 {{percent}}%입니다. 스토아의 시험은 간단합니다. 값을 알고도 오늘 다시 이것을 고르겠습니까?',
    },
    {
      title: '작은 인상, 한결같은 방향',
      message:
        '필수가 {{months}}개월 동안 {{percent}}% 늘었습니다. 어느 한 달보다 방향이 더 중요합니다. 이 방향은 일찍 바로잡을 만합니다.',
    },
  ],
  'stoic.work_over_plan': [
    {
      title: '일 관련 지출이 계획보다 많습니다',
      message:
        '일에 지출의 {{planned}}%를 계획했는데 {{actual}}%를 차지합니다. 도구와 서비스는 제값을 해야 합니다. 어떤 것이 그런지 확인하세요.',
    },
    {
      title: '일 지출 {{actual}}%, 계획 {{planned}}%',
      message:
        '일에 대한 투자는 무언가를 돌려줄 때 좋은 투자입니다. 돈은 내지만 더 이상 쓰지 않는 것을 점검하세요.',
    },
    {
      title: '일 예산이 빠듯합니다',
      message:
        '일이 {{planned}}%가 아니라 {{actual}}%를 가져갔습니다. 성실함은 일을 잘하는 것이지, 그 일을 위한 도구를 모두 사는 것이 아닙니다.',
    },
    {
      title: '도구가 계획보다 많이 씁니다',
      message:
        '일에 계획 {{planned}}%, 지출 {{actual}}%. 각 지출에 물어보세요. 일을 돕는가, 아니면 앞으로 나아가는 기분만 주는가?',
    },
    {
      title: '일 지출이 조금씩 벗어났습니다',
      message:
        '일이 지출의 {{actual}}%로, 의도한 {{planned}}%보다 많습니다. 지금의 짧은 점검이 나중의 큰 정리를 덜어 줍니다.',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '"{{category}}"이(가) 또 한도를 넘습니다',
      message:
        '"{{category}}"이(가) 최근 {{window}}개월 중 {{months}}개월 동안 예산을 넘었습니다. 한도가 틀렸거나 욕구가 틀렸습니다. 어느 쪽인지 정하세요.',
    },
    {
      title: '‘{{category}}’: {{window}}개월 중 {{months}}개월 예산 초과',
      message:
        '늘 넘어서는 한도는 한도가 아니라 바람일 뿐입니다. 정직하게 만드세요. 의도적으로 올리거나, 의도적으로 지키거나.',
    },
    {
      title: '같은 예산이 또 무너졌습니다',
      message:
        '‘{{category}}’ 항목이 {{window}}개월 동안 {{months}}번 한도를 넘었습니다. 반복은 정보입니다. 활용하세요.',
    },
    {
      title: '‘{{category}}’ 항목에 주의가 필요합니다',
      message:
        '{{window}}개월 중 {{months}}개월 예산을 넘었습니다. 구매 직전의 순간을 지켜보세요. 습관을 바꿀 수 있는 곳은 그곳뿐입니다.',
    },
    {
      title: '‘{{category}}’에 보이는 패턴',
      message:
        '{{window}}개월 동안 {{months}}번 초과했습니다. 우리가 반복하는 것이 곧 우리가 됩니다. 이 카테고리가 당신에 대해 무엇을 말하길 바라는지 정하세요.',
    },
  ],
  'stoic.budget_pace': [
    {
      title: '‘{{category}}’ 예산이 {{day}}일에 바닥납니다',
      message:
        '{{limitAmount}} 중 {{spentAmount}}을(를) 썼고, 이 속도라면 한도는 {{day}}일쯤 끝납니다. 지금 속도를 늦추는 것이 나중에 멈추는 것보다 쉽습니다.',
    },
    {
      title: '‘{{category}}’ 항목이 달보다 앞서갑니다',
      message:
        '{{limitAmount}} 한도에서 벌써 {{spentAmount}}이(가) 나갔습니다. 이대로라면 {{day}}일에 소진됩니다. 남은 한 달은 아직 당신이 만들어 갈 수 있습니다.',
    },
    {
      title: '속도 점검: ‘{{category}}’',
      message:
        '지금 속도라면 {{limitAmount}} 예산은 {{day}}일 무렵까지 갑니다. 앞을 내다보는 것은 가장 값싼 절제입니다.',
    },
    {
      title: '‘{{category}}’ 항목이 미래를 당겨 씁니다',
      message:
        '{{limitAmount}} 중 {{spentAmount}}을(를) 썼고, 한도는 {{day}}일 가까이에서 끝납니다. 그렇게 될지는 이번 주에 하는 일이 정합니다.',
    },
    {
      title: '‘{{category}}’ 조기 경고',
      message:
        '지금 속도로는 {{limitAmount}} 한도가 월말까지 가지 못하고 {{day}}일쯤 바닥납니다. 대가가 작을 때 조정하세요.',
    },
  ],
  'stoic.budget_unused': [
    {
      title: '‘{{category}}’ 예산을 쓰지 않고 있습니다',
      message:
        '‘{{category}}’ 예산에 {{months}}개월 동안 지출이 없습니다. 이미 필요 없어졌거나, 아직 기다리는 의도입니다. 어느 쪽인지 정하세요.',
    },
    {
      title: '빈 예산: ‘{{category}}’',
      message:
        '{{months}}개월 동안 지출이 한 건도 없습니다. 계획은 지금 사는 삶이나 만들어 가는 삶을 그려야 합니다. 이것은 어느 쪽입니까?',
    },
    {
      title: '‘{{category}}’ 예산이 놀고 있습니다',
      message:
        '{{months}}개월 동안 여기에 쓴 돈이 없습니다. 절제였다면 잘하셨습니다. 방치였다면 행동하세요.',
    },
    {
      title: '계획했지만 살지 않았습니다',
      message:
        '‘{{category}}’에는 한도가 있지만 {{months}}개월 동안 지출이 없습니다. 계획을 정직하게 유지하세요. 지우거나, 쓰거나.',
    },
    {
      title: '‘{{category}}’: 조용한 {{months}}개월',
      message:
        '한 번도 손대지 않은 예산도 계획 안에서 자리를 차지합니다. 자리를 비우거나 의도를 지키세요.',
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: '지출의 {{percent}}%에 한도가 없습니다',
      message:
        '이번 달 {{unbudgetedAmount}}이(가) 어떤 예산도 지켜보지 않는 카테고리로 갔습니다. 측정하지 않는 것은 다스리기 어렵습니다.',
    },
    {
      title: '이번 달의 많은 부분이 계획 밖입니다',
      message:
        '지출의 {{percent}}%({{unbudgetedAmount}})가 어떤 예산에도 들어 있지 않습니다. 그중 가장 큰 것에 한도를 주면 계획이 당신의 삶을 더 많이 보게 됩니다.',
    },
    {
      title: '계획 밖의 지출',
      message:
        '예산은 지출의 일부만 다룹니다. {{unbudgetedAmount}}({{percent}}%)는 측정되지 않습니다. 돈이 실제로 가는 곳까지 계획을 넓히세요.',
    },
    {
      title: '계획이 그림의 일부만 봅니다',
      message:
        '이번 달 지출의 {{percent}}%에 예산이 없습니다. 분명히 보는 것이 좋은 판단보다 먼저입니다.',
    },
    {
      title: '한도 없이 {{unbudgetedAmount}}을(를) 썼습니다',
      message:
        '이번 달의 {{percent}}%입니다. 제한할 필요는 없습니다. 그중 얼마를 정말 원하는지만 정하세요.',
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '여가 대부분이 ‘{{category}}’입니다',
      message:
        '여가 지출의 {{percent}}%가 ‘{{category}}’에 갔습니다. 하나의 즐거움에 기대기보다 다양한 휴식이 더 건강합니다.',
    },
    {
      title: '하나의 즐거움이 지배합니다',
      message:
        '‘{{category}}’ 항목이 여가 지출 전체의 {{percent}}%를 차지합니다. 아직도 기쁨을 주는지, 일상이 되어 버렸는지 물어보세요.',
    },
    {
      title: '여가가 ‘{{category}}’에 기대고 있습니다',
      message:
        '여가의 {{percent}}%가 한곳에 몰려 있습니다. 없이는 못 사는 것이 우리를 붙잡습니다. 그 손아귀가 아직 가벼운지 확인하세요.',
    },
    {
      title: '‘{{category}}’: 여가의 {{percent}}%',
      message:
        '단 하나의 즐거움이 거의 전부를 차지합니다. 이번 달에는 더 저렴하고 다른 즐거움을 하나 시도해 보고 비교해 보세요.',
    },
    {
      title: '당신의 휴식에는 주소가 하나뿐입니다',
      message:
        '여가 비용의 대부분인 {{percent}}%가 ‘{{category}}’(으)로 갑니다. 다른 것도 즐길 수 있는 것 또한 자유입니다.',
    },
  ],
  'stoic.unclassified': [
    {
      title: '아직 판단하지 않은 지출이 있습니다',
      message:
        '분류되지 않은 카테고리: {{count}}개. 예산에서 무엇이 필수, 일, 덕, 여가인지 정하세요.',
    },
    {
      title: '{{count}}개 카테고리가 판단을 기다립니다',
      message:
        '지출은 있지만 분류가 없어 조언이 이들을 따져 볼 수 없습니다. 예산에서 1분이면 해결됩니다.',
    },
    {
      title: '돈이 무엇을 위해 쓰이는지 이름 붙이세요',
      message:
        '{{count}}개 카테고리가 아직 분류되지 않았습니다. 판단은 사물을 바른 이름으로 부르는 데서 시작합니다.',
    },
    {
      title: '판단되지 않은 지출: {{count}}개 카테고리',
      message:
        '필요인가, 일인가, 덕인가, 즐거움인가? 답할 수 있는 사람은 당신뿐입니다. 답하고 나면 계획이 더 분명해집니다.',
    },
    {
      title: '분류가 없는 카테고리가 있습니다',
      message:
        '{{count}}개 카테고리가 네 가지 분류 밖에 있습니다. 예산에서 분류해 모든 지출이 제 모습 그대로 보이게 하세요.',
    },
  ],
  'stoic.small_purchases': [
    {
      title: '{{merchant}}에서 소액 결제 {{count}}번',
      message:
        '하나하나는 사소해 보였지만 이번 달 합계는 {{totalAmount}}입니다. 살피지 않은 작은 습관이 돈이 조용히 새는 곳입니다.',
    },
    {
      title: '{{merchant}}: 이번 달 {{count}}번',
      message:
        '작은 금액이 모여 {{totalAmount}}입니다. 매번의 방문이 선택이었는지 반사였는지 물어보세요. 자유는 앞의 것뿐입니다.',
    },
    {
      title: '조금씩 모여 {{totalAmount}}',
      message:
        '{{merchant}}에서 {{count}}번 결제했습니다. 한 번 한 번은 중요하지 않고, 습관이 중요합니다. 실제로 얼마나 자주 원하는지 정하세요.',
    },
    {
      title: '{{merchant}}에서의 습관',
      message:
        '{{count}}번 결제, 합계 {{totalAmount}}. 이번 달에는 세 번 중 한 번을 건너뛰고 아쉬운지 확인해 보세요.',
    },
    {
      title: '작은 것이 쌓입니다',
      message:
        '{{merchant}}에서 {{count}}번, {{totalAmount}}을(를) 썼습니다. 큰 결정을 다스리는 힘은 이런 작은 결정 위에 세워집니다.',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: '여가의 {{percent}}%가 주말입니다',
      message:
        '여가 지출 대부분이 토요일과 일요일에 일어납니다. 휴식은 좋습니다. 그것이 한 주에 대한 보상이 아니라 휴식인지 확인하세요.',
    },
    {
      title: '여가는 주말에 삽니다',
      message:
        '여가 지출의 {{percent}}%가 주말에 몰려 있습니다. 주말을 조금만 계획하면 돈은 덜 들고 얻는 것은 더 많아집니다.',
    },
    {
      title: '주말이 한 주 몫까지 씁니다',
      message:
        '주말이 여가 지출의 {{percent}}%를 차지합니다. 토요일마다 한 주를 수리해야 한다면, 한 주 자체를 들여다보세요.',
    },
    {
      title: '토요일과 일요일: 여가의 {{percent}}%',
      message:
        '자유로운 날은 가벼운 지출을 부릅니다. 주말이 오기 전에 무엇을 위한 시간인지 정하고, 돈은 그 뒤를 따르게 하세요.',
    },
    {
      title: '주말의 패턴',
      message:
        '여가 지출의 {{percent}}%가 주말에 일어납니다. 평일이 여유로우면 주말은 대개 덜 비쌉니다.',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}}이(가) 이번 달의 {{percent}}%를 가져갔습니다',
      message:
        '여가에 쓴 {{totalAmount}}이(가) 한 가맹점으로 갔습니다. 한 곳이 그만큼의 돈을 가져간다면, 당신의 관심은 얼마나 가져가는지도 물어보세요.',
    },
    {
      title: '한 곳에 {{totalAmount}}',
      message:
        '{{merchant}}이(가) 이번 달 지출의 {{percent}}%입니다. 당신이 일해 번 것에서 그만한 몫을 내줄 가치가 있습니까?',
    },
    {
      title: '지출 1위는 {{merchant}}',
      message:
        '이번 달의 {{percent}}%, {{totalAmount}}이(가) 그곳으로 갔습니다. 즐기는 것은 잘못이 아닙니다. 다시 고를 수 있다면 말이죠.',
    },
    {
      title: '{{merchant}}에 큰 몫',
      message:
        '여가 장소 한 곳에 {{totalAmount}}, 지출의 {{percent}}%입니다. 즐거움과 가격을 차분히 저울질해 보세요.',
    },
    {
      title: '{{merchant}}에 {{percent}}%',
      message:
        '이 가맹점 한 곳이 {{totalAmount}}을(를) 가져갔습니다. 자유란 원할 때 그 앞을 그냥 지나칠 수 있는 것입니다.',
    },
  ],
  'stoic.income_drop': [
    {
      title: '수입은 줄었는데 지출은 그대로입니다',
      message:
        '수입이 {{percent}}% 줄어 {{incomeAmount}}이(가) 되었지만 지출은 {{expenseAmount}} 그대로입니다. 운명은 마음을 바꿨는데, 지출은 아직 알아차리지 못했습니다.',
    },
    {
      title: '수입 {{percent}}% 감소',
      message:
        '{{incomeAmount}}이(가) 들어오고 {{expenseAmount}}이(가) 나갔습니다. 운명이 준 것은 다시 가져갈 수도 있습니다. 지출을 예전이 아니라 지금에 맞추세요.',
    },
    {
      title: '빠듯한 달, 같은 습관',
      message:
        '수입은 {{percent}}% 적은 {{incomeAmount}}인데 지출은 {{expenseAmount}}을(를) 유지했습니다. 수입은 당신의 권한 밖이지만, 대응은 당신의 몫입니다.',
    },
    {
      title: '운명의 바람이 바뀌었습니다',
      message:
        '평소보다 {{percent}}% 적게 벌었지만 예전처럼 {{expenseAmount}}을(를) 썼습니다. 아직 선택일 때, 지금 줄이세요.',
    },
    {
      title: '지출이 수입을 따라가지 않았습니다',
      message:
        '수입은 {{incomeAmount}}(으)로 떨어졌고({{percent}}% 감소) 지출은 {{expenseAmount}}입니다. 돛은 실제로 부는 바람에 맞추세요.',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: '구독: 한 달에 {{monthlyAmount}}',
      message:
        '{{count}}개의 구독이 월 지출의 {{percent}}%를 차지합니다. 하나하나가 묻지 않고 갱신됩니다. 그러니 하나하나 직접 물어보세요.',
    },
    {
      title: '지출의 {{percent}}%가 스스로 갱신됩니다',
      message:
        '{{count}}개의 구독, 한 달에 {{monthlyAmount}}. 오늘 다시 가입하겠다고 생각되는 것만 남기세요.',
    },
    {
      title: '조용히 반복되는 {{monthlyAmount}}',
      message:
        '{{count}}개의 구독이 한 달 지출의 {{percent}}%를 씁니다. 편리함은 좋은 하인이지만 값비싼 주인입니다.',
    },
    {
      title: '점검할 구독 {{count}}개',
      message:
        '모두 합쳐 한 달에 {{monthlyAmount}}, 지출의 {{percent}}%입니다. 거의 쓰지 않는 것 하나를 해지하고, 얼마나 아쉽지 않은지 느껴 보세요.',
    },
    {
      title: '저절로 갱신되는 것들',
      message:
        '{{count}}개의 구독에 한 달 {{monthlyAmount}}. 자동으로 나가는 돈일수록 의도적인 점검이 필요합니다.',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: '성공이 조금 더 멀리 닿을 수 있습니다',
      message:
        '{{months}}개월 동안 수입의 {{savingsPercent}}%를 지켰지만, 다른 사람에게 간 돈은 거의 없습니다. 부는 펼친 손 안에 있을 때 가장 잘 머뭅니다. 이번 달에 선물이나 기부를 한 번 해 보면 어떨까요?',
    },
    {
      title: '잘 벌고, 적게 나눕니다',
      message:
        '{{months}}개월 동안 수입은 {{incomeAmount}}, 다른 사람에게 간 돈은 {{givenAmount}}입니다. 이 앱이 볼 수 없는 방식으로 돕고 있다면 무시하세요. 그렇지 않다면 계획에 그럴 여유가 있습니다.',
    },
    {
      title: '너그러워지기 좋은 때',
      message:
        '수입의 {{savingsPercent}}%를 저축했습니다. 손이 안정적이라는 표시입니다. 그중 작은 몫을 필요한 사람에게 건넨다면 그 안정이 더 큰 의미를 갖게 됩니다.',
    },
    {
      title: '아직 그림에 다른 사람이 없습니다',
      message:
        '최근 {{months}}개월은 신중하게 벌고 모았다는 것을 보여 주지만, 기부나 선물은 없습니다. 우리는 서로를 위해 태어났습니다. 시작하는 데는 소박한 선물 하나면 충분합니다.',
    },
    {
      title: '친절을 위한 자리',
      message:
        '{{incomeAmount}} 중 다른 사람을 돕는 데 쓰인 돈은 {{givenAmount}}뿐입니다. 작고 정기적인 기부를 생각해 보세요. 너그러움도 모든 덕처럼 습관이 되면 쉬워집니다.',
    },
  ],
  'stoic.goal_behind': [
    {
      title: '‘{{goal}}’ 목표가 뒤처지고 있습니다',
      message:
        '한 달에 {{requiredAmount}}이(가) 필요한데 약 {{paceAmount}}을(를) 넣고 있습니다. 이 속도라면 {{monthsLate}}개월 늦게 도달합니다.',
    },
    {
      title: '‘{{goal}}’: 이 속도면 {{monthsLate}}개월 지연',
      message:
        '필요한 금액은 월 {{requiredAmount}}, 실제는 약 {{paceAmount}}입니다. 날짜를 정직하게 옮기거나, 의도적으로 더 많은 돈을 옮기세요.',
    },
    {
      title: '목표와 속도가 어긋납니다',
      message:
        '‘{{goal}}’ 목표는 한 달에 {{requiredAmount}}을(를) 요구하지만 {{paceAmount}}을(를) 받고 있습니다. 목표는 매달 그쪽으로 내딛는 걸음만큼만 현실입니다.',
    },
    {
      title: '‘{{goal}}’에는 더 단단한 걸음이 필요합니다',
      message:
        '필요한 {{requiredAmount}}에 비해 한 달에 {{paceAmount}}입니다. 다음 달에는 선택적인 지출보다 목표에 먼저 넣으세요.',
    },
    {
      title: '‘{{goal}}’ 진행이 늦습니다',
      message:
        '지금 속도(월 {{paceAmount}})로는 {{monthsLate}}개월 늦어집니다. 지금의 작은 증액이 나중의 큰 희생보다 낫습니다.',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: '‘{{goal}}’ 목표가 계획에 들어가지 않습니다',
      message:
        '한 달에 {{requiredAmount}}이(가) 필요하지만 예산을 빼면 {{freeAmount}}만 남습니다. 날짜, 목표 금액, 예산 중 하나를 바꾸세요. 바람은 계획이 아닙니다.',
    },
    {
      title: '‘{{goal}}’ 목표가 여유보다 많이 요구합니다',
      message:
        '매달 {{requiredAmount}}이(가) 필요하고 쓸 수 있는 돈은 {{freeAmount}}입니다. 모든 것을 한꺼번에 원하면 아무것도 이루지 못합니다. 고르세요.',
    },
    {
      title: '숫자는 ‘아직은 아니다’라고 말합니다',
      message:
        '‘{{goal}}’ 목표는 한 달에 {{requiredAmount}}이(가) 필요하고, 여유 자금은 {{freeAmount}}입니다. 당신의 권한 안에 있는 것, 곧 기한이나 다른 한도를 조정하세요.',
    },
    {
      title: '‘{{goal}}’ 목표에 결정이 필요합니다',
      message:
        '월 {{requiredAmount}}은(는) 예산 후 남는 {{freeAmount}}을(를) 넘습니다. 희망으로 붙들고 있는 목표보다 눈을 뜨고 고른 목표가 낫습니다.',
    },
    {
      title: '‘{{goal}}’: 불가능한 속도',
      message:
        '필요한 금액은 월 {{requiredAmount}}, 여유는 {{freeAmount}}. 지금의 정직한 계산이 나중의 실망을 막아 줍니다.',
    },
  ],
  'stoic.shortfall': [
    {
      title: '{{date}}에 잔액이 0 아래로 내려갑니다',
      message:
        '다가오는 {{committedAmount}}의 결제로 예상 잔액이 {{lowestAmount}}까지 떨어집니다. 아직 예측일 뿐인 지금 준비하세요.',
    },
    {
      title: '자금 부족이 다가옵니다: {{date}}',
      message:
        '확정된 결제({{committedAmount}})가 잔액을 넘어 최저 {{lowestAmount}}까지 내려갑니다. 어려움을 미리 내다보면 그 힘이 약해집니다.',
    },
    {
      title: '{{date}}을(를) 대비하세요',
      message:
        '그날 예상 잔액은 {{lowestAmount}}에 이릅니다. 결제 하나를 옮기거나, 원하는 것 하나를 미루거나, 현금을 떼어 두세요. 모두 오늘 당신의 권한 안에 있습니다.',
    },
    {
      title: '약정된 결제가 잔액보다 많습니다',
      message:
        '{{committedAmount}}이(가) 나갈 예정이고, {{date}} 무렵 잔액이 {{lowestAmount}}까지 떨어집니다. 침착한 대응은 이른 대응입니다.',
    },
    {
      title: '{{date}}의 부족분을 내다보세요',
      message:
        '예상 최저 잔액: {{lowestAmount}}. 미리 본 일은 평정심으로 맞을 수 있지만, 불시에 닥친 일은 그러기 어렵습니다.',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: '스스로에게 한 약속을 지켰습니다',
      message:
        '{{months}}개월 연속 지출이 직접 세운 계획 안에 머물렀습니다. 이것이 자기 절제의 모습입니다.',
    },
    {
      title: '{{months}}개월 계획 안',
      message: '달마다 의도한 것과 한 일이 일치합니다. 꾸준함은 의지력보다 조용하고 더 오래갑니다.',
    },
    {
      title: '계획과 삶이 일치합니다',
      message:
        '{{months}}개월 연속 한도 안에 머물렀습니다. 이만큼 잘 지킨 계획은 더 이상 제약이 아니라 당신의 삶의 방식입니다.',
    },
    {
      title: '{{months}}개월째 안정적입니다',
      message: '예산이 {{months}}개월 연속 지켜졌습니다. 같은 주의를 유지하세요. 잘되고 있습니다.',
    },
    {
      title: '이어지는 절제',
      message:
        '{{months}}개월 동안 계획을 깨지 않았습니다. 자신의 결정을 믿을 수 있다는 것만큼 자유로운 일은 드뭅니다.',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: '돈이 당신의 가치를 따릅니다',
      message:
        '덕이 지출의 {{actual}}%를 차지해 계획한 {{planned}}%에 못지않습니다. 잘 쓰셨습니다.',
    },
    {
      title: '덕이 제 몫을 다 받았습니다',
      message:
        '건강, 배움, 타인에 {{actual}}%, 계획은 {{planned}}%였습니다. 소중히 여기는 것에 제대로 돈을 냈습니다.',
    },
    {
      title: '더 나아지는 데 썼습니다',
      message:
        '이번 달 덕이 지출의 {{actual}}%에 이르렀습니다(계획 {{planned}}%). 그 돈은 쓰고 난 뒤에도 오래 당신을 위해 일합니다.',
    },
    {
      title: '의도가 실행되었습니다',
      message:
        '덕에 {{planned}}%를 계획하고 {{actual}}%를 썼습니다. 좋은 의도가 한 달을 버티는 일은 드문데, 당신의 의도는 버텼습니다.',
    },
    {
      title: '돈을 가장 잘 쓰는 법',
      message: '{{actual}}%가 당신과 다른 사람을 더 낫게 하는 데 쓰였습니다. 계속 그렇게 고르세요.',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: '여가가 제자리에 있습니다',
      message:
        '여가는 지출의 {{actual}}%로, 허용한 {{planned}}%보다 낮습니다. 무언가를 즐기되 그것에 지배당하지 않고 있습니다.',
    },
    {
      title: '알맞은 크기의 즐거움',
      message:
        '여가는 {{actual}}%, 계획은 {{planned}}%였습니다. 절제는 놓치는 것이 아니라 고르는 것입니다.',
    },
    {
      title: '지나치지 않은 휴식',
      message:
        '여가 {{actual}}%로 한도 {{planned}}%보다 낮습니다. 즐거움은 주인 노릇을 하지 않을 때 더 맛있습니다.',
    },
    {
      title: '조용한 절제',
      message:
        '여가에 {{planned}}%를 주었는데 {{actual}}%만 썼습니다. 그 여유는 당신이 지켜 낸 자유입니다.',
    },
    {
      title: '계획보다 적은 여가',
      message:
        '여가는 지출의 {{actual}}%로, 정해 둔 {{planned}}% 안에 머물렀습니다. 잘 지켰습니다.',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: '계획보다 {{percent}}% 적게',
      message:
        '이번 달은 스스로 허락한 것보다 {{savedAmount}} 적게 썼습니다. 가질 수 있는 모든 것이 필요하지는 않다는 것, 그것도 일종의 부입니다.',
    },
    {
      title: '{{savedAmount}}이(가) 남았습니다',
      message:
        '이번 달은 계획보다 {{percent}}% 적었습니다. 쓰지 않은 돈이 어디로 갈지는 아직 당신이 정할 수 있습니다.',
    },
    {
      title: '허락한 것보다 적게',
      message:
        '지출이 계획보다 {{percent}}% 적어 {{savedAmount}}을(를) 지켰습니다. 습관이 차지하기 전에 그 여유에 목적을 주세요.',
    },
    {
      title: '계획에 여유가 있었습니다',
      message:
        '이번 달은 한도보다 {{savedAmount}} 적게 썼습니다. 쉽게 느껴지는 절제가 오래가는 절제입니다.',
    },
    {
      title: '계획보다 가볍게',
      message:
        '예산보다 {{percent}}% 적게 필요했습니다. 그 {{savedAmount}}을(를) 목표로 보내는 것을 생각해 보세요.',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '‘{{goal}}’ 목표가 일정대로입니다',
      message:
        '목표에 필요한 속도로 {{percent}}%까지 왔습니다. 매달 내딛는 꾸준한 걸음은 멀리 갑니다.',
    },
    {
      title: '‘{{goal}}’ 목표가 순조롭습니다',
      message:
        '{{percent}}% 달성, 속도도 유지되고 있습니다. 계속 목표에 먼저 넣으세요. 잘되고 있습니다.',
    },
    {
      title: '‘{{goal}}’: {{percent}}%, 꾸준히',
      message: '목표가 매달 필요한 만큼을 받고 있습니다. 인내가 제 일을 하고 있습니다.',
    },
    {
      title: '목표가 계획대로 나아갑니다',
      message:
        '‘{{goal}}’ 목표가 {{percent}}% 채워졌고 일정대로입니다. 매달 조금씩 하는 일은 한 번의 나쁜 주로 멈추지 않습니다.',
    },
    {
      title: '믿을 수 있는 진전',
      message:
        '‘{{goal}}’ 목표가 {{percent}}%로 속도를 지키고 있습니다. 유일하게 통하는 방법, 곧 조금씩 쌓아 가고 있습니다.',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: '{{merchant}}에서 충동구매가 줄었습니다',
      message:
        '지난달 {{before}}번에서 이번 달 약 {{after}}번으로 줄었습니다. 느슨해진 습관만큼 자유를 얻습니다.',
    },
    {
      title: '{{merchant}}: {{before}} → {{after}}',
      message: '예전보다 덜 찾습니다. 건너뛴 반사 하나하나가 습관에 대한 선택의 작은 승리입니다.',
    },
    {
      title: '작은 습관이 줄어듭니다',
      message:
        '{{merchant}}에서의 결제가 {{before}}번에서 약 {{after}}번으로 줄었습니다. 계속하세요. 점점 쉬워집니다.',
    },
    {
      title: '반사보다 선택',
      message:
        '{{merchant}}에서 {{before}}번이던 결제가 약 {{after}}번이 되었습니다. 결정 하나하나로 쌓은 자기 통제입니다.',
    },
    {
      title: '자잘한 지출이 줄었습니다',
      message:
        '{{merchant}}에 {{before}}번이 아니라 약 {{after}}번 갔습니다. 작은 승리는 쌓입니다.',
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: '빠듯한 달에 잘 적응했습니다',
      message:
        '수입이 {{incomePercent}}% 줄었고, 지출을 {{expensePercent}}% 줄였습니다. 운명의 변화에 방향의 변화로 응했습니다.',
    },
    {
      title: '수입이 줄어도 침착했습니다',
      message:
        '수입 {{incomePercent}}% 감소, 지출 {{expensePercent}}% 감소. 예전이 아니라 지금에 맞췄습니다.',
    },
    {
      title: '운명이 바뀌었고, 당신도 바뀌었습니다',
      message:
        '수입 {{incomePercent}}% 감소에 지출 {{expensePercent}}% 감소로 답했습니다. 숫자로 나타난 평정심입니다.',
    },
    {
      title: '잘 잡은 키',
      message:
        '수입이 {{incomePercent}}% 줄었을 때 지출도 따라갔습니다({{expensePercent}}% 감소). 바람은 당신의 것이 아니었지만, 돛은 당신의 것이었습니다.',
    },
    {
      title: '지출이 수입을 따라 내려갔습니다',
      message:
        '수입이 {{incomePercent}}% 줄자 {{expensePercent}}% 덜 썼습니다. 일찍 적응하는 것이 차분하게 지나가는 길입니다.',
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: '필수 지출이 안정적입니다',
      message:
        '{{months}}개월 동안 기본 비용이 거의 움직이지 않았습니다. 안정된 바닥이 그 위의 자유를 줍니다.',
    },
    {
      title: '필요가 통제되고 있습니다',
      message:
        '필수 지출이 {{months}}개월 동안 제자리입니다. 자라지 않는 필요는 당신이 다스리는 필요입니다.',
    },
    {
      title: '{{months}}개월간 안정된 기본 비용',
      message: '집세, 식비, 공과금이 그대로였습니다. 조용한 안정도 하나의 성취입니다.',
    },
    {
      title: '필수 지출이 슬금슬금 늘지 않았습니다',
      message:
        '{{months}}개월 동안 삶에 필요한 것이 흐트러지지 않았습니다. 이런 바탕 위에서는 다른 모든 것을 계획하기 쉽습니다.',
    },
    {
      title: '단단한 바닥',
      message:
        '기본 지출이 {{months}}개월째 안정적입니다. 편의가 필요인 척하도록 두지 않고 있습니다.',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: '번 것에 너그럽습니다',
      message:
        '{{months}}개월 동안 수입의 {{percent}}%({{givenAmount}})를 다른 사람을 돕는 데 썼습니다. 돈을 가장 잘 쓴 곳입니다.',
    },
    {
      title: '다른 사람에게 {{givenAmount}}',
      message:
        '{{months}}개월 동안 수입의 {{percent}}%를 나누었습니다. 숫자로 드러나는 친절은 느끼기만 한 친절이 아니라 실천한 친절입니다.',
    },
    {
      title: '펼친 손',
      message:
        '최근 기부와 선물이 수입의 {{percent}}%를 차지했습니다. 나누어 준 것은 어떤 불운도 빼앗을 수 없는 재산의 일부입니다.',
    },
    {
      title: '나눔이 계획의 일부입니다',
      message:
        '{{months}}개월 동안 다른 사람에게 {{givenAmount}}. 계속 이어 가세요. 남에게 베푼 선은 자신에게 베푼 선이기도 합니다.',
    },
    {
      title: '잘 나누었습니다',
      message:
        '번 돈의 {{percent}}%가 다른 사람을 돕는 데 쓰였습니다. 한 사람에 대해 이보다 많은 것을 말해 주는 습관은 드뭅니다.',
    },
  ],
  'stoic.praise_steady': [
    {
      title: '고칠 것이 없습니다',
      message: '지출이 의도한 대로입니다. 지금처럼 계속하세요.',
    },
    {
      title: '의도와 행동이 일치합니다',
      message: '이번 달은 계획한 모습 그대로입니다. 그 일치가 바로 이 모든 것의 목적입니다.',
    },
    {
      title: '차분한 한 달',
      message:
        '말할 만한 지나침도, 소홀함도 없습니다. 잘하셨습니다. 같은 주의를 다음 달로 가져가세요.',
    },
    {
      title: '모두 제자리입니다',
      message: '계획은 지켜졌고 바로잡을 것이 없습니다. 스스로 얻은 고요함을 누리세요.',
    },
    {
      title: '흔들림 없는 손',
      message: '이번 달은 계획대로 흘러갔습니다. 좋은 습관은 좋은 달을 평범해 보이게 만듭니다.',
    },
  ],
  'expert.pay_yourself_first': [
    {
      title: '자신에게 먼저 지급하세요',
      message:
        '조지 S. 클레이슨의 규칙: 버는 것의 일부는 당신이 간직할 몫이며, 적어도 10분의 1이어야 합니다. 지난 {{months}}개월 동안 {{savingsPercent}}%를 남기셨습니다. 수입이 들어오는 날, 다른 무엇보다 먼저 {{tenthAmount}}을(를) 떼어 두세요.',
    },
    {
      title: '10분의 1은 당신의 몫입니다',
      message:
        '『바빌론 부자들의 돈 버는 지혜』에서 얇은 지갑을 고치는 첫 번째 방법은 열 닢 중 한 닢을 간직하는 것입니다. 현재 저축률은 {{savingsPercent}}%입니다. 한 달에 {{tenthAmount}}이면 그 습관을 시작할 수 있습니다.',
    },
    {
      title: '쓰고 나서가 아니라, 쓰기 전에 저축하세요',
      message:
        '클레이슨의 조언은 간단합니다. 자신에게 먼저 지급하라는 것입니다. 최근 수입의 {{savingsPercent}}%가 남았습니다. 월급날 {{tenthAmount}}을(를) 떼어 두고, 지출은 남은 금액에 맞추세요.',
    },
    {
      title: '첫 동전은 당신의 것입니다',
      message:
        '클레이슨은 버는 것의 일부, 적어도 10분의 1은 자신에게 남겨야 한다고 말합니다. 지난 {{months}}개월 동안 {{savingsPercent}}%를 남기셨습니다. 매달 {{tenthAmount}}부터 자동으로 시작해 보세요.',
    },
    {
      title: '{{savingsPercent}}% 저축 — 규칙은 10%를 권합니다',
      message:
        '『바빌론 부자들의 돈 버는 지혜』의 말처럼 자신에게 먼저 지급하세요. 매달 {{tenthAmount}}을(를) 어떤 청구서보다 먼저 떼어 두는 것입니다. 먼저 한 저축은 남는 돈에 좌우되지 않습니다.',
    },
  ],
  'expert.rule_50_30_20': [
    {
      title: '50/30/20 점검',
      message:
        '엘리자베스 워런과 아멜리아 워런 티아기는 세후 소득의 50%를 필수 지출에, 30%를 원하는 것에, 20%를 저축에 쓰라고 제안합니다. 현재: {{needsPercent}}% / {{wantsPercent}}% / {{savingsPercent}}%.',
    },
    {
      title: '필수 {{needsPercent}}%, 원하는 것 {{wantsPercent}}%, 저축 {{savingsPercent}}%',
      message:
        '『All Your Worth』는 돈의 균형을 50/30/20으로 봅니다. 기준에서 가장 멀리 떨어진 항목을 계획과 비교해 보세요. 한 가지 변화가 가장 큰 도움이 되는 곳입니다.',
    },
    {
      title: '수입은 이렇게 나뉩니다',
      message:
        '필수 지출이 수입의 {{needsPercent}}%, 원하는 것이 {{wantsPercent}}%를 차지하고, {{savingsPercent}}%를 저축하고 있습니다. 『All Your Worth』의 50/30/20 균형은 판결이 아니라 유용한 거울입니다.',
    },
    {
      title: '균형 잡힌 돈의 공식',
      message:
        '워런과 티아기의 공식: 무슨 일이 있어도 내야 하는 것에 절반, 원하는 것에 30%, 미래에 20%. 현재 {{needsPercent}}/{{wantsPercent}}/{{savingsPercent}}입니다.',
    },
    {
      title: '50/30/20과 비교하면',
      message:
        '현재 비율은 필수 지출 {{needsPercent}}%, 원하는 것 {{wantsPercent}}%, 저축 {{savingsPercent}}%입니다. 이 책이 제시하는 필수 지출의 기준: 내일 직장을 잃어도 계속 내야 하는 것인가요?',
    },
  ],
  'expert.room_for_error': [
    {
      title: '오차를 위한 여유를 두세요',
      message:
        '모건 하우절의 조언: 일이 계획대로 되지 않을 경우를 계획하세요. 현재 잔액은 약 {{cushionDays}}일치 지출을 감당합니다. 흔히 쓰는 기준은 3개월, 즉 {{targetAmount}}입니다.',
    },
    {
      title: '{{cushionDays}}일의 쿠션',
      message:
        '『돈의 심리학』은 이를 오차를 위한 여유라고 부릅니다. 뜻밖의 일을 견디게 해 주는 여지입니다. 3개월치 지출인 {{targetAmount}}을(를) 향해 쌓아 가면 계획이 현실에서 살아남을 수 있습니다.',
    },
    {
      title: '가정의 안전마진',
      message:
        '하우절은 그레이엄의 안전마진을 개인의 돈에 적용합니다. 예비금이 {{cushionDays}}일치 지출뿐이라면, 나쁜 한 달이 좋은 계획을 무너뜨릴 수 있습니다. {{targetAmount}}을(를) 목표로 하세요.',
    },
    {
      title: '예상치 못한 일을 위한 자리',
      message:
        '예비금은 대략 {{cushionDays}}일 정도 버틸 수 있습니다. 뜻밖의 일은 유일하게 확실한 것입니다. 3개월치 지출({{targetAmount}})이 널리 쓰이는 목표입니다.',
    },
    {
      title: '필요해지기 전에 여유를 만드세요',
      message:
        '모건 하우절의 말대로, 오차를 위한 여유가 당신을 게임에 남아 있게 합니다. 현재 약 {{cushionDays}}일이 확보되어 있으며, {{targetAmount}}이면 3개월을 감당할 수 있습니다.',
    },
  ],
  'expert.lifestyle_creep': [
    {
      title: '지출이 수입을 앞지르고 있습니다',
      message:
        '지난 분기 지출은 {{expenseGrowth}}% 늘었고 수입은 {{incomeGrowth}}% 변했습니다. 『이웃집 백만장자』의 첫 번째 규칙: 수입이 얼마이든 그보다 적게 쓰며 사세요.',
    },
    {
      title: '부유해지는 것이 아니라 호화로워지는 것',
      message:
        '스탠리와 댄코는 부란 쓴 것이 아니라 모은 것임을 발견했습니다. 지출은 {{expenseGrowth}}%, 수입은 {{incomeGrowth}}% 늘었습니다. 그 차이로 부가 새어 나갑니다.',
    },
    {
      title: '라이프스타일 인플레이션: +{{expenseGrowth}}%',
      message:
        '지출이 수입({{incomeGrowth}}%)보다 빠르게 늘었습니다. 『이웃집 백만장자』 속 사람들은 수입이 늘어도 지출이 따라가지 않게 하여 부를 지켰습니다.',
    },
    {
      title: '골대가 움직이고 있습니다',
      message:
        '지출이 전 분기 대비 {{expenseGrowth}}% 늘었고, 수입은 {{incomeGrowth}}%입니다. 스탠리와 댄코는 말합니다. 수입이 얼마든, 그보다 적게 쓰며 살라고.',
    },
    {
      title: '부는 남기는 것입니다',
      message:
        '좋은 수입도 전부 써 버리면 아무도 부유해지지 않습니다. 지난 분기 지출은 {{expenseGrowth}}%, 수입은 {{incomeGrowth}}% 늘었습니다. 새로운 일상이 되기 전에 살펴볼 만합니다.',
    },
  ],
  'expert.life_energy': [
    {
      title: '{{merchant}}에 인생의 {{hours}}시간이 들었습니다',
      message:
        '비키 로빈과 조 도밍게즈는 물건의 값을 생명 에너지, 즉 그것에 드는 노동 시간으로 매겨 보라고 제안합니다. 이번 달 {{merchant}}에서 쓴 {{totalAmount}}은(는) 약 {{hours}}시간입니다. 그만한 가치가 있었나요?',
    },
    {
      title: '{{merchant}}에서 {{hours}}시간',
      message:
        '『Your Money or Your Life』는 돈을 그것과 맞바꾼 시간으로 보라고 합니다. 평균 시간당 수입으로 따지면, 그곳에서 쓴 {{totalAmount}}은(는) 대략 {{hours}}시간의 노동입니다.',
    },
    {
      title: '시간으로 값을 매겨 보세요',
      message:
        '{{merchant}}에서 쓴 {{totalAmount}}은(는) 약 {{hours}}시간의 노동입니다. 로빈과 도밍게즈는 이를 생명 에너지라고 부릅니다. 다시 벌 수 없는 유일한 화폐입니다.',
    },
    {
      title: '{{merchant}}의 진짜 비용',
      message:
        '돈은 우리가 생명 에너지와 맞바꾸는 것입니다. 이번 달 {{merchant}}은(는) 당신의 약 {{hours}}시간({{totalAmount}})을 가져갔습니다. 즐거움이 그 시간에 걸맞았나요?',
    },
    {
      title: '생명 에너지 점검',
      message:
        '평균 시간당 수입으로 환산하면, {{merchant}}에서 쓴 {{totalAmount}}은(는) 약 {{hours}}시간입니다. 『Your Money or Your Life』는 그것이 그만큼의 충족감을 주었는지 물어보라고 권합니다.',
    },
  ],
};
