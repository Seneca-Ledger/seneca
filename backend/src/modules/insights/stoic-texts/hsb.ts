import type { StoicTextMap } from './types';

export const hsb: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: 'Měsac je swój plan přerostł',
      message:
        'Planowali sće {{plannedAmount}} a wudali {{spentAmount}} — {{percent}} % wjace. Plan nasta ze zymnej hłowu; dajće jemu rěčeć hłośnišo hač wokomik.',
    },
    {
      title: '{{percent}} % nad tym, což sće wudać chcyli',
      message:
        'Wudawki steja na {{spentAmount}} přećiwo planej {{plannedAmount}}. Hladajće, kotry limit prěni popušći — tam je nawuk.',
    },
    {
      title: 'Waš plan a waš měsac so njezjednawaja',
      message:
        '{{spentAmount}} wudate, {{plannedAmount}} planowane. Pak plan přemało wot woprawdźitosće žadaše, pak woprawdźitosć přewjele wot was — rozsudźće měrnje, što.',
    },
    {
      title: 'Wušło je wjace, hač sće dowolił',
      message:
        'Měsac je {{percent}} % nad {{plannedAmount}}, kotrež sće postajił. Jeli nětko zastanjeće, ničo zhubjene njeje; jeli so činiće, zo so to njesta, zhubi so wjele.',
    },
    {
      title: 'Hranica, kotruž sće stajił, a hranica, kotruž sće překročił',
      message:
        'Chcyli sće {{plannedAmount}} wudać; je {{spentAmount}}. Samowobknježenje njeje ženje so njezmylić — je to zahe spóznać a so na puć wróćić.',
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: 'Wotpočink bjerje wjace, hač sće planował',
      message:
        'Chcyli sće, zo wotpočink {{planned}} % wudawkow by był; tutón měsac je {{actual}} %. Wjesełosć je witana jako hósć, nic jako knjez domu.',
    },
    {
      title: 'Wotpočink při {{actual}} %, planowane {{planned}} %',
      message:
        'Wotpočink zasłuži swoje městno, hdyž was wobnowja. Prašejće so, kotre wjesełosće tutoho měsaca to činichu, a druhe pušćće bjez žadanja.',
    },
    {
      title: 'Komfort wudawa wjace hač zaměr',
      message:
        'Wotpočink dźerži {{actual}} % wudawkow přećiwo {{planned}} %, kotrež sće wuzwolił. Měrnosć njeje wotpokazanje wjesełosće — je to dźeržeć ju w měrje, kotru sće postajił.',
    },
    {
      title: 'Přijomne wutłóči planowane',
      message:
        'Wotpočinkej sće {{planned}} % plana dał, a wón wza {{actual}} %. To, což bjez prócy wužiwaće, je druheho pohlada hódne, prjedy hač so stanje tym, což trjebaće.',
    },
    {
      title: 'Wotpočink je swoju liniju překročił',
      message:
        '{{actual}} % měsaca du na wotpočink, {{planned}} % bě zaměr. Linija bě waša, zo byšće ju zarysował, a waša je, zo byšće ju dźeržał.',
    },
  ],
  'stoic.leisure_habit': [
    {
      title: 'Wotpočink zaso nad planom',
      message:
        'Wotpočink překroči waš plan w {{months}} ze poslednich {{window}} měsacow. Wospjetowanje hižo njeje njezbožo — je nawyk, kotryž so hodźi přepruwować.',
    },
    {
      title: '{{months}} z {{window}} měsacow nad planom wotpočinka',
      message:
        'To, což so raz stawa, su wobstejnosće; to, což so {{months}} razow stawa, je charakter w nastawanju. Wuzwolće charakter z wolu.',
    },
    {
      title: 'Samsne zmylkowanje, měsac po měsacu',
      message:
        'Wotpočink překroči plan w {{months}} z {{window}} měsacow. Zwyšće plan čestnje abo změńće nawyk — mjez tym žiwy być najdróžšo je.',
    },
    {
      title: 'Muster, nic wuwzaće',
      message:
        'W {{months}} ze poslednich {{window}} měsacow wza wotpočink wjace, hač sće jemu dał. Wobkedźbujće wokomik, hdyž so rozsud přijima, nic jenož ličbu pozdźišo.',
    },
    {
      title: 'Nawyk hłosuje přećiwo wašemu planej',
      message:
        'Wotpočink zdoby plan {{months}} razow w {{window}} měsacach. Nawyki so po jednym wuzwolenju twarja; tak so tež rozbuchaja.',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: 'Čestnosć dóstawa mjenje, hač sće zaměrił',
      message:
        'Wotstajili sće {{planned}} % budgeta za strowotu, wuknjenje a druhich; dotal je {{actual}} %. Zaměr liči, hdyž je wuwjedźeny.',
    },
    {
      title: 'Čestnosć při {{actual}} % z planowanych {{planned}} %',
      message:
        'Pjenjezy, kotrež sće za to postajił, což was lěpšeho čini, hišće čakaja. Lěpšeho časa, zo byšće je derje wudał, hač tutón měsac njeje.',
    },
    {
      title: 'Dobre, kotrež sće planował, je njewudate',
      message:
        'Strowota, wuknjenje a dawkomócnosć měli {{planned}} % wudawkow dóstać; dóstachu {{actual}} %. Čińće jedne z nich tutón tydźeń, z wolu.',
    },
    {
      title: 'Zaměr bjez čina',
      message:
        'Čestnosć dźerži {{actual}} % wudawkow přećiwo {{planned}} %, kotrež sće wuzwolił. To, což sej cenimy, so w tym pokazuje, za čož woprawdźe płaćimy.',
    },
    {
      title: 'Městno za wažne je wostało',
      message:
        'Na čestnosć du jenož {{actual}} %, hačrunjež sće {{planned}} % planował. Kniha, přepruwowanje při lěkarju, dar někomu w nuzy — plan je hižo haj prajił.',
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: 'Čestnosć so dale wotkładuje',
      message:
        'Wudawki za strowotu, wuknjenje a druhich wostawaja pod wašim planom hižo {{months}} měsacow po rjedźe. To, což stajnje wotkładujeće, sće woprawdźe wotpokazał.',
    },
    {
      title: '{{months}} měsacow wotkładźeneje čestnosće',
      message:
        'Kóždy měsac plan městno za to wostaji, což was lěpšeho čini, a kóždy měsac wosta njewužite. Čas je jenički, kotryž so njehodźi dwójce planować.',
    },
    {
      title: 'Lěpše ja hišće čaka',
      message:
        'Čestnosć je pod planom {{months}} měsacow po rjedźe. Započńće mało a wěsće, nic wulko a pozdźišo.',
    },
    {
      title: 'Dobre zaměry staršeja',
      message:
        '{{months}} měsacow dóstachu strowota, wuknjenje a dawkomócnosć mjenje, hač sće planował. Wuzwolće jedne a zapłaćće jemu přichodny měsac jako prěnjemu, před wšěm druhim.',
    },
    {
      title: 'Čestnosć stajnje přećiwo „pozdźišo“ zhubja',
      message:
        '{{months}} měsacow po rjedźe pod planom. Pozdźišo je městno, hdźež dobre zaměry du, zo bychu so zabyli — tutomu dajće datum.',
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: 'Waš plan nima městna za čestnosć',
      message:
        'Žadyn z wašich budgetow strowoće, wuknjenju abo druhim njesłuži. Plan pokazuje, što sej cenimy — rozmyslujće, zo byšće čestnosći swójsku linku dał.',
    },
    {
      title: 'Wšě budgety, ale žadyn za dobre',
      message:
        'Potrjeba, dźěło a wotpočink maja hranicy; čestnosć žanu. To, což so ženje njeplanuje, so zwjetša ženje njestawa.',
    },
    {
      title: 'Planujće to, což was lěpšeho čini',
      message:
        'W klasy čestnosće hišće žadyn budget njeje. Tež mały — knihi, sport, dar — přemjeni přeće na zawjazanosć.',
    },
    {
      title: 'Plan wo čestnosći mjelči',
      message:
        'Planujeće za to, což dyrbiće, a za to, což wužiwaće, hišće nic za toho, kiž chceće być. Jedyn skromny budget za čestnosć by to změnił.',
    },
    {
      title: 'Čestnosć nima budget',
      message:
        'Wudawanje za strowotu, wuknjenje abo druhich njeje nikajkež planowane. Wuzwolće jedne a dajće jemu limit, kotryž byšće rady docpěł.',
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: 'Potrjeby płaća wjace, hač bě planowane',
      message:
        'Planowali sće {{planned}} % wudawkow za potrjeby; bjeru {{actual}} %. Přepruwujće, hač kóžda je hišće potrjeba abo je so po ćichim komfort stała.',
    },
    {
      title: 'Potrjeba při {{actual}} %, planowane {{planned}} %',
      message:
        'To, což žiwjenje žada, je zwjetša mjenje hač to, na což so zwučimy. Přehladajće najwjetšu potrjebu ze swěžim wokom.',
    },
    {
      title: 'Trěbne so nadymuje',
      message:
        'Potrjeby dźerža {{actual}} % měsaca přećiwo {{planned}} %, kotrež sće wočakował. Potrjeba, kotraž dale rosće, prašenje zasłuži.',
    },
    {
      title: 'Potrjeby plan přerostu',
      message:
        'Planowane {{planned}} %, woprawdźite {{actual}} %. Pak plan woprawdźite kóšty podhódnoći, pak někotre přeća pod mjenom potrjebow pućuja.',
    },
    {
      title: 'Na „dyrbju“ du wjace, hač bě mysleno',
      message:
        'Potrjeby wzachu {{actual}} % wudawkow město {{planned}} %. Dźělće to, což woprawdźe być dyrbi, wot toho, což jenož stajnje bě.',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: 'Potrjeby so horje łazyja',
      message:
        'Wudawki za potrjeby rostu {{months}} měsacow po rjedźe, dohromady {{percent}} %. Potrjeby rostu po ćichim, hdyž nichtó je njenuzuje so wobswědčić.',
    },
    {
      title: '+{{percent}} % při potrjebach w {{months}} měsacach',
      message:
        'Kóždy krok wupadaše mały; dohromady njejsu. Wzmiće najwjetšu wospjetowanu potrjebu a prašejće so, hač dyrbi hišće telko płaćić.',
    },
    {
      title: 'Dno wašich wudawkow so zběha',
      message:
        'Potrjeby rostu {{months}} měsacow po rjedźe (+{{percent}} %). Zběhace so dno mjenje městna za wšo wostaji, což swobodnje wuzwoliće.',
    },
    {
      title: 'Potrjeby so rozšěrjeja',
      message:
        '{{months}} měsacow rosta, dohromady {{percent}} %. Stoiska proba je prosta: byšće to dźensa zaso wuzwolił, znajo płaćiznu?',
    },
    {
      title: 'Małe přirosty, stajny směr',
      message:
        'Potrjeby su w {{months}} měsacach wyše wo {{percent}} %. Směr wjace woznamjenja hač jednotliwy měsac — tutón so hodźi zahe korigować.',
    },
  ],
  'stoic.work_over_plan': [
    {
      title: 'Dźěło płaći wjace, hač bě planowane',
      message:
        'Planowali sće {{planned}} % wudawkow za dźěło; bjerje {{actual}} %. Nastroje a posłužby dyrbja swoje městno zasłužić — přepruwujće, kotre je zasłužuja.',
    },
    {
      title: 'Wudawki za dźěło při {{actual}} %, planowane {{planned}} %',
      message:
        'Inwesticija do dźěła je dobra, hdyž něšto wróći. Přehladajće, za čož płaćiće, ale hižo njewužiwaće.',
    },
    {
      title: 'Budget za dźěło je napjaty',
      message:
        'Dźěło wza {{actual}} % město {{planned}} %. Dźěławosć je dźěło derje činić, nic kóždy nastroj za nje kupować.',
    },
    {
      title: 'Nastroje wudawaja nad planom',
      message:
        'Planowane {{planned}} %, wudate {{actual}} % za dźěło. Při kóždym wudawku so prašejće: pomha mi dźěło činić, abo so jenož kaž postup začuwa?',
    },
    {
      title: 'Kóšty dźěła su so přesunyli',
      message:
        'Dźěło dźerži {{actual}} % wudawkow přećiwo zaměrjenym {{planned}} %. Spěšne přepruwowanje nětko wjetše pozdźišo zalutuje.',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '„{{category}}“ stajnje swoju hranicu łama',
      message:
        '„{{category}}“ překroči budget w {{months}} ze poslednich {{window}} měsacow. Pak je hranica wopak, pak přeće — rozsudźće, što.',
    },
    {
      title: '„{{category}}“: nad budgetom {{months}} z {{window}} měsacow',
      message:
        'Hranica, kotraž so stajnje překročuje, hranica njeje, jenož přeće. Čińće ju čestnu — zwyšće ju z wolu abo dźeržće ju z wolu.',
    },
    {
      title: 'Samsny budget zaso popušći',
      message:
        '„{{category}}“ překroči swoju hranicu {{months}} razow w {{window}} měsacach. Wospjetowanje je informacija; wužiwajće ju.',
    },
    {
      title: '„{{category}}“ waše kedźbnosć prosy',
      message:
        'Nad budgetom w {{months}} z {{window}} měsacow. Hladajće na wokomik před kupnjenjom — to je jenička městnosć, hdźež so nawyk změnić hodźi.',
    },
    {
      title: 'Muster w „{{category}}“',
      message:
        '{{months}} překročenjow w {{window}} měsacach. To, což wospjetujemy, so stanjemy; rozsudźće, što chceće, zo tuta kategorija wo was praji.',
    },
  ],
  'stoic.budget_pace': [
    {
      title: '„{{category}}“ so wokoło dnja {{day}} wučerpa',
      message:
        'Wudali sće {{spentAmount}} z {{limitAmount}}, a w tutym tempje so hranica wokoło dnja {{day}} kónči. Nětko spomałšić je lóše hač pozdźišo zastać.',
    },
    {
      title: '„{{category}}“ je před měsacom',
      message:
        '{{spentAmount}} je hižo wotešło z hranicy {{limitAmount}}. W tutym tempje budźe wokoło dnja {{day}} wučerpana — zbytk měsaca je weto waš.',
    },
    {
      title: 'Přepruwowanje tempa: „{{category}}“',
      message:
        'Budget {{limitAmount}} při nětčišim tempje traje hač k dnju {{day}}. Předwidźiwosć je najpřihódniša forma discipliny.',
    },
    {
      title: '„{{category}}“ přichod wudawa',
      message:
        '{{spentAmount}} z {{limitAmount}} wudate; hranica so blisko dnja {{day}} kónči. Što tutón tydźeń činiće, rozsudźuje, hač so to stanje.',
    },
    {
      title: 'Zahe warnowanje za „{{category}}“',
      message:
        'Při nětčišim tempje hranica {{limitAmount}} kónc měsaca njedocpěje — wučerpa so wokoło dnja {{day}}. Korigujće, dokulž je přihódne.',
    },
  ],
  'stoic.budget_unused': [
    {
      title: '„{{category}}“ wosta njewužity',
      message:
        'Budget za „{{category}}“ njeje wudawki widźał hižo {{months}} měsacow. Pak sće z njeho wurostł, pak je zaměr, kotryž hišće čaka — rozsudźće, što.',
    },
    {
      title: 'Prózdny budget: „{{category}}“',
      message:
        '{{months}} měsacow bjez jednoho wudawka. Plan měł žiwjenje wopisać, kotrež žiwjeće, abo tamne, kotrež twariće — kotre je to?',
    },
    {
      title: '„{{category}}“ steji njewužity',
      message:
        'Tu njeje ničo wudate {{months}} měsacow. Jeli bě to zdźerženosć, derje; jeli njedbawosć, čińće něšto.',
    },
    {
      title: 'Planowane, ale nic přežite',
      message:
        '„{{category}}“ ma hranicu a žane wudawki hižo {{months}} měsacow. Dźeržće plan prawdźiwy: wotstrońće ju abo wužiwajće ju.',
    },
    {
      title: '„{{category}}“: {{months}} ćichich měsacow',
      message:
        'Budget, kotrehož so nichtó njedótkuje, hišće městno we wašim planje wobsadźa. Spušćće městno abo zaměr dopjelńće.',
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: '{{percent}} % wudawkow nima hranicu',
      message:
        '{{unbudgetedAmount}} du tutón měsac do kategorijow, kotrež žadyn budget njewobkedźbuje. To, což so njemjeri, so ćežko wobknježi.',
    },
    {
      title: 'Wulki dźěl měsaca je njeplanowany',
      message:
        '{{percent}} % wudawkow — {{unbudgetedAmount}} — leži zwonka wšěch budgetow. Dajće najwjetšemu dźělu hranicu a plan budźe wjace wašeho žiwjenja widźeć.',
    },
    {
      title: 'Wudawanje zwonka plana',
      message:
        'Budgety pokrywaja jenož dźěl toho, což wudawaće; {{unbudgetedAmount}} ({{percent}} %) wostanje njezměrjene. Rozšěrće plan tam, hdźež pjenjezy woprawdźe du.',
    },
    {
      title: 'Plan widźi jenož dźěl wobraza',
      message:
        '{{percent}} % wudawkow tutoho měsaca nima budget. Jasne widźenje přińdźe před dobrym pohódnoćenjom.',
    },
    {
      title: '{{unbudgetedAmount}} wudate bjez hranicy',
      message:
        'To je {{percent}} % měsaca. Njetrjebaće to wobmjezować — jenož rozsudźić, kelko z toho woprawdźe chceće.',
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '„{{category}}“ je najwjetši dźěl wašeho wotpočinka',
      message:
        '{{percent}} % wudawkow za wotpočink du na „{{category}}“. Rozmanitosć w wotpočinku je strowša hač wotwisnosć wot jedneje wjesełosće.',
    },
    {
      title: 'Jedna wjesełosć knježi',
      message:
        '„{{category}}“ bjerje {{percent}} % wšeho, což sće za wotpočink wudał. Prašejće so, hač was hišće wjeseli abo je so rutina stała.',
    },
    {
      title: 'Wotpočink so na „{{category}}“ podpěra',
      message:
        '{{percent}} % wotpočinka na jednym městnje. To, bjez čehož njemóžemy, nas dźerži — přepruwujće, hač je dźerženje hišće lochke.',
    },
    {
      title: '„{{category}}“: {{percent}} % wotpočinka',
      message:
        'Jenički žórło wjesela bjerje nimale wšo. Spytajće tutón měsac jednu přihódnišu, druhu wjesełosć a přirunujće.',
    },
    {
      title: 'Waš wotpočink ma jednu adresu',
      message:
        'Najwjetši dźěl pjenjez za wotpočink — {{percent}} % — du na „{{category}}“. Swoboda wobsahuje tež móžnosć so něčeho druheho wjeselić.',
    },
  ],
  'stoic.unclassified': [
    {
      title: 'Dźěl wudawkow hišće pohódnoćeny njeje',
      message:
        '{{count}} kategorijow nima klasu. W Budgetach rozsudźće, što je potrjeba, dźěło, čestnosć abo wotpočink.',
    },
    {
      title: '{{count}} kategorijow na waše pohódnoćenje čaka',
      message:
        'Maja wudawki, ale žanu klasu, tohodla porady je zwažić njemóžeja. Minuta w Budgetach to rozrisa.',
    },
    {
      title: 'Pomjenujće to, čemuž waše pjenjezy słuža',
      message:
        '{{count}} kategorijow je hišće nkategorizowanych. Pohódnoćenje so z tym započina, zo wěcy z prawymi mjenami pomjenujemy.',
    },
    {
      title: 'Njepohódnoćene wudawki: {{count}} kategorijow',
      message:
        'Je to potrjeba, waše dźěło, čestnosć abo wjesełosć? Prajić móžeće jenož wy — a plan so z tym wujasni.',
    },
    {
      title: 'Někotre kategorije nimaja klasu',
      message:
        '{{count}} kategorijow steji zwonka štyrjoch klasow. Kategorizujće je w Budgetach, zo by so kóždy wudawk widźał tak, kajkiž je.',
    },
  ],
  'stoic.small_purchases': [
    {
      title: '{{count}} małych kupnjenjow při {{merchant}}',
      message:
        'Kóžde wupadaše njewažne; dohromady činjachu tutón měsac {{totalAmount}}. Małe, njepřepruwowane nawyki su městno, hdźež najwjetši dźěl pjenjez po ćichim wotchadźa.',
    },
    {
      title: '{{merchant}}: {{count}} razow tutón měsac',
      message:
        '{{totalAmount}} w małych sumach. Prašejće so, hač kóžda wopyt bě wuzwolenje abo refleks — swoboda je jenož prěnje.',
    },
    {
      title: 'Po mału: {{totalAmount}}',
      message:
        '{{count}} kupnjenjow při {{merchant}}. Žane jednotliwe njeje wažne; nawyk je. Rozsudźće, kak husto to woprawdźe chceće.',
    },
    {
      title: 'Nawyk při {{merchant}}',
      message:
        '{{count}} kupnjenjow, dohromady {{totalAmount}}. Spytajće tutón měsac kóžde třeće přeskočić a hladajće, hač wam pobrachuje.',
    },
    {
      title: 'Małe wěcy so sumuja',
      message:
        '{{merchant}} widźeše was {{count}} razow, za {{totalAmount}}. Knjejstwo nad wulkimi rozsudami so na tajkich małych twari.',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: 'Kónc tydźenja njese {{percent}} % wotpočinka',
      message:
        'Najwjetši dźěl wašich wudawkow za wotpočink padnje na sobotu a njedźelu. Wotpočink je dobry; přepruwujće, hač je wotpočink a nic narunanje za tydźeń.',
    },
    {
      title: 'Wotpočink na kóncu tydźenja žiwy je',
      message:
        '{{percent}} % wudawkow za wotpočink padnje na kónc tydźenja. Planujće kónc tydźenja mało a budźe mjenje płaćić a wjace dawać.',
    },
    {
      title: 'Kónc tydźenja za tydźeń płaći',
      message:
        'Kónc tydźenja bjerje {{percent}} % toho, což za wotpočink wudawaće. Jeli dyrbi so tydźeń kóždu sobotu reparować, hladajće na tydźeń.',
    },
    {
      title: 'Sobota a njedźela: {{percent}} % wotpočinka',
      message:
        'Swobodne dny k swobodnemu wudawanju přeprošuja. Rozsudźće před kóncom tydźenja, za čož je, a dajće pjenjezam slědować.',
    },
    {
      title: 'Muster kónca tydźenja',
      message:
        '{{percent}} % wudawkow za wotpočink so na kóncu tydźenja stawa. Lóše dźěłowe dny činja kónc tydźenja husto přihódniši.',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}} wza {{percent}} % měsaca',
      message:
        '{{totalAmount}} du jednomu předawarjej za wotpočink. Hdyž jedne městno telko wašich pjenjez ma, prašejće so, kelko wašeje kedźbnosće tež ma.',
    },
    {
      title: 'Jedne městno, {{totalAmount}}',
      message:
        '{{merchant}} je {{percent}} % wudawkow tutoho měsaca. Je tón dźěl dźěła wašeho žiwjenja hódny?',
    },
    {
      title: '{{merchant}} waše wudawki wjedźe',
      message:
        '{{percent}} % měsaca — {{totalAmount}} — du tam. Ničo wopak njeje so tomu wjeselić, dołhož byšće to zaso wuzwolił.',
    },
    {
      title: 'Wulki dźěl při {{merchant}}',
      message:
        '{{totalAmount}}, to je {{percent}} % wudawkow, na jednym městnje wotpočinka. Zwažće měrnje wjesełosć přećiwo płaćiznje.',
    },
    {
      title: '{{percent}} % při {{merchant}}',
      message:
        'Tutón jedyn předawar wza {{totalAmount}}. Swoboda je móc nimo hić, hdyž so tak rozsudźiće.',
    },
  ],
  'stoic.income_drop': [
    {
      title: 'Dochod spadny, wudawki nic',
      message:
        'Dochod spadny {{percent}} % na {{incomeAmount}}, ale wudawki wostachu při {{expenseAmount}}. Zbožo je sej rozmysliło; waše wudawki to hišće njespóznachu.',
    },
    {
      title: 'Dochod dele wo {{percent}} %',
      message:
        '{{incomeAmount}} přińdźe nutř přećiwo {{expenseAmount}} won. Što zbožo da, móže tež wzać — přiměrće wudawki tomu, což je, nic tomu, což bě.',
    },
    {
      title: 'Słabši měsac, samsne nawyki',
      message:
        'Dochod je {{percent}} % nišši ({{incomeAmount}}), a wudawki wostachu při {{expenseAmount}}. Dochod njeje we wašej mocy; wotmołwa je.',
    },
    {
      title: 'Zbožo so přesuny',
      message:
        'Zasłužili sće {{percent}} % mjenje hač zwjetša, ale wudali {{expenseAmount}} kaž prjedy. Skrótšće nětko, dokulž je to wuzwolenje a nic nuza.',
    },
    {
      title: 'Wudawki dochodej njeslědowachu',
      message:
        'Dochod spadny na {{incomeAmount}} ({{percent}} % dele); wudawki su {{expenseAmount}}. Nastajće płachtu na wětr, kotryž woprawdźe maće.',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: 'Abonementy: {{monthlyAmount}} na měsac',
      message:
        '{{count}} abonementow bjerje {{percent}} % wašich měsačnych wudawkow. Kóždy so wobnowja, bjez toho zo by so was prašał — prašejće so wo kóždy sami.',
    },
    {
      title: '{{percent}} % wudawkow so same wobnowja',
      message:
        '{{count}} abonementow, {{monthlyAmount}} na měsac. Dźeržće te, na kotrež byšće so dźensa zaso přizjewił.',
    },
    {
      title: 'Ćicho, wospjetowano, {{monthlyAmount}}',
      message:
        '{{count}} abonementow płaći {{percent}} % wašeho měsaca. Komfort je dobry słužobnik a droghi knjez.',
    },
    {
      title: '{{count}} abonementow na přepruwowanje',
      message:
        'Dohromady su {{monthlyAmount}} na měsac, {{percent}} % wudawkow. Wupowědźće jedyn, kotryž lědma wužiwaće, a wobkedźbujće, kak mało wam pobrachuje.',
    },
    {
      title: 'To, což so samo wobnowja',
      message:
        '{{monthlyAmount}} na měsac přez {{count}} abonementow. Awtomatiske wudawanje zasłuži wědome přepruwowanje.',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: 'Waš wuspěch móhł mało dale docpěć',
      message:
        'Přez {{months}} měsacow sće {{savingsPercent}} % dochoda zdźeržał, ale druhim z toho nimale ničo njeje šło. Bohatstwo najlěpje w wotewrjenych rukach sedźi — snano jedyn dar abo pomoc tutón měsac?',
    },
    {
      title: 'Derje zasłužuje, mało dawa',
      message:
        '{{incomeAmount}} přińdźe přez {{months}} měsacow a {{givenAmount}} du druhim. Jeli pomhaće na puće, kotrež tuta aplikacija njewidźi, ignorujće to; jeli nic, ma plan za to městno.',
    },
    {
      title: 'Dobre lěto, zo byšće dawkomócny był',
      message:
        'Zalutowali sće {{savingsPercent}} % dochoda — znamjo krutej ruki. Mały dźěl toho, dany někomu w nuzy, by tej krutosći wjace woznama dał.',
    },
    {
      title: 'Na wobrazu hišće nichtó druhi njeje',
      message:
        'Poslednich {{months}} měsacow pokazuje starostne zasłužowanje a lutowanje, ale žanu dobroćinskosć ani dary. Smy jedyn za druheho storjeni; skromny dar dosaha za započatk.',
    },
    {
      title: 'Městno za dobrotu',
      message:
        'Na pomoc druhim du jenož {{givenAmount}} z {{incomeAmount}}. Rozmyslujće wo małej, regularnej pomocy — dawkomócnosć so z nawykom lóša stanje, kaž kóžda čestnosć.',
    },
  ],
  'stoic.goal_behind': [
    {
      title: '„{{goal}}“ zady wostawa',
      message:
        'Trjeba {{requiredAmount}} na měsac, a wy kładźeće něhdźe {{paceAmount}}. W tutym tempje přińdźe {{monthsLate}} měsacow pozdźišo.',
    },
    {
      title: '„{{goal}}“: {{monthsLate}} měsacow pozdźišo w tutym tempje',
      message:
        'Trěbne {{requiredAmount}} na měsac, woprawdźite něhdźe {{paceAmount}}. Přesuńće datum čestnje abo přesuńće wjace pjenjez z wolu.',
    },
    {
      title: 'Cil a tempo so njezjednawaja',
      message:
        '„{{goal}}“ prosy {{requiredAmount}} na měsac; dóstawa {{paceAmount}}. Cil je jenož telko woprawdźity kaž měsačny krok k njemu.',
    },
    {
      title: '„{{goal}}“ trjeba krutiši krok',
      message:
        '{{paceAmount}} na měsac přećiwo {{requiredAmount}}, kotrež trjeba. Přichodny měsac zapłaćće cilej jako prěnjemu, před wšěm opcionalnym.',
    },
    {
      title: 'Zastawanje při „{{goal}}“',
      message:
        'Nětčiše tempo ({{paceAmount}}/měsac) je {{monthsLate}} měsacow pozdźeny wostaji. Małe přidawki nětko wulke wopory pozdźišo přewyšuja.',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: '„{{goal}}“ so do plana njehodźi',
      message:
        'Trjeba {{requiredAmount}} na měsac, ale po wašich budgetach je jenož {{freeAmount}} swobodne. Změńće datum, cil abo budgety — nadźijeć so plan njeje.',
    },
    {
      title: '„{{goal}}“ prosy wjace, hač swobodneho maće',
      message:
        '{{requiredAmount}} trěbne kóždy měsac, {{freeAmount}} k dispoziciji. Wšo naraz chcyć je puć, zo so ničo njestanje; wuzwolće.',
    },
    {
      title: 'Ličby prajeja ně — hač dotal',
      message:
        '„{{goal}}“ trjeba {{requiredAmount}} na měsac; swobodnych pjenjez maće {{freeAmount}}. Přiměrće to, což je we wašej mocy: termin abo druhe hranicy.',
    },
    {
      title: '„{{goal}}“ trjeba rozsud',
      message:
        'Při {{requiredAmount}} na měsac přewyša {{freeAmount}}, kotrež po budgetach wostanu. Cil, z wotewrjenymi wočimi wuzwoleny, je lěpši hač tón, kotryž prózdna nadźija dźerži.',
    },
    {
      title: 'Njemóžne tempo za „{{goal}}“',
      message:
        'Trěbne {{requiredAmount}} měsačnje, swobodne {{freeAmount}}. Čestna arithmetika nětko zalutuje zrudźenje pozdźišo.',
    },
  ],
  'stoic.shortfall': [
    {
      title: 'Waš staw spadnje pod nulu {{date}}',
      message:
        'Přichodne zapłaćenja {{committedAmount}} spušća prognozowany staw na {{lowestAmount}}. Přihotujće so nětko, dokulž je to hišće jenož prognoza.',
    },
    {
      title: 'Deficit přińdźe: {{date}}',
      message:
        'Zawjazane zapłaćenja ({{committedAmount}}) staw přewyšuja, a dno je {{lowestAmount}}. Ćežkosć předwidźeć je puć, kak swoju mocu zhubja.',
    },
    {
      title: 'Liče na {{date}}',
      message:
        'Tón dźeń docpěje prognozowany staw {{lowestAmount}}. Přesuńće zapłaćenje, zdźeržće přeće abo wotstajće pjenjezy — kóžde z toho je dźensa we wašej mocy.',
    },
    {
      title: 'Zawjazanosće staw přewyšuja',
      message:
        '{{committedAmount}} dospěje, a staw spadnje na {{lowestAmount}} wokoło {{date}}. Měrna wotmołwa je zaha.',
    },
    {
      title: 'Předwidźće dźěru {{date}}',
      message:
        'Prognozowany najnišši staw: {{lowestAmount}}. To, což je předwidźane, hodźi so měrnje přiwzać; to, což nas překwapi, lědma.',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: 'Sće swoje słowo sebi dźeržał',
      message:
        '{{months}} měsacow po rjedźe wostachu waše wudawki w planje, kotryž sće postajił. Tak samowobknježenje wupada.',
    },
    {
      title: '{{months}} měsacow w planje',
      message:
        'Měsac po měsacu so to, což sće zaměrił, a to, což sće činił, zjednawaja. Konsekwentnosć je ćichiša hač wola a traje dlěje.',
    },
    {
      title: 'Plan a žiwjenje so zjednawaja',
      message:
        '{{months}} slědowacych měsacow we wašich hranicach. Plan, tak derje dźeržany, hižo njeje wobmjezowanje — je to, kak žiwjeće.',
    },
    {
      title: 'Stabilnje {{months}} měsacow',
      message:
        'Waše budgety dźerža {{months}} měsacow po rjedźe. Dźeržće samsnu kedźbnosć; funguje.',
    },
    {
      title: 'Disciplina, zdźeržana',
      message:
        '{{months}} měsacow bjez łamanja wašeho plana. Mało wěcow tak wuswobodźa kaž dowěra do swójskich rozsudow.',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: 'Waše pjenjezy wašim hódnotam slěduja',
      message:
        'Čestnosć wza {{actual}} % wašich wudawkow — nic mjenje hač {{planned}} %, kotrež sće planował. Derje wudate.',
    },
    {
      title: 'Čestnosć dósta swój dospołny dźěl',
      message:
        '{{actual}} % na strowotu, wuknjenje a druhich, přećiwo planowanym {{planned}} %. Za to, což cenjeće, sće zapłaćił.',
    },
    {
      title: 'Wudate na to, zo byšće lěpši był',
      message:
        'Čestnosć docpě tutón měsac {{actual}} % wudawkow (planowane {{planned}} %). Tute pjenjezy za was dźěłaja dołho po tym, zo su wotešli.',
    },
    {
      title: 'Zaměr wuwjedźeny',
      message:
        'Planowali sće {{planned}} % za čestnosć a wudali {{actual}} %. Dobre zaměry lědma měsac přežiwja — waše přežiwichu.',
    },
    {
      title: 'Najlěpše wužiwanje pjenjez',
      message: '{{actual}} % du na to, což was a druhich lěpšich čini. Wuzwolujće to dale.',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: 'Wotpočink na swojim městnje',
      message:
        'Wotpočink je {{actual}} % wudawkow, pod {{planned}} %, kotrež sće jemu dowolił. Wužiwaće wěcy, bjez toho zo by was wodźili.',
    },
    {
      title: 'Wjesełosć, w měrje dźeržana',
      message:
        'Wotpočink wza {{actual}} % přećiwo planowanym {{planned}} %. Měrnosć njeje něšto přepušćić — je to wuzwolić.',
    },
    {
      title: 'Wotpočink bjez přewjele',
      message:
        '{{actual}} % na wotpočink, pod wašej hranicu {{planned}} %. Wjesele lěpje słodźi, hdyž njeknježi.',
    },
    {
      title: 'Měrnosć, po ćichim',
      message:
        'Wotpočinkej sće {{planned}} % dał a wón wužiwaše jenož {{actual}} %. Ta rezerwa je swoboda, kotruž sće sej zdźeržał.',
    },
    {
      title: 'Wotpočink pod planom',
      message:
        'Při {{actual}} % wudawkow wosta wotpočink pod {{planned}} %, kotrež sće postajił. Derje dźeržane.',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: '{{percent}} % pod planom',
      message:
        'Wudali sće {{savedAmount}} mjenje, hač sće sej tutón měsac dowolił. Nic wšo trjebać, což byšće měć móhł, je tež forma bohatstwa.',
    },
    {
      title: '{{savedAmount}} wosta njewudate',
      message:
        'Měsac so {{percent}} % pod planom skónči. To, což sće njewudał, je hišće waše, zo byšće z tym rozsudźił.',
    },
    {
      title: 'Mjenje, hač sće dowolił',
      message:
        'Wudawki su {{percent}} % pod planom — {{savedAmount}} wosta. Dajće tej rezerwje zaměr, prjedy hač ju nawyk wza.',
    },
    {
      title: 'Plan měješe rezerwu',
      message:
        '{{savedAmount}} pod wašimi hranicami tutón měsac. Zdźerženosć, kotraž so lochka začuwa, je ta, kotraž traje.',
    },
    {
      title: 'Lóše, hač bě planowane',
      message:
        'Trjebali sće {{percent}} % mjenje, hač sće budgetował. Rozmyslujće, zo byšće {{savedAmount}} k cilej pósłał.',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '„{{goal}}“ je po planje',
      message:
        'Přešli sće {{percent}} % puća, w tempje, kotrež cil trjeba. Krute kroki, měsačnje činjene, dale docpěja.',
    },
    {
      title: 'Na puću k „{{goal}}“',
      message: '{{percent}} % hotowe a tempo dźerži. Dale płaćće cilej jako prěnjemu; funguje.',
    },
    {
      title: '„{{goal}}“: {{percent}} % a stabilnje',
      message: 'Cil kóždy měsac dóstawa to, což trjeba. Sćerpnosć swoje čini.',
    },
    {
      title: 'Cil so po planje hiba',
      message:
        '„{{goal}}“ je {{percent}} % financowany a na času. To, což so po mału kóždy měsac čini, jedyn špatny tydźeń njezastaji.',
    },
    {
      title: 'Postup, kotremuž móžeće wěrić',
      message:
        '„{{goal}}“ steji na {{percent}} %, w tempje. Twariće jón na jenički puć, kotryž funguje — postupnje.',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: 'Mjenje impulsiwnych kupnjenjow při {{merchant}}',
      message:
        'Wot {{before}} kupnjenjow zašły měsac na něhdźe {{after}} tutón měsac. Spušćeny nawyk je dobyta swoboda.',
    },
    {
      title: '{{merchant}}: {{before}} → {{after}}',
      message:
        'Chodźiće tam mjenje hač prjedy. Kóždy přeskočeny refleks je małe dobyće wuzwolenja nad nawykom.',
    },
    {
      title: 'Mały nawyk so zmjeńša',
      message:
        'Kupnjenja při {{merchant}} spadnychu wot {{before}} na něhdźe {{after}}. Dźiće dale — stanje so lóše.',
    },
    {
      title: 'Wuzwolenje město refleksa',
      message:
        'Při {{merchant}} sće wot {{before}} kupnjenjow na něhdźe {{after}} přešoł. To je knjejstwo, po jednym rozsudźe twarjene.',
    },
    {
      title: 'Mjenje małych wěcow',
      message:
        '{{merchant}} widźeše was něhdźe {{after}} razow město {{before}}. Małe dobyća so sumuja.',
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: 'Přiměrili sće so słabšemu měsacej',
      message:
        'Dochod spadny {{incomePercent}} %, a wy sće wudawki {{expensePercent}} % skrótšił. Na změnu zboža sće ze změnu kursa wotmołwił.',
    },
    {
      title: 'Měrnosć, hdyž dochod spadny',
      message:
        'Dochod dele {{incomePercent}} %, wudawki dele {{expensePercent}} %. Přiměrili sće so tomu, což je, nic tomu, což bě.',
    },
    {
      title: 'Zbožo so změni; a wy tež',
      message:
        'Spad dochoda wo {{incomePercent}} % zetka spad wudawkow wo {{expensePercent}} %. To je runowaha w ličbach.',
    },
    {
      title: 'Derje wodźene',
      message:
        'Hdyž dochod {{incomePercent}} % spadny, slědowachu wudawki ({{expensePercent}} % mjenje). Wětr njebě waš; płachta bě.',
    },
    {
      title: 'Wudawki dochodej dele slědowachu',
      message:
        'Wudali sće {{expensePercent}} % mjenje, hdyž dochod {{incomePercent}} % spadny. Zahe so přiměrić je měrny puć přez.',
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: 'Potrjeby su stabilne',
      message:
        '{{months}} měsacow waše trěbne kóšty so nimale njehibachu. Stabilne dno wam swobodu nad njim dawa.',
    },
    {
      title: 'Potrjeby pod kontrolu',
      message:
        'Wudawki za potrjeby wostachu runje {{months}} měsacow. Potrjeby, kotrež njerostu, su potrjeby, kotrež wobknježiće.',
    },
    {
      title: '{{months}} měsacow stabilnych potrjebow',
      message: 'Nawjam, jědź a zličbowanki wostachu, hdźež bychu. Ćicha stabilnosć je tež wukon.',
    },
    {
      title: 'Žane łazenje při potrjebach',
      message:
        '{{months}} měsacow bjez přesunjenja w tym, což žiwjenje žada. Wšo druhe so na tym zakładźe lóše planuje.',
    },
    {
      title: 'Krute dno',
      message:
        'Trěbne wudawki su stabilne {{months}} měsacow. Njedawaće komfortam jako potrjebam přeńć.',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: 'Dawkomócny z tym, což zasłužuće',
      message:
        'Přez {{months}} měsacow du {{percent}} % wašeho dochoda — {{givenAmount}} — na pomoc druhim. To su pjenjezy w swojim najlěpšim wužiwanju.',
    },
    {
      title: '{{givenAmount}} druhim dane',
      message:
        'Přez {{months}} měsacow sće {{percent}} % swojeho dochoda dźělił. Dobrota, kotraž so w ličbach pokazuje, je dobrota praktikowana, nic jenož začuwana.',
    },
    {
      title: 'Wotewrjene ruki',
      message:
        'Dobroćinskosć a dary wzachu w poslednim času {{percent}} % wašeho dochoda. To, což dawaće, je tón dźěl bohatstwa, kotryž žane njezbožo wzać njemóže.',
    },
    {
      title: 'Dawkomócnosć je dźěl wašeho plana',
      message:
        '{{givenAmount}} druhim přez {{months}} měsacow. Dźeržće to — dobre, kotrež druhim činiće, je tež za was činjene.',
    },
    {
      title: 'Derje dane',
      message:
        '{{percent}} % toho, což sće zasłužił, du na pomoc druhim. Mało nawykow wjace wo čłowjeku praji.',
    },
  ],
  'stoic.praise_steady': [
    {
      title: 'Ničo za korigowanje',
      message: 'Waše wudawki wotpowěduja tomu, což sće zaměrił. Dźiće dale, kaž sće.',
    },
    {
      title: 'Zaměr a čin so zjednawaja',
      message: 'Tutón měsac wupada tak, kaž sće jón planował. Runje to zjednanje je cyły zmysł.',
    },
    {
      title: 'Měrny měsac',
      message:
        'Žane přewjele, žana njedbawosć, kotraž by so naspomnić hodźała. Derje — njesće samsnu kedźbnosć dale.',
    },
    {
      title: 'Wšo w porjadku',
      message:
        'Waš plan wutraje a ničo korekturu njeprosy. Wužiwajće měr, kotryž sće sej zasłužił.',
    },
    {
      title: 'Kruta ruka',
      message: 'Měsac wašemu planej slědowaše. Dobre nawyki činja dobre měsacy wšědne.',
    },
  ],
  'expert.pay_yourself_first': [
    {
      title: 'Zapłaćće najprjedy sebi',
      message:
        'Prawidło George S. Clasona: dźěl wšeho, což zasłužuće, je waš, zo byšće jón wobchował — znajmjeńša dźesatka. Přez {{months}} měsacow sće {{savingsPercent}} % zdźeržał. Wotstajće {{tenthAmount}} tón dźeń, hdyž dochod přińdźe, před wšěm druhim.',
    },
    {
      title: 'Dźesatka je waša, zo byšće ju wobchował',
      message:
        'W „Najbohatšim muźu w Babylonje“ je prěni lěk na suchu móšnju wobchować jedyn pjenjez z kóždych dźesać. Waša lutowanska kwota je {{savingsPercent}} %; {{tenthAmount}} na měsac by tón nawyk započało.',
    },
    {
      title: 'Lutujće, prjedy hač wudawaće, nic po tym',
      message:
        'Porada Clasona je prosta: zapłaćće najprjedy sebi. W poslednim času wostawa při was {{savingsPercent}} % dochoda. Wotstajće {{tenthAmount}} na dnju wupłaty a dajće wudawkam so na zbytk přiměrić.',
    },
    {
      title: 'Prěni pjenjez je waš',
      message:
        'Dźěl wšeho, což zasłužuće, měł při was wostać — nic mjenje hač dźesatka, praji Clason. Přez {{months}} měsacow sće {{savingsPercent}} % zdźeržał. Započńće z {{tenthAmount}} na měsac, awtomatisce.',
    },
    {
      title: '{{savingsPercent}} % zdźeržane — prawidło prosy 10 %',
      message:
        'Zapłaćće najprjedy sebi, kaž „Najbohatši muž w Babylonje“ praji: {{tenthAmount}} na měsac, wotstajene před kóždej zličbowanku. Lutowanje, najprjedy činjene, wot toho njewotwisuje, což wostanje.',
    },
  ],
  'expert.rule_50_30_20': [
    {
      title: 'Waše přepruwowanje 50/30/20',
      message:
        'Elizabeth Warren a Amelia Warren Tyagi poradźuja 50 % dochoda po dawkach za trěbne, 30 % za přeća, 20 % za lutowanje. Waše: {{needsPercent}} % / {{wantsPercent}} % / {{savingsPercent}} %.',
    },
    {
      title:
        'Potrjeby {{needsPercent}} %, přeća {{wantsPercent}} %, lutowanje {{savingsPercent}} %',
      message:
        'All Your Worth pjenjezy jako 50/30/20 wurunuje. Přirunajće z planom tu poziciju, kotraž je najdale wot swojeje marki — tam jedna změna najwjace pomha.',
    },
    {
      title: 'Kak so waš dochod dźěli',
      message:
        'Trěbne bjerje {{needsPercent}} % dochoda, přeća {{wantsPercent}} %, a {{savingsPercent}} % so lutuje. Runowaha 50/30/20 z All Your Worth je wužitne špihel, nic sudźenje.',
    },
    {
      title: 'Wurunana formla pjenjez',
      message:
        'Formla Warren a Tyagi: połojca za to, což dyrbiće zapłaćić, što so tež stanje, 30 % za přeća, 20 % za přichod. Wy sće při {{needsPercent}}/{{wantsPercent}}/{{savingsPercent}}.',
    },
    {
      title: 'Přećiwo 50/30/20',
      message:
        'Waše rozdźělenje je {{needsPercent}} % trěbne, {{wantsPercent}} % přeća, {{savingsPercent}} % lutowanje. Proba knihi za trěbne: byšće to hišće płaćił, hdy byšće jutře dźěło zhubił?',
    },
  ],
  'expert.room_for_error': [
    {
      title: 'Wostajće městno za zmylk',
      message:
        'Porada Morgana Housela: planujće za to, zo wěcy po planje njedu. Waš staw pokrywa něhdźe {{cushionDays}} dnjow wudawkow; zwučene měritko su tři měsacy — {{targetAmount}}.',
    },
    {
      title: 'Poduška {{cushionDays}} dnjow',
      message:
        'The Psychology of Money to mjenuje městnom za zmylk — rezerwu, kotraž wam dowola překwapjenja přežiwić. K {{targetAmount}}, třom měsacam wudawkow, twarić da planej šansu woprawdźitosć přežiwić.',
    },
    {
      title: 'Wěstostna marža, doma',
      message:
        'Housel sej Grahamowu wěstostnu maržu za priwatne pjenjezy požčuje. Z {{cushionDays}} dnjemi wudawkow w rezerwje móže jedyn špatny měsac dobry plan zwróćić. Měrće na {{targetAmount}}.',
    },
    {
      title: 'Městno za njewočakowane',
      message:
        'Waša rezerwa by něhdźe {{cushionDays}} dnjow trała. Překwapjenja su jenička wěstosć; tři měsacy wudawkow ({{targetAmount}}) su husto wužiwany cil.',
    },
    {
      title: 'Twarće rezerwu, prjedy hač ju trjebaće',
      message:
        'Městno za zmylk, ze słowami Morgana Housela, je to, což was w hrě dźerži. Pokryte maće něhdźe {{cushionDays}} dnjow; {{targetAmount}} by tři měsacy pokryło.',
    },
  ],
  'expert.lifestyle_creep': [
    {
      title: 'Wudawki dochod přesćěhaja',
      message:
        'Wudawki w poslednim kwartalu rostu {{expenseGrowth}} %, mjeztym zo so dochod {{incomeGrowth}} % změni. Prěnje prawidło The Millionaire Next Door: kajkiž tež waš dochod je, žiwjejće pod swojimi móžnosćemi.',
    },
    {
      title: 'Žiwje so wyše, nic bohatši',
      message:
        'Stanley a Danko wuslědźichu, zo bohatstwo je to, což zhromadźiće, nic to, což wudaće. Waše wudawki rostu {{expenseGrowth}} %, dochod {{incomeGrowth}} % — w tej mjezy bohatstwo woteběhuje.',
    },
    {
      title: 'Łazenje žiwjenskeho stila: +{{expenseGrowth}} %',
      message:
        'Wudawki so spěšnišo hač dochod ({{incomeGrowth}} %) zběhachu. Ludźo z The Millionaire Next Door wostachu bohaći, dokulž dachu dochodej rosć, bjez toho zo bychu wudawkam slědować dali.',
    },
    {
      title: 'Hrodźi so přesuwaja',
      message:
        'Wudawki su mjez kwartalemi wyše wo {{expenseGrowth}} % přećiwo {{incomeGrowth}} % při dochodźe. Žiwjejće pod swojimi móžnosćemi, prajeja Stanley a Danko — kajkež móžnosće tež su.',
    },
    {
      title: 'Bohatstwo je to, což wobchowaće',
      message:
        'Dobry dochod, dospołnje wudaty, nikoho bohatšeho nječini. W poslednim kwartalu rostu waše wudawki {{expenseGrowth}} % a dochod {{incomeGrowth}} % — hodźi so pohladać, prjedy hač so to nowa normalnosć stanje.',
    },
  ],
  'expert.life_energy': [
    {
      title: '{{merchant}} płaćeše {{hours}} hodźin wašeho žiwjenja',
      message:
        'Vicki Robin a Joe Dominguez poradźuja wěcy w žiwjenskej energiji hódnoćić — w dźěłowych hodźinach, kotrež płaća. {{totalAmount}} při {{merchant}} tutón měsac je něhdźe {{hours}} hodźin. Bě to hódne?',
    },
    {
      title: '{{hours}} hodźin při {{merchant}}',
      message:
        'Your Money or Your Life was pozbudźuje pjenjezy jako čas widźeć, kotryž sće za nje wuměnił. Při wašim přerěznym hodźinskim dochodźe {{totalAmount}} tam něhdźe {{hours}} dźěłowym hodźinam wotpowěduje.',
    },
    {
      title: 'Hódnoćće to w hodźinach',
      message:
        '{{totalAmount}} při {{merchant}} je něhdźe {{hours}} hodźin dźěła. Robin a Dominguez to žiwjensku energiju mjenuja — jenička waluta, kotruž njemóžeće wróćo zasłužić.',
    },
    {
      title: 'Što {{merchant}} woprawdźe płaćeše',
      message:
        'Pjenjezy su něšto, za čož swoju žiwjensku energiju wuměnjamy. Tutón měsac wza {{merchant}} něhdźe {{hours}} hodźin wašeje ({{totalAmount}}). Wotpowěduje wjesełosć tym hodźinam?',
    },
    {
      title: 'Přepruwowanje žiwjenskeje energije',
      message:
        'Přeličene po wašim přerěznym hodźinskim dochodźe su {{totalAmount}}, při {{merchant}} wudate, něhdźe {{hours}} hodźin. Your Money or Your Life poradźuje so prašeć, hač je to wotpowědne spokojenje přinjesło.',
    },
  ],
};
