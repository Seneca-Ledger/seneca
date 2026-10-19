import type { StoicTextMap } from './types';

export const it: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: 'Il mese ha superato il suo piano',
      message:
        "Avevi previsto {{plannedAmount}} e hai speso {{spentAmount}}: il {{percent}}% in più. Il piano l'hai fatto a mente lucida; lascia che parli più forte del momento.",
    },
    {
      title: '{{percent}}% oltre ciò che volevi spendere',
      message:
        'Le spese sono a {{spentAmount}} contro un piano di {{plannedAmount}}. Guarda quale limite ha ceduto per primo: lì sta la lezione.',
    },
    {
      title: "Il piano e il mese non vanno d'accordo",
      message:
        '{{spentAmount}} spesi, {{plannedAmount}} previsti. O il piano chiedeva troppo poco alla realtà, o la realtà chiedeva troppo a te: decidi quale, con calma.',
    },
    {
      title: 'È uscito più di quanto avevi concesso',
      message:
        'Il mese supera del {{percent}}% il limite di {{plannedAmount}} che avevi fissato. Fermarsi ora non costa nulla; far finta di niente costa molto.',
    },
    {
      title: 'Un limite fissato, un limite superato',
      message:
        'Volevi spendere {{plannedAmount}}; sono {{spentAmount}}. Il dominio di sé non è non sbagliare mai: è accorgersene presto e tornare sulla via.',
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: 'Lo svago prende più del previsto',
      message:
        'Volevi dedicare allo svago il {{planned}}% delle spese; questo mese è il {{actual}}%. Il piacere è benvenuto come ospite, non come padrone di casa.',
    },
    {
      title: 'Svago al {{actual}}%, previsto {{planned}}%',
      message:
        "Il riposo merita il suo posto quando ti ristora. Chiediti quali piaceri di questo mese l'hanno fatto, e lascia andare gli altri senza rimpianti.",
    },
    {
      title: 'Le comodità spendono più delle intenzioni',
      message:
        'Lo svago occupa il {{actual}}% delle spese contro il {{planned}}% che avevi scelto. Moderazione non è rifiutare il piacere: è mantenerlo della misura decisa.',
    },
    {
      title: 'Il piacevole scalza il pianificato',
      message:
        'Allo svago avevi dato il {{planned}}% del piano e ne ha preso il {{actual}}%. Ciò che ti piace senza sforzo merita un secondo sguardo, prima che diventi un bisogno.',
    },
    {
      title: 'Lo svago ha oltrepassato la sua linea',
      message:
        "Il {{actual}}% del mese è andato allo svago; l'intenzione era il {{planned}}%. La linea l'hai tracciata tu, e tocca a te tenerla.",
    },
  ],
  'stoic.leisure_habit': [
    {
      title: 'Lo svago supera di nuovo il piano',
      message:
        "Lo svago ha superato il tuo piano in {{months}} degli ultimi {{window}} mesi. Una ripetizione non è più un caso: è un'abitudine da esaminare.",
    },
    {
      title: 'Piano dello svago superato in {{months}} mesi su {{window}}',
      message:
        'Ciò che accade una volta è circostanza; ciò che accade {{months}} volte è un carattere che si forma. Scegli quel carattere di proposito.',
    },
    {
      title: 'Lo stesso scivolone, mese dopo mese',
      message:
        'Lo svago ha sforato il piano in {{months}} mesi su {{window}}. O alzi il piano onestamente o cambi abitudine: vivere a metà strada è ciò che costa di più.',
    },
    {
      title: 'Uno schema, non una svista',
      message:
        'Negli ultimi {{window}} mesi, per {{months}} volte lo svago ha preso più di quanto gli avevi dato. Nota il momento in cui prendi la decisione, non solo il conto che arriva dopo.',
    },
    {
      title: "L'abitudine vota contro il tuo piano",
      message:
        'Lo svago ha battuto il piano {{months}} volte in {{window}} mesi. Le abitudini si costruiscono una scelta alla volta; allo stesso modo si disfano.',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: 'Alla virtù va meno del previsto',
      message:
        "Hai riservato il {{planned}}% del budget a salute, studio e altri; finora è il {{actual}}%. Un'intenzione conta solo quando si realizza.",
    },
    {
      title: 'Virtù al {{actual}}% su un {{planned}}% previsto',
      message:
        "Il denaro destinato a ciò che ti rende migliore è ancora lì che aspetta. Non c'è momento migliore di questo mese per spenderlo bene.",
    },
    {
      title: 'Il bene che avevi previsto non è stato speso',
      message:
        'Salute, studio e generosità dovevano avere il {{planned}}% delle spese; hanno avuto il {{actual}}%. Dedicati a una di esse questa settimana, di proposito.',
    },
    {
      title: 'Intenzione senza azione',
      message:
        'La virtù ha il {{actual}}% delle spese contro il {{planned}}% che avevi scelto. Ciò che apprezziamo si vede in ciò per cui paghiamo davvero.',
    },
    {
      title: 'Resta spazio per ciò che conta',
      message:
        'Alla virtù è andato solo il {{actual}}%, anche se avevi previsto il {{planned}}%. Un libro, una visita medica, un dono a chi ha bisogno: il piano ha già detto di sì.',
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: 'La virtù continua a essere rimandata',
      message:
        'La spesa per salute, studio e altri è sotto il tuo piano da {{months}} mesi di fila. Ciò che rimandi sempre, di fatto lo hai già rifiutato.',
    },
    {
      title: '{{months}} mesi di virtù rimandata',
      message:
        "Ogni mese il piano ha fatto spazio a ciò che ti rende migliore, e ogni mese quello spazio è rimasto vuoto. Il tempo è l'unica cosa che non puoi mettere in budget due volte.",
    },
    {
      title: 'Il te migliore sta ancora aspettando',
      message:
        'La virtù è sotto il piano da {{months}} mesi di fila. Meglio cominciare in piccolo e con certezza che in grande e più tardi.',
    },
    {
      title: 'Le buone intenzioni invecchiano',
      message:
        'Da {{months}} mesi salute, studio e generosità ricevono meno del previsto. Scegline una e finanziala per prima il mese prossimo, prima di ogni altra cosa.',
    },
    {
      title: 'La virtù continua a perdere contro il «dopo»',
      message:
        '{{months}} mesi di fila sotto il piano. «Dopo» è il posto dove le buone intenzioni vanno a farsi dimenticare: dai a questa una data.',
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: 'Il tuo piano non ha spazio per la virtù',
      message:
        'Nessuno dei tuoi budget serve la salute, lo studio o gli altri. Un piano mostra ciò che conta per noi: valuta di dare alla virtù una voce tutta sua.',
    },
    {
      title: 'Un budget per tutto, tranne che per il bene',
      message:
        'Necessità, lavoro e svago hanno i loro limiti; la virtù nessuno. Ciò per cui non si pianifica mai, di solito non accade mai.',
    },
    {
      title: 'Pianifica ciò che ti rende migliore',
      message:
        "Nella classe virtù non c'è ancora nessun budget. Anche uno piccolo (libri, sport, una donazione) trasforma un desiderio in un impegno.",
    },
    {
      title: 'Il piano tace sulla virtù',
      message:
        'Metti in budget ciò che devi e ciò che ti piace, non ancora chi vuoi diventare. Un modesto budget per la virtù cambierebbe le cose.',
    },
    {
      title: 'La virtù non ha un budget',
      message:
        'La spesa per salute, studio o altri non è prevista da nessuna parte. Scegline una e dalle un limite che saresti felice di raggiungere.',
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: 'Le necessità costano più del previsto',
      message:
        'Avevi previsto per le necessità il {{planned}}% delle spese; ne prendono il {{actual}}%. Verifica se ognuna è ancora un bisogno o è diventata in silenzio una comodità.',
    },
    {
      title: 'Necessità al {{actual}}%, previsto {{planned}}%',
      message:
        'Ciò che la vita richiede è di solito meno di ciò a cui ci abituiamo. Riesamina con occhi nuovi la necessità più grande.',
    },
    {
      title: "L'essenziale si sta gonfiando",
      message:
        'Le necessità occupano il {{actual}}% del mese contro il {{planned}}% che ti aspettavi. Un bisogno che continua a crescere merita una domanda.',
    },
    {
      title: 'I bisogni superano il piano',
      message:
        'Previsto {{planned}}%, effettivo {{actual}}%. O il piano ha sottostimato i costi reali, o alcuni desideri viaggiano sotto il nome di bisogni.',
    },
    {
      title: 'Più speso per il «devo» del previsto',
      message:
        'Le necessità hanno preso il {{actual}}% delle spese invece del {{planned}}%. Separa ciò che è davvero indispensabile da ciò che è semplicemente sempre stato così.',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: 'Le necessità salgono piano piano',
      message:
        'La spesa per le necessità cresce da {{months}} mesi di fila, del {{percent}}% in totale. I bisogni crescono in silenzio quando nessuno chiede loro di giustificarsi.',
    },
    {
      title: '+{{percent}}% sulle necessità in {{months}} mesi',
      message:
        'Ogni passo sembrava piccolo; insieme non lo sono. Prendi la necessità ricorrente più grande e chiediti se deve ancora costare così tanto.',
    },
    {
      title: 'Il pavimento delle tue spese si alza',
      message:
        'Le necessità sono cresciute per {{months}} mesi consecutivi (+{{percent}}%). Un pavimento che sale lascia meno spazio a tutto ciò che scegli liberamente.',
    },
    {
      title: 'I bisogni si allargano',
      message:
        '{{months}} mesi di crescita, {{percent}}% in tutto. La prova stoica è semplice: lo sceglieresti di nuovo oggi, conoscendone il prezzo?',
    },
    {
      title: 'Piccoli aumenti, direzione costante',
      message:
        'Le necessità sono salite del {{percent}}% in {{months}} mesi. La direzione conta più di un singolo mese, e questa conviene correggerla presto.',
    },
  ],
  'stoic.work_over_plan': [
    {
      title: 'Il lavoro costa più del previsto',
      message:
        'Avevi previsto per il lavoro il {{planned}}% delle spese; ne prende il {{actual}}%. Strumenti e servizi devono guadagnarsi il loro posto: verifica quali lo fanno.',
    },
    {
      title: 'Spese di lavoro al {{actual}}%, previsto {{planned}}%',
      message:
        'Investire nel proprio lavoro è un bene quando rende qualcosa. Rivedi ciò che paghi ma non usi più.',
    },
    {
      title: 'Il budget del lavoro è tirato',
      message:
        'Il lavoro ha preso il {{actual}}% invece del {{planned}}%. La diligenza sta nel fare bene il lavoro, non nel comprare ogni strumento per farlo.',
    },
    {
      title: 'Gli strumenti spendono più del piano',
      message:
        "Previsto {{planned}}%, speso {{actual}}% per il lavoro. Chiedi a ogni spesa: mi aiuta a lavorare, o mi dà solo l'impressione di progredire?",
    },
    {
      title: 'I costi di lavoro sono scivolati',
      message:
        'Il lavoro occupa il {{actual}}% delle spese contro il {{planned}}% previsto. Un breve controllo ora ne risparmia uno più lungo dopo.',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '«{{category}}» supera di nuovo il limite',
      message:
        '«{{category}}» ha sforato il budget in {{months}} degli ultimi {{window}} mesi. O è sbagliato il limite, o il desiderio: decidi quale.',
    },
    {
      title: '«{{category}}»: fuori budget {{months}} mesi su {{window}}',
      message:
        'Un limite sempre superato non è un limite, è solo un desiderio. Rendilo onesto: alzalo di proposito o rispettalo di proposito.',
    },
    {
      title: 'Lo stesso budget cede di nuovo',
      message:
        "«{{category}}» ha superato il limite {{months}} volte in {{window}} mesi. La ripetizione è un'informazione: usala.",
    },
    {
      title: '«{{category}}» chiede la tua attenzione',
      message:
        "Fuori budget in {{months}} mesi su {{window}}. Osserva il momento prima dell'acquisto: è l'unico punto in cui l'abitudine si può cambiare.",
    },
    {
      title: 'Uno schema in «{{category}}»',
      message:
        '{{months}} sforamenti in {{window}} mesi. Ciò che ripetiamo, lo diventiamo: decidi cosa vuoi che questa categoria dica di te.',
    },
  ],
  'stoic.budget_pace': [
    {
      title: '«{{category}}» si esaurisce entro il giorno {{day}}',
      message:
        'Hai speso {{spentAmount}} su {{limitAmount}} e, a questo ritmo, il limite finisce intorno al giorno {{day}}. Rallentare ora è più facile che fermarsi dopo.',
    },
    {
      title: '«{{category}}» corre più veloce del mese',
      message:
        'Già spesi {{spentAmount}} su un limite di {{limitAmount}}. A questo ritmo si esaurisce entro il giorno {{day}}: il resto del mese puoi ancora deciderlo tu.',
    },
    {
      title: 'Controllo del ritmo: «{{category}}»',
      message:
        'Al ritmo attuale il budget di {{limitAmount}} durerà fino al giorno {{day}} circa. La previdenza è la forma più economica di disciplina.',
    },
    {
      title: '«{{category}}» sta spendendo il futuro',
      message:
        'Spesi {{spentAmount}} su {{limitAmount}}; il limite finisce verso il giorno {{day}}. Ciò che fai questa settimana decide se accadrà.',
    },
    {
      title: 'Avviso anticipato per «{{category}}»',
      message:
        'Al ritmo attuale il limite di {{limitAmount}} non arriverà a fine mese: si esaurisce intorno al giorno {{day}}. Correggi finché costa poco.',
    },
  ],
  'stoic.budget_unused': [
    {
      title: '«{{category}}» è rimasto inutilizzato',
      message:
        "Il budget per «{{category}}» non ha visto spese da {{months}} mesi. O non ti serve più, o è un'intenzione ancora in attesa: decidi quale.",
    },
    {
      title: 'Un budget vuoto: «{{category}}»',
      message:
        '{{months}} mesi senza una sola spesa. Un piano dovrebbe descrivere la vita che fai o quella che stai costruendo: questo quale descrive?',
    },
    {
      title: '«{{category}}» è fermo',
      message:
        'Nessuna spesa qui da {{months}} mesi. Se è stata moderazione, ben fatto; se è stata trascuratezza, agisci.',
    },
    {
      title: 'Pianificato, ma non vissuto',
      message:
        '«{{category}}» ha un limite e nessuna spesa da {{months}} mesi. Mantieni il piano sincero: toglilo o usalo.',
    },
    {
      title: '«{{category}}»: {{months}} mesi di silenzio',
      message:
        "Un budget mai toccato occupa comunque un posto nel tuo piano. Libera quel posto o onora l'intenzione.",
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: 'Il {{percent}}% delle spese non ha limite',
      message:
        'Questo mese {{unbudgetedAmount}} sono andati a categorie che nessun budget sorveglia. Ciò che non si misura è difficile da governare.',
    },
    {
      title: 'Gran parte del mese non è pianificata',
      message:
        'Il {{percent}}% delle spese, cioè {{unbudgetedAmount}}, sta fuori da ogni budget. Dai un limite alla parte più grande e il piano vedrà di più della tua vita.',
    },
    {
      title: 'Spese fuori dal piano',
      message:
        'I budget coprono solo parte di ciò che spendi; {{unbudgetedAmount}} ({{percent}}%) restano senza misura. Estendi il piano dove il denaro va davvero.',
    },
    {
      title: 'Il piano vede solo una parte del quadro',
      message:
        'Il {{percent}}% delle spese di questo mese non ha budget. La vista chiara viene prima del buon giudizio.',
    },
    {
      title: '{{unbudgetedAmount}} spesi senza limite',
      message:
        'È il {{percent}}% del mese. Non devi per forza limitarli: decidi solo quanto ne vuoi davvero.',
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '«{{category}}» è quasi tutto il tuo svago',
      message:
        'Il {{percent}}% della spesa per lo svago è andato a «{{category}}». La varietà nel riposo è più sana della dipendenza da un solo piacere.',
    },
    {
      title: 'Un solo piacere domina',
      message:
        '«{{category}}» prende il {{percent}}% di tutto ciò che hai speso per lo svago. Chiediti se ti rallegra ancora o se è diventato routine.',
    },
    {
      title: 'Lo svago si appoggia a «{{category}}»',
      message:
        'Il {{percent}}% dello svago in un solo posto. Ciò di cui non sappiamo fare a meno ci tiene in pugno: verifica che la presa sia ancora leggera.',
    },
    {
      title: '«{{category}}»: il {{percent}}% dello svago',
      message:
        'Una sola fonte di piacere si prende quasi tutto. Prova questo mese un piacere diverso e più economico, e confronta.',
    },
    {
      title: 'Il tuo riposo ha un solo indirizzo',
      message:
        'La maggior parte del denaro per lo svago, il {{percent}}%, va a «{{category}}». La libertà include saper godere anche di altre cose.',
    },
  ],
  'stoic.unclassified': [
    {
      title: 'Parte delle spese non è ancora giudicata',
      message:
        'Categorie senza classe: {{count}}. Decidi in Budget cosa è necessità, lavoro, virtù o svago.',
    },
    {
      title: 'Categorie in attesa del tuo giudizio: {{count}}',
      message:
        'Hanno spese ma nessuna classe, quindi il consiglio non può pesarle. Basta un minuto in Budget per sistemarle.',
    },
    {
      title: 'Dai un nome a ciò che il tuo denaro serve',
      message:
        'Categorie ancora senza classe: {{count}}. Il giudizio comincia dal chiamare le cose con il loro nome.',
    },
    {
      title: 'Categorie da giudicare: {{count}}',
      message:
        'È un bisogno, il tuo lavoro, una virtù o un piacere? Solo tu puoi dirlo, e il piano diventa più chiaro quando lo fai.',
    },
    {
      title: 'Alcune categorie non hanno classe',
      message:
        'Categorie fuori dalle quattro classi: {{count}}. Classificale in Budget, così ogni spesa è vista per ciò che è.',
    },
  ],
  'stoic.small_purchases': [
    {
      title: 'Piccoli acquisti da {{merchant}}: {{count}}',
      message:
        'Ognuno sembrava irrilevante; insieme questo mese fanno {{totalAmount}}. È nelle piccole abitudini non esaminate che se ne va, in silenzio, gran parte del denaro.',
    },
    {
      title: '{{merchant}}, acquisti del mese: {{count}}',
      message:
        '{{totalAmount}} in piccole somme. Chiediti se ogni visita è stata una scelta o un riflesso: solo la prima è libertà.',
    },
    {
      title: 'Poco alla volta: {{totalAmount}}',
      message:
        "Acquisti da {{merchant}}: {{count}}. Nessuno conta da solo, conta l'abitudine. Decidi quanto spesso la vuoi davvero.",
    },
    {
      title: "Un'abitudine da {{merchant}}",
      message:
        'Acquisti: {{count}}, per un totale di {{totalAmount}}. Prova questo mese a saltarne uno su tre e vedi se ti manca.',
    },
    {
      title: 'Le piccole cose si sommano',
      message:
        'Visite da {{merchant}}: {{count}}, per {{totalAmount}}. Il dominio sulle grandi decisioni si costruisce su piccole come queste.',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: 'Il weekend porta il {{percent}}% dello svago',
      message:
        'La maggior parte della spesa per lo svago avviene il sabato e la domenica. Il riposo è un bene; verifica che sia riposo e non un risarcimento per la settimana.',
    },
    {
      title: 'Lo svago vive nel weekend',
      message:
        "Il {{percent}}% della spesa per lo svago cade nel fine settimana. Pianifica un po' il weekend: costerà meno e darà di più.",
    },
    {
      title: 'Il weekend paga per la settimana',
      message:
        'Il fine settimana prende il {{percent}}% di ciò che spendi per lo svago. Se la settimana va riparata ogni sabato, guarda la settimana.',
    },
    {
      title: 'Sabato e domenica: il {{percent}}% dello svago',
      message:
        'I giorni liberi invitano a spendere liberamente. Decidi prima del weekend a cosa serve, e lascia che il denaro segua.',
    },
    {
      title: 'Uno schema da fine settimana',
      message:
        'Il {{percent}}% della spesa per lo svago avviene nel weekend. Più leggerezza nei giorni feriali spesso rende il weekend meno costoso.',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}} ha preso il {{percent}}% del mese',
      message:
        '{{totalAmount}} sono andati a un solo esercente per lo svago. Quando un posto ha così tanto del tuo denaro, chiediti quanta della tua attenzione abbia.',
    },
    {
      title: 'Un solo posto, {{totalAmount}}',
      message:
        '{{merchant}} vale il {{percent}}% delle spese di questo mese. Merita quella quota del frutto del tuo lavoro?',
    },
    {
      title: '{{merchant}} guida le tue spese',
      message:
        'Il {{percent}}% del mese, cioè {{totalAmount}}, è finito lì. Nulla di male nel goderselo, purché tu lo scelga di nuovo.',
    },
    {
      title: 'Una grossa quota da {{merchant}}',
      message:
        '{{totalAmount}}, il {{percent}}% delle spese, in un solo luogo di svago. Pesa il piacere contro il prezzo, con calma.',
    },
    {
      title: '{{percent}}% da {{merchant}}',
      message:
        'Questo solo esercente ha preso {{totalAmount}}. Libertà è poterci passare davanti quando lo decidi tu.',
    },
  ],
  'stoic.income_drop': [
    {
      title: 'Il reddito è sceso, le spese no',
      message:
        'Il reddito è calato del {{percent}}% a {{incomeAmount}}, ma le spese sono rimaste a {{expenseAmount}}. La fortuna ha cambiato idea; le tue spese non se ne sono ancora accorte.',
    },
    {
      title: 'Reddito in calo del {{percent}}%',
      message:
        'Sono entrati {{incomeAmount}} contro {{expenseAmount}} usciti. Ciò che la fortuna dà, può riprenderselo: adegua le spese a ciò che è, non a ciò che era.',
    },
    {
      title: 'Un mese più magro, le stesse abitudini',
      message:
        'Il reddito è più basso del {{percent}}% ({{incomeAmount}}), mentre le spese restano a {{expenseAmount}}. Il reddito non è in tuo potere; la risposta sì.',
    },
    {
      title: 'La fortuna è cambiata',
      message:
        'Hai guadagnato il {{percent}}% in meno del solito, ma hai speso {{expenseAmount}} come prima. Taglia ora, finché è una scelta e non una necessità.',
    },
    {
      title: 'Le spese non hanno seguito il reddito',
      message:
        'Il reddito è sceso a {{incomeAmount}} (−{{percent}}%); le spese sono {{expenseAmount}}. Regola la vela sul vento che hai davvero.',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: 'Abbonamenti: {{monthlyAmount}} al mese',
      message:
        'Abbonamenti attivi: {{count}}, pari al {{percent}}% della tua spesa mensile. Ognuno si rinnova senza chiederti nulla: sii tu a chiedere, di ciascuno.',
    },
    {
      title: 'Il {{percent}}% delle spese si rinnova da solo',
      message:
        'Abbonamenti: {{count}}, per {{monthlyAmount}} al mese. Tieni quelli che sottoscriveresti di nuovo oggi.',
    },
    {
      title: 'Silenziosi, ricorrenti: {{monthlyAmount}}',
      message:
        "Abbonamenti: {{count}}, il {{percent}}% del tuo mese. La comodità è un'ottima serva e una padrona costosa.",
    },
    {
      title: 'Abbonamenti da rivedere: {{count}}',
      message:
        'Insieme fanno {{monthlyAmount}} al mese, il {{percent}}% delle spese. Disdici uno che usi poco e nota quanto poco ti manca.',
    },
    {
      title: 'Ciò che si rinnova da sé',
      message:
        '{{monthlyAmount}} al mese tra gli abbonamenti ({{count}}). Una spesa automatica merita una revisione deliberata.',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: "Il tuo successo potrebbe arrivare un po' più lontano",
      message:
        'In {{months}} mesi hai tenuto il {{savingsPercent}}% del tuo reddito, ma quasi nulla è andato agli altri. La ricchezza sta meglio in mani aperte: magari un regalo o una donazione questo mese?',
    },
    {
      title: 'Guadagni bene, dai poco',
      message:
        'In {{months}} mesi sono entrati {{incomeAmount}} e {{givenAmount}} sono andati ad altri. Se aiuti in modi che questa app non vede, ignora questo messaggio; altrimenti, il tuo piano ha spazio per farlo.',
    },
    {
      title: 'Un buon momento per la generosità',
      message:
        'Hai risparmiato il {{savingsPercent}}% del reddito, segno di una mano ferma. Una piccola parte di questo, data a chi ne ha bisogno, darebbe più senso a questa costanza.',
    },
    {
      title: 'Ancora nessun altro nel quadro',
      message:
        'Gli ultimi {{months}} mesi mostrano guadagni e risparmi accurati, ma né beneficenza né regali. Siamo fatti gli uni per gli altri; per cominciare basta un dono modesto.',
    },
    {
      title: 'Spazio per la gentilezza',
      message:
        "Solo {{givenAmount}} su {{incomeAmount}} è andato ad aiutare gli altri. Pensa a una piccola donazione regolare: la generosità, come ogni virtù, diventa più facile con l'abitudine.",
    },
  ],
  'stoic.goal_behind': [
    {
      title: '«{{goal}}» è in ritardo',
      message:
        'Servono {{requiredAmount}} al mese, e ne stai mettendo circa {{paceAmount}}. A questo ritmo arriverà con {{monthsLate}} mesi di ritardo.',
    },
    {
      title: '«{{goal}}»: {{monthsLate}} mesi di ritardo a questo ritmo',
      message:
        'Richiesti {{requiredAmount}} al mese, effettivi circa {{paceAmount}}. Sposta la data con onestà o sposta più denaro di proposito.',
    },
    {
      title: "L'obiettivo e il ritmo non concordano",
      message:
        '«{{goal}}» chiede {{requiredAmount}} al mese; riceve {{paceAmount}}. Un obiettivo è reale solo quanto il passo mensile che lo avvicina.',
    },
    {
      title: '«{{goal}}» ha bisogno di un passo più deciso',
      message:
        "{{paceAmount}} al mese contro i {{requiredAmount}} necessari. Il mese prossimo paga prima l'obiettivo, prima di qualsiasi cosa facoltativa.",
    },
    {
      title: 'In ritardo su «{{goal}}»',
      message:
        'Il ritmo attuale ({{paceAmount}}/mese) lo porta a {{monthsLate}} mesi di ritardo. Piccoli aumenti ora valgono più di grandi sacrifici dopo.',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: '«{{goal}}» non entra nel piano',
      message:
        'Servono {{requiredAmount}} al mese, ma dopo i tuoi budget restano liberi solo {{freeAmount}}. Cambia la data, la cifra o i budget: sperare non è un piano.',
    },
    {
      title: '«{{goal}}» chiede più di quanto hai libero',
      message:
        '{{requiredAmount}} richiesti ogni mese, {{freeAmount}} disponibili. Volere tutto insieme è il modo di non ottenere nulla: scegli.',
    },
    {
      title: 'I numeri dicono di no, per ora',
      message:
        '«{{goal}}» richiede {{requiredAmount}} al mese; il tuo margine libero è {{freeAmount}}. Regola ciò che è in tuo potere: la scadenza o gli altri limiti.',
    },
    {
      title: '«{{goal}}» richiede una decisione',
      message:
        'Con {{requiredAmount}} al mese supera i {{freeAmount}} che restano dopo i budget. Un obiettivo scelto a occhi aperti è meglio di uno tenuto in vita da pii desideri.',
    },
    {
      title: 'Un ritmo impossibile per «{{goal}}»',
      message:
        'Richiesti {{requiredAmount}} al mese, liberi {{freeAmount}}. Un calcolo onesto oggi risparmia una delusione domani.',
    },
  ],
  'stoic.shortfall': [
    {
      title: 'Il saldo scende sotto zero il {{date}}',
      message:
        'I pagamenti in arrivo per {{committedAmount}} portano il saldo previsto a {{lowestAmount}}. Preparati ora, finché è solo una previsione.',
    },
    {
      title: 'Un ammanco in arrivo: {{date}}',
      message:
        'I pagamenti già impegnati ({{committedAmount}}) superano il saldo, che tocca il minimo di {{lowestAmount}}. Anticipare le difficoltà è il modo per toglier loro potere.',
    },
    {
      title: 'Preparati per il {{date}}',
      message:
        'Quel giorno il saldo previsto arriva a {{lowestAmount}}. Sposta un pagamento, rinvia un desiderio o metti da parte del contante: ognuna di queste cose è in tuo potere oggi.',
    },
    {
      title: 'Gli impegni superano il saldo',
      message:
        'Sono dovuti {{committedAmount}} e il saldo scende a {{lowestAmount}} intorno al {{date}}. La risposta calma è quella tempestiva.',
    },
    {
      title: 'Prevedi il vuoto del {{date}}',
      message:
        'Saldo minimo previsto: {{lowestAmount}}. Ciò che è previsto si affronta con compostezza; ciò che ci sorprende, raramente.',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: 'Hai mantenuto la parola data a te stesso',
      message:
        "Da {{months}} mesi di fila le tue spese restano nel piano che ti sei dato. Ecco com'è il dominio di sé.",
    },
    {
      title: '{{months}} mesi dentro il piano',
      message:
        'Mese dopo mese, ciò che intendi e ciò che fai coincidono. La costanza è più silenziosa della forza di volontà e dura di più.',
    },
    {
      title: "Piano e vita vanno d'accordo",
      message:
        '{{months}} mesi consecutivi entro i tuoi limiti. Un piano rispettato così bene non è più una restrizione: è il tuo modo di vivere.',
    },
    {
      title: 'Costante da {{months}} mesi',
      message: 'I tuoi budget tengono da {{months}} mesi. Mantieni la stessa attenzione: funziona.',
    },
    {
      title: 'Disciplina, mantenuta',
      message:
        '{{months}} mesi senza infrangere il tuo piano. Poche cose liberano quanto il fidarsi delle proprie decisioni.',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: 'Il tuo denaro segue i tuoi valori',
      message:
        'La virtù ha preso il {{actual}}% delle spese, non meno del {{planned}}% previsto. Ben speso.',
    },
    {
      title: 'La virtù ha avuto tutta la sua parte',
      message:
        'Il {{actual}}% a salute, studio e altri, contro il {{planned}}% previsto. Ciò a cui tieni, lo hai pagato.',
    },
    {
      title: 'Speso per diventare migliore',
      message:
        'Questo mese la virtù ha raggiunto il {{actual}}% delle spese (previsto {{planned}}%). Quel denaro lavora per te molto dopo essere stato speso.',
    },
    {
      title: 'Intenzione realizzata',
      message:
        'Avevi previsto il {{planned}}% per la virtù e hai speso il {{actual}}%. Le buone intenzioni sopravvivono di rado a un mese; le tue sì.',
    },
    {
      title: 'Il miglior uso del denaro',
      message:
        'Il {{actual}}% è andato a ciò che rende migliori te e gli altri. Continua a sceglierlo.',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: 'Lo svago al suo posto',
      message:
        'Lo svago è il {{actual}}% delle spese, sotto il {{planned}}% che gli hai concesso. Godi delle cose senza farti governare da esse.',
    },
    {
      title: 'Piacere, nella giusta misura',
      message:
        'Lo svago ha preso il {{actual}}% contro il {{planned}}% previsto. Moderazione non è perdersi qualcosa: è scegliere.',
    },
    {
      title: 'Riposo senza eccessi',
      message:
        'Il {{actual}}% allo svago, sotto il tuo limite del {{planned}}%. Il piacere ha un sapore migliore quando non comanda.',
    },
    {
      title: 'Temperanza, in silenzio',
      message:
        'Allo svago avevi dato il {{planned}}% e ne ha usato solo il {{actual}}%. Quel margine è libertà che hai conservato.',
    },
    {
      title: 'Svago sotto il piano',
      message:
        'Con il {{actual}}% delle spese, lo svago è rimasto sotto il {{planned}}% che avevi fissato. Ben fatto.',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: '{{percent}}% sotto il piano',
      message:
        'Questo mese hai speso {{savedAmount}} in meno di quanto ti eri concesso. Non aver bisogno di tutto ciò che potresti avere è una forma di ricchezza.',
    },
    {
      title: '{{savedAmount}} non spesi',
      message:
        'Il mese si è chiuso del {{percent}}% sotto il piano. Ciò che non hai speso puoi ancora indirizzarlo tu.',
    },
    {
      title: 'Meno di quanto ti eri concesso',
      message:
        "Le spese sono del {{percent}}% sotto il piano: {{savedAmount}} conservati. Dai a quel margine uno scopo prima che se lo prenda l'abitudine.",
    },
    {
      title: 'Il piano aveva spazio in più',
      message:
        'Questo mese le spese sono {{savedAmount}} sotto i tuoi limiti. Una moderazione che viene facile è quella che dura.',
    },
    {
      title: 'Un mese più leggero del previsto',
      message:
        'Ti è servito il {{percent}}% in meno di quanto avevi messo in budget. Valuta di destinare i {{savedAmount}} a un obiettivo.',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '«{{goal}}» è nei tempi',
      message:
        "Sei al {{percent}}% del cammino, al ritmo che l'obiettivo richiede. Passi costanti, fatti ogni mese, portano lontano.",
    },
    {
      title: 'In linea con «{{goal}}»',
      message: "Al {{percent}}% e il ritmo tiene. Continua a pagare prima l'obiettivo: funziona.",
    },
    {
      title: '«{{goal}}»: {{percent}}% e costante',
      message:
        "L'obiettivo riceve ogni mese ciò di cui ha bisogno. La pazienza sta facendo il suo lavoro.",
    },
    {
      title: "L'obiettivo avanza come previsto",
      message:
        "«{{goal}}» è finanziato al {{percent}}% ed è nei tempi. Ciò che si fa un po' ogni mese non può essere fermato da una settimana storta.",
    },
    {
      title: 'Progressi di cui fidarsi',
      message:
        "«{{goal}}» è al {{percent}}%, nei tempi. Lo stai costruendo nell'unico modo che funziona: gradualmente.",
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: "Meno acquisti d'impulso da {{merchant}}",
      message:
        "Da {{before}} acquisti il mese scorso a circa {{after}} questo mese. Un'abitudine allentata è libertà guadagnata.",
    },
    {
      title: '{{merchant}}: {{before}} → {{after}}',
      message:
        "Ci vai meno di prima. Ogni riflesso saltato è una piccola vittoria della scelta sull'abitudine.",
    },
    {
      title: 'La piccola abitudine si riduce',
      message:
        'Gli acquisti da {{merchant}} sono scesi da {{before}} a circa {{after}}. Continua: diventa più facile.',
    },
    {
      title: 'La scelta prima del riflesso',
      message:
        'Da {{merchant}} gli acquisti sono passati da {{before}} a circa {{after}}. È padronanza costruita una decisione alla volta.',
    },
    {
      title: 'Meno piccole spese',
      message:
        'Da {{merchant}} circa {{after}} volte invece di {{before}}. Le piccole vittorie si sommano.',
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: 'Adattamento a un mese più magro',
      message:
        'Il reddito è sceso del {{incomePercent}}% e tu hai ridotto le spese del {{expensePercent}}%. Hai risposto a un cambio di fortuna con un cambio di rotta.',
    },
    {
      title: 'Compostezza quando il reddito è calato',
      message:
        'Reddito giù del {{incomePercent}}%, spese giù del {{expensePercent}}%. Hai seguito ciò che è, non ciò che era.',
    },
    {
      title: 'La fortuna è cambiata, e tu con lei',
      message:
        'A un calo del reddito del {{incomePercent}}% ha risposto un calo delle spese del {{expensePercent}}%. Questa è serenità espressa in numeri.',
    },
    {
      title: 'Ben governato',
      message:
        'Quando il reddito è sceso del {{incomePercent}}%, le spese lo hanno seguito (−{{expensePercent}}%). Il vento non era tuo; la vela sì.',
    },
    {
      title: 'Le spese hanno seguito il reddito',
      message:
        'Hai speso il {{expensePercent}}% in meno mentre il reddito calava del {{incomePercent}}%. Adattarsi presto è la via calma.',
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: 'Le necessità sono stabili',
      message:
        'Da {{months}} mesi i tuoi costi essenziali si sono mossi appena. Un pavimento stabile ti dà libertà al di sopra.',
    },
    {
      title: 'Bisogni sotto controllo',
      message:
        'La spesa per le necessità è rimasta stabile per {{months}} mesi. I bisogni che non crescono sono bisogni che governi.',
    },
    {
      title: '{{months}} mesi di essenziale stabile',
      message:
        'Affitto, cibo e bollette sono rimasti dove erano. Anche la stabilità silenziosa è un risultato.',
    },
    {
      title: 'Nessuna deriva nelle necessità',
      message:
        '{{months}} mesi senza scivolamenti in ciò che la vita richiede. Su questa base, tutto il resto è più facile da pianificare.',
    },
    {
      title: 'Un pavimento solido',
      message:
        'La spesa essenziale è stabile da {{months}} mesi. Non lasci che le comodità si travestano da bisogni.',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: 'Generoso con ciò che guadagni',
      message:
        'In {{months}} mesi il {{percent}}% del tuo reddito — {{givenAmount}} — è andato ad aiutare gli altri. È denaro usato nel modo migliore.',
    },
    {
      title: '{{givenAmount}} dati agli altri',
      message:
        'Hai condiviso il {{percent}}% del tuo reddito in {{months}} mesi. La gentilezza che si vede nei numeri è gentilezza praticata, non solo sentita.',
    },
    {
      title: 'Mani aperte',
      message:
        'Beneficenza e regali hanno preso ultimamente il {{percent}}% del tuo reddito. Ciò che doni è la parte della tua ricchezza che nessuna sventura può toglierti.',
    },
    {
      title: 'La generosità fa parte del tuo piano',
      message:
        '{{givenAmount}} agli altri in {{months}} mesi. Continua così: il bene che fai agli altri lo fai anche a te stesso.',
    },
    {
      title: 'Ben donato',
      message:
        'Il {{percent}}% di ciò che hai guadagnato è andato ad aiutare gli altri. Poche abitudini dicono di più su una persona.',
    },
  ],
  'stoic.praise_steady': [
    {
      title: 'Niente da correggere',
      message: 'Le tue spese corrispondono a ciò che avevi in mente. Continua così.',
    },
    {
      title: 'Intenzione e azione concordano',
      message:
        "Questo mese somiglia a come l'avevi pianificato. Quell'accordo è tutto ciò che conta.",
    },
    {
      title: 'Un mese calmo',
      message:
        'Nessun eccesso, nessuna trascuratezza degna di nota. Ben fatto: porta avanti la stessa attenzione.',
    },
    {
      title: 'Tutto in ordine',
      message: 'Il piano ha tenuto e nulla chiede correzioni. Goditi la quiete che hai meritato.',
    },
    {
      title: 'Mano ferma',
      message:
        'Il mese ha seguito il tuo piano. Le buone abitudini fanno sembrare ordinari i buoni mesi.',
    },
  ],
  'expert.pay_yourself_first': [
    {
      title: 'Paga prima te stesso',
      message:
        'La regola di George S. Clason: una parte di tutto ciò che guadagni è tua da conservare — almeno un decimo. In {{months}} mesi hai conservato il {{savingsPercent}}%. Metti da parte {{tenthAmount}} il giorno in cui arriva il reddito, prima di ogni altra cosa.',
    },
    {
      title: 'Un decimo è tuo',
      message:
        "Ne «L'uomo più ricco di Babilonia», il primo rimedio per una borsa vuota è tenere una moneta ogni dieci. Il tuo tasso di risparmio è del {{savingsPercent}}%; {{tenthAmount}} al mese basterebbero per iniziare l'abitudine.",
    },
    {
      title: 'Risparmia prima di spendere, non dopo',
      message:
        'Il consiglio di Clason è semplice: paga prima te stesso. Ultimamente ti è rimasto il {{savingsPercent}}% del reddito. Metti da parte {{tenthAmount}} il giorno di paga e lascia che le spese si adattino a ciò che resta.',
    },
    {
      title: 'La prima moneta è tua',
      message:
        'Una parte di tutto ciò che guadagni dovrebbe restare a te — non meno di un decimo, dice Clason. Hai conservato il {{savingsPercent}}% in {{months}} mesi. Inizia con {{tenthAmount}} al mese, in automatico.',
    },
    {
      title: '{{savingsPercent}}% conservato — la regola chiede il 10%',
      message:
        "Paga prima te stesso, come dice «L'uomo più ricco di Babilonia»: {{tenthAmount}} al mese, messi da parte prima di qualsiasi bolletta. Il risparmio fatto per primo non dipende da ciò che avanza.",
    },
  ],
  'expert.rule_50_30_20': [
    {
      title: 'Il tuo controllo 50/30/20',
      message:
        "Elizabeth Warren e Amelia Warren Tyagi suggeriscono il 50% del reddito netto per l'indispensabile, il 30% per i desideri, il 20% per il risparmio. I tuoi: {{needsPercent}}% / {{wantsPercent}}% / {{savingsPercent}}%.",
    },
    {
      title:
        'Necessità {{needsPercent}}%, desideri {{wantsPercent}}%, risparmio {{savingsPercent}}%',
      message:
        '«All Your Worth» bilancia il denaro secondo il 50/30/20. Confronta con il tuo piano la voce più lontana dal suo obiettivo: è lì che un solo cambiamento aiuta di più.',
    },
    {
      title: 'Come si divide il tuo reddito',
      message:
        "L'indispensabile prende il {{needsPercent}}% del reddito, i desideri il {{wantsPercent}}%, e il {{savingsPercent}}% viene risparmiato. L'equilibrio 50/30/20 di «All Your Worth» è uno specchio utile, non un verdetto.",
    },
    {
      title: 'La formula del denaro in equilibrio',
      message:
        'La formula di Warren e Tyagi: metà per ciò che devi pagare in ogni caso, il 30% per i desideri, il 20% per il futuro. Tu sei a {{needsPercent}}/{{wantsPercent}}/{{savingsPercent}}.',
    },
    {
      title: 'A confronto con il 50/30/20',
      message:
        "La tua ripartizione è {{needsPercent}}% indispensabile, {{wantsPercent}}% desideri, {{savingsPercent}}% risparmio. Il test del libro per l'indispensabile: lo pagheresti ancora se domani perdessi il lavoro?",
    },
  ],
  'expert.room_for_error': [
    {
      title: "Lascia spazio all'errore",
      message:
        'Il consiglio di Morgan Housel: pianifica mettendo in conto che le cose non vadano secondo i piani. Il tuo saldo copre circa {{cushionDays}} giorni di spesa; un riferimento comune è tre mesi — {{targetAmount}}.',
    },
    {
      title: 'Un cuscinetto di {{cushionDays}} giorni',
      message:
        "«La psicologia dei soldi» lo chiama margine d'errore — il gioco che ti permette di superare le sorprese. Arrivare a {{targetAmount}}, tre mesi di spesa, dà al piano la possibilità di sopravvivere alla realtà.",
    },
    {
      title: 'Margine di sicurezza, in casa',
      message:
        'Housel prende in prestito il margine di sicurezza di Graham per le finanze personali. Con {{cushionDays}} giorni di spesa in riserva, un solo mese storto potrebbe disfare un buon piano. Punta a {{targetAmount}}.',
    },
    {
      title: "Spazio per l'imprevisto",
      message:
        "La tua riserva durerebbe circa {{cushionDays}} giorni. Le sorprese sono l'unica certezza; tre mesi di spesa ({{targetAmount}}) sono un obiettivo molto diffuso.",
    },
    {
      title: 'Crea margine prima che serva',
      message:
        "Il margine d'errore, nelle parole di Morgan Housel, è ciò che ti tiene in gioco. Hai circa {{cushionDays}} giorni coperti; {{targetAmount}} ne coprirebbero tre mesi.",
    },
  ],
  'expert.lifestyle_creep': [
    {
      title: 'La spesa corre più del reddito',
      message:
        "La spesa è salita del {{expenseGrowth}}% nell'ultimo trimestre, mentre il reddito è cambiato del {{incomeGrowth}}%. La prima regola di «The Millionaire Next Door»: qualunque sia il tuo reddito, vivi al di sotto delle tue possibilità.",
    },
    {
      title: 'Vivere meglio, non diventare più ricchi',
      message:
        'Stanley e Danko hanno scoperto che la ricchezza è ciò che accumuli, non ciò che spendi. La tua spesa è cresciuta del {{expenseGrowth}}%, il reddito del {{incomeGrowth}}%: è da questo divario che la ricchezza sfugge.',
    },
    {
      title: 'Tenore di vita in salita: +{{expenseGrowth}}%',
      message:
        'Le spese sono salite più in fretta del reddito ({{incomeGrowth}}%). Le persone di «The Millionaire Next Door» sono rimaste ricche lasciando crescere il reddito senza che la spesa lo seguisse.',
    },
    {
      title: 'Il traguardo si sposta',
      message:
        "La spesa è salita del {{expenseGrowth}}% da un trimestre all'altro, contro il {{incomeGrowth}}% del reddito. Vivi al di sotto delle tue possibilità, dicono Stanley e Danko — quali che siano.",
    },
    {
      title: 'La ricchezza è ciò che conservi',
      message:
        "Un buon reddito speso per intero non rende più ricco nessuno. Nell'ultimo trimestre la tua spesa è cresciuta del {{expenseGrowth}}% e il reddito del {{incomeGrowth}}%: vale un'occhiata prima che diventi la nuova normalità.",
    },
  ],
  'expert.life_energy': [
    {
      title: '{{merchant}} ti è costato {{hours}} ore di vita',
      message:
        'Vicki Robin e Joe Dominguez suggeriscono di misurare le cose in energia vitale — le ore di lavoro che costano. {{totalAmount}} da {{merchant}} questo mese sono circa {{hours}} ore. Ne valeva la pena?',
    },
    {
      title: '{{hours}} ore da {{merchant}}',
      message:
        '«Your Money or Your Life» invita a vedere il denaro come il tempo che hai scambiato per ottenerlo. Al tuo reddito orario medio, {{totalAmount}} spesi lì equivalgono a circa {{hours}} ore di lavoro.',
    },
    {
      title: 'Misuralo in ore',
      message:
        "{{totalAmount}} da {{merchant}} sono circa {{hours}} ore di lavoro. Robin e Dominguez la chiamano energia vitale — l'unica moneta che non puoi riguadagnare.",
    },
    {
      title: 'Quanto è costato davvero {{merchant}}',
      message:
        'Il denaro è qualcosa con cui scambiamo la nostra energia vitale. Questo mese {{merchant}} ti ha preso circa {{hours}} ore ({{totalAmount}}). Il piacere vale quelle ore?',
    },
    {
      title: "Controllo dell'energia vitale",
      message:
        'Convertiti al tuo reddito orario medio, i {{totalAmount}} spesi da {{merchant}} sono circa {{hours}} ore. «Your Money or Your Life» suggerisce di chiederti se ti hanno dato una soddisfazione proporzionata.',
    },
  ],
};
