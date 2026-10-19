/**
 * Invitation email copy, mirroring the shape of notification-translations.ts.
 * The invitee is usually not a registered user, so the locale comes from the
 * inviter. Falls back to English for unknown locales.
 */
type InvitationMap = Record<InvitationKey, string>;

export type InvitationKey =
  | 'subject'
  | 'preview'
  | 'heading'
  | 'invitedBy'
  | 'invitedAnon'
  | 'role'
  | 'roleOwner'
  | 'roleAdmin'
  | 'roleMember'
  | 'cta'
  | 'linkHint'
  | 'footer';

const ru: InvitationMap = {
  subject: 'Приглашение в рабочее пространство {{workspace}}',
  preview: 'Приглашение в рабочее пространство {{workspace}}',
  heading: 'Приглашение в рабочее пространство',
  invitedBy: '{{inviter}} приглашает вас присоединиться к',
  invitedAnon: 'Вас приглашают присоединиться к',
  role: 'Роль: {{role}}',
  roleOwner: 'Владелец',
  roleAdmin: 'Администратор',
  roleMember: 'Участник',
  cta: 'Принять приглашение',
  linkHint: 'Если кнопка не открывается, используйте ссылку:',
  footer: 'Ссылка действует 7 дней. Если вы не ожидали это письмо — просто проигнорируйте его.',
};

const en: InvitationMap = {
  subject: 'Invitation to workspace {{workspace}}',
  preview: 'Invitation to workspace {{workspace}}',
  heading: 'Invitation to a workspace',
  invitedBy: '{{inviter}} invites you to join',
  invitedAnon: 'You are invited to join',
  role: 'Role: {{role}}',
  roleOwner: 'Owner',
  roleAdmin: 'Administrator',
  roleMember: 'Member',
  cta: 'Accept invitation',
  linkHint: 'If the button does not work, use this link:',
  footer: 'The link is valid for 7 days. If you were not expecting this email, simply ignore it.',
};

const kk: InvitationMap = {
  subject: '{{workspace}} жұмыс кеңістігіне шақыру',
  preview: '{{workspace}} жұмыс кеңістігіне шақыру',
  heading: 'Жұмыс кеңістігіне шақыру',
  invitedBy: '{{inviter}} сізді қосылуға шақырады:',
  invitedAnon: 'Сізді қосылуға шақырады:',
  role: 'Рөл: {{role}}',
  roleOwner: 'Иесі',
  roleAdmin: 'Әкімші',
  roleMember: 'Қатысушы',
  cta: 'Шақыруды қабылдау',
  linkHint: 'Түйме ашылмаса, сілтемені пайдаланыңыз:',
  footer: 'Сілтеме 7 күн жарамды. Бұл хатты күтпеген болсаңыз, елемей қойыңыз.',
};

const de: InvitationMap = {
  subject: 'Einladung in den Arbeitsbereich {{workspace}}',
  preview: 'Einladung in den Arbeitsbereich {{workspace}}',
  heading: 'Einladung in einen Arbeitsbereich',
  invitedBy: '{{inviter}} lädt Sie ein beizutreten:',
  invitedAnon: 'Sie sind eingeladen beizutreten:',
  role: 'Rolle: {{role}}',
  roleOwner: 'Eigentümer',
  roleAdmin: 'Administrator',
  roleMember: 'Mitglied',
  cta: 'Einladung annehmen',
  linkHint: 'Falls die Schaltfläche nicht funktioniert, nutzen Sie diesen Link:',
  footer:
    'Der Link ist 7 Tage gültig. Falls Sie diese E-Mail nicht erwartet haben, ignorieren Sie sie einfach.',
};

const fr: InvitationMap = {
  subject: 'Invitation à l’espace de travail {{workspace}}',
  preview: 'Invitation à l’espace de travail {{workspace}}',
  heading: 'Invitation à un espace de travail',
  invitedBy: '{{inviter}} vous invite à rejoindre',
  invitedAnon: 'Vous êtes invité à rejoindre',
  role: 'Rôle : {{role}}',
  roleOwner: 'Propriétaire',
  roleAdmin: 'Administrateur',
  roleMember: 'Membre',
  cta: 'Accepter l’invitation',
  linkHint: 'Si le bouton ne fonctionne pas, utilisez ce lien :',
  footer: 'Le lien est valable 7 jours. Si vous n’attendiez pas cet e-mail, ignorez-le.',
};

