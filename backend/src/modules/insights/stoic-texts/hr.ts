import type { StoicTextMap } from './types';

export const hr: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: 'Mjesec je prerastao svoj plan',
      message:
        'Planirali ste {{plannedAmount}} a potrošili {{spentAmount}} — {{percent}} % više. Plan je nastao hladne glave; pustite ga da govori glasnije od trenutka.',
    },
    {
      title: '{{percent}} % iznad onoga što ste namjeravali potrošiti',
      message:
        'Troškovi stoje na {{spentAmount}} prema planu od {{plannedAmount}}. Pogledajte koje je ograničenje prvo popustilo — tu je nauk.',
    },
    {
      title: 'Vaš plan i vaš mjesec se ne slažu',
      message:
        '{{spentAmount}} potrošeno, {{plannedAmount}} namjeravano. Ili je plan od stvarnosti tražio previše malo, ili je stvarnost od vas previše — mirno odlučite što od toga.',
    },
    {
      title: 'Izašlo je više nego ste dopustili',
      message:
        'Mjesec je {{percent}} % iznad {{plannedAmount}} koje ste postavili. Ako sada stanete, ništa nije izgubljeno; ako se pravite da se nije dogodilo, izgubljeno je mnogo.',
    },
    {
      title: 'Granica koju ste postavili, granica koju ste prešli',
      message:
        'Namjeravali ste potrošiti {{plannedAmount}}; iznos je {{spentAmount}}. Samokontrola nije nikad se ne spotaknuti — to je primijetiti rano i vratiti se na put.',
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: 'Slobodno vrijeme uzima više nego ste planirali',
      message:
        'Htjeli ste da slobodno vrijeme bude {{planned}} % troškova; ovaj je mjesec {{actual}} %. Užitak je dobrodošao kao gost, ne kao gospodar kuće.',
    },
    {
      title: 'Slobodno vrijeme na {{actual}} %, planirano {{planned}} %',
      message:
        'Odmor zasluži svoje mjesto kad vas obnovi. Pitajte se koji su užici ovog mjeseca to učinili, a ostale pustite bez žaljenja.',
    },
    {
      title: 'Udobnost troši više od namjere',
      message:
        'Slobodno vrijeme drži {{actual}} % troškova prema {{planned}} % koje ste odabrali. Umjerenost nije odbijanje užitka — to je držanje njegove odabrane mjere.',
    },
    {
      title: 'Prijatno istiskuje planirano',
      message:
        'Slobodnom ste vremenu dali {{planned}} % plana, a ono je uzelo {{actual}} %. Ono što uživate bez truda vrijedi drugog pogleda prije nego postane ono što vam treba.',
    },
    {
      title: 'Slobodno vrijeme prešlo je svoju crtu',
      message:
        '{{actual}} % mjeseca otišlo je na slobodno vrijeme, {{planned}} % bila je namjera. Crta je bila vaša da je nacrtate i vaša je da je držite.',
    },
  ],
  'stoic.leisure_habit': [
    {
      title: 'Slobodno vrijeme opet nad planom',
      message:
        'Slobodno vrijeme prešlo je vaš plan u {{months}} od posljednjih {{window}} mjeseci. Ponavljanje više nije nezgoda — to je navika koju vrijedi pregledati.',
    },
    {
      title: '{{months}} od {{window}} mjeseci nad planom slobodnog vremena',
      message:
        'Ono što se dogodi jednom su okolnosti; ono što se dogodi {{months}} puta jest karakter u nastajanju. Odaberite karakter namjerno.',
    },
    {
      title: 'Isti posrtaj, mjesec za mjesecom',
      message:
        'Slobodno vrijeme prešlo je plan u {{months}} od {{window}} mjeseci. Podignite plan iskreno ili promijenite naviku — živjeti između toga najviše košta.',
    },
    {
      title: 'Uzorak, ne izuzetak',
      message:
        'U {{months}} od posljednjih {{window}} mjeseci slobodno je vrijeme uzelo više nego ste mu dali. Primijetite trenutak kad se odluka donosi, ne samo račun poslije.',
    },
    {
      title: 'Navika glasuje protiv vašeg plana',
      message:
        'Slobodno je vrijeme pobijedilo plan {{months}} puta u {{window}} mjeseci. Navike se grade po jednom izboru; isto se i razgrađuju.',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: 'Krepost dobiva manje nego ste namjeravali',
      message:
        'Odvojili ste {{planned}} % proračuna za zdravlje, učenje i druge; dosad je {{actual}} %. Namjera se računa kad je izvedena.',
    },
    {
      title: 'Krepost na {{actual}} % od planiranih {{planned}} %',
      message:
        'Novac koji ste namijenili onomu što vas čini boljim još čeka. Boljeg vremena da ga dobro potrošite od ovog mjeseca nema.',
    },
    {
      title: 'Dobro koje ste planirali je nepotrošeno',
      message:
        'Zdravlje, učenje i darežljivost trebali su dobiti {{planned}} % troškova; dobili su {{actual}} %. Učinite jedno od toga ovaj tjedan, namjerno.',
    },
    {
      title: 'Namjera bez djela',
      message:
        'Krepost drži {{actual}} % troškova prema {{planned}} % koje ste odabrali. Ono što cijenimo pokazuje se u onome za što zaista plaćamo.',
    },
    {
      title: 'Ostalo je mjesta za ono što je važno',
      message:
        'Na krepost je otišlo samo {{actual}} %, iako ste planirali {{planned}} %. Knjiga, pregled kod liječnika, dar nekome u potrebi — plan je već rekao da.',
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: 'Krepost se stalno odgađa',
      message:
        'Troškovi za zdravlje, učenje i druge ostaju pod vašim planom već {{months}} mjeseci u nizu. Ono što stalno odgađate, u stvarnosti ste odbili.',
    },
    {
      title: '{{months}} mjeseci odgođene kreposti',
      message:
        'Svaki je mjesec plan ostavio mjesta za ono što vas čini boljim i svaki je mjesec ostalo neiskorišteno. Vrijeme je ono jedino što se ne može planirati dvaput.',
    },
    {
      title: 'Bolje ja još čeka',
      message:
        'Krepost je pod planom {{months}} mjeseci zaredom. Počnite malo i sigurno, a ne veliko i kasnije.',
    },
    {
      title: 'Dobre namjere stare',
      message:
        '{{months}} mjeseci su zdravlje, učenje i darežljivost dobivali manje nego ste planirali. Odaberite jedno i idući mjesec ga platite prvo, prije svega drugog.',
    },
    {
      title: 'Krepost stalno gubi od „kasnije“',
      message:
        '{{months}} mjeseci zaredom pod planom. Kasnije je mjesto kamo dobre namjere odlaze da budu zaboravljene — ovoj dajte datum.',
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: 'Vaš plan nema mjesta za krepost',
      message:
        'Nijedan od vaših proračuna ne služi zdravlju, učenju ni drugima. Plan pokazuje što cijenimo — razmislite da kreposti date vlastiti red.',
    },
    {
      title: 'Svi proračuni, ali nijedan za dobro',
      message:
        'Nužnost, rad i slobodno vrijeme imaju granice; krepost nema nijednu. Ono što se nikad ne planira obično se nikad i ne dogodi.',
    },
    {
      title: 'Planirajte ono što vas čini boljim',
      message:
        'U razredu kreposti još nema nijednog proračuna. I mali — knjige, sport, donacija — želju pretvara u obvezu.',
    },
    {
      title: 'Plan o kreposti ne govori',
      message:
        'Planirate za ono što morate i za ono što uživate, još ne za onoga kim želite postati. Jedan skroman proračun za krepost to bi promijenio.',
    },
    {
      title: 'Krepost nema proračun',
      message:
        'Trošenje na zdravlje, učenje ili druge nije planirano nigdje. Odaberite jedno i dajte mu granicu koju biste rado dosegnuli.',
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: 'Nužnosti koštaju više nego je planirano',
      message:
        'Planirali ste {{planned}} % troškova za nužnosti; uzimaju {{actual}} %. Provjerite je li svaka još potreba ili je tiho postala udobnost.',
    },
    {
      title: 'Nužnost na {{actual}} %, planirano {{planned}} %',
      message:
        'Ono što život zahtijeva obično je manje od onoga na što se naviknemo. Pregledajte najveću nužnost svježim okom.',
    },
    {
      title: 'Nužno se naduva',
      message:
        'Nužnosti drže {{actual}} % mjeseca prema {{planned}} % koje ste očekivali. Potreba koja nastavlja rasti zaslužuje pitanje.',
    },
    {
      title: 'Potrebe prerastaju plan',
      message:
        'Planirano {{planned}} %, stvarno {{actual}} %. Ili je plan podcijenio prave troškove, ili neke želje putuju pod imenom potreba.',
    },
    {
      title: 'Na „moram“ je otišlo više nego je mišljeno',
      message:
        'Nužnosti su uzele {{actual}} % troškova umjesto {{planned}} %. Odvojite ono što zaista mora biti od onoga što je samo uvijek bilo.',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: 'Nužnosti se penju',
      message:
        'Troškovi za nužnosti rastu {{months}} mjeseci u nizu, ukupno {{percent}} %. Potrebe tiho rastu kad ih nitko ne traži da se opravdaju.',
    },
    {
      title: '+{{percent}} % na nužnostima u {{months}} mjeseci',
      message:
        'Svaki je korak izgledao mali; zajedno nisu. Uzmite najveću ponavljajuću nužnost i pitajte mora li još koštati toliko.',
    },
    {
      title: 'Pod vaših troškova se diže',
      message:
        'Nužnosti su rasle {{months}} mjeseci zaredom (+{{percent}} %). Rastući pod ostavlja manje mjesta za sve što slobodno odaberete.',
    },
    {
      title: 'Potrebe se šire',
      message:
        '{{months}} mjeseci rasta, ukupno {{percent}} %. Stoička je proba jednostavna: biste li to danas odabrali ponovno, znajući cijenu?',
    },
    {
      title: 'Mali rastovi, stalan smjer',
      message:
        'Nužnosti su u {{months}} mjeseci više za {{percent}} %. Smjer znači više od pojedinog mjeseca — ovaj vrijedi ispraviti rano.',
    },
  ],
  'stoic.work_over_plan': [
    {
      title: 'Rad košta više nego je planirano',
      message:
        'Planirali ste {{planned}} % troškova za rad; uzima {{actual}} %. Alati i usluge moraju zaslužiti svoje mjesto — provjerite koji ga zaslužuju.',
    },
    {
      title: 'Troškovi rada na {{actual}} %, planirano {{planned}} %',
      message:
        'Ulaganje u rad dobro je kad nešto vraća. Pregledajte za što plaćate, a više ne koristite.',
    },
    {
      title: 'Proračun za rad je napet',
      message:
        'Rad je uzeo {{actual}} % umjesto {{planned}} %. Radišnost je raditi dobro, ne kupiti svaki alat za to.',
    },
    {
      title: 'Alati troše nad planom',
      message:
        'Planirano {{planned}} %, potrošeno {{actual}} % na rad. Za svaki trošak pitajte: pomaže li mi raditi, ili samo izgleda kao napredak?',
    },
    {
      title: 'Troškovi rada su se pomaknuli',
      message:
        'Rad drži {{actual}} % troškova prema namjeravanih {{planned}} %. Brz pregled sada štedi veći kasnije.',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '„{{category}}“ stalno lomi svoju granicu',
      message:
        '„{{category}}“ je prešla proračun u {{months}} od posljednjih {{window}} mjeseci. Ili je granica pogrešna, ili je želja — odlučite što od toga.',
    },
    {
      title: '„{{category}}“: nad proračunom {{months}} od {{window}} mjeseci',
      message:
        'Granica koja se uvijek prelazi nije granica, samo želja. Učinite je iskrenom — podignite je namjerno ili je namjerno držite.',
    },
    {
      title: 'Isti proračun opet popušta',
      message:
        '„{{category}}“ je prešla svoju granicu {{months}} puta u {{window}} mjeseci. Ponavljanje je informacija; iskoristite je.',
    },
    {
      title: '„{{category}}“ traži vašu pozornost',
      message:
        'Nad proračunom u {{months}} od {{window}} mjeseci. Gledajte trenutak prije kupnje — to je jedino mjesto gdje se navika može promijeniti.',
    },
    {
      title: 'Uzorak u „{{category}}“',
      message:
        '{{months}} prekoračenja u {{window}} mjeseci. Ono što ponavljamo, to postajemo; odlučite što želite da ova kategorija govori o vama.',
    },
  ],
  'stoic.budget_pace': [
    {
      title: '„{{category}}“ se iscrpi oko dana {{day}}',
      message:
        'Potrošili ste {{spentAmount}} od {{limitAmount}} i ovim tempom granica se završava oko dana {{day}}. Usporiti sada lakše je od zaustavljanja kasnije.',
    },
    {
      title: '„{{category}}“ je ispred mjeseca',
      message:
        '{{spentAmount}} je već otišlo od granice {{limitAmount}}. Ovim će tempom biti iscrpljena oko dana {{day}} — ostatak mjeseca ipak je vaš.',
    },
    {
      title: 'Provjera tempa: „{{category}}“',
      message:
        'Proračun od {{limitAmount}} pri sadašnjem tempu traje do oko dana {{day}}. Predviđanje je najjeftinija vrsta discipline.',
    },
    {
      title: '„{{category}}“ troši budućnost',
      message:
        '{{spentAmount}} od {{limitAmount}} potrošeno; granica se završava blizu dana {{day}}. Što učinite ovaj tjedan, odlučuje hoće li se to dogoditi.',
    },
    {
      title: 'Rano upozorenje za „{{category}}“',
      message:
        'Pri sadašnjem tempu granica od {{limitAmount}} neće dosegnuti kraj mjeseca — iscrpi se oko dana {{day}}. Prilagodite dok je jeftino.',
    },
  ],
  'stoic.budget_unused': [
    {
      title: '„{{category}}“ je ostala neiskorištena',
      message:
        'Proračun za „{{category}}“ nije zabilježio trošenje već {{months}} mjeseci. Ili ste ga prerasli, ili je namjera koja još čeka — odlučite što od toga.',
    },
    {
      title: 'Prazan proračun: „{{category}}“',
      message:
        '{{months}} mjeseci bez jednog jedinog troška. Plan treba opisivati život koji živite ili onaj koji gradite — koji je ovo?',
    },
    {
      title: '„{{category}}“ stoji neiskorištena',
      message:
        'Tu nije potrošeno ništa {{months}} mjeseci. Ako je to bila suzdržanost, bravo; ako nemar, učinite nešto.',
    },
    {
      title: 'Planirano, ali neproživljeno',
      message:
        '„{{category}}“ ima granicu i nikakvo trošenje već {{months}} mjeseci. Zadržite plan istinitim: uklonite je ili je iskoristite.',
    },
    {
      title: '„{{category}}“: {{months}} tihih mjeseci',
      message:
        'Proračun koji se nikad ne dotiče još zauzima mjesto u vašem planu. Oslobodite mjesto ili namjeru ispunite.',
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: '{{percent}} % troškova nema granicu',
      message:
        '{{unbudgetedAmount}} je ovaj mjesec otišlo u kategorije koje ne prati nijedan proračun. Ono što se ne mjeri teško je ovladati.',
    },
    {
      title: 'Velik dio mjeseca je neplaniran',
      message:
        '{{percent}} % troškova — {{unbudgetedAmount}} — leži izvan svih proračuna. Dajte najvećem dijelu granicu i plan će vidjeti više vašeg života.',
    },
    {
      title: 'Trošenje izvan plana',
      message:
        'Proračuni pokrivaju samo dio onoga što trošite; {{unbudgetedAmount}} ({{percent}} %) ostaje neizmjereno. Proširite plan tamo kamo novac zaista ide.',
    },
    {
      title: 'Plan vidi samo dio slike',
      message:
        '{{percent}} % troškova ovog mjeseca nema proračun. Jasan pogled dolazi prije dobre prosudbe.',
    },
    {
      title: '{{unbudgetedAmount}} potrošeno bez granice',
      message:
        'To je {{percent}} % mjeseca. Ne morate to ograničiti — samo odlučiti koliko toga zaista želite.',
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '„{{category}}“ je većina vašeg slobodnog vremena',
      message:
        '{{percent}} % troškova za slobodno vrijeme otišlo je na „{{category}}“. Raznolikost u odmoru zdravija je od zavisnosti o jednom užitku.',
    },
    {
      title: 'Jedan užitak prevladava',
      message:
        '„{{category}}“ uzima {{percent}} % svega što ste potrošili na slobodno vrijeme. Pitajte se veseli li vas još ili je postala rutina.',
    },
    {
      title: 'Slobodno se vrijeme naslanja na „{{category}}“',
      message:
        '{{percent}} % slobodnog vremena na jednom mjestu. Ono bez čega ne možemo drži nas — provjerite je li hvat još lagan.',
    },
    {
      title: '„{{category}}“: {{percent}} % slobodnog vremena',
      message:
        'Jedan jedini izvor radosti uzima gotovo sve. Pokušajte ovaj mjesec jedan jeftiniji, drukčiji užitak i usporedite.',
    },
    {
      title: 'Vaš odmor ima jednu adresu',
      message:
        'Većina novca za slobodno vrijeme — {{percent}} % — ide na „{{category}}“. Sloboda uključuje i mogućnost uživanja u nečemu drugom.',
    },
  ],
  'stoic.unclassified': [
    {
      title: 'Dio troškova još nije ocijenjen',
      message:
        '{{count}} kategorija nema razred. U Proračunima odlučite što je nužnost, rad, krepost ili slobodno vrijeme.',
    },
    {
      title: '{{count}} kategorija čeka vašu ocjenu',
      message:
        'Imaju troškove ali nikakav razred, pa ih savjeti ne mogu vagati. Minuta u Proračunima to rješava.',
    },
    {
      title: 'Nazovite ono čemu vaš novac služi',
      message:
        '{{count}} kategorija još je nerazvrstano. Prosudba počinje time da stvari zovemo pravim imenima.',
    },
    {
      title: 'Neocijenjeni troškovi: {{count}} kategorija',
      message:
        'Je li to potreba, vaš rad, krepost ili užitak? Reći možete samo vi — i plan se time razbistri.',
    },
    {
      title: 'Nekoliko kategorija nema razred',
      message:
        '{{count}} kategorija stoji izvan četiri razreda. Razvrstajte ih u Proračunima da svaki trošak bude viđen onim što je.',
    },
  ],
  'stoic.small_purchases': [
    {
      title: '{{count}} malih kupnji kod {{merchant}}',
      message:
        'Svaka je izgledala nevažno; zajedno su ovaj mjesec iznosile {{totalAmount}}. Male, nepregledane navike mjesto su kamo tiho odlazi većina novca.',
    },
    {
      title: '{{merchant}}: {{count}} puta ovaj mjesec',
      message:
        '{{totalAmount}} u malim iznosima. Pitajte se je li svaki posjet bio izbor ili refleks — sloboda je samo prvo.',
    },
    {
      title: 'Pomalo: {{totalAmount}}',
      message:
        '{{count}} kupnji kod {{merchant}}. Nijedna pojedinačno nije važna; navika jest. Odlučite koliko često to zaista želite.',
    },
    {
      title: 'Navika kod {{merchant}}',
      message:
        '{{count}} kupnji, ukupno {{totalAmount}}. Pokušajte ovaj mjesec svaku treću preskočiti i vidjeti hoće li vam nedostajati.',
    },
    {
      title: 'Male se stvari zbrajaju',
      message:
        '{{merchant}} vas je vidio {{count}} puta, za {{totalAmount}}. Vladanje velikim odlukama gradi se na takvim malima.',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: 'Vikendi nose {{percent}} % slobodnog vremena',
      message:
        'Većina vaših troškova za slobodno vrijeme pada u subotu i nedjelju. Odmor je dobar; provjerite je li odmor, a ne nadoknada za tjedan.',
    },
    {
      title: 'Slobodno vrijeme živi na vikendu',
      message:
        '{{percent}} % troškova za slobodno vrijeme pada na vikend. Planirajte vikend malo i koštat će manje te dati više.',
    },
    {
      title: 'Vikend plaća za tjedan',
      message:
        'Vikendi uzimaju {{percent}} % onoga što trošite na slobodno vrijeme. Ako tjedan treba popravljati svake subote, pogledajte tjedan.',
    },
    {
      title: 'Subota i nedjelja: {{percent}} % slobodnog vremena',
      message:
        'Slobodni dani zovu na slobodno trošenje. Odlučite prije vikenda čemu je namijenjen i pustite novac da slijedi.',
    },
    {
      title: 'Vikend uzorak',
      message:
        '{{percent}} % troškova za slobodno vrijeme događa se na vikendu. Lakši radni dani često čine vikende jeftinijima.',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}} je uzeo {{percent}} % mjeseca',
      message:
        '{{totalAmount}} je otišlo jednom trgovcu za slobodno vrijeme. Kad jedno mjesto ima toliko vašeg novca, pitajte koliko ima i vaše pozornosti.',
    },
    {
      title: 'Jedno mjesto, {{totalAmount}}',
      message:
        '{{merchant}} je {{percent}} % troškova ovog mjeseca. Vrijedi li tog dijela rada vašeg života?',
    },
    {
      title: '{{merchant}} vodi vaše troškove',
      message:
        '{{percent}} % mjeseca — {{totalAmount}} — otišlo je tamo. Ništa nije pogrešno u uživanju, dok biste to odabrali ponovno.',
    },
    {
      title: 'Velik dio kod {{merchant}}',
      message:
        '{{totalAmount}}, odnosno {{percent}} % troškova, na jednom mjestu slobodnog vremena. Mirno odvagnite užitak prema cijeni.',
    },
    {
      title: '{{percent}} % kod {{merchant}}',
      message:
        'Taj je jedan trgovac uzeo {{totalAmount}}. Sloboda je moći proći pokraj kad tako odlučite.',
    },
  ],
  'stoic.income_drop': [
    {
      title: 'Prihod je pao, troškovi nisu',
      message:
        'Prihod je pao {{percent}} % na {{incomeAmount}}, ali su troškovi ostali na {{expenseAmount}}. Sreća se predomislila; vaši troškovi to još nisu primijetili.',
    },
    {
      title: 'Prihod niže za {{percent}} %',
      message:
        '{{incomeAmount}} je ušlo prema {{expenseAmount}} izlaza. Što sreća dade, može i uzeti — uskladite troškove s onim što jest, ne s onim što je bilo.',
    },
    {
      title: 'Mršaviji mjesec, iste navike',
      message:
        'Prihod je {{percent}} % niži ({{incomeAmount}}), a troškovi su ostali na {{expenseAmount}}. Prihod nije u vašoj moći; odgovor jest.',
    },
    {
      title: 'Sreća se pomaknula',
      message:
        'Zaradili ste {{percent}} % manje nego obično, ali potrošili {{expenseAmount}} kao i prije. Smanjite sada, dok je to izbor a ne nužda.',
    },
    {
      title: 'Troškovi nisu slijedili prihod',
      message:
        'Prihod je pao na {{incomeAmount}} ({{percent}} % niže); troškovi su {{expenseAmount}}. Postavite jedro prema vjetru koji zaista imate.',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: 'Pretplate: {{monthlyAmount}} mjesečno',
      message:
        '{{count}} pretplata uzima {{percent}} % vaših mjesečnih troškova. Svaka se obnavlja bez da vas pita — pitajte se o svakoj sami.',
    },
    {
      title: '{{percent}} % troškova obnavlja se samo',
      message:
        '{{count}} pretplata, {{monthlyAmount}} mjesečno. Zadržite one na koje biste se danas ponovno prijavili.',
    },
    {
      title: 'Tiho, ponavljajuće, {{monthlyAmount}}',
      message:
        '{{count}} pretplata košta {{percent}} % vašeg mjeseca. Udobnost je dobar sluga i skup gospodar.',
    },
    {
      title: '{{count}} pretplata za pregled',
      message:
        'Zajedno su {{monthlyAmount}} mjesečno, {{percent}} % troškova. Otkažite jednu koju gotovo ne koristite i primijetite kako vam malo nedostaje.',
    },
    {
      title: 'Ono što se obnavlja samo',
      message:
        '{{monthlyAmount}} mjesečno kroz {{count}} pretplata. Automatsko trošenje zaslužuje namjeran pregled.',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: 'Vaš bi uspjeh mogao dosegnuti malo dalje',
      message:
        'Kroz {{months}} mjeseci zadržali ste {{savingsPercent}} % prihoda, a drugima je od toga otišlo gotovo ništa. Bogatstvo najbolje sjedi u otvorenim rukama — možda jedan dar ili donacija ovaj mjesec?',
    },
    {
      title: 'Dobro zarađuje, malo daje',
      message:
        '{{incomeAmount}} je ušlo kroz {{months}} mjeseci, a {{givenAmount}} je otišlo drugima. Pomažete li na načine koje ova aplikacija ne vidi, zanemarite ovo; ako ne, plan za to ima mjesta.',
    },
    {
      title: 'Dobra godina za darežljivost',
      message:
        'Uštedjeli ste {{savingsPercent}} % prihoda — znak čvrste ruke. Mali dio toga, dan nekomu u potrebi, dao bi toj čvrstoći više značenja.',
    },
    {
      title: 'Na slici još nema nikog drugog',
      message:
        'Posljednjih {{months}} mjeseci pokazuje brižno zarađivanje i štednju, ali nikakvu dobrotvornost ni darove. Stvoreni smo jedan za drugoga; skroman dar dovoljan je za početak.',
    },
    {
      title: 'Mjesto za dobrotu',
      message:
        'Na pomoć drugima otišlo je samo {{givenAmount}} od {{incomeAmount}}. Razmislite o maloj, redovnoj donaciji — darežljivost s navikom postaje lakša, kao i svaka krepost.',
    },
  ],
  'stoic.goal_behind': [
    {
      title: '„{{goal}}“ zaostaje',
      message:
        'Treba {{requiredAmount}} mjesečno, a vi ulažete oko {{paceAmount}}. Ovim će tempom doći {{monthsLate}} mjeseci kasnije.',
    },
    {
      title: '„{{goal}}“: {{monthsLate}} mjeseci kasnije ovim tempom',
      message:
        'Potrebno {{requiredAmount}} mjesečno, stvarno oko {{paceAmount}}. Pomaknite datum iskreno ili namjerno pomaknite više novca.',
    },
    {
      title: 'Cilj i tempo se ne slažu',
      message:
        '„{{goal}}“ traži {{requiredAmount}} mjesečno; dobiva {{paceAmount}}. Cilj je stvaran samo toliko kao mjesečni korak prema njemu.',
    },
    {
      title: '„{{goal}}“ treba čvršći korak',
      message:
        '{{paceAmount}} mjesečno prema {{requiredAmount}} koje treba. Idući mjesec platite cilj prvi, prije svega neobveznog.',
    },
    {
      title: 'Zaostatak kod „{{goal}}“',
      message:
        'Sadašnji tempo ({{paceAmount}}/mjesec) ostavlja ga {{monthsLate}} mjeseci kasnim. Mali dodaci sada nadmašuju velike žrtve kasnije.',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: '„{{goal}}“ ne staje u plan',
      message:
        'Treba {{requiredAmount}} mjesečno, ali nakon vaših proračuna slobodno je samo {{freeAmount}}. Promijenite datum, cilj ili proračune — nadati se nije plan.',
    },
    {
      title: '„{{goal}}“ traži više nego imate slobodno',
      message:
        '{{requiredAmount}} potrebno svaki mjesec, {{freeAmount}} dostupno. Htjeti sve odjednom način je da se ne učini ništa; odaberite.',
    },
    {
      title: 'Brojevi kažu ne — za sada',
      message:
        '„{{goal}}“ treba {{requiredAmount}} mjesečno; slobodnog novca imate {{freeAmount}}. Prilagodite ono što je u vašoj moći: rok ili ostale granice.',
    },
    {
      title: '„{{goal}}“ traži odluku',
      message:
        'Pri {{requiredAmount}} mjesečno prelazi {{freeAmount}} koje ostaju nakon proračuna. Cilj odabran otvorenih očiju bolji je od onoga koji drži puko željenje.',
    },
    {
      title: 'Nemoguć tempo za „{{goal}}“',
      message:
        'Potrebno {{requiredAmount}} mjesečno, slobodno {{freeAmount}}. Iskrena aritmetika sada štedi razočaranje kasnije.',
    },
  ],
  'stoic.shortfall': [
    {
      title: 'Vaše stanje pada pod nulu {{date}}',
      message:
        'Dolazeća plaćanja od {{committedAmount}} spuštaju predviđeno stanje na {{lowestAmount}}. Pripremite se sada, dok je to samo prognoza.',
    },
    {
      title: 'Dolazi manjak: {{date}}',
      message:
        'Obvezana plaćanja ({{committedAmount}}) prestižu stanje, a najniže je {{lowestAmount}}. Predvidjeti tegobu način je kako ona gubi moć.',
    },
    {
      title: 'Računajte na {{date}}',
      message:
        'Tog dana predviđeno stanje dosegne {{lowestAmount}}. Pomaknite plaćanje, zadržite želju ili odvojite novac — svako je od toga danas u vašoj moći.',
    },
    {
      title: 'Obveze prelaze stanje',
      message:
        '{{committedAmount}} dospijeva, a stanje pada na {{lowestAmount}} oko {{date}}. Mirni je odgovor rani.',
    },
    {
      title: 'Predvidite prazninu {{date}}',
      message:
        'Predviđeno najniže stanje: {{lowestAmount}}. Ono što je predviđeno može se primiti smireno; ono što nas iznenadi, rijetko.',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: 'Održali ste riječ danu sebi',
      message:
        '{{months}} mjeseci zaredom vaši su troškovi ostali u planu koji ste postavili. Tako izgleda samokontrola.',
    },
    {
      title: '{{months}} mjeseci u planu',
      message:
        'Mjesec za mjesecom ono što ste namjeravali i ono što ste učinili slažu se. Dosljednost je tiša od volje i traje dulje.',
    },
    {
      title: 'Plan i život se slažu',
      message:
        '{{months}} uzastopnih mjeseci u vašim granicama. Plan tako dobro držan više nije ograničenje — to je način kako živite.',
    },
    {
      title: 'Stabilno {{months}} mjeseci',
      message: 'Vaši proračuni drže {{months}} mjeseci u nizu. Zadržite istu pozornost; djeluje.',
    },
    {
      title: 'Disciplina, održana',
      message:
        '{{months}} mjeseci bez kršenja vašeg plana. Malo stvari oslobađa kao povjerenje u vlastite odluke.',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: 'Vaš novac slijedi vaše vrijednosti',
      message:
        'Krepost je uzela {{actual}} % vaših troškova — ne manje od {{planned}} % koje ste planirali. Dobro potrošeno.',
    },
    {
      title: 'Krepost je dobila svoj puni dio',
      message:
        '{{actual}} % na zdravlje, učenje i druge, prema planiranih {{planned}} %. Za ono što cijenite, platili ste.',
    },
    {
      title: 'Potrošeno na to da budete bolji',
      message:
        'Krepost je ovaj mjesec dosegla {{actual}} % troškova (planirano {{planned}} %). Taj novac radi za vas dugo nakon što je otišao.',
    },
    {
      title: 'Namjera izvedena',
      message:
        'Planirali ste {{planned}} % za krepost i potrošili {{actual}} %. Dobre namjere rijetko prežive mjesec — vaše jesu.',
    },
    {
      title: 'Najbolja upotreba novca',
      message:
        '{{actual}} % otišlo je na ono što vas i druge čini boljima. Nastavite to odabirati.',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: 'Slobodno vrijeme na svom mjestu',
      message:
        'Slobodno vrijeme je {{actual}} % troškova, pod {{planned}} % koje ste mu dopustili. Uživate u stvarima bez da vas vode.',
    },
    {
      title: 'Užitak, zadržan u mjeri',
      message:
        'Slobodno vrijeme uzelo je {{actual}} % prema planiranih {{planned}} %. Umjerenost nije propustiti nešto — to je odabrati.',
    },
    {
      title: 'Odmor bez pretjerivanja',
      message:
        '{{actual}} % na slobodno vrijeme, pod vašom granicom od {{planned}} %. Radost je bolja kad ne zapovijeda.',
    },
    {
      title: 'Umjerenost, tiho',
      message:
        'Slobodnom ste vremenu dali {{planned}} %, a ono je iskoristilo samo {{actual}} %. Ta je rezerva sloboda koju ste zadržali.',
    },
    {
      title: 'Slobodno vrijeme pod planom',
      message:
        'S {{actual}} % troškova slobodno je vrijeme ostalo pod {{planned}} % koje ste postavili. Dobro održano.',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: '{{percent}} % pod planom',
      message:
        'Potrošili ste {{savedAmount}} manje nego ste si ovaj mjesec dopustili. Ne trebati sve što biste mogli imati vrsta je bogatstva.',
    },
    {
      title: '{{savedAmount}} ostalo nepotrošeno',
      message:
        'Mjesec je završio {{percent}} % pod planom. Ono što niste potrošili još je vaše da time raspolažete.',
    },
    {
      title: 'Manje nego ste dopustili',
      message:
        'Troškovi su {{percent}} % pod planom — {{savedAmount}} je ostalo. Dajte toj rezervi svrhu prije nego ju uzme navika.',
    },
    {
      title: 'Plan je imao rezervu',
      message:
        '{{savedAmount}} pod vašim granicama ovaj mjesec. Suzdržanost koja se čini laganom ona je koja traje.',
    },
    {
      title: 'Lakše nego je planirano',
      message:
        'Trebalo vam je {{percent}} % manje nego ste planirali. Razmislite da {{savedAmount}} usmjerite prema cilju.',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '„{{goal}}“ je po planu',
      message:
        'Prešli ste {{percent}} % puta, u tempu koji cilj traži. Čvrsti koraci, činjeni mjesečno, dosežu daleko.',
    },
    {
      title: 'Na putu k „{{goal}}“',
      message: '{{percent}} % gotovo i tempo drži. Nastavite plaćati cilj prvi; djeluje.',
    },
    {
      title: '„{{goal}}“: {{percent}} % i stabilno',
      message: 'Cilj svaki mjesec dobiva ono što treba. Strpljenje čini svoje.',
    },
    {
      title: 'Cilj se kreće po planu',
      message:
        '„{{goal}}“ je {{percent}} % financiran i na vrijeme. Ono što se radi pomalo svaki mjesec ne zaustavlja jedan loš tjedan.',
    },
    {
      title: 'Napredak kojem možete vjerovati',
      message:
        '„{{goal}}“ stoji na {{percent}} %, u tempu. Gradite ga na jedini način koji djeluje — postupno.',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: 'Manje impulzivnih kupnji kod {{merchant}}',
      message:
        'Od {{before}} kupnji prošli mjesec na oko {{after}} ovaj mjesec. Olabavljena navika stečena je sloboda.',
    },
    {
      title: '{{merchant}}: {{before}} → {{after}}',
      message:
        'Idete tamo manje nego prije. Svaki preskočen refleks mala je pobjeda izbora nad navikom.',
    },
    {
      title: 'Mala se navika smanjuje',
      message:
        'Kupnje kod {{merchant}} pale su s {{before}} na oko {{after}}. Nastavite — postaje lakše.',
    },
    {
      title: 'Izbor nad refleksom',
      message:
        'Kod {{merchant}} ste prešli s {{before}} kupnji na oko {{after}}. To je vladanje građeno po jednoj odluci.',
    },
    {
      title: 'Manje sitnica',
      message:
        '{{merchant}} vas je vidio oko {{after}} puta umjesto {{before}}. Male se pobjede slažu.',
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: 'Prilagodili ste se mršavijem mjesecu',
      message:
        'Prihod je pao {{incomePercent}} %, a vi ste troškove smanjili {{expensePercent}} %. Na promjenu sreće odgovorili ste promjenom smjera.',
    },
    {
      title: 'Smirenost kad je prihod pao',
      message:
        'Prihod niže {{incomePercent}} %, troškovi niže {{expensePercent}} %. Prilagodili ste se onome što jest, ne onome što je bilo.',
    },
    {
      title: 'Sreća se promijenila; i vi',
      message:
        'Pad prihoda od {{incomePercent}} % susreo je pad troškova od {{expensePercent}} %. To je ravnodušnost u brojevima.',
    },
    {
      title: 'Dobro kormilareno',
      message:
        'Kad je prihod pao {{incomePercent}} %, troškovi su slijedili ({{expensePercent}} % manje). Vjetar nije bio vaš; jedro jest.',
    },
    {
      title: 'Troškovi su slijedili prihod niže',
      message:
        'Potrošili ste {{expensePercent}} % manje kad je prihod pao {{incomePercent}} %. Prilagoditi se rano miran je put kroz.',
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: 'Nužnosti su stabilne',
      message:
        '{{months}} mjeseci vaši se nužni troškovi gotovo nisu pomakli. Stabilan pod daje slobodu nad njim.',
    },
    {
      title: 'Potrebe pod nadzorom',
      message:
        'Troškovi za nužnosti ostali su ravni {{months}} mjeseci. Potrebe koje ne rastu potrebe su kojima vladate.',
    },
    {
      title: '{{months}} mjeseci stabilnih nužnosti',
      message:
        'Najam, hrana i računi ostali su gdje su bili. Tiha stabilnost također je postignuće.',
    },
    {
      title: 'Nikakvo penjanje nužnosti',
      message:
        '{{months}} mjeseci bez pomaka u onome što život zahtijeva. Sve je ostalo na toj osnovi lakše planirati.',
    },
    {
      title: 'Čvrst pod',
      message:
        'Nužni troškovi stabilni su {{months}} mjeseci. Ne puštate udobnosti da prođu kao potrebe.',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: 'Darežljiv s onim što zaradite',
      message:
        'Kroz {{months}} mjeseci {{percent}} % vašeg prihoda — {{givenAmount}} — otišlo je u pomoć drugima. To je novac u najboljoj upotrebi.',
    },
    {
      title: '{{givenAmount}} dano drugima',
      message:
        'Kroz {{months}} mjeseci podijelili ste {{percent}} % svog prihoda. Dobrota koja se pokaže u brojevima dobrota je prakticirana, ne samo osjećana.',
    },
    {
      title: 'Otvorene ruke',
      message:
        'Dobrotvornost i darovi uzeli su u posljednje vrijeme {{percent}} % vašeg prihoda. Ono što date onaj je dio bogatstva koji nijedna nesreća ne može uzeti.',
    },
    {
      title: 'Darežljivost je dio vašeg plana',
      message:
        '{{givenAmount}} drugima kroz {{months}} mjeseci. Zadržite to — dobro koje činite drugima učinjeno je i vama.',
    },
    {
      title: 'Dobro dano',
      message:
        '{{percent}} % onoga što ste zaradili otišlo je u pomoć drugima. Malo navika govori o čovjeku više.',
    },
  ],
  'stoic.praise_steady': [
    {
      title: 'Ništa za ispravak',
      message: 'Vaši troškovi odgovaraju onome što ste namjeravali. Nastavite kako jeste.',
    },
    {
      title: 'Namjera i djelo se slažu',
      message:
        'Ovaj mjesec izgleda onako kako ste ga planirali. Upravo je to slaganje cijela svrha.',
    },
    {
      title: 'Miran mjesec',
      message:
        'Nikakvog pretjerivanja, nikakvog nemara vrijednog spomena. Bravo — ponesite istu pozornost dalje.',
    },
    {
      title: 'Sve je u redu',
      message: 'Vaš je plan izdržao i ništa ne traži ispravak. Uživajte u miru koji ste zaslužili.',
    },
    {
      title: 'Čvrsta ruka',
      message: 'Mjesec je slijedio vaš plan. Dobre navike čine dobre mjesece običnima.',
    },
  ],
  'expert.pay_yourself_first': [
    {
      title: 'Platite prvo sebi',
      message:
        'Pravilo Georgea S. Clasona: dio svega što zaradite vaš je da ga zadržite — najmanje desetina. Kroz {{months}} mjeseci zadržali ste {{savingsPercent}} %. Odvojite {{tenthAmount}} onog dana kad prihod dođe, prije svega drugog.',
    },
    {
      title: 'Desetina je vaša da je zadržite',
      message:
        'U Najbogatijem čovjeku u Babilonu prvi je lijek za tanku kesu zadržati jedan novčić od svakih deset. Vaša je stopa štednje {{savingsPercent}} %; {{tenthAmount}} mjesečno započelo bi tu naviku.',
    },
    {
      title: 'Štedite prije nego potrošite, ne poslije',
      message:
        'Clasonov je savjet jednostavan: platite prvo sebi. U posljednje vrijeme kod vas ostaje {{savingsPercent}} % prihoda. Odvojite {{tenthAmount}} na dan plaće i pustite troškove da se prilagode ostatku.',
    },
    {
      title: 'Prvi je novčić vaš',
      message:
        'Dio svega što zaradite trebao bi ostati kod vas — ne manje od desetine, kaže Clason. Kroz {{months}} mjeseci zadržali ste {{savingsPercent}} %. Počnite s {{tenthAmount}} mjesečno, automatski.',
    },
    {
      title: '{{savingsPercent}} % zadržano — pravilo traži 10 %',
      message:
        'Platite prvo sebi, kako to kaže Najbogatiji čovjek u Babilonu: {{tenthAmount}} mjesečno, odvojeno prije svakog računa. Štednja učinjena prva ne zavisi od onoga što ostane.',
    },
  ],
  'expert.rule_50_30_20': [
    {
      title: 'Vaša provjera 50/30/20',
      message:
        'Elizabeth Warren i Amelia Warren Tyagi predlažu 50 % prihoda nakon poreza za nužno, 30 % za želje, 20 % za štednju. Vaše: {{needsPercent}} % / {{wantsPercent}} % / {{savingsPercent}} %.',
    },
    {
      title: 'Potrebe {{needsPercent}} %, želje {{wantsPercent}} %, štednja {{savingsPercent}} %',
      message:
        'All Your Worth uravnotežuje novac kao 50/30/20. Usporedite s planom onu stavku koja je najdalje od svoje oznake — tu jedna promjena pomaže najviše.',
    },
    {
      title: 'Kako se dijeli vaš prihod',
      message:
        'Nužno uzima {{needsPercent}} % prihoda, želje {{wantsPercent}} %, a {{savingsPercent}} % se štedi. Ravnoteža 50/30/20 iz All Your Worth korisno je zrcalo, ne presuda.',
    },
    {
      title: 'Uravnotežena formula novca',
      message:
        'Formula Warren i Tyagi: polovina za ono što morate platiti bez obzira na sve, 30 % za želje, 20 % za budućnost. Vi ste na {{needsPercent}}/{{wantsPercent}}/{{savingsPercent}}.',
    },
    {
      title: 'Prema 50/30/20',
      message:
        'Vaša je podjela {{needsPercent}} % nužno, {{wantsPercent}} % želje, {{savingsPercent}} % štednja. Proba knjige za nužno: biste li to još plaćali kad biste sutra izgubili posao?',
    },
  ],
  'expert.room_for_error': [
    {
      title: 'Ostavite mjesta za pogrešku',
      message:
        'Savjet Morgana Housela: planirajte za to da stvari ne idu po planu. Vaše stanje pokriva oko {{cushionDays}} dana troškova; uobičajeno je mjerilo tri mjeseca — {{targetAmount}}.',
    },
    {
      title: 'Jastuk od {{cushionDays}} dana',
      message:
        'The Psychology of Money to zove mjestom za pogrešku — zalihom koja vam dopušta preživjeti iznenađenja. Graditi prema {{targetAmount}}, trima mjesecima troškova, daje planu priliku da preživi stvarnost.',
    },
    {
      title: 'Margina sigurnosti, kod kuće',
      message:
        'Housel Grahamovu marginu sigurnosti uzima za osobne financije. S {{cushionDays}} dana troškova u rezervi jedan loš mjesec može srušiti dobar plan. Ciljajte {{targetAmount}}.',
    },
    {
      title: 'Mjesto za neočekivano',
      message:
        'Vaša bi rezerva trajala oko {{cushionDays}} dana. Iznenađenja su ona jedna sigurnost; tri mjeseca troškova ({{targetAmount}}) široko su korišten cilj.',
    },
    {
      title: 'Izgradite zalihu prije nego je zatreba',
      message:
        'Mjesto za pogrešku, riječima Morgana Housela, ono je što vas drži u igri. Pokriveno imate oko {{cushionDays}} dana; {{targetAmount}} pokrilo bi tri mjeseca.',
    },
  ],
  'expert.lifestyle_creep': [
    {
      title: 'Troškovi prestižu prihod',
      message:
        'Troškovi su u posljednjem kvartalu narasli {{expenseGrowth}} %, a prihod se promijenio {{incomeGrowth}} %. Prvo pravilo The Millionaire Next Door: kakav god vam prihod bio, živite ispod svojih mogućnosti.',
    },
    {
      title: 'Živi se više, ne bogatije',
      message:
        'Stanley i Danko otkrili su da je bogatstvo ono što nakupite, a ne ono što potrošite. Vaši su troškovi narasli {{expenseGrowth}} %, prihod {{incomeGrowth}} % — u tom razmaku bogatstvo propušta.',
    },
    {
      title: 'Rast životnog stila: +{{expenseGrowth}} %',
      message:
        'Izdaci su se uspinjali brže od prihoda ({{incomeGrowth}} %). Ljudi iz The Millionaire Next Door ostali su imućni jer su pustili prihod da raste, a troškove ne.',
    },
    {
      title: 'Vratnice se pomiču',
      message:
        'Troškovi su između kvartala više {{expenseGrowth}} % prema {{incomeGrowth}} % za prihod. Živite ispod svojih mogućnosti, kažu Stanley i Danko — kakve god mogućnosti bile.',
    },
    {
      title: 'Bogatstvo je ono što zadržite',
      message:
        'Dobar prihod potrošen u cijelosti nikoga ne čini imućnijim. Posljednji kvartal vaši su troškovi narasli {{expenseGrowth}} % a prihod {{incomeGrowth}} % — vrijedi pogledati prije nego postane novo normalno.',
    },
  ],
  'expert.life_energy': [
    {
      title: '{{merchant}} je koštao {{hours}} sati vašeg života',
      message:
        'Vicki Robin i Joe Dominguez predlažu da stvari cijenimo u životnoj energiji — u satima rada koje koštaju. {{totalAmount}} kod {{merchant}} ovaj mjesec je oko {{hours}} sati. Je li to bilo vrijedno?',
    },
    {
      title: '{{hours}} sati kod {{merchant}}',
      message:
        'Your Money or Your Life poziva vas da novac vidite kao vrijeme koje ste za njega razmijenili. Pri vašem prosječnom satnom prihodu {{totalAmount}} tamo odgovara oko {{hours}} radnih sati.',
    },
    {
      title: 'Ocijenite to u satima',
      message:
        '{{totalAmount}} kod {{merchant}} je oko {{hours}} sati rada. Robin i Dominguez to zovu životnom energijom — jedinom valutom koju ne možete zaraditi natrag.',
    },
    {
      title: 'Što je {{merchant}} zaista koštao',
      message:
        'Novac je nešto za što mijenjamo svoju životnu energiju. Ovaj je mjesec {{merchant}} uzeo oko {{hours}} sati vaše ({{totalAmount}}). Odgovara li užitak tim satima?',
    },
    {
      title: 'Provjera životne energije',
      message:
        'Pretvoreno po vašem prosječnom satnom prihodu, {{totalAmount}} potrošeno kod {{merchant}} je oko {{hours}} sati. Your Money or Your Life predlaže pitanje je li to donijelo odgovarajuće ispunjenje.',
    },
  ],
};
