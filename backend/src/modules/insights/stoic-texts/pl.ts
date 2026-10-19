import type { StoicTextMap } from './types';

export const pl: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: 'Miesiąc przerósł swój plan',
      message:
        'Plan wynosił {{plannedAmount}}, a wydano {{spentAmount}} — o {{percent}}% więcej. Plan powstał na chłodno; niech mówi głośniej niż chwilowy impuls.',
    },
    {
      title: 'O {{percent}}% więcej, niż zakładał plan',
      message:
        'Wydatki: {{spentAmount}} przy planie {{plannedAmount}}. Sprawdź, który limit puścił pierwszy — tam jest lekcja.',
    },
    {
      title: 'Plan i miesiąc się rozminęły',
      message:
        'Wydano {{spentAmount}}, zamierzano {{plannedAmount}}. Albo plan wymagał od życia za mało, albo życie wymagało od Ciebie za dużo — spokojnie rozstrzygnij, które z nich.',
    },
    {
      title: 'Wyszło więcej, niż pozwalał plan',
      message:
        'Miesiąc przekroczył ustalone {{plannedAmount}} o {{percent}}%. Zatrzymując się teraz, nic nie tracisz; udając, że nic się nie stało, tracisz wiele.',
    },
    {
      title: 'Własna granica, własne przekroczenie',
      message:
        'Miało być {{plannedAmount}}, jest {{spentAmount}}. Panowanie nad sobą to nie brak potknięć, lecz wczesne ich zauważenie i powrót na drogę.',
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: 'Rozrywka bierze więcej, niż planowano',
      message:
        'Na rozrywkę przeznaczono {{planned}}% wydatków, a w tym miesiącu zajęła {{actual}}%. Przyjemność jest mile widziana jako gość, nie jako pan domu.',
    },
    {
      title: 'Rozrywka: {{actual}}% przy planie {{planned}}%',
      message:
        'Odpoczynek jest na miejscu, gdy regeneruje. Zapytaj, które przyjemności tego miesiąca naprawdę to zrobiły, a resztę puść bez żalu.',
    },
    {
      title: 'Wygoda wydaje więcej niż zamiar',
      message:
        'Rozrywka zajmuje {{actual}}% wydatków wobec wybranych przez Ciebie {{planned}}%. Umiar to nie odmawianie sobie przyjemności, lecz utrzymanie jej w ustalonych granicach.',
    },
    {
      title: 'Przyjemne wypiera zaplanowane',
      message:
        'Plan dawał rozrywce {{planned}}%, a wzięła {{actual}}%. To, co przychodzi łatwo, warto obejrzeć uważniej, zanim stanie się potrzebą.',
    },
    {
      title: 'Rozrywka przekroczyła swoją linię',
      message:
        'Na rozrywkę poszło {{actual}}% miesiąca, zamiarem było {{planned}}%. Linia jest Twoja — i Ty ją trzymasz.',
    },
  ],
  'stoic.leisure_habit': [
    {
      title: 'Rozrywka znów ponad plan',
      message:
        'Rozrywka przekroczyła plan w {{months}} z ostatnich {{window}} mies. Powtórka to już nie przypadek, lecz nawyk wart przyjrzenia się.',
    },
    {
      title: '{{months}} z {{window}} mies. ponad plan na rozrywkę',
      message:
        'Raz — to okoliczność; powtórka miesiąc po miesiącu (już {{months}}) — to kształtujący się charakter. Wybieraj go świadomie.',
    },
    {
      title: 'To samo potknięcie co miesiąc',
      message:
        'Rozrywka wychodziła poza plan w {{months}} z {{window}} mies. Albo uczciwie podnieś plan, albo zmień nawyk — życie pomiędzy kosztuje najwięcej.',
    },
    {
      title: 'To wzorzec, nie wpadka',
      message:
        'W ostatnich {{window}} mies. rozrywka brała więcej, niż jej dano, w {{months}} z nich. Zauważaj chwilę, w której zapada decyzja, a nie tylko rachunek po fakcie.',
    },
    {
      title: 'Nawyk głosuje przeciw planowi',
      message:
        'Rozrywka wyprzedziła plan w {{months}} z {{window}} mies. Nawyki buduje się po jednym wyborze — i tak samo się je rozbiera.',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: 'Cnota dostaje mniej, niż zamierzano',
      message:
        'Na zdrowie, naukę i innych przeznaczono {{planned}}% budżetu; na razie wydano {{actual}}%. Zamiar liczy się dopiero, gdy zostanie spełniony.',
    },
    {
      title: 'Cnota: {{actual}}% z zamierzonych {{planned}}%',
      message:
        'Pieniądze przeznaczone na Twój rozwój wciąż czekają. Nie będzie lepszego czasu, by wydać je dobrze, niż ten miesiąc.',
    },
    {
      title: 'Zaplanowane dobro nie zostało opłacone',
      message:
        'Zdrowie, nauka i hojność miały dostać {{planned}}% wydatków, dostały {{actual}}%. W tym tygodniu zrób świadomie jedną z tych rzeczy.',
    },
    {
      title: 'Zamiar bez czynu',
      message:
        'Cnota to {{actual}}% wydatków wobec wybranych {{planned}}%. To, co cenimy, widać po tym, za co naprawdę płacimy.',
    },
    {
      title: 'Wciąż jest miejsce na to, co ważne',
      message:
        'Na cnotę poszło tylko {{actual}}%, choć w planie było {{planned}}%. Książka, badanie kontrolne, pomoc potrzebującemu — plan już powiedział „tak”.',
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: 'Cnota wciąż odkładana',
      message:
        'Wydatki na zdrowie, naukę i innych są poniżej planu już {{months}} mies. z rzędu. To, co ciągle odkładasz, w istocie już odrzucasz.',
    },
    {
      title: 'Cnota odłożona: {{months}} mies.',
      message:
        'Co miesiąc plan robił miejsce na Twój rozwój, i co miesiąc to miejsce stało puste. Czasu nie da się zaplanować dwa razy.',
    },
    {
      title: 'Lepsza wersja Ciebie wciąż czeka',
      message:
        'Cnota jest poniżej planu już {{months}} mies. z rzędu. Zacznij od czegoś małego i pewnego, a nie wielkiego i kiedyś.',
    },
    {
      title: 'Dobre zamiary się starzeją',
      message:
        'Od {{months}} mies. zdrowie, nauka i hojność dostają mniej, niż zamierzono. Wybierz jedno i w przyszłym miesiącu opłać je jako pierwsze, przed wszystkim innym.',
    },
    {
      title: 'Cnota znów przegrywa z „później”',
      message:
        'Poniżej planu — {{months}} mies. z rzędu. „Później” to miejsce, gdzie dobre zamiary idą w zapomnienie; wyznacz temu datę.',
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: 'W Twoim planie nie ma miejsca na cnotę',
      message:
        'Żaden budżet nie służy zdrowiu, nauce ani innym ludziom. Plan pokazuje, co cenimy — rozważ osobną pozycję dla cnoty.',
    },
    {
      title: 'Budżet na wszystko, tylko nie na dobro',
      message:
        'Konieczność, praca i rozrywka mają limity, cnota — nie. To, czego nigdy się nie planuje, zwykle się nie wydarza.',
    },
    {
      title: 'Zaplanuj swój rozwój',
      message:
        'W klasie „Cnota” nie ma jeszcze budżetu. Nawet niewielki — na książki, sport, darowiznę — zamienia życzenie w zobowiązanie.',
    },
    {
      title: 'Plan milczy o cnocie',
      message:
        'Planujesz to, co musisz, i to, co lubisz, ale jeszcze nie to, kim chcesz się stać. Jeden skromny budżet na cnotę by to zmienił.',
    },
    {
      title: 'Cnota nie ma budżetu',
      message:
        'Wydatki na zdrowie, naukę czy innych nigdzie nie są zaplanowane. Wybierz jedno i daj mu limit, którego osiągnięcie by Cię ucieszyło.',
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: 'Konieczność kosztuje więcej, niż planowano',
      message:
        'Na konieczność zaplanowano {{planned}}% wydatków, a zajmuje {{actual}}%. Sprawdź, czy każdy taki wydatek jest wciąż potrzebą, czy po cichu stał się wygodą.',
    },
    {
      title: 'Konieczność: {{actual}}% przy planie {{planned}}%',
      message:
        'Życie zwykle wymaga mniej, niż to, do czego przywykliśmy. Spójrz świeżym okiem na największy obowiązkowy wydatek.',
    },
    {
      title: 'Podstawy się rozrastają',
      message:
        'Konieczność zajmuje {{actual}}% miesiąca wobec oczekiwanych {{planned}}%. Potrzeba, która wciąż rośnie, zasługuje na pytanie.',
    },
    {
      title: 'Potrzeby przerastają plan',
      message:
        'Plan — {{planned}}%, rzeczywistość — {{actual}}%. Albo plan nie docenił realnych kosztów, albo niektóre zachcianki podróżują pod nazwą potrzeb.',
    },
    {
      title: 'Na „muszę” poszło więcej, niż zamierzano',
      message:
        'Konieczność wzięła {{actual}}% wydatków zamiast {{planned}}%. Oddziel to, co naprawdę musi być, od tego, co po prostu zawsze było.',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: 'Konieczność pełznie w górę',
      message:
        'Wydatki na konieczność rosną już {{months}} mies. z rzędu, łącznie o {{percent}}%. Potrzeby rosną po cichu, gdy nikt nie każe im się tłumaczyć.',
    },
    {
      title: '+{{percent}}% na konieczność w {{months}} mies.',
      message:
        'Każdy krok wydawał się mały; razem już nie są. Weź największy stały wydatek i zapytaj, czy wciąż musi tyle kosztować.',
    },
    {
      title: 'Podłoga Twoich wydatków się podnosi',
      message:
        'Konieczność rosła przez {{months}} mies. z rzędu (+{{percent}}%). Podnosząca się podłoga zostawia mniej miejsca na wszystko, co wybierasz swobodnie.',
    },
    {
      title: 'Potrzeby się rozszerzają',
      message:
        'Wzrost trwa już {{months}} mies., łącznie {{percent}}%. Test jest prosty: czy to nadal byłby Twój wybór, przy znanej dziś cenie?',
    },
    {
      title: 'Małe wzrosty, stały kierunek',
      message:
        'Konieczność wzrosła o {{percent}}% w ciągu {{months}} mies. Kierunek znaczy więcej niż pojedynczy miesiąc — ten warto skorygować wcześnie.',
    },
  ],
  'stoic.work_over_plan': [
    {
      title: 'Praca kosztuje więcej, niż planowano',
      message:
        'Na pracę zaplanowano {{planned}}% wydatków, a zajmuje {{actual}}%. Narzędzia i usługi powinny na siebie zarabiać — sprawdź, które to robią.',
    },
    {
      title: 'Wydatki na pracę: {{actual}}% przy planie {{planned}}%',
      message:
        'Inwestycja w pracę jest dobra, gdy coś zwraca. Przejrzyj to, za co płacisz, a czego już nie używasz.',
    },
    {
      title: 'Budżet na pracę jest napięty',
      message:
        'Praca wzięła {{actual}}% zamiast {{planned}}%. Pracowitość to dobrze wykonana praca, a nie kupowanie do niej każdego narzędzia.',
    },
    {
      title: 'Narzędzia wyprzedzają plan',
      message:
        'Plan — {{planned}}%, na pracę poszło {{actual}}%. Zapytaj o każdy wydatek: czy pomaga mi pracować, czy tylko daje poczucie postępu?',
    },
    {
      title: 'Koszty pracy się przesunęły',
      message:
        'Praca zajmuje {{actual}}% wydatków wobec zamierzonych {{planned}}%. Mały przegląd teraz oszczędzi dużego później.',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '„{{category}}” znów przekracza limit',
      message:
        'Kategoria „{{category}}” przekroczyła budżet w {{months}} z ostatnich {{window}} mies. Błędny jest albo limit, albo pragnienie — zdecyduj, które.',
    },
    {
      title: '„{{category}}”: ponad budżet w {{months}} z {{window}} mies.',
      message:
        'Limit, który zawsze się przekracza, nie jest limitem, tylko życzeniem. Uczyń go uczciwym: świadomie go podnieś albo świadomie go trzymaj.',
    },
    {
      title: 'Ten sam budżet znów nie wytrzymał',
      message:
        'Kategoria „{{category}}” przekroczyła limit w {{months}} z {{window}} mies. Powtórzenie to informacja; wykorzystaj ją.',
    },
    {
      title: '„{{category}}” prosi o uwagę',
      message:
        'Ponad budżet w {{months}} z {{window}} mies. Obserwuj chwilę przed zakupem — tylko tam można zmienić nawyk.',
    },
    {
      title: 'Wzorzec w kategorii „{{category}}”',
      message:
        'Przekroczenia: {{months}} na {{window}} mies. Stajemy się tym, co powtarzamy; zdecyduj, co ta kategoria ma mówić o Tobie.',
    },
  ],
  'stoic.budget_pace': [
    {
      title: 'Limit „{{category}}” skończy się do {{day}}. dnia miesiąca',
      message:
        'Wydano {{spentAmount}} z {{limitAmount}}, a w tym tempie limit wyczerpie się około {{day}}. dnia. Zwolnić teraz jest łatwiej, niż zatrzymywać się później.',
    },
    {
      title: '„{{category}}” wyprzedza miesiąc',
      message:
        'Z limitu {{limitAmount}} ubyło już {{spentAmount}}. W tym tempie wyczerpie się do {{day}}. dnia — reszta miesiąca wciąż jest w Twoich rękach.',
    },
    {
      title: 'Kontrola tempa: „{{category}}”',
      message:
        'Przy obecnym tempie budżet {{limitAmount}} wystarczy mniej więcej do {{day}}. dnia miesiąca. Przezorność to najtańszy rodzaj dyscypliny.',
    },
    {
      title: '„{{category}}” wydaje przyszłość',
      message:
        'Wydano {{spentAmount}} z {{limitAmount}}; limit skończy się około {{day}}. dnia. To, co zrobisz w tym tygodniu, zdecyduje, czy tak się stanie.',
    },
    {
      title: 'Wczesne ostrzeżenie: „{{category}}”',
      message:
        'Przy obecnym tempie limit {{limitAmount}} nie wystarczy do końca miesiąca — wyczerpie się około {{day}}. dnia. Skoryguj, póki kosztuje to niewiele.',
    },
  ],
  'stoic.budget_unused': [
    {
      title: '„{{category}}” leży nieużywany',
      message:
        'W budżecie „{{category}}” od {{months}} mies. nie było żadnych wydatków. Albo przestał być potrzebny, albo to zamiar, który wciąż czeka — zdecyduj, które.',
    },
    {
      title: 'Pusty budżet: „{{category}}”',
      message:
        'Ani jednego wydatku od {{months}} mies. Plan powinien opisywać życie, którym żyjesz, albo to, które budujesz — które to jest?',
    },
    {
      title: '„{{category}}” stoi bezczynnie',
      message:
        'Nic tu nie wydano od {{months}} mies. Jeśli to powściągliwość — dobrze; jeśli zaniedbanie — działaj.',
    },
    {
      title: 'Zaplanowane, ale nie przeżyte',
      message:
        'Kategoria „{{category}}” ma limit, a od {{months}} mies. żadnych wydatków. Utrzymuj plan w prawdzie: usuń go albo z niego korzystaj.',
    },
    {
      title: '„{{category}}”: cichych miesięcy — {{months}}',
      message:
        'Budżet, którego nikt nie dotyka, i tak zajmuje miejsce w planie. Zwolnij to miejsce albo spełnij zamiar.',
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: '{{percent}}% wydatków bez limitu',
      message:
        'W tym miesiącu {{unbudgetedAmount}} poszło na kategorie, których nie pilnuje żaden budżet. Trudno panować nad tym, czego się nie mierzy.',
    },
    {
      title: 'Duża część miesiąca jest nieplanowana',
      message:
        '{{percent}}% wydatków — {{unbudgetedAmount}} — leży poza wszystkimi budżetami. Daj limit największej części, a plan zobaczy więcej z Twojego życia.',
    },
    {
      title: 'Wydatki poza planem',
      message:
        'Budżety obejmują tylko część wydatków; {{unbudgetedAmount}} ({{percent}}%) pozostaje niezmierzone. Rozszerz plan tam, dokąd naprawdę płyną pieniądze.',
    },
    {
      title: 'Plan widzi tylko część obrazu',
      message:
        '{{percent}}% tegomiesięcznych wydatków nie ma budżetu. Jasne spojrzenie poprzedza trafny osąd.',
    },
    {
      title: 'Wydano bez limitu: {{unbudgetedAmount}}',
      message:
        'To {{percent}}% miesiąca. Nie musisz tego ograniczać — wystarczy zdecydować, ile z tego naprawdę chcesz.',
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '„{{category}}” to większość rozrywki',
      message:
        '{{percent}}% wydatków na rozrywkę trafiło do kategorii „{{category}}”. Różnorodność w odpoczynku jest zdrowsza niż zależność od jednej przyjemności.',
    },
    {
      title: 'Jedna przyjemność dominuje',
      message:
        'Kategoria „{{category}}” bierze {{percent}}% wszystkich wydatków na rozrywkę. Zapytaj, czy wciąż cieszy, czy stała się rutyną.',
    },
    {
      title: 'Rozrywka opiera się na „{{category}}”',
      message:
        '{{percent}}% rozrywki w jednym miejscu. To, bez czego nie możemy się obejść, trzyma nas w uścisku; sprawdź, czy ten uścisk jest wciąż lekki.',
    },
    {
      title: '„{{category}}”: {{percent}}% rozrywki',
      message:
        'Jedno źródło radości zabiera prawie wszystko. Spróbuj w tym miesiącu innej, tańszej przyjemności i porównaj.',
    },
    {
      title: 'Twój odpoczynek ma jeden adres',
      message:
        'Większość pieniędzy na rozrywkę — {{percent}}% — trafia do kategorii „{{category}}”. Wolność to także umiejętność cieszenia się czymś innym.',
    },
  ],
  'stoic.unclassified': [
    {
      title: 'Część wydatków nie została oceniona',
      message:
        'Kategorie bez klasy: {{count}}. Zdecyduj w Budżetach, co jest koniecznością, pracą, cnotą, a co rozrywką.',
    },
    {
      title: 'Kategorie czekające na Twoją ocenę: {{count}}',
      message:
        'Mają wydatki, ale nie mają klasy, więc porada nie może ich zważyć. Minuta w sekcji „Budżety” to załatwi.',
    },
    {
      title: 'Nazwij, czemu służą Twoje pieniądze',
      message:
        'Kategorie bez klasyfikacji: {{count}}. Osąd zaczyna się od nazywania rzeczy po imieniu.',
    },
    {
      title: 'Nieocenione wydatki — kategorie: {{count}}',
      message:
        'Czy to potrzeba, Twoja praca, cnota czy przyjemność? Tylko Ty możesz to rozstrzygnąć — a plan stanie się jaśniejszy, gdy to zrobisz.',
    },
    {
      title: 'Kilka kategorii nie ma klasy',
      message:
        'Kategorie poza czterema klasami: {{count}}. Sklasyfikuj je w sekcji „Budżety”, by każdy wydatek był widziany takim, jaki jest.',
    },
  ],
  'stoic.small_purchases': [
    {
      title: '{{merchant}}: drobne zakupy — {{count}}',
      message:
        'Każdy wydawał się błahostką; razem w tym miesiącu wyszło {{totalAmount}}. Drobne, nieprzemyślane nawyki to miejsce, gdzie po cichu znika najwięcej pieniędzy.',
    },
    {
      title: '{{merchant}}: zakupy w tym miesiącu — {{count}}',
      message:
        '{{totalAmount}} w drobnych kwotach. Zapytaj, czy każda wizyta była wyborem, czy odruchem — wolność jest tylko w tym pierwszym.',
    },
    {
      title: 'Po trochu uzbierało się {{totalAmount}}',
      message:
        '{{merchant}}: zakupy — {{count}}. Żaden z osobna się nie liczy; liczy się nawyk. Zdecyduj, jak często naprawdę tego chcesz.',
    },
    {
      title: 'Nawyk: {{merchant}}',
      message:
        'Zakupy: {{count}}, łącznie {{totalAmount}}. Spróbuj w tym miesiącu pominąć co trzeci i zobacz, czy będzie Ci go brakować.',
    },
    {
      title: 'Drobiazgi się sumują',
      message:
        '{{merchant}}: wizyty — {{count}}, na kwotę {{totalAmount}}. Panowanie nad dużymi decyzjami buduje się na takich małych.',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: 'Weekendy to {{percent}}% rozrywki',
      message:
        'Większość wydatków na rozrywkę przypada na soboty i niedziele. Odpoczynek jest dobry; sprawdź, czy to odpoczynek, a nie rekompensata za tydzień.',
    },
    {
      title: 'Rozrywka żyje w weekendy',
      message:
        '{{percent}}% wydatków na rozrywkę przypada na weekendy. Zaplanuj weekend choć trochę, a będzie kosztował mniej i dał więcej.',
    },
    {
      title: 'Weekend płaci za cały tydzień',
      message:
        'Weekendy zabierają {{percent}}% tego, co wydajesz na rozrywkę. Jeśli tydzień trzeba naprawiać w każdą sobotę, przyjrzyj się samemu tygodniowi.',
    },
    {
      title: 'Sobota i niedziela: {{percent}}% rozrywki',
      message:
        'Wolne dni zachęcają do swobodnych wydatków. Przed weekendem zdecyduj, czemu ma służyć, a pieniądze niech pójdą za decyzją.',
    },
    {
      title: 'Weekendowy wzorzec',
      message:
        '{{percent}}% wydatków na rozrywkę przypada na weekendy. Lżejszy tydzień często sprawia, że weekend jest tańszy.',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}}: {{percent}}% miesiąca',
      message:
        '{{totalAmount}} trafiło do jednego sprzedawcy rozrywki. Gdy jedno miejsce ma tyle Twoich pieniędzy, zapytaj, ile ma Twojej uwagi.',
    },
    {
      title: 'Jedno miejsce — {{totalAmount}}',
      message:
        '{{merchant}} to {{percent}}% wydatków tego miesiąca. Czy jest wart takiej części owoców Twojej pracy?',
    },
    {
      title: 'Najwięcej wydatków: {{merchant}}',
      message:
        '{{percent}}% miesiąca — {{totalAmount}} — poszło właśnie tam. Nie ma nic złego w cieszeniu się tym, o ile to nadal Twój świadomy wybór.',
    },
    {
      title: 'Duży udział: {{merchant}}',
      message:
        '{{totalAmount}}, czyli {{percent}}% wydatków, w jednym miejscu rozrywki. Spokojnie zważ przyjemność i cenę.',
    },
    {
      title: '{{percent}}% — {{merchant}}',
      message:
        'Ten jeden sprzedawca wziął {{totalAmount}}. Wolność to móc przejść obok, kiedy tak postanowisz.',
    },
  ],
  'stoic.income_drop': [
    {
      title: 'Dochód spadł, wydatki nie',
      message:
        'Dochód spadł o {{percent}}%, do {{incomeAmount}}, a wydatki zostały na poziomie {{expenseAmount}}. Los zmienił zdanie; Twoje wydatki jeszcze tego nie zauważyły.',
    },
    {
      title: 'Dochód niższy o {{percent}}%',
      message:
        'Wpłynęło {{incomeAmount}}, wypłynęło {{expenseAmount}}. Co los dał, może odebrać — dopasuj wydatki do tego, co jest, a nie do tego, co było.',
    },
    {
      title: 'Skromniejszy miesiąc, te same nawyki',
      message:
        'Dochód jest o {{percent}}% niższy ({{incomeAmount}}), a wydatki trzymają się na {{expenseAmount}}. Dochód nie zależy od Ciebie; odpowiedź na niego — tak.',
    },
    {
      title: 'Los się odwrócił',
      message:
        'Dochód jest o {{percent}}% niższy niż zwykle, a wydatki jak dotąd wynoszą {{expenseAmount}}. Przytnij teraz, póki to wybór, a nie konieczność.',
    },
    {
      title: 'Wydatki nie poszły za dochodem',
      message:
        'Dochód spadł do {{incomeAmount}} (−{{percent}}%), wydatki: {{expenseAmount}}. Ustaw żagiel do wiatru, który naprawdę wieje.',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: 'Subskrypcje: {{monthlyAmount}} miesięcznie',
      message:
        'Subskrypcje: {{count}}, a zabierają {{percent}}% Twoich miesięcznych wydatków. Każda odnawia się, nie pytając Cię o zdanie — zadaj pytanie o każdą z nich.',
    },
    {
      title: '{{percent}}% wydatków odnawia się samo',
      message:
        'Subskrypcje: {{count}}, {{monthlyAmount}} miesięcznie. Zostaw te, które warto wykupić także dziś.',
    },
    {
      title: 'Cicho, regularnie, {{monthlyAmount}}',
      message:
        'Subskrypcje (łącznie {{count}}) kosztują {{percent}}% Twojego miesiąca. Wygoda to dobry sługa i kosztowny pan.',
    },
    {
      title: 'Subskrypcje do przejrzenia: {{count}}',
      message:
        'Razem to {{monthlyAmount}} miesięcznie, {{percent}}% wydatków. Anuluj tę, z której prawie nie korzystasz, i zauważ, jak mało Ci jej brakuje.',
    },
    {
      title: 'To, co odnawia się samo',
      message:
        '{{monthlyAmount}} miesięcznie, subskrypcje: {{count}}. Automatyczne wydatki zasługują na świadomy przegląd.',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: 'Twój sukces może sięgnąć trochę dalej',
      message:
        'Przez {{months}} mies. zostaje u Ciebie {{savingsPercent}}% dochodu, a do innych nie trafia z tego prawie nic. Bogactwu najlepiej w otwartych dłoniach — może jeden prezent albo darowizna w tym miesiącu?',
    },
    {
      title: 'Dobre zarobki, niewiele dawania',
      message:
        'Dochód z {{months}} mies.: {{incomeAmount}}, dla innych: {{givenAmount}}. Jeśli pomagasz w sposób, którego aplikacja nie widzi, pomiń to; jeśli nie — w planie jest na to miejsce.',
    },
    {
      title: 'Dobry czas na hojność',
      message:
        'Oszczędności to {{savingsPercent}}% dochodu — znak pewnej ręki. Niewielka część tego, oddana komuś w potrzebie, nadałaby tej stałości większy sens.',
    },
    {
      title: 'Na obrazku nie ma jeszcze innych ludzi',
      message:
        'Ostatnie mies. ({{months}}) to staranne zarabianie i oszczędzanie, ale bez dobroczynności i prezentów. Jesteśmy stworzeni dla siebie nawzajem; na początek wystarczy skromny dar.',
    },
    {
      title: 'Miejsce na życzliwość',
      message:
        'Na pomoc innym poszło tylko {{givenAmount}} z {{incomeAmount}}. Pomyśl o małej, regularnej darowiźnie — hojność, jak każda cnota, z nawykiem przychodzi łatwiej.',
    },
  ],
  'stoic.goal_behind': [
    {
      title: '„{{goal}}” zostaje w tyle',
      message:
        'Potrzeba {{requiredAmount}} miesięcznie, a odkładasz około {{paceAmount}}. W tym tempie cel zostanie osiągnięty z opóźnieniem: {{monthsLate}} mies.',
    },
    {
      title: '„{{goal}}”: opóźnienie {{monthsLate}} mies. w tym tempie',
      message:
        'Potrzeba {{requiredAmount}} miesięcznie, w praktyce około {{paceAmount}}. Uczciwie przesuń termin albo świadomie przeznacz więcej pieniędzy.',
    },
    {
      title: 'Cel i tempo się rozmijają',
      message:
        '„{{goal}}” wymaga {{requiredAmount}} miesięcznie, a dostaje {{paceAmount}}. Cel jest tak realny, jak realny jest comiesięczny krok w jego stronę.',
    },
    {
      title: 'Cel „{{goal}}” potrzebuje pewniejszego kroku',
      message:
        '{{paceAmount}} miesięcznie wobec potrzebnych {{requiredAmount}}. W przyszłym miesiącu najpierw zapłać celowi, dopiero potem wszystkiemu, co opcjonalne.',
    },
    {
      title: 'Opóźnienie celu „{{goal}}”',
      message:
        'Obecne tempo ({{paceAmount}} miesięcznie) oznacza opóźnienie: {{monthsLate}} mies. Małe podwyżki teraz są lepsze niż duże wyrzeczenia później.',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: '„{{goal}}” nie mieści się w planie',
      message:
        'Potrzeba {{requiredAmount}} miesięcznie, a po budżetach wolne jest tylko {{freeAmount}}. Zmień termin, kwotę albo budżety — nadzieja to nie plan.',
    },
    {
      title: '„{{goal}}” wymaga więcej, niż masz wolnego',
      message:
        'Wymagane {{requiredAmount}} co miesiąc, dostępne {{freeAmount}}. Kto chce wszystkiego naraz, nie osiąga niczego; wybieraj.',
    },
    {
      title: 'Liczby mówią „nie” — na razie',
      message:
        '„{{goal}}” wymaga {{requiredAmount}} miesięcznie; Twoje wolne środki to {{freeAmount}}. Zmień to, co od Ciebie zależy: termin albo inne limity.',
    },
    {
      title: 'Cel „{{goal}}” wymaga decyzji',
      message:
        'Przy {{requiredAmount}} miesięcznie przekracza on {{freeAmount}}, które zostaje po budżetach. Cel wybrany z otwartymi oczami jest lepszy od podtrzymywanego pobożnymi życzeniami.',
    },
    {
      title: 'Niemożliwe tempo dla „{{goal}}”',
      message:
        'Wymagane {{requiredAmount}} miesięcznie, wolne {{freeAmount}}. Uczciwa arytmetyka dziś oszczędzi rozczarowania jutro.',
    },
  ],
  'stoic.shortfall': [
    {
      title: 'Saldo spadnie poniżej zera: {{date}}',
      message:
        'Nadchodzące płatności na {{committedAmount}} obniżą prognozowane saldo do {{lowestAmount}}. Przygotuj się teraz, póki to tylko prognoza.',
    },
    {
      title: 'Nadchodzi niedobór: {{date}}',
      message:
        'Zobowiązania ({{committedAmount}}) przewyższają saldo, które spada najniżej do {{lowestAmount}}. Trudność przewidziana z góry traci swoją moc.',
    },
    {
      title: 'Zaplanuj datę: {{date}}',
      message:
        'Tego dnia prognozowane saldo dojdzie do {{lowestAmount}}. Przesunąć płatność, wstrzymać zachciankę albo odłożyć gotówkę — każde z tych jest dziś w Twojej mocy.',
    },
    {
      title: 'Zobowiązania przewyższają saldo',
      message:
        'Do zapłaty jest {{committedAmount}}, a saldo spada do {{lowestAmount}} w okolicy daty {{date}}. Spokojna reakcja to wczesna reakcja.',
    },
    {
      title: 'Przewiduj lukę: {{date}}',
      message:
        'Prognozowane najniższe saldo: {{lowestAmount}}. To, co przewidziane, można przyjąć ze spokojem; to, co zaskakuje — rzadko.',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: 'Dotrzymujesz słowa danego sobie',
      message:
        'Już {{months}} mies. z rzędu wydatki mieszczą się w wyznaczonym przez siebie planie. Tak wygląda panowanie nad sobą.',
    },
    {
      title: 'W ramach planu: {{months}} mies.',
      message:
        'Miesiąc po miesiącu to, co zamierzasz, i to, co robisz, się zgadza. Wytrwałość jest cichsza od siły woli i trwa dłużej.',
    },
    {
      title: 'Plan i życie są zgodne',
      message:
        'W swoich granicach już {{months}} mies. z rzędu. Plan tak przestrzegany nie jest już ograniczeniem — jest sposobem życia.',
    },
    {
      title: 'Stabilnie: {{months}} mies.',
      message:
        'Twoje budżety trzymają się już {{months}} mies. z rzędu. Zachowaj tę samą uważność — działa.',
    },
    {
      title: 'Dyscyplina, która trwa',
      message:
        'Od {{months}} mies. nie łamiesz swojego planu. Mało co tak uwalnia jak zaufanie do własnych decyzji.',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: 'Pieniądze idą za Twoimi wartościami',
      message:
        'Cnota zajęła {{actual}}% wydatków — nie mniej niż zaplanowane {{planned}}%. Dobrze wydane.',
    },
    {
      title: 'Cnota dostała pełną część',
      message:
        '{{actual}}% na zdrowie, naukę i innych przy planie {{planned}}%. To, co cenisz, zostało opłacone.',
    },
    {
      title: 'Wydane na rozwój',
      message:
        'Cnota zajęła w tym miesiącu {{actual}}% wydatków (plan: {{planned}}%). Te pieniądze pracują dla Ciebie długo po tym, jak zostały wydane.',
    },
    {
      title: 'Zamiar spełniony',
      message:
        'Plan na cnotę: {{planned}}%, wydatki: {{actual}}%. Dobre zamiary rzadko przetrwają miesiąc — Twoje przetrwały.',
    },
    {
      title: 'Najlepszy użytek z pieniędzy',
      message: '{{actual}}% poszło na rozwój Twój i dobro innych. Wybieraj to dalej.',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: 'Rozrywka na swoim miejscu',
      message:
        'Rozrywka to {{actual}}% wydatków, poniżej przyznanych jej {{planned}}%. Cieszysz się rzeczami, nie dając się im rządzić.',
    },
    {
      title: 'Przyjemność w swoim rozmiarze',
      message:
        'Rozrywka zajęła {{actual}}% przy planie {{planned}}%. Umiar to nie przegapianie, lecz wybór.',
    },
    {
      title: 'Odpoczynek bez przesady',
      message:
        'Na rozrywkę {{actual}}%, poniżej Twojego limitu {{planned}}%. Radość smakuje lepiej, gdy nie rządzi.',
    },
    {
      title: 'Cichy umiar',
      message:
        'Rozrywka miała {{planned}}%, a wykorzystała tylko {{actual}}%. Ten zapas to zachowana wolność.',
    },
    {
      title: 'Rozrywka poniżej planu',
      message:
        'Rozrywka to {{actual}}% wydatków, poniżej ustalonych przez Ciebie {{planned}}%. Dobrze utrzymane.',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: '{{percent}}% poniżej planu',
      message:
        'W tym miesiącu wydatki były o {{savedAmount}} niższe niż dopuszczalne. Nie potrzebować wszystkiego, co można mieć, to też rodzaj bogactwa.',
    },
    {
      title: 'Niewydane: {{savedAmount}}',
      message:
        'Miesiąc zamknął się {{percent}}% poniżej planu. To, co nie zostało wydane, wciąż jest do Twojej dyspozycji.',
    },
    {
      title: 'Mniej, niż dopuszczał plan',
      message:
        'Wydatki są {{percent}}% poniżej planu — zostało {{savedAmount}}. Nadaj temu zapasowi cel, zanim zagarnie go nawyk.',
    },
    {
      title: 'Plan miał zapas',
      message:
        'W tym miesiącu wydatki zmieściły się w limitach z zapasem {{savedAmount}}. Powściągliwość, która przychodzi łatwo, jest tą, która trwa.',
    },
    {
      title: 'Lżej, niż planowano',
      message:
        'Potrzeby okazały się o {{percent}}% mniejsze, niż zakładał budżet. Rozważ przekazanie {{savedAmount}} na cel.',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '„{{goal}}” idzie zgodnie z harmonogramem',
      message:
        'Za Tobą {{percent}}% drogi, w tempie, jakiego cel potrzebuje. Równe kroki stawiane co miesiąc prowadzą daleko.',
    },
    {
      title: 'Cel „{{goal}}” na dobrej drodze',
      message:
        'Gotowe w {{percent}}% i tempo się utrzymuje. Dalej płać celowi w pierwszej kolejności — to działa.',
    },
    {
      title: '„{{goal}}”: {{percent}}% i równy krok',
      message: 'Cel co miesiąc dostaje to, czego potrzebuje. Cierpliwość robi swoje.',
    },
    {
      title: 'Cel idzie zgodnie z planem',
      message:
        'Cel „{{goal}}” jest sfinansowany w {{percent}}% i idzie na czas. Tego, co robi się po trochu co miesiąc, nie zatrzyma jeden gorszy tydzień.',
    },
    {
      title: 'Postęp, któremu można ufać',
      message:
        'Cel „{{goal}}” jest na poziomie {{percent}}%, zgodnie z tempem. Budujesz go jedynym skutecznym sposobem — stopniowo.',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: 'Mniej zakupów pod wpływem impulsu: {{merchant}}',
      message:
        'Zakupy: {{before}} w zeszłym miesiącu, w tym około {{after}}. Poluzowany nawyk to zyskana wolność.',
    },
    {
      title: '{{merchant}}: {{before}} → {{after}}',
      message:
        'Bywasz tam rzadziej niż kiedyś. Każdy pominięty odruch to małe zwycięstwo wyboru nad nawykiem.',
    },
    {
      title: 'Drobny nawyk słabnie',
      message:
        '{{merchant}}: zakupy spadły z {{before}} do około {{after}}. Tak trzymaj — dalej będzie łatwiej.',
    },
    {
      title: 'Wybór zamiast odruchu',
      message:
        '{{merchant}}: zakupów było {{before}}, teraz około {{after}}. Tak buduje się panowanie nad sobą — decyzja po decyzji.',
    },
    {
      title: 'Mniej drobiazgów',
      message:
        '{{merchant}}: wizyty — około {{after}} zamiast {{before}}. Małe zwycięstwa się sumują.',
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: 'Wydatki dopasowane do skromniejszego miesiąca',
      message:
        'Dochód spadł o {{incomePercent}}%, a wydatki zmalały o {{expensePercent}}%. Na zmianę losu odpowiedzią była zmiana kursu.',
    },
    {
      title: 'Spokój, gdy dochód spadł',
      message:
        'Dochód niższy o {{incomePercent}}%, wydatki niższe o {{expensePercent}}%. Wydatki poszły za tym, co jest, a nie za tym, co było.',
    },
    {
      title: 'Los się zmienił — Ty także',
      message:
        'Spadek dochodu o {{incomePercent}}% spotkał się ze spadkiem wydatków o {{expensePercent}}%. To równowaga ducha wyrażona w liczbach.',
    },
    {
      title: 'Dobrze poprowadzone',
      message:
        'Gdy dochód spadł o {{incomePercent}}%, wydatki poszły za nim (−{{expensePercent}}%). Wiatr nie był Twój; żagiel był.',
    },
    {
      title: 'Wydatki spadły za dochodem',
      message:
        'Wydatki zmalały o {{expensePercent}}%, gdy dochód spadł o {{incomePercent}}%. Wczesne dostosowanie to spokojna droga przez zmiany.',
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: 'Konieczność jest stabilna',
      message:
        'Od {{months}} mies. Twoje niezbędne koszty prawie się nie zmieniają. Stabilna podłoga daje wolność ponad nią.',
    },
    {
      title: 'Potrzeby pod kontrolą',
      message:
        'Wydatki na konieczność trzymają się jednego poziomu od {{months}} mies. Potrzeby, które nie rosną, to potrzeby, nad którymi panujesz.',
    },
    {
      title: 'Stabilna konieczność: {{months}} mies.',
      message:
        'Czynsz, jedzenie i rachunki zostały tam, gdzie były. Cicha stabilność też jest osiągnięciem.',
    },
    {
      title: 'Konieczność nie pełznie w górę',
      message:
        'Od {{months}} mies. bez dryfu w tym, czego wymaga życie. Na takim gruncie łatwiej planować wszystko inne.',
    },
    {
      title: 'Mocna podstawa',
      message:
        'Niezbędne wydatki są stabilne od {{months}} mies. Nie pozwalasz, by wygody udawały potrzeby.',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: 'Hojność wobec tego, co zarobione',
      message:
        'Przez {{months}} mies. {{percent}}% dochodu — {{givenAmount}} — poszło na pomoc innym. To pieniądze wykorzystane najlepiej, jak się da.',
    },
    {
      title: 'Oddane innym: {{givenAmount}}',
      message:
        'W ciągu {{months}} mies. {{percent}}% Twojego dochodu trafiło do innych. Życzliwość widoczna w liczbach to życzliwość praktykowana, nie tylko odczuwana.',
    },
    {
      title: 'Otwarte dłonie',
      message:
        'Dobroczynność i prezenty pochłonęły ostatnio {{percent}}% dochodu. To, co oddajesz, jest częścią bogactwa, której żadne nieszczęście nie odbierze.',
    },
    {
      title: 'Hojność jest częścią Twojego planu',
      message:
        'Dla innych przez {{months}} mies.: {{givenAmount}}. Tak trzymaj — dobro czynione innym jest dobrem czynionym także sobie.',
    },
    {
      title: 'Dobrze oddane',
      message:
        '{{percent}}% zarobków poszło na pomoc innym. Niewiele nawyków mówi więcej o człowieku.',
    },
  ],
  'stoic.praise_steady': [
    {
      title: 'Nie ma czego poprawiać',
      message: 'Twoje wydatki zgadzają się z Twoimi zamiarami. Tak trzymaj.',
    },
    {
      title: 'Zamiar i czyn są zgodne',
      message: 'Ten miesiąc wygląda tak, jak go zaplanowano. Ta zgodność to cały sens.',
    },
    {
      title: 'Spokojny miesiąc',
      message:
        'Ani nadmiaru, ani zaniedbań wartych wzmianki. Dobrze — nieś tę samą uważność dalej.',
    },
    {
      title: 'Wszystko w porządku',
      message: 'Plan wytrzymał i nic nie wymaga poprawek. Ciesz się zasłużonym spokojem.',
    },
    {
      title: 'Pewna ręka',
      message:
        'Miesiąc przebiegł zgodnie z Twoim planem. Dobre nawyki sprawiają, że dobre miesiące wyglądają zwyczajnie.',
    },
  ],
  'expert.pay_yourself_first': [
    {
      title: 'Najpierw zapłać sobie',
      message:
        'Zasada George’a S. Clasona: część wszystkiego, co zarabiasz, ma zostać przy Tobie — co najmniej jedna dziesiąta. W ciągu {{months}} mies. zostało Ci {{savingsPercent}}%. Odkładaj {{tenthAmount}} w dniu wpływu dochodu, przed wszystkim innym.',
    },
    {
      title: 'Dziesiąta część jest Twoja',
      message:
        'W „Najbogatszym człowieku w Babilonie” pierwszym lekarstwem na chudą sakiewkę jest zatrzymanie jednej monety z każdych dziesięciu. Twoja stopa oszczędności to {{savingsPercent}}%; {{tenthAmount}} miesięcznie zapoczątkowałoby ten nawyk.',
    },
    {
      title: 'Oszczędzaj przed wydawaniem, nie po',
      message:
        'Rada Clasona jest prosta: najpierw zapłać sobie. Ostatnio zostaje przy Tobie {{savingsPercent}}% dochodu. W dniu wypłaty odłóż {{tenthAmount}}, a wydatki niech zmieszczą się w tym, co zostanie.',
    },
    {
      title: 'Pierwsza moneta jest Twoja',
      message:
        'Część wszystkiego, co zarabiasz, powinna zostać przy Tobie — nie mniej niż jedna dziesiąta, mówi Clason. W ciągu {{months}} mies. udało się zachować {{savingsPercent}}%. Zacznij od {{tenthAmount}} miesięcznie, automatycznie.',
    },
    {
      title: 'Zachowane {{savingsPercent}}% — zasada mówi 10%',
      message:
        'Najpierw zapłać sobie, jak uczy „Najbogatszy człowiek w Babilonie”: {{tenthAmount}} miesięcznie, odłożone przed jakimkolwiek rachunkiem. Oszczędności zrobione na początku nie zależą od tego, co zostanie.',
    },
  ],
  'expert.rule_50_30_20': [
    {
      title: 'Twój test 50/30/20',
      message:
        'Elizabeth Warren i Amelia Warren Tyagi proponują 50% dochodu po opodatkowaniu na rzeczy konieczne, 30% na zachcianki i 20% na oszczędności. U Ciebie: {{needsPercent}}% / {{wantsPercent}}% / {{savingsPercent}}%.',
    },
    {
      title:
        'Konieczne {{needsPercent}}%, zachcianki {{wantsPercent}}%, oszczędności {{savingsPercent}}%',
      message:
        'Książka „All Your Worth” równoważy pieniądze według proporcji 50/30/20. Porównaj ze swoim planem tę część, która najbardziej odbiega od swojej wartości — tam jedna zmiana pomoże najbardziej.',
    },
    {
      title: 'Jak dzieli się Twój dochód',
      message:
        'Wydatki konieczne zajmują {{needsPercent}}% dochodu, zachcianki {{wantsPercent}}%, a {{savingsPercent}}% trafia do oszczędności. Równowaga 50/30/20 z „All Your Worth” to przydatne lustro, nie wyrok.',
    },
    {
      title: 'Formuła zrównoważonych pieniędzy',
      message:
        'Formuła Warren i Tyagi: połowa na to, za co trzeba zapłacić bez względu na wszystko, 30% na zachcianki, 20% na przyszłość. U Ciebie {{needsPercent}}/{{wantsPercent}}/{{savingsPercent}}.',
    },
    {
      title: 'W zestawieniu z 50/30/20',
      message:
        'Twój podział: konieczne {{needsPercent}}%, zachcianki {{wantsPercent}}%, oszczędności {{savingsPercent}}%. Książkowy test wydatku koniecznego: czy płacono by go nadal, gdyby jutro zabrakło pracy?',
    },
  ],
  'expert.room_for_error': [
    {
      title: 'Zostaw miejsce na błąd',
      message:
        'Rada Morgana Housela: planuj na wypadek, gdy coś nie pójdzie zgodnie z planem. Twoje saldo pokrywa wydatki na ok. {{cushionDays}} dni; typowym punktem odniesienia są trzy miesiące — {{targetAmount}}.',
    },
    {
      title: 'Poduszka: {{cushionDays}} dni',
      message:
        '„Psychologia pieniędzy” nazywa to miejscem na błąd — zapasem, który pozwala przetrwać niespodzianki. Dążenie do {{targetAmount}}, czyli trzech miesięcy wydatków, daje planowi szansę przetrwać zderzenie z rzeczywistością.',
    },
    {
      title: 'Margines bezpieczeństwa w domu',
      message:
        'Housel przenosi margines bezpieczeństwa Grahama na finanse osobiste. Przy rezerwie na {{cushionDays}} dni wydatków jeden zły miesiąc może zniweczyć dobry plan. Cel: {{targetAmount}}.',
    },
    {
      title: 'Miejsce na nieoczekiwane',
      message:
        'Twoja rezerwa starczyłaby na ok. {{cushionDays}} dni. Niespodzianki to jedyna pewna rzecz; trzy miesiące wydatków ({{targetAmount}}) to powszechnie stosowany cel.',
    },
    {
      title: 'Zbuduj zapas, zanim będzie potrzebny',
      message:
        'Miejsce na błąd, jak mówi Morgan Housel, pozwala zostać w grze. Masz pokryte ok. {{cushionDays}} dni; {{targetAmount}} pokryłoby trzy miesiące.',
    },
  ],
  'expert.lifestyle_creep': [
    {
      title: 'Wydatki wyprzedzają dochód',
      message:
        'W ostatnim kwartale wydatki wzrosły o {{expenseGrowth}}%, a dochód zmienił się o {{incomeGrowth}}%. Pierwsza zasada „The Millionaire Next Door”: bez względu na dochody żyj poniżej swoich możliwości.',
    },
    {
      title: 'Wyższa stopa życia, nie większe bogactwo',
      message:
        'Stanley i Danko ustalili, że bogactwo to to, co gromadzisz, a nie to, co wydajesz. Twoje wydatki wzrosły o {{expenseGrowth}}%, dochód o {{incomeGrowth}}% — właśnie tą luką ucieka bogactwo.',
    },
    {
      title: 'Inflacja stylu życia: +{{expenseGrowth}}%',
      message:
        'Wydatki rosły szybciej niż dochód ({{incomeGrowth}}%). Bohaterowie „The Millionaire Next Door” pozostawali zamożni, bo pozwalali rosnąć dochodom, nie pozwalając rosnąć wydatkom.',
    },
    {
      title: 'Poprzeczka się przesuwa',
      message:
        'Wydatki wzrosły o {{expenseGrowth}}% kwartał do kwartału, dochód o {{incomeGrowth}}%. Żyj poniżej swoich możliwości, mówią Stanley i Danko — jakiekolwiek by one były.',
    },
    {
      title: 'Bogactwo to to, co zostaje',
      message:
        'Dobry dochód wydany w całości nikogo nie wzbogaca. W ostatnim kwartale Twoje wydatki wzrosły o {{expenseGrowth}}%, a dochód o {{incomeGrowth}}% — warto się temu przyjrzeć, zanim stanie się nową normą.',
    },
  ],
  'expert.life_energy': [
    {
      title: '{{merchant}}: {{hours}} godz. Twojego życia',
      message:
        'Vicki Robin i Joe Dominguez proponują wyceniać rzeczy w energii życiowej — w godzinach pracy, które kosztują. {{totalAmount}} w {{merchant}} w tym miesiącu to ok. {{hours}} godz. Czy było warto?',
    },
    {
      title: '{{merchant}}: {{hours}} godz.',
      message:
        '„Your Money or Your Life” zachęca, by widzieć w pieniądzach czas, za który zostały wymienione. Przy Twoim średnim dochodzie na godzinę {{totalAmount}} to tam ok. {{hours}} godz. pracy.',
    },
    {
      title: 'Policz to w godzinach',
      message:
        '{{totalAmount}} w {{merchant}} to ok. {{hours}} godz. pracy. Robin i Dominguez nazywają to energią życiową — jedyną walutą, której nie da się zarobić ponownie.',
    },
    {
      title: 'Ile naprawdę kosztował {{merchant}}',
      message:
        'Pieniądze to coś, na co wymieniamy naszą energię życiową. W tym miesiącu {{merchant}} zabrał ok. {{hours}} godz. Twojej ({{totalAmount}}). Czy przyjemność jest warta tych godzin?',
    },
    {
      title: 'Test energii życiowej',
      message:
        'Po przeliczeniu według Twojego średniego dochodu na godzinę {{totalAmount}} wydane w {{merchant}} to ok. {{hours}} godz. „Your Money or Your Life” podsuwa pytanie, czy przyniosło to proporcjonalne spełnienie.',
    },
  ],
};