const es: InvitationMap = {
  subject: 'Invitación al espacio de trabajo {{workspace}}',
  preview: 'Invitación al espacio de trabajo {{workspace}}',
  heading: 'Invitación a un espacio de trabajo',
  invitedBy: '{{inviter}} te invita a unirte a',
  invitedAnon: 'Te invitan a unirte a',
  role: 'Rol: {{role}}',
  roleOwner: 'Propietario',
  roleAdmin: 'Administrador',
  roleMember: 'Miembro',
  cta: 'Aceptar invitación',
  linkHint: 'Si el botón no funciona, usa este enlace:',
  footer: 'El enlace es válido durante 7 días. Si no esperabas este correo, ignóralo.',
};

const pt: InvitationMap = {
  subject: 'Convite para o espaço de trabalho {{workspace}}',
  preview: 'Convite para o espaço de trabalho {{workspace}}',
  heading: 'Convite para um espaço de trabalho',
  invitedBy: '{{inviter}} convida você para participar de',
  invitedAnon: 'Você foi convidado para participar de',
  role: 'Função: {{role}}',
  roleOwner: 'Proprietário',
  roleAdmin: 'Administrador',
  roleMember: 'Membro',
  cta: 'Aceitar convite',
  linkHint: 'Se o botão não funcionar, use este link:',
  footer: 'O link é válido por 7 dias. Se você não esperava este e-mail, basta ignorá-lo.',
};

const tr: InvitationMap = {
  subject: '{{workspace}} çalışma alanına davet',
  preview: '{{workspace}} çalışma alanına davet',
  heading: 'Çalışma alanına davet',
  invitedBy: '{{inviter}} sizi katılmaya davet ediyor:',
  invitedAnon: 'Katılmaya davet edildiniz:',
  role: 'Rol: {{role}}',
  roleOwner: 'Sahip',
  roleAdmin: 'Yönetici',
  roleMember: 'Üye',
  cta: 'Daveti kabul et',
  linkHint: 'Düğme çalışmıyorsa bu bağlantıyı kullanın:',
  footer: 'Bağlantı 7 gün geçerlidir. Bu e-postayı beklemiyorsanız görmezden gelin.',
};

const uk: InvitationMap = {
  subject: 'Запрошення до робочого простору {{workspace}}',
  preview: 'Запрошення до робочого простору {{workspace}}',
  heading: 'Запрошення до робочого простору',
  invitedBy: '{{inviter}} запрошує вас приєднатися до',
  invitedAnon: 'Вас запрошують приєднатися до',
  role: 'Роль: {{role}}',
  roleOwner: 'Власник',
  roleAdmin: 'Адміністратор',
  roleMember: 'Учасник',
  cta: 'Прийняти запрошення',
  linkHint: 'Якщо кнопка не працює, скористайтеся посиланням:',
  footer: 'Посилання дійсне 7 днів. Якщо ви не очікували цього листа — просто проігноруйте його.',
};

const zh: InvitationMap = {
  subject: '邀请加入工作区 {{workspace}}',
  preview: '邀请加入工作区 {{workspace}}',
  heading: '工作区邀请',
  invitedBy: '{{inviter}} 邀请您加入',
  invitedAnon: '您被邀请加入',
  role: '角色：{{role}}',
  roleOwner: '所有者',
  roleAdmin: '管理员',
  roleMember: '成员',
  cta: '接受邀请',
  linkHint: '如果按钮无法打开，请使用此链接：',
  footer: '该链接 7 天内有效。如果您并未预期收到此邮件，请忽略它。',
};

