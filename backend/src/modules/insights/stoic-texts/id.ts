import type { StoicTextMap } from './types';

export const id: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: 'Bulan ini melampaui rencananya',
      message:
        'Anda merencanakan {{plannedAmount}} dan telah membelanjakan {{spentAmount}} — {{percent}}% lebih banyak. Rencana dibuat dengan kepala dingin; biarkan suaranya lebih keras daripada dorongan sesaat.',
    },
    {
      title: '{{percent}}% melewati niat belanja Anda',
      message:
        'Pengeluaran mencapai {{spentAmount}} dibandingkan rencana {{plannedAmount}}. Lihat batas mana yang jebol lebih dulu — di situlah pelajarannya.',
    },
    {
      title: 'Rencana dan bulan Anda tidak sejalan',
      message:
        '{{spentAmount}} terpakai, {{plannedAmount}} yang diniatkan. Entah rencana terlalu sedikit meminta dari kenyataan, entah kenyataan terlalu banyak meminta dari Anda — putuskan yang mana, dengan tenang.',
    },
    {
      title: 'Lebih banyak keluar daripada yang Anda izinkan',
      message:
        'Bulan ini {{percent}}% di atas {{plannedAmount}} yang Anda tetapkan. Tidak ada yang hilang dengan berhenti sekarang; banyak yang hilang dengan berpura-pura tidak terjadi apa-apa.',
    },
    {
      title: 'Batas yang Anda buat, batas yang Anda lewati',
      message:
        'Anda berniat membelanjakan {{plannedAmount}}; kenyataannya {{spentAmount}}. Penguasaan diri bukan berarti tak pernah tergelincir — melainkan cepat menyadarinya dan kembali ke jalan.',
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: 'Hiburan mengambil lebih dari rencana',
      message:
        'Anda ingin hiburan menjadi {{planned}}% dari pengeluaran; bulan ini {{actual}}%. Kesenangan disambut sebagai tamu, bukan sebagai tuan rumah.',
    },
    {
      title: 'Hiburan {{actual}}%, rencana {{planned}}%',
      message:
        'Istirahat pantas mendapat tempatnya ketika memulihkan Anda. Tanyakan kesenangan mana bulan ini yang melakukannya, dan lepaskan sisanya tanpa penyesalan.',
    },
    {
      title: 'Kenyamanan membelanjakan lebih dari niat',
      message:
        'Hiburan mengambil {{actual}}% pengeluaran dibandingkan {{planned}}% yang Anda pilih. Moderasi bukan menolak kesenangan — melainkan menjaganya sebesar yang Anda putuskan.',
    },
    {
      title: 'Yang menyenangkan mendesak yang direncanakan',
      message:
        'Anda memberi hiburan {{planned}}% dari rencana dan ia mengambil {{actual}}%. Apa yang mudah Anda nikmati layak dilihat dua kali sebelum menjadi kebutuhan.',
    },
    {
      title: 'Hiburan melangkahi garisnya',
      message:
        '{{actual}}% bulan ini untuk hiburan, niatnya {{planned}}%. Garis itu Anda yang menarik, dan Anda pula yang menjaganya.',
    },
  ],
  'stoic.leisure_habit': [
    {
      title: 'Hiburan kembali melewati rencana',
      message:
        'Hiburan melewati rencana Anda dalam {{months}} dari {{window}} bulan terakhir. Pengulangan bukan lagi kebetulan — itu kebiasaan yang layak ditelaah.',
    },
    {
      title: '{{months}} dari {{window}} bulan di atas rencana hiburan',
      message:
        'Yang terjadi sekali adalah keadaan; yang terjadi {{months}} kali adalah watak yang sedang terbentuk. Pilihlah watak itu dengan sengaja.',
    },
    {
      title: 'Tergelincir yang sama, bulan demi bulan',
      message:
        'Hiburan melampaui rencana dalam {{months}} dari {{window}} bulan. Naikkan rencana dengan jujur atau ubah kebiasaannya — hidup di antara keduanya paling mahal.',
    },
    {
      title: 'Sebuah pola, bukan kekhilafan',
      message:
        'Dalam {{months}} dari {{window}} bulan terakhir, hiburan mengambil lebih dari yang Anda berikan. Perhatikan saat keputusan dibuat, bukan hanya tagihannya sesudahnya.',
    },
    {
      title: 'Kebiasaan memberi suara melawan rencana Anda',
      message:
        'Hiburan mengalahkan rencana {{months}} kali dalam {{window}} bulan. Kebiasaan dibangun satu pilihan demi satu pilihan; begitu pula meruntuhkannya.',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: 'Kebajikan mendapat kurang dari niat Anda',
      message:
        'Anda menyisihkan {{planned}}% anggaran untuk kesehatan, belajar, dan orang lain; sejauh ini {{actual}}%. Niat baru berarti setelah dijalankan.',
    },
    {
      title: 'Kebajikan {{actual}}% dari rencana {{planned}}%',
      message:
        'Uang yang Anda niatkan untuk hal yang membuat Anda lebih baik masih menunggu. Tidak ada waktu yang lebih baik untuk membelanjakannya dengan baik selain bulan ini.',
    },
    {
      title: 'Kebaikan yang direncanakan belum dibelanjakan',
      message:
        'Kesehatan, belajar, dan kemurahan hati seharusnya mendapat {{planned}}% pengeluaran; kenyataannya {{actual}}%. Lakukan salah satunya minggu ini, dengan sengaja.',
    },
    {
      title: 'Niat tanpa perbuatan',
      message:
        'Kebajikan mendapat {{actual}}% pengeluaran dibandingkan {{planned}}% yang Anda pilih. Apa yang kita hargai terlihat dari apa yang benar-benar kita bayar.',
    },
    {
      title: 'Masih ada ruang untuk yang penting',
      message:
        'Hanya {{actual}}% untuk kebajikan, padahal Anda merencanakan {{planned}}%. Sebuah buku, pemeriksaan kesehatan, hadiah bagi yang membutuhkan — rencana sudah mengatakan ya.',
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: 'Kebajikan terus ditunda',
      message:
        'Pengeluaran untuk kesehatan, belajar, dan orang lain sudah {{months}} bulan berturut-turut di bawah rencana. Apa yang terus Anda tunda, sebenarnya sudah Anda tolak.',
    },
    {
      title: '{{months}} bulan kebajikan tertunda',
      message:
        'Setiap bulan rencana memberi ruang untuk hal yang membuat Anda lebih baik, dan setiap bulan ruang itu tak terpakai. Waktu adalah satu-satunya hal yang tidak bisa Anda anggarkan dua kali.',
    },
    {
      title: 'Diri Anda yang lebih baik masih menunggu',
      message:
        'Kebajikan sudah {{months}} bulan berturut-turut di bawah rencana. Mulailah kecil dan pasti, bukan besar dan nanti.',
    },
    {
      title: 'Niat baik mulai menua',
      message:
        'Selama {{months}} bulan kesehatan, belajar, dan kemurahan hati mendapat kurang dari rencana. Pilih satu dan danai lebih dulu bulan depan, sebelum yang lain.',
    },
    {
      title: 'Kebajikan terus kalah oleh “nanti”',
      message:
        '{{months}} bulan berturut-turut di bawah rencana. “Nanti” adalah tempat niat baik pergi untuk dilupakan — beri yang satu ini tanggal.',
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: 'Rencana Anda tak memberi ruang bagi kebajikan',
      message:
        'Tidak ada anggaran Anda yang melayani kesehatan, belajar, atau orang lain. Rencana menunjukkan apa yang kita hargai — pertimbangkan memberi kebajikan barisnya sendiri.',
    },
    {
      title: 'Semua dianggarkan, kecuali kebaikan',
      message:
        'Kebutuhan, pekerjaan, dan hiburan punya batas; kebajikan tidak. Apa yang tak pernah direncanakan cenderung tak pernah terjadi.',
    },
    {
      title: 'Rencanakan hal yang membuat Anda lebih baik',
      message:
        'Belum ada anggaran di kelas kebajikan. Bahkan yang kecil — buku, olahraga, donasi — mengubah keinginan menjadi komitmen.',
    },
    {
      title: 'Rencana diam tentang kebajikan',
      message:
        'Anda menganggarkan yang wajib dan yang menyenangkan, tetapi belum untuk diri yang ingin Anda capai. Satu anggaran kebajikan yang sederhana akan mengubahnya.',
    },
    {
      title: 'Kebajikan tidak punya anggaran',
      message:
        'Pengeluaran untuk kesehatan, belajar, atau orang lain tidak direncanakan di mana pun. Pilih satu dan beri batas yang akan Anda senang capai.',
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: 'Kebutuhan lebih mahal dari rencana',
      message:
        'Anda merencanakan {{planned}}% pengeluaran untuk kebutuhan; kenyataannya {{actual}}%. Periksa apakah masing-masing masih kebutuhan atau diam-diam menjadi kenyamanan.',
    },
    {
      title: 'Kebutuhan {{actual}}%, rencana {{planned}}%',
      message:
        'Apa yang dibutuhkan hidup biasanya lebih sedikit daripada yang kita biasakan. Tinjau kebutuhan terbesar dengan mata yang segar.',
    },
    {
      title: 'Pengeluaran pokok membengkak',
      message:
        'Kebutuhan mengambil {{actual}}% bulan ini dibandingkan {{planned}}% yang Anda perkirakan. Kebutuhan yang terus tumbuh layak dipertanyakan.',
    },
    {
      title: 'Kebutuhan melampaui rencana',
      message:
        'Rencana {{planned}}%, aktual {{actual}}%. Entah rencana meremehkan biaya sebenarnya, entah sebagian keinginan bepergian dengan nama kebutuhan.',
    },
    {
      title: 'Lebih banyak untuk “harus” daripada yang dimaksud',
      message:
        'Kebutuhan mengambil {{actual}}% pengeluaran, bukan {{planned}}%. Pisahkan yang benar-benar harus dari yang sekadar selalu ada.',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: 'Kebutuhan merayap naik',
      message:
        'Pengeluaran untuk kebutuhan naik {{months}} bulan berturut-turut, total {{percent}}%. Kebutuhan tumbuh diam-diam ketika tak ada yang meminta mereka membenarkan diri.',
    },
    {
      title: '+{{percent}}% untuk kebutuhan dalam {{months}} bulan',
      message:
        'Setiap langkah tampak kecil; bersama-sama tidak. Ambil kebutuhan rutin terbesar dan tanyakan apakah masih harus semahal ini.',
    },
    {
      title: 'Lantai pengeluaran Anda naik',
      message:
        'Kebutuhan tumbuh selama {{months}} bulan berturut-turut (+{{percent}}%). Lantai yang naik menyisakan lebih sedikit ruang bagi semua yang Anda pilih dengan bebas.',
    },
    {
      title: 'Kebutuhan meluas',
      message:
        '{{months}} bulan pertumbuhan, total {{percent}}%. Ujian Stoik itu sederhana: apakah Anda akan memilih ini lagi hari ini, dengan mengetahui harganya?',
    },
    {
      title: 'Kenaikan kecil, arah yang tetap',
      message:
        'Kebutuhan naik {{percent}}% selama {{months}} bulan. Arah lebih penting daripada satu bulan mana pun — yang ini layak dikoreksi sejak dini.',
    },
  ],
  'stoic.work_over_plan': [
    {
      title: 'Pekerjaan lebih mahal dari rencana',
      message:
        'Anda merencanakan {{planned}}% pengeluaran untuk pekerjaan; kenyataannya {{actual}}%. Alat dan layanan harus sepadan dengan biayanya — periksa mana yang begitu.',
    },
    {
      title: 'Pengeluaran pekerjaan {{actual}}%, rencana {{planned}}%',
      message:
        'Investasi dalam pekerjaan baik bila memberi hasil. Tinjau apa yang Anda bayar tetapi tak lagi dipakai.',
    },
    {
      title: 'Anggaran pekerjaan meregang',
      message:
        'Pekerjaan mengambil {{actual}}%, bukan {{planned}}%. Ketekunan adalah mengerjakan pekerjaan dengan baik, bukan membeli setiap alat untuknya.',
    },
    {
      title: 'Alat-alat melampaui rencana',
      message:
        'Rencana {{planned}}%, terpakai {{actual}}% untuk pekerjaan. Tanyakan pada setiap pengeluaran: apakah ini membantu saya bekerja, atau hanya terasa seperti kemajuan?',
    },
    {
      title: 'Biaya pekerjaan bergeser',
      message:
        'Pekerjaan mengambil {{actual}}% pengeluaran dibandingkan {{planned}}% yang dimaksud. Pemeriksaan singkat sekarang menghemat pemeriksaan besar nanti.',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '“{{category}}” kembali melewati batas',
      message:
        '“{{category}}” melampaui anggaran dalam {{months}} dari {{window}} bulan terakhir. Entah batasnya yang salah, entah keinginannya — putuskan yang mana.',
    },
    {
      title: '“{{category}}”: melewati anggaran {{months}} dari {{window}} bulan',
      message:
        'Batas yang selalu dilewati bukanlah batas, hanya harapan. Jadikan jujur — naikkan dengan sengaja atau pertahankan dengan sengaja.',
    },
    {
      title: 'Anggaran yang sama jebol lagi',
      message:
        '“{{category}}” melewati batasnya {{months}} kali dalam {{window}} bulan. Pengulangan adalah informasi; manfaatkan.',
    },
    {
      title: '“{{category}}” meminta perhatian Anda',
      message:
        'Melewati anggaran dalam {{months}} dari {{window}} bulan. Perhatikan saat sebelum membeli — hanya di situ kebiasaan bisa diubah.',
    },
    {
      title: 'Sebuah pola di “{{category}}”',
      message:
        '{{months}} kali melewati batas dalam {{window}} bulan. Apa yang kita ulangi, itulah kita jadinya; putuskan apa yang ingin dikatakan kategori ini tentang Anda.',
    },
  ],
  'stoic.budget_pace': [
    {
      title: '“{{category}}” habis pada tanggal {{day}}',
      message:
        'Anda telah membelanjakan {{spentAmount}} dari {{limitAmount}}, dan dengan laju ini batasnya habis sekitar tanggal {{day}}. Melambat sekarang lebih mudah daripada berhenti nanti.',
    },
    {
      title: '“{{category}}” mendahului bulannya',
      message:
        '{{spentAmount}} sudah terpakai dari batas {{limitAmount}}. Dengan laju ini habis pada tanggal {{day}} — sisa bulan masih bisa Anda bentuk.',
    },
    {
      title: 'Cek laju: “{{category}}”',
      message:
        'Anggaran {{limitAmount}} akan bertahan hingga sekitar tanggal {{day}} dengan laju saat ini. Kewaspadaan dini adalah disiplin yang paling murah.',
    },
    {
      title: '“{{category}}” membelanjakan masa depan',
      message:
        '{{spentAmount}} dari {{limitAmount}} terpakai; batas habis sekitar tanggal {{day}}. Apa yang Anda lakukan minggu ini menentukan apakah itu terjadi.',
    },
    {
      title: 'Peringatan dini untuk “{{category}}”',
      message:
        'Dengan laju saat ini, batas {{limitAmount}} tidak akan sampai akhir bulan — habis sekitar tanggal {{day}}. Sesuaikan selagi biayanya kecil.',
    },
  ],
  'stoic.budget_unused': [
    {
      title: '“{{category}}” tidak terpakai',
      message:
        'Anggaran “{{category}}” tidak ada pengeluaran selama {{months}} bulan. Entah Anda sudah tidak membutuhkannya, entah itu niat yang masih menunggu — putuskan yang mana.',
    },
    {
      title: 'Anggaran kosong: “{{category}}”',
      message:
        '{{months}} bulan tanpa satu pun pengeluaran. Rencana seharusnya menggambarkan hidup yang Anda jalani atau yang sedang Anda bangun — yang mana ini?',
    },
    {
      title: '“{{category}}” menganggur',
      message:
        'Tidak ada yang dibelanjakan di sini selama {{months}} bulan. Jika itu pengendalian diri, bagus; jika itu kelalaian, bertindaklah.',
    },
    {
      title: 'Direncanakan, tetapi tidak dijalani',
      message:
        '“{{category}}” punya batas tanpa pengeluaran selama {{months}} bulan. Jaga rencana tetap jujur: hapus atau gunakan.',
    },
    {
      title: '“{{category}}”: {{months}} bulan yang sepi',
      message:
        'Anggaran yang tak pernah disentuh tetap menempati tempat dalam rencana Anda. Kosongkan tempatnya atau hormati niatnya.',
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: '{{percent}}% pengeluaran tanpa batas',
      message:
        '{{unbudgetedAmount}} bulan ini masuk ke kategori yang tidak diawasi anggaran mana pun. Apa yang tidak diukur sulit dikuasai.',
    },
    {
      title: 'Sebagian besar bulan ini tak terencana',
      message:
        '{{percent}}% pengeluaran — {{unbudgetedAmount}} — berada di luar semua anggaran. Beri batas pada bagian terbesarnya dan rencana akan melihat lebih banyak hidup Anda.',
    },
    {
      title: 'Pengeluaran di luar rencana',
      message:
        'Anggaran hanya mencakup sebagian dari yang Anda belanjakan; {{unbudgetedAmount}} ({{percent}}%) tidak terukur. Perluas rencana ke tempat uang benar-benar pergi.',
    },
    {
      title: 'Rencana hanya melihat sebagian gambaran',
      message:
        '{{percent}}% pengeluaran bulan ini tanpa anggaran. Pandangan jernih datang sebelum penilaian yang baik.',
    },
    {
      title: '{{unbudgetedAmount}} dibelanjakan tanpa batas',
      message:
        'Itu {{percent}}% dari bulan ini. Anda tidak harus membatasinya — cukup putuskan berapa banyak yang benar-benar Anda inginkan.',
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '“{{category}}” adalah sebagian besar hiburan Anda',
      message:
        '{{percent}}% pengeluaran hiburan untuk “{{category}}”. Keragaman dalam beristirahat lebih sehat daripada bergantung pada satu kesenangan.',
    },
    {
      title: 'Satu kesenangan mendominasi',
      message:
        '“{{category}}” mengambil {{percent}}% dari semua yang Anda belanjakan untuk hiburan. Tanyakan apakah itu masih menggembirakan atau sudah menjadi rutinitas.',
    },
    {
      title: 'Hiburan bertumpu pada “{{category}}”',
      message:
        '{{percent}}% hiburan di satu tempat. Apa yang tak bisa kita tinggalkan menggenggam kita — pastikan genggamannya masih ringan.',
    },
    {
      title: '“{{category}}”: {{percent}}% hiburan',
      message:
        'Satu sumber kesenangan mengambil hampir semuanya. Coba satu kesenangan lain yang lebih murah bulan ini, lalu bandingkan.',
    },
    {
      title: 'Istirahat Anda punya satu alamat',
      message:
        'Sebagian besar uang hiburan — {{percent}}% — pergi ke “{{category}}”. Kebebasan termasuk mampu menikmati hal lain juga.',
    },
  ],
  'stoic.unclassified': [
    {
      title: 'Sebagian pengeluaran belum dinilai',
      message:
        'Kategori tanpa kelas: {{count}}. Tentukan di Anggaran mana yang kebutuhan, pekerjaan, kebajikan, atau hiburan.',
    },
    {
      title: '{{count}} kategori menunggu penilaian Anda',
      message:
        'Ada pengeluaran tetapi tanpa kelas, jadi saran tidak bisa menimbangnya. Satu menit di Anggaran menyelesaikannya.',
    },
    {
      title: 'Namai apa yang dilayani uang Anda',
      message:
        'Kategori yang masih belum berkelas: {{count}}. Penilaian dimulai dengan menyebut sesuatu dengan nama yang benar.',
    },
    {
      title: 'Pengeluaran belum dinilai: {{count}} kategori',
      message:
        'Apakah ini kebutuhan, pekerjaan Anda, kebajikan, atau kesenangan? Hanya Anda yang bisa mengatakannya — dan rencana menjadi lebih jelas setelahnya.',
    },
    {
      title: 'Beberapa kategori belum berkelas',
      message:
        'Kategori di luar empat kelas: {{count}}. Klasifikasikan di Anggaran agar setiap pengeluaran terlihat apa adanya.',
    },
  ],
  'stoic.small_purchases': [
    {
      title: '{{count}} pembelian kecil di {{merchant}}',
      message:
        'Masing-masing tampak remeh; bersama-sama menjadi {{totalAmount}} bulan ini. Kebiasaan kecil yang tak diperiksa adalah tempat sebagian besar uang pergi diam-diam.',
    },
    {
      title: '{{merchant}}: {{count}} kali bulan ini',
      message:
        '{{totalAmount}} dalam jumlah kecil. Tanyakan apakah setiap kunjungan adalah pilihan atau refleks — hanya yang pertama adalah kebebasan.',
    },
    {
      title: 'Sedikit demi sedikit: {{totalAmount}}',
      message:
        '{{count}} pembelian di {{merchant}}. Tak satu pun penting; kebiasaannya yang penting. Putuskan seberapa sering Anda benar-benar menginginkannya.',
    },
    {
      title: 'Kebiasaan di {{merchant}}',
      message:
        '{{count}} pembelian, total {{totalAmount}}. Coba lewatkan satu dari tiga bulan ini dan lihat apakah Anda merindukannya.',
    },
    {
      title: 'Hal kecil menumpuk',
      message:
        'Anda ke {{merchant}} {{count}} kali, senilai {{totalAmount}}. Penguasaan atas keputusan besar dibangun di atas keputusan kecil seperti ini.',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: 'Akhir pekan memikul {{percent}}% hiburan',
      message:
        'Sebagian besar pengeluaran hiburan Anda terjadi pada Sabtu dan Minggu. Istirahat itu baik; pastikan itu istirahat, bukan pelampiasan atas minggu yang berat.',
    },
    {
      title: 'Hiburan tinggal di akhir pekan',
      message:
        '{{percent}}% pengeluaran hiburan jatuh pada akhir pekan. Rencanakan akhir pekan sedikit, dan ia akan lebih murah serta memberi lebih banyak.',
    },
    {
      title: 'Akhir pekan membelanjakan untuk seminggu',
      message:
        'Akhir pekan mengambil {{percent}}% dari yang Anda belanjakan untuk hiburan. Jika minggu Anda perlu diperbaiki setiap Sabtu, lihatlah minggunya.',
    },
    {
      title: 'Sabtu dan Minggu: {{percent}}% hiburan',
      message:
        'Hari bebas mengundang belanja bebas. Putuskan sebelum akhir pekan untuk apa ia, dan biarkan uang mengikuti.',
    },
    {
      title: 'Pola akhir pekan',
      message:
        '{{percent}}% pengeluaran hiburan terjadi di akhir pekan. Kelonggaran di hari kerja sering membuat akhir pekan lebih murah.',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}} mengambil {{percent}}% bulan ini',
      message:
        '{{totalAmount}} masuk ke satu pedagang untuk hiburan. Ketika satu tempat memegang uang Anda sebanyak itu, tanyakan seberapa banyak ia memegang perhatian Anda juga.',
    },
    {
      title: 'Satu tempat, {{totalAmount}}',
      message:
        '{{merchant}} adalah {{percent}}% pengeluaran bulan ini. Apakah itu sepadan dengan porsi hasil jerih payah Anda sebesar itu?',
    },
    {
      title: '{{merchant}} memimpin pengeluaran Anda',
      message:
        '{{percent}}% bulan ini — {{totalAmount}} — pergi ke sana. Tidak salah menikmatinya, selama Anda akan memilihnya lagi.',
    },
    {
      title: 'Porsi besar di {{merchant}}',
      message:
        '{{totalAmount}}, atau {{percent}}% pengeluaran, di satu tempat hiburan. Timbang kesenangan terhadap harganya, dengan tenang.',
    },
    {
      title: '{{percent}}% di {{merchant}}',
      message:
        'Satu pedagang ini mengambil {{totalAmount}}. Kebebasan adalah mampu melewatinya saat Anda memilih.',
    },
  ],
  'stoic.income_drop': [
    {
      title: 'Pendapatan turun, pengeluaran tidak',
      message:
        'Pendapatan turun {{percent}}% menjadi {{incomeAmount}}, tetapi pengeluaran tetap {{expenseAmount}}. Nasib berubah pikiran; pengeluaran Anda belum menyadarinya.',
    },
    {
      title: 'Pendapatan turun {{percent}}%',
      message:
        '{{incomeAmount}} masuk, {{expenseAmount}} keluar. Apa yang diberikan nasib bisa diambilnya kembali — sesuaikan pengeluaran dengan yang ada, bukan yang dulu.',
    },
    {
      title: 'Bulan yang lebih ramping, kebiasaan yang sama',
      message:
        'Pendapatan {{percent}}% lebih rendah ({{incomeAmount}}), sementara pengeluaran bertahan di {{expenseAmount}}. Pendapatan tidak dalam kuasa Anda; tanggapan Anda ya.',
    },
    {
      title: 'Nasib bergeser',
      message:
        'Anda menghasilkan {{percent}}% lebih sedikit dari biasanya, tetapi membelanjakan {{expenseAmount}} seperti sebelumnya. Pangkas sekarang, selagi itu pilihan, bukan keharusan.',
    },
    {
      title: 'Pengeluaran belum mengikuti pendapatan',
      message:
        'Pendapatan turun menjadi {{incomeAmount}} ({{percent}}% lebih rendah); pengeluaran {{expenseAmount}}. Sesuaikan layar dengan angin yang benar-benar Anda miliki.',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: 'Langganan: {{monthlyAmount}} sebulan',
      message:
        '{{count}} langganan mengambil {{percent}}% pengeluaran bulanan Anda. Masing-masing diperpanjang tanpa bertanya — tanyakan sendiri tentang masing-masing.',
    },
    {
      title: '{{percent}}% pengeluaran memperpanjang dirinya sendiri',
      message:
        '{{count}} langganan, {{monthlyAmount}} sebulan. Pertahankan hanya yang akan Anda pilih lagi hari ini.',
    },
    {
      title: 'Diam, berulang, {{monthlyAmount}}',
      message:
        '{{count}} langganan menghabiskan {{percent}}% bulan Anda. Kemudahan adalah pelayan yang baik dan tuan yang mahal.',
    },
    {
      title: '{{count}} langganan untuk ditinjau',
      message:
        'Bersama-sama {{monthlyAmount}} sebulan, {{percent}}% pengeluaran. Batalkan satu yang jarang Anda pakai dan perhatikan betapa sedikit Anda merindukannya.',
    },
    {
      title: 'Yang diperpanjang dengan sendirinya',
      message:
        '{{monthlyAmount}} sebulan untuk {{count}} langganan. Pengeluaran otomatis layak ditinjau dengan sengaja.',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: 'Keberhasilan Anda bisa menjangkau sedikit lebih jauh',
      message:
        'Selama {{months}} bulan Anda menyimpan {{savingsPercent}}% pendapatan, tetapi hampir tidak ada yang sampai ke orang lain. Kekayaan paling baik berada di tangan yang terbuka — mungkin satu hadiah atau donasi bulan ini?',
    },
    {
      title: 'Penghasilan baik, pemberian sedikit',
      message:
        'Selama {{months}} bulan masuk {{incomeAmount}} dan {{givenAmount}} diberikan kepada orang lain. Jika Anda membantu dengan cara yang tidak terlihat oleh aplikasi ini, abaikan saja; jika tidak, rencana Anda masih punya ruang untuk itu.',
    },
    {
      title: 'Saat yang baik untuk bermurah hati',
      message:
        'Anda menabung {{savingsPercent}}% pendapatan — tanda pengelolaan yang mantap. Sebagian kecil darinya, diberikan kepada yang membutuhkan, akan membuat kemantapan itu lebih bermakna.',
    },
    {
      title: 'Belum ada orang lain dalam gambaran',
      message:
        '{{months}} bulan terakhir menunjukkan penghasilan dan tabungan yang dikelola dengan cermat, tetapi tanpa sedekah atau hadiah. Kita diciptakan untuk satu sama lain; hadiah sederhana sudah cukup untuk memulai.',
    },
    {
      title: 'Ruang untuk kebaikan',
      message:
        'Hanya {{givenAmount}} dari {{incomeAmount}} yang digunakan untuk membantu orang lain. Pertimbangkan donasi kecil yang rutin — seperti setiap kebajikan, kemurahan hati makin mudah dengan kebiasaan.',
    },
  ],
  'stoic.goal_behind': [
    {
      title: '“{{goal}}” tertinggal',
      message:
        'Tujuan ini butuh {{requiredAmount}} sebulan, dan Anda menyetor sekitar {{paceAmount}}. Dengan laju ini, ia tercapai {{monthsLate}} bulan terlambat.',
    },
    {
      title: '“{{goal}}”: terlambat {{monthsLate}} bulan dengan laju ini',
      message:
        'Diperlukan {{requiredAmount}} sebulan, kenyataannya sekitar {{paceAmount}}. Geser tanggalnya dengan jujur atau alihkan lebih banyak uang dengan sengaja.',
    },
    {
      title: 'Tujuan dan laju tidak sejalan',
      message:
        '“{{goal}}” meminta {{requiredAmount}} sebulan; ia mendapat {{paceAmount}}. Tujuan hanya senyata langkah bulanan menujunya.',
    },
    {
      title: '“{{goal}}” butuh langkah yang lebih mantap',
      message:
        '{{paceAmount}} sebulan dibandingkan {{requiredAmount}} yang dibutuhkan. Bayar tujuan lebih dulu bulan depan, sebelum apa pun yang opsional.',
    },
    {
      title: 'Tertinggal pada “{{goal}}”',
      message:
        'Laju saat ini ({{paceAmount}}/bulan) membuatnya {{monthsLate}} bulan terlambat. Kenaikan kecil sekarang lebih baik daripada pengorbanan besar nanti.',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: '“{{goal}}” tidak muat dalam rencana',
      message:
        'Tujuan ini butuh {{requiredAmount}} sebulan, tetapi setelah anggaran hanya {{freeAmount}} yang bebas. Ubah tanggal, target, atau anggaran — berharap bukanlah rencana.',
    },
    {
      title: '“{{goal}}” meminta lebih dari dana bebas Anda',
      message:
        '{{requiredAmount}} diperlukan setiap bulan, {{freeAmount}} tersedia. Menginginkan semuanya sekaligus adalah cara agar tak ada yang selesai; pilihlah.',
    },
    {
      title: 'Angka berkata tidak — untuk saat ini',
      message:
        '“{{goal}}” butuh {{requiredAmount}} sebulan; dana bebas Anda {{freeAmount}}. Sesuaikan apa yang dalam kuasa Anda: tenggat atau batas lainnya.',
    },
    {
      title: '“{{goal}}” butuh keputusan',
      message:
        'Dengan {{requiredAmount}} sebulan, ia melebihi {{freeAmount}} yang tersisa setelah anggaran. Tujuan yang dipilih dengan mata terbuka lebih baik daripada yang dipertahankan dengan angan-angan.',
    },
    {
      title: 'Laju yang mustahil untuk “{{goal}}”',
      message:
        'Diperlukan {{requiredAmount}} per bulan, bebas {{freeAmount}}. Hitungan jujur sekarang mencegah kekecewaan nanti.',
    },
  ],
  'stoic.shortfall': [
    {
      title: 'Saldo Anda turun di bawah nol pada {{date}}',
      message:
        'Pembayaran mendatang sebesar {{committedAmount}} membawa proyeksi saldo ke {{lowestAmount}}. Bersiaplah sekarang, selagi ini baru perkiraan.',
    },
    {
      title: 'Kekurangan dana mendekat: {{date}}',
      message:
        'Pembayaran terjadwal ({{committedAmount}}) melampaui saldo, dengan titik terendah {{lowestAmount}}. Mengantisipasi kesulitan adalah cara melucuti kekuatannya.',
    },
    {
      title: 'Rencanakan untuk {{date}}',
      message:
        'Pada hari itu proyeksi saldo mencapai {{lowestAmount}}. Geser satu pembayaran, tahan satu keinginan, atau sisihkan uang tunai — semua itu dalam kuasa Anda hari ini.',
    },
    {
      title: 'Kewajiban melebihi saldo',
      message:
        '{{committedAmount}} jatuh tempo, dan saldo turun ke {{lowestAmount}} sekitar {{date}}. Tanggapan yang tenang adalah tanggapan yang dini.',
    },
    {
      title: 'Antisipasi celah pada {{date}}',
      message:
        'Proyeksi saldo terendah: {{lowestAmount}}. Apa yang sudah diduga dapat dihadapi dengan tenang; apa yang mengejutkan, jarang.',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: 'Anda menepati janji pada diri sendiri',
      message:
        'Sudah {{months}} bulan berturut-turut pengeluaran Anda tetap dalam rencana yang Anda buat sendiri. Beginilah wujud penguasaan diri.',
    },
    {
      title: '{{months}} bulan sesuai rencana',
      message:
        'Bulan demi bulan, apa yang Anda niatkan dan apa yang Anda lakukan selaras. Konsistensi lebih sunyi daripada tekad, dan bertahan lebih lama.',
    },
    {
      title: 'Rencana dan hidup selaras',
      message:
        '{{months}} bulan berturut-turut di dalam batas Anda. Rencana yang dijaga sebaik ini bukan lagi pembatasan — itulah cara Anda hidup.',
    },
    {
      title: 'Stabil selama {{months}} bulan',
      message:
        'Anggaran Anda bertahan {{months}} bulan berturut-turut. Pertahankan perhatian yang sama; itu berhasil.',
    },
    {
      title: 'Disiplin yang bertahan',
      message:
        '{{months}} bulan tanpa melanggar rencana. Sedikit hal yang semembebaskan memercayai keputusan Anda sendiri.',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: 'Uang Anda mengikuti nilai Anda',
      message:
        'Kebajikan mengambil {{actual}}% pengeluaran — tidak kurang dari {{planned}}% yang direncanakan. Dibelanjakan dengan baik.',
    },
    {
      title: 'Kebajikan mendapat bagian penuhnya',
      message:
        '{{actual}}% untuk kesehatan, belajar, dan orang lain, dibandingkan {{planned}}% yang direncanakan. Apa yang Anda hargai, Anda bayar.',
    },
    {
      title: 'Dibelanjakan untuk menjadi lebih baik',
      message:
        'Kebajikan mencapai {{actual}}% pengeluaran bulan ini (rencana {{planned}}%). Uang itu bekerja untuk Anda lama setelah ia pergi.',
    },
    {
      title: 'Niat yang terlaksana',
      message:
        'Anda merencanakan {{planned}}% untuk kebajikan dan membelanjakan {{actual}}%. Niat baik jarang bertahan sebulan — niat Anda bertahan.',
    },
    {
      title: 'Penggunaan uang terbaik',
      message:
        '{{actual}}% pergi ke hal yang membuat Anda dan orang lain lebih baik. Teruslah memilihnya.',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: 'Hiburan pada tempatnya',
      message:
        'Hiburan {{actual}}% dari pengeluaran, di bawah {{planned}}% yang Anda izinkan. Anda menikmati banyak hal tanpa dikuasai olehnya.',
    },
    {
      title: 'Kesenangan, sesuai ukurannya',
      message:
        'Hiburan mengambil {{actual}}% dibandingkan rencana {{planned}}%. Moderasi bukan kehilangan — melainkan memilih.',
    },
    {
      title: 'Istirahat tanpa berlebihan',
      message:
        '{{actual}}% untuk hiburan, di bawah batas {{planned}}% Anda. Kesenangan terasa lebih nikmat ketika bukan ia yang memegang kendali.',
    },
    {
      title: 'Pengendalian diri, dengan tenang',
      message:
        'Anda memberi hiburan {{planned}}% dan ia hanya memakai {{actual}}%. Selisih itu adalah kebebasan yang Anda jaga.',
    },
    {
      title: 'Hiburan di bawah rencana',
      message:
        'Pada {{actual}}% pengeluaran, hiburan tetap di bawah {{planned}}% yang Anda tetapkan. Terjaga dengan baik.',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: '{{percent}}% di bawah rencana',
      message:
        'Bulan ini Anda membelanjakan {{savedAmount}} lebih sedikit dari yang Anda izinkan. Tidak membutuhkan semua yang bisa Anda miliki adalah sejenis kekayaan.',
    },
    {
      title: '{{savedAmount}} tidak terpakai',
      message:
        'Bulan ini berakhir {{percent}}% di bawah rencana. Apa yang tidak Anda belanjakan masih bisa Anda arahkan.',
    },
    {
      title: 'Kurang dari yang Anda izinkan',
      message:
        'Pengeluaran {{percent}}% di bawah rencana — {{savedAmount}} tersimpan. Beri selisih itu tujuan sebelum kebiasaan merebutnya.',
    },
    {
      title: 'Rencana masih punya ruang',
      message:
        '{{savedAmount}} di bawah batas Anda bulan ini. Pengendalian diri yang terasa mudah adalah yang bertahan.',
    },
    {
      title: 'Lebih ringan dari rencana',
      message:
        'Anda membutuhkan {{percent}}% lebih sedikit dari anggaran. Pertimbangkan mengirim {{savedAmount}} ke sebuah tujuan.',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '“{{goal}}” sesuai jadwal',
      message:
        'Anda sudah {{percent}}% menuju sana, dengan laju yang dibutuhkan tujuan ini. Langkah mantap, diambil setiap bulan, sampai jauh.',
    },
    {
      title: 'Di jalur menuju “{{goal}}”',
      message:
        '{{percent}}% selesai dan lajunya terjaga. Terus bayar tujuan lebih dulu; itu berhasil.',
    },
    {
      title: '“{{goal}}”: {{percent}}% dan stabil',
      message: 'Tujuan mendapat apa yang dibutuhkannya setiap bulan. Kesabaran sedang bekerja.',
    },
    {
      title: 'Tujuan bergerak sesuai rencana',
      message:
        '“{{goal}}” terdanai {{percent}}% dan tepat waktu. Apa yang dikerjakan sedikit demi sedikit setiap bulan tak bisa dihentikan oleh satu minggu yang buruk.',
    },
    {
      title: 'Kemajuan yang bisa dipercaya',
      message:
        '“{{goal}}” berada di {{percent}}%, sesuai laju. Anda membangunnya dengan satu-satunya cara yang berhasil — bertahap.',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: 'Lebih sedikit pembelian impulsif di {{merchant}}',
      message:
        'Dari {{before}} pembelian bulan lalu menjadi sekitar {{after}} bulan ini. Kebiasaan yang mengendur adalah kebebasan yang diraih.',
    },
    {
      title: '{{merchant}}: {{before}} → {{after}}',
      message:
        'Anda berkunjung lebih jarang dari biasanya. Setiap refleks yang dilewati adalah kemenangan kecil pilihan atas kebiasaan.',
    },
    {
      title: 'Kebiasaan kecil menyusut',
      message:
        'Pembelian di {{merchant}} turun dari {{before}} menjadi sekitar {{after}}. Teruskan — akan makin mudah.',
    },
    {
      title: 'Pilihan di atas refleks',
      message:
        'Di {{merchant}} Anda turun dari {{before}} pembelian menjadi sekitar {{after}}. Itulah penguasaan diri yang dibangun satu keputusan demi satu keputusan.',
    },
    {
      title: 'Lebih sedikit hal kecil',
      message:
        'Anda ke {{merchant}} sekitar {{after}} kali, bukan {{before}}. Kemenangan kecil berlipat ganda.',
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: 'Anda menyesuaikan diri dengan bulan yang lebih ramping',
      message:
        'Pendapatan turun {{incomePercent}}%, dan Anda memangkas pengeluaran {{expensePercent}}%. Anda menghadapi perubahan nasib dengan perubahan arah.',
    },
    {
      title: 'Tetap tenang saat pendapatan turun',
      message:
        'Pendapatan turun {{incomePercent}}%, pengeluaran turun {{expensePercent}}%. Anda menyesuaikan diri dengan yang ada, bukan yang dulu.',
    },
    {
      title: 'Nasib berubah; Anda pun berubah',
      message:
        'Penurunan pendapatan {{incomePercent}}% dijawab dengan penurunan pengeluaran {{expensePercent}}%. Itulah ketenangan batin dalam angka.',
    },
    {
      title: 'Kemudi yang baik',
      message:
        'Saat pendapatan turun {{incomePercent}}%, pengeluaran mengikuti ({{expensePercent}}% lebih sedikit). Anginnya bukan milik Anda; layarnya ya.',
    },
    {
      title: 'Pengeluaran ikut turun bersama pendapatan',
      message:
        'Anda membelanjakan {{expensePercent}}% lebih sedikit ketika pendapatan turun {{incomePercent}}%. Menyesuaikan diri lebih awal adalah jalan yang tenang.',
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: 'Kebutuhan stabil',
      message:
        'Selama {{months}} bulan biaya pokok Anda nyaris tak bergerak. Lantai yang stabil memberi Anda kebebasan di atasnya.',
    },
    {
      title: 'Kebutuhan terkendali',
      message:
        'Pengeluaran kebutuhan bertahan datar selama {{months}} bulan. Kebutuhan yang tidak tumbuh adalah kebutuhan yang Anda kendalikan.',
    },
    {
      title: '{{months}} bulan kebutuhan pokok yang stabil',
      message:
        'Sewa, makanan, dan tagihan tetap di tempatnya. Stabilitas yang tenang juga sebuah pencapaian.',
    },
    {
      title: 'Kebutuhan tidak merayap',
      message:
        '{{months}} bulan tanpa pergeseran pada apa yang dibutuhkan hidup. Segala hal lain lebih mudah direncanakan di atas pijakan itu.',
    },
    {
      title: 'Lantai yang kokoh',
      message:
        'Pengeluaran pokok stabil selama {{months}} bulan. Anda tidak membiarkan kenyamanan menyamar sebagai kebutuhan.',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: 'Murah hati dengan penghasilan Anda',
      message:
        'Selama {{months}} bulan, {{percent}}% pendapatan Anda — {{givenAmount}} — digunakan untuk membantu orang lain. Itulah uang yang dipakai sebaik-baiknya.',
    },
    {
      title: '{{givenAmount}} diberikan kepada orang lain',
      message:
        'Anda membagikan {{percent}}% pendapatan dalam {{months}} bulan. Kebaikan yang tampak dalam angka adalah kebaikan yang dijalankan, bukan hanya dirasakan.',
    },
    {
      title: 'Tangan yang terbuka',
      message:
        'Akhir-akhir ini sedekah dan hadiah mengambil {{percent}}% pendapatan Anda. Apa yang Anda berikan adalah bagian kekayaan Anda yang tak bisa diambil oleh kemalangan apa pun.',
    },
    {
      title: 'Kemurahan hati adalah bagian dari rencana Anda',
      message:
        '{{givenAmount}} untuk orang lain selama {{months}} bulan. Pertahankan — kebaikan yang Anda lakukan bagi orang lain juga kebaikan bagi diri sendiri.',
    },
    {
      title: 'Diberikan dengan baik',
      message:
        '{{percent}}% dari penghasilan Anda digunakan untuk membantu orang lain. Sedikit kebiasaan yang berbicara lebih banyak tentang seseorang.',
    },
  ],
  'stoic.praise_steady': [
    {
      title: 'Tidak ada yang perlu dikoreksi',
      message: 'Pengeluaran Anda sesuai dengan niat Anda. Teruskan seperti ini.',
    },
    {
      title: 'Niat dan tindakan selaras',
      message: 'Bulan ini terlihat seperti yang Anda rencanakan. Keselarasan itulah intinya.',
    },
    {
      title: 'Bulan yang tenang',
      message:
        'Tidak ada yang berlebihan, tidak ada kelalaian yang patut disebut. Bagus — bawa perhatian yang sama ke depan.',
    },
    {
      title: 'Semua beres',
      message:
        'Rencana Anda bertahan dan tak ada yang perlu dikoreksi. Nikmati ketenangan yang Anda raih.',
    },
    {
      title: 'Tangan yang mantap',
      message:
        'Bulan ini mengikuti rencana Anda. Kebiasaan baik membuat bulan-bulan baik tampak biasa.',
    },
  ],
  'expert.pay_yourself_first': [
    {
      title: 'Bayar diri Anda lebih dulu',
      message:
        'Aturan George S. Clason: sebagian dari semua yang Anda peroleh adalah milik Anda untuk disimpan — setidaknya sepersepuluh. Selama {{months}} bulan Anda menyimpan {{savingsPercent}}%. Sisihkan {{tenthAmount}} pada hari penghasilan masuk, sebelum hal lain.',
    },
    {
      title: 'Sepersepuluh adalah milik Anda',
      message:
        'Dalam The Richest Man in Babylon (Orang Terkaya di Babilon), obat pertama bagi dompet yang tipis adalah menyimpan satu dari setiap sepuluh keping. Tingkat tabungan Anda {{savingsPercent}}%; {{tenthAmount}} per bulan bisa memulai kebiasaan itu.',
    },
    {
      title: 'Menabung sebelum belanja, bukan sesudahnya',
      message:
        'Nasihat Clason sederhana: bayar diri Anda lebih dulu. Belakangan ini {{savingsPercent}}% penghasilan tetap bersama Anda. Sisihkan {{tenthAmount}} saat gajian, lalu biarkan pengeluaran menyesuaikan dengan sisanya.',
    },
    {
      title: 'Keping pertama milik Anda',
      message:
        'Sebagian dari semua yang Anda peroleh sebaiknya tetap bersama Anda — tidak kurang dari sepersepuluh, kata Clason. Anda menyimpan {{savingsPercent}}% selama {{months}} bulan. Mulailah dengan {{tenthAmount}} per bulan, secara otomatis.',
    },
    {
      title: '{{savingsPercent}}% tersimpan — aturannya meminta 10%',
      message:
        'Bayar diri Anda lebih dulu, seperti kata The Richest Man in Babylon: {{tenthAmount}} per bulan, disisihkan sebelum tagihan apa pun. Tabungan yang dibuat lebih dulu tidak bergantung pada sisa uang.',
    },
  ],
  'expert.rule_50_30_20': [
    {
      title: 'Cek 50/30/20 Anda',
      message:
        'Elizabeth Warren dan Amelia Warren Tyagi menyarankan 50% penghasilan bersih untuk kebutuhan wajib, 30% untuk keinginan, 20% untuk tabungan. Milik Anda: {{needsPercent}}% / {{wantsPercent}}% / {{savingsPercent}}%.',
    },
    {
      title:
        'Kebutuhan {{needsPercent}}%, keinginan {{wantsPercent}}%, tabungan {{savingsPercent}}%',
      message:
        'All Your Worth menyeimbangkan uang dengan pola 50/30/20. Bandingkan pos yang paling jauh dari targetnya dengan rencana Anda — di situlah satu perubahan paling berdampak.',
    },
    {
      title: 'Bagaimana penghasilan Anda terbagi',
      message:
        'Kebutuhan wajib mengambil {{needsPercent}}% penghasilan, keinginan {{wantsPercent}}%, dan {{savingsPercent}}% ditabung. Keseimbangan 50/30/20 dari All Your Worth adalah cermin yang berguna, bukan vonis.',
    },
    {
      title: 'Rumus uang yang seimbang',
      message:
        'Rumus Warren dan Tyagi: separuh untuk yang harus Anda bayar apa pun yang terjadi, 30% untuk keinginan, 20% untuk masa depan. Posisi Anda: {{needsPercent}}/{{wantsPercent}}/{{savingsPercent}}.',
    },
    {
      title: 'Dibandingkan dengan 50/30/20',
      message:
        'Pembagian Anda: {{needsPercent}}% kebutuhan wajib, {{wantsPercent}}% keinginan, {{savingsPercent}}% tabungan. Ujian buku itu untuk kebutuhan wajib: apakah Anda tetap membayarnya jika besok kehilangan pekerjaan?',
    },
  ],
  'expert.room_for_error': [
    {
      title: 'Sisakan ruang untuk kesalahan',
      message:
        'Nasihat Morgan Housel: rencanakan untuk hal-hal yang tidak berjalan sesuai rencana. Saldo Anda mencukupi sekitar {{cushionDays}} hari pengeluaran; patokan umum adalah tiga bulan — {{targetAmount}}.',
    },
    {
      title: 'Bantalan {{cushionDays}} hari',
      message:
        'The Psychology of Money menyebutnya ruang untuk kesalahan — kelonggaran yang membuat Anda bertahan dari kejutan. Membangun hingga {{targetAmount}}, tiga bulan pengeluaran, memberi rencana Anda peluang untuk bertahan menghadapi kenyataan.',
    },
    {
      title: 'Margin keselamatan, di rumah',
      message:
        'Housel meminjam margin keselamatan dari Graham untuk keuangan pribadi. Dengan cadangan {{cushionDays}} hari pengeluaran, satu bulan yang buruk bisa merusak rencana yang baik. Targetkan {{targetAmount}}.',
    },
    {
      title: 'Ruang untuk hal tak terduga',
      message:
        'Cadangan Anda akan bertahan kira-kira {{cushionDays}} hari. Kejutan adalah satu-satunya hal yang pasti; tiga bulan pengeluaran ({{targetAmount}}) adalah target yang banyak dipakai.',
    },
    {
      title: 'Bangun kelonggaran sebelum dibutuhkan',
      message:
        'Ruang untuk kesalahan, dalam kata-kata Morgan Housel, adalah yang membuat Anda tetap bertahan dalam permainan. Anda memiliki sekitar {{cushionDays}} hari; {{targetAmount}} akan mencukupi tiga bulan.',
    },
  ],
  'expert.lifestyle_creep': [
    {
      title: 'Pengeluaran melampaui penghasilan',
      message:
        'Pengeluaran naik {{expenseGrowth}}% selama kuartal terakhir, sementara penghasilan berubah {{incomeGrowth}}%. Aturan pertama The Millionaire Next Door: berapa pun penghasilan Anda, hiduplah di bawah kemampuan.',
    },
    {
      title: 'Hidup lebih mewah, bukan lebih kaya',
      message:
        'Stanley dan Danko menemukan bahwa kekayaan adalah apa yang Anda kumpulkan, bukan apa yang Anda belanjakan. Pengeluaran Anda tumbuh {{expenseGrowth}}%, penghasilan {{incomeGrowth}}% — di selisih itulah kekayaan bocor.',
    },
    {
      title: 'Gaya hidup merayap: +{{expenseGrowth}}%',
      message:
        'Pengeluaran naik lebih cepat daripada penghasilan ({{incomeGrowth}}%). Orang-orang dalam The Millionaire Next Door tetap kaya dengan membiarkan penghasilan naik tanpa membiarkan pengeluaran ikut naik.',
    },
    {
      title: 'Tiang gawangnya bergeser',
      message:
        'Pengeluaran naik {{expenseGrowth}}% dari kuartal ke kuartal, dibandingkan {{incomeGrowth}}% untuk penghasilan. Hiduplah di bawah kemampuan Anda, kata Stanley dan Danko — berapa pun kemampuan itu.',
    },
    {
      title: 'Kekayaan adalah yang Anda simpan',
      message:
        'Penghasilan yang baik tetapi dihabiskan seluruhnya tidak membuat siapa pun lebih kaya. Selama kuartal terakhir pengeluaran Anda tumbuh {{expenseGrowth}}% dan penghasilan {{incomeGrowth}}% — layak dicermati sebelum menjadi kebiasaan baru.',
    },
  ],
  'expert.life_energy': [
    {
      title: '{{merchant}} menghabiskan {{hours}} jam hidup Anda',
      message:
        'Vicki Robin dan Joe Dominguez menyarankan menghitung harga barang dalam energi hidup — jam kerja yang dibutuhkan untuk membayarnya. {{totalAmount}} di {{merchant}} bulan ini kira-kira {{hours}} jam. Apakah sepadan?',
    },
    {
      title: '{{hours}} jam di {{merchant}}',
      message:
        'Your Money or Your Life mengajak Anda melihat uang sebagai waktu yang Anda tukarkan untuknya. Dengan rata-rata penghasilan per jam Anda, {{totalAmount}} di sana setara dengan kira-kira {{hours}} jam kerja.',
    },
    {
      title: 'Hitung harganya dalam jam',
      message:
        '{{totalAmount}} di {{merchant}} kira-kira sama dengan {{hours}} jam kerja. Robin dan Dominguez menyebutnya energi hidup — satu-satunya mata uang yang tidak bisa Anda dapatkan kembali.',
    },
    {
      title: 'Harga sebenarnya dari {{merchant}}',
      message:
        'Uang adalah sesuatu yang kita tukar dengan energi hidup kita. Bulan ini {{merchant}} mengambil sekitar {{hours}} jam milik Anda ({{totalAmount}}). Apakah kesenangannya sebanding dengan jam-jam itu?',
    },
    {
      title: 'Cek energi hidup',
      message:
        'Dihitung dengan rata-rata penghasilan per jam Anda, {{totalAmount}} yang dibelanjakan di {{merchant}} kira-kira {{hours}} jam. Your Money or Your Life menyarankan untuk bertanya apakah pengeluaran itu membawa kepuasan yang sepadan.',
    },
  ],
};
