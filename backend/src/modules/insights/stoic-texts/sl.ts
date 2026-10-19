import type { StoicTextMap } from './types';

export const sl: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: 'Mesec je prerasel svoj načrt',
      message:
        'Načrtovali ste {{plannedAmount}} in porabili {{spentAmount}} — {{percent}} % več. Načrt je nastal s hladno glavo; naj govori močneje od trenutka.',
    },
    {
      title: '{{percent}} % nad tem, kar ste nameravali porabiti',
      message:
        'Poraba znaša {{spentAmount}} proti načrtu {{plannedAmount}}. Poglejte, katera omejitev je popustila prva — tam je nauk.',
    },
    {
      title: 'Vaš načrt in vaš mesec se ne ujemata',
      message:
        '{{spentAmount}} porabljeno, {{plannedAmount}} namenjeno. Bodisi je načrt od resničnosti zahteval premalo, bodisi resničnost od vas preveč — mirno odločite, kaj od tega.',
    },
    {
      title: 'Odšlo je več, kot ste dovolili',
      message:
        'Mesec je {{percent}} % nad {{plannedAmount}}, ki ste si jih določili. Če se ustavite zdaj, ni nič izgubljeno; če se pretvarjate, da se ni zgodilo, je izgubljeno veliko.',
    },
    {
      title: 'Omejitev, ki ste jo postavili, omejitev, ki ste jo prestopili',
      message:
        'Nameravali ste porabiti {{plannedAmount}}; znesek je {{spentAmount}}. Samoobvladovanje ni nikoli spodrsniti — je opaziti zgodaj in se vrniti na pot.',
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: 'Prosti čas vzame več, kot ste načrtovali',
      message:
        'Želeli ste, da bi prosti čas bil {{planned}} % porabe; ta mesec je {{actual}} %. Užitek je dobrodošel kot gost, ne kot gospodar hiše.',
    },
    {
      title: 'Prosti čas pri {{actual}} %, načrtovano {{planned}} %',
      message:
        'Počitek si zasluži svoje mesto, ko vas obnovi. Vprašajte se, kateri užitki tega meseca so to storili, in ostale izpustite brez obžalovanja.',
    },
    {
      title: 'Udobje porablja več kot namera',
      message:
        'Prosti čas drži {{actual}} % porabe proti {{planned}} %, ki ste jih izbrali. Zmernost ni zavračanje užitka — je ohranjanje njegove izbrane mere.',
    },
    {
      title: 'Prijetno izriva načrtovano',
      message:
        'Prostemu času ste dali {{planned}} % načrta, vzel pa je {{actual}} %. To, kar uživate brez truda, je vredno drugega pogleda, preden postane to, kar potrebujete.',
    },
    {
      title: 'Prosti čas je prestopil svojo črto',
      message:
        '{{actual}} % meseca je šlo v prosti čas, {{planned}} % je bil namen. Črta je bila vaša, da jo narišete, in vaša je, da jo držite.',
    },
  ],
  'stoic.leisure_habit': [
    {
      title: 'Prosti čas znova nad načrtom',
      message:
        'Prosti čas je presegel vaš načrt v {{months}} od zadnjih {{window}} mesecev. Ponovitev ni več nesreča — je navada, ki jo je vredno pregledati.',
    },
    {
      title: '{{months}} od {{window}} mesecev nad načrtom prostega časa',
      message:
        'Kar se zgodi enkrat, so okoliščine; kar se zgodi {{months}}-krat, je značaj v nastajanju. Izberite značaj namenoma.',
    },
    {
      title: 'Enak spodrsljaj, mesec za mesecem',
      message:
        'Prosti čas je presegel načrt v {{months}} od {{window}} mesecev. Dvignite načrt pošteno ali spremenite navado — živeti vmes je najdražje.',
    },
    {
      title: 'Vzorec, ne izjema',
      message:
        'V {{months}} od zadnjih {{window}} mesecev je prosti čas vzel več, kot ste mu dali. Opazite trenutek, ko se odločitev sprejme, ne le računa potem.',
    },
    {
      title: 'Navada glasuje proti vašemu načrtu',
      message:
        'Prosti čas je premagal načrt {{months}}-krat v {{window}} mesecih. Navade se gradijo po eni izbiri; prav tako se podirajo.',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: 'Krepost dobi manj, kot ste nameravali',
      message:
        'Odmerili ste {{planned}} % proračuna za zdravje, učenje in druge; doslej je {{actual}} %. Namera šteje, ko je izvedena.',
    },
    {
      title: 'Krepost pri {{actual}} % od načrtovanih {{planned}} %',
      message:
        'Denar, ki ste ga namenili temu, kar vas izboljšuje, še čaka. Boljšega časa, da ga dobro porabite, kot ta mesec ni.',
    },
    {
      title: 'Dobro, ki ste ga načrtovali, je neporabljeno',
      message:
        'Zdravje, učenje in radodarnost naj bi dobili {{planned}} % porabe; dobili so {{actual}} %. Naredite eno od njih ta teden, namenoma.',
    },
    {
      title: 'Namera brez dejanja',
      message:
        'Krepost drži {{actual}} % porabe proti {{planned}} %, ki ste jih izbrali. To, kar cenimo, se pokaže v tem, za kar zares plačamo.',
    },
    {
      title: 'Prostor je ostal za to, kar šteje',
      message:
        'Za krepost je šlo le {{actual}} %, čeprav ste načrtovali {{planned}} %. Knjiga, pregled pri zdravniku, darilo nekomu v stiski — načrt je že rekel da.',
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: 'Krepost se vedno znova odlaga',
      message:
        'Poraba za zdravje, učenje in druge ostaja pod vašim načrtom že {{months}} mesecev zapored. Kar nenehno odlagate, ste v resnici zavrnili.',
    },
    {
      title: '{{months}} mesecev odložene kreposti',
      message:
        'Vsak mesec je načrt naredil prostor za to, kar vas izboljšuje, in vsak mesec je ostal neizrabljen. Čas je edino, česar ni mogoče načrtovati dvakrat.',
    },
    {
      title: 'Boljši jaz še čaka',
      message:
        'Krepost je pod načrtom {{months}} mesecev zapored. Začnite majhno in zanesljivo, ne veliko in pozneje.',
    },
    {
      title: 'Dobri nameni se starajo',
      message:
        '{{months}} mesecev so zdravje, učenje in radodarnost dobivali manj, kot ste načrtovali. Izberite eno in jo naslednji mesec plačajte prvo, pred vsem drugim.',
    },
    {
      title: 'Krepost še vedno izgublja proti »pozneje«',
      message:
        '{{months}} mesecev zapored pod načrtom. Pozneje je kraj, kamor dobri nameni odidejo, da bi bili pozabljeni — temu dajte datum.',
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: 'Vaš načrt nima prostora za krepost',
      message:
        'Nobeden od vaših proračunov ne služi zdravju, učenju ali drugim. Načrt pokaže, kaj cenimo — razmislite, da bi kreposti dali svojo vrstico.',
    },
    {
      title: 'Vsi proračuni, a nobeden za dobro',
      message:
        'Nujnost, delo in prosti čas imajo omejitve; krepost nobene. Kar se nikoli ne načrtuje, se običajno nikoli ne zgodi.',
    },
    {
      title: 'Načrtujte to, kar vas izboljšuje',
      message:
        'V razredu kreposti še ni nobenega proračuna. Tudi majhen — knjige, šport, donacija — spremeni željo v zavezo.',
    },
    {
      title: 'Načrt o kreposti molči',
      message:
        'Načrtujete za to, kar morate, in za to, kar uživate, še ne za to, kdo želite postati. En skromen proračun za krepost bi to spremenil.',
    },
    {
      title: 'Krepost nima proračuna',
      message:
        'Poraba za zdravje, učenje ali druge ni načrtovana nikjer. Izberite eno in ji dajte omejitev, ki bi jo z veseljem dosegli.',
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: 'Nujnosti stanejo več, kot je bilo načrtovano',
      message:
        'Načrtovali ste {{planned}} % porabe za nujnosti; vzamejo {{actual}} %. Preverite, ali je vsaka še potreba ali je tiho postala udobje.',
    },
    {
      title: 'Nujnost pri {{actual}} %, načrtovano {{planned}} %',
      message:
        'Kar življenje zahteva, je običajno manj kot to, na kar se navadimo. Preglejte največjo nujnost s svežim očesom.',
    },
    {
      title: 'Nujno se napihuje',
      message:
        'Nujnosti držijo {{actual}} % meseca proti {{planned}} %, ki ste jih pričakovali. Potreba, ki še naprej raste, si zasluži vprašanje.',
    },
    {
      title: 'Potrebe prerastejo načrt',
      message:
        'Načrtovano {{planned}} %, dejansko {{actual}} %. Bodisi je načrt podcenil prave stroške, bodisi nekatere želje potujejo pod imenom potreb.',
    },
    {
      title: 'Za »moram« je šlo več, kot je bilo mišljeno',
      message:
        'Nujnosti so vzele {{actual}} % porabe namesto {{planned}} %. Ločite to, kar res mora biti, od tega, kar je le vedno bilo.',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: 'Nujnosti se plazijo navzgor',
      message:
        'Poraba za nujnosti raste {{months}} mesecev zapored, skupaj {{percent}} %. Potrebe tiho rastejo, ko jih nihče ne prosi, da se opravičijo.',
    },
    {
      title: '+{{percent}} % pri nujnostih v {{months}} mesecih',
      message:
        'Vsak korak je bil videti majhen; skupaj niso. Vzemite največjo ponavljajočo se nujnost in se vprašajte, ali mora še vedno stati toliko.',
    },
    {
      title: 'Tla vaše porabe se dvigajo',
      message:
        'Nujnosti so rasle {{months}} mesecev zapored (+{{percent}} %). Dvigajoča se tla puščajo manj prostora za vse, kar izberete svobodno.',
    },
    {
      title: 'Potrebe se širijo',
      message:
        '{{months}} mesecev rasti, skupaj {{percent}} %. Stoična preizkušnja je preprosta: bi to danes izbrali znova, ko poznate ceno?',
    },
    {
      title: 'Majhni porasti, enakomerna smer',
      message:
        'Nujnosti so v {{months}} mesecih višje za {{percent}} %. Smer šteje več kot posamezen mesec — tega je vredno popraviti zgodaj.',
    },
  ],
  'stoic.work_over_plan': [
    {
      title: 'Delo stane več, kot je bilo načrtovano',
      message:
        'Načrtovali ste {{planned}} % porabe za delo; vzame {{actual}} %. Orodja in storitve si morajo zaslužiti svoje mesto — preverite, katera si ga.',
    },
    {
      title: 'Poraba za delo pri {{actual}} %, načrtovano {{planned}} %',
      message:
        'Naložba v delo je dobra, ko nekaj vrne. Preglejte, za kaj plačujete, a ne uporabljate več.',
    },
    {
      title: 'Proračun za delo je napet',
      message:
        'Delo je vzelo {{actual}} % namesto {{planned}} %. Delavnost je opraviti delo dobro, ne kupiti vsako orodje zanj.',
    },
    {
      title: 'Orodja porabljajo nad načrtom',
      message:
        'Načrtovano {{planned}} %, porabljeno {{actual}} % za delo. Pri vsakem izdatku se vprašajte: mi pomaga opraviti delo ali se le zdi kot napredek?',
    },
    {
      title: 'Stroški dela so se premaknili',
      message:
        'Delo drži {{actual}} % porabe proti načrtovanim {{planned}} %. Hiter pregled zdaj prihrani večji pozneje.',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '»{{category}}« vedno znova prelomi svojo omejitev',
      message:
        '»{{category}}« je presegla proračun v {{months}} od zadnjih {{window}} mesecev. Bodisi je omejitev napačna, bodisi želja — odločite, kaj od tega.',
    },
    {
      title: '»{{category}}«: nad proračunom {{months}} od {{window}} mesecev',
      message:
        'Omejitev, ki jo vedno prestopimo, ni omejitev, le želja. Naredite jo pošteno — dvignite jo namenoma ali jo namenoma držite.',
    },
    {
      title: 'Isti proračun znova popusti',
      message:
        '»{{category}}« je presegla svojo omejitev {{months}}-krat v {{window}} mesecih. Ponavljanje je informacija; uporabite jo.',
    },
    {
      title: '»{{category}}« prosi za vašo pozornost',
      message:
        'Nad proračunom v {{months}} od {{window}} mesecev. Opazujte trenutek pred nakupom — to je edini kraj, kjer se navada lahko spremeni.',
    },
    {
      title: 'Vzorec pri »{{category}}«',
      message:
        '{{months}} preseganj v {{window}} mesecih. Kar ponavljamo, to postanemo; odločite, kaj naj ta kategorija pove o vas.',
    },
  ],
  'stoic.budget_pace': [
    {
      title: '»{{category}}« se izčrpa okoli dneva {{day}}',
      message:
        'Porabili ste {{spentAmount}} od {{limitAmount}} in pri tem tempu se omejitev konča okoli dneva {{day}}. Upočasniti zdaj je lažje kot ustaviti se pozneje.',
    },
    {
      title: '»{{category}}« je pred mesecem',
      message:
        '{{spentAmount}} je že porabljenih od omejitve {{limitAmount}}. Pri tem tempu bo izčrpana okoli dneva {{day}} — preostanek meseca pa je še vedno vaš.',
    },
    {
      title: 'Preverjanje tempa: »{{category}}«',
      message:
        'Proračun {{limitAmount}} pri trenutnem tempu zdrži približno do dneva {{day}}. Previdnost je najcenejša oblika discipline.',
    },
    {
      title: '»{{category}}« porablja prihodnost',
      message:
        '{{spentAmount}} od {{limitAmount}} porabljenih; omejitev se konča blizu dneva {{day}}. Kaj naredite ta teden, odloči, ali se to zgodi.',
    },
    {
      title: 'Zgodnje opozorilo za »{{category}}«',
      message:
        'Pri trenutnem tempu omejitev {{limitAmount}} ne bo dosegla konca meseca — izčrpa se okoli dneva {{day}}. Popravite, dokler je poceni.',
    },
  ],
  'stoic.budget_unused': [
    {
      title: '»{{category}}« je ostala neizrabljena',
      message:
        'Proračun za »{{category}}« ni zabeležil porabe že {{months}} mesecev. Bodisi ste ga prerasli, bodisi je namera, ki še čaka — odločite, kaj od tega.',
    },
    {
      title: 'Prazen proračun: »{{category}}«',
      message:
        '{{months}} mesecev brez enega samega izdatka. Načrt naj opisuje življenje, ki ga živite, ali tisto, ki ga gradite — kateri je ta?',
    },
    {
      title: '»{{category}}« stoji neuporabljena',
      message:
        'Tu ni bilo porabe {{months}} mesecev. Če je bila to zadržanost, odlično; če zanemarjanje, nekaj storite.',
    },
    {
      title: 'Načrtovano, a ne živeto',
      message:
        '»{{category}}« ima omejitev in nobene porabe že {{months}} mesecev. Ohranite načrt resničen: odstranite jo ali jo uporabite.',
    },
    {
      title: '»{{category}}«: {{months}} tihih mesecev',
      message:
        'Proračun, ki se ga nihče ne dotakne, še vedno zaseda mesto v vašem načrtu. Sprostite mesto ali namero izpolnite.',
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: '{{percent}} % porabe nima omejitve',
      message:
        '{{unbudgetedAmount}} je ta mesec šlo v kategorije, ki jih ne spremlja noben proračun. Kar se ne meri, je težko obvladati.',
    },
    {
      title: 'Velik del meseca je nenačrtovan',
      message:
        '{{percent}} % porabe — {{unbudgetedAmount}} — leži zunaj vseh proračunov. Dajte največjemu delu omejitev in načrt bo videl več vašega življenja.',
    },
    {
      title: 'Poraba zunaj načrta',
      message:
        'Proračuni pokrivajo le del tega, kar porabite; {{unbudgetedAmount}} ({{percent}} %) ostaja neizmerjenih. Razširite načrt tja, kamor denar zares gre.',
    },
    {
      title: 'Načrt vidi le del slike',
      message:
        '{{percent}} % porabe tega meseca nima proračuna. Jasen pogled pride pred dobro presojo.',
    },
    {
      title: '{{unbudgetedAmount}} porabljenih brez omejitve',
      message:
        'To je {{percent}} % meseca. Ni treba, da to omejite — le da se odločite, koliko tega zares želite.',
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '»{{category}}« je večina vašega prostega časa',
      message:
        '{{percent}} % porabe za prosti čas je šlo v »{{category}}«. Raznolikost v počitku je zdravejša od odvisnosti od enega užitka.',
    },
    {
      title: 'En užitek prevladuje',
      message:
        '»{{category}}« vzame {{percent}} % vsega, kar ste porabili za prosti čas. Vprašajte se, ali vas še razveseljuje ali je postala navada.',
    },
    {
      title: 'Prosti čas se opira na »{{category}}«',
      message:
        '{{percent}} % prostega časa na enem mestu. Tisto, brez česar ne gre, nas drži — preverite, da je prijem še rahel.',
    },
    {
      title: '»{{category}}«: {{percent}} % prostega časa',
      message:
        'En sam vir veselja vzame skoraj vse. Poskusite ta mesec en cenejši, drugačen užitek in primerjajte.',
    },
    {
      title: 'Vaš počitek ima en naslov',
      message:
        'Večina denarja za prosti čas — {{percent}} % — gre v »{{category}}«. Svoboda vključuje tudi zmožnost uživati kaj drugega.',
    },
  ],
  'stoic.unclassified': [
    {
      title: 'Del porabe še ni presojen',
      message:
        '{{count}} kategorij nima razreda. V Proračunih odločite, kaj je nujnost, delo, krepost ali prosti čas.',
    },
    {
      title: '{{count}} kategorij čaka na vašo presojo',
      message:
        'Imajo porabo, a nobenega razreda, zato jih nasveti ne morejo tehtati. Minuta v Proračunih to reši.',
    },
    {
      title: 'Poimenujte to, čemur vaš denar služi',
      message:
        '{{count}} kategorij je še nerazvrščenih. Presoja se začne s tem, da stvari imenujemo s pravimi imeni.',
    },
    {
      title: 'Nepresojena poraba: {{count}} kategorij',
      message:
        'Je to potreba, vaše delo, krepost ali užitek? Povedati lahko le vi — in načrt se s tem razjasni.',
    },
    {
      title: 'Nekaj kategorij nima razreda',
      message:
        '{{count}} kategorij stoji zunaj štirih razredov. Razvrstite jih v Proračunih, da bo vsak izdatek viden takšen, kot je.',
    },
  ],
  'stoic.small_purchases': [
    {
      title: '{{count}} majhnih nakupov pri {{merchant}}',
      message:
        'Vsak je bil videti nepomemben; skupaj so ta mesec znesli {{totalAmount}}. Majhne, nepregledane navade so tam, kamor tiho odide večina denarja.',
    },
    {
      title: '{{merchant}}: {{count}}-krat ta mesec',
      message:
        '{{totalAmount}} v majhnih zneskih. Vprašajte se, ali je bil vsak obisk izbira ali refleks — svoboda je le prvo.',
    },
    {
      title: 'Po malem: {{totalAmount}}',
      message:
        '{{count}} nakupov pri {{merchant}}. Noben posamezen ni pomemben; navada je. Odločite, kako pogosto to zares želite.',
    },
    {
      title: 'Navada pri {{merchant}}',
      message:
        '{{count}} nakupov, skupaj {{totalAmount}}. Poskusite ta mesec vsak tretji preskočiti in poglejte, ali ga boste pogrešali.',
    },
    {
      title: 'Majhne stvari se seštevajo',
      message:
        '{{merchant}} vas je videl {{count}}-krat, za {{totalAmount}}. Obvladovanje velikih odločitev se gradi na takšnih majhnih.',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: 'Konci tedna nosijo {{percent}} % prostega časa',
      message:
        'Večina vaše porabe za prosti čas se zgodi v soboto in nedeljo. Počitek je dober; preverite, da je počitek in ne nadomestilo za teden.',
    },
    {
      title: 'Prosti čas živi ob koncu tedna',
      message:
        '{{percent}} % porabe za prosti čas pade na konec tedna. Načrtujte konec tedna malenkost in stal bo manj ter dal več.',
    },
    {
      title: 'Konec tedna plača za teden',
      message:
        'Konci tedna vzamejo {{percent}} % tega, kar porabite za prosti čas. Če je treba teden popravljati vsako soboto, poglejte teden.',
    },
    {
      title: 'Sobota in nedelja: {{percent}} % prostega časa',
      message:
        'Prosti dnevi vabijo k prosti porabi. Pred koncem tedna odločite, čemu je namenjen, in naj denar sledi.',
    },
    {
      title: 'Vzorec konca tedna',
      message:
        '{{percent}} % porabe za prosti čas se zgodi ob koncu tedna. Lažji delovniki pogosto naredijo konce tedna cenejše.',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}} je vzel {{percent}} % meseca',
      message:
        '{{totalAmount}} je šlo enemu trgovcu za prosti čas. Ko ima en kraj toliko vašega denarja, se vprašajte, koliko ima tudi vaše pozornosti.',
    },
    {
      title: 'En kraj, {{totalAmount}}',
      message:
        '{{merchant}} je {{percent}} % porabe tega meseca. Je vreden takšnega deleža dela vašega življenja?',
    },
    {
      title: '{{merchant}} vodi vašo porabo',
      message:
        '{{percent}} % meseca — {{totalAmount}} — je šlo tja. Nič ni narobe, če to uživate, dokler bi to izbrali znova.',
    },
    {
      title: 'Velik delež pri {{merchant}}',
      message:
        '{{totalAmount}}, torej {{percent}} % porabe, na enem kraju prostega časa. Mirno pretehtajte užitek proti ceni.',
    },
    {
      title: '{{percent}} % pri {{merchant}}',
      message:
        'Ta en trgovec je vzel {{totalAmount}}. Svoboda je zmožnost mimo iti, ko se tako odločite.',
    },
  ],
  'stoic.income_drop': [
    {
      title: 'Prihodek je padel, poraba ne',
      message:
        'Prihodek je padel za {{percent}} % na {{incomeAmount}}, poraba pa je ostala pri {{expenseAmount}}. Sreča si je premislila; vaša poraba tega še ni opazila.',
    },
    {
      title: 'Prihodek navzdol za {{percent}} %',
      message:
        '{{incomeAmount}} je prišlo noter proti {{expenseAmount}} ven. Kar sreča da, lahko vzame nazaj — uskladite porabo s tem, kar je, ne s tem, kar je bilo.',
    },
    {
      title: 'Pustejši mesec, iste navade',
      message:
        'Prihodek je {{percent}} % nižji ({{incomeAmount}}), poraba pa je ostala pri {{expenseAmount}}. Prihodek ni v vaši moči; odziv je.',
    },
    {
      title: 'Sreča se je premaknila',
      message:
        'Zaslužili ste {{percent}} % manj kot običajno, porabili pa {{expenseAmount}} kot prej. Zmanjšajte zdaj, dokler je to izbira in ne nuja.',
    },
    {
      title: 'Poraba ni sledila prihodku',
      message:
        'Prihodek je padel na {{incomeAmount}} (za {{percent}} % navzdol); poraba je {{expenseAmount}}. Nastavite jadro vetru, ki ga zares imate.',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: 'Naročnine: {{monthlyAmount}} na mesec',
      message:
        '{{count}} naročnin vzame {{percent}} % vaše mesečne porabe. Vsaka se obnovi, ne da bi vas vprašala — vprašajte se o vsaki sami.',
    },
    {
      title: '{{percent}} % porabe se obnavlja samo',
      message:
        '{{count}} naročnin, {{monthlyAmount}} na mesec. Obdržite tiste, na katere bi se danes znova naročili.',
    },
    {
      title: 'Tiho, ponavljajoče, {{monthlyAmount}}',
      message:
        '{{count}} naročnin stane {{percent}} % vašega meseca. Udobje je dober služabnik in drag gospodar.',
    },
    {
      title: '{{count}} naročnin za pregled',
      message:
        'Skupaj je to {{monthlyAmount}} na mesec, {{percent}} % porabe. Odpovejte eno, ki jo komaj uporabljate, in opazite, kako malo jo boste pogrešali.',
    },
    {
      title: 'Kar se obnavlja samo',
      message:
        '{{monthlyAmount}} na mesec prek {{count}} naročnin. Samodejna poraba si zasluži namerno presojo.',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: 'Vaš uspeh bi lahko segel malo dlje',
      message:
        'V {{months}} mesecih ste obdržali {{savingsPercent}} % prihodka, a drugim je od tega šlo skoraj nič. Bogastvo najbolje sedi v odprtih rokah — morda eno darilo ali donacija ta mesec?',
    },
    {
      title: 'Dobro zasluži, malo da',
      message:
        '{{incomeAmount}} je prišlo v {{months}} mesecih in {{givenAmount}} je šlo drugim. Če pomagate na načine, ki jih ta aplikacija ne vidi, tega ne upoštevajte; če ne, ima načrt za to prostor.',
    },
    {
      title: 'Dobro leto za radodarnost',
      message:
        'Prihranili ste {{savingsPercent}} % prihodka — znak trdne roke. Majhen del tega, dan nekomu v stiski, bi tej trdnosti dal večji pomen.',
    },
    {
      title: 'Na sliki še ni nikogar drugega',
      message:
        'Zadnjih {{months}} mesecev kaže skrbno zaslužanje in varčevanje, a nobene dobrodelnosti ali darila. Ustvarjeni smo eden za drugega; skromno darilo je dovolj za začetek.',
    },
    {
      title: 'Prostor za prijaznost',
      message:
        'Za pomoč drugim je šlo le {{givenAmount}} od {{incomeAmount}}. Razmislite o majhni, redni donaciji — radodarnost se z navado olajša, kot vsaka krepost.',
    },
  ],
  'stoic.goal_behind': [
    {
      title: '»{{goal}}« zaostaja',
      message:
        'Potrebuje {{requiredAmount}} na mesec, vi pa vlagate približno {{paceAmount}}. Pri tem tempu bo prispel {{monthsLate}} mesecev pozneje.',
    },
    {
      title: '»{{goal}}«: {{monthsLate}} mesecev pozneje pri tem tempu',
      message:
        'Zahtevano {{requiredAmount}} na mesec, dejansko približno {{paceAmount}}. Premaknite datum pošteno ali namenoma premaknite več denarja.',
    },
    {
      title: 'Cilj in tempo se ne ujemata',
      message:
        '»{{goal}}« prosi za {{requiredAmount}} na mesec; dobi {{paceAmount}}. Cilj je resničen le toliko kot mesečni korak proti njemu.',
    },
    {
      title: '»{{goal}}« potrebuje trdnejši korak',
      message:
        '{{paceAmount}} na mesec proti {{requiredAmount}}, ki jih potrebuje. Naslednji mesec plačajte cilj prvi, pred vsem neobveznim.',
    },
    {
      title: 'Zaostanek pri »{{goal}}«',
      message:
        'Trenutni tempo ({{paceAmount}}/mesec) ga pušča {{monthsLate}} mesecev prepozno. Majhni dodatki zdaj prekašajo velike žrtve pozneje.',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: '»{{goal}}« se ne prilega načrtu',
      message:
        'Potrebuje {{requiredAmount}} na mesec, po vaših proračunih pa je prostih le {{freeAmount}}. Spremenite datum, cilj ali proračune — upanje ni načrt.',
    },
    {
      title: '»{{goal}}« prosi za več, kot imate prostega',
      message:
        '{{requiredAmount}} zahtevanih vsak mesec, {{freeAmount}} na voljo. Hoteti vse naenkrat je način, da se ne naredi nič; izberite.',
    },
    {
      title: 'Številke pravijo ne — za zdaj',
      message:
        '»{{goal}}« potrebuje {{requiredAmount}} na mesec; prostega denarja imate {{freeAmount}}. Prilagodite, kar je v vaši moči: rok ali druge omejitve.',
    },
    {
      title: '»{{goal}}« potrebuje odločitev',
      message:
        'Pri {{requiredAmount}} na mesec presega {{freeAmount}}, ki ostanejo po proračunih. Cilj, izbran z odprtimi očmi, je boljši od tistega, ki ga drži pobožna želja.',
    },
    {
      title: 'Nemogoč tempo za »{{goal}}«',
      message:
        'Zahtevano {{requiredAmount}} mesečno, prosto {{freeAmount}}. Poštena aritmetika zdaj prihrani razočaranje pozneje.',
    },
  ],
  'stoic.shortfall': [
    {
      title: 'Vaše stanje gre pod ničlo {{date}}',
      message:
        'Prihajajoča plačila {{committedAmount}} spustijo napovedano stanje na {{lowestAmount}}. Pripravite se zdaj, dokler je le napoved.',
    },
    {
      title: 'Prihaja primanjkljaj: {{date}}',
      message:
        'Zavezana plačila ({{committedAmount}}) prehitijo stanje, najnižje pa je {{lowestAmount}}. Predvideti stisko je način, kako izgubi svojo moč.',
    },
    {
      title: 'Računajte na {{date}}',
      message:
        'Tega dne napovedano stanje doseže {{lowestAmount}}. Premaknite plačilo, zadržite željo ali odložite denar — vse to je danes v vaši moči.',
    },
    {
      title: 'Zaveze presegajo stanje',
      message:
        '{{committedAmount}} zapade in stanje pade na {{lowestAmount}} okoli {{date}}. Mirni odziv je zgodnji.',
    },
    {
      title: 'Predvidite vrzel {{date}}',
      message:
        'Napovedano najnižje stanje: {{lowestAmount}}. Kar je predvideno, je mogoče sprejeti zbrano; kar nas preseneti, redko.',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: 'Držali ste besedo, ki ste jo dali sebi',
      message:
        '{{months}} mesecev zapored je vaša poraba ostala v načrtu, ki ste si ga postavili. Tako je videti samoobvladovanje.',
    },
    {
      title: '{{months}} mesecev v načrtu',
      message:
        'Mesec za mesecem se to, kar ste nameravali, in to, kar ste storili, ujemata. Doslednost je tišja od volje in zdrži dlje.',
    },
    {
      title: 'Načrt in življenje se ujemata',
      message:
        '{{months}} zaporednih mesecev v vaših omejitvah. Načrt, tako dobro držan, ni več omejitev — je način, kako živite.',
    },
    {
      title: 'Stabilno {{months}} mesecev',
      message:
        'Vaši proračuni držijo {{months}} mesecev zapored. Ohranite enako pozornost; deluje.',
    },
    {
      title: 'Disciplina, ohranjena',
      message:
        '{{months}} mesecev brez kršitve vašega načrta. Malo stvari osvobaja tako kot zaupanje v lastne odločitve.',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: 'Vaš denar sledi vašim vrednotam',
      message:
        'Krepost je vzela {{actual}} % vaše porabe — ne manj od {{planned}} %, ki ste jih načrtovali. Dobro porabljeno.',
    },
    {
      title: 'Krepost je dobila svoj polni delež',
      message:
        '{{actual}} % za zdravje, učenje in druge, proti načrtovanim {{planned}} %. Za to, kar cenite, ste plačali.',
    },
    {
      title: 'Porabljeno za to, da postanete boljši',
      message:
        'Krepost je ta mesec dosegla {{actual}} % porabe (načrtovano {{planned}} %). Tisti denar dela za vas še dolgo po tem, ko je odšel.',
    },
    {
      title: 'Namera izvedena',
      message:
        'Načrtovali ste {{planned}} % za krepost in porabili {{actual}} %. Dobri nameni redko preživijo mesec — vaši so.',
    },
    {
      title: 'Najboljša uporaba denarja',
      message: '{{actual}} % je šlo v to, kar izboljšuje vas in druge. Izbirajte to še naprej.',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: 'Prosti čas na svojem mestu',
      message:
        'Prosti čas je {{actual}} % porabe, pod {{planned}} %, ki ste mu jih dovolili. Uživate stvari, ne da bi vas vodile.',
    },
    {
      title: 'Užitek, ohranjen v meri',
      message:
        'Prosti čas je vzel {{actual}} % proti načrtovanim {{planned}} %. Zmernost ni kaj zamuditi — je izbirati.',
    },
    {
      title: 'Počitek brez presežka',
      message:
        '{{actual}} % za prosti čas, pod vašo omejitvijo {{planned}} %. Veselje ima boljši okus, ko ne ukazuje.',
    },
    {
      title: 'Zmernost, tiho',
      message:
        'Prostemu času ste dali {{planned}} %, porabil pa je le {{actual}} %. Ta rezerva je svoboda, ki ste jo ohranili.',
    },
    {
      title: 'Prosti čas pod načrtom',
      message:
        'Pri {{actual}} % porabe je prosti čas ostal pod {{planned}} %, ki ste jih določili. Dobro držano.',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: '{{percent}} % pod načrtom',
      message:
        'Porabili ste {{savedAmount}} manj, kot ste si ta mesec dovolili. Ne potrebovati vsega, kar bi lahko imeli, je vrsta bogastva.',
    },
    {
      title: '{{savedAmount}} je ostalo neporabljenih',
      message:
        'Mesec se je iztekel {{percent}} % pod načrtom. To, česar niste porabili, je še vedno vaše, da z njim razpolagate.',
    },
    {
      title: 'Manj, kot ste dovolili',
      message:
        'Poraba je {{percent}} % pod načrtom — {{savedAmount}} je ostalo. Dajte tej rezervi namen, preden si jo vzame navada.',
    },
    {
      title: 'Načrt je imel rezervo',
      message:
        '{{savedAmount}} pod vašimi omejitvami ta mesec. Zadržanost, ki se zdi lahka, je tista, ki zdrži.',
    },
    {
      title: 'Lažje, kot je bilo načrtovano',
      message:
        'Potrebovali ste {{percent}} % manj, kot ste načrtovali. Razmislite, da bi {{savedAmount}} usmerili k cilju.',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '»{{goal}}« je po načrtu',
      message:
        'Ste {{percent}} % poti, v tempu, ki ga cilj potrebuje. Trdni koraki, narejeni mesečno, sežejo daleč.',
    },
    {
      title: 'Na poti k »{{goal}}«',
      message: '{{percent}} % narejeno in tempo drži. Še naprej plačujte cilj prvi; deluje.',
    },
    {
      title: '»{{goal}}«: {{percent}} % in enakomerno',
      message: 'Cilj vsak mesec dobi, kar potrebuje. Potrpežljivost opravlja svoje.',
    },
    {
      title: 'Cilj se premika po načrtu',
      message:
        '»{{goal}}« je {{percent}} % financiran in pravočasen. Kar se dela po malem vsak mesec, ne ustavi en slab teden.',
    },
    {
      title: 'Napredek, ki mu lahko zaupate',
      message:
        '»{{goal}}« stoji pri {{percent}} %, v tempu. Gradite ga na edini način, ki deluje — postopoma.',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: 'Manj nagonskih nakupov pri {{merchant}}',
      message:
        'Od {{before}} nakupov prejšnji mesec na približno {{after}} ta mesec. Zrahljana navada je pridobljena svoboda.',
    },
    {
      title: '{{merchant}}: {{before}} → {{after}}',
      message:
        'Hodite tja manj kot prej. Vsak preskočen refleks je majhna zmaga izbire nad navado.',
    },
    {
      title: 'Majhna navada se krči',
      message:
        'Nakupi pri {{merchant}} so padli od {{before}} na približno {{after}}. Nadaljujte — postaja lažje.',
    },
    {
      title: 'Izbira pred refleksom',
      message:
        'Pri {{merchant}} ste šli od {{before}} nakupov na približno {{after}}. To je obvladovanje, zgrajeno po eni odločitvi.',
    },
    {
      title: 'Manj malenkosti',
      message:
        '{{merchant}} vas je videl približno {{after}}-krat namesto {{before}}. Majhne zmage se seštevajo.',
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: 'Prilagodili ste se pustejšemu mesecu',
      message:
        'Prihodek je padel za {{incomePercent}} %, vi pa ste porabo zmanjšali za {{expensePercent}} %. Na spremembo sreče ste odgovorili s spremembo smeri.',
    },
    {
      title: 'Mirnost, ko je prihodek upadel',
      message:
        'Prihodek navzdol za {{incomePercent}} %, poraba navzdol za {{expensePercent}} %. Prilagodili ste se temu, kar je, ne temu, kar je bilo.',
    },
    {
      title: 'Sreča se je spremenila; tudi vi',
      message:
        '{{incomePercent}}-odstotni padec prihodka je srečal {{expensePercent}}-odstotni padec porabe. To je ravnodušnost v številkah.',
    },
    {
      title: 'Dobro krmarjeno',
      message:
        'Ko je prihodek padel za {{incomePercent}} %, je poraba sledila (za {{expensePercent}} % manj). Veter ni bil vaš; jadro je bilo.',
    },
    {
      title: 'Poraba je sledila prihodku navzdol',
      message:
        'Porabili ste {{expensePercent}} % manj, ko je prihodek padel za {{incomePercent}} %. Prilagoditi se zgodaj je mirna pot skozi.',
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: 'Nujnosti so stabilne',
      message:
        '{{months}} mesecev se vaši nujni stroški skoraj niso premaknili. Stabilna tla dajejo svobodo nad njimi.',
    },
    {
      title: 'Potrebe pod nadzorom',
      message:
        'Poraba za nujnosti je ostala enaka {{months}} mesecev. Potrebe, ki ne rastejo, so potrebe, ki jih obvladujete.',
    },
    {
      title: '{{months}} mesecev stabilnih nujnosti',
      message:
        'Najemnina, hrana in računi so ostali, kjer so bili. Tiha stabilnost je tudi dosežek.',
    },
    {
      title: 'Nič plazenja pri nujnostih',
      message:
        '{{months}} mesecev brez premika v tem, kar življenje zahteva. Vse drugo je na tej podlagi lažje načrtovati.',
    },
    {
      title: 'Trdna tla',
      message: 'Nujni izdatki so stabilni {{months}} mesecev. Udobij ne spuščate mimo kot potrebe.',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: 'Radodarni s tem, kar zaslužite',
      message:
        'V {{months}} mesecih je {{percent}} % vašega prihodka — {{givenAmount}} — šlo v pomoč drugim. To je denar v najboljši uporabi.',
    },
    {
      title: '{{givenAmount}} danih drugim',
      message:
        'V {{months}} mesecih ste delili {{percent}} % svojega prihodka. Prijaznost, ki se pokaže v številkah, je prijaznost izvajana, ne le občutena.',
    },
    {
      title: 'Odprte roke',
      message:
        'Dobrodelnost in darila so v zadnjem času vzela {{percent}} % vašega prihodka. To, kar daste, je tisti del bogastva, ki ga nobena nesreča ne more vzeti.',
    },
    {
      title: 'Radodarnost je del vašega načrta',
      message:
        '{{givenAmount}} drugim v {{months}} mesecih. Obdržite to — dobro, ki ga storite drugim, je storjeno tudi zase.',
    },
    {
      title: 'Dobro dano',
      message:
        '{{percent}} % tega, kar ste zaslužili, je šlo v pomoč drugim. Malo navad pove o človeku več.',
    },
  ],
  'stoic.praise_steady': [
    {
      title: 'Nič za popravljanje',
      message: 'Vaša poraba ustreza temu, kar ste nameravali. Nadaljujte tako, kot ste.',
    },
    {
      title: 'Namera in dejanje se ujemata',
      message: 'Ta mesec je videti tako, kot ste ga načrtovali. Prav to ujemanje je ves smisel.',
    },
    {
      title: 'Miren mesec',
      message:
        'Nobenega presežka, nobenega zanemarjanja, vrednega omembe. Odlično — nesite enako pozornost naprej.',
    },
    {
      title: 'Vse v redu',
      message:
        'Vaš načrt je zdržal in nič ne prosi za popravek. Uživajte mir, ki ste si ga prislužili.',
    },
    {
      title: 'Trdna roka',
      message: 'Mesec je sledil vašemu načrtu. Dobre navade naredijo dobre mesece videti običajne.',
    },
  ],
  'expert.pay_yourself_first': [
    {
      title: 'Najprej plačajte sebi',
      message:
        'Pravilo Georgea S. Clasona: del vsega, kar zaslužite, je vaš, da ga obdržite — vsaj desetina. V {{months}} mesecih ste obdržali {{savingsPercent}} %. Odložite {{tenthAmount}} tisti dan, ko prihodek pride, pred vsem drugim.',
    },
    {
      title: 'Desetina je vaša, da jo obdržite',
      message:
        'V Najbogatejšem možu v Babilonu je prvo zdravilo za suho mošnjo obdržati en kovanec od vsakih desetih. Vaša stopnja varčevanja je {{savingsPercent}} %; {{tenthAmount}} na mesec bi to navado začelo.',
    },
    {
      title: 'Varčujte, preden porabite, ne potem',
      message:
        'Clasonov nasvet je preprost: najprej plačajte sebi. V zadnjem času vam ostaja {{savingsPercent}} % prihodka. Odložite {{tenthAmount}} na plačilni dan in naj se poraba prilagodi ostanku.',
    },
    {
      title: 'Prvi kovanec je vaš',
      message:
        'Del vsega, kar zaslužite, naj ostane pri vas — ne manj od desetine, pravi Clason. V {{months}} mesecih ste obdržali {{savingsPercent}} %. Začnite z {{tenthAmount}} na mesec, samodejno.',
    },
    {
      title: '{{savingsPercent}} % obdržanih — pravilo prosi za 10 %',
      message:
        'Najprej plačajte sebi, kot pravi Najbogatejši mož v Babilonu: {{tenthAmount}} na mesec, odloženih pred vsakim računom. Varčevanje, opravljeno prvo, ni odvisno od tega, kar ostane.',
    },
  ],
  'expert.rule_50_30_20': [
    {
      title: 'Vaše preverjanje 50/30/20',
      message:
        'Elizabeth Warren in Amelia Warren Tyagi predlagata 50 % prihodka po davkih za nujno, 30 % za želje, 20 % za varčevanje. Vaše: {{needsPercent}} % / {{wantsPercent}} % / {{savingsPercent}} %.',
    },
    {
      title:
        'Potrebe {{needsPercent}} %, želje {{wantsPercent}} %, varčevanje {{savingsPercent}} %',
      message:
        'All Your Worth uravnava denar kot 50/30/20. Primerjajte z načrtom tisto postavko, ki je od svoje oznake najdlje — tam ena sprememba pomaga največ.',
    },
    {
      title: 'Kako se deli vaš prihodek',
      message:
        'Nujno vzame {{needsPercent}} % prihodka, želje {{wantsPercent}} %, {{savingsPercent}} % pa se prihrani. Ravnotežje 50/30/20 iz All Your Worth je uporabno zrcalo, ne sodba.',
    },
    {
      title: 'Uravnotežena denarna formula',
      message:
        'Formula Warren in Tyagi: polovica za to, kar morate plačati, naj se zgodi kar koli, 30 % za želje, 20 % za prihodnost. Vi ste pri {{needsPercent}}/{{wantsPercent}}/{{savingsPercent}}.',
    },
    {
      title: 'Proti 50/30/20',
      message:
        'Vaša razdelitev je {{needsPercent}} % nujno, {{wantsPercent}} % želje, {{savingsPercent}} % varčevanje. Preizkus knjige za nujno: bi to še plačali, če bi jutri izgubili službo?',
    },
  ],
  'expert.room_for_error': [
    {
      title: 'Pustite prostor za napako',
      message:
        'Nasvet Morgana Housela: načrtujte za to, da stvari ne gredo po načrtu. Vaše stanje pokriva približno {{cushionDays}} dni porabe; pogosto vodilo so trije meseci — {{targetAmount}}.',
    },
    {
      title: 'Blazina {{cushionDays}} dni',
      message:
        'The Psychology of Money to imenuje prostor za napako — ohlapnost, ki vam dovoli preživeti presenečenja. Graditi proti {{targetAmount}}, trem mesecem porabe, daje načrtu možnost, da preživi resničnost.',
    },
    {
      title: 'Varnostna rezerva, doma',
      message:
        'Housel si Grahamovo varnostno rezervo sposodi za osebne finance. Z {{cushionDays}} dnevi porabe v rezervi lahko en slab mesec podre dober načrt. Merite na {{targetAmount}}.',
    },
    {
      title: 'Prostor za nepričakovano',
      message:
        'Vaša rezerva bi zdržala približno {{cushionDays}} dni. Presenečenja so edina gotovost; trije meseci porabe ({{targetAmount}}) so pogosto uporabljen cilj.',
    },
    {
      title: 'Zgradite ohlapnost, preden jo potrebujete',
      message:
        'Prostor za napako je, z besedami Morgana Housela, tisto, kar vas drži v igri. Pokritih imate približno {{cushionDays}} dni; {{targetAmount}} bi pokrilo tri mesece.',
    },
  ],
  'expert.lifestyle_creep': [
    {
      title: 'Poraba prehiteva prihodek',
      message:
        'Poraba je v zadnjem četrtletju zrasla za {{expenseGrowth}} %, prihodek pa se je spremenil za {{incomeGrowth}} %. Prvo pravilo The Millionaire Next Door: kakršen koli je vaš prihodek, živite pod svojimi zmožnostmi.',
    },
    {
      title: 'Živi se višje, ne bogateje',
      message:
        'Stanley in Danko sta ugotovila, da je bogastvo tisto, kar nakopičite, ne tisto, kar porabite. Vaša poraba je zrasla za {{expenseGrowth}} %, prihodek za {{incomeGrowth}} % — v tej vrzeli bogastvo pušča.',
    },
    {
      title: 'Plazenje življenjskega sloga: +{{expenseGrowth}} %',
      message:
        'Izdatki so se vzpenjali hitreje od prihodka ({{incomeGrowth}} %). Ljudje iz The Millionaire Next Door so ostali premožni, ker so pustili prihodku rasti, porabi pa ne.',
    },
    {
      title: 'Vratnice se premikajo',
      message:
        'Poraba je med četrtletji višja za {{expenseGrowth}} % proti {{incomeGrowth}} % pri prihodku. Živite pod svojimi zmožnostmi, pravita Stanley in Danko — kakršne koli zmožnosti so.',
    },
    {
      title: 'Bogastvo je to, kar obdržite',
      message:
        'Dober prihodek, porabljen v celoti, nikogar ne naredi premožnejšega. V zadnjem četrtletju je vaša poraba zrasla za {{expenseGrowth}} % in prihodek za {{incomeGrowth}} % — vredno pogleda, preden postane novo normalno.',
    },
  ],
  'expert.life_energy': [
    {
      title: '{{merchant}} je stal {{hours}} ur vašega življenja',
      message:
        'Vicki Robin in Joe Dominguez predlagata, da stvari cenimo v življenjski energiji — v urah dela, ki jih stanejo. {{totalAmount}} pri {{merchant}} ta mesec je približno {{hours}} ur. Je bilo tega vredno?',
    },
    {
      title: '{{hours}} ur pri {{merchant}}',
      message:
        'Your Money or Your Life vas vabi, da denar vidite kot čas, ki ste ga zanj zamenjali. Pri vašem povprečnem urnem prihodku {{totalAmount}} tam ustreza približno {{hours}} delovnim uram.',
    },
    {
      title: 'Ocenite to v urah',
      message:
        '{{totalAmount}} pri {{merchant}} je približno {{hours}} ur dela. Robin in Dominguez to imenujeta življenjska energija — edina valuta, ki je ni mogoče zaslužiti nazaj.',
    },
    {
      title: 'Kaj je {{merchant}} zares stal',
      message:
        'Denar je nekaj, za kar zamenjamo svojo življenjsko energijo. Ta mesec je {{merchant}} vzel približno {{hours}} ur vaše ({{totalAmount}}). Ali užitek ustreza tem uram?',
    },
    {
      title: 'Preverjanje življenjske energije',
      message:
        'Pretvorjeno po vašem povprečnem urnem prihodku je {{totalAmount}}, porabljenih pri {{merchant}}, približno {{hours}} ur. Your Money or Your Life predlaga vprašanje, ali je to prineslo sorazmerno izpolnitev.',
    },
  ],
};