const pl: InvitationMap = {
  subject: 'Zaproszenie do przestrzeni roboczej {{workspace}}',
  preview: 'Zaproszenie do przestrzeni roboczej {{workspace}}',
  heading: 'Zaproszenie do przestrzeni roboczej',
  invitedBy: '{{inviter}} zaprasza Cię do dołączenia do',
  invitedAnon: 'Zapraszamy Cię do dołączenia do',
  role: 'Rola: {{role}}',
  roleOwner: 'Właściciel',
  roleAdmin: 'Administrator',
  roleMember: 'Uczestnik',
  cta: 'Zaakceptuj zaproszenie',
  linkHint: 'Jeśli przycisk nie działa, użyj tego linku:',
  footer:
    'Link jest ważny 7 dni. Jeśli nie spodziewałeś się tej wiadomości, po prostu ją zignoruj.',
};

const it: InvitationMap = {
  subject: 'Invito allo spazio di lavoro {{workspace}}',
  preview: 'Invito allo spazio di lavoro {{workspace}}',
  heading: 'Invito a uno spazio di lavoro',
  invitedBy: '{{inviter}} ti invita a unirti a',
  invitedAnon: 'Sei invitato a unirti a',
  role: 'Ruolo: {{role}}',
  roleOwner: 'Proprietario',
  roleAdmin: 'Amministratore',
  roleMember: 'Membro',
  cta: 'Accetta l’invito',
  linkHint: 'Se il pulsante non funziona, usa questo link:',
  footer: 'Il link è valido per 7 giorni. Se non ti aspettavi questa email, ignorala.',
};

const sk: InvitationMap = {
  subject: 'Pozvánka do pracovného priestoru {{workspace}}',
  preview: 'Pozvánka do pracovného priestoru {{workspace}}',
  heading: 'Pozvánka do pracovného priestoru',
  invitedBy: '{{inviter}} vás pozýva pripojiť sa k',
  invitedAnon: 'Ste pozvaní pripojiť sa k',
  role: 'Rola: {{role}}',
  roleOwner: 'Vlastník',
  roleAdmin: 'Správca',
  roleMember: 'Člen',
  cta: 'Prijať pozvánku',
  linkHint: 'Ak tlačidlo nefunguje, použite tento odkaz:',
  footer: 'Odkaz je platný 7 dní. Ak ste tento e-mail nečakali, jednoducho ho ignorujte.',
};

const ja: InvitationMap = {
  subject: 'ワークスペース {{workspace}} への招待',
  preview: 'ワークスペース {{workspace}} への招待',
  heading: 'ワークスペースへの招待',
  invitedBy: '{{inviter}} さんがあなたを招待しています:',
  invitedAnon: '参加へのご招待です:',
  role: 'ロール: {{role}}',
  roleOwner: 'オーナー',
  roleAdmin: '管理者',
  roleMember: 'メンバー',
  cta: '招待を承認する',
  linkHint: 'ボタンが開かない場合は、次のリンクをご利用ください:',
  footer: 'リンクの有効期限は 7 日間です。心当たりがない場合は、このメールを無視してください。',
};

const ko: InvitationMap = {
  subject: '워크스페이스 {{workspace}} 초대',
  preview: '워크스페이스 {{workspace}} 초대',
  heading: '워크스페이스 초대',
  invitedBy: '{{inviter}}님이 참여를 초대했습니다:',
  invitedAnon: '참여하도록 초대되었습니다:',
  role: '역할: {{role}}',
  roleOwner: '소유자',
  roleAdmin: '관리자',
  roleMember: '멤버',
  cta: '초대 수락',
  linkHint: '버튼이 열리지 않으면 이 링크를 사용하세요:',
  footer: '링크는 7일 동안 유효합니다. 예상하지 못한 메일이라면 무시하셔도 됩니다.',
};

const hi: InvitationMap = {
  subject: 'कार्यक्षेत्र {{workspace}} में आमंत्रण',
  preview: 'कार्यक्षेत्र {{workspace}} में आमंत्रण',
  heading: 'कार्यक्षेत्र में आमंत्रण',
  invitedBy: '{{inviter}} आपको इसमें शामिल होने के लिए आमंत्रित करते हैं:',
  invitedAnon: 'आपको इसमें शामिल होने के लिए आमंत्रित किया गया है:',
  role: 'भूमिका: {{role}}',
  roleOwner: 'स्वामी',
  roleAdmin: 'व्यवस्थापक',
  roleMember: 'सदस्य',
  cta: 'आमंत्रण स्वीकार करें',
  linkHint: 'यदि बटन काम न करे, तो इस लिंक का उपयोग करें:',
  footer: 'यह लिंक 7 दिनों तक मान्य है। यदि आपको इस ईमेल की अपेक्षा नहीं थी, तो इसे अनदेखा करें।',
};

