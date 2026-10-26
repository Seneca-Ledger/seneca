import type { StoicTextMap } from './types';

export const fo: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: 'Mánaðurin vaks út um ætlan sína',
      message:
        'Tú ætlaði {{plannedAmount}} og hevur brúkt {{spentAmount}} — {{percent}} % meira. Ætlanin varð gjørd við greiðum huga; lat hana tala harðari enn eygnabliðið.',
    },
    {
      title: '{{percent}} % yvir tað tú ætlaði at brúka',
      message:
        'Útgjøldini standa á {{spentAmount}} móti eini ætlan um {{plannedAmount}}. Hygg at hvat mark gav seg fyrst — har liggur lærdómurin.',
    },
    {
      title: 'Ætlan tín og mánaðurin eru ósamdir',
      message:
        '{{spentAmount}} brúkt, {{plannedAmount}} ætlað. Antin kravdi ætlanin ov lítið av veruleikanum, ella veruleikin ov mikið av tær — avger í ró hvat.',
    },
    {
      title: 'Meira fór út enn tú loyvdi',
      message:
        'Mánaðurin er {{percent}} % yvir teimum {{plannedAmount}} tú setti. Einki er tapt við at steðga nú; mikið er tapt við at læta sum tað ikki hendi.',
    },
    {
      title: 'Eitt mark tú setti, eitt mark tú fórt yvir',
      message:
        'Tú ætlaði at brúka {{plannedAmount}}; tað er {{spentAmount}}. Sjálvsstýring er ikki at aldri skriða — tað er at merkja tað tíðliga og venda aftur til leiðina.',
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: 'Frítíð tekur meira enn tú ætlaði',
      message:
        'Tú ætlaði frítíðina at vera {{planned}} % av útgjøldunum; henda mánaðin er hon {{actual}} %. Nøgdsemi er vælkomin sum gestur, ikki sum húsharri.',
    },
    {
      title: 'Frítíð á {{actual}} %, ætlað {{planned}} %',
      message:
        'Hvíld fortænir pláss sítt tá hon endurnýggjar tíg. Spyr hvørjar nøgdsemirnar hjá mánaðinum gjørdu tað, og slepp restini uttan eftirsjón.',
    },
    {
      title: 'Trivnaður brúkar meira enn ætlanin',
      message:
        'Frítíðin heldur {{actual}} % av útgjøldunum móti teimum {{planned}} % tú valdi. Mátahald er ikki at nokta nøgdsemi — tað er at halda hana í tí støddini tú avgjørdi.',
    },
    {
      title: 'Tað væl hóskandi trýstir tað ætlaða burtur',
      message:
        'Tú gav frítíðini {{planned}} % av ætlanini, og hon tók {{actual}} %. Tað tú nýtur uttan møði er verd eitt nýtt eygnakast, áðrenn tað verður tað tú hevur brúk fyri.',
    },
    {
      title: 'Frítíðin hevur stigið yvir linjuna',
      message:
        '{{actual}} % av mánaðinum fóru til frítíð, {{planned}} % var ætlanin. Linjan var tín at teikna, og hon er tín at halda.',
    },
  ],
  'stoic.leisure_habit': [
    {
      title: 'Frítíð yvir ætlan aftur',
      message:
        'Frítíðin fór út um ætlan tína í {{months}} av seinastu {{window}} mánaðunum. Ein endurtaking er ikki longur eitt óhapp — tað er ein vani verdur at kanna.',
    },
    {
      title: '{{months}} av {{window}} mánaðum yvir frítíðarætlanina',
      message:
        'Tað sum hendir eina ferð, er umstøður; tað sum hendir {{months}} ferðir, er lyndi í mótan. Vel lyndið við vilja.',
    },
    {
      title: 'Sama misstig, mánað eftir mánað',
      message:
        'Frítíðin rann frá ætlanini í {{months}} av {{window}} mánaðum. Hev ætlanina ærliga ella broyt vanan — at liva millum tey tvey kostar mest.',
    },
    {
      title: 'Eitt mynstur, ikki eitt undantak',
      message:
        'Í {{months}} av seinastu {{window}} mánaðunum tók frítíðin meira enn tú gav henni. Legg til merkis eygnabliðið tá avgerðin verður tikin, ikki bert rokningina aftaná.',
    },
    {
      title: 'Vanin velur móti ætlan tíni',
      message:
        'Frítíðin vann yvir ætlanina {{months}} ferðir á {{window}} mánaðum. Vanar verða bygdir eitt val í senn; soleiðis verða teir eisini niðurbrotnir.',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: 'Dygd fær minni enn tú ætlaði',
      message:
        'Tú setti {{planned}} % av fíggjarætlanini til síðuna til heilsu, læring og onnur; higartil er tað {{actual}} %. Ein ætlan telur tá hon er framd.',
    },
    {
      title: 'Dygd á {{actual}} % av ætlaðu {{planned}} %',
      message:
        'Pengarnir tú ætlaði til tað sum ger tíg betri bíða enn. Tað er ikki betri tíð at brúka teir væl enn henda mánaðin.',
    },
    {
      title: 'Tað góða tú ætlaði er óbrúkt',
      message:
        'Heilsa, læring og gávumildi skuldu fáa {{planned}} % av útgjøldunum; tey fingu {{actual}} %. Ger eitt av teimum hesa vikuna, við vilja.',
    },
    {
      title: 'Ætlan uttan gerð',
      message:
        'Dygd heldur {{actual}} % av útgjøldunum móti teimum {{planned}} % tú valdi. Tað vit virða, sýnir seg í tí vit veruliga gjalda fyri.',
    },
    {
      title: 'Tað er pláss eftir til tað sum telur',
      message:
        'Bert {{actual}} % fóru til dygd, hóast tú ætlaði {{planned}} %. Ein bók, ein heilsukanning, ein gáva til ein sum hevur brúk — ætlanin hevur longu sagt ja.',
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: 'Dygd verður framhaldandi sett út',
      message:
        'Útgjøld til heilsu, læring og onnur hava ligið undir ætlan tíni {{months}} mánaðir í røð. Tað tú heldur fram at seta út, hevur tú í veruleikanum avgjørt ímóti.',
    },
    {
      title: '{{months}} mánaðir av útsettari dygd',
      message:
        'Hvønn mánað gav ætlanin pláss til tað sum ger tíg betri, og hvønn mánað varð tað óbrúkt. Tíð er tað eina tú ikki kanst ætla tvær ferðir.',
    },
    {
      title: 'Tað betri sjálvið bíðar framvegis',
      message:
        'Dygd hevur ligið undir ætlan {{months}} mánaðir í røð. Byrja lítið og vist heldur enn stórt og seinna.',
    },
    {
      title: 'Góðar ætlanir eldast',
      message:
        'Í {{months}} mánaðir fingu heilsa, læring og gávumildi minni enn tú ætlaði. Vel eina og fíggja hana fyrst næsta mánað, fyri øllum øðrum.',
    },
    {
      title: 'Dygd tapar støðugt fyri „seinna“',
      message:
        '{{months}} mánaðir í røð undir ætlan. Seinna er staðurin hvar góðar ætlanir fara at gloymast — gev hesari eina dagfesting.',
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: 'Ætlan tín hevur einki pláss fyri dygd',
      message:
        'Ongin av fíggjarætlanunum tínum tænar heilsu, læring ella onnur. Ein ætlan vísir hvat vit virða — hugsa um at geva dygd sína egnu linju.',
    },
    {
      title: 'Allar ætlanir, men ongin til tað góða',
      message:
        'Neyðsyn, arbeiði og frítíð hava øll mark; dygd hevur einki. Tað sum ongantíð verður ætlað, hendir vanliga ikki.',
    },
    {
      title: 'Ætla fyri tí sum ger tíg betri',
      message:
        'Tað er onki fíggjarætlan í dygdarflokkinum enn. Sjálvt ein lítil — bøkur, sport, eitt stuðul — broytir eitt ynski til eina bindandi avgerð.',
    },
    {
      title: 'Ætlanin tigur um dygd',
      message:
        'Tú ætlar fyri tí tú mást og tí tú nýtur, ikki enn fyri tí tú vilt verða. Ein beskeðin dygdarætlan hevði broytt tað.',
    },
    {
      title: 'Dygd hevur onki fíggjarætlan',
      message:
        'Útgjøld til heilsu, læring ella onnur eru ikki ætlað nakrastaðni. Vel eitt og gev tí eitt mark tú hevði verið glaður at nátt.',
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: 'Neyðsynjar kosta meira enn ætlað',
      message:
        'Tú ætlaði {{planned}} % av útgjøldunum til neyðsynjar; tey taka {{actual}} %. Kanna um hvørt er framvegis ein tørvur ella í stillheit er vorðið ein trivnaður.',
    },
    {
      title: 'Neyðsyn á {{actual}} %, ætlað {{planned}} %',
      message:
        'Tað lívið krevur, er vanliga minni enn tað vit venja okkum við. Far ígjøgnum størstu neyðsynina við ferskum eygum.',
    },
    {
      title: 'Tað neyðuga svellir',
      message:
        'Neyðsynjar halda {{actual}} % av mánaðinum móti teimum {{planned}} % tú vænti. Ein tørvur sum heldur fram at vaksa, fortænir eitt spurning.',
    },
    {
      title: 'Tørvirnir vaksa út um ætlanina',
      message:
        'Ætlað {{planned}} %, veruligt {{actual}} %. Antin undirmat ætlanin veruligu kostnaðirnar, ella nøkur ynski ferðast undir navni av tørvi.',
    },
    {
      title: 'Meira brúkt á „mást“ enn ætlað',
      message:
        'Neyðsynjar tóku {{actual}} % av útgjøldunum í staðin fyri {{planned}} %. Skil tað sum veruliga mást vera frá tí sum bert altíð hevur verið.',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: 'Neyðsynjar krøkja uppeftir',
      message:
        'Útgjøld til neyðsynjar eru stigin {{months}} mánaðir í røð, {{percent}} % í alt. Tørvir vaksa í stillheit tá ongin biður tey rættvísgera seg.',
    },
    {
      title: '+{{percent}} % á neyðsynjum í {{months}} mánaðum',
      message:
        'Hvørt stig tókti lítið; saman eru tey tað ikki. Tak størstu endurtaknu neyðsynina og spyr um hon framvegis má kosta so mikið.',
    },
    {
      title: 'Golvið í útgjøldunum tínum stígur',
      message:
        'Neyðsynjar vuksu {{months}} mánaðir í røð (+{{percent}} %). Eitt stígandi golv letur minni pláss eftir til alt tú velur frítt.',
    },
    {
      title: 'Tørvirnir víðka seg',
      message:
        '{{months}} mánaðir av vøkstri, {{percent}} % í alt. Tann stoiska royndin er einkul: hevði tú valt hetta aftur í dag, við prísinum kendum?',
    },
    {
      title: 'Smáar økingar, støðug kós',
      message:
        'Neyðsynjar eru upp {{percent}} % yvir {{months}} mánaðir. Kósin merkir meira enn nakar einstakur mánaður — hendan er verd at rætta tíðliga.',
    },
  ],
  'stoic.work_over_plan': [
    {
      title: 'Arbeiði kostar meira enn ætlað',
      message:
        'Tú ætlaði {{planned}} % av útgjøldunum til arbeiði; tað tekur {{actual}} %. Tól og tænastur mugu gera seg fortænt — kanna hvat ger tað.',
    },
    {
      title: 'Arbeiðsútgjøld á {{actual}} %, ætlað {{planned}} %',
      message:
        'Íløga í arbeiðinum er góð tá hon gevur nakað aftur. Far ígjøgnum hvat tú gjaldar fyri men ikki longur brúkar.',
    },
    {
      title: 'Arbeiðsætlanin er strekt',
      message:
        'Arbeiði tók {{actual}} % í staðin fyri {{planned}} %. Dugnaskapur er at gera arbeiðið væl, ikki at keypa hvørt tól til tess.',
    },
    {
      title: 'Tól brúka meira enn ætlanin',
      message:
        'Ætlað {{planned}} %, brúkt {{actual}} % á arbeiði. Spyr hvørt útgjald: hjálpir tað mær at gera arbeiðið, ella kennist tað bert sum framgongd?',
    },
    {
      title: 'Arbeiðskostnaðirnir hava gliðið',
      message:
        'Arbeiði heldur {{actual}} % av útgjøldunum móti {{planned}} % ætlaðum. Ein skjót kanning nú sparar eina størri seinna.',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '„{{category}}“ brýtur mark sítt aftur og aftur',
      message:
        '„{{category}}“ fór yvir ætlan í {{months}} av seinastu {{window}} mánaðunum. Antin er markið skeivt ella ynskið er — avger hvat.',
    },
    {
      title: '„{{category}}“: yvir ætlan {{months}} av {{window}} mánaðum',
      message:
        'Eitt mark sum altíð verður farið yvir, er onki mark, bert eitt ynski. Ger tað ærligt — hev tað við vilja ella hald tað við vilja.',
    },
    {
      title: 'Sama ætlan gevur seg aftur',
      message:
        '„{{category}}“ hevur farið yvir mark sítt {{months}} ferðir á {{window}} mánaðum. Endurtakingin er upplýsing; nýt hana.',
    },
    {
      title: '„{{category}}“ biður um ans tín',
      message:
        'Yvir ætlan í {{months}} av {{window}} mánaðum. Fylg við eygnabliðinum fyri keypið — tað er tann einasti staðurin hvar vanin kann broytast.',
    },
    {
      title: 'Eitt mynstur í „{{category}}“',
      message:
        '{{months}} yvirstigingar á {{window}} mánaðum. Tað vit endurtaka, verða vit; avger hvat tú vilt at hesin bólkurin sigur um tíg.',
    },
  ],
  'stoic.budget_pace': [
    {
      title: '„{{category}}“ tømist um dag {{day}}',
      message:
        'Tú hevur brúkt {{spentAmount}} av {{limitAmount}}, og við hesari ferð endar markið um dag {{day}}. At minka ferðina nú er lættari enn at steðga seinna.',
    },
    {
      title: '„{{category}}“ er fyri framman mánaðin',
      message:
        '{{spentAmount}} eru longu farin av einum marki á {{limitAmount}}. Við hesari ferð er tað uppbrúkt um dag {{day}} — restin av mánaðinum er framvegis tín at móta.',
    },
    {
      title: 'Ferðarkanning: „{{category}}“',
      message:
        'Ætlanin á {{limitAmount}} heldur til um dag {{day}} við verandi ferð. Framsýni er tann billigasti slagið av sjálvsstýring.',
    },
    {
      title: '„{{category}}“ brúkar framtíðina',
      message:
        '{{spentAmount}} av {{limitAmount}} brúkt; markið endar nær dag {{day}}. Tað tú gert hesa vikuna, avger um tað hendir.',
    },
    {
      title: 'Tíðlig ávaring fyri „{{category}}“',
      message:
        'Við verandi ferð røkkur markið á {{limitAmount}} ikki mánaðarenda — tað tømist um dag {{day}}. Stilla av meðan tað kostar lítið.',
    },
  ],
  'stoic.budget_unused': [
    {
      title: '„{{category}}“ hevur stáið óbrúkt',
      message:
        'Ætlanin fyri „{{category}}“ hevur ikki havt útgjøld í {{months}} mánaðir. Antin ert tú vaksin úr henni, ella hon er ein ætlan sum framvegis bíðar — avger hvat.',
    },
    {
      title: 'Ein tóm ætlan: „{{category}}“',
      message:
        '{{months}} mánaðir uttan eitt einasta útgjald. Ein ætlan eigur at greina frá tí lívi tú livir ella tí tú byggir — hvat er hetta?',
    },
    {
      title: '„{{category}}“ stendur stillt',
      message:
        'Einki brúkt her í {{months}} mánaðir. Var tað afturhald, væl gjørt; var tað vanræksla, ger nakað við tað.',
    },
    {
      title: 'Ætlað, men ikki livað',
      message:
        '„{{category}}“ hevur havt eitt mark og ongar útgjøld í {{months}} mánaðir. Hald ætlanina sanna: tak hana av ella nýt hana.',
    },
    {
      title: '„{{category}}“: {{months}} stillir mánaðir',
      message:
        'Ein ætlan sum ongantíð verður rørd, tekur framvegis pláss í ætlan tíni. Frígev plássið ella æra ætlanina.',
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: '{{percent}} % av útgjøldunum hava onki mark',
      message:
        '{{unbudgetedAmount}} henda mánaðin fóru til bólkar sum ongin ætlan vaktar. Tað sum ikki verður mátað, er torført at ráða við.',
    },
    {
      title: 'Mikið av mánaðinum er óætlað',
      message:
        '{{percent}} % av útgjøldunum — {{unbudgetedAmount}} — liggja uttan fyri hvørja ætlan. Gev størsta partinum eitt mark, og ætlanin sær meira av lívi tínum.',
    },
    {
      title: 'Útgjøld uttan fyri ætlanina',
      message:
        'Ætlanirnar dekka bert ein part av tí tú brúkar; {{unbudgetedAmount}} ({{percent}} %) verða ómátað. Víðka ætlanina hagar pengarnir veruliga fara.',
    },
    {
      title: 'Ætlanin sær bert ein part av myndini',
      message:
        '{{percent}} % av útgjøldunum henda mánaðin hava onki ætlan. Greitt sjón kemur fyri góða dómsgreinu.',
    },
    {
      title: '{{unbudgetedAmount}} brúkt uttan mark',
      message:
        'Tað eru {{percent}} % av mánaðinum. Tú mást ikki avmarka tað — bert avgera hvussu mikið av tí tú veruliga vilt.',
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '„{{category}}“ er tað mesta av frítíð tíni',
      message:
        '{{percent}} % av frítíðarútgjøldum fóru til „{{category}}“. Fjølbroytni í hvíld er sunnari enn at vera upp á eina nøgdsemi.',
    },
    {
      title: 'Ein nøgdsemi ræður',
      message:
        '„{{category}}“ tekur {{percent}} % av øllum tú brúkti á frítíð. Spyr um hon framvegis gleðir tíg ella er vorðin rútina.',
    },
    {
      title: 'Frítíðin hallar seg at „{{category}}“',
      message:
        '{{percent}} % av frítíðini á einum staði. Tað vit ikki klára okkum uttan, hevur tak í okkum — kanna at takið framvegis er lætt.',
    },
    {
      title: '„{{category}}“: {{percent}} % av frítíðini',
      message:
        'Ein einasta keldu til gleði tekur næstan alt. Royn eina billigari, aðra nøgdsemi henda mánaðin og samanber.',
    },
    {
      title: 'Hvíldin tín hevur eina adressu',
      message:
        'Tað mesta av frítíðarpengunum — {{percent}} % — fer til „{{category}}“. Frælsi er eisini at kunna njóta annað.',
    },
  ],
  'stoic.unclassified': [
    {
      title: 'Nøkur útgjøld eru enn ikki mett',
      message:
        '{{count}} bólkar hava ongan flokk. Avger í Fíggjarætlanum hvat er neyðsyn, arbeiði, dygd ella frítíð.',
    },
    {
      title: '{{count}} bólkar bíða dómi tínum',
      message:
        'Teir hava útgjøld men ongan flokk, so ráðini kunnu ikki vega teir. Ein minuttur í Fíggjarætlanum avger tað.',
    },
    {
      title: 'Gev navn til tað pengarnir tæna',
      message:
        '{{count}} bólkar eru framvegis óflokkaðir. Dómsgreina byrjar við at kalla ting við røttum nøvnum.',
    },
    {
      title: 'Ómett útgjøld: {{count}} bólkar',
      message:
        'Er tað ein tørvur, arbeiðið títt, ein dygd ella ein nøgdsemi? Bert tú kanst siga tað — og ætlanin verður greiðari tá tú gert tað.',
    },
    {
      title: 'Nøkur bólkar hava ongan flokk',
      message:
        '{{count}} bólkar standa uttan fyri teir fýra flokkarnar. Flokka teir í Fíggjarætlanum, so hvørt útgjald verður sæð sum tað er.',
    },
  ],
  'stoic.small_purchases': [
    {
      title: '{{count}} smá keyp hjá {{merchant}}',
      message:
        'Hvørt tókti smávegis; saman vórðu tey {{totalAmount}} henda mánaðin. Smáir, ókannaðir vanar eru har tað mesta av pengunum í stillheit fer.',
    },
    {
      title: '{{merchant}}: {{count}} ferðir henda mánaðin',
      message:
        '{{totalAmount}} í smáum summum. Spyr um hvørt vitjan var eitt val ella ein viðbragd — bert tað fyrra er frælsi.',
    },
    {
      title: 'Lítið og lítið: {{totalAmount}}',
      message:
        '{{count}} keyp hjá {{merchant}}. Onki einstakt merkir nakað; vanin ger. Avger hvussu ofta tú veruliga vilt tað.',
    },
    {
      title: 'Ein vani hjá {{merchant}}',
      message:
        '{{count}} keyp, {{totalAmount}} tilsamans. Royn at leypa um hvørt triðja henda mánaðin og sí um tú saknar tað.',
    },
    {
      title: 'Tey smáu tingini leggjast saman',
      message:
        '{{merchant}} sá tíg {{count}} ferðir, fyri {{totalAmount}}. Ráð á stórum avgerðum verður bygt á smáar sum hesar.',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: 'Vikuskiftini bera {{percent}} % av frítíðini',
      message:
        'Tað mesta av frítíðarútgjøldunum tínum hendir hósdag og sunnudag. Hvíld er góð; kanna at tað er hvíld og ikki uppbót fyri vikuna.',
    },
    {
      title: 'Frítíðin livir í vikuskiftinum',
      message:
        '{{percent}} % av frítíðarútgjøldunum falla í vikuskiftið. Ætla vikuskiftið eitt vet, og tað kostar minni og gevur meira.',
    },
    {
      title: 'Vikuskiftið gjaldar fyri vikuna',
      message:
        'Vikuskiftini taka {{percent}} % av tí tú brúkar á frítíð. Um vikan skal lagast hvønn hósdag, hygg at vikuni.',
    },
    {
      title: 'Hósdagur og sunnudagur: {{percent}} % av frítíðini',
      message:
        'Fríir dagar bjóða frí útgjøld. Avger fyri vikuskiftið hvat tað er til, og lat pengarnar fylgja.',
    },
    {
      title: 'Eitt vikuskiftismynstur',
      message:
        '{{percent}} % av frítíðarútgjøldunum hendir í vikuskiftinum. Lættari vikudagar gera ofta vikuskiftini billigari.',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}} tók {{percent}} % av mánaðinum',
      message:
        '{{totalAmount}} fóru til ein handil til frítíð. Tá ein staður hevur so mikið av pengunum tínum, spyr hvussu mikið av ansi tínum hann eisini hevur.',
    },
    {
      title: 'Ein staður, {{totalAmount}}',
      message:
        '{{merchant}} er {{percent}} % av útgjøldunum henda mánaðin. Er tað tann parturin av lívsverki tínum verd?',
    },
    {
      title: '{{merchant}} leiðir útgjøld tín',
      message:
        '{{percent}} % av mánaðinum — {{totalAmount}} — fóru hagar. Einki galið í at njóta tað, so leingi tú hevði valt tað aftur.',
    },
    {
      title: 'Ein stórur partur hjá {{merchant}}',
      message:
        '{{totalAmount}}, ella {{percent}} % av útgjøldunum, á einum frítíðarstaði. Veg nøgdsemina móti prísinum, í ró.',
    },
    {
      title: '{{percent}} % hjá {{merchant}}',
      message:
        'Hesin eini handilin tók {{totalAmount}}. Frælsi er at kunna gá framvið tá tú velur tað.',
    },
  ],
  'stoic.income_drop': [
    {
      title: 'Inntøkan fall, útgjøldini ikki',
      message:
        'Inntøkan fall {{percent}} % til {{incomeAmount}}, men útgjøldini stóðu á {{expenseAmount}}. Lukkan broytti hug; útgjøldini tín hava ikki merkt tað enn.',
    },
    {
      title: 'Inntøkan niður {{percent}} %',
      message:
        '{{incomeAmount}} komu inn móti {{expenseAmount}} út. Tað lukkan gevur, kann hon taka aftur — stilla útgjøldini til tað sum er, ikki tað sum var.',
    },
    {
      title: 'Ein knappari mánaður, teir somu vanarnir',
      message:
        'Inntøkan er {{percent}} % lægri ({{incomeAmount}}), meðan útgjøldini hildu seg á {{expenseAmount}}. Inntøkan er ikki í tínum valdi; svarið er.',
    },
    {
      title: 'Lukkan flutti seg',
      message:
        'Tú vann {{percent}} % minni enn vanligt, men brúkti {{expenseAmount}} sum fyrr. Skar niður nú, meðan tað er eitt val og ikki ein neyðsyn.',
    },
    {
      title: 'Útgjøldini hava ikki fylgt inntøkuni',
      message:
        'Inntøkan fall til {{incomeAmount}} ({{percent}} % niður); útgjøldini eru {{expenseAmount}}. Set seglið eftir tí vindi tú veruliga hevur.',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: 'Hald: {{monthlyAmount}} um mánaðin',
      message:
        '{{count}} hald taka {{percent}} % av mánaðarligu útgjøldunum tínum. Hvørt verður endurnýggjað uttan at spyrja tíg — spyr sjálvur um hvørt.',
    },
    {
      title: '{{percent}} % av útgjøldunum endurnýggja seg sjálv',
      message: '{{count}} hald, {{monthlyAmount}} um mánaðin. Hald tey tú hevði tekið aftur í dag.',
    },
    {
      title: 'Stillt, endurtakið, {{monthlyAmount}}',
      message:
        '{{count}} hald kosta {{percent}} % av mánaðinum tínum. Lættleiki er ein góður tænari og ein dýrur harri.',
    },
    {
      title: '{{count}} hald at endurskoða',
      message:
        'Tilsamans eru tey {{monthlyAmount}} um mánaðin, {{percent}} % av útgjøldunum. Sig upp eitt tú næstan ikki brúkar, og merk hvussu lítið tú saknar tað.',
    },
    {
      title: 'Tað sum endurnýggjar seg sjálvt',
      message:
        '{{monthlyAmount}} um mánaðin á {{count}} haldum. Sjálvvirkandi útgjøld fortæna eina viljandi endurskoðan.',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: 'Framgongd tín kundi rakt eitt vet longri',
      message:
        'Yvir {{months}} mánaðir helt tú {{savingsPercent}} % av inntøkuni, men næstan einki av tí fór til onnur. Ríkidømi sitir best í opnum hondum — kanska ein gáva ella eitt stuðul henda mánaðin?',
    },
    {
      title: 'Vinnur væl, gevur lítið',
      message:
        '{{incomeAmount}} komu inn yvir {{months}} mánaðir og {{givenAmount}} fóru til onnur. Hjálpir tú á mátar hetta appið ikki sær, so síggj burtur frá hesum; um ikki, hevur ætlanin pláss fyri tí.',
    },
    {
      title: 'Eitt gott ár at vera gávumildur',
      message:
        'Tú sparti {{savingsPercent}} % av inntøkuni — tekin um eina støðuga hond. Ein lítil partur av tí, givin einum sum hevur brúk, hevði gjørt støðugleikan meira verdan.',
    },
    {
      title: 'Ongin annar á myndini enn',
      message:
        'Seinastu {{months}} mánaðirnir vísa varug inntjening og sparing, men onga góðgerð ella gávur. Vit eru gjørd hvør fyri annan; ein beskeðin gáva nøktar at byrja.',
    },
    {
      title: 'Pláss fyri góðsku',
      message:
        'Bert {{givenAmount}} av {{incomeAmount}} fóru til at hjálpa øðrum. Hugsa um eitt lítið, fast stuðul — gávumildi verður lættari við vana, sum hvør dygd.',
    },
  ],
  'stoic.goal_behind': [
    {
      title: '„{{goal}}“ dregst aftur',
      message:
        'Tað krevur {{requiredAmount}} um mánaðin, og tú leggur inn um {{paceAmount}}. Við hesari ferð kemur tað {{monthsLate}} mánaðir ov seint.',
    },
    {
      title: '„{{goal}}“: {{monthsLate}} mánaðir seint við hesari ferð',
      message:
        'Kravt {{requiredAmount}} um mánaðin, veruligt um {{paceAmount}}. Flyt dagfestingina ærliga ella flyt meiri pengar viljandi.',
    },
    {
      title: 'Málið og ferðin eru ósamd',
      message:
        '„{{goal}}“ biður um {{requiredAmount}} um mánaðin; tað fær {{paceAmount}}. Eitt mál er bert so veruligt sum tað mánaðarliga stigið móti tí.',
    },
    {
      title: '„{{goal}}“ hevur brúk fyri einum fastari stigi',
      message:
        '{{paceAmount}} um mánaðin móti teimum {{requiredAmount}} tað krevur. Gjald málinum fyrst næsta mánað, fyri øllum valfríum.',
    },
    {
      title: 'Aftanfyri á „{{goal}}“',
      message:
        'Verandi ferð ({{paceAmount}}/mánað) letur tað {{monthsLate}} mánaðir seint. Smáar økingar nú vinna yvir stórar ofrur seinna.',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: '„{{goal}}“ hóskar ikki í ætlanina',
      message:
        'Tað krevur {{requiredAmount}} um mánaðin, men eftir fíggjarætlanunum tínum eru bert {{freeAmount}} fríar. Broyt dagfestingina, málið ella ætlanirnar — at vóna er onki ætlan.',
    },
    {
      title: '„{{goal}}“ biður um meira enn tú hevur frítt',
      message:
        '{{requiredAmount}} krevst hvønn mánað, {{freeAmount}} tøkt. At vilja alt í senn er hvussu einki verður gjørt; vel.',
    },
    {
      title: 'Tølini siga nei — í bilið',
      message:
        '„{{goal}}“ krevur {{requiredAmount}} um mánaðin; fríi peningurin tín er {{freeAmount}}. Stilla tað sum er í tínum valdi: freistina ella hinar markirnar.',
    },
    {
      title: '„{{goal}}“ krevur eina avgerð',
      message:
        'Við {{requiredAmount}} um mánaðin fer tað yvir tey {{freeAmount}} sum eru eftir fíggjarætlanunum. Eitt mál valt við opnum eygum er betri enn eitt hildið við ynskishugsan.',
    },
    {
      title: 'Ein ógjørlig ferð fyri „{{goal}}“',
      message:
        'Kravt {{requiredAmount}} mánaðarliga, frítt {{freeAmount}}. Ærlig rokning nú sparar vónbrot seinna.',
    },
  ],
  'stoic.shortfall': [
    {
      title: 'Støðan tín fer undir null {{date}}',
      message:
        'Komandi gjøld á {{committedAmount}} taka vænta støðuna til {{lowestAmount}}. Fyrireika tíg nú, meðan tað bert er ein ætlan.',
    },
    {
      title: 'Eitt brek kemur: {{date}}',
      message:
        'Bundin gjøld ({{committedAmount}}) renna frá støðuni og botna á {{lowestAmount}}. At sjá trupulleikar fyri er hvussu teir missa vald sítt.',
    },
    {
      title: 'Ætla fyri {{date}}',
      message:
        'Tann dagin røkkur vænta støðan {{lowestAmount}}. Flyt eitt gjald, hald eitt ynski aftur, ella set pening til síðuna — hvørt av hesum er í tínum valdi í dag.',
    },
    {
      title: 'Bindingar fara yvir støðuna',
      message:
        '{{committedAmount}} falla, og støðan fellur til {{lowestAmount}} um {{date}}. Tað rólig svarið er tað tíðliga.',
    },
    {
      title: 'Sí brekið fyri {{date}}',
      message:
        'Vænt lægsta støða: {{lowestAmount}}. Tað sum er sætt fyri, kann møtast við stillfarni; tað sum kemur óvarað, sjáldan.',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: 'Tú helt orð tín móti tær sjálvum',
      message:
        'Í {{months}} mánaðir í røð hildu útgjøldini tín seg innan tá ætlan tú setti. Soleiðis sær sjálvsstýring út.',
    },
    {
      title: '{{months}} mánaðir innan ætlan',
      message:
        'Mánað eftir mánað eru ætlan tín og gerð tín samd. Jøvnleiki er stillari enn viljastyrki og varar longri.',
    },
    {
      title: 'Ætlan og lív eru samd',
      message:
        '{{months}} mánaðir í røð innan markirnar tínar. Ein ætlan hildin so væl er ikki longur ein avmarking — tað er hvussu tú livir.',
    },
    {
      title: 'Støðugt í {{months}} mánaðir',
      message:
        'Fíggjarætlanirnar tínar hava hildið {{months}} mánaðir í røð. Hald sama ans; tað virkar.',
    },
    {
      title: 'Sjálvsstýring, varðveitt',
      message:
        '{{months}} mánaðir uttan at bróta ætlan tína. Fátt frælsar sum at kunna líta á sínar egnu avgerðir.',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: 'Pengarnir tín fylgja virðum tínum',
      message:
        'Dygd tók {{actual}} % av útgjøldunum tínum — ikki minni enn tey {{planned}} % tú ætlaði. Væl brúkt.',
    },
    {
      title: 'Dygd fekk sín fulla part',
      message:
        '{{actual}} % á heilsu, læring og onnur, móti {{planned}} % ætlaðum. Tað tú virðir, fyri tað gjaldi tú.',
    },
    {
      title: 'Brúkt á at verða betri',
      message:
        'Dygd nátti {{actual}} % av útgjøldunum henda mánaðin (ætlað {{planned}} %). Teir pengarnir arbeiða fyri tær langt eftir at teir eru farnir.',
    },
    {
      title: 'Ætlan framd',
      message:
        'Tú ætlaði {{planned}} % til dygd og brúkti {{actual}} %. Góðar ætlanir liva sjáldan ein mánað — tínar gjørdu tað.',
    },
    {
      title: 'Tann besta nýtslan av pengum',
      message: '{{actual}} % fóru til tað sum ger tíg og onnur betri. Hald fram at velja tað.',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: 'Frítíð á sínum staði',
      message:
        'Frítíð er {{actual}} % av útgjøldunum, undir teimum {{planned}} % tú loyvdi henni. Tú nýtur ting uttan at tey ráða tær.',
    },
    {
      title: 'Nøgdsemi, hildin í stødd',
      message:
        'Frítíð tók {{actual}} % móti {{planned}} % ætlaðum. Mátahald er ikki at missa av — tað er at velja.',
    },
    {
      title: 'Hvíld uttan ovmikið',
      message:
        '{{actual}} % á frítíð, undir markinum tínum á {{planned}} %. Gleði smakkar betur tá hon ikki ræður.',
    },
    {
      title: 'Mátahald, stillt',
      message:
        'Tú gav frítíðini {{planned}} % og hon brúkti bert {{actual}} %. Tað skilið er frælsi tú helt.',
    },
    {
      title: 'Frítíð undir ætlan',
      message:
        'Við {{actual}} % av útgjøldunum helt frítíðin seg undir teimum {{planned}} % tú setti. Væl hildið.',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: '{{percent}} % undir ætlan',
      message:
        'Tú brúkti {{savedAmount}} minni enn tú loyvdi tær sjálvum henda mánaðin. At ikki hava brúk fyri øllum tú kundi havt, er eitt slag av ríkidømi.',
    },
    {
      title: '{{savedAmount}} eftir óbrúkt',
      message:
        'Mánaðurin endaði {{percent}} % undir ætlan. Tað tú ikki brúkti, er framvegis títt at stýra.',
    },
    {
      title: 'Minni enn tú loyvdi',
      message:
        'Útgjøldini eru {{percent}} % undir ætlanini — {{savedAmount}} hildin. Gev tí skilinum eitt endamál áðrenn vanin tekur tað.',
    },
    {
      title: 'Ætlanin hevði pláss til vara',
      message:
        '{{savedAmount}} undir markunum tínum henda mánaðin. Afturhald sum kennist lætt, er tað slagið sum varar.',
    },
    {
      title: 'Lættari enn ætlað',
      message:
        'Tú hevði brúk fyri {{percent}} % minni enn tú ætlaði. Hugsa um at senda tey {{savedAmount}} móti einum máli.',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '„{{goal}}“ er á ætlan',
      message:
        'Tú ert {{percent}} % av vegnum, við tí ferð málið krevur. Støðug stig, tikin mánaðarliga, røkka langt.',
    },
    {
      title: 'Á ætlan móti „{{goal}}“',
      message:
        '{{percent}} % liðugt og ferðin heldur. Hald fram at gjalda málinum fyrst; tað virkar.',
    },
    {
      title: '„{{goal}}“: {{percent}} % og støðugt',
      message: 'Málið fær tað tað hevur brúk fyri hvønn mánað. Tolið ger sítt arbeiði.',
    },
    {
      title: 'Málið rørir seg sum ætlað',
      message:
        '„{{goal}}“ er {{percent}} % fíggjað og í tíð. Tað sum verður gjørt lítið hvønn mánað, verður ikki steðgað av eini ringari viku.',
    },
    {
      title: 'Framgongd tú kanst líta á',
      message:
        '„{{goal}}“ stendur á {{percent}} %, í ferð. Tú byggir tað á tann einasta mátan sum virkar — spakuliga.',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: 'Færri snarkeyp hjá {{merchant}}',
      message:
        'Frá {{before}} keypum seinasta mánað til um {{after}} henda mánaðin. Ein loystur vani er vunnið frælsi.',
    },
    {
      title: '{{merchant}}: {{before}} → {{after}}',
      message:
        'Tú vitjar sjáldnari enn fyrr. Hvørt sleppt viðbragd er ein lítil sigur av vali yvir vana.',
    },
    {
      title: 'Tann lítli vanin minkar',
      message:
        'Keyp hjá {{merchant}} fullu frá {{before}} til um {{after}}. Hald fram — tað verður lættari.',
    },
    {
      title: 'Val fram um viðbragd',
      message:
        'Hjá {{merchant}} fórt tú frá {{before}} keypum til um {{after}}. Tað er ráð bygt ein avgerð í senn.',
    },
    {
      title: 'Minni av tí smáa',
      message:
        '{{merchant}} sá tíg um {{after}} ferðir í staðin fyri {{before}}. Smáir sigrar leggjast saman.',
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: 'Tú tillagaði tíg einum knappari mánaði',
      message:
        'Inntøkan fall {{incomePercent}} %, og tú skar útgjøldini {{expensePercent}} %. Tú møtti eini broyting í lukkuni við eini broyting í kós.',
    },
    {
      title: 'Stillfarni tá inntøkan fall',
      message:
        'Inntøkan niður {{incomePercent}} %, útgjøldini niður {{expensePercent}} %. Tú tillagaði tíg tí sum er, ikki tí sum var.',
    },
    {
      title: 'Lukkan broyttist; tað gjørdi tú eisini',
      message:
        'Eitt fall í inntøkuni á {{incomePercent}} % møtti einum falli í útgjøldunum á {{expensePercent}} %. Tað er sinnisró í tølum.',
    },
    {
      title: 'Væl stýrt',
      message:
        'Tá inntøkan fall {{incomePercent}} %, fylgdu útgjøldini ({{expensePercent}} % minni). Vindurin var ikki tín; seglið var.',
    },
    {
      title: 'Útgjøldini fylgdu inntøkuni niður',
      message:
        'Tú brúkti {{expensePercent}} % minni tá inntøkan fall {{incomePercent}} %. At tillaga seg tíðliga er tann rólig vegurin ígjøgnum.',
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: 'Neyðsynjar eru støðugar',
      message:
        'Í {{months}} mánaðir hava neyðugu kostnaðirnir tínir næstan ikki rørt seg. Eitt støðugt golv gevur tær frælsi omanfyri tað.',
    },
    {
      title: 'Tørvir hildnir í teymum',
      message:
        'Útgjøld til neyðsynjar hildu seg jøvn í {{months}} mánaðir. Tørvir sum ikki vaksa eru tørvir tú stýrir.',
    },
    {
      title: '{{months}} mánaðir av støðugum neyðsynjum',
      message:
        'Húsaleiga, matur og rokningar hildu seg hvar tey vóru. Stillur støðugleiki er eisini eitt úrslit.',
    },
    {
      title: 'Onki krøking í neyðsynjum',
      message:
        '{{months}} mánaðir uttan rák í tí lívið krevur. Alt annað er lættari at ætla á tí grundarlagi.',
    },
    {
      title: 'Eitt fast golv',
      message:
        'Neyðug útgjøld hava verið støðug í {{months}} mánaðir. Tú letur ikki trivnað gá fyri tørv.',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: 'Gávumildur við tað tú vinnur',
      message:
        'Yvir {{months}} mánaðir fóru {{percent}} % av inntøkuni tíni — {{givenAmount}} — til at hjálpa øðrum. Tað eru pengar settir í sína bestu nýtslu.',
    },
    {
      title: '{{givenAmount}} givin øðrum',
      message:
        'Tú deildi {{percent}} % av inntøkuni tíni á {{months}} mánaðum. Góðska sum sæst í tølunum, er góðska útint, ikki bert kend.',
    },
    {
      title: 'Opnar hendur',
      message:
        'Góðgerð og gávur tóku {{percent}} % av inntøkuni tíni síðstu tíðina. Tað tú gevur frá tær, er tann parturin av ríkidømi tínum sum ongin óheppni kann taka.',
    },
    {
      title: 'Gávumildi er partur av ætlan tíni',
      message:
        '{{givenAmount}} til onnur yvir {{months}} mánaðir. Hald tað — tað góða tú gert fyri onnur, er eisini gjørt fyri tíg sjálvan.',
    },
    {
      title: 'Væl givið',
      message:
        '{{percent}} % av tí tú vann, fóru til at hjálpa øðrum. Fáir vanar siga meira um ein mann.',
    },
  ],
  'stoic.praise_steady': [
    {
      title: 'Einki at rætta',
      message: 'Útgjøldini tín svara til tað tú ætlaði. Hald fram sum tú ert.',
    },
    {
      title: 'Ætlan og gerð eru samd',
      message: 'Hesin mánaðurin sær út sum tú ætlaði hann. Tað samsvarið er allur punkturin.',
    },
    {
      title: 'Ein rólig mánaður',
      message:
        'Onki ovmikið, onki vanræksla verd at nevna. Væl gjørt — tak sama ans við tær víðari.',
    },
    {
      title: 'Alt í lagi',
      message: 'Ætlanin tín helt og einki biður um rætting. Nýt tann frið tú hevur vunnið.',
    },
    {
      title: 'Støðug hond',
      message: 'Mánaðurin fylgdi ætlan tíni. Góðir vanar gera góðar mánaðir at síggja vanligar út.',
    },
  ],
  'expert.pay_yourself_first': [
    {
      title: 'Gjald tær sjálvum fyrst',
      message:
        'Reglan hjá George S. Clason: ein partur av øllum tú vinnur er tín at halda — í minsta lagi ein tiundapartur. Yvir {{months}} mánaðir helt tú {{savingsPercent}} %. Set {{tenthAmount}} til síðuna tann dagin inntøkan kemur, fyri øllum øðrum.',
    },
    {
      title: 'Ein tiundapartur er tín at halda',
      message:
        'Í Ríkasta manninum í Babylon er fyrsta heilivágurin móti einum tunnum pungi at halda ein pening av hvørjum tíu. Sparistigið títt er {{savingsPercent}} %; {{tenthAmount}} um mánaðin hevði byrjað vanan.',
    },
    {
      title: 'Spar áðrenn tú brúkar, ikki aftaná',
      message:
        'Ráðið hjá Clason er einkult: gjald tær sjálvum fyrst. Nýliga hava {{savingsPercent}} % av inntøkuni verið hjá tær. Flyt {{tenthAmount}} til síðuna á lønardegnum og lat útgjøldini laga seg eftir restini.',
    },
    {
      title: 'Fyrsti peningurin er tín',
      message:
        'Ein partur av øllum tú vinnur eigur at verða hjá tær — ikki minni enn ein tiundapartur, sigur Clason. Tú helt {{savingsPercent}} % yvir {{months}} mánaðir. Byrja við {{tenthAmount}} um mánaðin, sjálvvirkandi.',
    },
    {
      title: '{{savingsPercent}} % hildið — reglan biður um 10 %',
      message:
        'Gjald tær sjálvum fyrst, sum Ríkasti maðurin í Babylon sigur tað: {{tenthAmount}} um mánaðin, sett til síðuna fyri hvørji rokning. Sparing gjørd fyrst er ikki upp á tað sum er eftir.',
    },
  ],
  'expert.rule_50_30_20': [
    {
      title: 'Tín 50/30/20-kanning',
      message:
        'Elizabeth Warren og Amelia Warren Tyagi skjóta upp 50 % av inntøku eftir skatt til neyðsynjar, 30 % til ynski, 20 % til sparing. Tínar: {{needsPercent}} % / {{wantsPercent}} % / {{savingsPercent}} %.',
    },
    {
      title: 'Tørvir {{needsPercent}} %, ynski {{wantsPercent}} %, sparing {{savingsPercent}} %',
      message:
        'All Your Worth javnar pengar sum 50/30/20. Samanber tann posturin sum er longst frá marki sínum við ætlan tína — har hjálpir ein broyting mest.',
    },
    {
      title: 'Hvussu inntøkan tín býtist',
      message:
        'Neyðsynjar taka {{needsPercent}} % av inntøkuni, ynski {{wantsPercent}} %, og {{savingsPercent}} % verða sparað. 50/30/20-javnvágin úr All Your Worth er eitt nýtiligt spegl, ikki ein dómur.',
    },
    {
      title: 'Tann javnvigaða peningaformulan',
      message:
        'Formulan hjá Warren og Tyagi: helvtin til tað tú mást gjalda hvat so hendir, 30 % til ynski, 20 % til framtíðina. Tú ert á {{needsPercent}}/{{wantsPercent}}/{{savingsPercent}}.',
    },
    {
      title: 'Móti 50/30/20',
      message:
        'Býtið títt er {{needsPercent}} % neyðsynjar, {{wantsPercent}} % ynski, {{savingsPercent}} % sparing. Royndin hjá bókini fyri eina neyðsyn: hevði tú framvegis gjaldað hana, um tú misti arbeiðið í morgin?',
    },
  ],
  'expert.room_for_error': [
    {
      title: 'Lat vera pláss fyri feilum',
      message:
        'Ráðið hjá Morgan Housel: ætla fyri at ting ikki fara eftir ætlan. Støðan tín dekkar um {{cushionDays}} dagar av útgjøldum; eitt vanligt mark er tríggir mánaðir — {{targetAmount}}.',
    },
    {
      title: 'Ein pútur á {{cushionDays}} dagar',
      message:
        'The Psychology of Money kallar tað pláss fyri feilum — slakki sum letur tíg liva óvæntað av. At byggja móti {{targetAmount}}, tríggja mánaða útgjøldum, gevur ætlanini møguleika at liva veruleikan av.',
    },
    {
      title: 'Trygdarmark, heima',
      message:
        'Housel lænir trygdarmarkið hjá Graham til privatfígging. Við {{cushionDays}} dagum av útgjøldum í varaluta kann ein ringur mánaður gera eina góða ætlan til einki. Mið eftir {{targetAmount}}.',
    },
    {
      title: 'Pláss fyri tí óvæntaða',
      message:
        'Varalutin tín hevði varað um {{cushionDays}} dagar. Óvæntað er tað eina vissa; tríggja mánaða útgjøld ({{targetAmount}}) er eitt víða nýtt mark.',
    },
    {
      title: 'Bygg slakki áðrenn tú hevur brúk fyri tí',
      message:
        'Pláss fyri feilum, við orðum Morgan Housel, er tað sum heldur tíg í spælinum. Tú hevur um {{cushionDays}} dagar dekkaðar; {{targetAmount}} hevði dekkað tríggjar mánaðir.',
    },
  ],
  'expert.lifestyle_creep': [
    {
      title: 'Útgjøldini renna frá inntøkuni',
      message:
        'Útgjøldini stigu {{expenseGrowth}} % seinasta ársfjórðing meðan inntøkan broyttist {{incomeGrowth}} %. Fyrsta reglan í The Millionaire Next Door: hvør enn inntøkan tín er, liv undir evnum tínum.',
    },
    {
      title: 'Livir høgri, ikki ríkari',
      message:
        'Stanley og Danko funnu at ríkidømi er tað tú savnar, ikki tað tú brúkar. Útgjøldini tín vuksu {{expenseGrowth}} %, inntøkan {{incomeGrowth}} % — í skilinum lekur ríkidømið.',
    },
    {
      title: 'Lívsstílskrøking: +{{expenseGrowth}} %',
      message:
        'Útgjøldini klivu skjótari enn inntøkan ({{incomeGrowth}} %). Fólkið í The Millionaire Next Door hildu ríkidømi við at lata inntøkuna stíga uttan at lata útgjøldini fylgja.',
    },
    {
      title: 'Málstengurnar flyta seg',
      message:
        'Útgjøldini eru upp {{expenseGrowth}} % frá ársfjórðingi til ársfjórðings móti {{incomeGrowth}} % fyri inntøkuna. Liv undir evnum tínum, siga Stanley og Danko — hvør enn evnin eru.',
    },
    {
      title: 'Ríkidømi er tað tú heldur',
      message:
        'Ein góð inntøka brúkt heilt ger ongan ríkari. Seinasta ársfjórðing vuksu útgjøldini tín {{expenseGrowth}} % og inntøkan {{incomeGrowth}} % — verd eitt eygnakast áðrenn tað verður tað nýggja vanliga.',
    },
  ],
  'expert.life_energy': [
    {
      title: '{{merchant}} kostaði {{hours}} tímar av lívi tínum',
      message:
        'Vicki Robin og Joe Dominguez skjóta upp at prísseta ting í lívsorku — teimum arbeiðstímum tey kosta. {{totalAmount}} hjá {{merchant}} henda mánaðin eru um {{hours}} tímar. Var tað tað verd?',
    },
    {
      title: '{{hours}} tímar hjá {{merchant}}',
      message:
        'Your Money or Your Life biður tíg at síggja pengar sum tíð tú býtti fyri teir. Við miðal tímainntøku tíni svara {{totalAmount}} har til um {{hours}} arbeiðstímar.',
    },
    {
      title: 'Prísset tað í tímum',
      message:
        '{{totalAmount}} hjá {{merchant}} eru um {{hours}} tímar av arbeiði. Robin og Dominguez kalla hetta lívsorku — tann einasta gjaldoyrað tú ikki kanst vinna aftur.',
    },
    {
      title: 'Hvat {{merchant}} veruliga kostaði',
      message:
        'Pengar eru nakað vit býta lívsorku okkara fyri. Henda mánaðin tók {{merchant}} um {{hours}} tímar av tínari ({{totalAmount}}). Svarar nøgdsemin til tímarnar?',
    },
    {
      title: 'Kanning av lívsorku',
      message:
        'Umroknað við miðal tímainntøku tíni eru {{totalAmount}} brúkt hjá {{merchant}} um {{hours}} tímar. Your Money or Your Life skjýtur upp at spyrja um tað gav tilsvarandi nøgdsemi.',
    },
  ],
};
