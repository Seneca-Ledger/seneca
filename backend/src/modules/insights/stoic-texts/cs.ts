import type { StoicTextMap } from './types';

export const cs: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: 'Měsíc přerostl svůj plán',
      message:
        'Plánovali jste {{plannedAmount}} a utratili {{spentAmount}} — o {{percent}} % více. Plán vznikl s chladnou hlavou; nechte ho mluvit silněji než okamžik.',
    },
    {
      title: 'O {{percent}} % nad tím, co jste chtěli utratit',
      message:
        'Výdaje stojí na {{spentAmount}} proti plánu {{plannedAmount}}. Podívejte se, který limit povolil první — tam je ta lekce.',
    },
    {
      title: 'Váš plán a váš měsíc se neshodnou',
      message:
        '{{spentAmount}} utraceno, {{plannedAmount}} zamýšleno. Buď plán žádal od skutečnosti příliš málo, nebo skutečnost od vás příliš mnoho — rozhodněte v klidu, co z toho.',
    },
    {
      title: 'Vyšlo víc, než jste dovolili',
      message:
        'Měsíc je o {{percent}} % nad {{plannedAmount}}, které jste si stanovili. Zastavit se teď nic neztratí; předstírat, že se to nestalo, ztratí mnoho.',
    },
    {
      title: 'Limit, který jste si dali, limit, který jste překročili',
      message:
        'Chtěli jste utratit {{plannedAmount}}; je to {{spentAmount}}. Sebeovládání není nikdy neuklouznout — je to všimnout si včas a vrátit se na cestu.',
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: 'Volný čas bere víc, než jste plánovali',
      message:
        'Chtěli jste, aby volný čas byl {{planned}} % výdajů; tento měsíc je {{actual}} %. Potěšení je vítané jako host, ne jako pán domu.',
    },
    {
      title: 'Volný čas na {{actual}} %, plán {{planned}} %',
      message:
        'Odpočinek si své místo zaslouží, když vás obnoví. Zvažte, které z letošních potěšení to udělaly, a ostatní pusťte bez výčitek.',
    },
    {
      title: 'Pohodlí utrácí víc než záměr',
      message:
        'Volný čas drží {{actual}} % výdajů proti {{planned}} %, které jste zvolili. Umírněnost není odmítání potěšení — je to držet je v rozměru, který jste určili.',
    },
    {
      title: 'Příjemné vytlačuje plánované',
      message:
        'Dali jste volnému času {{planned}} % plánu a on si vzal {{actual}} %. To, co si dopřáváte snadno, stojí za druhý pohled, než se z toho stane to, co potřebujete.',
    },
    {
      title: 'Volný čas překročil svou čáru',
      message:
        '{{actual}} % měsíce šlo na volný čas, {{planned}} % byl záměr. Čára byla vaše nakreslit a je vaše ji držet.',
    },
  ],
  'stoic.leisure_habit': [
    {
      title: 'Volný čas opět nad plánem',
      message:
        'Volný čas překročil váš plán v {{months}} z posledních {{window}} měsíců. Opakování už není náhoda — je to zvyk, který je vhodné prozkoumat.',
    },
    {
      title: '{{months}} z {{window}} měsíců nad plánem volného času',
      message:
        'Co se stane jednou, jsou okolnosti; co se stane {{months}}krát, je charakter ve vzniku. Zvolte charakter záměrně.',
    },
    {
      title: 'Stejné uklouznutí, měsíc po měsíci',
      message:
        'Volný čas přerostl plán v {{months}} z {{window}} měsíců. Zvyšte plán poctivě nebo změňte zvyk — žít mezi tím stojí nejvíc.',
    },
    {
      title: 'Vzorec, ne výjimka',
      message:
        'V {{months}} z posledních {{window}} měsíců si volný čas vzal víc, než jste mu dali. Všímejte si okamžiku, kdy se rozhoduje, nikoli jen účtu potom.',
    },
    {
      title: 'Zvyk hlasuje proti vašemu plánu',
      message:
        'Volný čas překonal plán {{months}}krát za {{window}} měsíců. Zvyky se staví po jedné volbě; stejně se i rozkládají.',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: 'Ctnost dostává méně, než jste zamýšleli',
      message:
        'Vyhradili jste {{planned}} % rozpočtu na zdraví, učení a druhé; dosud je to {{actual}} %. Záměr se počítá, jakmile je vykonán.',
    },
    {
      title: 'Ctnost na {{actual}} % z plánovaných {{planned}} %',
      message:
        'Peníze, které jste chtěli dát tomu, co vás zlepšuje, stále čekají. Lepší čas je dobře utratit než tento měsíc není.',
    },
    {
      title: 'Dobro, které jste naplánovali, je neutraceno',
      message:
        'Zdraví, učení a velkorysost měly dostat {{planned}} % výdajů; dostaly {{actual}} %. Udělejte jedno z nich tento týden, záměrně.',
    },
    {
      title: 'Záměr bez činu',
      message:
        'Ctnost drží {{actual}} % výdajů proti {{planned}} %, které jste zvolili. Co si ceníme, se pozná na tom, za co skutečně platíme.',
    },
    {
      title: 'Zbylo místo na to, co má cenu',
      message:
        'Na ctnost šlo jen {{actual}} %, i když jste plánovali {{planned}} %. Kniha, prohlídka u lékaře, dar někomu v nouzi — plán už řekl ano.',
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: 'Ctnost se stále odkládá',
      message:
        'Výdaje na zdraví, učení a druhé zůstávají pod vaším plánem už {{months}} měsíců v řadě. Co stále odkládáte, jste ve skutečnosti odmítli.',
    },
    {
      title: '{{months}} měsíců odložené ctnosti',
      message:
        'Každý měsíc plán udělal místo tomu, co vás zlepšuje, a každý měsíc zůstalo nevyužito. Čas je to jediné, co nelze rozpočtovat dvakrát.',
    },
    {
      title: 'Lepší já stále čeká',
      message:
        'Ctnost je pod plánem {{months}} měsíců za sebou. Začněte malým a jistým, nikoli velkým a později.',
    },
    {
      title: 'Dobré úmysly stárnou',
      message:
        '{{months}} měsíců dostávaly zdraví, učení a velkorysost méně, než jste plánovali. Vyberte jedno a příští měsíc je zaplaťte první, dřív než cokoli jiného.',
    },
    {
      title: 'Ctnost pořád prohrává s „později“',
      message:
        '{{months}} měsíců v řadě pod plánem. Později je místo, kam dobré úmysly chodí být zapomenuty — dejte tomuhle datum.',
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: 'Váš plán nemá místo pro ctnost',
      message:
        'Žádný z vašich rozpočtů neslouží zdraví, učení ani druhým. Plán ukazuje, co si ceníme — zvažte dát ctnosti vlastní řádek.',
    },
    {
      title: 'Všechny rozpočty, ale žádný pro dobro',
      message:
        'Nutnost, práce i volný čas mají limity; ctnost žádný. Co se nikdy neplánuje, se obvykle nikdy nestane.',
    },
    {
      title: 'Plánujte to, co vás zlepšuje',
      message:
        'Ve třídě ctnosti dosud žádný rozpočet není. I malý — knihy, sport, dar — změní přání na závazek.',
    },
    {
      title: 'Plán o ctnosti mlčí',
      message:
        'Rozpočtujete to, co musíte, a to, co si dopřáváte, ještě ne toho, kým chcete být. Jeden skromný rozpočet na ctnost by to změnil.',
    },
    {
      title: 'Ctnost nemá rozpočet',
      message:
        'Výdaje na zdraví, učení nebo druhé nejsou naplánovány nikde. Vyberte jeden a dejte mu limit, jehož dosažení by vás potěšilo.',
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: 'Nutnosti stojí víc, než bylo plánováno',
      message:
        'Plánovali jste {{planned}} % výdajů na nutnosti; berou {{actual}} %. Zkontrolujte, zda je každá z nich stále potřeba, nebo se tiše stala pohodlím.',
    },
    {
      title: 'Nutnost na {{actual}} %, plán {{planned}} %',
      message:
        'To, co život vyžaduje, je obvykle méně než to, čemu jsme si zvykli. Projděte největší nutnost svěžím okem.',
    },
    {
      title: 'To nezbytné se nadouvá',
      message:
        'Nutnosti drží {{actual}} % měsíce proti {{planned}} %, které jste očekávali. Potřeba, která stále roste, si zaslouží otázku.',
    },
    {
      title: 'Potřeby přerůstají plán',
      message:
        'Plánováno {{planned}} %, skutečnost {{actual}} %. Buď plán podcenil reálné náklady, nebo některá přání cestují pod jménem potřeb.',
    },
    {
      title: 'Na „musím“ šlo víc, než bylo zamýšleno',
      message:
        'Nutnosti si vzaly {{actual}} % výdajů místo {{planned}} %. Oddělte to, co skutečně musí být, od toho, co jen vždycky bylo.',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: 'Nutnosti se plíží vzhůru',
      message:
        'Výdaje na nutnosti rostou {{months}} měsíců v řadě, celkem {{percent}} %. Potřeby rostou tiše, když je nikdo nenutí se obhájit.',
    },
    {
      title: '+{{percent}} % na nutnostech za {{months}} měsíců',
      message:
        'Každý krok vypadal malý; dohromady malé nejsou. Vezměte největší opakující se nutnost a zvažte, zda musí ještě stát tolik.',
    },
    {
      title: 'Podlaha vašich výdajů se zvedá',
      message:
        'Nutnosti rostly {{months}} měsíců za sebou (+{{percent}} %). Stoupající podlaha nechává méně místa na vše, co volíte svobodně.',
    },
    {
      title: 'Potřeby se rozpínají',
      message:
        '{{months}} měsíců růstu, celkem {{percent}} %. Stoická zkouška je jednoduchá: zvolili byste to dnes znovu, když znáte cenu?',
    },
    {
      title: 'Malé přírůstky, stálý směr',
      message:
        'Nutnosti jsou za {{months}} měsíců výše o {{percent}} %. Směr znamená víc než jediný měsíc — tento stojí za včasnou korekci.',
    },
  ],
  'stoic.work_over_plan': [
    {
      title: 'Práce stojí víc, než bylo plánováno',
      message:
        'Plánovali jste {{planned}} % výdajů na práci; bere {{actual}} %. Nástroje a služby si musí na sebe vydělat — zkontrolujte, které to dělají.',
    },
    {
      title: 'Výdaje na práci {{actual}} %, plán {{planned}} %',
      message:
        'Investice do práce je dobrá, když něco vrací. Projděte, za co platíte, ale co už nepoužíváte.',
    },
    {
      title: 'Rozpočet na práci je napnutý',
      message:
        'Práce si vzala {{actual}} % místo {{planned}} %. Pracovitost je dělat práci dobře, ne kupovat na ni každý nástroj.',
    },
    {
      title: 'Nástroje utrácejí nad plán',
      message:
        'Plánováno {{planned}} %, utraceno {{actual}} % na práci. Zvažte u každého výdaje: pomáhá mi práci dělat, nebo jen připomíná pokrok?',
    },
    {
      title: 'Náklady práce se posunuly',
      message:
        'Práce drží {{actual}} % výdajů proti zamýšleným {{planned}} %. Rychlá revize nyní ušetří větší později.',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '„{{category}}“ opakovaně prolamuje svůj limit',
      message:
        '„{{category}}“ přesáhla rozpočet v {{months}} z posledních {{window}} měsíců. Buď je špatný limit, nebo chuť — rozhodněte, co z toho.',
    },
    {
      title: '„{{category}}“: nad rozpočtem {{months}} z {{window}} měsíců',
      message:
        'Limit, který se vždy překročí, není limit, jen přání. Udělejte ho poctivým — zvyšte ho záměrně nebo ho záměrně držte.',
    },
    {
      title: 'Stejný rozpočet opět povolil',
      message:
        '„{{category}}“ přesáhla svůj limit {{months}}krát za {{window}} měsíců. Opakování je informace; využijte ji.',
    },
    {
      title: '„{{category}}“ si říká o vaši pozornost',
      message:
        'Nad rozpočtem v {{months}} z {{window}} měsíců. Pozorujte okamžik před nákupem — jen tam lze zvyk změnit.',
    },
    {
      title: 'Vzorec v „{{category}}“',
      message:
        '{{months}} překročení za {{window}} měsíců. Čím se stáváme, to opakujeme; rozhodněte, co má tato kategorie o vás říkat.',
    },
  ],
  'stoic.budget_pace': [
    {
      title: '„{{category}}“ vyčerpá limit kolem dne {{day}}',
      message:
        'Utratili jste {{spentAmount}} z {{limitAmount}} a tímto tempem limit skončí kolem dne {{day}}. Zpomalit teď je snazší než zastavit později.',
    },
    {
      title: '„{{category}}“ je před měsícem',
      message:
        '{{spentAmount}} je už pryč z limitu {{limitAmount}}. Tímto tempem bude vyčerpán kolem dne {{day}} — zbytek měsíce je ale stále váš.',
    },
    {
      title: 'Kontrola tempa: „{{category}}“',
      message:
        'Rozpočet {{limitAmount}} vydrží při současném tempu asi do dne {{day}}. Předvídavost je nejlevnější druh disciplíny.',
    },
    {
      title: '„{{category}}“ utrácí budoucnost',
      message:
        '{{spentAmount}} z {{limitAmount}} utraceno; limit končí poblíž dne {{day}}. To, co uděláte tento týden, rozhodne, zda se to stane.',
    },
    {
      title: 'Včasné varování pro „{{category}}“',
      message:
        'Při současném tempu limit {{limitAmount}} nedosáhne konce měsíce — vyčerpá se kolem dne {{day}}. Upravte to, dokud je to levné.',
    },
  ],
  'stoic.budget_unused': [
    {
      title: '„{{category}}“ zůstala nevyužitá',
      message:
        'Rozpočet „{{category}}“ nezaznamenal žádné výdaje už {{months}} měsíců. Buď jste z něj vyrostli, nebo je to záměr, který ještě čeká — rozhodněte, co z toho.',
    },
    {
      title: 'Prázdný rozpočet: „{{category}}“',
      message:
        '{{months}} měsíců bez jediného výdaje. Plán má popisovat život, který žijete, nebo ten, který stavíte — který z nich je tento?',
    },
    {
      title: '„{{category}}“ stojí nečinně',
      message:
        'Tady se {{months}} měsíců nic neutratilo. Byla-li to zdrženlivost, výborně; byla-li to nedbalost, udělejte s tím něco.',
    },
    {
      title: 'Naplánováno, ale neprožito',
      message:
        '„{{category}}“ má limit a žádné výdaje už {{months}} měsíců. Udržte plán pravdivý: zrušte ho, nebo ho využijte.',
    },
    {
      title: '„{{category}}“: {{months}} tichých měsíců',
      message:
        'Rozpočet, kterého se nikdo nedotkne, stále zabírá místo ve vašem plánu. Uvolněte to místo, nebo ten záměr naplňte.',
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: '{{percent}} % výdajů nemá limit',
      message:
        '{{unbudgetedAmount}} šlo tento měsíc do kategorií, které nehlídá žádný rozpočet. Co se neměří, se těžko zvládá.',
    },
    {
      title: 'Velká část měsíce je nenaplánovaná',
      message:
        '{{percent}} % výdajů — {{unbudgetedAmount}} — leží mimo všechny rozpočty. Dejte největší části limit a plán uvidí víc z vašeho života.',
    },
    {
      title: 'Výdaje mimo plán',
      message:
        'Rozpočty pokrývají jen část toho, co utrácíte; {{unbudgetedAmount}} ({{percent}} %) zůstává neměřeno. Rozšiřte plán tam, kam peníze skutečně jdou.',
    },
    {
      title: 'Plán vidí jen část obrazu',
      message:
        '{{percent}} % výdajů tohoto měsíce nemá rozpočet. Jasný pohled přichází před dobrým úsudkem.',
    },
    {
      title: '{{unbudgetedAmount}} utraceno bez limitu',
      message:
        'To je {{percent}} % měsíce. Nemusíte to omezovat — jen se rozhodnout, kolik z toho skutečně chcete.',
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '„{{category}}“ je většina vašeho volného času',
      message:
        '{{percent}} % výdajů na volný čas šlo na „{{category}}“. Rozmanitost v odpočinku je zdravější než závislost na jednom potěšení.',
    },
    {
      title: 'Jedno potěšení vládne',
      message:
        '„{{category}}“ bere {{percent}} % všeho, co jste dali na volný čas. Zvažte, zda vás ještě těší, nebo se z toho stala rutina.',
    },
    {
      title: 'Volný čas se opírá o „{{category}}“',
      message:
        '{{percent}} % volného času na jednom místě. To, bez čeho se neobejdeme, nás drží — zkontrolujte, že je ten úchop stále lehký.',
    },
    {
      title: '„{{category}}“: {{percent}} % volného času',
      message:
        'Jediný zdroj radosti bere téměř vše. Zkuste tento měsíc jedno levnější, jiné potěšení a porovnejte.',
    },
    {
      title: 'Váš odpočinek má jednu adresu',
      message:
        'Většina peněz na volný čas — {{percent}} % — jde na „{{category}}“. Ke svobodě patří i umět mít radost z něčeho jiného.',
    },
  ],
  'stoic.unclassified': [
    {
      title: 'Část výdajů ještě nebyla posouzena',
      message:
        '{{count}} kategorií nemá třídu. Rozhodněte v Rozpočtech, co je nutnost, práce, ctnost nebo volný čas.',
    },
    {
      title: '{{count}} kategorií čeká na váš úsudek',
      message:
        'Mají výdaje, ale žádnou třídu, takže je doporučení nemohou vážit. Minuta v Rozpočtech to vyřeší.',
    },
    {
      title: 'Pojmenujte to, čemu vaše peníze slouží',
      message:
        '{{count}} kategorií je stále bez zařazení. Úsudek začíná tím, že věci nazýváme pravými jmény.',
    },
    {
      title: 'Neposouzené výdaje: {{count}} kategorií',
      message:
        'Je to potřeba, vaše práce, ctnost, nebo potěšení? Říct to můžete jen vy — a plán se tím vyjasní.',
    },
    {
      title: 'Několik kategorií nemá třídu',
      message:
        '{{count}} kategorií stojí mimo čtyři třídy. Zařaďte je v Rozpočtech, aby byl každý výdaj viděn tím, čím je.',
    },
  ],
  'stoic.small_purchases': [
    {
      title: '{{count}} malých nákupů u {{merchant}}',
      message:
        'Každý vypadal nicotně; dohromady vyšly tento měsíc na {{totalAmount}}. Malé, nezkoumané zvyky jsou místo, kudy tiše odchází většina peněz.',
    },
    {
      title: '{{merchant}}: {{count}}krát tento měsíc',
      message:
        '{{totalAmount}} v malých částkách. Zvažte, zda byla každá návštěva volbou, nebo reflexem — svobodou je jen to první.',
    },
    {
      title: 'Po troškách: {{totalAmount}}',
      message:
        '{{count}} nákupů u {{merchant}}. Žádný jediný nerozhoduje; rozhoduje zvyk. Rozhodněte, jak často to vlastně chcete.',
    },
    {
      title: 'Zvyk u {{merchant}}',
      message:
        '{{count}} nákupů, {{totalAmount}} celkem. Zkuste tento měsíc každý třetí vynechat a uvidíte, zda vám bude chybět.',
    },
    {
      title: 'Drobnosti se sčítají',
      message:
        '{{merchant}} vás viděl {{count}}krát, za {{totalAmount}}. Vláda nad velkými rozhodnutími se staví na takových malých.',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: 'Víkendy nesou {{percent}} % volného času',
      message:
        'Většina vašich výdajů na volný čas padá na sobotu a nedělí. Odpočinek je dobrý; zkontrolujte, že je to odpočinek a ne náhrada za týden.',
    },
    {
      title: 'Volný čas žije o víkendu',
      message:
        '{{percent}} % výdajů na volný čas padá na víkend. Naplánujte víkend trochu a bude stát méně a dávat více.',
    },
    {
      title: 'Víkend platí za týden',
      message:
        'Víkendy berou {{percent}} % toho, co dáváte na volný čas. Pokud se týden musí spravovat každou sobotu, podívejte se na ten týden.',
    },
    {
      title: 'Sobota a nedělě: {{percent}} % volného času',
      message:
        'Volné dny zvou k volným výdajům. Rozhodněte před víkendem, k čemu je, a nechte peníze následovat.',
    },
    {
      title: 'Víkendový vzorec',
      message:
        '{{percent}} % výdajů na volný čas se děje o víkendu. Lehčí pracovní dny často dělají víkendy levnějšími.',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}} si vzal {{percent}} % měsíce',
      message:
        '{{totalAmount}} šlo jednomu obchodníkovi na volný čas. Když má jedno místo tolik vašich peněz, zvažte, kolik má i vaší pozornosti.',
    },
    {
      title: 'Jedno místo, {{totalAmount}}',
      message:
        '{{merchant}} je {{percent}} % výdajů tohoto měsíce. Stojí za takový podíl vaší životní práce?',
    },
    {
      title: '{{merchant}} vede vaše výdaje',
      message:
        '{{percent}} % měsíce — {{totalAmount}} — šlo tam. Není nic špatného si to dopřát, pokud byste to zvolili znovu.',
    },
    {
      title: 'Velký podíl u {{merchant}}',
      message:
        '{{totalAmount}}, tedy {{percent}} % výdajů, na jediném místě volného času. Zvažte potěšení proti ceně, v klidu.',
    },
    {
      title: '{{percent}} % u {{merchant}}',
      message:
        'Tento jediný obchodník si vzal {{totalAmount}}. Svoboda je umět projít kolem, když se tak rozhodnete.',
    },
  ],
  'stoic.income_drop': [
    {
      title: 'Příjem klesl, výdaje ne',
      message:
        'Příjem spadl o {{percent}} % na {{incomeAmount}}, ale výdaje zůstaly na {{expenseAmount}}. Štěstěna změnila názor; vaše výdaje si toho ještě nevšimly.',
    },
    {
      title: 'Příjem dolů o {{percent}} %',
      message:
        '{{incomeAmount}} přišlo dovnitř proti {{expenseAmount}} naven. Co náhoda dá, může vzít zpět — přizpůsobte výdaje tomu, co je, ne tomu, co bylo.',
    },
    {
      title: 'Hubenější měsíc, stejné zvyky',
      message:
        'Příjem je o {{percent}} % nižší ({{incomeAmount}}), zatímco výdaje zůstaly na {{expenseAmount}}. Příjem ve vaší moci není; odpověď ano.',
    },
    {
      title: 'Štěstěna se pohnula',
      message:
        'Vydělali jste o {{percent}} % méně než obvykle, ale utratili {{expenseAmount}} jako dřív. Omezte teď, dokud je to volba a ne nutnost.',
    },
    {
      title: 'Výdaje nenásledovaly příjem',
      message:
        'Příjem klesl na {{incomeAmount}} (o {{percent}} % dolů); výdaje jsou {{expenseAmount}}. Nastavte plachtu podle větru, který skutečně máte.',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: 'Předplatné: {{monthlyAmount}} měsíčně',
      message:
        '{{count}} předplatných bere {{percent}} % vašich měsíčních výdajů. Každé se obnoví, aniž by se vás zeptalo — zeptejte se na každé sami.',
    },
    {
      title: '{{percent}} % výdajů se obnovuje samo',
      message:
        '{{count}} předplatných, {{monthlyAmount}} měsíčně. Nechte si ta, která byste si dnes zřídili znovu.',
    },
    {
      title: 'Tiché, opakované, {{monthlyAmount}}',
      message:
        '{{count}} předplatných stojí {{percent}} % vašeho měsíce. Pohodlí je dobrý sluha a drahý pán.',
    },
    {
      title: '{{count}} předplatných k revizi',
      message:
        'Dohromady je to {{monthlyAmount}} měsíčně, {{percent}} % výdajů. Zrušte jedno, které téměř nepoužíváte, a všimněte si, jak málo vám bude chybět.',
    },
    {
      title: 'Co se obnovuje samo',
      message:
        '{{monthlyAmount}} měsíčně napříč {{count}} předplatnými. Automatické výdaje si zaslouží záměrnou revizi.',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: 'Váš úspěch by mohl sahat o trochu dál',
      message:
        'Za {{months}} měsíců jste si nechali {{savingsPercent}} % příjmu, ale druhým z toho šlo téměř nic. Bohatství sedí nejlépe v otevřených rukou — co takhle jeden dar tento měsíc?',
    },
    {
      title: 'Vydělává dobře, dává málo',
      message:
        '{{incomeAmount}} přišlo za {{months}} měsíců a {{givenAmount}} šlo druhým. Pomáháte-li způsoby, které tato aplikace nevidí, nevšímejte si toho; pokud ne, plán na to má místo.',
    },
    {
      title: 'Dobrý rok být velkorysý',
      message:
        'Uspořili jste {{savingsPercent}} % příjmu — znamení pevné ruky. Malá část z toho, dána někomu, kdo to potřebuje, by té pevnosti dala větší smysl.',
    },
    {
      title: 'V obrázku zatím nikdo další',
      message:
        'Posledních {{months}} měsíců ukazuje pečlivé vydělávání a spoření, ale žádnou dobročinnost ani dary. Jsme stvořeni jeden pro druhého; skromný dar stačí na začátek.',
    },
    {
      title: 'Místo pro laskavost',
      message:
        'Na pomoc druhým šlo jen {{givenAmount}} z {{incomeAmount}}. Zvažte malý, pravidelný dar — velkorysost se zvykem usnadňuje, jako každá ctnost.',
    },
  ],
  'stoic.goal_behind': [
    {
      title: '„{{goal}}“ zaostává',
      message:
        'Potřebuje {{requiredAmount}} měsíčně a vy dáváte asi {{paceAmount}}. Tímto tempem dorazí o {{monthsLate}} měsíců později.',
    },
    {
      title: '„{{goal}}“: o {{monthsLate}} měsíců později při tomto tempu',
      message:
        'Požadováno {{requiredAmount}} měsíčně, skutečnost asi {{paceAmount}}. Posuňte datum poctivě nebo posuňte více peněz záměrně.',
    },
    {
      title: 'Cíl a tempo se neshodnou',
      message:
        '„{{goal}}“ žádá {{requiredAmount}} měsíčně; dostává {{paceAmount}}. Cíl je tak skutečný jako měsíční krok k němu.',
    },
    {
      title: '„{{goal}}“ potřebuje pevnější krok',
      message:
        '{{paceAmount}} měsíčně proti {{requiredAmount}}, které potřebuje. Příští měsíc zaplaťte cíl první, dřív než cokoli nepovinného.',
    },
    {
      title: 'Zaostáváte u „{{goal}}“',
      message:
        'Současné tempo ({{paceAmount}}/měsíc) ho nechává o {{monthsLate}} měsíců pozadu. Malé přidání teď předčí velké oběti později.',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: '„{{goal}}“ se do plánu nevejde',
      message:
        'Potřebuje {{requiredAmount}} měsíčně, ale po vašich rozpočtech je volné jen {{freeAmount}}. Změňte datum, cíl nebo rozpočty — doufání není plán.',
    },
    {
      title: '„{{goal}}“ žádá víc, než máte volného',
      message:
        '{{requiredAmount}} požadováno každý měsíc, {{freeAmount}} k dispozici. Chtít vše naráz je způsob, jak se nic neudělá; vyberte.',
    },
    {
      title: 'Čísla říkají ne — prozatím',
      message:
        '„{{goal}}“ potřebuje {{requiredAmount}} měsíčně; volné prostředky máte {{freeAmount}}. Upravte to, co je ve vaší moci: termín nebo ostatní limity.',
    },
    {
      title: '„{{goal}}“ potřebuje rozhodnutí',
      message:
        'Při {{requiredAmount}} měsíčně překračuje {{freeAmount}}, které zbývají po rozpočtech. Cíl zvolený s otevřenými očima je lepší než ten držený zbožným přáním.',
    },
    {
      title: 'Nemožné tempo pro „{{goal}}“',
      message:
        'Požadováno {{requiredAmount}} měsíčně, volné {{freeAmount}}. Poctivá aritmetika nyní ušetří zklamání později.',
    },
  ],
  'stoic.shortfall': [
    {
      title: 'Váš zůstatek klesne pod nulu {{date}}',
      message:
        'Nastávající platby {{committedAmount}} stáhnou odhadovaný zůstatek na {{lowestAmount}}. Připravte se nyní, dokud je to jen předpověď.',
    },
    {
      title: 'Blíží se manko: {{date}}',
      message:
        'Závazné platby ({{committedAmount}}) předběhnou zůstatek a dno je {{lowestAmount}}. Předvídat obtíž je způsob, jak nad ní ztrácí moc.',
    },
    {
      title: 'Počítejte s {{date}}',
      message:
        'Ten den dosáhne odhadovaný zůstatek {{lowestAmount}}. Přesuňte platbu, zadržte přání nebo odložte hotovost — každé z toho je dnes ve vaší moci.',
    },
    {
      title: 'Závazky přesahují zůstatek',
      message:
        '{{committedAmount}} je splatné a zůstatek klesá na {{lowestAmount}} kolem {{date}}. Klidná odpověď je ta včasná.',
    },
    {
      title: 'Předvídejte mezeru {{date}}',
      message:
        'Odhadovaný nejnižší zůstatek: {{lowestAmount}}. Co je předvídáno, lze přijmout s rovnováhou; co nás zaskočí, zřídka.',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: 'Dodrželi jste slovo, které jste dali sobě',
      message:
        '{{months}} měsíců v řadě zůstaly vaše výdaje v plánu, který jste si dali. Takhle vypadá sebeovládání.',
    },
    {
      title: '{{months}} měsíců v plánu',
      message:
        'Měsíc po měsíci se to, co jste zamýšleli, a to, co jste udělali, shodují. Důslednost je tišší než vůle a vydrží déle.',
    },
    {
      title: 'Plán a život se shodují',
      message:
        '{{months}} měsíců za sebou ve vašich limitech. Plán držený tak dobře už není omezení — je to způsob, jak žijete.',
    },
    {
      title: 'Stabilně {{months}} měsíců',
      message: 'Vaše rozpočty drží {{months}} měsíců v řadě. Udržte stejnou pozornost; funguje to.',
    },
    {
      title: 'Disciplína, udržená',
      message:
        '{{months}} měsíců bez porušení vašeho plánu. Málo věcí osvobozuje tak jako důvěra ve vlastní rozhodnutí.',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: 'Vaše peníze jdou za vašimi hodnotami',
      message:
        'Ctnost si vzala {{actual}} % vašich výdajů — ne méně než {{planned}} %, které jste plánovali. Dobře utraceno.',
    },
    {
      title: 'Ctnost dostala svůj plný díl',
      message:
        '{{actual}} % na zdraví, učení a druhé, proti plánovaným {{planned}} %. Za to, čeho si ceníte, jste zaplatili.',
    },
    {
      title: 'Utraceno na to, abyste byli lepší',
      message:
        'Ctnost dosáhla tento měsíc {{actual}} % výdajů (plán {{planned}} %). Ty peníze pro vás pracují ještě dlouho po tom, co jsou pryč.',
    },
    {
      title: 'Záměr vykonán',
      message:
        'Plánovali jste {{planned}} % na ctnost a utratili {{actual}} %. Dobré úmysly zřídka přežijí měsíc — vaše ano.',
    },
    {
      title: 'Nejlepší užití peněz',
      message: '{{actual}} % šlo na to, co dělá vás i druhé lepšími. Volte to dál.',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: 'Volný čas na svém místě',
      message:
        'Volný čas je {{actual}} % výdajů, pod {{planned}} %, které jste mu dovolili. Dopřáváte si, aniž by vás to ovládalo.',
    },
    {
      title: 'Potěšení držené v rozměru',
      message:
        'Volný čas si vzal {{actual}} % proti plánovaným {{planned}} %. Umírněnost není o něco přijít — je to volit.',
    },
    {
      title: 'Odpočinek bez nadbytku',
      message:
        '{{actual}} % na volný čas, pod vaším limitem {{planned}} %. Radost chutná lépe, když nevládne.',
    },
    {
      title: 'Umírněnost, potichu',
      message:
        'Dali jste volnému času {{planned}} % a on využil jen {{actual}} %. Ta rezerva je svoboda, kterou jste si udrželi.',
    },
    {
      title: 'Volný čas pod plánem',
      message:
        'S {{actual}} % výdajů zůstal volný čas pod {{planned}} %, které jste si dali. Dobře udrženo.',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: 'O {{percent}} % pod plánem',
      message:
        'Utratili jste {{savedAmount}} méně, než jste si tento měsíc dovolili. Nepotřebovat vše, co byste mohli mít, je druh bohatství.',
    },
    {
      title: '{{savedAmount}} zůstalo neutraceno',
      message:
        'Měsíc skončil o {{percent}} % pod plánem. To, co jste neutratili, je stále vaše, abyste s tím naložili.',
    },
    {
      title: 'Méně, než jste dovolili',
      message:
        'Výdaje jsou o {{percent}} % pod plánem — {{savedAmount}} zůstalo. Dejte té rezervě účel, než si ji zvyk vezme.',
    },
    {
      title: 'Plán měl rezervu',
      message:
        '{{savedAmount}} pod vašimi limity tento měsíc. Zdrženlivost, která jde snadno, je ta, která vydrží.',
    },
    {
      title: 'Lehčí, než bylo plánováno',
      message:
        'Potřebovali jste o {{percent}} % méně, než jste rozpočtovali. Zvažte poslat {{savedAmount}} na cíl.',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '„{{goal}}“ je v plánu',
      message:
        'Jste {{percent}} % cesty, tempem, které cíl potřebuje. Pevné kroky, dělané každý měsíc, dosáhnou daleko.',
    },
    {
      title: 'Na dobré cestě k „{{goal}}“',
      message: '{{percent}} % hotovo a tempo drží. Plaťte cíl dál jako první; funguje to.',
    },
    {
      title: '„{{goal}}“: {{percent}} % a stabilně',
      message: 'Cíl dostává každý měsíc to, co potřebuje. Trpělivost koná své.',
    },
    {
      title: 'Cíl se hýbe podle plánu',
      message:
        '„{{goal}}“ je {{percent}} % financován a v čase. Co se dělá po troškách každý měsíc, nezastaví jeden špatný týden.',
    },
    {
      title: 'Pokrok, kterému lze věřit',
      message:
        '„{{goal}}“ stojí na {{percent}} %, v tempu. Stavíte ho jediným způsobem, který funguje — postupně.',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: 'Méně impulzivních nákupů u {{merchant}}',
      message:
        'Z {{before}} nákupů minulý měsíc na asi {{after}} tento měsíc. Povolený zvyk je získaná svoboda.',
    },
    {
      title: '{{merchant}}: {{before}} → {{after}}',
      message:
        'Chodíte tam méně než dřív. Každý přeskočený reflex je malé vítězství volby nad zvykem.',
    },
    {
      title: 'Malý zvyk se zmenšuje',
      message:
        'Nákupy u {{merchant}} klesly z {{before}} na asi {{after}}. Pokračujte — bude to snazší.',
    },
    {
      title: 'Volba místo reflexu',
      message:
        'U {{merchant}} jste šli z {{before}} nákupů na asi {{after}}. To je vláda budovaná po jednom rozhodnutí.',
    },
    {
      title: 'Méně drobností',
      message:
        '{{merchant}} vás viděl asi {{after}}krát místo {{before}}. Malá vítězství se skládají.',
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: 'Přizpůsobili jste se hubenějšímu měsíci',
      message:
        'Příjem klesl o {{incomePercent}} % a vy jste snížili výdaje o {{expensePercent}} %. Na změnu štěstěny jste odpověděli změnou kurzu.',
    },
    {
      title: 'Vyrovnanost, když příjem poklesl',
      message:
        'Příjem dolů o {{incomePercent}} %, výdaje dolů o {{expensePercent}} %. Přizpůsobili jste se tomu, co je, ne tomu, co bylo.',
    },
    {
      title: 'Štěstěna se změnila; vy také',
      message:
        'Pokles příjmu o {{incomePercent}} % se potkal s poklesem výdajů o {{expensePercent}} %. To je rovnováha v číslech.',
    },
    {
      title: 'Dobře kormidlováno',
      message:
        'Když příjem klesl o {{incomePercent}} %, výdaje následovaly (o {{expensePercent}} % méně). Vítr nebyl váš; plachta ano.',
    },
    {
      title: 'Výdaje šly dolů s příjmem',
      message:
        'Utratili jste o {{expensePercent}} % méně, když příjem klesl o {{incomePercent}} %. Přizpůsobit se včas je klidná cesta skrz.',
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: 'Nutnosti jsou stabilní',
      message:
        '{{months}} měsíců se vaše nezbytné náklady téměř nehýbou. Stabilní podlaha dává svobodu nad sebou.',
    },
    {
      title: 'Potřeby pod kontrolou',
      message:
        'Výdaje na nutnosti se drží na stejné úrovni {{months}} měsíců. Potřeby, které nerostou, jsou potřeby, které ovládáte.',
    },
    {
      title: '{{months}} měsíců stabilních nezbytností',
      message: 'Nájem, jídlo a účty zůstaly tam, kde byly. Tichá stabilita je také výsledek.',
    },
    {
      title: 'Žádné plíživé nutnosti',
      message:
        '{{months}} měsíců bez posunu v tom, co život vyžaduje. Vše ostatní se na tom základě plánuje snáz.',
    },
    {
      title: 'Pevná podlaha',
      message:
        'Nezbytné výdaje jsou stabilní {{months}} měsíců. Nenecháváte pohodlí vydávat se za potřeby.',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: 'Velkorysý s tím, co vyděláte',
      message:
        'Za {{months}} měsíců šlo {{percent}} % vašeho příjmu — {{givenAmount}} — na pomoc druhým. To jsou peníze v nejlepším užití.',
    },
    {
      title: '{{givenAmount}} darováno druhým',
      message:
        'Za {{months}} měsíců jste rozdělili {{percent}} % svého příjmu. Laskavost, která se objeví v číslech, je laskavost praktikovaná, nikoli jen pociťovaná.',
    },
    {
      title: 'Otevřené ruce',
      message:
        'Dobročinnost a dary vzaly v poslední době {{percent}} % vašeho příjmu. To, co dáte, je ta část bohatství, kterou žádné nešťastí nevezme.',
    },
    {
      title: 'Velkorysost je součástí vašeho plánu',
      message:
        '{{givenAmount}} druhým za {{months}} měsíců. Držte to — dobro, které činíte druhým, činíte i sobě.',
    },
    {
      title: 'Dobře darováno',
      message:
        '{{percent}} % toho, co jste vydělali, šlo na pomoc druhým. Málo zvyků řekne o člověku více.',
    },
  ],
  'stoic.praise_steady': [
    {
      title: 'Není co opravovat',
      message: 'Vaše výdaje odpovídají tomu, co jste zamýšleli. Pokračujte, jak jste.',
    },
    {
      title: 'Záměr a čin se shodují',
      message: 'Tento měsíc vypadá tak, jak jste ho naplánovali. Právě ta shoda je celý smysl.',
    },
    {
      title: 'Klidný měsíc',
      message:
        'Žádný přepych, žádná nedbalost, která by stála za zmínku. Výborně — nesete tu samou pozornost dál.',
    },
    {
      title: 'Vše v pořádku',
      message:
        'Váš plán vydržel a nic si neříká o opravu. Vychutnejte si klid, který jste si zasloužili.',
    },
    {
      title: 'Pevná ruka',
      message: 'Měsíc šel podle vašeho plánu. Dobré zvyky dělají z dobrých měsíců obyčejné.',
    },
  ],
  'expert.pay_yourself_first': [
    {
      title: 'Zaplaťte nejdřív sobě',
      message:
        'Pravidlo George S. Clasona: část všeho, co vyděláte, je vaše, abyste si ji nechali — nejméně desetina. Za {{months}} měsíců jste si nechali {{savingsPercent}} %. Odložte {{tenthAmount}} v den, kdy příjem přijde, dřív než cokoli jiného.',
    },
    {
      title: 'Desetina je vaše, abyste si ji nechali',
      message:
        'V Nejbohatším muži v Babylonu je první lék na hubenou peněženku nechat si jednu minci z každých deseti. Vaše míra spoření je {{savingsPercent}} %; {{tenthAmount}} měsíčně by ten zvyk založilo.',
    },
    {
      title: 'Spořte dřív, než utratíte, ne potom',
      message:
        'Clasonova rada je jednoduchá: zaplaťte nejdřív sobě. V poslední době u vás zůstává {{savingsPercent}} % příjmu. Odložte {{tenthAmount}} v den výplaty a nechte výdaje přizpůsobit se zbytku.',
    },
    {
      title: 'První mince je vaše',
      message:
        'Část všeho, co vyděláte, má zůstat u vás — ne méně než desetina, říká Clason. Za {{months}} měsíců jste si nechali {{savingsPercent}} %. Začněte s {{tenthAmount}} měsíčně, automaticky.',
    },
    {
      title: '{{savingsPercent}} % ponecháno — pravidlo žádá 10 %',
      message:
        'Zaplaťte nejdřív sobě, jak to říká Nejbohatší muž v Babylonu: {{tenthAmount}} měsíčně, odložené dřív než jakýkoli účet. Spoření udělané první nezávisí na tom, co zbyde.',
    },
  ],
  'expert.rule_50_30_20': [
    {
      title: 'Vaše kontrola 50/30/20',
      message:
        'Elizabeth Warren a Amelia Warren Tyagi navrhují 50 % příjmu po zdanění na nezbytnosti, 30 % na přání, 20 % na spoření. Vaše: {{needsPercent}} % / {{wantsPercent}} % / {{savingsPercent}} %.',
    },
    {
      title: 'Potřeby {{needsPercent}} %, přání {{wantsPercent}} %, spoření {{savingsPercent}} %',
      message:
        'All Your Worth vyvažuje peníze jako 50/30/20. Porovnejte s plánem tu položku, která je od své značky nejdál — tam jedna změna pomůže nejvíc.',
    },
    {
      title: 'Jak se dělí váš příjem',
      message:
        'Nezbytnosti berou {{needsPercent}} % příjmu, přání {{wantsPercent}} % a {{savingsPercent}} % se spoří. Rovnováha 50/30/20 z All Your Worth je užitečné zrcadlo, ne rozsudek.',
    },
    {
      title: 'Vyvážená peněžní formule',
      message:
        'Formule Warren a Tyagi: polovina na to, co musíte zaplatit, ať se děje co se děje, 30 % na přání, 20 % na budoucnost. Vy jste na {{needsPercent}}/{{wantsPercent}}/{{savingsPercent}}.',
    },
    {
      title: 'Proti 50/30/20',
      message:
        'Vaše dělení je {{needsPercent}} % nezbytnosti, {{wantsPercent}} % přání, {{savingsPercent}} % spoření. Test knihy pro nezbytnost: platili byste to i tehdy, kdybyste zítra přišli o práci?',
    },
  ],
  'expert.room_for_error': [
    {
      title: 'Nechte si prostor na chybu',
      message:
        'Rada Morgana Housela: plánujte na to, že věci podle plánu nejdou. Váš zůstatek pokryje asi {{cushionDays}} dní výdajů; obvyklé vodítko jsou tři měsíce — {{targetAmount}}.',
    },
    {
      title: 'Polštář na {{cushionDays}} dní',
      message:
        'The Psychology of Money tomu říká prostor na chybu — vůle, která vám dovolí přežít překvapení. Budovat směrem k {{targetAmount}}, tedy třem měsícům výdajů, dává plánu šanci přežít realitu.',
    },
    {
      title: 'Bezpečnostní polštář, doma',
      message:
        'Housel si půjčuje Grahamovu margin of safety pro osobní finance. S {{cushionDays}} dny výdajů v zálohe může jeden špatný měsíc zbořit dobrý plán. Miřte na {{targetAmount}}.',
    },
    {
      title: 'Prostor pro nečekané',
      message:
        'Vaše záloha by vydržela asi {{cushionDays}} dní. Překvapení jsou tou jednou jistotou; tři měsíce výdajů ({{targetAmount}}) jsou široce používaný cíl.',
    },
    {
      title: 'Vytvořte si vůli, než ji budete potřebovat',
      message:
        'Prostor na chybu, slovy Morgana Housela, je to, co vás drží ve hře. Máte pokryto asi {{cushionDays}} dní; {{targetAmount}} by pokrylo tři měsíce.',
    },
  ],
  'expert.lifestyle_creep': [
    {
      title: 'Výdaje předbíhají příjem',
      message:
        'Výdaje za poslední čtvrtletí vzrostly o {{expenseGrowth}} %, zatímco příjem se změnil o {{incomeGrowth}} %. První pravidlo The Millionaire Next Door: ať je váš příjem jakýkoli, žijte pod své možnosti.',
    },
    {
      title: 'Žije se vyšší, ne bohatší',
      message:
        'Stanley a Danko zjistili, že bohatství je to, co nahromadíte, ne to, co utratíte. Vaše výdaje vzrostly o {{expenseGrowth}} %, příjem o {{incomeGrowth}} % — v té mezeře bohatství uniká.',
    },
    {
      title: 'Lifestyle creep: +{{expenseGrowth}} %',
      message:
        'Výdaje stoupaly rychleji než příjem ({{incomeGrowth}} %). Lidé z The Millionaire Next Door zůstali bohatí tím, že nechali příjem růst, aniž by nechali růst výdaje.',
    },
    {
      title: 'Branky se posouvají',
      message:
        'Výdaje jsou mezi čtvrtletími výše o {{expenseGrowth}} % proti {{incomeGrowth}} % u příjmu. Žijte pod své možnosti, říkají Stanley a Danko — ať jsou možnosti jakékoli.',
    },
    {
      title: 'Bohatství je to, co si necháte',
      message:
        'Dobrý příjem utracený celý nikoho bohatším neudělá. Za poslední čtvrtletí vzrostly vaše výdaje o {{expenseGrowth}} % a příjem o {{incomeGrowth}} % — stojí za pohled, než se z toho stane nový standard.',
    },
  ],
  'expert.life_energy': [
    {
      title: '{{merchant}} stál {{hours}} hodin vašeho života',
      message:
        'Vicki Robin a Joe Dominguez navrhují oceňovat věci v životní energii — v hodinách práce, které stojí. {{totalAmount}} u {{merchant}} tento měsíc je asi {{hours}} hodin. Stálo to za to?',
    },
    {
      title: '{{hours}} hodin u {{merchant}}',
      message:
        'Your Money or Your Life vás zve vidět peníze jako čas, který jste za ně vyměnili. Při vašem průměrném hodinovém příjmu se {{totalAmount}} tam rovná asi {{hours}} pracovním hodinám.',
    },
    {
      title: 'Oceňte to v hodinách',
      message:
        '{{totalAmount}} u {{merchant}} je asi {{hours}} hodin práce. Robin a Dominguez tomu říkají životní energie — jediná valuta, kterou nelze vydělat zpět.',
    },
    {
      title: 'Co {{merchant}} skutečně stál',
      message:
        'Peníze jsou něco, za co měníme svou životní energii. Tento měsíc si {{merchant}} vzal asi {{hours}} hodin té vaší ({{totalAmount}}). Odpovídá to potěšení těm hodinám?',
    },
    {
      title: 'Kontrola životní energie',
      message:
        'Přepočteno vaším průměrným hodinovým příjmem je {{totalAmount}} utracených u {{merchant}} asi {{hours}} hodin. Your Money or Your Life navrhuje se zeptat, zda to přineslo odpovídající naplnění.',
    },
  ],
};