const nl: InvitationMap = {
  subject: 'Uitnodiging voor werkruimte {{workspace}}',
  preview: 'Uitnodiging voor werkruimte {{workspace}}',
  heading: 'Uitnodiging voor een werkruimte',
  invitedBy: '{{inviter}} nodigt je uit om deel te nemen aan',
  invitedAnon: 'Je bent uitgenodigd om deel te nemen aan',
  role: 'Rol: {{role}}',
  roleOwner: 'Eigenaar',
  roleAdmin: 'Beheerder',
  roleMember: 'Lid',
  cta: 'Uitnodiging accepteren',
  linkHint: 'Werkt de knop niet? Gebruik deze link:',
  footer: 'De link is 7 dagen geldig. Verwachtte je deze e-mail niet? Negeer hem dan.',
};

const sv: InvitationMap = {
  subject: 'Inbjudan till arbetsytan {{workspace}}',
  preview: 'Inbjudan till arbetsytan {{workspace}}',
  heading: 'Inbjudan till en arbetsyta',
  invitedBy: '{{inviter}} bjuder in dig att gå med i',
  invitedAnon: 'Du är inbjuden att gå med i',
  role: 'Roll: {{role}}',
  roleOwner: 'Ägare',
  roleAdmin: 'Administratör',
  roleMember: 'Medlem',
  cta: 'Acceptera inbjudan',
  linkHint: 'Om knappen inte fungerar, använd den här länken:',
  footer: 'Länken gäller i 7 dagar. Om du inte väntade dig det här mejlet kan du ignorera det.',
};

const vi: InvitationMap = {
  subject: 'Lời mời vào không gian làm việc {{workspace}}',
  preview: 'Lời mời vào không gian làm việc {{workspace}}',
  heading: 'Lời mời vào không gian làm việc',
  invitedBy: '{{inviter}} mời bạn tham gia',
  invitedAnon: 'Bạn được mời tham gia',
  role: 'Vai trò: {{role}}',
  roleOwner: 'Chủ sở hữu',
  roleAdmin: 'Quản trị viên',
  roleMember: 'Thành viên',
  cta: 'Chấp nhận lời mời',
  linkHint: 'Nếu nút không hoạt động, hãy dùng liên kết này:',
  footer: 'Liên kết có hiệu lực trong 7 ngày. Nếu bạn không mong đợi email này, hãy bỏ qua nó.',
};

const id: InvitationMap = {
  subject: 'Undangan ke ruang kerja {{workspace}}',
  preview: 'Undangan ke ruang kerja {{workspace}}',
  heading: 'Undangan ke ruang kerja',
  invitedBy: '{{inviter}} mengundang Anda bergabung ke',
  invitedAnon: 'Anda diundang bergabung ke',
  role: 'Peran: {{role}}',
  roleOwner: 'Pemilik',
  roleAdmin: 'Administrator',
  roleMember: 'Anggota',
  cta: 'Terima undangan',
  linkHint: 'Jika tombol tidak berfungsi, gunakan tautan ini:',
  footer: 'Tautan berlaku selama 7 hari. Jika Anda tidak mengharapkan email ini, abaikan saja.',
};

const da: InvitationMap = {
  subject: 'Invitation til arbejdsområdet {{workspace}}',
  preview: 'Invitation til arbejdsområdet {{workspace}}',
  heading: 'Invitation til et arbejdsområde',
  invitedBy: '{{inviter}} inviterer dig til at være med i',
  invitedAnon: 'Du er inviteret til at være med i',
  role: 'Rolle: {{role}}',
  roleOwner: 'Ejer',
  roleAdmin: 'Administrator',
  roleMember: 'Medlem',
  cta: 'Acceptér invitationen',
  linkHint: 'Hvis knappen ikke virker, brug dette link:',
  footer: 'Linket er gyldigt i 7 dage. Hvis du ikke forventede denne e-mail, så ignorér den blot.',
};

