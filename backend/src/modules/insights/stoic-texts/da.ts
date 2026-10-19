import type { StoicTextMap } from './types';

export const da: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: 'Måneden voksede ud over sin plan',
      message:
        'Du planlagde {{plannedAmount}} og har brugt {{spentAmount}} — {{percent}} % mere. Planen blev lagt med et klart hoved; lad den tale højere end øjeblikket.',
    },
    {
      title: '{{percent}} % over det, du ville bruge',
      message:
        'Forbruget står på {{spentAmount}} mod en plan på {{plannedAmount}}. Se på, hvilken grænse der gav efter først — der ligger lektionen.',
    },
    {
      title: 'Din plan og din måned er uenige',
      message:
        '{{spentAmount}} brugt, {{plannedAmount}} tilsigtet. Enten krævede planen for lidt af virkeligheden, eller virkeligheden krævede for meget af dig — afgør roligt hvilket.',
    },
    {
      title: 'Mere gik ud, end du tillod',
      message:
        'Måneden er {{percent}} % over de {{plannedAmount}}, du satte. Intet er tabt ved at stoppe nu; meget er tabt ved at lade som om det ikke skete.',
    },
    {
      title: 'En grænse du satte, en grænse du krydsede',
      message:
        'Du ville bruge {{plannedAmount}}; det er {{spentAmount}}. Selvbeherskelse er ikke aldrig at glide — det er at mærke det tidligt og vende tilbage til stien.',
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: 'Fritid tager mere, end du planlagde',
      message:
        'Du ville have fritid til at være {{planned}} % af forbruget; denne måned er det {{actual}} %. Nydelse er velkommen som gæst, ikke som husets herre.',
    },
    {
      title: 'Fritid på {{actual}} %, planlagt {{planned}} %',
      message:
        'Hvile fortjener sin plads, når den genopbygger dig. Spørg hvilke af månedens nydelser der gjorde det, og slip resten uden fortrydelse.',
    },
    {
      title: 'Komfort bruger mere end hensigten',
      message:
        'Fritid holder {{actual}} % af forbruget mod de {{planned}} %, du valgte. Mådehold er ikke at afvise nydelse — det er at holde den i den størrelse, du besluttede.',
    },
    {
      title: 'Det behagelige fortrænger det planlagte',
      message:
        'Du gav fritiden {{planned}} % af planen, og den tog {{actual}} %. Det, du nyder uden anstrengelse, er værd at se på en gang mere, før det bliver det, du har brug for.',
    },
    {
      title: 'Fritiden er trådt over sin linje',
      message:
        '{{actual}} % af måneden gik til fritid, {{planned}} % var hensigten. Linjen var din at tegne, og den er din at holde.',
    },
  ],
  'stoic.leisure_habit': [
    {
      title: 'Fritid over plan igen',
      message:
        'Fritiden gik ud over din plan i {{months}} af de sidste {{window}} måneder. En gentagelse er ikke længere et uheld — det er en vane værd at undersøge.',
    },
    {
      title: '{{months}} af {{window}} måneder over fritidsplanen',
      message:
        'Hvad der sker én gang, er omstændigheder; hvad der sker {{months}} gange, er karakter under opbygning. Vælg karakteren med vilje.',
    },
    {
      title: 'Samme fejltrin, måned efter måned',
      message:
        'Fritiden løb fra planen i {{months}} af {{window}} måneder. Hæv planen ærligt eller skift vanen — at leve mellem de to koster mest.',
    },
    {
      title: 'Et mønster, ikke et udfald',
      message:
        'I {{months}} af de sidste {{window}} måneder tog fritiden mere, end du gav den. Læg mærke til øjeblikket, hvor beslutningen træffes, ikke kun regningen bagefter.',
    },
    {
      title: 'Vanen stemmer mod din plan',
      message:
        'Fritiden slog planen {{months}} gange på {{window}} måneder. Vaner bygges et valg ad gangen; sådan afvikles de også.',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: 'Dyd får mindre, end du tilsigtede',
      message:
        'Du satte {{planned}} % af budgettet af til helbred, læring og andre; indtil nu er det {{actual}} %. En hensigt tæller, når den er udført.',
    },
    {
      title: 'Dyd på {{actual}} % af planlagte {{planned}} %',
      message:
        'De penge, du ville bruge på det, der gør dig bedre, venter stadig. Der er ikke noget bedre tidspunkt at bruge dem godt end denne måned.',
    },
    {
      title: 'Det gode du planlagde, er ubrugt',
      message:
        'Helbred, læring og gavmildhed skulle have {{planned}} % af forbruget; de fik {{actual}} %. Gør en af dem denne uge, bevidst.',
    },
    {
      title: 'Hensigt uden handling',
      message:
        'Dyd holder {{actual}} % af forbruget mod de {{planned}} %, du valgte. Hvad vi værdsætter, viser sig i det, vi faktisk betaler for.',
    },
    {
      title: 'Der er plads tilbage til det, der betyder noget',
      message:
        'Kun {{actual}} % gik til dyd, selvom du planlagde {{planned}} %. En bog, et helbredstjek, en gave til nogen i nød — planen har allerede sagt ja.',
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: 'Dyd bliver hele tiden udskudt',
      message:
        'Forbruget på helbred, læring og andre har ligget under din plan {{months}} måneder i træk. Det, du bliver ved med at udskyde, har du i virkeligheden besluttet dig imod.',
    },
    {
      title: '{{months}} måneder med udskudt dyd',
      message:
        'Hver måned gav planen plads til det, der gør dig bedre, og hver måned blev den ubrugt. Tid er det ene, du ikke kan budgettere to gange.',
    },
    {
      title: 'Det bedre selv venter stadig',
      message:
        'Dyd har ligget under plan {{months}} måneder i træk. Begynd lille og sikkert frem for stort og senere.',
    },
    {
      title: 'Gode hensigter ældes',
      message:
        'I {{months}} måneder fik helbred, læring og gavmildhed mindre, end du planlagde. Vælg én og finansier den først næste måned, før noget andet.',
    },
    {
      title: 'Dyd taber hele tiden til „senere“',
      message:
        '{{months}} måneder i træk under plan. Senere er der, hvor gode hensigter går hen for at blive glemt — giv denne en dato.',
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: 'Din plan har ingen plads til dyd',
      message:
        'Ingen af dine budgetter tjener helbred, læring eller andre. En plan viser, hvad vi værdsætter — overvej at give dyd sin egen linje.',
    },
    {
      title: 'Alle budgetter, men ingen til det gode',
      message:
        'Nødvendighed, arbejde og fritid har alle grænser; dyd har ingen. Det, der aldrig planlægges, har en tendens til aldrig at ske.',
    },
    {
      title: 'Planlæg det, der gør dig bedre',
      message:
        'Der er endnu ikke noget budget i dydsklassen. Selv et lille — bøger, sport, en donation — forvandler et ønske til en forpligtelse.',
    },
    {
      title: 'Planen er tavs om dyd',
      message:
        'Du budgetterer for det, du skal, og det, du nyder, endnu ikke for den, du vil blive. Ét beskedent dydsbudget ville ændre det.',
    },
    {
      title: 'Dyd har intet budget',
      message:
        'Forbrug på helbred, læring eller andre er ikke planlagt nogen steder. Vælg én og giv den en grænse, du ville være glad for at nå.',
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: 'Nødvendigheder koster mere end planlagt',
      message:
        'Du planlagde {{planned}} % af forbruget til nødvendigheder; de tager {{actual}} %. Tjek, om hver enkelt stadig er et behov, eller stilfærdigt er blevet en komfort.',
    },
    {
      title: 'Nødvendighed på {{actual}} %, planlagt {{planned}} %',
      message:
        'Hvad livet kræver, er normalt mindre end det, vi vænner os til. Se den største nødvendighed igennem med friske øjne.',
    },
    {
      title: 'Det nødvendige svulmer',
      message:
        'Nødvendigheder holder {{actual}} % af måneden mod de {{planned}} %, du forventede. Et behov, der bliver ved at vokse, fortjener et spørgsmål.',
    },
    {
      title: 'Behovene vokser ud over planen',
      message:
        'Planlagt {{planned}} %, faktisk {{actual}} %. Enten undervurderede planen de reelle omkostninger, eller nogle ønsker rejser under navn af behov.',
    },
    {
      title: 'Mere brugt på „skal“ end tilsigtet',
      message:
        'Nødvendigheder tog {{actual}} % af forbruget i stedet for {{planned}} %. Skil det, der virkelig skal være, fra det, der blot altid har været.',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: 'Nødvendigheder kryber opad',
      message:
        'Forbruget på nødvendigheder er steget {{months}} måneder i træk, {{percent}} % i alt. Behov vokser stille, når ingen beder dem retfærdiggøre sig.',
    },
    {
      title: '+{{percent}} % på nødvendigheder i {{months}} måneder',
      message:
        'Hvert skridt virkede lille; tilsammen er de det ikke. Tag den største tilbagevendende nødvendighed og spørg, om den stadig skal koste så meget.',
    },
    {
      title: 'Gulvet i dit forbrug stiger',
      message:
        'Nødvendigheder voksede {{months}} måneder i træk (+{{percent}} %). Et stigende gulv efterlader mindre plads til alt det, du vælger frit.',
    },
    {
      title: 'Behovene udvider sig',
      message:
        '{{months}} måneder med vækst, {{percent}} % i alt. Den stoiske prøve er enkel: ville du vælge dette igen i dag, nu hvor du kender prisen?',
    },
    {
      title: 'Små stigninger, stabil retning',
      message:
        'Nødvendigheder er oppe {{percent}} % over {{months}} måneder. Retningen betyder mere end nogen enkelt måned — denne er værd at rette tidligt.',
    },
  ],
  'stoic.work_over_plan': [
    {
      title: 'Arbejde koster mere end planlagt',
      message:
        'Du planlagde {{planned}} % af forbruget til arbejde; det tager {{actual}} %. Værktøj og tjenester skal tjene deres plads — tjek hvilke der gør.',
    },
    {
      title: 'Arbejdsforbrug på {{actual}} %, planlagt {{planned}} %',
      message:
        'Investering i dit arbejde er god, når den giver noget tilbage. Se igennem, hvad du betaler for, men ikke længere bruger.',
    },
    {
      title: 'Arbejdsbudgettet er strakt',
      message:
        'Arbejde tog {{actual}} % i stedet for {{planned}} %. Flid er at gøre arbejdet godt, ikke at købe hvert værktøj til det.',
    },
    {
      title: 'Værktøj bruger mere end planen',
      message:
        'Planlagt {{planned}} %, brugt {{actual}} % på arbejde. Spørg hver udgift: hjælper den mig med at gøre arbejdet, eller føles den blot som fremskridt?',
    },
    {
      title: 'Arbejdsomkostningerne er gledet',
      message:
        'Arbejde holder {{actual}} % af forbruget mod {{planned}} % tilsigtet. Et hurtigt eftersyn nu sparer et større senere.',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '„{{category}}“ bliver ved at bryde sin grænse',
      message:
        '„{{category}}“ gik over budget i {{months}} af de sidste {{window}} måneder. Enten er grænsen forkert, eller lysten er — afgør hvilket.',
    },
    {
      title: '„{{category}}“: over budget {{months}} af {{window}} måneder',
      message:
        'En grænse, der altid krydses, er ikke en grænse, kun et ønske. Gør den ærlig — hæv den med vilje eller hold den med vilje.',
    },
    {
      title: 'Samme budget giver efter igen',
      message:
        '„{{category}}“ har overskredet sin grænse {{months}} gange på {{window}} måneder. Gentagelsen er information; brug den.',
    },
    {
      title: '„{{category}}“ beder om din opmærksomhed',
      message:
        'Over budget i {{months}} af {{window}} måneder. Hold øje med øjeblikket før købet — det er det eneste sted, vanen kan ændres.',
    },
    {
      title: 'Et mønster i „{{category}}“',
      message:
        '{{months}} overskridelser på {{window}} måneder. Det vi gentager, bliver vi; beslut hvad du vil have, denne kategori siger om dig.',
    },
  ],
  'stoic.budget_pace': [
    {
      title: '„{{category}}“ løber tør omkring dag {{day}}',
      message:
        'Du har brugt {{spentAmount}} af {{limitAmount}}, og med dette tempo slutter grænsen omkring dag {{day}}. At sætte farten ned nu er lettere end at stoppe senere.',
    },
    {
      title: '„{{category}}“ er foran måneden',
      message:
        '{{spentAmount}} er allerede væk af en grænse på {{limitAmount}}. Med denne hastighed er den opbrugt omkring dag {{day}} — resten af måneden er stadig din at forme.',
    },
    {
      title: 'Tempotjek: „{{category}}“',
      message:
        'Budgettet på {{limitAmount}} holder til omkring dag {{day}} med det nuværende tempo. Forudseenhed er den billigste form for disciplin.',
    },
    {
      title: '„{{category}}“ bruger fremtiden',
      message:
        '{{spentAmount}} af {{limitAmount}} brugt; grænsen slutter nær dag {{day}}. Hvad du gør denne uge, afgør, om det sker.',
    },
    {
      title: 'Tidlig advarsel for „{{category}}“',
      message:
        'Med det nuværende tempo når grænsen på {{limitAmount}} ikke månedens slutning — den løber tør omkring dag {{day}}. Justér, mens det koster lidt.',
    },
  ],
  'stoic.budget_unused': [
    {
      title: '„{{category}}“ har stået ubrugt',
      message:
        'Budgettet for „{{category}}“ har ikke haft forbrug i {{months}} måneder. Enten er du vokset ud af det, eller det er en hensigt, der stadig venter — afgør hvilket.',
    },
    {
      title: 'Et tomt budget: „{{category}}“',
      message:
        '{{months}} måneder uden en enkelt udgift. En plan bør beskrive det liv, du lever, eller det, du bygger — hvilket er dette?',
    },
    {
      title: '„{{category}}“ står stille',
      message:
        'Intet brugt her i {{months}} måneder. Var det tilbageholdenhed, godt gået; var det forsømmelse, gør noget ved det.',
    },
    {
      title: 'Planlagt, men ikke levet',
      message:
        '„{{category}}“ har haft en grænse og intet forbrug i {{months}} måneder. Hold planen sandfærdig: fjern den eller brug den.',
    },
    {
      title: '„{{category}}“: {{months}} stille måneder',
      message:
        'Et budget, der aldrig bliver rørt, optager stadig en plads i din plan. Frigør pladsen eller ær hensigten.',
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: '{{percent}} % af forbruget har ingen grænse',
      message:
        '{{unbudgetedAmount}} denne måned gik til kategorier, som intet budget holder øje med. Det, der ikke måles, er svært at mestre.',
    },
    {
      title: 'Meget af måneden er uplanlagt',
      message:
        '{{percent}} % af forbruget — {{unbudgetedAmount}} — ligger uden for hvert budget. Giv den største del en grænse, og planen vil se mere af dit liv.',
    },
    {
      title: 'Forbrug uden for planen',
      message:
        'Budgetterne dækker kun en del af det, du bruger; {{unbudgetedAmount}} ({{percent}} %) forbliver umålt. Udvid planen derhen, hvor pengene faktisk går.',
    },
    {
      title: 'Planen ser kun en del af billedet',
      message:
        '{{percent}} % af denne måneds forbrug har intet budget. Klart syn kommer før god dømmekraft.',
    },
    {
      title: '{{unbudgetedAmount}} brugt uden grænse',
      message:
        'Det er {{percent}} % af måneden. Du behøver ikke at begrænse det — kun at afgøre, hvor meget af det du faktisk ønsker.',
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '„{{category}}“ er størstedelen af din fritid',
      message:
        '{{percent}} % af fritidsforbruget gik til „{{category}}“. Variation i hvile er sundere end at afhænge af én nydelse.',
    },
    {
      title: 'Én nydelse dominerer',
      message:
        '„{{category}}“ tager {{percent}} % af alt, du brugte på fritid. Spørg, om den stadig glæder dig, eller er blevet rutine.',
    },
    {
      title: 'Fritiden læner sig på „{{category}}“',
      message:
        '{{percent}} % af fritiden på ét sted. Det, vi ikke kan undvære, har tag i os — tjek at taget stadig er let.',
    },
    {
      title: '„{{category}}“: {{percent}} % af fritiden',
      message:
        'En enkelt kilde til nydelse tager næsten det hele. Prøv en billigere, anden nydelse denne måned og sammenlign.',
    },
    {
      title: 'Din hvile har én adresse',
      message:
        'De fleste fritidspenge — {{percent}} % — går til „{{category}}“. Frihed indebærer også at kunne nyde andre ting.',
    },
  ],
  'stoic.unclassified': [
    {
      title: 'Noget forbrug er endnu ikke bedømt',
      message:
        '{{count}} kategorier har ingen klasse. Afgør i Budgetter, hvad der er nødvendighed, arbejde, dyd eller fritid.',
    },
    {
      title: '{{count}} kategorier afventer din vurdering',
      message:
        'De har forbrug men ingen klasse, så rådene kan ikke vægte dem. Et minut i Budgetter afgør det.',
    },
    {
      title: 'Giv navn til det, dine penge tjener',
      message:
        '{{count}} kategorier er stadig uklassificerede. Dømmekraft begynder med at kalde ting ved deres rette navne.',
    },
    {
      title: 'Ubedømt forbrug: {{count}} kategorier',
      message:
        'Er det et behov, dit arbejde, en dyd eller en nydelse? Kun du kan sige det — og planen bliver klarere, når du gør.',
    },
    {
      title: 'Et par kategorier har ingen klasse',
      message:
        '{{count}} kategorier står uden for de fire klasser. Klassificér dem i Budgetter, så hver udgift ses for det, den er.',
    },
  ],
  'stoic.small_purchases': [
    {
      title: '{{count}} små køb hos {{merchant}}',
      message:
        'Hvert virkede ubetydeligt; tilsammen blev de {{totalAmount}} denne måned. Små, uundersøgte vaner er, hvor de fleste penge stilfærdigt forsvinder.',
    },
    {
      title: '{{merchant}}: {{count}} gange denne måned',
      message:
        '{{totalAmount}} i små beløb. Spørg, om hvert besøg var et valg eller en refleks — kun det første er frihed.',
    },
    {
      title: 'Lidt ad gangen: {{totalAmount}}',
      message:
        '{{count}} køb hos {{merchant}}. Ingen enkelt betyder noget; vanen gør. Afgør, hvor ofte du faktisk vil have det.',
    },
    {
      title: 'En vane hos {{merchant}}',
      message:
        '{{count}} køb, {{totalAmount}} i alt. Prøv at springe hvert tredje over denne måned og se, om du savner det.',
    },
    {
      title: 'De små ting lægger sig sammen',
      message:
        '{{merchant}} så dig {{count}} gange, for {{totalAmount}}. Herredømme over store beslutninger bygges på små som disse.',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: 'Weekender bærer {{percent}} % af fritiden',
      message:
        'Størstedelen af dit fritidsforbrug sker lørdag og søndag. Hvile er godt; tjek at det er hvile og ikke erstatning for ugen.',
    },
    {
      title: 'Fritiden lever i weekenden',
      message:
        '{{percent}} % af fritidsforbruget falder i weekenden. Planlæg weekenden en smule, og den vil koste mindre og give mere.',
    },
    {
      title: 'Weekenden betaler for ugen',
      message:
        'Weekender tager {{percent}} % af det, du bruger på fritid. Hvis ugen skal repareres hver lørdag, så se på ugen.',
    },
    {
      title: 'Lørdag og søndag: {{percent}} % af fritiden',
      message:
        'Frie dage inviterer til frit forbrug. Afgør før weekenden, hvad den er til, og lad pengene følge.',
    },
    {
      title: 'Et weekendmønster',
      message:
        '{{percent}} % af fritidsforbruget sker i weekenden. Lettere hverdage gør ofte weekender billigere.',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}} tog {{percent}} % af måneden',
      message:
        '{{totalAmount}} gik til én forretning til fritid. Når ét sted har så mange af dine penge, så spørg, hvor meget af din opmærksomhed det også har.',
    },
    {
      title: 'Ét sted, {{totalAmount}}',
      message:
        '{{merchant}} er {{percent}} % af denne måneds forbrug. Er det den andel af dit livs arbejde værd?',
    },
    {
      title: '{{merchant}} fører dit forbrug',
      message:
        '{{percent}} % af måneden — {{totalAmount}} — gik derhen. Intet galt i at nyde det, så længe du ville vælge det igen.',
    },
    {
      title: 'En stor andel hos {{merchant}}',
      message:
        '{{totalAmount}}, eller {{percent}} % af forbruget, på ét fritidssted. Vej nydelsen mod prisen, roligt.',
    },
    {
      title: '{{percent}} % hos {{merchant}}',
      message:
        'Denne ene forretning tog {{totalAmount}}. Frihed er at kunne gå forbi, når du vælger det.',
    },
  ],
  'stoic.income_drop': [
    {
      title: 'Indtægten faldt, forbruget gjorde ikke',
      message:
        'Indtægten faldt {{percent}} % til {{incomeAmount}}, men forbruget blev på {{expenseAmount}}. Skæbnen skiftede mening; dit forbrug har ikke bemærket det endnu.',
    },
    {
      title: 'Indtægten ned {{percent}} %',
      message:
        '{{incomeAmount}} kom ind mod {{expenseAmount}} ud. Hvad skæbnen giver, kan den tage tilbage — tilpas forbruget til det, der er, ikke det, der var.',
    },
    {
      title: 'En slankere måned, de samme vaner',
      message:
        'Indtægten er {{percent}} % lavere ({{incomeAmount}}), mens forbruget holdt sig på {{expenseAmount}}. Indtægten er ikke i din magt; reaktionen er.',
    },
    {
      title: 'Skæbnen flyttede sig',
      message:
        'Du tjente {{percent}} % mindre end normalt, men brugte {{expenseAmount}} som før. Skær ned nu, mens det er et valg frem for en nødvendighed.',
    },
    {
      title: 'Forbruget har ikke fulgt indtægten',
      message:
        'Indtægten faldt til {{incomeAmount}} ({{percent}} % ned); forbruget er {{expenseAmount}}. Sæt sejlet efter den vind, du faktisk har.',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: 'Abonnementer: {{monthlyAmount}} om måneden',
      message:
        '{{count}} abonnementer tager {{percent}} % af dit månedlige forbrug. Hvert fornyes uden at spørge dig — spørg selv om hvert.',
    },
    {
      title: '{{percent}} % af forbruget fornyer sig selv',
      message:
        '{{count}} abonnementer, {{monthlyAmount}} om måneden. Behold dem, du ville tilmelde dig igen i dag.',
    },
    {
      title: 'Stille, tilbagevendende, {{monthlyAmount}}',
      message:
        '{{count}} abonnementer koster {{percent}} % af din måned. Bekvemmelighed er en god tjener og en dyr herre.',
    },
    {
      title: '{{count}} abonnementer at gennemgå',
      message:
        'Tilsammen er de {{monthlyAmount}} om måneden, {{percent}} % af forbruget. Opsig ét, du næsten ikke bruger, og mærk hvor lidt du savner det.',
    },
    {
      title: 'Det der fornyer sig selv',
      message:
        '{{monthlyAmount}} om måneden fordelt på {{count}} abonnementer. Automatisk forbrug fortjener en bevidst gennemgang.',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: 'Din succes kunne række lidt længere',
      message:
        'Over {{months}} måneder beholdt du {{savingsPercent}} % af din indtægt, men næsten intet af det gik til andre. Rigdom sidder bedst i åbne hænder — måske en gave eller donation denne måned?',
    },
    {
      title: 'Tjener godt, giver lidt',
      message:
        '{{incomeAmount}} kom ind over {{months}} måneder, og {{givenAmount}} gik til andre. Hjælper du på måder, denne app ikke kan se, så se bort fra dette; hvis ikke, har planen plads til det.',
    },
    {
      title: 'Et godt år til at være gavmild',
      message:
        'Du sparede {{savingsPercent}} % af indtægten — tegn på en stabil hånd. En lille del af det, givet til nogen i nød, ville gøre stabiliteten mere værd.',
    },
    {
      title: 'Ingen andre med på billedet endnu',
      message:
        'De sidste {{months}} måneder viser omhyggelig indtjening og opsparing, men ingen velgørenhed eller gaver. Vi er skabt for hinanden; en beskeden gave er nok til at begynde.',
    },
    {
      title: 'Plads til venlighed',
      message:
        'Kun {{givenAmount}} af {{incomeAmount}} gik til at hjælpe andre. Overvej en lille, fast donation — gavmildhed bliver lettere med vane, som enhver dyd.',
    },
  ],
  'stoic.goal_behind': [
    {
      title: '„{{goal}}“ falder bagud',
      message:
        'Det kræver {{requiredAmount}} om måneden, og du lægger omkring {{paceAmount}} ind. Med dette tempo ankommer det {{monthsLate}} måneder for sent.',
    },
    {
      title: '„{{goal}}“: {{monthsLate}} måneder forsinket med dette tempo',
      message:
        'Krævet {{requiredAmount}} om måneden, faktisk omkring {{paceAmount}}. Flyt datoen ærligt eller flyt flere penge bevidst.',
    },
    {
      title: 'Målet og tempoet er uenige',
      message:
        '„{{goal}}“ beder om {{requiredAmount}} om måneden; det får {{paceAmount}}. Et mål er kun så virkeligt som det månedlige skridt mod det.',
    },
    {
      title: '„{{goal}}“ har brug for et fastere skridt',
      message:
        '{{paceAmount}} om måneden mod de {{requiredAmount}}, det kræver. Betal målet først næste måned, før noget valgfrit.',
    },
    {
      title: 'Bagud på „{{goal}}“',
      message:
        'Det nuværende tempo ({{paceAmount}}/måned) efterlader det {{monthsLate}} måneder forsinket. Små forøgelser nu slår store ofre senere.',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: '„{{goal}}“ passer ikke i planen',
      message:
        'Det kræver {{requiredAmount}} om måneden, men efter dine budgetter er kun {{freeAmount}} fri. Skift datoen, målet eller budgetterne — at håbe er ikke en plan.',
    },
    {
      title: '„{{goal}}“ beder om mere, end du har frit',
      message:
        '{{requiredAmount}} krævet hver måned, {{freeAmount}} tilgængeligt. At ville alt på én gang er sådan, intet bliver gjort; vælg.',
    },
    {
      title: 'Tallene siger nej — for nu',
      message:
        '„{{goal}}“ kræver {{requiredAmount}} om måneden; dine frie midler er {{freeAmount}}. Justér det, der er i din magt: fristen eller de andre grænser.',
    },
    {
      title: '„{{goal}}“ kræver en beslutning',
      message:
        'Med {{requiredAmount}} om måneden overstiger det de {{freeAmount}}, der er tilbage efter budgetterne. Et mål valgt med åbne øjne er bedre end et, der holdes af ønsketænkning.',
    },
    {
      title: 'Et umuligt tempo for „{{goal}}“',
      message:
        'Krævet {{requiredAmount}} månedligt, frit {{freeAmount}}. Ærlig regning nu sparer skuffelse senere.',
    },
  ],
  'stoic.shortfall': [
    {
      title: 'Din saldo dykker under nul den {{date}}',
      message:
        'Kommende betalinger på {{committedAmount}} bringer den forventede saldo til {{lowestAmount}}. Forbered dig nu, mens det kun er en prognose.',
    },
    {
      title: 'Et underskud er på vej: {{date}}',
      message:
        'Forpligtede betalinger ({{committedAmount}}) overhaler saldoen og bunder på {{lowestAmount}}. At foregribe modgang er, hvordan den mister sin magt.',
    },
    {
      title: 'Planlæg for {{date}}',
      message:
        'Den dag når den forventede saldo {{lowestAmount}}. Flyt en betaling, hold et ønske tilbage, eller sæt kontanter til side — hver af disse er i din magt i dag.',
    },
    {
      title: 'Forpligtelser overstiger saldoen',
      message:
        '{{committedAmount}} forfalder, og saldoen falder til {{lowestAmount}} omkring den {{date}}. Det rolige svar er det tidlige.',
    },
    {
      title: 'Forudse hullet den {{date}}',
      message:
        'Forventet lavest saldo: {{lowestAmount}}. Hvad der er forudset, kan mødes med sindsro; hvad der overrasker os, sjældent.',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: 'Du holdt dit ord til dig selv',
      message:
        'I {{months}} måneder i træk blev dit forbrug inden for den plan, du satte. Sådan ser selvbeherskelse ud.',
    },
    {
      title: '{{months}} måneder inden for plan',
      message:
        'Måned efter måned stemmer det, du tilsigtede, og det, du gjorde. Konsistens er mere stilfærdig end viljestyrke og holder længere.',
    },
    {
      title: 'Plan og liv er enige',
      message:
        '{{months}} måneder i træk inden for dine grænser. En plan, der holdes så godt, er ikke længere en begrænsning — det er, sådan du lever.',
    },
    {
      title: 'Stabil i {{months}} måneder',
      message:
        'Dine budgetter har holdt {{months}} måneder i træk. Behold samme opmærksomhed; det virker.',
    },
    {
      title: 'Disciplin, vedvarende',
      message:
        '{{months}} måneder uden at bryde din plan. Få ting er så frigørende som at stole på sine egne beslutninger.',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: 'Dine penge følger dine værdier',
      message:
        'Dyd tog {{actual}} % af dit forbrug — ikke mindre end de {{planned}} %, du planlagde. Godt brugt.',
    },
    {
      title: 'Dyd fik sin fulde andel',
      message:
        '{{actual}} % på helbred, læring og andre, mod {{planned}} % planlagt. Det du værdsætter, betalte du for.',
    },
    {
      title: 'Brugt på at blive bedre',
      message:
        'Dyd nåede {{actual}} % af forbruget denne måned (planlagt {{planned}} %). De penge arbejder for dig længe efter de er væk.',
    },
    {
      title: 'Hensigt udført',
      message:
        'Du planlagde {{planned}} % til dyd og brugte {{actual}} %. Gode hensigter overlever sjældent en måned — dine gjorde.',
    },
    {
      title: 'Den bedste brug af penge',
      message: '{{actual}} % gik til det, der gør dig og andre bedre. Bliv ved med at vælge det.',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: 'Fritid på sin plads',
      message:
        'Fritid er {{actual}} % af forbruget, under de {{planned}} %, du tillod den. Du nyder ting uden at blive styret af dem.',
    },
    {
      title: 'Nydelse, holdt i størrelse',
      message:
        'Fritid tog {{actual}} % mod {{planned}} % planlagt. Mådehold er ikke at gå glip af noget — det er at vælge.',
    },
    {
      title: 'Hvile uden overdrivelse',
      message:
        '{{actual}} % på fritid, under din grænse på {{planned}} %. Nydelse smager bedre, når den ikke bestemmer.',
    },
    {
      title: 'Mådehold, stilfærdigt',
      message:
        'Du gav fritiden {{planned}} %, og den brugte kun {{actual}} %. Den margin er frihed, du beholdt.',
    },
    {
      title: 'Fritid under plan',
      message:
        'Med {{actual}} % af forbruget holdt fritiden sig under de {{planned}} %, du satte. Godt holdt.',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: '{{percent}} % under plan',
      message:
        'Du brugte {{savedAmount}} mindre, end du tillod dig selv denne måned. Ikke at have brug for alt, du kunne have, er en form for rigdom.',
    },
    {
      title: '{{savedAmount}} efterladt ubrugt',
      message:
        'Måneden landede {{percent}} % under plan. Det, du ikke brugte, er stadig dit at styre.',
    },
    {
      title: 'Mindre end du tillod',
      message:
        'Forbruget er {{percent}} % under planen — {{savedAmount}} beholdt. Giv den margin et formål, før vanen kræver den.',
    },
    {
      title: 'Planen havde plads til overs',
      message:
        '{{savedAmount}} under dine grænser denne måned. Tilbageholdenhed, der føles let, er den slags, der holder.',
    },
    {
      title: 'Lettere end planlagt',
      message:
        'Du havde brug for {{percent}} % mindre, end du budgetterede. Overvej at sende de {{savedAmount}} mod et mål.',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '„{{goal}}“ er på skemaet',
      message:
        'Du er {{percent}} % af vejen, i det tempo målet kræver. Stabile skridt, taget månedligt, rækker langt.',
    },
    {
      title: 'På sporet mod „{{goal}}“',
      message:
        '{{percent}} % færdigt, og tempoet holder. Bliv ved med at betale målet først; det virker.',
    },
    {
      title: '„{{goal}}“: {{percent}} % og stabilt',
      message: 'Målet får, hvad det har brug for, hver måned. Tålmodigheden gør sit arbejde.',
    },
    {
      title: 'Målet bevæger sig som planlagt',
      message:
        '„{{goal}}“ er {{percent}} % finansieret og til tiden. Det, der gøres lidt hver måned, kan ikke stoppes af én dårlig uge.',
    },
    {
      title: 'Fremgang du kan stole på',
      message:
        '„{{goal}}“ står på {{percent}} %, i tempo. Du bygger det på den eneste måde, der virker — gradvist.',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: 'Færre impulskøb hos {{merchant}}',
      message:
        'Fra {{before}} køb sidste måned til omkring {{after}} denne måned. En løsnet vane er vundet frihed.',
    },
    {
      title: '{{merchant}}: {{before}} → {{after}}',
      message:
        'Du besøger mindre, end du gjorde. Hver sprunget refleks er en lille sejr for valget over vanen.',
    },
    {
      title: 'Den lille vane skrumper',
      message:
        'Køb hos {{merchant}} faldt fra {{before}} til omkring {{after}}. Bliv ved — det bliver lettere.',
    },
    {
      title: 'Valg over refleks',
      message:
        'Hos {{merchant}} gik du fra {{before}} køb til omkring {{after}}. Det er mestring bygget én beslutning ad gangen.',
    },
    {
      title: 'Mindre af de små ting',
      message:
        '{{merchant}} så dig omkring {{after}} gange i stedet for {{before}}. Små sejre lægger sig sammen.',
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: 'Du tilpassede dig en slankere måned',
      message:
        'Indtægten faldt {{incomePercent}} %, og du skar forbruget {{expensePercent}} %. Du mødte et skifte i skæbnen med et skifte i kurs.',
    },
    {
      title: 'Sindsro, da indtægten dykkede',
      message:
        'Indtægten ned {{incomePercent}} %, forbruget ned {{expensePercent}} %. Du tilpassede dig det, der er, ikke det, der var.',
    },
    {
      title: 'Skæbnen skiftede; det gjorde du også',
      message:
        'Et fald i indtægten på {{incomePercent}} % mødte et fald i forbruget på {{expensePercent}} %. Det er sindsligevægt i tal.',
    },
    {
      title: 'Godt styret',
      message:
        'Da indtægten faldt {{incomePercent}} %, fulgte forbruget ({{expensePercent}} % mindre). Vinden var ikke din; sejlet var.',
    },
    {
      title: 'Forbruget fulgte indtægten ned',
      message:
        'Du brugte {{expensePercent}} % mindre, da indtægten faldt {{incomePercent}} %. At tilpasse sig tidligt er den rolige vej igennem.',
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: 'Nødvendigheder er stabile',
      message:
        'I {{months}} måneder har dine nødvendige omkostninger næsten ikke rørt sig. Et stabilt gulv giver dig frihed over det.',
    },
    {
      title: 'Behov holdt i skak',
      message:
        'Forbruget på nødvendigheder holdt sig jævnt i {{months}} måneder. Behov, der ikke vokser, er behov du styrer.',
    },
    {
      title: '{{months}} måneder med stabile nødvendigheder',
      message:
        'Husleje, mad og regninger blev, hvor de var. Stilfærdig stabilitet er også en præstation.',
    },
    {
      title: 'Ingen kryben i nødvendigheder',
      message:
        '{{months}} måneder uden drift i det, livet kræver. Alt andet er lettere at planlægge på den grund.',
    },
    {
      title: 'Et fast gulv',
      message:
        'De nødvendige udgifter har været stabile i {{months}} måneder. Du lader ikke komforter gå for behov.',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: 'Gavmild med det, du tjener',
      message:
        'Over {{months}} måneder gik {{percent}} % af din indtægt — {{givenAmount}} — til at hjælpe andre. Det er penge brugt til deres bedste formål.',
    },
    {
      title: '{{givenAmount}} givet til andre',
      message:
        'Du delte {{percent}} % af din indtægt på {{months}} måneder. Venlighed, der viser sig i tallene, er venlighed praktiseret, ikke blot følt.',
    },
    {
      title: 'Åbne hænder',
      message:
        'Velgørenhed og gaver tog {{percent}} % af din indtægt i den seneste tid. Det du giver bort, er den del af din rigdom, ingen ulykke kan tage.',
    },
    {
      title: 'Gavmildhed er en del af din plan',
      message:
        '{{givenAmount}} til andre over {{months}} måneder. Behold det — det gode du gør for andre, er også gjort for dig selv.',
    },
    {
      title: 'Godt givet',
      message:
        '{{percent}} % af det du tjente, gik til at hjælpe andre. Få vaner siger mere om et menneske.',
    },
  ],
  'stoic.praise_steady': [
    {
      title: 'Intet at rette',
      message: 'Dit forbrug svarer til det, du tilsigtede. Bliv ved som du er.',
    },
    {
      title: 'Hensigt og handling er enige',
      message: 'Denne måned ser ud, som du planlagde den. Den enighed er hele pointen.',
    },
    {
      title: 'En rolig måned',
      message:
        'Ingen overdrivelse, ingen forsømmelse værd at nævne. Godt gået — tag samme opmærksomhed videre.',
    },
    {
      title: 'Alt i orden',
      message: 'Din plan holdt, og intet beder om rettelse. Nyd den ro, du har fortjent.',
    },
    {
      title: 'Stabil hånd',
      message: 'Måneden fulgte din plan. Gode vaner får gode måneder til at se almindelige ud.',
    },
  ],
  'expert.pay_yourself_first': [
    {
      title: 'Betal dig selv først',
      message:
        'George S. Clasons regel: en del af alt du tjener, er din at beholde — mindst en tiendedel. Over {{months}} måneder beholdt du {{savingsPercent}} %. Sæt {{tenthAmount}} til side den dag indtægten kommer, før noget andet.',
    },
    {
      title: 'En tiendedel er din at beholde',
      message:
        'I Den rigeste mand i Babylon er den første kur mod en tynd pung at beholde én mønt af hver tiende. Din opsparingsrate er {{savingsPercent}} %; {{tenthAmount}} om måneden ville starte vanen.',
    },
    {
      title: 'Spar før du bruger, ikke efter',
      message:
        'Clasons råd er enkelt: betal dig selv først. For nylig er {{savingsPercent}} % af indtægten blevet hos dig. Flyt {{tenthAmount}} til side på lønningsdagen og lad forbruget passe sig omkring resten.',
    },
    {
      title: 'Den første mønt er din',
      message:
        'En del af alt du tjener, bør blive hos dig — ikke mindre end en tiendedel, siger Clason. Du beholdt {{savingsPercent}} % over {{months}} måneder. Begynd med {{tenthAmount}} om måneden, automatisk.',
    },
    {
      title: '{{savingsPercent}} % beholdt — reglen beder om 10 %',
      message:
        'Betal dig selv først, som Den rigeste mand i Babylon siger: {{tenthAmount}} om måneden, sat til side før nogen regning. Opsparing, der laves først, afhænger ikke af, hvad der er tilbage.',
    },
  ],
  'expert.rule_50_30_20': [
    {
      title: 'Dit 50/30/20-tjek',
      message:
        'Elizabeth Warren og Amelia Warren Tyagi foreslår 50 % af indtægten efter skat til nødvendigheder, 30 % til ønsker, 20 % til opsparing. Dine: {{needsPercent}} % / {{wantsPercent}} % / {{savingsPercent}} %.',
    },
    {
      title: 'Behov {{needsPercent}} %, ønsker {{wantsPercent}} %, opsparing {{savingsPercent}} %',
      message:
        'All Your Worth balancerer penge som 50/30/20. Sammenlign den post, der ligger længst fra sit mærke, med din plan — der hjælper én ændring mest.',
    },
    {
      title: 'Sådan deler din indtægt sig',
      message:
        'Nødvendigheder tager {{needsPercent}} % af indtægten, ønsker {{wantsPercent}} %, og {{savingsPercent}} % spares op. 50/30/20-balancen fra All Your Worth er et nyttigt spejl, ikke en dom.',
    },
    {
      title: 'Den balancerede pengeformel',
      message:
        'Warren og Tyagis formel: halvdelen til det, du skal betale uanset hvad, 30 % til ønsker, 20 % til fremtiden. Du ligger på {{needsPercent}}/{{wantsPercent}}/{{savingsPercent}}.',
    },
    {
      title: 'Målt mod 50/30/20',
      message:
        'Din fordeling er {{needsPercent}} % nødvendigheder, {{wantsPercent}} % ønsker, {{savingsPercent}} % opsparing. Bogens prøve for en nødvendighed: ville du stadig betale den, hvis du mistede dit job i morgen?',
    },
  ],
  'expert.room_for_error': [
    {
      title: 'Lad der være plads til fejl',
      message:
        'Morgan Housels råd: planlæg for at tingene ikke går efter planen. Din saldo dækker omkring {{cushionDays}} dages forbrug; et almindeligt pejlemærke er tre måneder — {{targetAmount}}.',
    },
    {
      title: 'En pude på {{cushionDays}} dage',
      message:
        'The Psychology of Money kalder det plads til fejl — slæk, der lader dig overleve overraskelser. At bygge mod {{targetAmount}}, tre måneders forbrug, giver planen en chance for at overleve virkeligheden.',
    },
    {
      title: 'Sikkerhedsmargen, derhjemme',
      message:
        'Housel låner Grahams sikkerhedsmargen til privatøkonomien. Med {{cushionDays}} dages forbrug i reserve kan én dårlig måned ødelægge en god plan. Sigt efter {{targetAmount}}.',
    },
    {
      title: 'Plads til det uventede',
      message:
        'Din reserve ville holde omkring {{cushionDays}} dage. Overraskelser er det ene sikre; tre måneders forbrug ({{targetAmount}}) er et bredt anvendt mål.',
    },
    {
      title: 'Byg slæk, før du har brug for det',
      message:
        'Plads til fejl, med Morgan Housels ord, er det, der holder dig i spillet. Du har omkring {{cushionDays}} dage dækket; {{targetAmount}} ville dække tre måneder.',
    },
  ],
  'expert.lifestyle_creep': [
    {
      title: 'Forbruget løber fra indtægten',
      message:
        'Forbruget steg {{expenseGrowth}} % over det sidste kvartal, mens indtægten ændrede sig {{incomeGrowth}} %. Første regel i The Millionaire Next Door: uanset din indtægt, lev under dine evner.',
    },
    {
      title: 'Lever højere, ikke rigere',
      message:
        'Stanley og Danko fandt, at rigdom er, hvad du samler, ikke hvad du bruger. Dit forbrug voksede {{expenseGrowth}} %, indtægten {{incomeGrowth}} % — i forskellen lækker rigdommen.',
    },
    {
      title: 'Livsstilskryb: +{{expenseGrowth}} %',
      message:
        'Udgifterne steg hurtigere end indtægten ({{incomeGrowth}} %). Menneskene i The Millionaire Next Door blev rige ved at lade indtægten stige uden at lade forbruget følge.',
    },
    {
      title: 'Målstængerne flytter sig',
      message:
        'Forbruget er op {{expenseGrowth}} % kvartal for kvartal mod {{incomeGrowth}} % for indtægten. Lev under dine evner, siger Stanley og Danko — hvad evnerne end er.',
    },
    {
      title: 'Rigdom er, hvad du beholder',
      message:
        'En god indtægt, der bruges helt, gør ingen rigere. Over det sidste kvartal voksede dit forbrug {{expenseGrowth}} % og indtægten {{incomeGrowth}} % — værd at se på, før det bliver det nye normale.',
    },
  ],
  'expert.life_energy': [
    {
      title: '{{merchant}} kostede {{hours}} timer af dit liv',
      message:
        'Vicki Robin og Joe Dominguez foreslår at prissætte ting i livsenergi — de arbejdstimer, de koster. {{totalAmount}} hos {{merchant}} denne måned er omkring {{hours}} timer. Var det det værd?',
    },
    {
      title: '{{hours}} timer hos {{merchant}}',
      message:
        'Your Money or Your Life beder dig om at se penge som tid, du byttede for dem. Ved din gennemsnitlige timeindtægt svarer {{totalAmount}} der til cirka {{hours}} arbejdstimer.',
    },
    {
      title: 'Prissæt det i timer',
      message:
        '{{totalAmount}} hos {{merchant}} er omkring {{hours}} timers arbejde. Robin og Dominguez kalder det livsenergi — den eneste valuta, du ikke kan tjene tilbage.',
    },
    {
      title: 'Hvad {{merchant}} virkelig kostede',
      message:
        'Penge er noget, vi bytter vores livsenergi for. Denne måned tog {{merchant}} omkring {{hours}} timer af din ({{totalAmount}}). Svarer nydelsen til timerne?',
    },
    {
      title: 'Tjek af livsenergi',
      message:
        'Omregnet til din gennemsnitlige timeindtægt er {{totalAmount}} brugt hos {{merchant}} omkring {{hours}} timer. Your Money or Your Life foreslår at spørge, om det gav en tilsvarende tilfredshed.',
    },
  ],
};
