import type { StoicTextMap } from './types';

export const sv: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: 'Månaden har vuxit ur sin plan',
      message:
        'Du planerade {{plannedAmount}} och har gjort av med {{spentAmount}} — {{percent}}% mer. Planen gjorde du med klart huvud; låt den tala högre än ögonblicket.',
    },
    {
      title: '{{percent}}% över det du tänkt lägga',
      message:
        'Utgifterna ligger på {{spentAmount}} mot en plan på {{plannedAmount}}. Se vilken gräns som gav vika först — där finns lärdomen.',
    },
    {
      title: 'Din plan och din månad är oense',
      message:
        '{{spentAmount}} spenderat, {{plannedAmount}} avsett. Antingen begärde planen för lite av verkligheten eller verkligheten för mycket av dig — avgör lugnt vilket.',
    },
    {
      title: 'Mer gick ut än du tillät',
      message:
        'Månaden ligger {{percent}}% över de {{plannedAmount}} du satte. Inget går förlorat på att stanna nu; mycket går förlorat på att låtsas att det inte hänt.',
    },
    {
      title: 'En gräns du satte, en gräns du passerade',
      message:
        'Du tänkte lägga {{plannedAmount}}; det blev {{spentAmount}}. Självbehärskning är inte att aldrig snubbla — det är att märka det tidigt och återvända till vägen.',
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: 'Nöje tar mer än du planerat',
      message:
        'Du tänkte att nöje skulle vara {{planned}}% av utgifterna; den här månaden är det {{actual}}%. Njutning är välkommen som gäst, inte som husets herre.',
    },
    {
      title: 'Nöje på {{actual}}%, planerat {{planned}}%',
      message:
        'Vila förtjänar sin plats när den återställer dig. Fråga dig vilka av månadens nöjen som gjorde det, och släpp resten utan ånger.',
    },
    {
      title: 'Bekvämligheten spenderar mer än avsikten',
      message:
        'Nöje står för {{actual}}% av utgifterna mot de {{planned}}% du valde. Måttfullhet är inte att vägra njutning — det är att hålla den i den storlek du bestämt.',
    },
    {
      title: 'Det behagliga tränger undan det planerade',
      message:
        'Du gav nöje {{planned}}% av planen och det tog {{actual}}%. Det du njuter av utan ansträngning är värt en andra blick innan det blir något du behöver.',
    },
    {
      title: 'Nöje har klivit över sin linje',
      message:
        '{{actual}}% av månaden gick till nöje, {{planned}}% var avsikten. Linjen var din att dra, och den är din att hålla.',
    },
  ],
  'stoic.leisure_habit': [
    {
      title: 'Nöje över plan igen',
      message:
        'Nöje gick över din plan i {{months}} av de senaste {{window}} månaderna. En upprepning är inte längre en slump — det är en vana värd att granska.',
    },
    {
      title: '{{months}} av {{window}} månader över nöjesplanen',
      message:
        'Det som händer en gång är omständighet; det som händer {{months}} gånger är karaktär som formas. Välj den karaktären med avsikt.',
    },
    {
      title: 'Samma snedsteg, månad efter månad',
      message:
        'Nöje gick över planen i {{months}} av {{window}} månader. Höj planen ärligt eller ändra vanan — att leva mittemellan kostar mest.',
    },
    {
      title: 'Ett mönster, inte ett misstag',
      message:
        'I {{months}} av de senaste {{window}} månaderna tog nöje mer än du gav det. Lägg märke till ögonblicket då beslutet fattas, inte bara räkningen efteråt.',
    },
    {
      title: 'Vanan röstar mot din plan',
      message:
        'Nöje slog planen {{months}} gånger på {{window}} månader. Vanor byggs ett val i taget; så rivs de också.',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: 'Dygd får mindre än du tänkt',
      message:
        'Du avsatte {{planned}}% av budgeten till hälsa, lärande och andra; hittills är det {{actual}}%. En avsikt räknas först när den genomförs.',
    },
    {
      title: 'Dygd på {{actual}}% av planerade {{planned}}%',
      message:
        'Pengarna du tänkt för det som gör dig bättre väntar fortfarande. Det finns ingen bättre tid att använda dem väl än den här månaden.',
    },
    {
      title: 'Det goda du planerade är ospenderat',
      message:
        'Hälsa, lärande och generositet skulle få {{planned}}% av utgifterna; de fick {{actual}}%. Gör en av dem medvetet den här veckan.',
    },
    {
      title: 'Avsikt utan handling',
      message:
        'Dygd står för {{actual}}% av utgifterna mot de {{planned}}% du valde. Det vi värdesätter syns i det vi faktiskt betalar för.',
    },
    {
      title: 'Utrymme kvar för det som betyder något',
      message:
        'Bara {{actual}}% gick till dygd, fast du planerade {{planned}}%. En bok, en hälsokontroll, en gåva till någon i nöd — planen har redan sagt ja.',
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: 'Dygd skjuts upp igen',
      message:
        'Utgifterna för hälsa, lärande och andra har legat under din plan {{months}} månader i rad. Det du hela tiden skjuter upp har du i själva verket redan valt bort.',
    },
    {
      title: '{{months}} månader av uppskjuten dygd',
      message:
        'Varje månad gav planen plats åt det som gör dig bättre, och varje månad förblev platsen tom. Tid är det enda du inte kan budgetera två gånger.',
    },
    {
      title: 'Ditt bättre jag väntar fortfarande',
      message:
        'Dygd har legat under plan {{months}} månader i rad. Börja hellre smått och säkert än storslaget och senare.',
    },
    {
      title: 'Goda avsikter åldras',
      message:
        'I {{months}} månader har hälsa, lärande och generositet fått mindre än planerat. Välj en och finansiera den först nästa månad, före allt annat.',
    },
    {
      title: 'Dygd förlorar hela tiden mot ”senare”',
      message:
        '{{months}} månader i rad under plan. ”Senare” är dit goda avsikter går för att glömmas — ge den här ett datum.',
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: 'Din plan har inget utrymme för dygd',
      message:
        'Ingen av dina budgetar tjänar hälsa, lärande eller andra. En plan visar vad vi värdesätter — fundera på att ge dygd en egen rad.',
    },
    {
      title: 'Budget för allt, utom för det goda',
      message:
        'Nödvändighet, arbete och nöje har alla gränser; dygd har ingen. Det som aldrig planeras för brukar aldrig bli av.',
    },
    {
      title: 'Planera för det som gör dig bättre',
      message:
        'Det finns ännu ingen budget i klassen dygd. Även en liten — böcker, träning, en gåva — gör en önskan till ett åtagande.',
    },
    {
      title: 'Planen tiger om dygd',
      message:
        'Du budgeterar för det du måste och det du tycker om, men ännu inte för den du vill bli. En blygsam dygdbudget skulle ändra på det.',
    },
    {
      title: 'Dygd saknar budget',
      message:
        'Utgifter för hälsa, lärande eller andra finns inte planerade någonstans. Välj en och ge den en gräns du gärna skulle nå.',
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: 'Nödvändigheter kostar mer än planerat',
      message:
        'Du planerade {{planned}}% av utgifterna för nödvändigheter; de tar {{actual}}%. Pröva om var och en fortfarande är ett behov eller i tysthet har blivit en bekvämlighet.',
    },
    {
      title: 'Nödvändighet på {{actual}}%, planerat {{planned}}%',
      message:
        'Det livet kräver är oftast mindre än det vi vänjer oss vid. Se på den största nödvändiga utgiften med nya ögon.',
    },
    {
      title: 'Det nödvändiga sväller',
      message:
        'Nödvändigheter står för {{actual}}% av månaden mot de {{planned}}% du räknade med. Ett behov som fortsätter växa förtjänar en fråga.',
    },
    {
      title: 'Behoven växer ur planen',
      message:
        'Planerat {{planned}}%, faktiskt {{actual}}%. Antingen underskattade planen de verkliga kostnaderna, eller så reser några önskemål under namnet behov.',
    },
    {
      title: 'Mer på ”måste” än avsett',
      message:
        'Nödvändigheter tog {{actual}}% av utgifterna i stället för {{planned}}%. Skilj det som verkligen måste från det som bara alltid har varit.',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: 'Nödvändigheterna kryper uppåt',
      message:
        'Utgifterna för nödvändigheter har ökat {{months}} månader i rad, {{percent}}% totalt. Behov växer tyst när ingen ber dem rättfärdiga sig.',
    },
    {
      title: '+{{percent}}% på nödvändigheter på {{months}} månader',
      message:
        'Varje steg såg litet ut; tillsammans är de inte det. Ta den största återkommande nödvändigheten och fråga om den fortfarande måste kosta så mycket.',
    },
    {
      title: 'Golvet i dina utgifter stiger',
      message:
        'Nödvändigheter ökade {{months}} månader i följd (+{{percent}}%). Ett stigande golv lämnar mindre plats för allt du väljer fritt.',
    },
    {
      title: 'Behoven breder ut sig',
      message:
        '{{months}} månaders ökning, {{percent}}% sammanlagt. Det stoiska provet är enkelt: skulle du välja detta igen i dag, med priset framför dig?',
    },
    {
      title: 'Små ökningar, stadig riktning',
      message:
        'Nödvändigheter har ökat {{percent}}% på {{months}} månader. Riktningen betyder mer än en enskild månad — den här är värd att rätta tidigt.',
    },
  ],
  'stoic.work_over_plan': [
    {
      title: 'Arbete kostar mer än planerat',
      message:
        'Du planerade {{planned}}% av utgifterna för arbete; det tar {{actual}}%. Verktyg och tjänster ska göra sig förtjänta av sin plats — se efter vilka som gör det.',
    },
    {
      title: 'Arbetsutgifter på {{actual}}%, planerat {{planned}}%',
      message:
        'Att investera i ditt arbete är bra när det ger något tillbaka. Gå igenom det du betalar för men inte längre använder.',
    },
    {
      title: 'Arbetsbudgeten är ansträngd',
      message:
        'Arbete tog {{actual}}% i stället för {{planned}}%. Flit är att göra arbetet väl, inte att köpa varje verktyg för det.',
    },
    {
      title: 'Verktygen spenderar mer än planen',
      message:
        'Planerat {{planned}}%, spenderat {{actual}}% på arbete. Fråga varje utgift: hjälper den mig att göra jobbet, eller känns den bara som framsteg?',
    },
    {
      title: 'Arbetskostnaderna har glidit',
      message:
        'Arbete står för {{actual}}% av utgifterna mot avsedda {{planned}}%. En snabb genomgång nu sparar en större senare.',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '”{{category}}” går över sin gräns igen',
      message:
        '”{{category}}” gick över budget i {{months}} av de senaste {{window}} månaderna. Antingen är gränsen fel eller begäret — bestäm vilket.',
    },
    {
      title: '”{{category}}”: över budget {{months}} av {{window}} månader',
      message:
        'En gräns som alltid passeras är ingen gräns, bara en önskan. Gör den ärlig — höj den med avsikt eller håll den med avsikt.',
    },
    {
      title: 'Samma budget ger vika igen',
      message:
        '”{{category}}” har gått över sin gräns {{months}} gånger på {{window}} månader. Upprepningen är information; använd den.',
    },
    {
      title: '”{{category}}” ber om din uppmärksamhet',
      message:
        'Över budget i {{months}} av {{window}} månader. Se på ögonblicket före köpet — det är den enda platsen där vanan kan ändras.',
    },
    {
      title: 'Ett mönster i ”{{category}}”',
      message:
        '{{months}} överskridanden på {{window}} månader. Det vi upprepar blir vi; bestäm vad du vill att den här kategorin ska säga om dig.',
    },
  ],
  'stoic.budget_pace': [
    {
      title: '”{{category}}” tar slut runt dag {{day}}',
      message:
        'Du har gjort av med {{spentAmount}} av {{limitAmount}}, och i den här takten tar gränsen slut runt dag {{day}}. Att sakta ner nu är lättare än att stanna senare.',
    },
    {
      title: '”{{category}}” ligger före månaden',
      message:
        'Redan {{spentAmount}} borta av en gräns på {{limitAmount}}. I den här takten är den slut runt dag {{day}} — resten av månaden kan du fortfarande forma själv.',
    },
    {
      title: 'Takten i ”{{category}}”',
      message:
        'Budgeten på {{limitAmount}} räcker till ungefär dag {{day}} i nuvarande takt. Förutseende är den billigaste sortens disciplin.',
    },
    {
      title: '”{{category}}” spenderar framtiden',
      message:
        '{{spentAmount}} av {{limitAmount}} använt; gränsen tar slut nära dag {{day}}. Det du gör den här veckan avgör om det händer.',
    },
    {
      title: 'Tidig varning för ”{{category}}”',
      message:
        'I nuvarande takt räcker gränsen på {{limitAmount}} inte månaden ut — den tar slut runt dag {{day}}. Justera medan det kostar lite.',
    },
  ],
  'stoic.budget_unused': [
    {
      title: '”{{category}}” har inte använts',
      message:
        'Budgeten för ”{{category}}” har inte haft några utgifter på {{months}} månader. Antingen har du vuxit ifrån den, eller så är det en avsikt som fortfarande väntar — bestäm vilket.',
    },
    {
      title: 'En tom budget: ”{{category}}”',
      message:
        '{{months}} månader utan en enda utgift. En plan ska beskriva livet du lever eller det du bygger — vilket är detta?',
    },
    {
      title: '”{{category}}” står stilla',
      message:
        'Inget har spenderats här på {{months}} månader. Var det återhållsamhet, bra gjort; var det försummelse, gör något åt det.',
    },
    {
      title: 'Planerat, men inte levt',
      message:
        '”{{category}}” har haft en gräns och inga utgifter på {{months}} månader. Håll planen sann: ta bort den eller använd den.',
    },
    {
      title: '”{{category}}”: {{months}} tysta månader',
      message:
        'En budget som aldrig rörs tar ändå plats i din plan. Frigör platsen eller hedra avsikten.',
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: '{{percent}}% av utgifterna saknar gräns',
      message:
        '{{unbudgetedAmount}} gick den här månaden till kategorier som ingen budget vakar över. Det som inte mäts är svårt att bemästra.',
    },
    {
      title: 'Mycket av månaden är oplanerad',
      message:
        '{{percent}}% av utgifterna — {{unbudgetedAmount}} — ligger utanför alla budgetar. Ge den största delen en gräns, så ser planen mer av ditt liv.',
    },
    {
      title: 'Utgifter utanför planen',
      message:
        'Budgetarna täcker bara en del av det du spenderar; {{unbudgetedAmount}} ({{percent}}%) förblir omätt. Utvidga planen dit pengarna faktiskt går.',
    },
    {
      title: 'Planen ser bara en del av bilden',
      message: '{{percent}}% av månadens utgifter saknar budget. Klar syn kommer före gott omdöme.',
    },
    {
      title: '{{unbudgetedAmount}} spenderat utan gräns',
      message:
        'Det är {{percent}}% av månaden. Du behöver inte begränsa det — bara bestämma hur mycket av det du faktiskt vill ha.',
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '”{{category}}” är det mesta av ditt nöje',
      message:
        '{{percent}}% av nöjesutgifterna gick till ”{{category}}”. Variation i vilan är sundare än att vara beroende av ett enda nöje.',
    },
    {
      title: 'Ett nöje dominerar',
      message:
        '”{{category}}” tar {{percent}}% av allt du lagt på nöje. Fråga dig om det fortfarande gläder dig eller har blivit rutin.',
    },
    {
      title: 'Nöjet lutar sig mot ”{{category}}”',
      message:
        '{{percent}}% av nöjet på ett ställe. Det vi inte klarar oss utan har grepp om oss — se efter att greppet fortfarande är lätt.',
    },
    {
      title: '”{{category}}”: {{percent}}% av nöjet',
      message:
        'En enda källa till glädje tar nästan allt. Prova ett annat, billigare nöje den här månaden och jämför.',
    },
    {
      title: 'Din vila har en enda adress',
      message:
        'De flesta nöjespengarna — {{percent}}% — går till ”{{category}}”. Frihet innebär också att kunna njuta av annat.',
    },
  ],
  'stoic.unclassified': [
    {
      title: 'En del utgifter är ännu inte bedömda',
      message:
        'Kategorier utan klass: {{count}}. Bestäm under Budgetar vad som är nödvändighet, arbete, dygd eller nöje.',
    },
    {
      title: 'Kategorier som väntar på ditt omdöme: {{count}}',
      message:
        'De har utgifter men ingen klass, så rådet kan inte väga dem. En minut under Budgetar räcker.',
    },
    {
      title: 'Ge namn åt det dina pengar tjänar',
      message:
        'Kategorier som ännu saknar klass: {{count}}. Omdöme börjar med att kalla saker vid deras rätta namn.',
    },
    {
      title: 'Obedömda kategorier: {{count}}',
      message:
        'Är det ett behov, ditt arbete, en dygd eller ett nöje? Bara du kan säga det — och planen blir tydligare när du gör det.',
    },
    {
      title: 'Några kategorier saknar klass',
      message:
        'Kategorier utanför de fyra klasserna: {{count}}. Klassa dem under Budgetar så att varje utgift syns för vad den är.',
    },
  ],
  'stoic.small_purchases': [
    {
      title: 'Små köp hos {{merchant}}: {{count}}',
      message:
        'Vart och ett såg obetydligt ut; tillsammans blev de {{totalAmount}} den här månaden. Små, oprövade vanor är där de flesta pengar tyst försvinner.',
    },
    {
      title: '{{merchant}}, köp den här månaden: {{count}}',
      message:
        '{{totalAmount}} i små belopp. Fråga dig om varje besök var ett val eller en reflex — bara det första är frihet.',
    },
    {
      title: 'Lite i taget: {{totalAmount}}',
      message:
        'Köp hos {{merchant}}: {{count}}. Inget enskilt spelar roll; vanan gör det. Bestäm hur ofta du faktiskt vill ha den.',
    },
    {
      title: 'En vana hos {{merchant}}',
      message:
        'Köp: {{count}}, sammanlagt {{totalAmount}}. Hoppa över vart tredje den här månaden och se om du saknar det.',
    },
    {
      title: 'De små sakerna blir mycket',
      message:
        'Besök hos {{merchant}}: {{count}}, för {{totalAmount}}. Herravälde över stora beslut byggs på små som dessa.',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: 'Helgerna bär {{percent}}% av nöjet',
      message:
        'Det mesta av dina nöjesutgifter sker på lördagar och söndagar. Vila är bra; se efter att det är vila och inte kompensation för veckan.',
    },
    {
      title: 'Nöjet lever på helgen',
      message:
        '{{percent}}% av nöjesutgifterna hamnar på helger. Planera helgen lite, så kostar den mindre och ger mer.',
    },
    {
      title: 'Helgen betalar för veckan',
      message:
        'Helgerna tar {{percent}}% av det du lägger på nöje. Om veckan måste lagas varje lördag, se på veckan.',
    },
    {
      title: 'Lördag och söndag: {{percent}}% av nöjet',
      message:
        'Lediga dagar lockar till lösa pengar. Bestäm före helgen vad den är till för, och låt pengarna följa.',
    },
    {
      title: 'Ett helgmönster',
      message:
        '{{percent}}% av nöjesutgifterna sker på helger. Mer andrum på vardagarna gör ofta helgerna billigare.',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}} tog {{percent}}% av månaden',
      message:
        '{{totalAmount}} gick till en enda handlare för nöje. När ett ställe har så mycket av dina pengar, fråga dig hur mycket av din uppmärksamhet det har också.',
    },
    {
      title: 'Ett ställe, {{totalAmount}}',
      message:
        '{{merchant}} är {{percent}}% av månadens utgifter. Är det värt den andelen av ditt arbete?',
    },
    {
      title: '{{merchant}} leder dina utgifter',
      message:
        '{{percent}}% av månaden — {{totalAmount}} — gick dit. Inget fel i att njuta av det, så länge du skulle välja det igen.',
    },
    {
      title: 'En stor andel hos {{merchant}}',
      message:
        '{{totalAmount}}, eller {{percent}}% av utgifterna, på ett enda nöjesställe. Väg nöjet mot priset, i lugn och ro.',
    },
    {
      title: '{{percent}}% hos {{merchant}}',
      message:
        'Den här enda handlaren tog {{totalAmount}}. Frihet är att kunna gå förbi när du väljer det.',
    },
  ],
  'stoic.income_drop': [
    {
      title: 'Inkomsten sjönk, utgifterna inte',
      message:
        'Inkomsten sjönk {{percent}}% till {{incomeAmount}}, men utgifterna låg kvar på {{expenseAmount}}. Ödet ändrade sig; dina utgifter har inte märkt det än.',
    },
    {
      title: 'Inkomsten ner {{percent}}%',
      message:
        '{{incomeAmount}} kom in mot {{expenseAmount}} som gick ut. Det ödet ger kan det ta tillbaka — anpassa utgifterna efter det som är, inte det som var.',
    },
    {
      title: 'En magrare månad, samma vanor',
      message:
        'Inkomsten är {{percent}}% lägre ({{incomeAmount}}), medan utgifterna låg kvar på {{expenseAmount}}. Inkomsten står inte i din makt; ditt svar gör det.',
    },
    {
      title: 'Ödet har skiftat',
      message:
        'Du tjänade {{percent}}% mindre än vanligt men spenderade {{expenseAmount}} som förut. Skär ner nu, medan det är ett val och inte en nödvändighet.',
    },
    {
      title: 'Utgifterna har inte följt inkomsten',
      message:
        'Inkomsten föll till {{incomeAmount}} ({{percent}}% lägre); utgifterna är {{expenseAmount}}. Sätt seglet efter den vind du faktiskt har.',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: 'Prenumerationer: {{monthlyAmount}} i månaden',
      message:
        'Prenumerationer: {{count}}, som tar {{percent}}% av dina månadsutgifter. Var och en förnyas utan att fråga dig — fråga själv om var och en.',
    },
    {
      title: '{{percent}}% av utgifterna förnyar sig själva',
      message:
        'Prenumerationer: {{count}}, {{monthlyAmount}} i månaden. Behåll dem du skulle teckna igen i dag.',
    },
    {
      title: 'Tyst, återkommande, {{monthlyAmount}}',
      message:
        'Prenumerationer: {{count}}, som kostar {{percent}}% av din månad. Bekvämlighet är en god tjänare och en dyr herre.',
    },
    {
      title: 'Prenumerationer att se över: {{count}}',
      message:
        'Tillsammans är de {{monthlyAmount}} i månaden, {{percent}}% av utgifterna. Säg upp en du knappt använder och märk hur lite du saknar den.',
    },
    {
      title: 'Det som förnyas av sig självt',
      message:
        '{{monthlyAmount}} i månaden fördelat på prenumerationer ({{count}}). Automatiska utgifter förtjänar en medveten genomgång.',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: 'Din framgång kan räcka lite längre',
      message:
        'Under {{months}} månader behöll du {{savingsPercent}}% av inkomsten, men nästan inget gick till andra. Rikedom vilar bäst i öppna händer — kanske en gåva eller ett bidrag den här månaden?',
    },
    {
      title: 'Tjänar bra, ger lite',
      message:
        '{{incomeAmount}} kom in under {{months}} månader och {{givenAmount}} gick till andra. Hjälper du på sätt som appen inte ser kan du bortse från detta; annars finns det utrymme för det i planen.',
    },
    {
      title: 'Ett gott läge att vara generös',
      message:
        'Du sparade {{savingsPercent}}% av inkomsten — ett tecken på en stadig hand. En liten del av det, given till någon som behöver den, skulle ge stadigheten mer mening.',
    },
    {
      title: 'Ingen annan i bilden än',
      message:
        'De senaste {{months}} månaderna visar omsorgsfullt tjänande och sparande, men ingen välgörenhet och inga gåvor. Vi är skapade för varandra; en blygsam gåva räcker för att börja.',
    },
    {
      title: 'Utrymme för vänlighet',
      message:
        'Bara {{givenAmount}} av {{incomeAmount}} gick till att hjälpa andra. Fundera på ett litet, regelbundet bidrag — generositet blir lättare med vana, som varje dygd.',
    },
  ],
  'stoic.goal_behind': [
    {
      title: '”{{goal}}” halkar efter',
      message:
        'Det kräver {{requiredAmount}} i månaden, och du lägger in ungefär {{paceAmount}}. I den här takten når du det {{monthsLate}} månader för sent.',
    },
    {
      title: '”{{goal}}”: {{monthsLate}} månader sent i den här takten',
      message:
        'Krävs {{requiredAmount}} i månaden, faktiskt ungefär {{paceAmount}}. Flytta datumet ärligt eller flytta mer pengar med avsikt.',
    },
    {
      title: 'Målet och takten är oense',
      message:
        '”{{goal}}” kräver {{requiredAmount}} i månaden; det får {{paceAmount}}. Ett mål är bara så verkligt som det månatliga steget mot det.',
    },
    {
      title: '”{{goal}}” behöver ett fastare steg',
      message:
        '{{paceAmount}} i månaden mot de {{requiredAmount}} som behövs. Betala målet först nästa månad, före allt som är valfritt.',
    },
    {
      title: 'Efter med ”{{goal}}”',
      message:
        'Nuvarande takt ({{paceAmount}}/månad) gör det {{monthsLate}} månader försenat. Små höjningar nu slår stora uppoffringar senare.',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: '”{{goal}}” ryms inte i planen',
      message:
        'Det kräver {{requiredAmount}} i månaden, men efter dina budgetar är bara {{freeAmount}} fritt. Ändra datumet, målbeloppet eller budgetarna — att hoppas är ingen plan.',
    },
    {
      title: '”{{goal}}” kräver mer än du har fritt',
      message:
        '{{requiredAmount}} krävs varje månad, {{freeAmount}} finns tillgängligt. Att vilja allt på en gång är hur ingenting blir gjort; välj.',
    },
    {
      title: 'Siffrorna säger nej — för tillfället',
      message:
        '”{{goal}}” kräver {{requiredAmount}} i månaden; ditt fria utrymme är {{freeAmount}}. Justera det som står i din makt: tidsgränsen eller de andra gränserna.',
    },
    {
      title: '”{{goal}}” kräver ett beslut',
      message:
        'Med {{requiredAmount}} i månaden överstiger det de {{freeAmount}} som blir kvar efter budgetarna. Ett mål som väljs med öppna ögon är bättre än ett som hålls vid liv av önsketänkande.',
    },
    {
      title: 'En omöjlig takt för ”{{goal}}”',
      message:
        'Krävs {{requiredAmount}} i månaden, fritt {{freeAmount}}. Ärlig räkning nu besparar dig besvikelse senare.',
    },
  ],
  'stoic.shortfall': [
    {
      title: 'Ditt saldo går under noll den {{date}}',
      message:
        'Kommande betalningar på {{committedAmount}} tar det beräknade saldot till {{lowestAmount}}. Förbered dig nu, medan det bara är en prognos.',
    },
    {
      title: 'Ett underskott närmar sig: {{date}}',
      message:
        'Bundna betalningar ({{committedAmount}}) överstiger saldot, som bottnar på {{lowestAmount}}. Att förutse motgång är hur den förlorar sin makt.',
    },
    {
      title: 'Planera för den {{date}}',
      message:
        'Den dagen når det beräknade saldot {{lowestAmount}}. Flytta en betalning, avstå från en önskan eller lägg undan pengar — allt detta står i din makt i dag.',
    },
    {
      title: 'Åtagandena överstiger saldot',
      message:
        '{{committedAmount}} ska betalas, och saldot sjunker till {{lowestAmount}} runt den {{date}}. Det lugna svaret är det tidiga.',
    },
    {
      title: 'Se glappet den {{date}} i förväg',
      message:
        'Lägsta beräknade saldo: {{lowestAmount}}. Det som förutses kan mötas med fattning; det som överraskar oss sällan.',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: 'Du höll ditt ord till dig själv',
      message:
        'I {{months}} månader i rad har dina utgifter hållit sig inom planen du själv satte. Så här ser självbehärskning ut.',
    },
    {
      title: '{{months}} månader inom planen',
      message:
        'Månad efter månad stämmer det du tänkt och det du gjort överens. Uthållighet är tystare än viljestyrka och håller längre.',
    },
    {
      title: 'Planen och livet är överens',
      message:
        '{{months}} månader i följd inom dina gränser. En plan som hålls så väl är inte längre en begränsning — den är hur du lever.',
    },
    {
      title: 'Stadigt i {{months}} månader',
      message:
        'Dina budgetar har hållit i {{months}} månader i rad. Behåll samma uppmärksamhet; den fungerar.',
    },
    {
      title: 'Disciplin, upprätthållen',
      message:
        '{{months}} månader utan att bryta din plan. Få saker är så befriande som att lita på sina egna beslut.',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: 'Dina pengar följer dina värderingar',
      message:
        'Dygd stod för {{actual}}% av utgifterna — inte mindre än planerade {{planned}}%. Väl använt.',
    },
    {
      title: 'Dygd fick hela sin andel',
      message:
        '{{actual}}% på hälsa, lärande och andra, mot {{planned}}% planerat. Det du värdesätter har du betalat för.',
    },
    {
      title: 'Spenderat på att bli bättre',
      message:
        'Dygd nådde {{actual}}% av utgifterna den här månaden (planerat {{planned}}%). De pengarna arbetar för dig långt efter att de är borta.',
    },
    {
      title: 'Avsikten genomförd',
      message:
        'Du planerade {{planned}}% för dygd och spenderade {{actual}}%. Goda avsikter överlever sällan en månad — dina gjorde det.',
    },
    {
      title: 'Den bästa användningen av pengar',
      message: '{{actual}}% gick till det som gör dig och andra bättre. Fortsätt välja det.',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: 'Nöje på sin plats',
      message:
        'Nöje är {{actual}}% av utgifterna, under de {{planned}}% du gav det. Du njuter av saker utan att styras av dem.',
    },
    {
      title: 'Njutning i lagom storlek',
      message:
        'Nöje tog {{actual}}% mot {{planned}}% planerat. Måttfullhet är inte att gå miste om något — det är att välja.',
    },
    {
      title: 'Vila utan överdrift',
      message:
        '{{actual}}% på nöje, under din gräns på {{planned}}%. Njutning smakar bättre när den inte bestämmer.',
    },
    {
      title: 'Måttfullhet, i det tysta',
      message:
        'Du gav nöje {{planned}}% och det använde bara {{actual}}%. Den marginalen är frihet du behöll.',
    },
    {
      title: 'Nöje under plan',
      message:
        'Med {{actual}}% av utgifterna höll sig nöje under de {{planned}}% du satte. Väl hållet.',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: '{{percent}}% under plan',
      message:
        'Du spenderade {{savedAmount}} mindre än du tillät dig den här månaden. Att inte behöva allt man skulle kunna ha är en sorts rikedom.',
    },
    {
      title: '{{savedAmount}} lämnades orörda',
      message:
        'Månaden landade {{percent}}% under planen. Det du inte spenderade kan du fortfarande styra själv.',
    },
    {
      title: 'Mindre än du tillät',
      message:
        'Utgifterna ligger {{percent}}% under planen — {{savedAmount}} behållet. Ge den marginalen ett syfte innan vanan gör anspråk på den.',
    },
    {
      title: 'Planen hade utrymme över',
      message:
        '{{savedAmount}} under dina gränser den här månaden. Återhållsamhet som känns lätt är den som håller.',
    },
    {
      title: 'Lättare än planerat',
      message:
        'Du behövde {{percent}}% mindre än du budgeterat. Fundera på att skicka de {{savedAmount}} till ett mål.',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '”{{goal}}” följer tidsplanen',
      message:
        'Du har kommit {{percent}}% av vägen, i den takt målet kräver. Stadiga steg, tagna varje månad, räcker långt.',
    },
    {
      title: 'På rätt spår mot ”{{goal}}”',
      message: '{{percent}}% klart och takten håller. Fortsätt betala målet först; det fungerar.',
    },
    {
      title: '”{{goal}}”: {{percent}}% och stadigt',
      message: 'Målet får det det behöver varje månad. Tålamodet gör sitt arbete.',
    },
    {
      title: 'Målet rör sig enligt plan',
      message:
        '”{{goal}}” är {{percent}}% finansierat och i tid. Det som görs lite varje månad kan inte stoppas av en dålig vecka.',
    },
    {
      title: 'Framsteg att lita på',
      message:
        '”{{goal}}” står på {{percent}}%, i takt. Du bygger det på det enda sätt som fungerar — gradvis.',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: 'Färre impulsköp hos {{merchant}}',
      message:
        'Från {{before}} köp förra månaden till ungefär {{after}} den här månaden. En vana som lossnat är vunnen frihet.',
    },
    {
      title: '{{merchant}}: {{before}} → {{after}}',
      message:
        'Du går dit mer sällan än förut. Varje överhoppad reflex är en liten seger för valet över vanan.',
    },
    {
      title: 'Den lilla vanan krymper',
      message:
        'Köpen hos {{merchant}} föll från {{before}} till ungefär {{after}}. Fortsätt — det blir lättare.',
    },
    {
      title: 'Val framför reflex',
      message:
        'Hos {{merchant}} gick du från {{before}} köp till ungefär {{after}}. Det är herravälde byggt ett beslut i taget.',
    },
    {
      title: 'Mindre av det lilla',
      message:
        'Hos {{merchant}} ungefär {{after}} gånger i stället för {{before}}. Små segrar växer.',
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: 'Du anpassade dig till en magrare månad',
      message:
        'Inkomsten sjönk {{incomePercent}}%, och du minskade utgifterna med {{expensePercent}}%. Du mötte ett skifte i ödet med ett skifte i kurs.',
    },
    {
      title: 'Fattning när inkomsten sjönk',
      message:
        'Inkomsten ner {{incomePercent}}%, utgifterna ner {{expensePercent}}%. Du anpassade dig efter det som är, inte det som var.',
    },
    {
      title: 'Ödet ändrades; det gjorde du också',
      message:
        'Ett inkomstfall på {{incomePercent}}% möttes av {{expensePercent}}% lägre utgifter. Det är sinnesro i siffror.',
    },
    {
      title: 'Väl styrt',
      message:
        'När inkomsten föll {{incomePercent}}% följde utgifterna efter ({{expensePercent}}% mindre). Vinden var inte din; seglet var det.',
    },
    {
      title: 'Utgifterna följde inkomsten nedåt',
      message:
        'Du spenderade {{expensePercent}}% mindre när inkomsten föll {{incomePercent}}%. Att anpassa sig tidigt är den lugna vägen igenom.',
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: 'Nödvändigheterna är stabila',
      message:
        'I {{months}} månader har dina nödvändiga kostnader knappt rört sig. Ett stabilt golv ger dig frihet ovanför det.',
    },
    {
      title: 'Behoven hålls i schack',
      message:
        'Utgifterna för nödvändigheter har legat stilla i {{months}} månader. Behov som inte växer är behov du styr.',
    },
    {
      title: '{{months}} månader av stabila grundkostnader',
      message:
        'Hyra, mat och räkningar ligger kvar där de var. Tyst stabilitet är också en bedrift.',
    },
    {
      title: 'Ingen smygande ökning i nödvändigheter',
      message:
        '{{months}} månader utan glidning i det livet kräver. Allt annat är lättare att planera på den grunden.',
    },
    {
      title: 'Ett fast golv',
      message:
        'De nödvändiga utgifterna har varit stadiga i {{months}} månader. Du låter inte bekvämligheter utge sig för att vara behov.',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: 'Generös med det du tjänar',
      message:
        'Under {{months}} månader gick {{percent}}% av din inkomst — {{givenAmount}} — till att hjälpa andra. Det är pengar som gör bästa möjliga nytta.',
    },
    {
      title: '{{givenAmount}} gett till andra',
      message:
        'Du delade med dig av {{percent}}% av inkomsten på {{months}} månader. Vänlighet som syns i siffrorna är vänlighet som utövas, inte bara känns.',
    },
    {
      title: 'Öppna händer',
      message:
        'Välgörenhet och gåvor tog {{percent}}% av din inkomst på sistone. Det du ger bort är den del av din rikedom som ingen olycka kan ta.',
    },
    {
      title: 'Generositet är en del av din plan',
      message:
        '{{givenAmount}} till andra under {{months}} månader. Håll fast vid det — det goda du gör för andra gör du också för dig själv.',
    },
    {
      title: 'Väl givet',
      message:
        '{{percent}}% av det du tjänade gick till att hjälpa andra. Få vanor säger mer om en människa.',
    },
  ],
  'stoic.praise_steady': [
    {
      title: 'Inget att rätta till',
      message: 'Dina utgifter stämmer med det du tänkt. Fortsätt som du gör.',
    },
    {
      title: 'Avsikt och handling är överens',
      message:
        'Den här månaden ser ut som du planerade den. Den överensstämmelsen är hela poängen.',
    },
    {
      title: 'En lugn månad',
      message:
        'Inget överflöd, ingen försummelse värd att nämna. Bra gjort — ta med samma uppmärksamhet framåt.',
    },
    {
      title: 'Allt i ordning',
      message: 'Planen höll och inget ber om rättelse. Njut av lugnet du har förtjänat.',
    },
    {
      title: 'Stadig hand',
      message: 'Månaden följde din plan. Goda vanor får goda månader att se vardagliga ut.',
    },
  ],
  'expert.pay_yourself_first': [
    {
      title: 'Betala dig själv först',
      message:
        'George S. Clasons regel: en del av allt du tjänar är ditt att behålla — minst en tiondel. Under {{months}} månader behöll du {{savingsPercent}}%. Sätt undan {{tenthAmount}} samma dag som inkomsten kommer, före allt annat.',
    },
    {
      title: 'En tiondel är din att behålla',
      message:
        'I Den rikaste mannen i Babylon är det första botemedlet mot en mager börs att behålla ett mynt av tio. Din sparkvot är {{savingsPercent}}%; {{tenthAmount}} i månaden skulle starta vanan.',
    },
    {
      title: 'Spara innan du spenderar, inte efter',
      message:
        'Clasons råd är enkelt: betala dig själv först. På senare tid har {{savingsPercent}}% av inkomsten stannat hos dig. Flytta undan {{tenthAmount}} på lönedagen och låt utgifterna anpassa sig efter det som blir kvar.',
    },
    {
      title: 'Det första myntet är ditt',
      message:
        'En del av allt du tjänar bör stanna hos dig — inte mindre än en tiondel, säger Clason. Du behöll {{savingsPercent}}% under {{months}} månader. Börja med {{tenthAmount}} i månaden, automatiskt.',
    },
    {
      title: '{{savingsPercent}}% sparat — regeln säger 10%',
      message:
        'Betala dig själv först, som det heter i Den rikaste mannen i Babylon: {{tenthAmount}} i månaden, undanlagt före varje räkning. Sparande som görs först beror inte på vad som blir över.',
    },
  ],
  'expert.rule_50_30_20': [
    {
      title: 'Din 50/30/20-koll',
      message:
        'Elizabeth Warren och Amelia Warren Tyagi föreslår 50% av inkomsten efter skatt till måsten, 30% till önskemål och 20% till sparande. Din fördelning: {{needsPercent}}% / {{wantsPercent}}% / {{savingsPercent}}%.',
    },
    {
      title: 'Behov {{needsPercent}}%, önskemål {{wantsPercent}}%, sparande {{savingsPercent}}%',
      message:
        'All Your Worth fördelar pengar enligt 50/30/20. Jämför den post som ligger längst från sitt mål med din plan — där gör en enda ändring mest nytta.',
    },
    {
      title: 'Så fördelas din inkomst',
      message:
        'Måsten tar {{needsPercent}}% av inkomsten, önskemål {{wantsPercent}}%, och {{savingsPercent}}% sparas. Balansen 50/30/20 från All Your Worth är en användbar spegel, inte en dom.',
    },
    {
      title: 'Formeln för balanserad ekonomi',
      message:
        'Warren och Tyagis formel: hälften till det du måste betala vad som än händer, 30% till önskemål, 20% till framtiden. Du ligger på {{needsPercent}}/{{wantsPercent}}/{{savingsPercent}}.',
    },
    {
      title: 'Jämfört med 50/30/20',
      message:
        'Din fördelning är {{needsPercent}}% måsten, {{wantsPercent}}% önskemål, {{savingsPercent}}% sparande. Bokens test för ett måste: skulle du fortfarande betala det om du förlorade jobbet i morgon?',
    },
  ],
  'expert.room_for_error': [
    {
      title: 'Lämna utrymme för misstag',
      message:
        'Morgan Housels råd: planera för att saker inte går enligt plan. Ditt saldo täcker ungefär {{cushionDays}} dagars utgifter; ett vanligt riktmärke är tre månader — {{targetAmount}}.',
    },
    {
      title: 'En buffert på {{cushionDays}} dagar',
      message:
        'The Psychology of Money kallar det utrymme för misstag — marginal som låter dig klara överraskningar. Att bygga mot {{targetAmount}}, tre månaders utgifter, ger planen en chans att överleva verkligheten.',
    },
    {
      title: 'Säkerhetsmarginal, hemma',
      message:
        'Housel lånar Grahams säkerhetsmarginal till den privata ekonomin. Med {{cushionDays}} dagars utgifter i reserv kan en enda dålig månad rasera en bra plan. Sikta på {{targetAmount}}.',
    },
    {
      title: 'Utrymme för det oväntade',
      message:
        'Din reserv skulle räcka ungefär {{cushionDays}} dagar. Överraskningar är det enda säkra; tre månaders utgifter ({{targetAmount}}) är ett vanligt mål.',
    },
    {
      title: 'Bygg marginal innan du behöver den',
      message:
        'Utrymme för misstag är, med Morgan Housels ord, det som håller dig kvar i spelet. Du har ungefär {{cushionDays}} dagar täckta; {{targetAmount}} skulle täcka tre månader.',
    },
  ],
  'expert.lifestyle_creep': [
    {
      title: 'Utgifterna springer ifrån inkomsten',
      message:
        'Utgifterna ökade {{expenseGrowth}}% under senaste kvartalet medan inkomsten förändrades {{incomeGrowth}}%. Första regeln i The Millionaire Next Door: vad din inkomst än är, lev under dina tillgångar.',
    },
    {
      title: 'Lever flottare, inte rikare',
      message:
        'Stanley och Danko kom fram till att förmögenhet är det du samlar på dig, inte det du spenderar. Dina utgifter växte {{expenseGrowth}}%, inkomsten {{incomeGrowth}}% — i glappet läcker förmögenheten ut.',
    },
    {
      title: 'Livsstilsinflation: +{{expenseGrowth}}%',
      message:
        'Utgifterna steg snabbare än inkomsten ({{incomeGrowth}}%). Människorna i The Millionaire Next Door förblev förmögna genom att låta inkomsten stiga utan att låta utgifterna följa efter.',
    },
    {
      title: 'Målstolparna flyttar sig',
      message:
        'Utgifterna har ökat {{expenseGrowth}}% jämfört med förra kvartalet, mot {{incomeGrowth}}% för inkomsten. Lev under dina tillgångar, säger Stanley och Danko — vilka tillgångarna än är.',
    },
    {
      title: 'Förmögenhet är det du behåller',
      message:
        'En god inkomst som spenderas helt gör ingen rikare. Under senaste kvartalet växte dina utgifter {{expenseGrowth}}% och inkomsten {{incomeGrowth}}% — värt en titt innan det blir det nya normala.',
    },
  ],
  'expert.life_energy': [
    {
      title: '{{merchant}} kostade {{hours}} timmar av ditt liv',
      message:
        'Vicki Robin och Joe Dominguez föreslår att man prissätter saker i livsenergi — de arbetstimmar de kostar. {{totalAmount}} hos {{merchant}} den här månaden motsvarar ungefär {{hours}} timmar. Var det värt det?',
    },
    {
      title: '{{hours}} timmar hos {{merchant}}',
      message:
        'Your Money or Your Life ber dig se pengar som den tid du bytt mot dem. Med din genomsnittliga timinkomst motsvarar {{totalAmount}} där ungefär {{hours}} arbetstimmar.',
    },
    {
      title: 'Räkna priset i timmar',
      message:
        '{{totalAmount}} hos {{merchant}} är ungefär {{hours}} timmars arbete. Robin och Dominguez kallar det livsenergi — den enda valuta du inte kan tjäna tillbaka.',
    },
    {
      title: 'Vad {{merchant}} verkligen kostade',
      message:
        'Pengar är något vi byter vår livsenergi mot. Den här månaden tog {{merchant}} ungefär {{hours}} av dina timmar ({{totalAmount}}). Står nöjet i proportion till timmarna?',
    },
    {
      title: 'Koll på livsenergin',
      message:
        'Omräknat med din genomsnittliga timinkomst är {{totalAmount}} hos {{merchant}} ungefär {{hours}} timmar. Your Money or Your Life föreslår att du frågar dig om det gav tillfredsställelse i proportion till det.',
    },
  ],
};