const nb: InvitationMap = {
  subject: 'Invitasjon til arbeidsområdet {{workspace}}',
  preview: 'Invitasjon til arbeidsområdet {{workspace}}',
  heading: 'Invitasjon til et arbeidsområde',
  invitedBy: '{{inviter}} inviterer deg til å bli med i',
  invitedAnon: 'Du er invitert til å bli med i',
  role: 'Rolle: {{role}}',
  roleOwner: 'Eier',
  roleAdmin: 'Administrator',
  roleMember: 'Medlem',
  cta: 'Godta invitasjonen',
  linkHint: 'Hvis knappen ikke virker, bruk denne lenken:',
  footer:
    'Lenken er gyldig i 7 dager. Hvis du ikke ventet denne e-posten, kan du bare se bort fra den.',
};

const nn: InvitationMap = {
  subject: 'Invitasjon til arbeidsområdet {{workspace}}',
  preview: 'Invitasjon til arbeidsområdet {{workspace}}',
  heading: 'Invitasjon til eit arbeidsområde',
  invitedBy: '{{inviter}} inviterer deg til å bli med i',
  invitedAnon: 'Du er invitert til å bli med i',
  role: 'Rolle: {{role}}',
  roleOwner: 'Eigar',
  roleAdmin: 'Administrator',
  roleMember: 'Medlem',
  cta: 'Godta invitasjonen',
  linkHint: 'Dersom knappen ikkje verkar, bruk denne lenkja:',
  footer:
    'Lenkja er gyldig i 7 dagar. Dersom du ikkje venta denne e-posten, kan du berre sjå bort frå han.',
};

const fi: InvitationMap = {
  subject: 'Kutsu työtilaan {{workspace}}',
  preview: 'Kutsu työtilaan {{workspace}}',
  heading: 'Kutsu työtilaan',
  invitedBy: '{{inviter}} kutsuu sinut liittymään',
  invitedAnon: 'Sinut on kutsuttu liittymään',
  role: 'Rooli: {{role}}',
  roleOwner: 'Omistaja',
  roleAdmin: 'Ylläpitäjä',
  roleMember: 'Jäsen',
  cta: 'Hyväksy kutsu',
  linkHint: 'Jos painike ei toimi, käytä tätä linkkiä:',
  footer: 'Linkki on voimassa 7 päivää. Jos et odottanut tätä viestiä, voit jättää sen huomiotta.',
};

const is: InvitationMap = {
  subject: 'Boð á vinnusvæðið {{workspace}}',
  preview: 'Boð á vinnusvæðið {{workspace}}',
  heading: 'Boð á vinnusvæði',
  invitedBy: '{{inviter}} býður þér að ganga til liðs við',
  invitedAnon: 'Þér er boðið að ganga til liðs við',
  role: 'Hlutverk: {{role}}',
  roleOwner: 'Eigandi',
  roleAdmin: 'Stjórnandi',
  roleMember: 'Meðlimur',
  cta: 'Taka boðinu',
  linkHint: 'Ef hnappurinn virkar ekki, notaðu þennan hlekk:',
  footer: 'Hlekkurinn gildir í 7 daga. Ef þú áttir ekki von á þessum pósti máttu hunsa hann.',
};

const fo: InvitationMap = {
  subject: 'Innbjóðing til arbeiðsøkið {{workspace}}',
  preview: 'Innbjóðing til arbeiðsøkið {{workspace}}',
  heading: 'Innbjóðing til eitt arbeiðsøki',
  invitedBy: '{{inviter}} bjóðar tær at verða við í',
  invitedAnon: 'Tú ert bodin at verða við í',
  role: 'Rolla: {{role}}',
  roleOwner: 'Eigari',
  roleAdmin: 'Umsitari',
  roleMember: 'Limur',
  cta: 'Tak við innbjóðingini',
  linkHint: 'Um knappurin ikki virkar, brúka hetta leinki:',
  footer:
    'Leinkið er gildigt í 7 dagar. Um tú ikki vænti hetta brævið, so síggj bert burtur frá tí.',
};

