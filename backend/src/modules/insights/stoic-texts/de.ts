import type { StoicTextMap } from './types';

export const de: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: 'Der Monat ist über seinen Plan hinausgewachsen',
      message:
        'Geplant waren {{plannedAmount}}, ausgegeben sind {{spentAmount}} — {{percent}}% mehr. Der Plan entstand mit klarem Kopf; lassen Sie ihn lauter sprechen als den Augenblick.',
    },
    {
      title: '{{percent}}% über dem, was Sie ausgeben wollten',
      message:
        'Die Ausgaben stehen bei {{spentAmount}}, geplant waren {{plannedAmount}}. Sehen Sie nach, welche Grenze zuerst nachgab — dort liegt die Lehre.',
    },
    {
      title: 'Plan und Monat sind sich uneins',
      message:
        '{{spentAmount}} ausgegeben, {{plannedAmount}} vorgesehen. Entweder hat der Plan zu wenig von der Wirklichkeit verlangt oder die Wirklichkeit zu viel von Ihnen — entscheiden Sie in Ruhe, was davon.',
    },
    {
      title: 'Es ging mehr hinaus, als Sie erlaubt hatten',
      message:
        'Der Monat liegt {{percent}}% über den {{plannedAmount}}, die Sie festgelegt haben. Wer jetzt innehält, verliert nichts; wer so tut, als sei nichts geschehen, verliert viel.',
    },
    {
      title: 'Eine selbst gesetzte Grenze, selbst überschritten',
      message:
        'Vorgenommen hatten Sie {{plannedAmount}}; es sind {{spentAmount}}. Selbstbeherrschung heißt nicht, nie zu straucheln — sondern es früh zu bemerken und auf den Weg zurückzukehren.',
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: 'Freizeit nimmt mehr als geplant',
      message:
        'Sie wollten der Freizeit {{planned}}% Ihrer Ausgaben geben; diesen Monat sind es {{actual}}%. Das Vergnügen ist als Gast willkommen, nicht als Herr im Haus.',
    },
    {
      title: 'Freizeit bei {{actual}}%, geplant {{planned}}%',
      message:
        'Erholung verdient ihren Platz, wenn sie Sie wirklich erholt. Fragen Sie, welche Vergnügen dieses Monats das taten, und lassen Sie die übrigen ohne Bedauern ziehen.',
    },
    {
      title: 'Die Bequemlichkeit überholt den Vorsatz',
      message:
        'Die Freizeit hält {{actual}}% der Ausgaben, gewählt hatten Sie {{planned}}%. Maß halten heißt nicht, auf Freude zu verzichten — sondern ihr die Größe zu lassen, die Sie bestimmt haben.',
    },
    {
      title: 'Das Angenehme verdrängt das Geplante',
      message:
        'Sie haben der Freizeit {{planned}}% zugedacht, sie nahm sich {{actual}}%. Was man leicht genießt, verdient einen zweiten Blick, bevor es zu etwas wird, das man braucht.',
    },
    {
      title: 'Die Freizeit hat ihre Linie überschritten',
      message:
        '{{actual}}% des Monats gingen in die Freizeit, {{planned}}% waren vorgesehen. Die Linie haben Sie gezogen — und Sie können sie auch halten.',
    },
  ],
  'stoic.leisure_habit': [
    {
      title: 'Freizeit wieder über Plan',
      message:
        'Die Freizeit lag in {{months}} der letzten {{window}} Monate über Ihrem Plan. Eine Wiederholung ist kein Zufall mehr, sondern eine Gewohnheit, die man prüfen sollte.',
    },
    {
      title: '{{months}} von {{window}} Monaten über dem Freizeitplan',
      message:
        'Was einmal geschieht, ist Umstand; was sich wiederholt (hier: {{months}}-mal), formt den Charakter. Wählen Sie diesen Charakter bewusst.',
    },
    {
      title: 'Derselbe Ausrutscher, Monat für Monat',
      message:
        'Die Freizeit hat den Plan in {{months}} von {{window}} Monaten überschritten. Heben Sie den Plan ehrlich an oder ändern Sie die Gewohnheit — dazwischen zu leben kostet am meisten.',
    },
    {
      title: 'Ein Muster, kein Versehen',
      message:
        'In {{months}} der letzten {{window}} Monate nahm die Freizeit mehr, als Sie ihr gaben. Achten Sie auf den Moment, in dem die Entscheidung fällt, nicht erst auf die Rechnung danach.',
    },
    {
      title: 'Die Gewohnheit stimmt gegen Ihren Plan',
      message:
        'Die Freizeit schlug den Plan in {{months}} von {{window}} Monaten. Gewohnheiten entstehen Entscheidung um Entscheidung — und so lösen sie sich auch wieder.',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: 'Tugend bekommt weniger als beabsichtigt',
      message:
        'Sie haben {{planned}}% Ihres Budgets für Gesundheit, Lernen und andere vorgesehen; bisher sind es {{actual}}%. Ein Vorsatz zählt erst, wenn er umgesetzt ist.',
    },
    {
      title: 'Tugend bei {{actual}}% von geplanten {{planned}}%',
      message:
        'Das Geld für das, was Sie besser macht, wartet noch. Es gibt keinen besseren Zeitpunkt, es gut auszugeben, als diesen Monat.',
    },
    {
      title: 'Das geplante Gute ist noch nicht ausgegeben',
      message:
        'Gesundheit, Lernen und Großzügigkeit sollten {{planned}}% der Ausgaben erhalten; es wurden {{actual}}%. Tun Sie diese Woche eines davon — bewusst.',
    },
    {
      title: 'Vorsatz ohne Tat',
      message:
        'Die Tugend hält {{actual}}% der Ausgaben, gewählt hatten Sie {{planned}}%. Was wir schätzen, zeigt sich in dem, wofür wir tatsächlich bezahlen.',
    },
    {
      title: 'Noch Raum für das Wesentliche',
      message:
        'Nur {{actual}}% gingen an die Tugend, geplant waren {{planned}}%. Ein Buch, eine Vorsorgeuntersuchung, eine Gabe für jemanden in Not — der Plan hat längst Ja gesagt.',
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: 'Tugend wird immer wieder aufgeschoben',
      message:
        'Die Ausgaben für Gesundheit, Lernen und andere liegen seit {{months}} Monaten in Folge unter Ihrem Plan. Was Sie ständig aufschieben, haben Sie in Wahrheit schon abgelehnt.',
    },
    {
      title: '{{months}} Monate aufgeschobene Tugend',
      message:
        'Jeden Monat machte der Plan Platz für das, was Sie besser macht, und jeden Monat blieb er ungenutzt. Zeit ist das Einzige, das sich nicht zweimal verplanen lässt.',
    },
    {
      title: 'Das bessere Selbst wartet noch',
      message:
        'Die Tugend liegt seit {{months}} Monaten unter Plan. Beginnen Sie lieber klein und sicher als groß und später.',
    },
    {
      title: 'Gute Vorsätze werden alt',
      message:
        'Seit {{months}} Monaten bekommen Gesundheit, Lernen und Großzügigkeit weniger als geplant. Wählen Sie eines davon und bedienen Sie es nächsten Monat zuerst, vor allem anderen.',
    },
    {
      title: 'Die Tugend verliert gegen „später“',
      message:
        '{{months}} Monate in Folge unter Plan. „Später“ ist der Ort, an dem gute Vorsätze vergessen werden — geben Sie diesem ein Datum.',
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: 'Ihr Plan hat keinen Platz für Tugend',
      message:
        'Keines Ihrer Budgets dient Gesundheit, Lernen oder anderen. Ein Plan zeigt, was uns wichtig ist — geben Sie der Tugend eine eigene Zeile.',
    },
    {
      title: 'Budgets für alles, nur nicht für das Gute',
      message:
        'Notwendiges, Arbeit und Freizeit haben Grenzen; die Tugend hat keine. Was nie eingeplant wird, geschieht meist auch nie.',
    },
    {
      title: 'Planen Sie für das, was Sie besser macht',
      message:
        'In der Klasse Tugend gibt es noch kein Budget. Schon ein kleines — Bücher, Sport, eine Spende — macht aus einem Wunsch eine Verpflichtung.',
    },
    {
      title: 'Der Plan schweigt über die Tugend',
      message:
        'Sie planen für das, was Sie müssen, und für das, was Sie genießen — noch nicht für den Menschen, der Sie werden wollen. Ein bescheidenes Tugend-Budget würde das ändern.',
    },
    {
      title: 'Die Tugend hat kein Budget',
      message:
        'Ausgaben für Gesundheit, Lernen oder andere sind nirgends eingeplant. Wählen Sie eines und geben Sie ihm eine Grenze, die Sie gern erreichen würden.',
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: 'Notwendiges kostet mehr als geplant',
      message:
        'Sie hatten {{planned}}% der Ausgaben für Notwendiges vorgesehen; es sind {{actual}}%. Prüfen Sie, ob jeder Posten noch ein Bedürfnis ist oder still zur Bequemlichkeit wurde.',
    },
    {
      title: 'Notwendiges bei {{actual}}%, geplant {{planned}}%',
      message:
        'Was das Leben verlangt, ist meist weniger als das, woran wir uns gewöhnen. Betrachten Sie den größten notwendigen Posten mit frischen Augen.',
    },
    {
      title: 'Das Unverzichtbare wächst',
      message:
        'Notwendiges hält {{actual}}% des Monats, erwartet hatten Sie {{planned}}%. Ein Bedürfnis, das ständig wächst, verdient eine Frage.',
    },
    {
      title: 'Die Bedürfnisse wachsen über den Plan hinaus',
      message:
        'Geplant {{planned}}%, tatsächlich {{actual}}%. Entweder hat der Plan die echten Kosten unterschätzt, oder manche Wünsche reisen unter dem Namen von Bedürfnissen.',
    },
    {
      title: 'Mehr für das „Muss“ als gedacht',
      message:
        'Notwendiges nahm {{actual}}% der Ausgaben statt {{planned}}%. Trennen Sie, was wirklich sein muss, von dem, was nur schon immer so war.',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: 'Notwendiges steigt schleichend',
      message:
        'Die Ausgaben für Notwendiges sind {{months}} Monate in Folge gestiegen, insgesamt um {{percent}}%. Bedürfnisse wachsen leise, wenn niemand sie nach ihrer Berechtigung fragt.',
    },
    {
      title: '+{{percent}}% für Notwendiges in {{months}} Monaten',
      message:
        'Jeder Schritt wirkte klein; zusammen sind sie es nicht. Nehmen Sie den größten wiederkehrenden Posten und fragen Sie, ob er noch so viel kosten muss.',
    },
    {
      title: 'Der Boden Ihrer Ausgaben hebt sich',
      message:
        'Notwendiges ist {{months}} Monate hintereinander gewachsen (+{{percent}}%). Ein steigender Boden lässt weniger Raum für alles, was Sie frei wählen.',
    },
    {
      title: 'Die Bedürfnisse dehnen sich aus',
      message:
        '{{months}} Monate Wachstum, {{percent}}% insgesamt. Die stoische Probe ist einfach: Würden Sie das heute wieder wählen, im Wissen um den Preis?',
    },
    {
      title: 'Kleine Anstiege, klare Richtung',
      message:
        'Notwendiges ist über {{months}} Monate um {{percent}}% gestiegen. Die Richtung zählt mehr als jeder einzelne Monat — diese lohnt sich früh zu korrigieren.',
    },
  ],
  'stoic.work_over_plan': [
    {
      title: 'Arbeit kostet mehr als geplant',
      message:
        'Sie hatten {{planned}}% der Ausgaben für Arbeit vorgesehen; es sind {{actual}}%. Werkzeuge und Dienste sollten sich lohnen — prüfen Sie, welche es tun.',
    },
    {
      title: 'Arbeitsausgaben bei {{actual}}%, geplant {{planned}}%',
      message:
        'Investitionen in die Arbeit sind gut, wenn sie etwas zurückgeben. Sehen Sie durch, wofür Sie bezahlen, es aber nicht mehr nutzen.',
    },
    {
      title: 'Das Arbeitsbudget ist gedehnt',
      message:
        'Die Arbeit nahm {{actual}}% statt {{planned}}%. Fleiß heißt, die Arbeit gut zu tun — nicht, jedes Werkzeug dafür zu kaufen.',
    },
    {
      title: 'Werkzeuge überholen den Plan',
      message:
        'Geplant {{planned}}%, für Arbeit ausgegeben {{actual}}%. Fragen Sie bei jeder Ausgabe: Hilft sie mir bei der Arbeit, oder fühlt sie sich nur nach Fortschritt an?',
    },
    {
      title: 'Die Arbeitskosten sind abgedriftet',
      message:
        'Die Arbeit hält {{actual}}% der Ausgaben, vorgesehen waren {{planned}}%. Eine kurze Prüfung jetzt erspart später eine größere.',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '„{{category}}“ überschreitet erneut die Grenze',
      message:
        '„{{category}}“ lag in {{months}} der letzten {{window}} Monate über dem Budget. Entweder ist die Grenze falsch oder das Verlangen — entscheiden Sie, was davon.',
    },
    {
      title: '„{{category}}“: {{months}} von {{window}} Monaten über Budget',
      message:
        'Eine Grenze, die immer überschritten wird, ist keine Grenze, nur ein Wunsch. Machen Sie sie ehrlich — erhöhen Sie sie bewusst oder halten Sie sie bewusst.',
    },
    {
      title: 'Dasselbe Budget gibt wieder nach',
      message:
        '„{{category}}“ hat seine Grenze in {{months}} von {{window}} Monaten überschritten. Die Wiederholung ist eine Auskunft; nutzen Sie sie.',
    },
    {
      title: '„{{category}}“ verlangt Ihre Aufmerksamkeit',
      message:
        'Über Budget in {{months}} von {{window}} Monaten. Achten Sie auf den Moment vor dem Kauf — nur dort lässt sich die Gewohnheit ändern.',
    },
    {
      title: 'Ein Muster bei „{{category}}“',
      message:
        'Überschreitungen: {{months}} in {{window}} Monaten. Was wir wiederholen, das werden wir; entscheiden Sie, was diese Kategorie über Sie sagen soll.',
    },
  ],
  'stoic.budget_pace': [
    {
      title: '„{{category}}“ ist bis Tag {{day}} aufgebraucht',
      message:
        'Sie haben {{spentAmount}} von {{limitAmount}} ausgegeben; bei diesem Tempo endet die Grenze um Tag {{day}}. Jetzt langsamer zu werden ist leichter, als später anzuhalten.',
    },
    {
      title: '„{{category}}“ ist dem Monat voraus',
      message:
        '{{spentAmount}} sind schon aus einem Rahmen von {{limitAmount}} verbraucht. In diesem Takt ist er bis Tag {{day}} erschöpft — der Rest des Monats liegt noch in Ihrer Hand.',
    },
    {
      title: 'Tempo-Check: „{{category}}“',
      message:
        'Das Budget von {{limitAmount}} reicht beim aktuellen Tempo bis etwa Tag {{day}}. Voraussicht ist die günstigste Form der Disziplin.',
    },
    {
      title: '„{{category}}“ gibt die Zukunft aus',
      message:
        '{{spentAmount}} von {{limitAmount}} ausgegeben; die Grenze endet um Tag {{day}}. Was Sie diese Woche tun, entscheidet, ob es so kommt.',
    },
    {
      title: 'Frühe Warnung für „{{category}}“',
      message:
        'Beim aktuellen Tempo reicht die Grenze von {{limitAmount}} nicht bis zum Monatsende — sie ist um Tag {{day}} aufgebraucht. Korrigieren Sie, solange es wenig kostet.',
    },
  ],
  'stoic.budget_unused': [
    {
      title: '„{{category}}“ bleibt ungenutzt',
      message:
        'Das Budget für „{{category}}“ hat seit {{months}} Monaten keine Ausgabe gesehen. Entweder sind Sie ihm entwachsen, oder es ist ein Vorsatz, der noch wartet — entscheiden Sie, was davon.',
    },
    {
      title: 'Ein leeres Budget: „{{category}}“',
      message:
        '{{months}} Monate ohne eine einzige Ausgabe. Ein Plan sollte das Leben beschreiben, das Sie führen, oder das, das Sie aufbauen — welches ist es hier?',
    },
    {
      title: '„{{category}}“ steht still',
      message:
        'Seit {{months}} Monaten nichts ausgegeben. War es Zurückhaltung, gut gemacht; war es Vernachlässigung, handeln Sie.',
    },
    {
      title: 'Geplant, aber nicht gelebt',
      message:
        '„{{category}}“ hat seit {{months}} Monaten eine Grenze, aber keine Ausgaben. Halten Sie den Plan wahrhaftig: entfernen oder nutzen.',
    },
    {
      title: '„{{category}}“: {{months}} stille Monate',
      message:
        'Ein Budget, das nie berührt wird, belegt trotzdem einen Platz in Ihrem Plan. Geben Sie den Platz frei oder würdigen Sie den Vorsatz.',
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: '{{percent}}% der Ausgaben ohne Grenze',
      message:
        '{{unbudgetedAmount}} flossen diesen Monat in Kategorien, über die kein Budget wacht. Was nicht gemessen wird, lässt sich schwer beherrschen.',
    },
    {
      title: 'Ein großer Teil des Monats ist ungeplant',
      message:
        '{{percent}}% der Ausgaben — {{unbudgetedAmount}} — liegen außerhalb jedes Budgets. Geben Sie dem größten Teil davon eine Grenze, dann sieht der Plan mehr von Ihrem Leben.',
    },
    {
      title: 'Ausgaben außerhalb des Plans',
      message:
        'Die Budgets decken nur einen Teil Ihrer Ausgaben ab; {{unbudgetedAmount}} ({{percent}}%) bleiben ungemessen. Erweitern Sie den Plan dorthin, wo das Geld tatsächlich hingeht.',
    },
    {
      title: 'Der Plan sieht nur einen Teil des Bildes',
      message:
        '{{percent}}% der Ausgaben dieses Monats haben kein Budget. Klare Sicht kommt vor gutem Urteil.',
    },
    {
      title: '{{unbudgetedAmount}} ohne Grenze ausgegeben',
      message:
        'Das sind {{percent}}% des Monats. Sie müssen es nicht einschränken — nur entscheiden, wie viel davon Sie wirklich wollen.',
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '„{{category}}“ ist der Großteil Ihrer Freizeit',
      message:
        '{{percent}}% der Freizeitausgaben gingen an „{{category}}“. Abwechslung in der Erholung ist gesünder, als von einem einzigen Vergnügen abzuhängen.',
    },
    {
      title: 'Ein Vergnügen dominiert',
      message:
        '„{{category}}“ nimmt {{percent}}% von allem, was Sie für Freizeit ausgegeben haben. Fragen Sie, ob es Sie noch erfreut oder schon Routine geworden ist.',
    },
    {
      title: 'Die Freizeit stützt sich auf „{{category}}“',
      message:
        '{{percent}}% der Freizeit an einem Ort. Worauf wir nicht verzichten können, das hält uns fest — prüfen Sie, ob der Griff noch locker ist.',
    },
    {
      title: '„{{category}}“: {{percent}}% der Freizeit',
      message:
        'Eine einzige Quelle der Freude nimmt fast alles davon ein. Probieren Sie diesen Monat ein günstigeres, anderes Vergnügen und vergleichen Sie.',
    },
    {
      title: 'Ihre Erholung hat nur eine Adresse',
      message:
        'Das meiste Freizeitgeld — {{percent}}% — geht an „{{category}}“. Zur Freiheit gehört auch, anderes genießen zu können.',
    },
  ],
  'stoic.unclassified': [
    {
      title: 'Manche Ausgaben sind noch nicht beurteilt',
      message:
        'Kategorien ohne Klasse: {{count}}. Legen Sie unter Budgets fest, was Notwendiges, Arbeit, Tugend oder Freizeit ist.',
    },
    {
      title: 'Kategorien, die auf Ihr Urteil warten: {{count}}',
      message:
        'Sie haben Ausgaben, aber keine Klasse, daher kann der Rat sie nicht gewichten. Eine Minute unter Budgets klärt das.',
    },
    {
      title: 'Benennen Sie, wem Ihr Geld dient',
      message:
        'Noch nicht eingeordnete Kategorien: {{count}}. Urteilen beginnt damit, die Dinge beim richtigen Namen zu nennen.',
    },
    {
      title: 'Unbeurteilte Ausgaben — Kategorien: {{count}}',
      message:
        'Ist es ein Bedürfnis, Ihre Arbeit, eine Tugend oder ein Vergnügen? Nur Sie können es sagen — und der Plan wird klarer, sobald Sie es tun.',
    },
    {
      title: 'Einige Kategorien haben keine Klasse',
      message:
        'Außerhalb der vier Klassen: {{count}}. Ordnen Sie sie unter Budgets ein, damit jede Ausgabe als das gesehen wird, was sie ist.',
    },
  ],
  'stoic.small_purchases': [
    {
      title: 'Kleine Käufe bei {{merchant}}: {{count}}',
      message:
        'Jeder wirkte belanglos; zusammen ergaben sie diesen Monat {{totalAmount}}. In kleinen, ungeprüften Gewohnheiten verschwindet das meiste Geld leise.',
    },
    {
      title: '{{merchant}}: {{count}}-mal diesen Monat',
      message:
        '{{totalAmount}} in kleinen Beträgen. Fragen Sie, ob jeder Besuch eine Wahl war oder ein Reflex — nur das Erste ist Freiheit.',
    },
    {
      title: 'Nach und nach: {{totalAmount}}',
      message:
        'Käufe bei {{merchant}}: {{count}}. Kein einzelner zählt; die Gewohnheit schon. Entscheiden Sie, wie oft Sie es wirklich wollen.',
    },
    {
      title: 'Eine Gewohnheit bei {{merchant}}',
      message:
        'Käufe: {{count}}, insgesamt {{totalAmount}}. Lassen Sie diesen Monat jeden dritten aus und sehen Sie, ob er Ihnen fehlt.',
    },
    {
      title: 'Das Kleine summiert sich',
      message:
        'Bei {{merchant}} waren Sie {{count}}-mal, für {{totalAmount}}. Herrschaft über große Entscheidungen baut auf kleinen wie diesen auf.',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: 'Wochenenden tragen {{percent}}% der Freizeit',
      message:
        'Der Großteil Ihrer Freizeitausgaben fällt auf Samstag und Sonntag. Ruhe ist gut; prüfen Sie, ob es Ruhe ist und nicht Ausgleich für die Woche.',
    },
    {
      title: 'Die Freizeit lebt am Wochenende',
      message:
        '{{percent}}% der Freizeitausgaben fallen aufs Wochenende. Planen Sie das Wochenende ein wenig, dann kostet es weniger und gibt mehr.',
    },
    {
      title: 'Das Wochenende bezahlt für die Woche',
      message:
        'Wochenenden nehmen {{percent}}% Ihrer Freizeitausgaben. Wenn die Woche jeden Samstag repariert werden muss, schauen Sie auf die Woche.',
    },
    {
      title: 'Samstag und Sonntag: {{percent}}% der Freizeit',
      message:
        'Freie Tage laden zu freigiebigem Ausgeben ein. Entscheiden Sie vor dem Wochenende, wofür es da ist, und lassen Sie das Geld folgen.',
    },
    {
      title: 'Ein Wochenendmuster',
      message:
        '{{percent}}% der Freizeitausgaben geschehen am Wochenende. Mehr Leichtigkeit unter der Woche macht Wochenenden oft günstiger.',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}} nahm {{percent}}% des Monats',
      message:
        '{{totalAmount}} gingen an einen einzigen Händler für Freizeit. Wenn ein Ort so viel von Ihrem Geld hat, fragen Sie, wie viel er auch von Ihrer Aufmerksamkeit hat.',
    },
    {
      title: 'Ein Ort, {{totalAmount}}',
      message:
        '{{merchant}} macht {{percent}}% der Ausgaben dieses Monats aus. Ist er diesen Anteil Ihrer Lebensarbeit wert?',
    },
    {
      title: '{{merchant}} führt Ihre Ausgaben an',
      message:
        '{{percent}}% des Monats — {{totalAmount}} — gingen dorthin. Nichts dagegen, es zu genießen, solange Sie es wieder wählen würden.',
    },
    {
      title: 'Ein großer Anteil bei {{merchant}}',
      message:
        '{{totalAmount}}, also {{percent}}% der Ausgaben, an einem einzigen Ort der Freizeit. Wägen Sie das Vergnügen gegen den Preis ab, in Ruhe.',
    },
    {
      title: '{{percent}}% bei {{merchant}}',
      message:
        'Dieser eine Händler nahm {{totalAmount}}. Freiheit heißt, an ihm vorbeigehen zu können, wenn Sie es wollen.',
    },
  ],
  'stoic.income_drop': [
    {
      title: 'Das Einkommen sank, die Ausgaben nicht',
      message:
        'Das Einkommen fiel um {{percent}}% auf {{incomeAmount}}, doch die Ausgaben blieben bei {{expenseAmount}}. Das Schicksal hat es sich anders überlegt; Ihre Ausgaben haben es noch nicht bemerkt.',
    },
    {
      title: 'Einkommen {{percent}}% niedriger',
      message:
        '{{incomeAmount}} kamen herein, {{expenseAmount}} gingen hinaus. Was das Schicksal gibt, kann es zurücknehmen — richten Sie die Ausgaben nach dem, was ist, nicht nach dem, was war.',
    },
    {
      title: 'Ein magerer Monat, dieselben Gewohnheiten',
      message:
        'Das Einkommen liegt {{percent}}% niedriger ({{incomeAmount}}), die Ausgaben hielten sich bei {{expenseAmount}}. Das Einkommen liegt nicht in Ihrer Macht; Ihre Antwort darauf schon.',
    },
    {
      title: 'Das Glück hat sich gewendet',
      message:
        'Sie haben {{percent}}% weniger verdient als üblich, aber wie zuvor {{expenseAmount}} ausgegeben. Kürzen Sie jetzt, solange es eine Wahl ist und keine Notwendigkeit.',
    },
    {
      title: 'Die Ausgaben sind dem Einkommen nicht gefolgt',
      message:
        'Das Einkommen sank auf {{incomeAmount}} ({{percent}}% weniger); die Ausgaben liegen bei {{expenseAmount}}. Setzen Sie das Segel nach dem Wind, den Sie tatsächlich haben.',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: 'Abonnements: {{monthlyAmount}} pro Monat',
      message:
        'Abonnements ({{count}}) nehmen {{percent}}% Ihrer monatlichen Ausgaben. Jedes verlängert sich, ohne Sie zu fragen — fragen Sie selbst nach jedem.',
    },
    {
      title: '{{percent}}% der Ausgaben verlängern sich von selbst',
      message:
        'Abonnements: {{count}}, zusammen {{monthlyAmount}} im Monat. Behalten Sie die, die Sie heute wieder abschließen würden.',
    },
    {
      title: 'Leise, wiederkehrend, {{monthlyAmount}}',
      message:
        'Abonnements ({{count}}) kosten {{percent}}% Ihres Monats. Bequemlichkeit ist ein guter Diener und ein teurer Herr.',
    },
    {
      title: 'Abonnements zum Überprüfen: {{count}}',
      message:
        'Zusammen sind es {{monthlyAmount}} im Monat, {{percent}}% der Ausgaben. Kündigen Sie eines, das Sie kaum nutzen, und merken Sie, wie wenig es fehlt.',
    },
    {
      title: 'Was sich von selbst erneuert',
      message:
        '{{monthlyAmount}} im Monat, verteilt auf Abonnements: {{count}}. Automatische Ausgaben verdienen eine bewusste Prüfung.',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: 'Ihr Erfolg könnte etwas weiter reichen',
      message:
        'Über {{months}} Monate haben Sie {{savingsPercent}}% Ihres Einkommens behalten, doch fast nichts davon ging an andere. Wohlstand liegt am besten in offenen Händen — vielleicht ein Geschenk oder eine Spende in diesem Monat?',
    },
    {
      title: 'Gut verdient, wenig gegeben',
      message:
        'In {{months}} Monaten kamen {{incomeAmount}} herein, an andere gingen {{givenAmount}}. Wenn Sie auf Wegen helfen, die diese App nicht sieht, übergehen Sie das; wenn nicht, hat Ihr Plan Platz dafür.',
    },
    {
      title: 'Eine gute Zeit für Großzügigkeit',
      message:
        'Sie haben {{savingsPercent}}% Ihres Einkommens gespart — Zeichen einer ruhigen Hand. Ein kleiner Teil davon, jemandem in Not gegeben, würde dieser Beständigkeit mehr Bedeutung geben.',
    },
    {
      title: 'Noch niemand sonst im Bild',
      message:
        'Die letzten {{months}} Monate zeigen umsichtiges Verdienen und Sparen, aber keine Spenden oder Geschenke. Wir sind füreinander geschaffen; ein bescheidenes Geschenk genügt für den Anfang.',
    },
    {
      title: 'Raum für Güte',
      message:
        'Nur {{givenAmount}} von {{incomeAmount}} gingen an die Hilfe für andere. Erwägen Sie eine kleine, regelmäßige Spende — Großzügigkeit fällt mit der Gewohnheit leichter, wie jede Tugend.',
    },
  ],
  'stoic.goal_behind': [
    {
      title: '„{{goal}}“ gerät in Rückstand',
      message:
        'Nötig sind {{requiredAmount}} im Monat, Sie legen etwa {{paceAmount}} zurück. Verspätung bei diesem Tempo, in Monaten: {{monthsLate}}.',
    },
    {
      title: '„{{goal}}“ verspätet sich bei diesem Tempo (Monate: {{monthsLate}})',
      message:
        'Nötig {{requiredAmount}} im Monat, tatsächlich etwa {{paceAmount}}. Verschieben Sie das Datum ehrlich oder legen Sie bewusst mehr Geld zurück.',
    },
    {
      title: 'Ziel und Tempo passen nicht zusammen',
      message:
        '„{{goal}}“ verlangt {{requiredAmount}} im Monat; es bekommt {{paceAmount}}. Ein Ziel ist nur so wirklich wie der monatliche Schritt darauf zu.',
    },
    {
      title: '„{{goal}}“ braucht einen festeren Schritt',
      message:
        '{{paceAmount}} im Monat gegenüber den nötigen {{requiredAmount}}. Bedienen Sie nächsten Monat zuerst das Ziel, vor allem Verzichtbaren.',
    },
    {
      title: 'Im Rückstand bei „{{goal}}“',
      message:
        'Beim aktuellen Tempo ({{paceAmount}}/Monat) kommt es verspätet an — Monate: {{monthsLate}}. Kleine Erhöhungen jetzt sind besser als große Opfer später.',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: '„{{goal}}“ passt nicht in den Plan',
      message:
        'Nötig sind {{requiredAmount}} im Monat, doch nach Ihren Budgets sind nur {{freeAmount}} frei. Ändern Sie das Datum, das Ziel oder die Budgets — Hoffen ist kein Plan.',
    },
    {
      title: '„{{goal}}“ verlangt mehr, als Sie frei haben',
      message:
        '{{requiredAmount}} nötig pro Monat, {{freeAmount}} verfügbar. Alles auf einmal zu wollen, ist der Weg, nichts zu erreichen; wählen Sie.',
    },
    {
      title: 'Die Zahlen sagen Nein — vorerst',
      message:
        '„{{goal}}“ braucht {{requiredAmount}} im Monat; frei sind {{freeAmount}}. Ändern Sie, was in Ihrer Macht liegt: die Frist oder die anderen Grenzen.',
    },
    {
      title: '„{{goal}}“ braucht eine Entscheidung',
      message:
        'Mit {{requiredAmount}} im Monat übersteigt es die {{freeAmount}}, die nach den Budgets bleiben. Ein Ziel, mit offenen Augen gewählt, ist besser als eines, das nur Wunschdenken trägt.',
    },
    {
      title: 'Ein unmögliches Tempo für „{{goal}}“',
      message:
        'Nötig {{requiredAmount}} monatlich, frei {{freeAmount}}. Ehrliches Rechnen jetzt erspart später Enttäuschung.',
    },
  ],
  'stoic.shortfall': [
    {
      title: 'Ihr Saldo fällt am {{date}} unter null',
      message:
        'Anstehende Zahlungen von {{committedAmount}} drücken den erwarteten Saldo auf {{lowestAmount}}. Bereiten Sie sich jetzt vor, solange es nur eine Prognose ist.',
    },
    {
      title: 'Eine Lücke kommt: {{date}}',
      message:
        'Feste Zahlungen ({{committedAmount}}) übersteigen den Saldo, der Tiefpunkt liegt bei {{lowestAmount}}. Wer die Härte vorausbedenkt, nimmt ihr die Macht.',
    },
    {
      title: 'Planen Sie für den {{date}}',
      message:
        'An diesem Tag erreicht der erwartete Saldo {{lowestAmount}}. Eine Zahlung verschieben, einen Wunsch zurückstellen oder Geld beiseitelegen — all das liegt heute in Ihrer Macht.',
    },
    {
      title: 'Die Verpflichtungen übersteigen den Saldo',
      message:
        '{{committedAmount}} sind fällig, und der Saldo sinkt um den {{date}} auf {{lowestAmount}}. Die gelassene Antwort ist die frühe.',
    },
    {
      title: 'Sehen Sie die Lücke am {{date}} voraus',
      message:
        'Erwarteter Tiefststand: {{lowestAmount}}. Was man vorhersieht, kann man mit Fassung tragen; was uns überrascht, selten.',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: 'Sie halten Ihr Wort an sich selbst',
      message:
        'Seit {{months}} Monaten in Folge bleiben Ihre Ausgaben im selbst gesetzten Plan. So sieht Selbstbeherrschung aus.',
    },
    {
      title: '{{months}} Monate im Plan',
      message:
        'Monat für Monat stimmen Vorsatz und Tat überein. Beständigkeit ist leiser als Willenskraft und hält länger.',
    },
    {
      title: 'Plan und Leben stimmen überein',
      message:
        '{{months}} Monate hintereinander innerhalb Ihrer Grenzen. Ein so gut gehaltener Plan ist keine Einschränkung mehr — er ist Ihre Art zu leben.',
    },
    {
      title: 'Beständig seit {{months}} Monaten',
      message:
        'Ihre Budgets halten seit {{months}} Monaten. Bleiben Sie ebenso aufmerksam; es wirkt.',
    },
    {
      title: 'Disziplin, die trägt',
      message:
        '{{months}} Monate, ohne Ihren Plan zu brechen. Wenig ist so befreiend, wie den eigenen Entscheidungen zu vertrauen.',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: 'Ihr Geld folgt Ihren Werten',
      message:
        'Tugend machte {{actual}}% Ihrer Ausgaben aus — nicht weniger als die geplanten {{planned}}%. Gut ausgegeben.',
    },
    {
      title: 'Die Tugend bekam ihren vollen Anteil',
      message:
        '{{actual}}% für Gesundheit, Lernen und andere, geplant waren {{planned}}%. Was Ihnen wichtig ist, dafür haben Sie bezahlt.',
    },
    {
      title: 'Ausgegeben, um besser zu werden',
      message:
        'Die Tugend erreichte diesen Monat {{actual}}% der Ausgaben (geplant {{planned}}%). Dieses Geld arbeitet für Sie, lange nachdem es fort ist.',
    },
    {
      title: 'Vorsatz umgesetzt',
      message:
        'Sie hatten {{planned}}% für Tugend geplant und {{actual}}% ausgegeben. Gute Vorsätze überleben selten einen Monat — Ihrer schon.',
    },
    {
      title: 'Die beste Verwendung von Geld',
      message: '{{actual}}% gingen an das, was Sie und andere besser macht. Wählen Sie es weiter.',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: 'Freizeit an ihrem Platz',
      message:
        'Freizeit macht {{actual}}% der Ausgaben aus, unter den {{planned}}%, die Sie ihr zugestanden haben. Sie genießen die Dinge, ohne sich von ihnen beherrschen zu lassen.',
    },
    {
      title: 'Vergnügen in der richtigen Größe',
      message:
        'Die Freizeit nahm {{actual}}%, geplant waren {{planned}}%. Maßhalten heißt nicht, etwas zu verpassen — es heißt, zu wählen.',
    },
    {
      title: 'Erholung ohne Übermaß',
      message:
        '{{actual}}% für Freizeit, unter Ihrer Grenze von {{planned}}%. Genuss schmeckt besser, wenn er nicht das Sagen hat.',
    },
    {
      title: 'Mäßigung, ganz leise',
      message:
        'Sie haben der Freizeit {{planned}}% gegeben, und sie brauchte nur {{actual}}%. Dieser Spielraum ist Freiheit, die Sie behalten haben.',
    },
    {
      title: 'Freizeit unter Plan',
      message:
        'Mit {{actual}}% der Ausgaben blieb die Freizeit unter den {{planned}}%, die Sie festgelegt haben. Gut gehalten.',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: '{{percent}}% unter Plan',
      message:
        'Sie haben diesen Monat {{savedAmount}} weniger ausgegeben, als Sie sich erlaubt hatten. Nicht alles zu brauchen, was man haben könnte, ist eine Art Reichtum.',
    },
    {
      title: '{{savedAmount}} nicht ausgegeben',
      message:
        'Der Monat endete {{percent}}% unter Plan. Was Sie nicht ausgegeben haben, können Sie noch immer lenken.',
    },
    {
      title: 'Weniger, als Sie sich erlaubt hatten',
      message:
        'Die Ausgaben liegen {{percent}}% unter dem Plan — {{savedAmount}} behalten. Geben Sie diesem Spielraum einen Zweck, bevor die Gewohnheit ihn beansprucht.',
    },
    {
      title: 'Der Plan hatte Luft',
      message:
        '{{savedAmount}} unter Ihren Grenzen in diesem Monat. Zurückhaltung, die sich leicht anfühlt, ist die, die bleibt.',
    },
    {
      title: 'Leichter als geplant',
      message:
        'Sie brauchten {{percent}}% weniger als budgetiert. Erwägen Sie, die {{savedAmount}} einem Ziel zuzuführen.',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '„{{goal}}“ liegt im Zeitplan',
      message:
        'Sie haben {{percent}}% des Weges geschafft, in dem Tempo, das das Ziel braucht. Stetige Schritte, Monat für Monat, reichen weit.',
    },
    {
      title: 'Auf Kurs für „{{goal}}“',
      message:
        '{{percent}}% erreicht, und das Tempo hält. Bedienen Sie das Ziel weiter zuerst; es wirkt.',
    },
    {
      title: '„{{goal}}“: {{percent}}% und stetig',
      message: 'Das Ziel bekommt jeden Monat, was es braucht. Die Geduld tut ihre Arbeit.',
    },
    {
      title: 'Das Ziel bewegt sich wie geplant',
      message:
        '„{{goal}}“ ist zu {{percent}}% finanziert und im Zeitplan. Was jeden Monat ein wenig getan wird, kann eine schlechte Woche nicht aufhalten.',
    },
    {
      title: 'Fortschritt, dem Sie trauen können',
      message:
        '„{{goal}}“ steht bei {{percent}}%, im Takt. Sie bauen es auf die einzige Weise auf, die funktioniert — Schritt für Schritt.',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: 'Weniger Spontankäufe bei {{merchant}}',
      message:
        'Von {{before}} Käufen im Vormonat auf etwa {{after}} in diesem. Eine gelockerte Gewohnheit ist gewonnene Freiheit.',
    },
    {
      title: '{{merchant}}: {{before}} → {{after}}',
      message:
        'Sie gehen seltener hin als früher. Jeder ausgelassene Reflex ist ein kleiner Sieg der Wahl über die Gewohnheit.',
    },
    {
      title: 'Die kleine Gewohnheit schrumpft',
      message:
        'Die Käufe bei {{merchant}} sanken von {{before}} auf etwa {{after}}. Bleiben Sie dran — es wird leichter.',
    },
    {
      title: 'Wahl statt Reflex',
      message:
        'Bei {{merchant}} ging es von {{before}} Käufen auf etwa {{after}}. So entsteht Selbstbeherrschung — eine Entscheidung nach der anderen.',
    },
    {
      title: 'Weniger von den kleinen Dingen',
      message:
        'Bei {{merchant}} waren Sie etwa {{after}}-mal statt {{before}}-mal. Kleine Erfolge summieren sich.',
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: 'Sie haben sich einem mageren Monat angepasst',
      message:
        'Das Einkommen fiel um {{incomePercent}}%, und Sie haben die Ausgaben um {{expensePercent}}% gesenkt. Einem Wechsel des Glücks sind Sie mit einem Wechsel des Kurses begegnet.',
    },
    {
      title: 'Gelassenheit, als das Einkommen sank',
      message:
        'Einkommen {{incomePercent}}% niedriger, Ausgaben {{expensePercent}}% niedriger. Sie haben sich nach dem gerichtet, was ist, nicht nach dem, was war.',
    },
    {
      title: 'Das Glück hat sich gewandelt — Sie auch',
      message:
        'Einem Einkommensrückgang von {{incomePercent}}% stand ein Ausgabenrückgang von {{expensePercent}}% gegenüber. Das ist Gleichmut in Zahlen.',
    },
    {
      title: 'Gut gesteuert',
      message:
        'Als das Einkommen um {{incomePercent}}% fiel, folgten die Ausgaben ({{expensePercent}}% weniger). Der Wind war nicht Ihrer; das Segel schon.',
    },
    {
      title: 'Die Ausgaben folgten dem Einkommen nach unten',
      message:
        'Sie haben {{expensePercent}}% weniger ausgegeben, als das Einkommen um {{incomePercent}}% sank. Früh anzupassen ist der ruhige Weg hindurch.',
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: 'Notwendiges bleibt stabil',
      message:
        'Seit {{months}} Monaten haben sich Ihre Grundkosten kaum bewegt. Ein stabiler Boden schenkt Ihnen Freiheit darüber.',
    },
    {
      title: 'Bedürfnisse im Griff',
      message:
        'Die Ausgaben für Notwendiges blieben {{months}} Monate lang gleich. Bedürfnisse, die nicht wachsen, sind Bedürfnisse, die Sie beherrschen.',
    },
    {
      title: '{{months}} Monate stabile Grundkosten',
      message:
        'Miete, Essen und Rechnungen blieben, wo sie waren. Auch stille Beständigkeit ist eine Leistung.',
    },
    {
      title: 'Kein Schleichen beim Notwendigen',
      message:
        '{{months}} Monate ohne Drift bei dem, was das Leben verlangt. Auf diesem Grund lässt sich alles andere leichter planen.',
    },
    {
      title: 'Ein fester Boden',
      message:
        'Die Grundausgaben sind seit {{months}} Monaten stabil. Sie lassen Bequemlichkeiten nicht als Bedürfnisse durchgehen.',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: 'Großzügig mit dem, was Sie verdienen',
      message:
        'In {{months}} Monaten gingen {{percent}}% Ihres Einkommens — {{givenAmount}} — in die Hilfe für andere. Besser lässt sich Geld kaum einsetzen.',
    },
    {
      title: '{{givenAmount}} an andere gegeben',
      message:
        'Sie haben in {{months}} Monaten {{percent}}% Ihres Einkommens geteilt. Güte, die sich in den Zahlen zeigt, ist gelebte Güte, nicht nur gefühlte.',
    },
    {
      title: 'Offene Hände',
      message:
        'Spenden und Geschenke machten zuletzt {{percent}}% Ihres Einkommens aus. Was Sie weggeben, ist der Teil Ihres Wohlstands, den kein Unglück nehmen kann.',
    },
    {
      title: 'Großzügigkeit gehört zu Ihrem Plan',
      message:
        '{{givenAmount}} an andere in {{months}} Monaten. Behalten Sie das bei — das Gute, das Sie anderen tun, tun Sie auch sich selbst.',
    },
    {
      title: 'Gut gegeben',
      message:
        '{{percent}}% Ihres Verdienstes gingen in die Hilfe für andere. Wenige Gewohnheiten sagen mehr über einen Menschen.',
    },
  ],
  'stoic.praise_steady': [
    {
      title: 'Nichts zu korrigieren',
      message:
        'Ihre Ausgaben entsprechen dem, was Sie sich vorgenommen haben. Machen Sie weiter so.',
    },
    {
      title: 'Vorsatz und Handeln stimmen überein',
      message:
        'Dieser Monat sieht so aus, wie Sie ihn geplant haben. Genau diese Übereinstimmung ist der Sinn der Sache.',
    },
    {
      title: 'Ein ruhiger Monat',
      message:
        'Kein Übermaß, keine nennenswerte Vernachlässigung. Gut gemacht — tragen Sie dieselbe Aufmerksamkeit weiter.',
    },
    {
      title: 'Alles in Ordnung',
      message:
        'Ihr Plan hat gehalten, und nichts verlangt nach Korrektur. Genießen Sie die Ruhe, die Sie sich verdient haben.',
    },
    {
      title: 'Ruhige Hand',
      message:
        'Der Monat folgte Ihrem Plan. Gute Gewohnheiten lassen gute Monate gewöhnlich aussehen.',
    },
  ],
  'expert.pay_yourself_first': [
    {
      title: 'Bezahlen Sie zuerst sich selbst',
      message:
        'George S. Clasons Regel: Ein Teil von allem, was Sie verdienen, gehört Ihnen — mindestens ein Zehntel. In {{months}} Monaten haben Sie {{savingsPercent}}% behalten. Legen Sie {{tenthAmount}} am Tag des Geldeingangs zurück, vor allem anderen.',
    },
    {
      title: 'Ein Zehntel gehört Ihnen',
      message:
        'In „Der reichste Mann von Babylon“ ist das erste Mittel gegen einen mageren Geldbeutel, von je zehn Münzen eine zu behalten. Ihre Sparquote liegt bei {{savingsPercent}}%; {{tenthAmount}} im Monat wären der Anfang dieser Gewohnheit.',
    },
    {
      title: 'Erst sparen, dann ausgeben',
      message:
        'Clasons Rat ist einfach: Bezahlen Sie zuerst sich selbst. Zuletzt sind {{savingsPercent}}% des Einkommens bei Ihnen geblieben. Legen Sie am Zahltag {{tenthAmount}} beiseite und richten Sie die Ausgaben nach dem Rest.',
    },
    {
      title: 'Die erste Münze gehört Ihnen',
      message:
        'Ein Teil von allem, was Sie verdienen, sollte bei Ihnen bleiben — nicht weniger als ein Zehntel, sagt Clason. In {{months}} Monaten haben Sie {{savingsPercent}}% behalten. Beginnen Sie mit {{tenthAmount}} im Monat, automatisch.',
    },
    {
      title: '{{savingsPercent}}% behalten — die Regel verlangt 10%',
      message:
        'Bezahlen Sie zuerst sich selbst, wie es in „Der reichste Mann von Babylon“ heißt: {{tenthAmount}} im Monat, beiseitegelegt vor jeder Rechnung. Was zuerst gespart wird, hängt nicht davon ab, was übrig bleibt.',
    },
  ],
  'expert.rule_50_30_20': [
    {
      title: 'Ihr 50/30/20-Check',
      message:
        'Elizabeth Warren und Amelia Warren Tyagi empfehlen 50% des Nettoeinkommens für Notwendiges, 30% für Wünsche und 20% zum Sparen. Bei Ihnen: {{needsPercent}}% / {{wantsPercent}}% / {{savingsPercent}}%.',
    },
    {
      title: 'Notwendiges {{needsPercent}}%, Wünsche {{wantsPercent}}%, Sparen {{savingsPercent}}%',
      message:
        '„All Your Worth“ teilt Geld im Verhältnis 50/30/20 auf. Vergleichen Sie den Bereich, der am weitesten von seinem Richtwert entfernt ist, mit Ihrem Plan — dort bewirkt eine Änderung am meisten.',
    },
    {
      title: 'Wie sich Ihr Einkommen aufteilt',
      message:
        'Notwendiges beansprucht {{needsPercent}}% des Einkommens, Wünsche {{wantsPercent}}%, und {{savingsPercent}}% werden gespart. Die 50/30/20-Balance aus „All Your Worth“ ist ein nützlicher Spiegel, kein Urteil.',
    },
    {
      title: 'Die Formel für ausgewogene Finanzen',
      message:
        'Die Formel von Warren und Tyagi: die Hälfte für das, was Sie in jedem Fall zahlen müssen, 30% für Wünsche, 20% für die Zukunft. Sie liegen bei {{needsPercent}}/{{wantsPercent}}/{{savingsPercent}}.',
    },
    {
      title: 'Im Vergleich zu 50/30/20',
      message:
        'Ihre Aufteilung: {{needsPercent}}% Notwendiges, {{wantsPercent}}% Wünsche, {{savingsPercent}}% Sparen. Der Test des Buches für eine notwendige Ausgabe: Würden Sie sie auch noch zahlen, wenn Sie morgen Ihre Arbeit verlören?',
    },
  ],
  'expert.room_for_error': [
    {
      title: 'Lassen Sie Raum für Fehler',
      message:
        'Morgan Housels Rat: Planen Sie dafür, dass es nicht nach Plan läuft. Ihr Guthaben deckt etwa {{cushionDays}} Tage an Ausgaben; ein gängiger Richtwert sind drei Monate — {{targetAmount}}.',
    },
    {
      title: 'Ein Polster von {{cushionDays}} Tagen',
      message:
        '„Über die Psychologie des Geldes“ nennt das Raum für Fehler — Spielraum, mit dem man Überraschungen übersteht. Der Aufbau von {{targetAmount}}, drei Monaten an Ausgaben, gibt dem Plan die Chance, die Wirklichkeit zu überstehen.',
    },
    {
      title: 'Sicherheitsmarge für zu Hause',
      message:
        'Housel überträgt Grahams Sicherheitsmarge auf die privaten Finanzen. Mit {{cushionDays}} Tagen an Ausgaben in Reserve könnte ein schlechter Monat einen guten Plan zunichtemachen. Ziel: {{targetAmount}}.',
    },
    {
      title: 'Raum für das Unerwartete',
      message:
        'Ihre Reserve würde etwa {{cushionDays}} Tage reichen. Überraschungen sind das einzig Sichere; drei Monate an Ausgaben ({{targetAmount}}) sind ein weit verbreitetes Ziel.',
    },
    {
      title: 'Spielraum schaffen, bevor man ihn braucht',
      message:
        'Raum für Fehler ist, mit Morgan Housels Worten, das, was Sie im Spiel hält. Sie haben etwa {{cushionDays}} Tage abgedeckt; {{targetAmount}} würden drei Monate abdecken.',
    },
  ],
  'expert.lifestyle_creep': [
    {
      title: 'Die Ausgaben überholen das Einkommen',
      message:
        'Im letzten Quartal sind die Ausgaben um {{expenseGrowth}}% gestiegen, während sich das Einkommen um {{incomeGrowth}}% verändert hat. Die erste Regel aus „Der Millionär von nebenan“: Leben Sie unter Ihren Verhältnissen, wie hoch Ihr Einkommen auch ist.',
    },
    {
      title: 'Aufwendiger leben, nicht reicher',
      message:
        'Stanley und Danko stellten fest: Vermögen ist, was man ansammelt, nicht, was man ausgibt. Ihre Ausgaben sind um {{expenseGrowth}}% gewachsen, Ihr Einkommen um {{incomeGrowth}}% — in dieser Lücke versickert Vermögen.',
    },
    {
      title: 'Lebensstil-Inflation: +{{expenseGrowth}}%',
      message:
        'Die Ausgaben sind schneller gestiegen als das Einkommen ({{incomeGrowth}}%). Die Menschen in „Der Millionär von nebenan“ blieben wohlhabend, weil sie das Einkommen steigen ließen, ohne dass die Ausgaben folgten.',
    },
    {
      title: 'Das Ziel verschiebt sich',
      message:
        'Die Ausgaben liegen {{expenseGrowth}}% über dem Vorquartal, das Einkommen {{incomeGrowth}}%. Leben Sie unter Ihren Verhältnissen, sagen Stanley und Danko — wie auch immer diese aussehen.',
    },
    {
      title: 'Vermögen ist, was bleibt',
      message:
        'Ein gutes Einkommen, das vollständig ausgegeben wird, macht niemanden wohlhabender. Im letzten Quartal sind Ihre Ausgaben um {{expenseGrowth}}% und Ihr Einkommen um {{incomeGrowth}}% gestiegen — einen Blick wert, bevor es zur neuen Normalität wird.',
    },
  ],
  'expert.life_energy': [
    {
      title: '{{merchant}}: {{hours}} Std. Ihres Lebens',
      message:
        'Vicki Robin und Joe Dominguez schlagen vor, Dinge in Lebensenergie zu bemessen — in den Arbeitsstunden, die sie kosten. {{totalAmount}} bei {{merchant}} in diesem Monat sind etwa {{hours}} Std. War es das wert?',
    },
    {
      title: '{{merchant}}: {{hours}} Std.',
      message:
        '„Your Money or Your Life“ lädt dazu ein, Geld als die Zeit zu sehen, die man dafür eingetauscht hat. Bei Ihrem durchschnittlichen Stundeneinkommen entsprechen {{totalAmount}} dort etwa {{hours}} Arbeitsstunden.',
    },
    {
      title: 'In Stunden gerechnet',
      message:
        '{{totalAmount}} bei {{merchant}} sind etwa {{hours}} Std. Arbeit. Robin und Dominguez nennen das Lebensenergie — die einzige Währung, die man nicht zurückverdienen kann.',
    },
    {
      title: 'Was {{merchant}} wirklich gekostet hat',
      message:
        'Geld ist etwas, wofür wir unsere Lebensenergie eintauschen. Diesen Monat hat {{merchant}} etwa {{hours}} Std. Ihrer Zeit beansprucht ({{totalAmount}}). Steht die Freude im Verhältnis zu den Stunden?',
    },
    {
      title: 'Lebensenergie-Check',
      message:
        'Umgerechnet mit Ihrem durchschnittlichen Stundeneinkommen sind {{totalAmount}} bei {{merchant}} etwa {{hours}} Std. „Your Money or Your Life“ regt an zu fragen, ob es im gleichen Maß Erfüllung gebracht hat.',
    },
  ],
};
