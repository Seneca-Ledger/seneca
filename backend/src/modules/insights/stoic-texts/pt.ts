import type { StoicTextMap } from './types';

export const pt: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: 'O mês ficou maior que o plano',
      message:
        'Você planejou {{plannedAmount}} e já gastou {{spentAmount}} — {{percent}}% a mais. O plano foi feito com a cabeça fria; deixe que ele fale mais alto que o momento.',
    },
    {
      title: '{{percent}}% além do que você pretendia gastar',
      message:
        'Os gastos estão em {{spentAmount}}, para um plano de {{plannedAmount}}. Veja qual limite cedeu primeiro — é ali que está a lição.',
    },
    {
      title: 'Seu plano e seu mês discordam',
      message:
        '{{spentAmount}} gastos, {{plannedAmount}} pretendidos. Ou o plano pediu pouco demais à realidade, ou a realidade pediu demais a você — decida qual, com calma.',
    },
    {
      title: 'Saiu mais do que você permitiu',
      message:
        'O mês está {{percent}}% acima dos {{plannedAmount}} que você definiu. Nada se perde parando agora; muito se perde fingindo que não aconteceu.',
    },
    {
      title: 'Um limite que você pôs, um limite que você cruzou',
      message:
        'Você queria gastar {{plannedAmount}}; foram {{spentAmount}}. Domínio de si não é nunca tropeçar — é perceber cedo e voltar ao caminho.',
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: 'O lazer leva mais do que o planejado',
      message:
        'Você quis destinar {{planned}}% dos gastos ao lazer; este mês foram {{actual}}%. O prazer é bem-vindo como hóspede, não como dono da casa.',
    },
    {
      title: 'Lazer em {{actual}}%, planejado {{planned}}%',
      message:
        'O descanso merece seu lugar quando restaura você. Pergunte quais prazeres deste mês fizeram isso, e deixe os outros irem sem arrependimento.',
    },
    {
      title: 'O conforto está gastando mais que a intenção',
      message:
        'O lazer ocupa {{actual}}% dos gastos, contra os {{planned}}% que você escolheu. Moderação não é recusar o prazer — é mantê-lo do tamanho que você decidiu.',
    },
    {
      title: 'O agradável empurra o planejado',
      message:
        'Você deu ao lazer {{planned}}% do plano e ele levou {{actual}}%. O que se desfruta com facilidade merece um segundo olhar antes de virar necessidade.',
    },
    {
      title: 'O lazer passou da sua linha',
      message:
        '{{actual}}% do mês foram para o lazer; a intenção era {{planned}}%. A linha foi você quem traçou, e mantê-la também está nas suas mãos.',
    },
  ],
  'stoic.leisure_habit': [
    {
      title: 'O lazer passou do plano de novo',
      message:
        'O lazer passou do seu plano em {{months}} dos últimos {{window}} meses. A repetição já não é acaso — é um hábito que vale examinar.',
    },
    {
      title: '{{months}} de {{window}} meses acima do plano de lazer',
      message:
        'O que acontece uma vez é circunstância; o que acontece {{months}} vezes é caráter em formação. Escolha esse caráter de propósito.',
    },
    {
      title: 'O mesmo deslize, mês após mês',
      message:
        'O lazer estourou o plano em {{months}} de {{window}} meses. Ou você aumenta o plano com honestidade, ou muda o hábito — viver entre os dois é o que mais custa.',
    },
    {
      title: 'Um padrão, não um lapso',
      message:
        'Em {{months}} dos últimos {{window}} meses o lazer levou mais do que você lhe deu. Repare no momento em que a decisão é tomada, não só na conta depois.',
    },
    {
      title: 'O hábito está votando contra seu plano',
      message:
        'O lazer venceu o plano {{months}} vezes em {{window}} meses. Hábitos se constroem uma escolha de cada vez; e é assim também que se desfazem.',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: 'A virtude recebe menos do que o pretendido',
      message:
        'Você reservou {{planned}}% do orçamento para saúde, aprendizado e os outros; até agora foram {{actual}}%. Uma intenção só conta quando é cumprida.',
    },
    {
      title: 'Virtude em {{actual}}% de {{planned}}% planejados',
      message:
        'O dinheiro que você separou para o que o torna melhor ainda está esperando. Não há momento melhor para gastá-lo bem do que este mês.',
    },
    {
      title: 'O bem que você planejou ainda não foi gasto',
      message:
        'Saúde, aprendizado e generosidade iam receber {{planned}}% dos gastos; receberam {{actual}}%. Faça uma dessas coisas esta semana, de propósito.',
    },
    {
      title: 'Intenção sem ação',
      message:
        'A virtude ocupa {{actual}}% dos gastos, contra os {{planned}}% que você escolheu. O que valorizamos aparece naquilo que de fato pagamos.',
    },
    {
      title: 'Ainda há espaço para o que importa',
      message:
        'Só {{actual}}% foram para a virtude, embora você tenha planejado {{planned}}%. Um livro, um check-up, um presente para quem precisa — o plano já disse sim.',
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: 'A virtude segue sendo adiada',
      message:
        'Os gastos com saúde, aprendizado e os outros estão abaixo do seu plano há {{months}} meses seguidos. O que você adia sempre, na prática já recusou.',
    },
    {
      title: '{{months}} meses de virtude adiada',
      message:
        'Todo mês o plano abriu espaço para o que torna você melhor, e todo mês esse espaço ficou vazio. O tempo é a única coisa que não se orça duas vezes.',
    },
    {
      title: 'Sua melhor versão ainda está esperando',
      message:
        'A virtude está abaixo do plano há {{months}} meses. Comece pequeno e certo, em vez de grande e depois.',
    },
    {
      title: 'As boas intenções estão envelhecendo',
      message:
        'Há {{months}} meses saúde, aprendizado e generosidade recebem menos do que o planejado. Escolha uma e pague por ela primeiro no mês que vem, antes de qualquer outra coisa.',
    },
    {
      title: 'A virtude segue perdendo para o “depois”',
      message:
        '{{months}} meses seguidos abaixo do plano. “Depois” é onde as boas intenções vão para ser esquecidas — dê uma data a esta.',
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: 'Seu plano não tem espaço para a virtude',
      message:
        'Nenhum dos seus orçamentos serve à saúde, ao aprendizado ou aos outros. Um plano mostra o que valorizamos — considere dar à virtude uma linha própria.',
    },
    {
      title: 'Orçamento para tudo, menos para o bem',
      message:
        'Necessidade, trabalho e lazer têm limites; a virtude não tem nenhum. O que nunca é planejado tende a nunca acontecer.',
    },
    {
      title: 'Planeje para o que torna você melhor',
      message:
        'Ainda não há orçamento na classe virtude. Mesmo um pequeno — livros, esporte, uma doação — transforma um desejo em compromisso.',
    },
    {
      title: 'O plano se cala sobre a virtude',
      message:
        'Você orça o que precisa e o que aprecia, mas ainda não quem você quer se tornar. Um modesto orçamento de virtude mudaria isso.',
    },
    {
      title: 'A virtude não tem orçamento',
      message:
        'Gastos com saúde, aprendizado ou os outros não estão planejados em lugar nenhum. Escolha um e dê a ele um limite que você ficaria feliz em alcançar.',
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: 'A necessidade custa mais do que o planejado',
      message:
        'Você planejou {{planned}}% dos gastos para necessidade; ela leva {{actual}}%. Verifique se cada item ainda é uma necessidade ou virou, em silêncio, um conforto.',
    },
    {
      title: 'Necessidade em {{actual}}%, planejado {{planned}}%',
      message:
        'O que a vida exige costuma ser menos do que aquilo a que nos acostumamos. Olhe com olhos novos para o seu maior gasto de necessidade.',
    },
    {
      title: 'O essencial está inchando',
      message:
        'A necessidade ocupa {{actual}}% do mês, contra os {{planned}}% que você esperava. Uma necessidade que não para de crescer merece uma pergunta.',
    },
    {
      title: 'As necessidades estão passando do plano',
      message:
        'Planejado {{planned}}%, real {{actual}}%. Ou o plano subestimou os custos reais, ou alguns desejos estão viajando com nome de necessidade.',
    },
    {
      title: 'Mais gasto com o “tem que” do que o pretendido',
      message:
        'A necessidade levou {{actual}}% dos gastos em vez de {{planned}}%. Separe o que realmente precisa ser do que apenas sempre foi.',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: 'A necessidade sobe aos poucos',
      message:
        'Os gastos com necessidade subiram {{months}} meses seguidos, {{percent}}% no total. As necessidades crescem em silêncio quando ninguém pede que se justifiquem.',
    },
    {
      title: '+{{percent}}% em necessidade em {{months}} meses',
      message:
        'Cada passo parecia pequeno; juntos, não são. Pegue o maior gasto necessário recorrente e pergunte se ele ainda precisa custar tanto.',
    },
    {
      title: 'O piso dos seus gastos está subindo',
      message:
        'A necessidade cresceu {{months}} meses consecutivos (+{{percent}}%). Um piso que sobe deixa menos espaço para tudo o que você escolhe livremente.',
    },
    {
      title: 'As necessidades estão se expandindo',
      message:
        '{{months}} meses de alta, {{percent}}% no total. O teste estoico é simples: você escolheria isso de novo hoje, sabendo o preço?',
    },
    {
      title: 'Pequenos aumentos, direção firme',
      message:
        'A necessidade subiu {{percent}}% em {{months}} meses. A direção importa mais do que qualquer mês isolado — esta vale a pena corrigir cedo.',
    },
  ],
  'stoic.work_over_plan': [
    {
      title: 'O trabalho custa mais do que o planejado',
      message:
        'Você planejou {{planned}}% dos gastos para trabalho; ele leva {{actual}}%. Ferramentas e serviços devem se pagar — verifique quais se pagam.',
    },
    {
      title: 'Gastos de trabalho em {{actual}}%, planejado {{planned}}%',
      message:
        'Investir no seu trabalho é bom quando traz retorno. Reveja o que você paga e já não usa.',
    },
    {
      title: 'O orçamento de trabalho está esticado',
      message:
        'O trabalho levou {{actual}}% em vez de {{planned}}%. Diligência é fazer bem o trabalho, não comprar todas as ferramentas para ele.',
    },
    {
      title: 'As ferramentas estão passando do plano',
      message:
        'Planejado {{planned}}%, gasto {{actual}}% com trabalho. Pergunte a cada despesa: ela me ajuda a trabalhar, ou só parece progresso?',
    },
    {
      title: 'Os custos de trabalho se desviaram',
      message:
        'O trabalho ocupa {{actual}}% dos gastos, contra {{planned}}% pretendidos. Uma revisão rápida agora poupa uma maior depois.',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '«{{category}}» passa do limite de novo',
      message:
        '«{{category}}» estourou o orçamento em {{months}} dos últimos {{window}} meses. Ou o limite está errado, ou o desejo — decida qual.',
    },
    {
      title: '«{{category}}»: acima do orçamento em {{months}} de {{window}} meses',
      message:
        'Um limite sempre ultrapassado não é limite, é só um desejo. Torne-o honesto — aumente-o de propósito ou mantenha-o de propósito.',
    },
    {
      title: 'O mesmo orçamento cede outra vez',
      message:
        '«{{category}}» ultrapassou o limite {{months}} vezes em {{window}} meses. A repetição é informação; use-a.',
    },
    {
      title: '«{{category}}» pede sua atenção',
      message:
        'Acima do orçamento em {{months}} de {{window}} meses. Observe o momento antes da compra — é o único lugar onde o hábito pode mudar.',
    },
    {
      title: 'Um padrão em «{{category}}»',
      message:
        '{{months}} estouros em {{window}} meses. Aquilo que repetimos, nós nos tornamos; decida o que você quer que esta categoria diga sobre você.',
    },
  ],
  'stoic.budget_pace': [
    {
      title: '«{{category}}» acaba por volta do dia {{day}}',
      message:
        'Você gastou {{spentAmount}} de {{limitAmount}}, e neste ritmo o limite termina por volta do dia {{day}}. Desacelerar agora é mais fácil do que parar depois.',
    },
    {
      title: '«{{category}}» está à frente do mês',
      message:
        '{{spentAmount}} já saíram de um limite de {{limitAmount}}. Nesse ritmo ele se esgota por volta do dia {{day}} — o resto do mês ainda é seu para moldar.',
    },
    {
      title: 'Checagem de ritmo: «{{category}}»',
      message:
        'No ritmo atual, o orçamento de {{limitAmount}} dura até por volta do dia {{day}}. A previdência é a forma mais barata de disciplina.',
    },
    {
      title: '«{{category}}» está gastando o futuro',
      message:
        '{{spentAmount}} de {{limitAmount}} gastos; o limite termina perto do dia {{day}}. O que você fizer esta semana decide se isso acontece.',
    },
    {
      title: 'Aviso antecipado para «{{category}}»',
      message:
        'No ritmo atual, o limite de {{limitAmount}} não chega ao fim do mês — acaba por volta do dia {{day}}. Ajuste enquanto custa pouco.',
    },
  ],
  'stoic.budget_unused': [
    {
      title: '«{{category}}» ficou sem uso',
      message:
        'O orçamento de «{{category}}» não teve gastos há {{months}} meses. Ou você o superou, ou é uma intenção que ainda espera — decida qual.',
    },
    {
      title: 'Um orçamento vazio: «{{category}}»',
      message:
        '{{months}} meses sem uma única despesa. Um plano deveria descrever a vida que você leva ou a que está construindo — qual é esta?',
    },
    {
      title: '«{{category}}» está parado',
      message:
        'Nada gasto aqui há {{months}} meses. Se foi contenção, muito bem; se foi descuido, aja.',
    },
    {
      title: 'Planejado, mas não vivido',
      message:
        '«{{category}}» tem limite e nenhum gasto há {{months}} meses. Mantenha o plano verdadeiro: remova-o ou use-o.',
    },
    {
      title: '«{{category}}»: {{months}} meses de silêncio',
      message:
        'Um orçamento que nunca é tocado ainda ocupa um lugar no seu plano. Libere o lugar ou honre a intenção.',
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: '{{percent}}% dos gastos sem limite',
      message:
        '{{unbudgetedAmount}} foram este mês para categorias que nenhum orçamento vigia. O que não é medido é difícil de dominar.',
    },
    {
      title: 'Boa parte do mês não está planejada',
      message:
        '{{percent}}% dos gastos — {{unbudgetedAmount}} — estão fora de qualquer orçamento. Dê um limite à maior parte disso, e o plano verá mais da sua vida.',
    },
    {
      title: 'Gastos fora do plano',
      message:
        'Os orçamentos cobrem só parte do que você gasta; {{unbudgetedAmount}} ({{percent}}%) ficam sem medida. Estenda o plano para onde o dinheiro realmente vai.',
    },
    {
      title: 'O plano vê só parte do quadro',
      message:
        '{{percent}}% dos gastos deste mês não têm orçamento. Ver com clareza vem antes de julgar bem.',
    },
    {
      title: '{{unbudgetedAmount}} gastos sem limite',
      message:
        'Isso é {{percent}}% do mês. Você não precisa restringir — só decidir quanto disso realmente quer.',
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '«{{category}}» é quase todo o seu lazer',
      message:
        '{{percent}}% dos gastos com lazer foram para «{{category}}». Variedade no descanso é mais saudável do que depender de um só prazer.',
    },
    {
      title: 'Um prazer domina',
      message:
        '«{{category}}» leva {{percent}}% de tudo o que você gastou com lazer. Pergunte se ainda traz alegria ou se virou rotina.',
    },
    {
      title: 'O lazer se apoia em «{{category}}»',
      message:
        '{{percent}}% do lazer num só lugar. Aquilo sem o qual não conseguimos viver nos prende — confira se a pegada ainda é leve.',
    },
    {
      title: '«{{category}}»: {{percent}}% do lazer',
      message:
        'Uma única fonte de prazer está levando quase tudo. Experimente este mês um prazer diferente e mais barato, e compare.',
    },
    {
      title: 'Seu descanso tem um só endereço',
      message:
        'A maior parte do dinheiro de lazer — {{percent}}% — vai para «{{category}}». Liberdade inclui conseguir aproveitar outras coisas também.',
    },
  ],
  'stoic.unclassified': [
    {
      title: 'Parte dos gastos ainda não foi avaliada',
      message:
        'Categorias sem classe: {{count}}. Decida em Orçamentos o que é necessidade, trabalho, virtude ou lazer.',
    },
    {
      title: 'Categorias aguardando seu julgamento: {{count}}',
      message:
        'Elas têm gastos, mas nenhuma classe, então o conselho não consegue pesá-las. Um minuto em Orçamentos resolve.',
    },
    {
      title: 'Dê nome ao que seu dinheiro serve',
      message:
        'Categorias ainda sem classificação: {{count}}. O julgamento começa por chamar as coisas pelo nome certo.',
    },
    {
      title: 'Gastos não avaliados — categorias: {{count}}',
      message:
        'É uma necessidade, seu trabalho, uma virtude ou um prazer? Só você pode dizer — e o plano fica mais claro assim que você diz.',
    },
    {
      title: 'Algumas categorias não têm classe',
      message:
        'Fora das quatro classes: {{count}}. Classifique-as em Orçamentos para que cada despesa seja vista pelo que é.',
    },
  ],
  'stoic.small_purchases': [
    {
      title: 'Pequenas compras em {{merchant}}: {{count}}',
      message:
        'Cada uma parecia trivial; juntas, somaram {{totalAmount}} este mês. É em hábitos pequenos e não examinados que a maior parte do dinheiro vai embora em silêncio.',
    },
    {
      title: '{{merchant}}: {{count}} vezes este mês',
      message:
        '{{totalAmount}} em pequenos valores. Pergunte se cada visita foi uma escolha ou um reflexo — só a primeira é liberdade.',
    },
    {
      title: 'Pouco a pouco: {{totalAmount}}',
      message:
        'Compras em {{merchant}}: {{count}}. Nenhuma importa sozinha; o hábito, sim. Decida com que frequência você realmente quer isso.',
    },
    {
      title: 'Um hábito em {{merchant}}',
      message:
        'Compras: {{count}}, {{totalAmount}} no total. Tente pular uma a cada três este mês e veja se sente falta.',
    },
    {
      title: 'As pequenas coisas se somam',
      message:
        '{{merchant}} viu você {{count}} vezes, por {{totalAmount}}. O domínio sobre as grandes decisões se constrói com pequenas como estas.',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: 'Os fins de semana carregam {{percent}}% do lazer',
      message:
        'A maior parte dos seus gastos com lazer acontece aos sábados e domingos. Descanso é bom; confira se é descanso e não compensação pela semana.',
    },
    {
      title: 'O lazer mora no fim de semana',
      message:
        '{{percent}}% dos gastos com lazer caem no fim de semana. Planeje um pouco o fim de semana, e ele custará menos e dará mais.',
    },
    {
      title: 'O fim de semana paga pela semana',
      message:
        'Os fins de semana levam {{percent}}% do que você gasta com lazer. Se a semana precisa de conserto todo sábado, olhe para a semana.',
    },
    {
      title: 'Sábado e domingo: {{percent}}% do lazer',
      message:
        'Dias livres convidam a gastos livres. Decida antes do fim de semana para que ele serve, e deixe o dinheiro seguir.',
    },
    {
      title: 'Um padrão de fim de semana',
      message:
        '{{percent}}% dos gastos com lazer acontecem no fim de semana. Mais leveza durante a semana costuma deixar os fins de semana mais baratos.',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}} levou {{percent}}% do mês',
      message:
        '{{totalAmount}} foram para um único estabelecimento de lazer. Quando um lugar tem tanto do seu dinheiro, pergunte quanto ele também tem da sua atenção.',
    },
    {
      title: 'Um só lugar, {{totalAmount}}',
      message:
        '{{merchant}} é {{percent}}% dos gastos deste mês. Ele vale essa fatia do fruto do seu trabalho?',
    },
    {
      title: '{{merchant}} lidera seus gastos',
      message:
        '{{percent}}% do mês — {{totalAmount}} — foram para lá. Nada de errado em aproveitar, desde que você escolhesse de novo.',
    },
    {
      title: 'Uma fatia grande em {{merchant}}',
      message:
        '{{totalAmount}}, ou {{percent}}% dos gastos, num só lugar de lazer. Pese o prazer contra o preço, com calma.',
    },
    {
      title: '{{percent}}% em {{merchant}}',
      message:
        'Este único estabelecimento levou {{totalAmount}}. Liberdade é poder passar direto quando você quiser.',
    },
  ],
  'stoic.income_drop': [
    {
      title: 'A renda caiu, os gastos não',
      message:
        'A renda caiu {{percent}}%, para {{incomeAmount}}, mas os gastos ficaram em {{expenseAmount}}. A fortuna mudou de ideia; seus gastos ainda não perceberam.',
    },
    {
      title: 'Renda {{percent}}% menor',
      message:
        'Entraram {{incomeAmount}} e saíram {{expenseAmount}}. O que a fortuna dá, ela pode tomar de volta — ajuste os gastos ao que é, não ao que era.',
    },
    {
      title: 'Um mês mais magro, os mesmos hábitos',
      message:
        'A renda está {{percent}}% menor ({{incomeAmount}}), enquanto os gastos se mantiveram em {{expenseAmount}}. A renda não está em seu poder; a resposta, sim.',
    },
    {
      title: 'A fortuna mudou',
      message:
        'Você ganhou {{percent}}% menos do que o normal, mas gastou {{expenseAmount}} como antes. Corte agora, enquanto é uma escolha e não uma necessidade.',
    },
    {
      title: 'Os gastos não acompanharam a renda',
      message:
        'A renda caiu para {{incomeAmount}} ({{percent}}% a menos); os gastos estão em {{expenseAmount}}. Ajuste a vela ao vento que você realmente tem.',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: 'Assinaturas: {{monthlyAmount}} por mês',
      message:
        'Assinaturas ({{count}}) levam {{percent}}% dos seus gastos mensais. Cada uma se renova sem perguntar a você — pergunte você sobre cada uma.',
    },
    {
      title: '{{percent}}% dos gastos se renovam sozinhos',
      message:
        'Assinaturas: {{count}}, {{monthlyAmount}} por mês. Fique com as que você assinaria de novo hoje.',
    },
    {
      title: 'Silencioso, recorrente, {{monthlyAmount}}',
      message:
        'Assinaturas ({{count}}) custam {{percent}}% do seu mês. A conveniência é boa serva e senhora cara.',
    },
    {
      title: 'Assinaturas para revisar: {{count}}',
      message:
        'Juntas, somam {{monthlyAmount}} por mês, {{percent}}% dos gastos. Cancele uma que você mal usa e perceba como pouco sente falta.',
    },
    {
      title: 'O que se renova sozinho',
      message:
        '{{monthlyAmount}} por mês entre suas assinaturas ({{count}}). Gasto automático merece uma revisão deliberada.',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: 'Seu sucesso poderia ir um pouco mais longe',
      message:
        'Em {{months}} meses você guardou {{savingsPercent}}% da sua renda, mas quase nada foi para os outros. A riqueza fica melhor em mãos abertas — talvez um presente ou uma doação este mês?',
    },
    {
      title: 'Ganha bem, doa pouco',
      message:
        'Em {{months}} meses entraram {{incomeAmount}} e {{givenAmount}} foram para outras pessoas. Se você ajuda de formas que este app não vê, ignore isto; se não, seu plano tem espaço para isso.',
    },
    {
      title: 'Um bom momento para a generosidade',
      message:
        'Você poupou {{savingsPercent}}% da renda — sinal de mão firme. Uma pequena parte disso, dada a quem precisa, faria essa firmeza significar mais.',
    },
    {
      title: 'Ainda não há mais ninguém no quadro',
      message:
        'Os últimos {{months}} meses mostram ganhos e poupança cuidadosos, mas nenhuma doação ou presente. Fomos feitos uns para os outros; um presente modesto basta para começar.',
    },
    {
      title: 'Espaço para a bondade',
      message:
        'Apenas {{givenAmount}} de {{incomeAmount}} foi para ajudar os outros. Pense em uma doação pequena e regular — a generosidade, como toda virtude, fica mais fácil com o hábito.',
    },
  ],
  'stoic.goal_behind': [
    {
      title: '«{{goal}}» está ficando para trás',
      message:
        'Precisa de {{requiredAmount}} por mês, e você está colocando cerca de {{paceAmount}}. Neste ritmo, meses de atraso: {{monthsLate}}.',
    },
    {
      title: '«{{goal}}»: meses de atraso neste ritmo: {{monthsLate}}',
      message:
        'Necessário {{requiredAmount}} por mês, real cerca de {{paceAmount}}. Mova a data com honestidade ou mova mais dinheiro de propósito.',
    },
    {
      title: 'A meta e o ritmo discordam',
      message:
        '«{{goal}}» pede {{requiredAmount}} por mês; recebe {{paceAmount}}. Uma meta só é tão real quanto o passo mensal em direção a ela.',
    },
    {
      title: '«{{goal}}» precisa de um passo mais firme',
      message:
        '{{paceAmount}} por mês contra os {{requiredAmount}} necessários. No mês que vem, pague a meta primeiro, antes de qualquer coisa opcional.',
    },
    {
      title: 'Atrasado em «{{goal}}»',
      message:
        'O ritmo atual ({{paceAmount}}/mês) deixa meses de atraso: {{monthsLate}}. Pequenos aumentos agora valem mais que grandes sacrifícios depois.',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: '«{{goal}}» não cabe no plano',
      message:
        'Precisa de {{requiredAmount}} por mês, mas depois dos seus orçamentos só sobram {{freeAmount}}. Mude a data, o alvo ou os orçamentos — ter esperança não é um plano.',
    },
    {
      title: '«{{goal}}» pede mais do que você tem livre',
      message:
        '{{requiredAmount}} necessários por mês, {{freeAmount}} disponíveis. Querer tudo de uma vez é o jeito de não fazer nada; escolha.',
    },
    {
      title: 'Os números dizem não — por enquanto',
      message:
        '«{{goal}}» precisa de {{requiredAmount}} por mês; seu dinheiro livre é {{freeAmount}}. Ajuste o que está em seu poder: o prazo ou os outros limites.',
    },
    {
      title: '«{{goal}}» precisa de uma decisão',
      message:
        'A {{requiredAmount}} por mês, ela ultrapassa os {{freeAmount}} que sobram depois dos orçamentos. Uma meta escolhida de olhos abertos é melhor do que uma mantida por ilusão.',
    },
    {
      title: 'Um ritmo impossível para «{{goal}}»',
      message:
        'Necessário {{requiredAmount}} por mês, livre {{freeAmount}}. Contas honestas agora poupam decepção depois.',
    },
  ],
  'stoic.shortfall': [
    {
      title: 'Seu saldo fica negativo em {{date}}',
      message:
        'Pagamentos futuros de {{committedAmount}} levam o saldo previsto a {{lowestAmount}}. Prepare-se agora, enquanto é só uma previsão.',
    },
    {
      title: 'Um aperto se aproxima: {{date}}',
      message:
        'Os pagamentos comprometidos ({{committedAmount}}) superam o saldo, que chega ao fundo em {{lowestAmount}}. Antecipar a dificuldade é o que tira o poder dela.',
    },
    {
      title: 'Planeje-se para {{date}}',
      message:
        'Nesse dia o saldo previsto chega a {{lowestAmount}}. Adiar um pagamento, segurar um desejo ou separar dinheiro — tudo isso está em seu poder hoje.',
    },
    {
      title: 'Os compromissos superam o saldo',
      message:
        '{{committedAmount}} estão para vencer, e o saldo cai para {{lowestAmount}} por volta de {{date}}. A resposta serena é a antecipada.',
    },
    {
      title: 'Preveja o buraco de {{date}}',
      message:
        'Menor saldo previsto: {{lowestAmount}}. O que é previsto pode ser enfrentado com serenidade; o que nos surpreende, raramente.',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: 'Você cumpriu a palavra dada a si mesmo',
      message:
        'Há {{months}} meses seguidos seus gastos ficam dentro do plano que você definiu. É assim que se parece o domínio de si.',
    },
    {
      title: '{{months}} meses dentro do plano',
      message:
        'Mês após mês, o que você pretendia e o que fez concordam. A constância é mais silenciosa que a força de vontade e dura mais.',
    },
    {
      title: 'Plano e vida concordam',
      message:
        '{{months}} meses consecutivos dentro dos seus limites. Um plano cumprido assim já não é restrição — é o seu jeito de viver.',
    },
    {
      title: 'Constante há {{months}} meses',
      message:
        'Seus orçamentos se mantêm há {{months}} meses. Mantenha a mesma atenção; está funcionando.',
    },
    {
      title: 'Disciplina sustentada',
      message:
        '{{months}} meses sem quebrar seu plano. Poucas coisas libertam tanto quanto confiar nas próprias decisões.',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: 'Seu dinheiro segue seus valores',
      message:
        'A virtude ficou com {{actual}}% dos gastos — não menos que os {{planned}}% planejados. Bem gasto.',
    },
    {
      title: 'A virtude recebeu sua parte inteira',
      message:
        '{{actual}}% em saúde, aprendizado e os outros, contra {{planned}}% planejados. O que você valoriza, você pagou.',
    },
    {
      title: 'Gasto em se tornar melhor',
      message:
        'A virtude chegou a {{actual}}% dos gastos este mês (planejado {{planned}}%). Esse dinheiro trabalha por você muito depois de ter ido.',
    },
    {
      title: 'Intenção cumprida',
      message:
        'Você planejou {{planned}}% para a virtude e gastou {{actual}}%. Boas intenções raramente sobrevivem a um mês — a sua sobreviveu.',
    },
    {
      title: 'O melhor uso do dinheiro',
      message:
        '{{actual}}% foram para o que torna você e os outros melhores. Continue escolhendo isso.',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: 'O lazer em seu lugar',
      message:
        'O lazer é {{actual}}% dos gastos, abaixo dos {{planned}}% que você lhe permitiu. Você desfruta das coisas sem ser governado por elas.',
    },
    {
      title: 'O prazer, no tamanho certo',
      message:
        'O lazer levou {{actual}}% contra {{planned}}% planejados. Moderação não é ficar de fora — é escolher.',
    },
    {
      title: 'Descanso sem excesso',
      message:
        '{{actual}}% em lazer, abaixo do seu limite de {{planned}}%. O prazer tem melhor sabor quando não é ele quem manda.',
    },
    {
      title: 'Temperança, em silêncio',
      message:
        'Você deu {{planned}}% ao lazer e ele usou só {{actual}}%. Essa margem é liberdade que você guardou.',
    },
    {
      title: 'Lazer abaixo do plano',
      message:
        'Com {{actual}}% dos gastos, o lazer ficou abaixo dos {{planned}}% que você definiu. Bem mantido.',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: '{{percent}}% abaixo do plano',
      message:
        'Você gastou {{savedAmount}} a menos do que se permitiu este mês. Não precisar de tudo o que se poderia ter é uma forma de riqueza.',
    },
    {
      title: '{{savedAmount}} não gastos',
      message:
        'O mês fechou {{percent}}% abaixo do plano. O que você não gastou ainda é seu para direcionar.',
    },
    {
      title: 'Menos do que você se permitiu',
      message:
        'Os gastos estão {{percent}}% abaixo do plano — {{savedAmount}} guardados. Dê um propósito a essa margem antes que o hábito a reivindique.',
    },
    {
      title: 'O plano tinha folga',
      message:
        '{{savedAmount}} abaixo dos seus limites este mês. A contenção que parece fácil é a que dura.',
    },
    {
      title: 'Mais leve que o planejado',
      message:
        'Você precisou de {{percent}}% menos do que orçou. Considere enviar os {{savedAmount}} para uma meta.',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '«{{goal}}» está no prazo',
      message:
        'Você já percorreu {{percent}}% do caminho, no ritmo de que a meta precisa. Passos firmes, dados todo mês, vão longe.',
    },
    {
      title: 'No rumo de «{{goal}}»',
      message:
        '{{percent}}% concluídos e o ritmo se mantém. Continue pagando a meta primeiro; está funcionando.',
    },
    {
      title: '«{{goal}}»: {{percent}}% e constante',
      message: 'A meta recebe todo mês o que precisa. A paciência está fazendo o seu trabalho.',
    },
    {
      title: 'A meta avança como planejado',
      message:
        '«{{goal}}» está {{percent}}% financiada e no prazo. O que se faz um pouco a cada mês não é detido por uma semana ruim.',
    },
    {
      title: 'Um progresso em que se pode confiar',
      message:
        '«{{goal}}» está em {{percent}}%, no ritmo. Você a está construindo do único jeito que funciona — aos poucos.',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: 'Menos compras por impulso em {{merchant}}',
      message:
        'De {{before}} compras no mês passado para cerca de {{after}} neste. Um hábito afrouxado é liberdade conquistada.',
    },
    {
      title: '{{merchant}}: {{before}} → {{after}}',
      message:
        'Você vai lá menos do que antes. Cada reflexo evitado é uma pequena vitória da escolha sobre o hábito.',
    },
    {
      title: 'O pequeno hábito está diminuindo',
      message:
        'As compras em {{merchant}} caíram de {{before}} para cerca de {{after}}. Continue — fica mais fácil.',
    },
    {
      title: 'Escolha acima do reflexo',
      message:
        'Em {{merchant}} você passou de {{before}} compras para cerca de {{after}}. Isso é domínio construído uma decisão por vez.',
    },
    {
      title: 'Menos das pequenas coisas',
      message:
        '{{merchant}} viu você cerca de {{after}} vezes em vez de {{before}}. Pequenas vitórias se acumulam.',
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: 'Você se adaptou a um mês mais magro',
      message:
        'A renda caiu {{incomePercent}}%, e você cortou os gastos em {{expensePercent}}%. Você respondeu a uma mudança da fortuna com uma mudança de rumo.',
    },
    {
      title: 'Serenidade quando a renda caiu',
      message:
        'Renda {{incomePercent}}% menor, gastos {{expensePercent}}% menores. Você se ajustou ao que é, não ao que era.',
    },
    {
      title: 'A fortuna mudou; você também',
      message:
        'Uma queda de {{incomePercent}}% na renda encontrou uma queda de {{expensePercent}}% nos gastos. Isso é equanimidade em números.',
    },
    {
      title: 'Bem conduzido',
      message:
        'Quando a renda caiu {{incomePercent}}%, os gastos acompanharam ({{expensePercent}}% a menos). O vento não era seu; a vela, sim.',
    },
    {
      title: 'Os gastos acompanharam a renda para baixo',
      message:
        'Você gastou {{expensePercent}}% a menos quando a renda caiu {{incomePercent}}%. Adaptar-se cedo é o caminho tranquilo.',
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: 'A necessidade está estável',
      message:
        'Há {{months}} meses seus custos essenciais quase não se mexem. Um piso estável dá liberdade acima dele.',
    },
    {
      title: 'Necessidades sob controle',
      message:
        'Os gastos com necessidade ficaram no mesmo nível por {{months}} meses. Necessidades que não crescem são necessidades que você controla.',
    },
    {
      title: '{{months}} meses de essenciais estáveis',
      message:
        'Aluguel, comida e contas ficaram onde estavam. A estabilidade silenciosa também é uma conquista.',
    },
    {
      title: 'Nada de deriva na necessidade',
      message:
        '{{months}} meses sem desvio naquilo que a vida exige. Sobre esse chão, todo o resto fica mais fácil de planejar.',
    },
    {
      title: 'Um piso firme',
      message:
        'Os gastos essenciais estão estáveis há {{months}} meses. Você não deixa confortos se passarem por necessidades.',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: 'Generosidade com o que você ganha',
      message:
        'Em {{months}} meses, {{percent}}% da sua renda — {{givenAmount}} — foi para ajudar os outros. É dinheiro usado da melhor forma.',
    },
    {
      title: '{{givenAmount}} doados a outros',
      message:
        'Você compartilhou {{percent}}% da sua renda em {{months}} meses. Bondade que aparece nos números é bondade praticada, não só sentida.',
    },
    {
      title: 'Mãos abertas',
      message:
        'Doações e presentes levaram {{percent}}% da sua renda nos últimos tempos. O que você dá é a parte da sua riqueza que nenhum infortúnio pode tirar.',
    },
    {
      title: 'A generosidade faz parte do seu plano',
      message:
        '{{givenAmount}} para outros em {{months}} meses. Mantenha isso — o bem que você faz aos outros também faz a si mesmo.',
    },
    {
      title: 'Bem dado',
      message:
        '{{percent}}% do que você ganhou foi para ajudar os outros. Poucos hábitos dizem mais sobre uma pessoa.',
    },
  ],
  'stoic.praise_steady': [
    {
      title: 'Nada a corrigir',
      message: 'Seus gastos correspondem ao que você pretendia. Continue assim.',
    },
    {
      title: 'Intenção e ação concordam',
      message:
        'Este mês se parece com o que você planejou. Essa concordância é justamente o ponto.',
    },
    {
      title: 'Um mês calmo',
      message:
        'Nenhum excesso, nenhum descuido digno de nota. Muito bem — leve a mesma atenção adiante.',
    },
    {
      title: 'Tudo em ordem',
      message: 'Seu plano se manteve e nada pede correção. Aproveite a calma que você conquistou.',
    },
    {
      title: 'Mão firme',
      message: 'O mês seguiu seu plano. Bons hábitos fazem os bons meses parecerem comuns.',
    },
  ],
  'expert.pay_yourself_first': [
    {
      title: 'Pague-se primeiro',
      message:
        'A regra de George S. Clason: uma parte de tudo o que você ganha é sua para guardar — pelo menos um décimo. Em {{months}} meses, você guardou {{savingsPercent}}%. Separe {{tenthAmount}} no dia em que a renda chegar, antes de qualquer outra coisa.',
    },
    {
      title: 'Um décimo é seu',
      message:
        'Em “O homem mais rico da Babilônia”, a primeira cura para uma bolsa vazia é guardar uma moeda de cada dez. Sua taxa de poupança é de {{savingsPercent}}%; {{tenthAmount}} por mês já daria início ao hábito.',
    },
    {
      title: 'Poupe antes de gastar, não depois',
      message:
        'O conselho de Clason é simples: pague-se primeiro. Ultimamente, {{savingsPercent}}% da renda ficou com você. Separe {{tenthAmount}} no dia do pagamento e deixe os gastos se ajustarem ao que sobrar.',
    },
    {
      title: 'A primeira moeda é sua',
      message:
        'Uma parte de tudo o que você ganha deve ficar com você — não menos de um décimo, diz Clason. Você guardou {{savingsPercent}}% em {{months}} meses. Comece com {{tenthAmount}} por mês, de forma automática.',
    },
    {
      title: '{{savingsPercent}}% guardado — a regra pede 10%',
      message:
        'Pague-se primeiro, como diz “O homem mais rico da Babilônia”: {{tenthAmount}} por mês, separados antes de qualquer conta. A poupança feita primeiro não depende do que sobra.',
    },
  ],
  'expert.rule_50_30_20': [
    {
      title: 'Seu check-up 50/30/20',
      message:
        'Elizabeth Warren e Amelia Warren Tyagi sugerem 50% da renda líquida para o essencial, 30% para desejos e 20% para a poupança. Os seus: {{needsPercent}}% / {{wantsPercent}}% / {{savingsPercent}}%.',
    },
    {
      title: 'Essencial {{needsPercent}}%, desejos {{wantsPercent}}%, poupança {{savingsPercent}}%',
      message:
        '“All Your Worth” equilibra o dinheiro em 50/30/20. Compare com seu plano a categoria mais distante da meta — é ali que uma única mudança ajuda mais.',
    },
    {
      title: 'Como sua renda se divide',
      message:
        'O essencial leva {{needsPercent}}% da renda, os desejos {{wantsPercent}}%, e {{savingsPercent}}% é poupado. O equilíbrio 50/30/20 de “All Your Worth” é um espelho útil, não um veredito.',
    },
    {
      title: 'A fórmula do dinheiro equilibrado',
      message:
        'A fórmula de Warren e Tyagi: metade para o que você precisa pagar aconteça o que acontecer, 30% para desejos e 20% para o futuro. Você está em {{needsPercent}}/{{wantsPercent}}/{{savingsPercent}}.',
    },
    {
      title: 'Diante do 50/30/20',
      message:
        'Sua divisão é {{needsPercent}}% essencial, {{wantsPercent}}% desejos e {{savingsPercent}}% poupança. O teste do livro para o essencial: você continuaria pagando se perdesse o emprego amanhã?',
    },
  ],
  'expert.room_for_error': [
    {
      title: 'Deixe margem para erro',
      message:
        'O conselho de Morgan Housel: planeje contando que as coisas não sairão como planejado. Seu saldo cobre cerca de {{cushionDays}} dias de gastos; uma referência comum é de três meses — {{targetAmount}}.',
    },
    {
      title: 'Uma reserva de {{cushionDays}} dias',
      message:
        '“A psicologia financeira” chama isso de margem para erro — a folga que permite sobreviver às surpresas. Avançar até {{targetAmount}}, três meses de gastos, dá ao plano a chance de sobreviver à realidade.',
    },
    {
      title: 'Margem de segurança, em casa',
      message:
        'Housel toma emprestada de Graham a margem de segurança para as finanças pessoais. Com {{cushionDays}} dias de gastos em reserva, um único mês ruim pode desfazer um bom plano. Mire em {{targetAmount}}.',
    },
    {
      title: 'Espaço para o inesperado',
      message:
        'Sua reserva duraria cerca de {{cushionDays}} dias. As surpresas são a única certeza; três meses de gastos ({{targetAmount}}) é uma meta amplamente usada.',
    },
    {
      title: 'Crie folga antes de precisar dela',
      message:
        'Margem para erro, nas palavras de Morgan Housel, é o que mantém você no jogo. Você tem cerca de {{cushionDays}} dias cobertos; {{targetAmount}} cobriria três meses.',
    },
  ],
  'expert.lifestyle_creep': [
    {
      title: 'Os gastos estão correndo mais que a renda',
      message:
        'Os gastos subiram {{expenseGrowth}}% no último trimestre, enquanto a renda variou {{incomeGrowth}}%. A primeira regra de “O milionário mora ao lado”: qualquer que seja sua renda, viva abaixo das suas possibilidades.',
    },
    {
      title: 'Vivendo melhor, não ficando mais rico',
      message:
        'Stanley e Danko descobriram que riqueza é o que você acumula, não o que gasta. Seus gastos cresceram {{expenseGrowth}}% e a renda {{incomeGrowth}}% — é nessa diferença que a riqueza escapa.',
    },
    {
      title: 'Inflação do estilo de vida: +{{expenseGrowth}}%',
      message:
        'As despesas subiram mais rápido que a renda ({{incomeGrowth}}%). As pessoas de “O milionário mora ao lado” continuaram ricas deixando a renda crescer sem que os gastos a acompanhassem.',
    },
    {
      title: 'A linha de chegada está se movendo',
      message:
        'Os gastos subiram {{expenseGrowth}}% de um trimestre para o outro, contra {{incomeGrowth}}% da renda. Viva abaixo das suas possibilidades, dizem Stanley e Danko — quaisquer que sejam elas.',
    },
    {
      title: 'Riqueza é o que você guarda',
      message:
        'Uma boa renda gasta por inteiro não deixa ninguém mais rico. No último trimestre, seus gastos cresceram {{expenseGrowth}}% e a renda {{incomeGrowth}}% — vale uma olhada antes que isso vire o novo normal.',
    },
  ],
  'expert.life_energy': [
    {
      title: '{{merchant}} custou {{hours}} horas da sua vida',
      message:
        'Vicki Robin e Joe Dominguez sugerem medir as coisas em energia vital — as horas de trabalho que elas custam. {{totalAmount}} em {{merchant}} neste mês equivalem a cerca de {{hours}} horas. Valeu a pena?',
    },
    {
      title: '{{hours}} horas em {{merchant}}',
      message:
        '“Your Money or Your Life” propõe ver o dinheiro como o tempo que você trocou por ele. Pela sua renda média por hora, {{totalAmount}} ali equivalem a cerca de {{hours}} horas de trabalho.',
    },
    {
      title: 'Calcule em horas',
      message:
        '{{totalAmount}} em {{merchant}} são cerca de {{hours}} horas de trabalho. Robin e Dominguez chamam isso de energia vital — a única moeda que você não consegue ganhar de volta.',
    },
    {
      title: 'Quanto {{merchant}} realmente custou',
      message:
        'Dinheiro é algo pelo qual trocamos nossa energia vital. Neste mês, {{merchant}} levou cerca de {{hours}} horas da sua ({{totalAmount}}). O prazer está à altura das horas?',
    },
    {
      title: 'Check-up de energia vital',
      message:
        'Convertidos pela sua renda média por hora, os {{totalAmount}} gastos em {{merchant}} equivalem a cerca de {{hours}} horas. “Your Money or Your Life” sugere perguntar se isso trouxe uma satisfação proporcional.',
    },
  ],
};