const cs: InvitationMap = {
  subject: 'Pozvánka do pracovního prostoru {{workspace}}',
  preview: 'Pozvánka do pracovního prostoru {{workspace}}',
  heading: 'Pozvánka do pracovního prostoru',
  invitedBy: '{{inviter}} vás zve do',
  invitedAnon: 'Jste zváni do',
  role: 'Role: {{role}}',
  roleOwner: 'Vlastník',
  roleAdmin: 'Správce',
  roleMember: 'Člen',
  cta: 'Přijmout pozvánku',
  linkHint: 'Pokud tlačítko nefunguje, použijte tento odkaz:',
  footer: 'Odkaz je platný 7 dní. Pokud jste tento e-mail nečekali, jednoduše jej ignorujte.',
};

const bg: InvitationMap = {
  subject: 'Покана за работното пространство {{workspace}}',
  preview: 'Покана за работното пространство {{workspace}}',
  heading: 'Покана за работно пространство',
  invitedBy: '{{inviter}} ви кани да се присъедините към',
  invitedAnon: 'Поканени сте да се присъедините към',
  role: 'Роля: {{role}}',
  roleOwner: 'Собственик',
  roleAdmin: 'Администратор',
  roleMember: 'Участник',
  cta: 'Приеми поканата',
  linkHint: 'Ако бутонът не работи, използвайте тази връзка:',
  footer: 'Връзката е валидна 7 дни. Ако не сте очаквали този имейл, просто го игнорирайте.',
};

const hr: InvitationMap = {
  subject: 'Pozivnica u radni prostor {{workspace}}',
  preview: 'Pozivnica u radni prostor {{workspace}}',
  heading: 'Pozivnica u radni prostor',
  invitedBy: '{{inviter}} vas poziva da se pridružite',
  invitedAnon: 'Pozvani ste da se pridružite',
  role: 'Uloga: {{role}}',
  roleOwner: 'Vlasnik',
  roleAdmin: 'Administrator',
  roleMember: 'Član',
  cta: 'Prihvati pozivnicu',
  linkHint: 'Ako gumb ne radi, koristite ovu vezu:',
  footer: 'Veza je važeća 7 dana. Ako niste očekivali ovu e-poštu, jednostavno je ignorirajte.',
};

const sr: InvitationMap = {
  subject: 'Позивница у радни простор {{workspace}}',
  preview: 'Позивница у радни простор {{workspace}}',
  heading: 'Позивница у радни простор',
  invitedBy: '{{inviter}} вас позива да се придружите',
  invitedAnon: 'Позвани сте да се придружите',
  role: 'Улога: {{role}}',
  roleOwner: 'Власник',
  roleAdmin: 'Администратор',
  roleMember: 'Члан',
  cta: 'Прихвати позивницу',
  linkHint: 'Ако дугме не радi, користите ову везу:',
  footer: 'Веза важи 7 дана. Ако нисте очекивали ову е-пошту, једноставно је игноришите.',
};

const sl: InvitationMap = {
  subject: 'Vabilo v delovni prostor {{workspace}}',
  preview: 'Vabilo v delovni prostor {{workspace}}',
  heading: 'Vabilo v delovni prostor',
  invitedBy: '{{inviter}} vas vabi, da se pridružite',
  invitedAnon: 'Vabljeni ste, da se pridružite',
  role: 'Vloga: {{role}}',
  roleOwner: 'Lastnik',
  roleAdmin: 'Skrbnik',
  roleMember: 'Član',
  cta: 'Sprejmi vabilo',
  linkHint: 'Če gumb ne deluje, uporabite to povezavo:',
  footer: 'Povezava velja 7 dni. Če tega e-sporočila niste pričakovali, ga preprosto prezrite.',
};

