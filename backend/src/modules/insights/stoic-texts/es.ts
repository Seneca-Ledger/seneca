import type { StoicTextMap } from './types';

export const es: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: 'El mes se salió de su plan',
      message:
        'Planeaste {{plannedAmount}} y llevas gastado {{spentAmount}}: un {{percent}}% más. El plan se hizo con la cabeza fría; deja que hable más alto que el momento.',
    },
    {
      title: 'Un {{percent}}% por encima de lo que querías gastar',
      message:
        'El gasto está en {{spentAmount}} frente a un plan de {{plannedAmount}}. Mira qué límite cedió primero: ahí está la lección.',
    },
    {
      title: 'Tu plan y tu mes no coinciden',
      message:
        '{{spentAmount}} gastado, {{plannedAmount}} previsto. O el plan le pidió muy poco a la realidad, o la realidad te pidió demasiado a ti: decide cuál, con calma.',
    },
    {
      title: 'Salió más de lo que permitiste',
      message:
        'El mes va un {{percent}}% por encima de los {{plannedAmount}} que fijaste. Nada se pierde por detenerse ahora; mucho se pierde fingiendo que no pasó.',
    },
    {
      title: 'Un límite que pusiste, un límite que cruzaste',
      message:
        'Querías gastar {{plannedAmount}}; van {{spentAmount}}. Dominarse no es no tropezar nunca: es darse cuenta pronto y volver al camino.',
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: 'El ocio se lleva más de lo previsto',
      message:
        'Quisiste destinar al ocio el {{planned}}% de tus gastos; este mes es el {{actual}}%. El placer es bienvenido como huésped, no como dueño de la casa.',
    },
    {
      title: 'Ocio al {{actual}}%, previsto el {{planned}}%',
      message:
        'El descanso se gana su lugar cuando te repone. Pregúntate qué placeres de este mes lo hicieron y suelta los demás sin lamentarlo.',
    },
    {
      title: 'La comodidad gasta más que la intención',
      message:
        'El ocio ocupa el {{actual}}% del gasto frente al {{planned}}% que elegiste. La moderación no es rechazar el placer: es mantenerlo del tamaño que decidiste.',
    },
    {
      title: 'Lo agradable desplaza a lo planeado',
      message:
        'Le diste al ocio el {{planned}}% del plan y se llevó el {{actual}}%. Lo que se disfruta con facilidad merece una segunda mirada antes de volverse una necesidad.',
    },
    {
      title: 'El ocio ha cruzado su línea',
      message:
        'El {{actual}}% del mes fue al ocio; la intención era el {{planned}}%. La línea la trazaste tú, y mantenerla también está en tu mano.',
    },
  ],
  'stoic.leisure_habit': [
    {
      title: 'El ocio vuelve a superar el plan',
      message:
        'El ocio superó tu plan en {{months}} de los últimos {{window}} meses. Una repetición ya no es un accidente: es un hábito que conviene examinar.',
    },
    {
      title: '{{months}} de {{window}} meses por encima del plan de ocio',
      message:
        'Lo que pasa una vez es circunstancia; lo que pasa {{months}} veces es carácter en formación. Elige ese carácter a propósito.',
    },
    {
      title: 'El mismo desliz, mes tras mes',
      message:
        'El ocio rebasó el plan en {{months}} de {{window}} meses. O subes el plan con honestidad o cambias el hábito: vivir entre ambos es lo que más cuesta.',
    },
    {
      title: 'Un patrón, no un descuido',
      message:
        'En {{months}} de los últimos {{window}} meses el ocio se llevó más de lo que le diste. Fíjate en el momento en que se toma la decisión, no solo en la cuenta de después.',
    },
    {
      title: 'El hábito vota contra tu plan',
      message:
        'El ocio le ganó al plan {{months}} veces en {{window}} meses. Los hábitos se construyen elección a elección, y así también se deshacen.',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: 'La virtud recibe menos de lo que pensabas',
      message:
        'Reservaste el {{planned}}% del presupuesto para salud, aprendizaje y los demás; de momento va el {{actual}}%. Una intención cuenta cuando se cumple.',
    },
    {
      title: 'Virtud al {{actual}}% de un {{planned}}% previsto',
      message:
        'El dinero que pensabas para lo que te hace mejor sigue esperando. No hay mejor momento para gastarlo bien que este mes.',
    },
    {
      title: 'El bien que planeaste sigue sin gastarse',
      message:
        'La salud, el aprendizaje y la generosidad iban a recibir el {{planned}}% del gasto; recibieron el {{actual}}%. Haz una de esas cosas esta semana, a conciencia.',
    },
    {
      title: 'Intención sin obra',
      message:
        'La virtud ocupa el {{actual}}% del gasto frente al {{planned}}% que elegiste. Lo que valoramos se ve en lo que de verdad pagamos.',
    },
    {
      title: 'Queda sitio para lo que importa',
      message:
        'Solo el {{actual}}% fue a la virtud, aunque planeaste el {{planned}}%. Un libro, una revisión médica, un regalo a quien lo necesita: el plan ya dijo que sí.',
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: 'La virtud sigue aplazándose',
      message:
        'El gasto en salud, aprendizaje y los demás lleva {{months}} meses seguidos por debajo de tu plan. Lo que aplazas una y otra vez, en realidad ya lo has rechazado.',
    },
    {
      title: '{{months}} meses de virtud aplazada',
      message:
        'Cada mes el plan dejó sitio para lo que te hace mejor, y cada mes quedó sin usar. El tiempo es lo único que no puedes presupuestar dos veces.',
    },
    {
      title: 'Tu mejor versión sigue esperando',
      message:
        'La virtud lleva {{months}} meses por debajo del plan. Empieza por algo pequeño y seguro, no grande y para más adelante.',
    },
    {
      title: 'Las buenas intenciones envejecen',
      message:
        'Durante {{months}} meses la salud, el aprendizaje y la generosidad recibieron menos de lo planeado. Elige una y finánciala primero el mes que viene, antes que nada.',
    },
    {
      title: 'La virtud sigue perdiendo ante «luego»',
      message:
        '{{months}} meses seguidos por debajo del plan. «Luego» es donde las buenas intenciones van a olvidarse: ponle fecha a esta.',
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: 'Tu plan no tiene sitio para la virtud',
      message:
        'Ninguno de tus presupuestos sirve a la salud, al aprendizaje o a los demás. Un plan muestra lo que valoramos: plantéate darle a la virtud una línea propia.',
    },
    {
      title: 'Presupuestos para todo, menos para el bien',
      message:
        'La necesidad, el trabajo y el ocio tienen límites; la virtud, ninguno. Lo que nunca se planea suele no ocurrir nunca.',
    },
    {
      title: 'Planea para lo que te hace mejor',
      message:
        'Aún no hay ningún presupuesto en la clase virtud. Incluso uno pequeño —libros, deporte, una donación— convierte un deseo en un compromiso.',
    },
    {
      title: 'El plan calla sobre la virtud',
      message:
        'Presupuestas lo que debes y lo que disfrutas, pero todavía no a quien quieres llegar a ser. Un modesto presupuesto de virtud lo cambiaría.',
    },
    {
      title: 'La virtud no tiene presupuesto',
      message:
        'El gasto en salud, aprendizaje o los demás no está previsto en ninguna parte. Elige uno y ponle un límite que te alegraría alcanzar.',
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: 'La necesidad cuesta más de lo previsto',
      message:
        'Planeaste el {{planned}}% del gasto para necesidad; se lleva el {{actual}}%. Comprueba si cada partida sigue siendo una necesidad o se ha vuelto, sin ruido, una comodidad.',
    },
    {
      title: 'Necesidad al {{actual}}%, prevista el {{planned}}%',
      message:
        'Lo que la vida exige suele ser menos de aquello a lo que nos acostumbramos. Revisa con ojos nuevos tu mayor gasto de necesidad.',
    },
    {
      title: 'Lo esencial se hincha',
      message:
        'La necesidad ocupa el {{actual}}% del mes frente al {{planned}}% que esperabas. Una necesidad que no deja de crecer merece una pregunta.',
    },
    {
      title: 'Las necesidades desbordan el plan',
      message:
        'Previsto {{planned}}%, real {{actual}}%. O el plan subestimó los costes reales, o algunos deseos viajan con nombre de necesidad.',
    },
    {
      title: 'Más gasto en el «hay que» de lo pensado',
      message:
        'La necesidad se llevó el {{actual}}% del gasto en lugar del {{planned}}%. Separa lo que de verdad debe ser de lo que simplemente siempre fue.',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: 'La necesidad sube poco a poco',
      message:
        'El gasto en necesidad ha subido {{months}} meses seguidos, un {{percent}}% en total. Las necesidades crecen en silencio cuando nadie les pide que se justifiquen.',
    },
    {
      title: '+{{percent}}% en necesidad en {{months}} meses',
      message:
        'Cada paso parecía pequeño; juntos no lo son. Toma el mayor gasto necesario recurrente y pregúntate si todavía tiene que costar tanto.',
    },
    {
      title: 'El suelo de tu gasto está subiendo',
      message:
        'La necesidad creció {{months}} meses consecutivos (+{{percent}}%). Un suelo que sube deja menos espacio para todo lo que eliges libremente.',
    },
    {
      title: 'Las necesidades se expanden',
      message:
        '{{months}} meses de subida, un {{percent}}% en total. La prueba estoica es sencilla: ¿lo elegirías otra vez hoy, sabiendo su precio?',
    },
    {
      title: 'Subidas pequeñas, dirección clara',
      message:
        'La necesidad ha subido un {{percent}}% en {{months}} meses. La dirección importa más que cualquier mes suelto: esta conviene corregirla pronto.',
    },
  ],
  'stoic.work_over_plan': [
    {
      title: 'El trabajo cuesta más de lo previsto',
      message:
        'Planeaste el {{planned}}% del gasto para trabajo; se lleva el {{actual}}%. Las herramientas y los servicios deben ganarse su sitio: comprueba cuáles lo hacen.',
    },
    {
      title: 'Gasto de trabajo al {{actual}}%, previsto el {{planned}}%',
      message:
        'Invertir en tu trabajo es bueno cuando devuelve algo. Revisa lo que pagas y ya no usas.',
    },
    {
      title: 'El presupuesto de trabajo va justo',
      message:
        'El trabajo se llevó el {{actual}}% en lugar del {{planned}}%. La diligencia es hacer bien el trabajo, no comprar todas las herramientas para hacerlo.',
    },
    {
      title: 'Las herramientas superan el plan',
      message:
        'Previsto {{planned}}%, gastado {{actual}}% en trabajo. Pregunta a cada gasto: ¿me ayuda a hacer el trabajo, o solo se siente como progreso?',
    },
    {
      title: 'Los costes de trabajo se han desviado',
      message:
        'El trabajo ocupa el {{actual}}% del gasto frente al {{planned}}% previsto. Una revisión rápida ahora ahorra una mayor después.',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '«{{category}}» vuelve a pasar su límite',
      message:
        '«{{category}}» superó el presupuesto en {{months}} de los últimos {{window}} meses. O el límite está mal, o el deseo: decide cuál.',
    },
    {
      title: '«{{category}}»: por encima del presupuesto {{months}} de {{window}} meses',
      message:
        'Un límite que siempre se cruza no es un límite, solo un deseo. Hazlo honesto: súbelo a propósito o mantenlo a propósito.',
    },
    {
      title: 'El mismo presupuesto vuelve a ceder',
      message:
        '«{{category}}» ha rebasado su límite {{months}} veces en {{window}} meses. La repetición es información; úsala.',
    },
    {
      title: '«{{category}}» pide tu atención',
      message:
        'Por encima del presupuesto en {{months}} de {{window}} meses. Observa el momento antes de la compra: es el único lugar donde el hábito puede cambiar.',
    },
    {
      title: 'Un patrón en «{{category}}»',
      message:
        '{{months}} excesos en {{window}} meses. Lo que repetimos, en eso nos convertimos; decide qué quieres que esta categoría diga de ti.',
    },
  ],
  'stoic.budget_pace': [
    {
      title: '«{{category}}» se agota hacia el día {{day}}',
      message:
        'Has gastado {{spentAmount}} de {{limitAmount}}, y a este ritmo el límite se acaba hacia el día {{day}}. Frenar ahora es más fácil que parar después.',
    },
    {
      title: '«{{category}}» va por delante del mes',
      message:
        'Ya se fueron {{spentAmount}} de un límite de {{limitAmount}}. A este paso se agota hacia el día {{day}}; el resto del mes todavía puedes moldearlo tú.',
    },
    {
      title: 'Control de ritmo: «{{category}}»',
      message:
        'Al ritmo actual, el presupuesto de {{limitAmount}} durará hasta el día {{day}} más o menos. La previsión es la forma más barata de disciplina.',
    },
    {
      title: '«{{category}}» está gastando el futuro',
      message:
        '{{spentAmount}} de {{limitAmount}} gastado; el límite termina cerca del día {{day}}. Lo que hagas esta semana decide si ocurre.',
    },
    {
      title: 'Aviso temprano para «{{category}}»',
      message:
        'Al ritmo actual, el límite de {{limitAmount}} no llegará a fin de mes: se agota hacia el día {{day}}. Ajusta mientras cuesta poco.',
    },
  ],
  'stoic.budget_unused': [
    {
      title: '«{{category}}» sigue sin usarse',
      message:
        'El presupuesto de «{{category}}» no ha tenido gastos en {{months}} meses. O ya no lo necesitas, o es una intención que sigue esperando: decide cuál.',
    },
    {
      title: 'Un presupuesto vacío: «{{category}}»',
      message:
        '{{months}} meses sin un solo gasto. Un plan debería describir la vida que llevas o la que estás construyendo; ¿cuál es esta?',
    },
    {
      title: '«{{category}}» está parado',
      message:
        'Nada gastado aquí en {{months}} meses. Si fue contención, bien hecho; si fue descuido, actúa.',
    },
    {
      title: 'Planeado, pero no vivido',
      message:
        '«{{category}}» lleva {{months}} meses con límite y sin gasto. Mantén el plan veraz: quítalo o úsalo.',
    },
    {
      title: '«{{category}}»: {{months}} meses en silencio',
      message:
        'Un presupuesto que nunca se toca sigue ocupando un lugar en tu plan. Libera ese lugar u honra la intención.',
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: 'El {{percent}}% del gasto no tiene límite',
      message:
        'Este mes {{unbudgetedAmount}} fueron a categorías que ningún presupuesto vigila. Lo que no se mide es difícil de dominar.',
    },
    {
      title: 'Buena parte del mes no está planeada',
      message:
        'El {{percent}}% del gasto —{{unbudgetedAmount}}— queda fuera de todo presupuesto. Ponle límite a la parte mayor y el plan verá más de tu vida.',
    },
    {
      title: 'Gasto fuera del plan',
      message:
        'Los presupuestos cubren solo parte de lo que gastas; {{unbudgetedAmount}} ({{percent}}%) queda sin medir. Extiende el plan hacia donde realmente va el dinero.',
    },
    {
      title: 'El plan solo ve parte del cuadro',
      message:
        'El {{percent}}% del gasto de este mes no tiene presupuesto. Ver con claridad va antes que juzgar bien.',
    },
    {
      title: '{{unbudgetedAmount}} gastados sin límite',
      message:
        'Es el {{percent}}% del mes. No tienes que restringirlo: solo decidir cuánto de ello quieres de verdad.',
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '«{{category}}» es casi todo tu ocio',
      message:
        'El {{percent}}% del gasto en ocio fue a «{{category}}». La variedad en el descanso es más sana que depender de un solo placer.',
    },
    {
      title: 'Un placer domina',
      message:
        '«{{category}}» se lleva el {{percent}}% de todo lo que gastaste en ocio. Pregúntate si todavía te alegra o se ha vuelto rutina.',
    },
    {
      title: 'El ocio se apoya en «{{category}}»',
      message:
        'El {{percent}}% del ocio en un solo sitio. Aquello de lo que no podemos prescindir nos tiene agarrados: comprueba que el agarre sigue siendo ligero.',
    },
    {
      title: '«{{category}}»: {{percent}}% del ocio',
      message:
        'Una sola fuente de disfrute se lleva casi todo. Prueba este mes un placer distinto y más barato, y compara.',
    },
    {
      title: 'Tu descanso tiene una sola dirección',
      message:
        'La mayor parte del dinero de ocio —el {{percent}}%— va a «{{category}}». La libertad incluye poder disfrutar también de otras cosas.',
    },
  ],
  'stoic.unclassified': [
    {
      title: 'Parte del gasto aún no está juzgado',
      message:
        'Categorías sin clase: {{count}}. Decide en Presupuestos qué es necesidad, trabajo, virtud u ocio.',
    },
    {
      title: 'Categorías que esperan tu juicio: {{count}}',
      message:
        'Tienen gasto pero no clase, así que el consejo no puede sopesarlas. Un minuto en Presupuestos lo resuelve.',
    },
    {
      title: 'Nombra a qué sirve tu dinero',
      message:
        'Categorías aún sin clasificar: {{count}}. El juicio empieza por llamar a las cosas por su nombre.',
    },
    {
      title: 'Gasto sin juzgar — categorías: {{count}}',
      message:
        '¿Es una necesidad, tu trabajo, una virtud o un placer? Solo tú puedes decirlo, y el plan se aclara en cuanto lo haces.',
    },
    {
      title: 'Algunas categorías no tienen clase',
      message:
        'Fuera de las cuatro clases: {{count}}. Clasifícalas en Presupuestos para que cada gasto se vea como lo que es.',
    },
  ],
  'stoic.small_purchases': [
    {
      title: 'Compras pequeñas en {{merchant}}: {{count}}',
      message:
        'Cada una parecía insignificante; juntas sumaron {{totalAmount}} este mes. Los hábitos pequeños y sin examinar son por donde se va, en silencio, la mayor parte del dinero.',
    },
    {
      title: '{{merchant}}: {{count}} veces este mes',
      message:
        '{{totalAmount}} en importes pequeños. Pregúntate si cada visita fue una elección o un reflejo: solo la primera es libertad.',
    },
    {
      title: 'Poco a poco: {{totalAmount}}',
      message:
        'Compras en {{merchant}}: {{count}}. Ninguna importa por sí sola; el hábito sí. Decide con qué frecuencia lo quieres de verdad.',
    },
    {
      title: 'Un hábito en {{merchant}}',
      message:
        'Compras: {{count}}, {{totalAmount}} en total. Prueba a saltarte una de cada tres este mes y mira si la echas de menos.',
    },
    {
      title: 'Lo pequeño se acumula',
      message:
        'En {{merchant}} te vieron {{count}} veces, por {{totalAmount}}. El dominio sobre las grandes decisiones se construye con pequeñas como estas.',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: 'Los fines de semana cargan el {{percent}}% del ocio',
      message:
        'La mayor parte de tu gasto en ocio ocurre en sábado y domingo. El descanso es bueno; comprueba que sea descanso y no compensación por la semana.',
    },
    {
      title: 'El ocio vive en el fin de semana',
      message:
        'El {{percent}}% del gasto en ocio cae en fin de semana. Planea un poco el fin de semana y costará menos y dará más.',
    },
    {
      title: 'El fin de semana paga por la semana',
      message:
        'Los fines de semana se llevan el {{percent}}% de lo que gastas en ocio. Si la semana necesita arreglarse cada sábado, mira la semana.',
    },
    {
      title: 'Sábado y domingo: {{percent}}% del ocio',
      message:
        'Los días libres invitan al gasto libre. Decide antes del fin de semana para qué es, y deja que el dinero lo siga.',
    },
    {
      title: 'Un patrón de fin de semana',
      message:
        'El {{percent}}% del gasto en ocio ocurre en fin de semana. Más holgura entre semana suele abaratar los fines de semana.',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}} se llevó el {{percent}}% del mes',
      message:
        '{{totalAmount}} fueron a un solo comercio de ocio. Cuando un lugar tiene tanto de tu dinero, pregúntate cuánto tiene también de tu atención.',
    },
    {
      title: 'Un solo lugar, {{totalAmount}}',
      message:
        '{{merchant}} es el {{percent}}% del gasto de este mes. ¿Merece esa parte del fruto de tu trabajo?',
    },
    {
      title: '{{merchant}} encabeza tu gasto',
      message:
        'El {{percent}}% del mes —{{totalAmount}}— fue allí. Nada malo en disfrutarlo, mientras lo volvieras a elegir.',
    },
    {
      title: 'Una gran parte en {{merchant}}',
      message:
        '{{totalAmount}}, o el {{percent}}% del gasto, en un solo lugar de ocio. Sopesa el placer frente al precio, con calma.',
    },
    {
      title: '{{percent}}% en {{merchant}}',
      message:
        'Este único comercio se llevó {{totalAmount}}. La libertad es poder pasar de largo cuando tú lo decides.',
    },
  ],
  'stoic.income_drop': [
    {
      title: 'Los ingresos bajaron, el gasto no',
      message:
        'Los ingresos cayeron un {{percent}}% hasta {{incomeAmount}}, pero el gasto siguió en {{expenseAmount}}. La fortuna cambió de idea; tu gasto aún no se ha dado cuenta.',
    },
    {
      title: 'Ingresos un {{percent}}% más bajos',
      message:
        'Entraron {{incomeAmount}} y salieron {{expenseAmount}}. Lo que la fortuna da, puede quitarlo: ajusta el gasto a lo que es, no a lo que era.',
    },
    {
      title: 'Un mes más escaso, los mismos hábitos',
      message:
        'Los ingresos son un {{percent}}% menores ({{incomeAmount}}), mientras el gasto se mantuvo en {{expenseAmount}}. Los ingresos no dependen de ti; la respuesta, sí.',
    },
    {
      title: 'La fortuna ha cambiado',
      message:
        'Ganaste un {{percent}}% menos de lo habitual, pero gastaste {{expenseAmount}} como antes. Recorta ahora, mientras es una elección y no una necesidad.',
    },
    {
      title: 'El gasto no ha seguido a los ingresos',
      message:
        'Los ingresos bajaron a {{incomeAmount}} (un {{percent}}% menos); el gasto es de {{expenseAmount}}. Ajusta la vela al viento que de verdad tienes.',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: 'Suscripciones: {{monthlyAmount}} al mes',
      message:
        'Suscripciones ({{count}}): el {{percent}}% de tu gasto mensual. Cada una se renueva sin preguntarte; pregunta tú por cada una.',
    },
    {
      title: 'El {{percent}}% del gasto se renueva solo',
      message:
        'Suscripciones: {{count}}, {{monthlyAmount}} al mes. Quédate con las que volverías a contratar hoy.',
    },
    {
      title: 'Silencioso, recurrente, {{monthlyAmount}}',
      message:
        'Suscripciones ({{count}}): el {{percent}}% de tu mes. La comodidad es buena sirvienta y ama costosa.',
    },
    {
      title: 'Suscripciones que revisar: {{count}}',
      message:
        'Juntas suman {{monthlyAmount}} al mes, el {{percent}}% del gasto. Cancela una que apenas uses y nota lo poco que la echas de menos.',
    },
    {
      title: 'Lo que se renueva solo',
      message:
        '{{monthlyAmount}} al mes entre tus suscripciones ({{count}}). El gasto automático merece una revisión deliberada.',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: 'Tu éxito podría llegar un poco más lejos',
      message:
        'En {{months}} meses guardaste el {{savingsPercent}}% de tus ingresos, pero casi nada fue para los demás. La riqueza está mejor en manos abiertas: ¿quizá un regalo o una donación este mes?',
    },
    {
      title: 'Ganas bien, das poco',
      message:
        'En {{months}} meses entraron {{incomeAmount}} y {{givenAmount}} fueron para otros. Si ayudas de formas que esta app no ve, ignora esto; si no, tu plan tiene espacio para ello.',
    },
    {
      title: 'Buen momento para ser generoso',
      message:
        'Ahorraste el {{savingsPercent}}% de tus ingresos, señal de una mano firme. Una pequeña parte de eso, dada a quien lo necesita, haría que esa firmeza signifique más.',
    },
    {
      title: 'Todavía no hay nadie más en el cuadro',
      message:
        'Los últimos {{months}} meses muestran ingresos y ahorro cuidadosos, pero ni donaciones ni regalos. Estamos hechos los unos para los otros; basta un regalo modesto para empezar.',
    },
    {
      title: 'Espacio para la bondad',
      message:
        'Solo {{givenAmount}} de {{incomeAmount}} se destinó a ayudar a otros. Piensa en una donación pequeña y regular: la generosidad, como toda virtud, se vuelve más fácil con el hábito.',
    },
  ],
  'stoic.goal_behind': [
    {
      title: '«{{goal}}» se está quedando atrás',
      message:
        'Necesita {{requiredAmount}} al mes y le estás poniendo unos {{paceAmount}}. A este ritmo, meses de retraso: {{monthsLate}}.',
    },
    {
      title: '«{{goal}}»: meses de retraso a este ritmo: {{monthsLate}}',
      message:
        'Requerido {{requiredAmount}} al mes, real unos {{paceAmount}}. Mueve la fecha con honestidad o mueve más dinero a propósito.',
    },
    {
      title: 'La meta y el ritmo no coinciden',
      message:
        '«{{goal}}» pide {{requiredAmount}} al mes; recibe {{paceAmount}}. Una meta es tan real como el paso mensual hacia ella.',
    },
    {
      title: '«{{goal}}» necesita un paso más firme',
      message:
        '{{paceAmount}} al mes frente a los {{requiredAmount}} que necesita. El mes que viene, paga primero la meta, antes que nada opcional.',
    },
    {
      title: 'Atrasado en «{{goal}}»',
      message:
        'El ritmo actual ({{paceAmount}}/mes) deja meses de retraso: {{monthsLate}}. Pequeños aumentos ahora valen más que grandes sacrificios después.',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: '«{{goal}}» no cabe en el plan',
      message:
        'Necesita {{requiredAmount}} al mes, pero tras tus presupuestos solo quedan libres {{freeAmount}}. Cambia la fecha, el objetivo o los presupuestos: esperar no es un plan.',
    },
    {
      title: '«{{goal}}» pide más de lo que tienes libre',
      message:
        '{{requiredAmount}} requeridos cada mes, {{freeAmount}} disponibles. Querer todo a la vez es la manera de no lograr nada; elige.',
    },
    {
      title: 'Los números dicen que no, por ahora',
      message:
        '«{{goal}}» necesita {{requiredAmount}} al mes; tu dinero libre es {{freeAmount}}. Ajusta lo que está en tu mano: el plazo o los demás límites.',
    },
    {
      title: '«{{goal}}» necesita una decisión',
      message:
        'Con {{requiredAmount}} al mes supera los {{freeAmount}} que quedan tras los presupuestos. Una meta elegida con los ojos abiertos es mejor que una sostenida por ilusiones.',
    },
    {
      title: 'Un ritmo imposible para «{{goal}}»',
      message:
        'Requerido {{requiredAmount}} al mes, libre {{freeAmount}}. Hacer cuentas honestas ahora ahorra decepciones después.',
    },
  ],
  'stoic.shortfall': [
    {
      title: 'Tu saldo baja de cero el {{date}}',
      message:
        'Los pagos próximos de {{committedAmount}} llevan el saldo previsto a {{lowestAmount}}. Prepárate ahora, mientras solo es una previsión.',
    },
    {
      title: 'Se acerca un descubierto: {{date}}',
      message:
        'Los pagos comprometidos ({{committedAmount}}) superan el saldo, que toca fondo en {{lowestAmount}}. Anticipar la dificultad es lo que le quita su poder.',
    },
    {
      title: 'Prepara el {{date}}',
      message:
        'Ese día el saldo previsto llega a {{lowestAmount}}. Mover un pago, aplazar un capricho o apartar dinero: todo eso está hoy en tu mano.',
    },
    {
      title: 'Los compromisos superan el saldo',
      message:
        'Vencen {{committedAmount}} y el saldo cae a {{lowestAmount}} hacia el {{date}}. La respuesta serena es la temprana.',
    },
    {
      title: 'Prevé el hueco del {{date}}',
      message:
        'Saldo mínimo previsto: {{lowestAmount}}. Lo que se prevé puede afrontarse con serenidad; lo que nos sorprende, rara vez.',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: 'Cumpliste la palabra que te diste',
      message:
        'Llevas {{months}} meses seguidos gastando dentro del plan que tú mismo fijaste. Así se ve el dominio de uno mismo.',
    },
    {
      title: '{{months}} meses dentro del plan',
      message:
        'Mes tras mes, lo que te propusiste y lo que hiciste coinciden. La constancia es más callada que la fuerza de voluntad y dura más.',
    },
    {
      title: 'El plan y la vida coinciden',
      message:
        '{{months}} meses consecutivos dentro de tus límites. Un plan tan bien cumplido ya no es una restricción: es tu manera de vivir.',
    },
    {
      title: 'Constante durante {{months}} meses',
      message:
        'Tus presupuestos llevan {{months}} meses aguantando. Mantén la misma atención; está funcionando.',
    },
    {
      title: 'Disciplina sostenida',
      message:
        '{{months}} meses sin romper tu plan. Pocas cosas liberan tanto como confiar en tus propias decisiones.',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: 'Tu dinero sigue tus valores',
      message:
        'La virtud se llevó el {{actual}}% de tus gastos, no menos del {{planned}}% previsto. Bien gastado.',
    },
    {
      title: 'La virtud recibió toda su parte',
      message:
        'El {{actual}}% en salud, aprendizaje y los demás, frente al {{planned}}% previsto. Lo que valoras, lo pagaste.',
    },
    {
      title: 'Gastado en hacerte mejor',
      message:
        'La virtud llegó al {{actual}}% del gasto este mes (previsto {{planned}}%). Ese dinero trabaja para ti mucho después de haberse ido.',
    },
    {
      title: 'Intención cumplida',
      message:
        'Planeaste el {{planned}}% para la virtud y gastaste el {{actual}}%. Las buenas intenciones rara vez sobreviven a un mes; la tuya sí.',
    },
    {
      title: 'El mejor uso del dinero',
      message: 'El {{actual}}% fue a lo que te hace mejor a ti y a los demás. Sigue eligiéndolo.',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: 'El ocio en su sitio',
      message:
        'El ocio es el {{actual}}% del gasto, por debajo del {{planned}}% que le permitiste. Disfrutas de las cosas sin que te gobiernen.',
    },
    {
      title: 'El placer, en su justa medida',
      message:
        'El ocio se llevó el {{actual}}% frente al {{planned}}% previsto. La moderación no es perderse algo: es elegir.',
    },
    {
      title: 'Descanso sin exceso',
      message:
        'El {{actual}}% en ocio, por debajo de tu límite del {{planned}}%. El disfrute sabe mejor cuando no es él quien manda.',
    },
    {
      title: 'Templanza, sin ruido',
      message:
        'Le diste al ocio el {{planned}}% y solo usó el {{actual}}%. Ese margen es libertad que conservaste.',
    },
    {
      title: 'Ocio por debajo del plan',
      message:
        'Con el {{actual}}% del gasto, el ocio se quedó bajo el {{planned}}% que fijaste. Bien sostenido.',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: 'Un {{percent}}% por debajo del plan',
      message:
        'Gastaste {{savedAmount}} menos de lo que te permitiste este mes. No necesitar todo lo que podrías tener es una forma de riqueza.',
    },
    {
      title: '{{savedAmount}} sin gastar',
      message:
        'El mes cerró un {{percent}}% por debajo del plan. Lo que no gastaste sigue siendo tuyo para dirigirlo.',
    },
    {
      title: 'Menos de lo que te permitiste',
      message:
        'El gasto está un {{percent}}% por debajo del plan: {{savedAmount}} conservados. Dale un propósito a ese margen antes de que el hábito lo reclame.',
    },
    {
      title: 'El plan tenía holgura',
      message:
        '{{savedAmount}} por debajo de tus límites este mes. La contención que resulta fácil es la que perdura.',
    },
    {
      title: 'Más ligero de lo previsto',
      message:
        'Necesitaste un {{percent}}% menos de lo presupuestado. Plantéate enviar esos {{savedAmount}} a una meta.',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '«{{goal}}» va según lo previsto',
      message:
        'Llevas el {{percent}}% del camino, al ritmo que la meta necesita. Pasos firmes, dados cada mes, llegan lejos.',
    },
    {
      title: 'En camino hacia «{{goal}}»',
      message:
        'El {{percent}}% hecho y el ritmo se mantiene. Sigue pagando primero la meta; funciona.',
    },
    {
      title: '«{{goal}}»: {{percent}}% y constante',
      message: 'La meta recibe cada mes lo que necesita. La paciencia está haciendo su trabajo.',
    },
    {
      title: 'La meta avanza como se planeó',
      message:
        '«{{goal}}» está financiada al {{percent}}% y a tiempo. Lo que se hace un poco cada mes no lo detiene una mala semana.',
    },
    {
      title: 'Un progreso en el que confiar',
      message:
        '«{{goal}}» está al {{percent}}%, a buen ritmo. La estás construyendo de la única manera que funciona: poco a poco.',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: 'Menos compras por impulso en {{merchant}}',
      message:
        'De {{before}} compras el mes pasado a unas {{after}} este mes. Un hábito aflojado es libertad ganada.',
    },
    {
      title: '{{merchant}}: {{before}} → {{after}}',
      message:
        'Vas menos que antes. Cada reflejo que te saltas es una pequeña victoria de la elección sobre el hábito.',
    },
    {
      title: 'El pequeño hábito se encoge',
      message:
        'Las compras en {{merchant}} bajaron de {{before}} a unas {{after}}. Sigue así: cada vez es más fácil.',
    },
    {
      title: 'Elección antes que reflejo',
      message:
        'En {{merchant}} pasaste de {{before}} compras a unas {{after}}. Eso es dominio construido decisión a decisión.',
    },
    {
      title: 'Menos cosas pequeñas',
      message:
        'En {{merchant}} te vieron unas {{after}} veces en lugar de {{before}}. Las pequeñas victorias se suman.',
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: 'Te adaptaste a un mes más escaso',
      message:
        'Los ingresos cayeron un {{incomePercent}}% y recortaste el gasto un {{expensePercent}}%. Ante un cambio de fortuna, respondiste con un cambio de rumbo.',
    },
    {
      title: 'Serenidad cuando bajaron los ingresos',
      message:
        'Ingresos un {{incomePercent}}% más bajos, gasto un {{expensePercent}}% más bajo. Te ajustaste a lo que es, no a lo que era.',
    },
    {
      title: 'La fortuna cambió; tú también',
      message:
        'Una caída del {{incomePercent}}% en los ingresos encontró una caída del {{expensePercent}}% en el gasto. Eso es ecuanimidad en cifras.',
    },
    {
      title: 'Bien gobernado',
      message:
        'Cuando los ingresos cayeron un {{incomePercent}}%, el gasto los siguió (un {{expensePercent}}% menos). El viento no era tuyo; la vela, sí.',
    },
    {
      title: 'El gasto siguió a los ingresos a la baja',
      message:
        'Gastaste un {{expensePercent}}% menos cuando los ingresos bajaron un {{incomePercent}}%. Adaptarse pronto es el camino tranquilo.',
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: 'La necesidad se mantiene estable',
      message:
        'Durante {{months}} meses tus gastos esenciales apenas se han movido. Un suelo estable te da libertad por encima de él.',
    },
    {
      title: 'Necesidades bajo control',
      message:
        'El gasto en necesidad se mantuvo igual durante {{months}} meses. Las necesidades que no crecen son necesidades que controlas.',
    },
    {
      title: '{{months}} meses de lo esencial estable',
      message:
        'El alquiler, la comida y las facturas se quedaron donde estaban. La estabilidad callada también es un logro.',
    },
    {
      title: 'Sin deriva en la necesidad',
      message:
        '{{months}} meses sin desvío en lo que la vida exige. Sobre ese terreno, todo lo demás es más fácil de planear.',
    },
    {
      title: 'Un suelo firme',
      message:
        'El gasto esencial lleva {{months}} meses estable. No dejas que las comodidades pasen por necesidades.',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: 'Generosidad con lo que ganas',
      message:
        'En {{months}} meses, el {{percent}}% de tus ingresos —{{givenAmount}}— se destinó a ayudar a otros. Es dinero usado de la mejor manera.',
    },
    {
      title: '{{givenAmount}} dados a otros',
      message:
        'Compartiste el {{percent}}% de tus ingresos en {{months}} meses. La bondad que se ve en las cifras es bondad practicada, no solo sentida.',
    },
    {
      title: 'Manos abiertas',
      message:
        'Las donaciones y los regalos se llevaron últimamente el {{percent}}% de tus ingresos. Lo que das es la parte de tu riqueza que ninguna desgracia puede quitarte.',
    },
    {
      title: 'La generosidad es parte de tu plan',
      message:
        '{{givenAmount}} para otros en {{months}} meses. Mantenlo: el bien que haces a otros también te lo haces a ti.',
    },
    {
      title: 'Bien dado',
      message:
        'El {{percent}}% de lo que ganaste se destinó a ayudar a otros. Pocos hábitos dicen más de una persona.',
    },
  ],
  'stoic.praise_steady': [
    {
      title: 'Nada que corregir',
      message: 'Tus gastos coinciden con lo que te propusiste. Sigue así.',
    },
    {
      title: 'La intención y la acción coinciden',
      message:
        'Este mes se parece a como lo planeaste. Esa coincidencia es precisamente lo importante.',
    },
    {
      title: 'Un mes tranquilo',
      message:
        'Ni exceso ni descuido que merezcan mención. Bien hecho: lleva la misma atención hacia adelante.',
    },
    {
      title: 'Todo en orden',
      message: 'Tu plan se sostuvo y nada pide corrección. Disfruta de la calma que te ganaste.',
    },
    {
      title: 'Pulso firme',
      message:
        'El mes siguió tu plan. Los buenos hábitos hacen que los buenos meses parezcan corrientes.',
    },
  ],
  'expert.pay_yourself_first': [
    {
      title: 'Págate primero a ti',
      message:
        'La regla de George S. Clason: una parte de todo lo que ganas es tuya para conservarla, al menos una décima parte. En {{months}} meses conservaste el {{savingsPercent}}%. Aparta {{tenthAmount}} el día que llegan los ingresos, antes que cualquier otra cosa.',
    },
    {
      title: 'Una décima parte es tuya',
      message:
        'En «El hombre más rico de Babilonia», el primer remedio para una bolsa flaca es guardar una moneda de cada diez. Tu tasa de ahorro es del {{savingsPercent}}%; {{tenthAmount}} al mes bastaría para empezar el hábito.',
    },
    {
      title: 'Ahorra antes de gastar, no después',
      message:
        'El consejo de Clason es sencillo: págate primero a ti. Últimamente se ha quedado contigo el {{savingsPercent}}% de los ingresos. Aparta {{tenthAmount}} el día de cobro y deja que el gasto se ajuste a lo que queda.',
    },
    {
      title: 'La primera moneda es tuya',
      message:
        'Una parte de todo lo que ganas debería quedarse contigo, no menos de una décima parte, dice Clason. Conservaste el {{savingsPercent}}% en {{months}} meses. Empieza con {{tenthAmount}} al mes, de forma automática.',
    },
    {
      title: '{{savingsPercent}}% conservado; la regla pide un 10%',
      message:
        'Págate primero a ti, como dice «El hombre más rico de Babilonia»: {{tenthAmount}} al mes, apartados antes de cualquier factura. El ahorro que se hace primero no depende de lo que sobre.',
    },
  ],
  'expert.rule_50_30_20': [
    {
      title: 'Tu revisión 50/30/20',
      message:
        'Elizabeth Warren y Amelia Warren Tyagi proponen un 50% de los ingresos netos para lo imprescindible, un 30% para los caprichos y un 20% para el ahorro. Lo tuyo: {{needsPercent}}% / {{wantsPercent}}% / {{savingsPercent}}%.',
    },
    {
      title:
        'Necesidades {{needsPercent}}%, caprichos {{wantsPercent}}%, ahorro {{savingsPercent}}%',
      message:
        '«All Your Worth» equilibra el dinero en 50/30/20. Compara con tu plan la categoría más alejada de su objetivo: ahí es donde un solo cambio ayuda más.',
    },
    {
      title: 'Cómo se reparten tus ingresos',
      message:
        'Lo imprescindible se lleva el {{needsPercent}}% de los ingresos, los caprichos el {{wantsPercent}}%, y ahorras el {{savingsPercent}}%. El equilibrio 50/30/20 de «All Your Worth» es un espejo útil, no un veredicto.',
    },
    {
      title: 'La fórmula del dinero equilibrado',
      message:
        'La fórmula de Warren y Tyagi: la mitad para lo que debes pagar pase lo que pase, un 30% para los caprichos y un 20% para el futuro. Tú estás en {{needsPercent}}/{{wantsPercent}}/{{savingsPercent}}.',
    },
    {
      title: 'Frente al 50/30/20',
      message:
        'Tu reparto es {{needsPercent}}% imprescindible, {{wantsPercent}}% caprichos y {{savingsPercent}}% ahorro. La prueba del libro para lo imprescindible: ¿lo seguirías pagando si mañana perdieras el trabajo?',
    },
  ],
  'expert.room_for_error': [
    {
      title: 'Deja margen para el error',
      message:
        'El consejo de Morgan Housel: planifica contando con que las cosas no saldrán según lo previsto. Tu saldo cubre unos {{cushionDays}} días de gasto; una referencia habitual son tres meses: {{targetAmount}}.',
    },
    {
      title: 'Un colchón de {{cushionDays}} días',
      message:
        '«La psicología del dinero» lo llama margen de error: la holgura que te permite sobrevivir a las sorpresas. Avanzar hacia {{targetAmount}}, tres meses de gasto, da al plan la oportunidad de sobrevivir a la realidad.',
    },
    {
      title: 'Margen de seguridad, en casa',
      message:
        'Housel toma prestado el margen de seguridad de Graham para las finanzas personales. Con {{cushionDays}} días de gasto en reserva, un solo mal mes podría deshacer un buen plan. Apunta a {{targetAmount}}.',
    },
    {
      title: 'Espacio para lo inesperado',
      message:
        'Tu reserva duraría aproximadamente {{cushionDays}} días. Las sorpresas son lo único seguro; tres meses de gasto ({{targetAmount}}) es un objetivo muy extendido.',
    },
    {
      title: 'Crea holgura antes de necesitarla',
      message:
        'El margen de error, en palabras de Morgan Housel, es lo que te mantiene en el juego. Tienes cubiertos unos {{cushionDays}} días; {{targetAmount}} cubriría tres meses.',
    },
  ],
  'expert.lifestyle_creep': [
    {
      title: 'El gasto va más rápido que los ingresos',
      message:
        'El gasto subió un {{expenseGrowth}}% en el último trimestre mientras los ingresos cambiaron un {{incomeGrowth}}%. La primera regla de «El millonario de al lado»: sean cuales sean tus ingresos, vive por debajo de tus posibilidades.',
    },
    {
      title: 'Vivir mejor, no ser más rico',
      message:
        'Stanley y Danko comprobaron que la riqueza es lo que acumulas, no lo que gastas. Tu gasto creció un {{expenseGrowth}}% y tus ingresos un {{incomeGrowth}}%: por esa diferencia se escapa la riqueza.',
    },
    {
      title: 'Inflación del estilo de vida: +{{expenseGrowth}}%',
      message:
        'Los gastos subieron más rápido que los ingresos ({{incomeGrowth}}%). Las personas de «El millonario de al lado» siguieron siendo ricas dejando que los ingresos crecieran sin que el gasto los siguiera.',
    },
    {
      title: 'La meta se está moviendo',
      message:
        'El gasto sube un {{expenseGrowth}}% de un trimestre a otro frente a un {{incomeGrowth}}% de los ingresos. Vive por debajo de tus posibilidades, dicen Stanley y Danko, sean cuales sean.',
    },
    {
      title: 'La riqueza es lo que conservas',
      message:
        'Unos buenos ingresos gastados por completo no hacen más rico a nadie. En el último trimestre tu gasto creció un {{expenseGrowth}}% y tus ingresos un {{incomeGrowth}}%: merece una mirada antes de que se convierta en lo normal.',
    },
  ],
  'expert.life_energy': [
    {
      title: '{{merchant}} te costó {{hours}} horas de vida',
      message:
        'Vicki Robin y Joe Dominguez proponen medir las cosas en energía vital: las horas de trabajo que cuestan. {{totalAmount}} en {{merchant}} este mes son unas {{hours}} horas. ¿Valió la pena?',
    },
    {
      title: '{{hours}} horas en {{merchant}}',
      message:
        '«La bolsa o la vida» propone ver el dinero como el tiempo que cambiaste por él. Con tus ingresos medios por hora, {{totalAmount}} allí equivalen a unas {{hours}} horas de trabajo.',
    },
    {
      title: 'Ponle precio en horas',
      message:
        '{{totalAmount}} en {{merchant}} son unas {{hours}} horas de trabajo. Robin y Dominguez lo llaman energía vital: la única moneda que no puedes recuperar.',
    },
    {
      title: 'Lo que realmente costó {{merchant}}',
      message:
        'El dinero es algo por lo que intercambiamos nuestra energía vital. Este mes {{merchant}} se llevó unas {{hours}} horas de la tuya ({{totalAmount}}). ¿El placer está a la altura de las horas?',
    },
    {
      title: 'Revisión de energía vital',
      message:
        'Convertidos a tus ingresos medios por hora, los {{totalAmount}} gastados en {{merchant}} son unas {{hours}} horas. «La bolsa o la vida» sugiere preguntarte si te aportó una satisfacción proporcional.',
    },
  ],
};
