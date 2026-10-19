import type { StoicTextMap } from './types';

export const fr: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: 'Le mois a débordé de son plan',
      message:
        "Vous aviez prévu {{plannedAmount}} et avez dépensé {{spentAmount}} — {{percent}}% de plus. Le plan a été fait à tête reposée ; laissez-le parler plus fort que l'instant.",
    },
    {
      title: '{{percent}}% au-delà de ce que vous vouliez dépenser',
      message:
        'Les dépenses atteignent {{spentAmount}} pour un plan de {{plannedAmount}}. Regardez quelle limite a cédé la première — la leçon est là.',
    },
    {
      title: 'Votre plan et votre mois ne sont pas d’accord',
      message:
        '{{spentAmount}} dépensés, {{plannedAmount}} prévus. Soit le plan demandait trop peu à la réalité, soit la réalité vous a trop demandé — tranchez, calmement.',
    },
    {
      title: 'Plus de sorties que vous ne le permettiez',
      message:
        "Le mois dépasse de {{percent}}% les {{plannedAmount}} que vous aviez fixés. On ne perd rien à s'arrêter maintenant ; on perd beaucoup à faire comme si de rien n'était.",
    },
    {
      title: 'Une limite fixée, une limite franchie',
      message:
        "Vous vouliez dépenser {{plannedAmount}} ; c'est {{spentAmount}}. La maîtrise de soi, ce n'est pas ne jamais faillir — c'est s'en apercevoir tôt et reprendre le chemin.",
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: 'Le loisir prend plus que prévu',
      message:
        'Vous vouliez consacrer {{planned}}% de vos dépenses au loisir ; ce mois-ci, il en représente {{actual}}%. Le plaisir est bienvenu comme invité, pas comme maître de maison.',
    },
    {
      title: 'Loisir à {{actual}}%, prévu à {{planned}}%',
      message:
        "Le repos mérite sa place quand il vous restaure. Demandez-vous quels plaisirs de ce mois l'ont fait, et laissez les autres partir sans regret.",
    },
    {
      title: "Le confort dépense plus que l'intention",
      message:
        "Le loisir occupe {{actual}}% des dépenses, contre les {{planned}}% que vous aviez choisis. La modération n'est pas le refus du plaisir — c'est lui garder la taille que vous avez décidée.",
    },
    {
      title: "L'agréable évince le prévu",
      message:
        'Vous aviez accordé {{planned}}% au loisir et il en a pris {{actual}}%. Ce dont on jouit facilement mérite un second regard avant de devenir ce dont on a besoin.',
    },
    {
      title: 'Le loisir a franchi sa ligne',
      message:
        "{{actual}}% du mois sont allés au loisir, pour {{planned}}% prévus. C'est vous qui avez tracé la ligne, et c'est à vous de la tenir.",
    },
  ],
  'stoic.leisure_habit': [
    {
      title: 'Le loisir dépasse encore le plan',
      message:
        "Le loisir a dépassé votre plan {{months}} mois sur les {{window}} derniers. Une répétition n'est plus un accident — c'est une habitude qui mérite examen.",
    },
    {
      title: '{{months}} mois sur {{window}} au-dessus du plan loisir',
      message:
        "Ce qui arrive une fois est une circonstance ; ce qui arrive {{months}} fois, c'est un caractère qui se forme. Choisissez ce caractère délibérément.",
    },
    {
      title: 'Le même écart, mois après mois',
      message:
        "Le loisir a dépassé le plan {{months}} mois sur {{window}}. Relevez le plan honnêtement ou changez l'habitude — vivre entre les deux coûte le plus cher.",
    },
    {
      title: 'Un schéma, pas un faux pas',
      message:
        'Sur les {{window}} derniers mois, le loisir a pris plus que prévu à {{months}} reprises. Observez le moment où la décision se prend, pas seulement la facture qui suit.',
    },
    {
      title: "L'habitude vote contre votre plan",
      message:
        'Le loisir a battu le plan {{months}} fois en {{window}} mois. Les habitudes se construisent un choix à la fois ; elles se défont de la même manière.',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: 'La vertu reçoit moins que prévu',
      message:
        "Vous avez réservé {{planned}}% du budget à la santé, à l'apprentissage et aux autres ; pour l'instant, {{actual}}%. Une intention ne compte qu'une fois accomplie.",
    },
    {
      title: 'Vertu à {{actual}}% sur {{planned}}% prévus',
      message:
        "L'argent destiné à ce qui vous rend meilleur attend toujours. Il n'y a pas de meilleur moment que ce mois-ci pour bien le dépenser.",
    },
    {
      title: "Le bien prévu n'est pas encore dépensé",
      message:
        "La santé, l'apprentissage et la générosité devaient recevoir {{planned}}% des dépenses ; ils ont reçu {{actual}}%. Accomplissez l'un d'eux cette semaine, délibérément.",
    },
    {
      title: "L'intention sans l'acte",
      message:
        'La vertu représente {{actual}}% des dépenses, contre les {{planned}}% que vous aviez choisis. Ce que nous estimons se voit dans ce que nous payons réellement.',
    },
    {
      title: 'Il reste de la place pour l’essentiel',
      message:
        "Seulement {{actual}}% sont allés à la vertu, pour {{planned}}% prévus. Un livre, un bilan de santé, un don à quelqu'un dans le besoin — le plan a déjà dit oui.",
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: 'La vertu est encore remise à plus tard',
      message:
        "Les dépenses pour la santé, l'apprentissage et les autres restent sous votre plan depuis {{months}} mois d'affilée. Ce que vous remettez sans cesse, vous l'avez en fait déjà refusé.",
    },
    {
      title: '{{months}} mois de vertu remise à plus tard',
      message:
        "Chaque mois, le plan faisait place à ce qui vous rend meilleur, et chaque mois cette place est restée vide. Le temps est la seule chose qu'on ne budgète pas deux fois.",
    },
    {
      title: 'Le meilleur de vous attend encore',
      message:
        'La vertu est sous le plan depuis {{months}} mois. Commencez petit et sûr plutôt que grand et plus tard.',
    },
    {
      title: 'Les bonnes intentions vieillissent',
      message:
        "Depuis {{months}} mois, la santé, l'apprentissage et la générosité reçoivent moins que prévu. Choisissez-en une et financez-la en premier le mois prochain, avant tout le reste.",
    },
    {
      title: 'La vertu cède toujours à « plus tard »',
      message:
        "{{months}} mois d'affilée sous le plan. « Plus tard » est l'endroit où les bonnes intentions vont se faire oublier — donnez à celle-ci une date.",
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: "Votre plan n'a pas de place pour la vertu",
      message:
        "Aucun de vos budgets ne sert la santé, l'apprentissage ou les autres. Un plan montre ce à quoi nous tenons — pensez à donner à la vertu sa propre ligne.",
    },
    {
      title: 'Des budgets pour tout, sauf pour le bien',
      message:
        "La nécessité, le travail et le loisir ont leurs limites ; la vertu n'en a aucune. Ce qui n'est jamais prévu a tendance à ne jamais arriver.",
    },
    {
      title: 'Prévoyez pour ce qui vous rend meilleur',
      message:
        "Il n'y a encore aucun budget dans la classe vertu. Même modeste — des livres, du sport, un don — il transforme un souhait en engagement.",
    },
    {
      title: 'Le plan se tait sur la vertu',
      message:
        'Vous budgétez ce que vous devez et ce que vous aimez, pas encore la personne que vous voulez devenir. Un modeste budget vertu changerait cela.',
    },
    {
      title: "La vertu n'a pas de budget",
      message:
        "Les dépenses pour la santé, l'apprentissage ou les autres ne sont prévues nulle part. Choisissez-en une et donnez-lui une limite que vous seriez heureux d'atteindre.",
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: 'La nécessité coûte plus que prévu',
      message:
        "Vous aviez prévu {{planned}}% des dépenses pour la nécessité ; elle en prend {{actual}}%. Vérifiez que chaque poste est encore un besoin et n'est pas devenu, sans bruit, un confort.",
    },
    {
      title: 'Nécessité à {{actual}}%, prévue à {{planned}}%',
      message:
        "Ce que la vie exige est souvent moins que ce à quoi l'on s'habitue. Regardez d'un œil neuf votre plus gros poste de nécessité.",
    },
    {
      title: "L'essentiel enfle",
      message:
        'La nécessité occupe {{actual}}% du mois, contre les {{planned}}% attendus. Un besoin qui ne cesse de grandir mérite une question.',
    },
    {
      title: 'Les besoins débordent du plan',
      message:
        'Prévu {{planned}}%, réel {{actual}}%. Soit le plan a sous-estimé les vrais coûts, soit certaines envies voyagent sous le nom de besoins.',
    },
    {
      title: 'Plus dépensé pour le « il faut » que prévu',
      message:
        'La nécessité a pris {{actual}}% des dépenses au lieu de {{planned}}%. Séparez ce qui doit vraiment être de ce qui a simplement toujours été.',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: 'La nécessité grimpe peu à peu',
      message:
        "Les dépenses de nécessité augmentent depuis {{months}} mois d'affilée, de {{percent}}% au total. Les besoins grandissent en silence quand personne ne leur demande de se justifier.",
    },
    {
      title: '+{{percent}}% de nécessité en {{months}} mois',
      message:
        'Chaque pas semblait petit ; ensemble, ils ne le sont pas. Prenez la plus grosse dépense nécessaire récurrente et demandez-vous si elle doit encore coûter autant.',
    },
    {
      title: 'Le plancher de vos dépenses monte',
      message:
        'La nécessité a augmenté {{months}} mois de suite (+{{percent}}%). Un plancher qui monte laisse moins de place à tout ce que vous choisissez librement.',
    },
    {
      title: "Les besoins s'étendent",
      message:
        "{{months}} mois de hausse, {{percent}}% au total. L'épreuve stoïcienne est simple : le choisiriez-vous à nouveau aujourd'hui, en connaissant son prix ?",
    },
    {
      title: 'De petites hausses, une direction nette',
      message:
        "La nécessité a augmenté de {{percent}}% en {{months}} mois. La direction compte plus qu'un mois isolé — celle-ci vaut la peine d'être corrigée tôt.",
    },
  ],
  'stoic.work_over_plan': [
    {
      title: 'Le travail coûte plus que prévu',
      message:
        'Vous aviez prévu {{planned}}% des dépenses pour le travail ; il en prend {{actual}}%. Outils et services doivent mériter leur place — vérifiez lesquels le font.',
    },
    {
      title: 'Travail à {{actual}}%, prévu à {{planned}}%',
      message:
        "Investir dans son travail est bon quand cela rapporte. Passez en revue ce que vous payez sans plus l'utiliser.",
    },
    {
      title: 'Le budget travail est tendu',
      message:
        "Le travail a pris {{actual}}% au lieu de {{planned}}%. L'application, c'est bien faire le travail, pas acheter chaque outil pour le faire.",
    },
    {
      title: 'Les outils dépassent le plan',
      message:
        "Prévu {{planned}}%, dépensé {{actual}}% pour le travail. Demandez à chaque dépense : m'aide-t-elle à travailler, ou donne-t-elle seulement l'impression d'avancer ?",
    },
    {
      title: 'Les coûts du travail ont dérivé',
      message:
        'Le travail occupe {{actual}}% des dépenses pour {{planned}}% prévus. Un rapide examen maintenant en évite un plus lourd plus tard.',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '« {{category}} » dépasse encore sa limite',
      message:
        "« {{category}} » a dépassé le budget {{months}} mois sur les {{window}} derniers. Soit la limite est fausse, soit le désir l'est — décidez lequel.",
    },
    {
      title: '« {{category}} » : hors budget {{months}} mois sur {{window}}',
      message:
        "Une limite toujours franchie n'est pas une limite, seulement un souhait. Rendez-la honnête — relevez-la exprès ou tenez-la exprès.",
    },
    {
      title: 'Le même budget cède encore',
      message:
        '« {{category}} » a dépassé sa limite {{months}} fois en {{window}} mois. La répétition est une information ; servez-vous-en.',
    },
    {
      title: '« {{category}} » demande votre attention',
      message:
        "Hors budget {{months}} mois sur {{window}}. Observez le moment qui précède l'achat — c'est le seul endroit où l'habitude peut changer.",
    },
    {
      title: 'Un schéma dans « {{category}} »',
      message:
        '{{months}} dépassements en {{window}} mois. Nous devenons ce que nous répétons ; décidez ce que cette catégorie doit dire de vous.',
    },
  ],
  'stoic.budget_pace': [
    {
      title: '« {{category}} » sera épuisé vers le {{day}}',
      message:
        "Vous avez dépensé {{spentAmount}} sur {{limitAmount}}, et à ce rythme la limite s'épuise vers le {{day}} du mois. Ralentir maintenant est plus facile que s'arrêter plus tard.",
    },
    {
      title: '« {{category}} » a de l’avance sur le mois',
      message:
        "{{spentAmount}} déjà partis d'une limite de {{limitAmount}}. À ce rythme, elle sera épuisée vers le {{day}} — le reste du mois est encore à vous de le façonner.",
    },
    {
      title: 'Point sur le rythme : « {{category}} »',
      message:
        'Au rythme actuel, le budget de {{limitAmount}} tiendra jusque vers le {{day}} du mois. La prévoyance est la forme de discipline la moins chère.',
    },
    {
      title: '« {{category}} » dépense l’avenir',
      message:
        "{{spentAmount}} sur {{limitAmount}} dépensés ; la limite s'arrête vers le {{day}}. Ce que vous ferez cette semaine décidera si cela arrive.",
    },
    {
      title: 'Alerte précoce pour « {{category}} »',
      message:
        "Au rythme actuel, la limite de {{limitAmount}} n'atteindra pas la fin du mois — elle s'épuise vers le {{day}}. Ajustez tant que cela coûte peu.",
    },
  ],
  'stoic.budget_unused': [
    {
      title: "« {{category}} » n'est pas utilisé",
      message:
        "Le budget « {{category}} » n'a vu aucune dépense depuis {{months}} mois. Soit vous l'avez dépassé, soit c'est une intention qui attend encore — décidez laquelle.",
    },
    {
      title: 'Un budget vide : « {{category}} »',
      message:
        '{{months}} mois sans une seule dépense. Un plan devrait décrire la vie que vous menez ou celle que vous construisez — laquelle est-ce ici ?',
    },
    {
      title: '« {{category}} » reste immobile',
      message:
        "Rien de dépensé ici depuis {{months}} mois. Si c'était de la retenue, bravo ; si c'était de la négligence, agissez.",
    },
    {
      title: 'Prévu, mais pas vécu',
      message:
        '« {{category}} » a une limite et aucune dépense depuis {{months}} mois. Gardez le plan fidèle : supprimez-le ou utilisez-le.',
    },
    {
      title: '« {{category}} » : {{months}} mois de silence',
      message:
        "Un budget jamais touché occupe tout de même une place dans votre plan. Libérez la place ou honorez l'intention.",
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: '{{percent}}% des dépenses sans limite',
      message:
        "{{unbudgetedAmount}} sont allés ce mois-ci à des catégories qu'aucun budget ne surveille. Ce qui n'est pas mesuré est difficile à maîtriser.",
    },
    {
      title: "Une grande part du mois n'est pas planifiée",
      message:
        '{{percent}}% des dépenses — {{unbudgetedAmount}} — échappent à tout budget. Donnez une limite à la plus grosse part, et le plan verra davantage de votre vie.',
    },
    {
      title: 'Des dépenses hors du plan',
      message:
        "Les budgets ne couvrent qu'une partie de vos dépenses ; {{unbudgetedAmount}} ({{percent}}%) ne sont pas mesurés. Étendez le plan là où l'argent va vraiment.",
    },
    {
      title: "Le plan ne voit qu'une partie du tableau",
      message:
        "{{percent}}% des dépenses de ce mois n'ont pas de budget. Voir clair vient avant bien juger.",
    },
    {
      title: '{{unbudgetedAmount}} dépensés sans limite',
      message:
        "Cela représente {{percent}}% du mois. Vous n'avez pas à le restreindre — seulement à décider combien vous en voulez vraiment.",
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '« {{category}} » fait l’essentiel de votre loisir',
      message:
        '{{percent}}% des dépenses de loisir sont allées à « {{category}} ». La variété dans le repos est plus saine que la dépendance à un seul plaisir.',
    },
    {
      title: 'Un plaisir domine',
      message:
        "« {{category}} » prend {{percent}}% de tout ce que vous avez dépensé en loisir. Demandez-vous s'il vous réjouit encore ou s'il est devenu une routine.",
    },
    {
      title: 'Le loisir repose sur « {{category}} »',
      message:
        '{{percent}}% du loisir au même endroit. Ce dont nous ne pouvons nous passer a prise sur nous — vérifiez que la prise reste légère.',
    },
    {
      title: '« {{category}} » : {{percent}}% du loisir',
      message:
        'Une seule source de plaisir en prend presque tout. Essayez ce mois-ci un plaisir différent et moins cher, puis comparez.',
    },
    {
      title: "Votre repos n'a qu'une adresse",
      message:
        "L'essentiel de l'argent du loisir — {{percent}}% — va à « {{category}} ». La liberté, c'est aussi pouvoir apprécier autre chose.",
    },
  ],
  'stoic.unclassified': [
    {
      title: 'Certaines dépenses ne sont pas encore jugées',
      message:
        'Catégories sans classe : {{count}}. Décidez dans Budgets ce qui relève de la nécessité, du travail, de la vertu ou du loisir.',
    },
    {
      title: 'Catégories en attente de votre jugement : {{count}}',
      message:
        'Elles ont des dépenses mais pas de classe, et le conseil ne peut donc pas les peser. Une minute dans Budgets suffit.',
    },
    {
      title: 'Nommez ce que sert votre argent',
      message:
        'Catégories encore non classées : {{count}}. Le jugement commence par appeler les choses par leur nom.',
    },
    {
      title: 'Dépenses non jugées — catégories : {{count}}',
      message:
        "Est-ce un besoin, votre travail, une vertu ou un plaisir ? Vous seul pouvez le dire — et le plan s'éclaircit dès que vous le faites.",
    },
    {
      title: "Quelques catégories n'ont pas de classe",
      message:
        "Hors des quatre classes : {{count}}. Classez-les dans Budgets pour que chaque dépense soit vue pour ce qu'elle est.",
    },
  ],
  'stoic.small_purchases': [
    {
      title: 'Petits achats chez {{merchant}} : {{count}}',
      message:
        "Chacun semblait anodin ; ensemble, ils font {{totalAmount}} ce mois-ci. C'est dans les petites habitudes non examinées que file, sans bruit, la plupart de l'argent.",
    },
    {
      title: '{{merchant}} : {{count}} fois ce mois-ci',
      message:
        '{{totalAmount}} en petites sommes. Demandez-vous si chaque passage était un choix ou un réflexe — seul le premier est liberté.',
    },
    {
      title: 'Petit à petit : {{totalAmount}}',
      message:
        "Achats chez {{merchant}} : {{count}}. Aucun ne compte à lui seul ; l'habitude, si. Décidez à quelle fréquence vous le voulez vraiment.",
    },
    {
      title: 'Une habitude chez {{merchant}}',
      message:
        "Achats : {{count}}, {{totalAmount}} au total. Essayez d'en sauter un sur trois ce mois-ci et voyez s'il vous manque.",
    },
    {
      title: "Les petites choses s'additionnent",
      message:
        '{{merchant}} vous a vu {{count}} fois, pour {{totalAmount}}. La maîtrise des grandes décisions se bâtit sur de petites comme celles-ci.',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: 'Les week-ends portent {{percent}}% du loisir',
      message:
        "L'essentiel de vos dépenses de loisir a lieu le samedi et le dimanche. Le repos est bon ; vérifiez que c'est du repos et non une compensation de la semaine.",
    },
    {
      title: 'Le loisir vit le week-end',
      message:
        '{{percent}}% des dépenses de loisir tombent le week-end. Prévoyez un peu le week-end : il coûtera moins et donnera plus.',
    },
    {
      title: 'Le week-end paie pour la semaine',
      message:
        "Les week-ends prennent {{percent}}% de ce que vous dépensez en loisir. Si la semaine a besoin d'être réparée chaque samedi, regardez la semaine.",
    },
    {
      title: 'Samedi et dimanche : {{percent}}% du loisir',
      message:
        "Les jours libres invitent aux dépenses libres. Décidez avant le week-end à quoi il doit servir, et laissez l'argent suivre.",
    },
    {
      title: 'Un schéma de week-end',
      message:
        '{{percent}}% des dépenses de loisir ont lieu le week-end. Plus de légèreté en semaine rend souvent les week-ends moins coûteux.',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}} a pris {{percent}}% du mois',
      message:
        '{{totalAmount}} sont allés à un seul commerçant pour le loisir. Quand un seul endroit détient autant de votre argent, demandez-vous combien il détient aussi de votre attention.',
    },
    {
      title: 'Un seul endroit, {{totalAmount}}',
      message:
        '{{merchant}} représente {{percent}}% des dépenses de ce mois. Mérite-t-il cette part du fruit de votre travail ?',
    },
    {
      title: '{{merchant}} mène vos dépenses',
      message:
        '{{percent}}% du mois — {{totalAmount}} — y sont allés. Rien de mal à en profiter, tant que vous le choisiriez à nouveau.',
    },
    {
      title: 'Une grosse part chez {{merchant}}',
      message:
        '{{totalAmount}}, soit {{percent}}% des dépenses, en un seul lieu de loisir. Pesez le plaisir contre le prix, calmement.',
    },
    {
      title: '{{percent}}% chez {{merchant}}',
      message:
        "Ce seul commerçant a pris {{totalAmount}}. La liberté, c'est pouvoir passer devant sans entrer quand vous le décidez.",
    },
  ],
  'stoic.income_drop': [
    {
      title: 'Les revenus ont baissé, pas les dépenses',
      message:
        "Les revenus ont chuté de {{percent}}% à {{incomeAmount}}, mais les dépenses sont restées à {{expenseAmount}}. La fortune a changé d'avis ; vos dépenses ne l'ont pas encore remarqué.",
    },
    {
      title: 'Revenus en baisse de {{percent}}%',
      message:
        '{{incomeAmount}} sont entrés, {{expenseAmount}} sont sortis. Ce que la fortune donne, elle peut le reprendre — ajustez vos dépenses à ce qui est, non à ce qui était.',
    },
    {
      title: 'Un mois plus maigre, les mêmes habitudes',
      message:
        'Les revenus sont inférieurs de {{percent}}% ({{incomeAmount}}), tandis que les dépenses se maintiennent à {{expenseAmount}}. Les revenus ne dépendent pas de vous ; la réponse, si.',
    },
    {
      title: 'La fortune a tourné',
      message:
        "Vous avez gagné {{percent}}% de moins que d'habitude, mais dépensé {{expenseAmount}} comme avant. Réduisez maintenant, tant que c'est un choix et non une nécessité.",
    },
    {
      title: "Les dépenses n'ont pas suivi les revenus",
      message:
        'Les revenus sont tombés à {{incomeAmount}} ({{percent}}% de moins) ; les dépenses sont de {{expenseAmount}}. Réglez la voile sur le vent que vous avez réellement.',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: 'Abonnements : {{monthlyAmount}} par mois',
      message:
        'Abonnements ({{count}}) : {{percent}}% de vos dépenses mensuelles. Chacun se renouvelle sans vous demander — interrogez-vous vous-même sur chacun.',
    },
    {
      title: "{{percent}}% des dépenses se renouvellent d'elles-mêmes",
      message:
        "Abonnements : {{count}}, soit {{monthlyAmount}} par mois. Gardez ceux auxquels vous vous abonneriez à nouveau aujourd'hui.",
    },
    {
      title: 'Discret, récurrent, {{monthlyAmount}}',
      message:
        'Abonnements ({{count}}) : {{percent}}% de votre mois. Le confort est un bon serviteur et un maître coûteux.',
    },
    {
      title: 'Abonnements à revoir : {{count}}',
      message:
        'Ensemble, ils font {{monthlyAmount}} par mois, {{percent}}% des dépenses. Résiliez-en un que vous utilisez à peine et voyez combien peu il vous manque.',
    },
    {
      title: 'Ce qui se renouvelle tout seul',
      message:
        '{{monthlyAmount}} par mois pour vos abonnements ({{count}}). Une dépense automatique mérite un examen délibéré.',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: 'Votre réussite pourrait aller un peu plus loin',
      message:
        "En {{months}} mois, vous avez gardé {{savingsPercent}}% de vos revenus, mais presque rien n'est allé aux autres. La richesse se tient mieux dans des mains ouvertes — peut-être un cadeau ou un don ce mois-ci ?",
    },
    {
      title: 'Bien gagner, peu donner',
      message:
        "{{incomeAmount}} sont entrés en {{months}} mois et {{givenAmount}} sont allés aux autres. Si vous aidez d'une manière que l'application ne voit pas, ignorez ceci ; sinon, votre plan a de la place pour cela.",
    },
    {
      title: 'Un bon moment pour être généreux',
      message:
        "Vous avez épargné {{savingsPercent}}% de vos revenus — signe d'une main sûre. Une petite part de cela, donnée à quelqu'un qui en a besoin, donnerait plus de sens à cette constance.",
    },
    {
      title: "Personne d'autre dans le tableau pour l'instant",
      message:
        'Les {{months}} derniers mois montrent des revenus et une épargne bien tenus, mais ni dons ni cadeaux. Nous sommes faits les uns pour les autres ; un modeste présent suffit pour commencer.',
    },
    {
      title: 'De la place pour la bonté',
      message:
        "Seulement {{givenAmount}} sur {{incomeAmount}} sont allés à l'aide aux autres. Pensez à un petit don régulier — la générosité devient plus facile avec l'habitude, comme toute vertu.",
    },
  ],
  'stoic.goal_behind': [
    {
      title: '« {{goal}} » prend du retard',
      message:
        'Il faut {{requiredAmount}} par mois, et vous y mettez environ {{paceAmount}}. À ce rythme, il arrivera avec {{monthsLate}} mois de retard.',
    },
    {
      title: '« {{goal}} » : {{monthsLate}} mois de retard à ce rythme',
      message:
        "Requis : {{requiredAmount}} par mois, réel : environ {{paceAmount}}. Déplacez la date honnêtement ou déplacez plus d'argent délibérément.",
    },
    {
      title: "L'objectif et le rythme ne s'accordent pas",
      message:
        "« {{goal}} » demande {{requiredAmount}} par mois ; il reçoit {{paceAmount}}. Un objectif n'est réel que par le pas mensuel qui y mène.",
    },
    {
      title: '« {{goal}} » demande un pas plus ferme',
      message:
        "{{paceAmount}} par mois contre les {{requiredAmount}} nécessaires. Le mois prochain, payez d'abord l'objectif, avant tout ce qui est facultatif.",
    },
    {
      title: 'En retard sur « {{goal}} »',
      message:
        'Le rythme actuel ({{paceAmount}}/mois) le fait arriver avec {{monthsLate}} mois de retard. De petites hausses maintenant valent mieux que de grands sacrifices plus tard.',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: "« {{goal}} » n'entre pas dans le plan",
      message:
        "Il faut {{requiredAmount}} par mois, mais après vos budgets il ne reste que {{freeAmount}}. Changez la date, la cible ou les budgets — espérer n'est pas un plan.",
    },
    {
      title: '« {{goal}} » demande plus que vous n’avez de libre',
      message:
        "{{requiredAmount}} requis chaque mois, {{freeAmount}} disponibles. Vouloir tout à la fois, c'est ne rien accomplir ; choisissez.",
    },
    {
      title: 'Les chiffres disent non — pour l’instant',
      message:
        "« {{goal}} » demande {{requiredAmount}} par mois ; votre marge libre est de {{freeAmount}}. Ajustez ce qui dépend de vous : l'échéance ou les autres limites.",
    },
    {
      title: '« {{goal}} » demande une décision',
      message:
        "À {{requiredAmount}} par mois, il dépasse les {{freeAmount}} qui restent après les budgets. Un objectif choisi les yeux ouverts vaut mieux qu'un objectif maintenu par l'illusion.",
    },
    {
      title: 'Un rythme impossible pour « {{goal}} »',
      message:
        "Requis : {{requiredAmount}} par mois, libre : {{freeAmount}}. Une arithmétique honnête aujourd'hui épargne la déception demain.",
    },
  ],
  'stoic.shortfall': [
    {
      title: 'Votre solde passe sous zéro le {{date}}',
      message:
        "Des paiements à venir de {{committedAmount}} amènent le solde prévu à {{lowestAmount}}. Préparez-vous maintenant, tant que ce n'est qu'une prévision.",
    },
    {
      title: 'Un manque approche : {{date}}',
      message:
        "Les paiements engagés ({{committedAmount}}) dépassent le solde, qui descend jusqu'à {{lowestAmount}}. Anticiper la difficulté, c'est lui ôter son pouvoir.",
    },
    {
      title: 'Préparez le {{date}}',
      message:
        "Ce jour-là, le solde prévu atteint {{lowestAmount}}. Déplacer un paiement, retenir une envie, mettre de l'argent de côté — tout cela est en votre pouvoir aujourd'hui.",
    },
    {
      title: 'Les engagements dépassent le solde',
      message:
        '{{committedAmount}} sont dus, et le solde tombe à {{lowestAmount}} autour du {{date}}. La réponse sereine est la réponse précoce.',
    },
    {
      title: 'Anticipez le trou du {{date}}',
      message:
        'Solde le plus bas prévu : {{lowestAmount}}. Ce qui est prévu peut être affronté avec calme ; ce qui nous surprend, rarement.',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: 'Vous tenez parole envers vous-même',
      message:
        "Depuis {{months}} mois d'affilée, vos dépenses restent dans le plan que vous vous êtes fixé. Voilà à quoi ressemble la maîtrise de soi.",
    },
    {
      title: '{{months}} mois dans le plan',
      message:
        'Mois après mois, ce que vous vouliez et ce que vous avez fait concordent. La constance est plus discrète que la volonté, et dure plus longtemps.',
    },
    {
      title: "Le plan et la vie s'accordent",
      message:
        "{{months}} mois consécutifs dans vos limites. Un plan si bien tenu n'est plus une contrainte — c'est votre façon de vivre.",
    },
    {
      title: 'Constant depuis {{months}} mois',
      message:
        'Vos budgets tiennent depuis {{months}} mois. Gardez la même attention ; elle porte ses fruits.',
    },
    {
      title: 'Une discipline qui dure',
      message:
        '{{months}} mois sans rompre votre plan. Peu de choses libèrent autant que de pouvoir se fier à ses propres décisions.',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: 'Votre argent suit vos valeurs',
      message:
        'La vertu a représenté {{actual}}% de vos dépenses — pas moins des {{planned}}% prévus. Bien dépensé.',
    },
    {
      title: 'La vertu a reçu toute sa part',
      message:
        "{{actual}}% pour la santé, l'apprentissage et les autres, pour {{planned}}% prévus. Ce à quoi vous tenez, vous l'avez payé.",
    },
    {
      title: 'Dépensé pour devenir meilleur',
      message:
        'La vertu a atteint {{actual}}% des dépenses ce mois-ci (prévu : {{planned}}%). Cet argent travaille pour vous bien après être parti.',
    },
    {
      title: 'Intention accomplie',
      message:
        'Vous aviez prévu {{planned}}% pour la vertu et dépensé {{actual}}%. Les bonnes intentions survivent rarement à un mois — la vôtre, si.',
    },
    {
      title: "Le meilleur usage de l'argent",
      message:
        '{{actual}}% sont allés à ce qui vous rend meilleur, vous et les autres. Continuez de le choisir.',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: 'Le loisir à sa place',
      message:
        'Le loisir représente {{actual}}% des dépenses, sous les {{planned}}% que vous lui accordiez. Vous profitez des choses sans vous laisser gouverner par elles.',
    },
    {
      title: 'Le plaisir, à sa juste taille',
      message:
        "Le loisir a pris {{actual}}% pour {{planned}}% prévus. La modération n'est pas se priver — c'est choisir.",
    },
    {
      title: 'Du repos sans excès',
      message:
        "{{actual}}% pour le loisir, sous votre limite de {{planned}}%. Le plaisir a meilleur goût quand ce n'est pas lui qui commande.",
    },
    {
      title: 'La tempérance, en silence',
      message:
        "Vous aviez donné {{planned}}% au loisir et il n'en a utilisé que {{actual}}%. Cette marge est une liberté que vous avez gardée.",
    },
    {
      title: 'Le loisir sous le plan',
      message:
        'À {{actual}}% des dépenses, le loisir est resté sous les {{planned}}% que vous aviez fixés. Bien tenu.',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: '{{percent}}% sous le plan',
      message:
        "Vous avez dépensé {{savedAmount}} de moins que ce que vous vous accordiez ce mois-ci. Ne pas avoir besoin de tout ce qu'on pourrait avoir est une forme de richesse.",
    },
    {
      title: '{{savedAmount}} non dépensés',
      message:
        "Le mois se termine {{percent}}% sous le plan. Ce que vous n'avez pas dépensé reste à vous de le diriger.",
    },
    {
      title: 'Moins que ce que vous vous accordiez',
      message:
        "Les dépenses sont {{percent}}% sous le plan — {{savedAmount}} gardés. Donnez un but à cette marge avant que l'habitude ne la réclame.",
    },
    {
      title: 'Le plan avait de la marge',
      message:
        '{{savedAmount}} sous vos limites ce mois-ci. La retenue qui semble facile est celle qui dure.',
    },
    {
      title: 'Plus léger que prévu',
      message:
        'Il vous a fallu {{percent}}% de moins que budgété. Pensez à diriger ces {{savedAmount}} vers un objectif.',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '« {{goal}} » est dans les temps',
      message:
        "Vous êtes à {{percent}}% du chemin, au rythme dont l'objectif a besoin. Des pas réguliers, chaque mois, mènent loin.",
    },
    {
      title: 'En bonne voie pour « {{goal}} »',
      message:
        "{{percent}}% accomplis, et le rythme tient. Continuez à payer l'objectif en premier ; cela fonctionne.",
    },
    {
      title: '« {{goal}} » : {{percent}}% et régulier',
      message: "L'objectif reçoit chaque mois ce dont il a besoin. La patience fait son œuvre.",
    },
    {
      title: "L'objectif avance comme prévu",
      message:
        '« {{goal}} » est financé à {{percent}}% et dans les temps. Ce qui se fait un peu chaque mois ne peut être arrêté par une mauvaise semaine.',
    },
    {
      title: 'Un progrès digne de confiance',
      message:
        '« {{goal}} » en est à {{percent}}%, au bon rythme. Vous le construisez de la seule manière qui marche — peu à peu.',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: "Moins d'achats impulsifs chez {{merchant}}",
      message:
        "De {{before}} achats le mois dernier à environ {{after}} ce mois-ci. Une habitude desserrée, c'est de la liberté gagnée.",
    },
    {
      title: '{{merchant}} : {{before}} → {{after}}',
      message:
        "Vous y allez moins qu'avant. Chaque réflexe évité est une petite victoire du choix sur l'habitude.",
    },
    {
      title: 'La petite habitude rétrécit',
      message:
        'Les achats chez {{merchant}} sont passés de {{before}} à environ {{after}}. Continuez — cela devient plus facile.',
    },
    {
      title: 'Le choix plutôt que le réflexe',
      message:
        "Chez {{merchant}}, vous êtes passé de {{before}} achats à environ {{after}}. C'est la maîtrise, bâtie une décision à la fois.",
    },
    {
      title: 'Moins de petites dépenses',
      message:
        "{{merchant}} vous a vu environ {{after}} fois au lieu de {{before}}. Les petites victoires s'accumulent.",
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: 'Vous vous êtes adapté à un mois plus maigre',
      message:
        'Les revenus ont baissé de {{incomePercent}}%, et vous avez réduit les dépenses de {{expensePercent}}%. À un changement de fortune, vous avez répondu par un changement de cap.',
    },
    {
      title: 'Du sang-froid quand les revenus ont baissé',
      message:
        'Revenus en baisse de {{incomePercent}}%, dépenses en baisse de {{expensePercent}}%. Vous vous êtes ajusté à ce qui est, non à ce qui était.',
    },
    {
      title: 'La fortune a changé ; vous aussi',
      message:
        "Une baisse de {{incomePercent}}% des revenus a rencontré une baisse de {{expensePercent}}% des dépenses. C'est l'égalité d'âme en chiffres.",
    },
    {
      title: 'Bien gouverné',
      message:
        'Quand les revenus ont baissé de {{incomePercent}}%, les dépenses ont suivi ({{expensePercent}}% de moins). Le vent ne dépendait pas de vous ; la voile, si.',
    },
    {
      title: 'Les dépenses ont suivi les revenus à la baisse',
      message:
        "Vous avez dépensé {{expensePercent}}% de moins quand les revenus ont baissé de {{incomePercent}}%. S'adapter tôt est la voie la plus sereine.",
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: 'La nécessité reste stable',
      message:
        'Depuis {{months}} mois, vos dépenses essentielles ont à peine bougé. Un plancher stable vous laisse de la liberté au-dessus.',
    },
    {
      title: 'Des besoins maîtrisés',
      message:
        'Les dépenses de nécessité sont restées au même niveau pendant {{months}} mois. Des besoins qui ne grandissent pas sont des besoins que vous maîtrisez.',
    },
    {
      title: '{{months}} mois d’essentiel stable',
      message:
        'Le loyer, la nourriture et les factures sont restés où ils étaient. La stabilité discrète est aussi une réussite.',
    },
    {
      title: 'Pas de dérive dans la nécessité',
      message:
        '{{months}} mois sans glissement dans ce que la vie exige. Sur ce terrain, tout le reste se planifie plus facilement.',
    },
    {
      title: 'Un plancher solide',
      message:
        'Les dépenses essentielles sont stables depuis {{months}} mois. Vous ne laissez pas les conforts se faire passer pour des besoins.',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: 'Généreux avec ce que vous gagnez',
      message:
        "En {{months}} mois, {{percent}}% de vos revenus — {{givenAmount}} — sont allés à l'aide aux autres. C'est de l'argent employé au mieux.",
    },
    {
      title: '{{givenAmount}} donnés aux autres',
      message:
        'Vous avez partagé {{percent}}% de vos revenus en {{months}} mois. Une bonté visible dans les chiffres est une bonté pratiquée, pas seulement ressentie.',
    },
    {
      title: 'Mains ouvertes',
      message:
        "Dons et cadeaux ont représenté {{percent}}% de vos revenus ces derniers temps. Ce que vous donnez est la part de votre richesse qu'aucun malheur ne peut prendre.",
    },
    {
      title: 'La générosité fait partie de votre plan',
      message:
        '{{givenAmount}} aux autres en {{months}} mois. Gardez cela — le bien que vous faites aux autres, vous le faites aussi à vous-même.',
    },
    {
      title: 'Bien donné',
      message:
        "{{percent}}% de ce que vous avez gagné est allé à l'aide aux autres. Peu d'habitudes en disent plus sur une personne.",
    },
  ],
  'stoic.praise_steady': [
    {
      title: 'Rien à corriger',
      message: 'Vos dépenses correspondent à ce que vous aviez prévu. Continuez ainsi.',
    },
    {
      title: "L'intention et l'action concordent",
      message: "Ce mois ressemble à ce que vous aviez prévu. Cet accord, c'est tout l'enjeu.",
    },
    {
      title: 'Un mois calme',
      message:
        "Ni excès, ni négligence qui vaille d'être mentionnée. Bravo — gardez la même attention pour la suite.",
    },
    {
      title: 'Tout est en ordre',
      message:
        'Votre plan a tenu et rien ne demande de correction. Profitez du calme que vous avez mérité.',
    },
    {
      title: 'Main sûre',
      message:
        'Le mois a suivi votre plan. Les bonnes habitudes rendent les bons mois ordinaires en apparence.',
    },
  ],
  'expert.pay_yourself_first': [
    {
      title: 'Payez-vous en premier',
      message:
        'La règle de George S. Clason : une part de tout ce que vous gagnez vous revient — au moins un dixième. Sur {{months}} mois, vous avez gardé {{savingsPercent}}%. Mettez {{tenthAmount}} de côté le jour où le revenu arrive, avant toute autre chose.',
    },
    {
      title: 'Un dixième vous revient',
      message:
        "Dans « L'homme le plus riche de Babylone », le premier remède à une bourse plate consiste à garder une pièce sur dix. Votre taux d'épargne est de {{savingsPercent}}% ; {{tenthAmount}} par mois suffirait à lancer l'habitude.",
    },
    {
      title: 'Épargner avant de dépenser, pas après',
      message:
        "Le conseil de Clason est simple : payez-vous en premier. Ces derniers temps, {{savingsPercent}}% du revenu vous est resté. Mettez {{tenthAmount}} de côté le jour de la paie et laissez les dépenses s'ajuster à ce qui reste.",
    },
    {
      title: 'La première pièce est pour vous',
      message:
        "Une part de tout ce que vous gagnez devrait vous rester — pas moins d'un dixième, dit Clason. Vous avez gardé {{savingsPercent}}% sur {{months}} mois. Commencez par {{tenthAmount}} par mois, automatiquement.",
    },
    {
      title: '{{savingsPercent}}% gardés — la règle demande 10%',
      message:
        "Payez-vous en premier, comme le dit « L'homme le plus riche de Babylone » : {{tenthAmount}} par mois, mis de côté avant toute facture. L'épargne faite en premier ne dépend pas de ce qui reste.",
    },
  ],
  'expert.rule_50_30_20': [
    {
      title: 'Votre bilan 50/30/20',
      message:
        "Elizabeth Warren et Amelia Warren Tyagi proposent 50% du revenu après impôts pour l'indispensable, 30% pour les envies, 20% pour l'épargne. Chez vous : {{needsPercent}}% / {{wantsPercent}}% / {{savingsPercent}}%.",
    },
    {
      title: 'Besoins {{needsPercent}}%, envies {{wantsPercent}}%, épargne {{savingsPercent}}%',
      message:
        "« All Your Worth » équilibre l'argent selon la règle 50/30/20. Comparez à votre plan la catégorie la plus éloignée de sa cible — c'est là qu'un seul changement aide le plus.",
    },
    {
      title: 'Comment votre revenu se répartit',
      message:
        "L'indispensable prend {{needsPercent}}% du revenu, les envies {{wantsPercent}}%, et {{savingsPercent}}% est épargné. L'équilibre 50/30/20 d'« All Your Worth » est un miroir utile, pas un verdict.",
    },
    {
      title: "La formule de l'argent équilibré",
      message:
        "La formule de Warren et Tyagi : la moitié pour ce que vous devez payer quoi qu'il arrive, 30% pour les envies, 20% pour l'avenir. Vous en êtes à {{needsPercent}}/{{wantsPercent}}/{{savingsPercent}}.",
    },
    {
      title: 'Face au 50/30/20',
      message:
        "Votre répartition : {{needsPercent}}% d'indispensable, {{wantsPercent}}% d'envies, {{savingsPercent}}% d'épargne. Le test du livre pour l'indispensable : le paieriez-vous encore si vous perdiez votre emploi demain ?",
    },
  ],
  'expert.room_for_error': [
    {
      title: "Gardez une marge d'erreur",
      message:
        'Le conseil de Morgan Housel : prévoir que les choses ne se passent pas comme prévu. Votre solde couvre environ {{cushionDays}} jours de dépenses ; un repère courant est de trois mois — {{targetAmount}}.',
    },
    {
      title: 'Un coussin de {{cushionDays}} jours',
      message:
        "« La psychologie de l'argent » appelle cela la marge d'erreur — le jeu qui permet de survivre aux surprises. Viser {{targetAmount}}, soit trois mois de dépenses, donne au plan une chance de survivre à la réalité.",
    },
    {
      title: 'Une marge de sécurité, à la maison',
      message:
        "Housel emprunte à Graham la marge de sécurité pour l'argent personnel. Avec {{cushionDays}} jours de dépenses en réserve, un seul mauvais mois pourrait défaire un bon plan. Visez {{targetAmount}}.",
    },
    {
      title: "De la place pour l'imprévu",
      message:
        'Votre réserve durerait environ {{cushionDays}} jours. Les surprises sont la seule certitude ; trois mois de dépenses ({{targetAmount}}) sont un objectif très répandu.',
    },
    {
      title: "Prévoyez de la marge avant d'en avoir besoin",
      message:
        "La marge d'erreur, selon Morgan Housel, est ce qui vous garde dans la partie. Environ {{cushionDays}} jours sont couverts ; {{targetAmount}} couvrirait trois mois.",
    },
  ],
  'expert.lifestyle_creep': [
    {
      title: 'Les dépenses vont plus vite que le revenu',
      message:
        'Les dépenses ont augmenté de {{expenseGrowth}}% au dernier trimestre, tandis que le revenu a varié de {{incomeGrowth}}%. Première règle de « The Millionaire Next Door » : quel que soit votre revenu, vivez en dessous de vos moyens.',
    },
    {
      title: 'Vivre plus haut, pas plus riche',
      message:
        "Stanley et Danko ont constaté que la richesse, c'est ce que l'on accumule, pas ce que l'on dépense. Vos dépenses ont progressé de {{expenseGrowth}}%, le revenu de {{incomeGrowth}}% — c'est dans cet écart que la richesse s'échappe.",
    },
    {
      title: 'Train de vie en hausse : +{{expenseGrowth}}%',
      message:
        'Les dépenses ont grimpé plus vite que le revenu ({{incomeGrowth}}%). Les personnes décrites dans « The Millionaire Next Door » sont restées riches en laissant le revenu augmenter sans que les dépenses suivent.',
    },
    {
      title: "La ligne d'arrivée recule",
      message:
        "Les dépenses ont augmenté de {{expenseGrowth}}% d'un trimestre à l'autre, contre {{incomeGrowth}}% pour le revenu. Vivez en dessous de vos moyens, disent Stanley et Danko — quels que soient ces moyens.",
    },
    {
      title: "La richesse, c'est ce que l'on garde",
      message:
        "Un bon revenu entièrement dépensé n'enrichit personne. Au dernier trimestre, vos dépenses ont progressé de {{expenseGrowth}}% et le revenu de {{incomeGrowth}}% — à examiner avant que cela ne devienne la nouvelle norme.",
    },
  ],
  'expert.life_energy': [
    {
      title: '{{merchant}} vous a coûté {{hours}} heures de vie',
      message:
        "Vicki Robin et Joe Dominguez proposent d'évaluer les choses en énergie vitale — les heures de travail qu'elles coûtent. {{totalAmount}} chez {{merchant}} ce mois-ci, c'est environ {{hours}} heures. Cela en valait-il la peine ?",
    },
    {
      title: '{{hours}} heures chez {{merchant}}',
      message:
        "« Your Money or Your Life » invite à voir l'argent comme le temps échangé pour l'obtenir. À votre revenu horaire moyen, {{totalAmount}} dépensés là-bas représentent environ {{hours}} heures de travail.",
    },
    {
      title: 'Comptez en heures',
      message:
        "{{totalAmount}} chez {{merchant}}, c'est environ {{hours}} heures de travail. Robin et Dominguez appellent cela l'énergie vitale — la seule monnaie que l'on ne peut pas regagner.",
    },
    {
      title: 'Ce que {{merchant}} a vraiment coûté',
      message:
        "L'argent est une chose contre laquelle nous échangeons notre énergie vitale. Ce mois-ci, {{merchant}} vous a pris environ {{hours}} heures ({{totalAmount}}). Le plaisir est-il à la hauteur de ces heures ?",
    },
    {
      title: "Bilan d'énergie vitale",
      message:
        'Converti à votre revenu horaire moyen, {{totalAmount}} dépensés chez {{merchant}} représentent environ {{hours}} heures. « Your Money or Your Life » suggère de se demander si cela a apporté un épanouissement en proportion.',
    },
  ],
};