const mk: InvitationMap = {
  subject: 'Покана за работниот простор {{workspace}}',
  preview: 'Покана за работниот простор {{workspace}}',
  heading: 'Покана за работен простор',
  invitedBy: '{{inviter}} ве повикува да се придружите на',
  invitedAnon: 'Повикани сте да се придружите на',
  role: 'Улога: {{role}}',
  roleOwner: 'Сопственик',
  roleAdmin: 'Администратор',
  roleMember: 'Член',
  cta: 'Прифати ја поканата',
  linkHint: 'Ако копчето не работи, користете ја оваа врска:',
  footer: 'Врската важи 7 дена. Ако не сте ја очекувале оваа е-пошта, едноставно игнорирајте ја.',
};

const be: InvitationMap = {
  subject: 'Запрашэнне ў працоўную прастору {{workspace}}',
  preview: 'Запрашэнне ў працоўную прастору {{workspace}}',
  heading: 'Запрашэнне ў працоўную прастору',
  invitedBy: '{{inviter}} запрашае вас далучыцца да',
  invitedAnon: 'Вас запрашаюць далучыцца да',
  role: 'Роля: {{role}}',
  roleOwner: 'Уладальнік',
  roleAdmin: 'Адміністратар',
  roleMember: 'Удзельнік',
  cta: 'Прыняць запрашэнне',
  linkHint: 'Калі кнопка не працуе, скарыстайце гэтую спасылку:',
  footer: 'Спасылка дзейсная 7 дзён. Калі вы не чакалі гэтага ліста — проста праігнаруйце яго.',
};

const bs: InvitationMap = {
  subject: 'Pozivnica u radni prostor {{workspace}}',
  preview: 'Pozivnica u radni prostor {{workspace}}',
  heading: 'Pozivnica u radni prostor',
  invitedBy: '{{inviter}} vas poziva da se pridružite',
  invitedAnon: 'Pozvani ste da se pridružite',
  role: 'Uloga: {{role}}',
  roleOwner: 'Vlasnik',
  roleAdmin: 'Administrator',
  roleMember: 'Član',
  cta: 'Prihvati pozivnicu',
  linkHint: 'Ako dugme ne radi, koristite ovaj link:',
  footer: 'Link je važeći 7 dana. Ako niste očekivali ovu e-poštu, jednostavno je ignorišite.',
};

const hsb: InvitationMap = {
  subject: 'Přeprošenje do dźěłoweho ruma {{workspace}}',
  preview: 'Přeprošenje do dźěłoweho ruma {{workspace}}',
  heading: 'Přeprošenje do dźěłoweho ruma',
  invitedBy: '{{inviter}} was přeprošuje, zo byšće so přizamknył',
  invitedAnon: 'Sće přeprošeni, zo byšće so přizamknyli',
  role: 'Rola: {{role}}',
  roleOwner: 'Wobsedźer',
  roleAdmin: 'Administrator',
  roleMember: 'Čłon',
  cta: 'Přeprošenje přiwzać',
  linkHint: 'Jeli tastka njefunguje, wužiwajće tutón wotkaz:',
  footer: 'Wotkaz płaći 7 dnjow. Jeli sće tutu e-mejlku njewočakował, ignorujće ju prosće.',
};

const INVITATION_TRANSLATIONS: Record<string, InvitationMap> = {
  ru,
  en,
  kk,
  de,
  fr,
  es,
  pt,
  tr,
  uk,
  zh,
  pl,
  it,
  sk,
  ja,
  ko,
  hi,
  nl,
  sv,
  vi,
  id,
  da,
  nb,
  nn,
  fi,
  is,
  fo,
  cs,
  bg,
  hr,
  sr,
  sl,
  mk,
  be,
  bs,
  hsb,
};

export function renderInvitation(
  locale: string,
  key: InvitationKey,
  params: Record<string, string | number> = {},
): string {
  const translations = INVITATION_TRANSLATIONS[locale] ?? INVITATION_TRANSLATIONS.en;
  return translations[key].replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    String(params[name] ?? ''),
  );
}

export function invitationRoleKey(role: string): InvitationKey {
  if (role === 'owner') return 'roleOwner';
  if (role === 'admin') return 'roleAdmin';
  return 'roleMember';
}
