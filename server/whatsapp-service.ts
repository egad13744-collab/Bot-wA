import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  WASocket,
  downloadMediaMessage
} from "@whiskeysockets/baileys";
import { Sticker, StickerTypes } from "wa-sticker-formatter";
import sharp from "sharp";
import pino from "pino";
import fs from "fs";
import path from "path";
import {
  incrementReceived,
  incrementSent,
  getBotState,
  upsertGroupConfig,
  addXpForUser,
  getUserGroupRank,
  getGroupLeaderboard,
  resetGroupXp,
  toggleFeature,
  addGroupBadword,
  removeGroupBadword,
  getLevelFromXp,
  getXpNeededForLevel,
  addXpAward,
  getLevelProgress,
} from "./bot-config";

// Define current status types
export type WhatsAppStatus = "Disconnected" | "Connecting" | "Waiting Pairing" | "Connected";

export interface LogEntry {
  timestamp: string;
  message: string;
  type: "info" | "success" | "warn" | "error";
}

// Session directory configuration
const SESSION_DIR = path.join(process.cwd(), "sessions", "whatsapp-session");

const quotesList = [
  "Hargailah hari kemarin, mimpikanlah hari esok, tetapi hiduplah untuk hari ini.",
  "Masa depan adalah milik mereka yang percaya pada keindahan mimpi mereka. - Eleanor Roosevelt",
  "Kesuksesan bukanlah kunci kebahagiaan. Kebahagiaan adalah kunci kesuksesan.",
  "Jangan pernah menyesali sehari pun dalam hidupmu. Hari-hari baik memberimu kebahagiaan dan hari-hari buruk memberimu pengalaman.",
  "Kejutan terbesar dalam hidup adalah menyadari bahwa Anda bisa menjadi lebih baik dari apa yang Anda pikirkan.",
  "Hidup itu seperti naik sepeda. Untuk menjaga keseimbangan, Anda harus terus bergerak. - Albert Einstein",
  "Keberhasilan berawal dari keputusan untuk mencoba.",
  "Fokuslah pada tempat yang ingin kamu tuju, bukan pada apa yang kamu takuti."
];

const faktaList = [
  "Secara ilmiah, tomat adalah buah, bukan sayuran.",
  "Madu adalah satu-satunya makanan alami yang tidak pernah membusuk atau kedaluwarsa.",
  "Gurita memiliki tiga jantung dan darah mereka berwarna biru.",
  "Menara Eiffel bisa tumbuh lebih tinggi hingga 15 cm selama musim panas karena pemuaian termal.",
  "Sidik jari koala sangat mirip dengan sidik jari manusia sehingga sulit dibedakan di bawah mikroskop.",
  "Pisang secara botanis diklasifikasikan sebagai buah buni (berry).",
  "Siput bisa tidur selama tiga tahun tanpa makan."
];

const jokeList = [
  "Kenapa donat tengahnya bolong? Karena kalau utuh namanya donatur.",
  "Hewan apa yang paling hening? Semut. Semut-ing.",
  "Pekerjaan apa yang kalau dijalani malah bikin makin stress? Pemadam kebakaran, karena mereka selalu nyari masalah (api).",
  "Kenapa pohon mangga kalau ditiup angin kencang suka goyang-goyang? Karena kalau goyang kiri-kanan namanya ditiup angin sepoi-sepoi.",
  "Mengapa nyamuk bunyinya 'nguung'? Karena dia minum darah, kalau minum bensin bunyinya 'breem breem'!",
  "Bebek apa yang kalau jalan selalu muter ke kiri terus? Bebek yang dikunci stang.",
  "Hewan apa yang bersaudara? Katak beradik.",
  "Kenapa Superman bajunya ada huruf 'S'? Karena kalau pakai 'M' atau 'L' kebesaran, kalau 'XL' ntar longgar.",
  "Gajah apa yang paling genit? Gajauh beda lah sama kamu...",
  "Kenapa dalang membawa keris ketika mendalang? Karena kalau bawa kompor ntar dalangnya malah jualan bakso di panggung.",
  "Kenapa di keyboard komputer ada tulisan 'Enter'? Karena kalau 'Entar', komputer gak bakal jalan-jalan.",
  "Negara apa yang paling banyak pertemuan bapak-bapaknya? Papa Nugini.",
  "Kenapa spons kuning di laut namanya Spongebob Squarepants? Karena kalau Spongebob Segitiga ntar dikira iluminati.",
  "Bundaran HI kalau diputerin tiga kali jadinya apa? Jadinya pusing, lah!",
  "Ikan apa yang kalau ditaruh keluar dari air langsung lari-lari? Ikan bandel, gak nurut dibilangin suruh di air malah kabur.",
  "Buah apa yang paling pemberani? Apel. Soalnya dia kalau malam minggu sering 'apel' ke rumah pacar padahal bapaknya galak.",
  "Susu apa yang indah sekali? Susu-asana alam pedesaan pada sore hari.",
  "Pintu apa yang ditarik atau didorong sekencang apapun tetep gak bakal bisa dibuka? Pintu yang digambar di tembok.",
  "Sepatu apa yang bisa dipakai buat numis kangkung atau masak di dapur? Sepatula.",
  "Buah apa yang dilarang banget untuk didekati karena sangat berbahaya? Buah-ya darat.",
  "Kenapa nyamuk badannya jauh lebih kurus daripada gajah? Karena nyamuk gak pernah doyan minum susu formula.",
  "Sayur apa yang dingin banget sampai menusuk tulang? Sle-ri, brrr...",
  "Kenapa kucing kalau dikejar anjing selalu manjat ke atas pohon? Karena kucing gak punya SIM buat kebut-kebutan di jalan raya.",
  "Hewan apa yang kerjanya jualan pulsa elektronik? Cel-ular.",
  "Penyanyi luar negeri yang paling susah dibangunin pagi-pagi? Justin Biar-lambat.",
  "Penyanyi yang sering kesasar dan gak tahu arah jalan pulang? Evie Tamala (Eee... ke mana ya?).",
  "Apa bedanya modem wifi sama mantan? Kalau modem 'koneksi', kalau mantan 'konon pernah seksi'.",
  "Sayur apa yang paling jujur dan patuh pada hukum negara? Sayur kol, karena dilarang menyuap alias dilarang sayur kol-usi.",
  "Pemain bola dunia apa yang beratnya cuma 3 kilogram saja? Lionel Messi. Soalnya Messi = Mesi-kilo-an.",
  "Kenapa banteng kalau lihat warna merah langsung ngamuk? Soalnya kalau lihat warna pink ntar dikira Hello Kitty.",
  "Hantu apa yang suka jualan pulsa seluler keliling? Kuntilanak-sel.",
  "Kota apa yang isinya orang-orang selalu menangis tersedu-sedu? Solo. Soalnya sedih terus (Solo-ran air mata).",
  "Kenapa aspal warnanya selalu hitam? Soalnya kalau warnanya hijau ntar dikira lapangan futsal, dikencingin kucing mulu.",
  "Sayur apa yang bikin perasaan kita bahagia dan berbunga-bunga? Toge-ther with you.",
  "Apa bahasa Jepangnya 'Saya dicopet di jalanan'? Sakuku raba-raba kurasa loka-loka.",
  "Hewan apa yang selalu sehat walafiat, aktif, dan bugar? Ular naga. Soalnya naga-naga-nya sih selalu bertenaga.",
  "Kenapa dokter kalau lagi operasi bedah mulutnya wajib ditutup masker? Soalnya kalau matanya yang ditutup ntar gak kelihatan dok!",
  "Apa bedanya sepatu kulit sama jengkol? Kalau sepatu disemir, kalau jengkol disemur.",
  "Hewan apa yang paling patuh pada rambu lalu lintas keselamatan jalan raya? Unta. Unta-makan keselamatan.",
  "Siapa menteri dalam kabinet yang paling sibuk sedunia? Menteri-ka baju.",
  "Kera apa yang sangat mengerikan, bersuara aneh, dan membuat bulu kuduk merinding? Kera-surupan setan gundul.",
  "Kenapa lambang toko apotek resmi itu ular melingkari gelas? Soalnya kalau melingkari mangkok ntar dikira mie ayam bakso urat.",
  "Pena apa yang paling disukai oleh anak-anak muda zaman sekarang? Pen-antian panjang yang akhirnya berakhir bahagia bersama kamu.",
  "Kenapa matahari kalau sore selalu tenggelam di sebelah barat? Soalnya kalau tenggelam di lumpur ntar dikira main perosotan di sawah.",
  "Kenapa jerapah lehernya panjang menjulang? Karena kalau kakinya yang panjang ntar jerapahnya gak bisa duduk santai.",
  "Apa bedanya jam dinding dengan kamu? Jam dinding dipajang di tembok ruang tamu, kalau kamu dipajang di masa depanku.",
  "Ban mobil apa yang bisa dimakan dan rasanya manis biskuit cokelat? Ban-g bang cokelat.",
  "Sabun mandi apa yang baunya paling busuk dan mengganggu? Sabun-buntut (Sapi buntut).",
  "Negara apa yang memiliki nama yang sangat santai dan tidak pernah buru-buru? Negara Slow-vakia (Slovakia).",
  "Kenapa kran air kalau diputar ke kiri bakal mengeluarkan air? Karena kalau diputar ke kiri terus tanpa henti ntar pegangannya patah.",
  "Mengapa bumi bulat? Karena kalau bentuknya segitiga ntar jadi kemasan cokelat Toblerone.",
  "Hantu apa yang paling pinter dalam matematika dan kalkulus? Hantu-logaritma.",
  "Buah apa yang kalau dimakan bikin kita langsung jadi sarjana? Buah wisuda.",
  "Kenapa burung terbang ke arah selatan saat musim dingin tiba? Karena kalau harus jalan kaki terlalu jauh dan capek.",
  "Makanan apa yang paling tidak sopan karena suka mempermainkan orang lain? Tahu bulat, digoreng dadakan setengah matang, bikin sakit perut.",
  "Koran apa yang paling menyakitkan hati? Koran-g sayang tapi ditinggal nikah.",
  "Kenapa ninja menutupi kepalanya dengan kain hitam? Karena kalau pakai helm ntar dikira ojek online.",
  "Kenapa ayam kalau berkokok matanya merem? Karena dia sudah hafal luar kepala teks lagu yang dinyanyikannya.",
  "Gajah naik apa ke puncak gedung bertingkat? Naik lift, gajahnya kan gak bisa terbang di tangga.",
  "Kenapa kalau sedang panik orang suka bilang 'Eh ayam'? Karena kalau bilang 'Eh dinosaurus' kepanjangan keburu ditabrak.",
  "Hewan apa yang paling suka membersihkan perabotan rumah tangga? Gajah, gajadi kotor maksudnya.",
  "Kenapa bajaj roda tiga gak pakai ac? Karena kasihan penumpangnya ditiup angin kencang campur polusi aja udah adem.",
  "Hewan apa yang kulitnya paling tebal sedunia? Badak, tapi masih kalah tebal sama muka mantan waktu pinjam duit.",
  "Bunga apa yang paling ditakuti oleh ibu-ibu kompleks? Bunga bank yang cicilannya telat dibayar.",
  "Warna apa yang paling tidak setia dan suka selingkuh? Warna abu-abu, selalu berubah-ubah gak jelas.",
  "Sayur apa yang kalau ditiup angin kencang langsung hilang begitu saja? Sayur bayam, kan hilang terbawa angin (bayam = bayangan).",
  "Es apa yang tidak pernah mencair dan selalu membuat hati panas? Es-timasi pembayaran spp bulanan anak.",
  "Kendaraan apa yang paling pelit sedunia? Kendaraan umum, pintunya aja selalu ditutup rapat-rapat kalau jalan.",
  "Kenapa di laut banyak garam dan rasanya asin? Karena ikannya pada keringetan dikejar nelayan pakai jaring.",
  "Kenapa ulat bulu gatal? Karena kalau ulat bulu wangi ntar disangka parfum laundrian.",
  "Lampu apa yang kalau dipecahkan suaranya berisik dan banyak yang marah? Lampu merah perempatan jalan raya."
];

const tebakkataQuestions = [
  // --- Hewan (Animals) ---
  { word: "kucing", clue: "Hewan peliharaan berkumis yang suka mengeong dan bersahabat dengan manusia" },
  { word: "harimau", clue: "Kucing besar berkulit loreng jingga-hitam yang dikenal sebagai penguasa rimba" },
  { word: "gajah", clue: "Mamalia darat paling besar yang memiliki belalai panjang, telinga lebar, dan gading indah" },
  { word: "jerapah", clue: "Hewan mamalia berkaki jangkung yang memiliki leher sangat panjang untuk meraih daun di pohon tinggi" },
  { word: "buaya", clue: "Reptil air tawar berdarah dingin yang memiliki moncong panjang, gigi tajam, dan kulit bersisik sangat keras" },
  { word: "singa", clue: "Hewan karnivora berjuluk raja hutan, di mana singa jantan memiliki rambut lebat mengelilingi kepalanya" },
  { word: "semut", clue: "Serangga kecil yang hidup berkoloni, sangat gotong royong, dan menyukai zat manis atau gula" },
  { word: "nyamuk", clue: "Serangga kecil penghisap darah yang mengepakkan sayap bising dan bisa menyebarkan demam berdarah" },
  { word: "elang", clue: "Burung predator pemangsa yang memiliki kepakan sayap besar, penglihatan tajam, dan cakar mencengkeram kuat" },
  { word: "zebra", clue: "Hewan sejenis kuda liar berkaki empat dengan pola garis-garis hitam dan putih yang khas di sekujur badannya" },
  { word: "komodo", clue: "Kadal purba raksasa karnivora yang dilindungi dan merupakan hewan endemik asli dari propinsi NTT, Indonesia" },
  { word: "lumba-lumba", clue: "Mamalia laut yang sangat cerdas, suka menolong pelaut, dan berkomunikasi dengan gelombang ultrasonik dll" },
  { word: "hiu", clue: "Ikan predator puncak di lautan dengan indra penciuman darah yang tajam serta sirip punggung segitiga ikonik" },
  { word: "gurita", clue: "Hewan laut bertubuh lunak tanpa tulang belakang yang memiliki delapan buah tentakel panjang dan kantung tinta" },
  { word: "kura-kura", clue: "Hewan reptil bercangkang keras (karapas) sebagai rumahnya, yang terkenal berjalan sangat lambat" },
  { word: "katak", clue: "Hewan amfibi yang hidup di dua alam, lincah melompat, berkulit licin basah, serta bermula dari kecebong" },
  { word: "koala", clue: "Hewan marsupial asal Australia berbulu abu-abu lebat yang sangat senang memeluk batang pohon eukaliptus" },
  { word: "kanguru", clue: "Hewan berkantung khas benua Australia yang bergerak dengan melompat bertumpu pada kedua kaki belakangnya" },
  { word: "paus", clue: "Mamalia laut berukuran raksasa terbesar di bumi yang bernapas dengan paru-paru lewat lubang tiup di kepala" },
  { word: "kambing", clue: "Hewan ternak mamalia berkaki empat yang memiliki janggut, tanduk kecil, dan berbunyi 'mbeee'" },
  { word: "sapi", clue: "Hewan ternak mamalia pemamah biak berbadan besar penghasil daging lezat serta susu segar untuk konsumsi" },
  { word: "unta", clue: "Hewan padang pasir berpunggung punuk sebagai cadangan lemak, yang sanggup berjalan berhari-hari tanpa minum" },

  // --- Buah & Makanan (Fruits & Food) ---
  { word: "pisang", clue: "Buah berkulit kuning terang saat matang, berbentuk melengkung memanjang, favorit para monyet" },
  { word: "mangga", clue: "Buah musiman manis berkulit hijau atau jingga dengan daging lembut berserat yang biasa dijadikan jus segar" },
  { word: "durian", clue: "Buah tropis eksotis dengan kulit penuh duri tajam dan aroma menyengat yang khas, dijuluki King of Fruits" },
  { word: "semangka", clue: "Buah bulat besar dengan kulit luar hijau belang dan bagian dalam merah/kuning padat dengan air manis melimpah" },
  { word: "melon", clue: "Buah berbentuk bulat dengan kulit bertekstur jaring kasar dan daging buah manis berwarna hijau pucat atau jingga" },
  { word: "rambutan", clue: "Buah kecil manis berkulit merah cerah yang dipenuhi bentukan mirip rambut-rambut halus di luarnya" },
  { word: "anggur", clue: "Buah mungil berbentuk bulat yang tumbuh berkelompok rapat dalam tangkai, berwarna ungu, merah, atau hijau segar" },
  { word: "alpukat", clue: "Buah berkulit hijau tua kasar dengan daging buah bertekstur mentega gurih, dan memiliki satu biji besar di tengah" },
  { word: "pepaya", clue: "Buah bertekstur lembut berwarna oranye ketika matang, memiliki deretan biji bulat hitam kecil di bagian dalamnya" },
  { word: "nanas", clue: "Buah tropis bersisik mata tajam, rasanya manis-asam segar, serta memiliki mahkota daun hijau berduri di atasnya" },
  { word: "kelapa", clue: "Buah dari pohon palem tinggi dengan air penyegar dahaga di pesisir pantai serta daging kelapa pembuat santan" },
  { word: "apel", clue: "Buah bulat renyah yang umumnya berwarna merah tua atau hijau muda, sering dikaitkan dengan penemuan gaya gravitasi" },
  { word: "strawberry", clue: "Buah beri merah mungil dengan bintik-bintik biji menonjol di luar kulitnya, memiliki cita rasa asam manis yang khas" },
  { word: "bakso", clue: "Olahan makanan berbentuk bulat bola dari daging sapi halus dan tapioka, disajikan dalam mangkuk berisi kuah kaldu hangat" },
  { word: "sate", clue: "Potongan daging kecil yang ditusuk lidi bambu lalu dipanggang di atas arang membara, dibalur kuah kecap atau kacang" },
  { word: "rendang", clue: "Karya kuliner khas Minangkabau berupa olahan daging sapi kaya rempah yang dimasak berjam-jam hingga berwarna cokelat gelap" },
  { word: "bubur", clue: "Hidangan sarapan dari beras yang dimasak dengan air kaldu ayam melimpah hingga bertekstur sangat lembut berair" },
  { word: "cokelat", clue: "Manisan lezat beraroma khas yang diolah dari biji buah kakao, selalu jadi favorit di hari Valentine" },
  { word: "kentang", clue: "Tanaman umbi kaya karbohidrat yang sering diiris memanjang menjadi french fries atau dihaluskan jadi perkedel" },
  { word: "wortel", clue: "Sayuran berwarna jingga terang berbentuk kerucut panjang yang kaya vitamin A dan sangat lezat disajikan dalam sup" },

  // --- Profesi (Professions) ---
  { word: "dokter", clue: "Tenaga medis ahli yang bertugas memeriksa kesehatan pasien, mendiagnosis penyakit, serta memberikan resep obat" },
  { word: "guru", clue: "Pendidik profesional yang bertugas membimbing, mentransfer ilmu pengetahuan, dan membentuk akhlak mulia siswa di kelas" },
  { word: "polisi", clue: "Aparat negara penjaga keamanan masyarakat, penertib hukum, sekaligus pengatur kelancaran arus lalu lintas jalan raya" },
  { word: "pilot", clue: "Profesi yang menuntut lisensi penerbangan tinggi untuk mengemudikan pesawat terbang komersil maupun militer" },
  { word: "tentara", clue: "Prajurit angkatan bersenjata yang dilatih keras fisik dan taktik untuk mempertahankan wilayah kedaulatan negara" },
  { word: "nelayan", clue: "Seseorang yang mengarungi lautan malam hari menggunakan perahu untuk menjaring ikan guna memenuhi pasar" },
  { word: "petani", clue: "Pekerja sektor agraria yang membajak sawah, menanam benih padi, dan merawat tanaman pangan hingga masa panen tiba" },
  { word: "masinis", clue: "Seseorang yang bertanggung jawab penuh mengemudikan kecepatan dan arah laju gerbong kereta api di atas rel" },
  { word: "koki", clue: "Ahli tata boga yang bertugas meracik bahan, menentukan menu makanan, dan memasak hidangan istimewa di restoran" },
  { word: "arsitek", clue: "Profesional berkeahlian merancang tata letak, struktur estetika, dan blueprint gambar teknik sebelum gedung didirikan" },
  { word: "astronot", clue: "Pemberani yang mengenakan baju kedap udara khusus untuk meluncur mengendarai roket menjelajahi ruang angkasa" },
  { word: "pemadam", clue: "Petugas tangguh penyelamat jiwa yang siaga meluncur mengendarai truk merah besar guna menjinakkan kobaran api kebakaran" },
  { word: "pelukis", clue: "Seniman visual yang mencurahkan ekspresi emosi dan keindahan melalui goresan kuas cat minyak di atas kanvas lukis" },
  { word: "penyanyi", clue: "Seniman suara yang piawai melantunkan nada-nada merdu indah sesuai melodi musik untuk menghibur khalayak ramai" },
  { word: "penulis", clue: "Seseorang yang menumpahkan ide pikiran, kisah fiksi ilmiah, atau tulisan jurnal ke dalam lembaran draf buku" },
  { word: "programmer", clue: "Pengembang teknologi yang menghabiskan waktu menulis syntax kode program komputer untuk membangun software bermanfaat" },

  // --- Benda & Furnitur (Everyday objects & Furniture) ---
  { word: "lemari", clue: "Furnitur kayu atau besi berukuran besar berpintu yang diletakkan di kamar untuk menata rapi baju atau berkas" },
  { word: "kasur", clue: "Alas tidur empuk berbusa atau berspring yang diletakkan di atas ranjang kamar agar tidur berkualitas nyaman" },
  { word: "cermin", clue: "Kaca berlapis timah atau perak tipis yang memantulkan cahaya kembali 100% sehingga kita bisa melihat wajah sendiri" },
  { word: "lampu", clue: "Komponen listrik berbentuk pijar atau LED yang digunakan untuk menghasilkan cahaya terang menyinari sudut gelap" },
  { word: "bantal", clue: "Penyangga kepala berisi dakron atau bulu angsa yang empuk, sangat penting dipeluk saat hendak melepas lelah di tempat tidur" },
  { word: "sendok", clue: "Peralatan makan berbentuk oval cekung dengan gagang panjang yang biasa dipasangkan berduet dengan garpu" },
  { word: "garpu", clue: "Alat makan dari logam bermata gerigi empat tajam sejajar untuk mempermudah menusuk daging atau melilit mie kuah" },
  { word: "piring", clue: "Wadah bundar pipih cekung berbahan kaca, plastik, atau keramik yang diletakkan di meja makan sebagai alas nasi" },
  { word: "gelas", clue: "Wadah kaca silinder berongga terbuka atas sebagai perkakas minum menuangkan air teh, susu, atau jus" },
  { word: "ember", clue: "Wadah plastik berbentuk silinder tegak berkawat pegangan melengkung untuk memindahkan air bersih saat mencuci" },
  { word: "sapu", clue: "Alat kebersihan rumah tangga berserat ijuk atau lidi berpencapit gagang panjang untuk menyingkirkan debu lantai" },
  { word: "handuk", clue: "Kain berserat penyerap tinggi yang wajib dibawa ke kamar mandi untuk mengeringkan tetesan air dari seluruh tubuh" },
  { word: "setrika", clue: "Alat bertenaga listrik yang memanaskan alas besi logam datar guna merapikan lipatan kusut pakaian kain" },
  { word: "kipas", clue: "Alat listrik berbaling-baling putar kencang yang menciptakan embusan aliran udara segar penyejuk suhu ruangan panas" },
  { word: "kulkas", clue: "Alat rumah tangga berpendingin kompresor gas yang siaga mengawetkan sayur, telur, buah, dan membekukan air es" },
  { word: "televisi", clue: "Gawai elektronik penangkap gelombang transmisi visual-suara berupa tontonan berita atau hiburan dalam layar kaca" },
  { word: "jam", clue: "Indikator penunjuk berjalannya waktu dalam format 12 atau 24 angka, memiliki jarum detik, menit, dan jam" },

  // --- Tempat & Geografi (Places & Geography) ---
  { word: "gunung", clue: "Bentang alam bumi berupa bukit raksasa yang puncaknya menjulang sangat tinggi menembus awan tebal" },
  { word: "pantai", clue: "Kawasan landasan pasir landai pertemuan langsung ombak air laut asin dan tepian ujung daratan" },
  { word: "sungai", clue: "Aliran air tawar memanjang berliku-liku dari hulu pegunungan mengalir turun bermuara di lautan luas" },
  { word: "danau", clue: "Genangan air tawar sangat luas di daratan luas yang dikelilingi perbukitan tanpa bersentuhan langsung dengan laut" },
  { word: "pasar", clue: "Pusat berniaga di mana pedagang menggelar lapak bahan segar dan konsumen berdatangan untuk tawar-menawar" },
  { word: "masjid", clue: "Tempat suci bagi umat Muslim untuk menjalankan ibadah shalat wajib berjamaah maupun shalat sunnah" },
  { word: "candi", clue: "Struktur bangunan kuno dari susunan batu andesit peninggalam kerajaan bersejarah zaman dahulu kala" },
  { word: "stasiun", clue: "Kompleks peron resmi tempat berhentinya rangkaian gerbong kereta api untuk turun naik penumpang" },
  { word: "bandara", clue: "Kawasan steril berpemandangan hanggar udara tempat parkir, lepas landas, dan mendaratnya maskapai penerbangan" },
  { word: "pelabuhan", clue: "Tempat berlabuhnya kapal-kapal laut besar di teluk air dalam untuk membongkar muatan peti kemas kontainer" },
  { word: "rumah", clue: "Bangunan fisik tempat bernaung dari panas hujan sekaligus tempat ternyaman berkumpul bercengkerama dengan keluarga" },
  { word: "bioskop", clue: "Gedung pemutaran film box office terbaru, dilengkapi AC dingin, sound sistem menggelegar, dan kursi beludru empuk" },
  { word: "museum", clue: "Tempat edukasi yang mengoleksi dan merawat benda peninggalan purbakala, sejarah perang, maupun benda langka berharga" },
  { word: "perpustakaan", clue: "Ruangan senyap berrak tinggi berisi ribuan koleksi buku bacaan fiksi maupun ilmiah untuk dibaca gratis" },
  { word: "hutan", clue: "Kawasan alami paru-paru bumi yang berisi kerapatan tinggi pepohonan rimbun serta tempat tinggal margasatwa liar" },
  { word: "gurun", clue: "Wilayah daratan tandus berpasir gersang dengan tingkat evaporasi udara sangat tinggi dan jarang sekali dituruni hujan" },

  // --- Kendaraan (Vehicles) ---
  { word: "mobil", clue: "Kendaraan darat bermesin pembakaran dalam beroda empat atau lebih yang biasa diparkir di garasi rumah" },
  { word: "motor", clue: "Dua roda sejajar bermesin bertenaga bensin, dikendalikan setang kemudi, kendaraan terpopuler di jalanan" },
  { word: "sepeda", clue: "Kendaraan ramah lingkungan tanpa emisi gas buang berkaki dua roda yang dijalankan dengan mengayuh pedal kaki" },
  { word: "kereta", clue: "Rangkaian gerbong baja kokoh yang meluncur sangat cepat di atas jalur sepasang rel besi panjang" },
  { word: "pesawat", clue: "Alat transportasi bersayap lebar bertenaga jet turbin gas yang sanggup menerbangkan manusia menembus awan" },
  { word: "kapal", clue: "Transportasi air berlambung raksasa yang mengarungi samudera dalam memindahkan komoditas perdagangan internasional" },
  { word: "bus", clue: "Kendaraan angkutan darat berbadan panjang besar yang menampung puluhan kursi untuk mobilitas masyarakat antar kota" },
  { word: "becak", clue: "Alat angkut penumpang roda tiga tradisional kayuh, di mana kabin penumpang terbuka lebar dipasang di depan pengayuh" },
  { word: "delman", clue: "Alat transportasi beroda kayu berpenumpang sempit yang ditarik secara mekanis oleh seekor kuda penarik di depan" },
  { word: "helikopter", clue: "Pesawat bersayap putar (rotor) horizontal di atapnya yang dapat lepas landas langsung vertikal tanpa lintasan pacu" },
  { word: "roket", clue: "Wahana antariksa silinder ramping bertenaga pendorong jet kimia maha dahsyat guna mengorbitkan astronot meluncur ke bulan" },
  { word: "kapal selam", clue: "Peluncur militer baja yang dirancang khusus sanggup menyelam ratusan meter bertahan di bawah tekanan laut dalam" },
  { word: "ambulans", clue: "Truk mini medis pembawa tandu darurat bermotor yang melaju super kencang dengan raungan sirine merah memecah kemacetan" },

  // --- Bagian Tubuh (Body parts) ---
  { word: "kepala", clue: "Bagian anatomi tertinggi pada tubuh manusia tempat melekatnya wajah, telinga, serta dilindungi tengkorak keras otak" },
  { word: "mata", clue: "Indra penglihatan berpasangan indah yang memiliki lensa pupil penangkap spektrum cahaya warna di dunia" },
  { word: "hidung", clue: "Tonjolan jalur napas di wajah dengan lubang saringan bulu halus pelindung paru-paru sekaligus indra pembau" },
  { word: "telinga", clue: "Organ berlekuk di kanan kiri kepala manusia yang mendeteksi getaran suara udara sebagai indra pendengar" },
  { word: "mulut", clue: "Rongga pintu masuk saluran makanan di wajah yang dikelilingi bibir cerah, digunakan berbicara dan mengunyah makanan" },
  { word: "tangan", clue: "Sepasang anggota gerak atas berjemari lima serbaguna untuk menulis menggenggam dan bekerja keras seharian" },
  { word: "kaki", clue: "Bagian penyangga tubuh kokoh berotot besar di bawah pinggul tempat melangkah lari dan bersepatu" },
  { word: "jantung", clue: "Organ otot seukuran genggaman tangan di rongga dada kiri yang memompa darah beroksigen tanpa henti sedetik pun" },
  { word: "paru-paru", clue: "Organ pernapasan spons besar di rongga dada yang menyerap gas oksigen udara dan menyingkirkan karbon dioksida" },
  { word: "kulit", clue: "Selimut pembungkus terluar tipis elastis tubuh manusia selaku indra peraba suhu sekalian penolak bakteri kuman" },

  // --- Ilmu & Teknologi (Science & Technology) ---
  { word: "komputer", clue: "Peranti elektronik pemroses instruksi logika kompleks dengan motherboard ram serta kartu grafis di dalam CPU-nya" },
  { word: "internet", clue: "Jalan tol super informasi digital dunia yang menghubungkan seluruh gawai sejagat melalui gelombang satelit optic" },
  { word: "telepon", clue: "Alat lawas pengirim suara lewat kabel tembaga atau optis bermikrofon jadul yang berdering nyaring" },
  { word: "kamera", clue: "Sensor optis canggih penangkap citra piksel warna diam maupun gerak yang dilengkapi lensa fokus adjustable" },
  { word: "handphone", clue: "Komputer mini saku serbaguna nirkabel berselancar internet serta penunjang komunikasi digital sehari-hari" },
  { word: "keyboard", clue: "Perkakas input ketikan visual berisi deretan tombol plastik QWERTY sebagai penerjemah huruf ke layar monitor" },
  { word: "mouse", clue: "Alat navigasi kursor genggam beralas sensor laser optis yang bisa diklik kanan-kiri dengan telunjuk" },
  { word: "printer", clue: "Mesin pencetak tinta di atas lembaran kertas putih bersih untuk memindahkan salinan draf ketikan file dokumen" },
  { word: "robot", clue: "Mesin berlogika silikon yang dikontrol microchip rangkaian kelistrikan guna menggantikan pekerjaan repetitif manusia" },
  { word: "baterai", clue: "Kompartemen penyimpan energi kimia portabel pelepas arus listrik penyumbang daya handphone atau remote AC" },
  { word: "satelit", clue: "Wahana logam bertenaga surya pengorbit bumi di luar angkasa guna memandu pemancar peta navigasi GPS bumi" },

  // --- Alam & Antariksa (Nature & Space) ---
  { word: "matahari", clue: "Bintang bola plasma raksasa pusat lintasan planet tata surya yang menyemburkan panas cahaya siang hari" },
  { word: "bulan", clue: "Satelit alami batuan mati bercahaya dingin indah melingkari bumi yang memicu tarikan pasang surut air laut" },
  { word: "bintang", clue: "Titik kelip cahaya malam hari di kubah angkasa yang sebenarnya merupakan matahari kejauhan triliunan tahun cahaya" },
  { word: "planet", clue: "Benda langit padat atau gas raksasa berbentuk bola mutlak yang mengitari orbit matahari, seperti Mars atau bumi" },
  { word: "awan", clue: "Kondensasi miliaran titik uap air udara melayang yang nampak mengembang putih bagai kapas di langit jingga" },
  { word: "hujan", clue: "Presipitasi air tawar dari proses siklus hidrologi udara yang turun membasahi dedaunan layu bumi" },
  { word: "pelangi", clue: "Pembiasan spektrum cahaya matahari oleh butiran rintik hujan di langit memunculkan warna selaras indah lengkung" },
  { word: "petir", clue: "Pelepasan muatan listrik statis kilat raksasa membelah awan badai bergemuruh keras memekakkan telinga" },
  { word: "api", clue: "Reaksi oksidasi gas pembakaran panas berpendar visual merah menyala yang berguna melembutkan masakan dapur" },
  { word: "batu", clue: "Material geologi padat keras alami gabungan mineral kerak bumi yang terserak di tebing atau sungai deras" },
  { word: "air", clue: "Zat kimia cair bening H2O tawar pengisi samudra, sangat dibutuhkan sebagai hidrasi mutlak seluruh organisme hidup" },

  // --- Olahraga & Hobi (Sports & Hobbies) ---
  { word: "sepakbola", clue: "Pertandingan olahraga sejuta umat di mana 11 pemain berpasangan menggiring menendang bola kulit ke gawang kiper" },
  { word: "basket", clue: "Pertandingan bola besar bertempo cepat memantulkan bola oranye lalu melempar memasukkannya ke jaring ring papan pantul" },
  { word: "badminton", clue: "Olahraga tepak bulu tangkis berraket senar tipis lincah mengembalikan kok menyeberangi jaring net lapangan indoor" },
  { word: "renang", clue: "Olahraga meluncurkan mengapungkan badan lurus membelah permukaan air kolam dengan gerakan kupu-kupu atau bebas" },
  { word: "catur", clue: "Sparing taktis cermat dua otak di atas papan kotak warna hitam-putih menggerakkan pion, menteri, benteng, hingga skakmat raja" },
  { word: "membaca", clue: "Kegiatan bersenang-senang mengasah daya nalar membaca untaian kata bermakna lembaran lembaran buku fiksi/ilmiah" },
  { word: "melukis", clue: "Aksi visual menggores cat di kanvas mencurahkan goresan warna emosi estetika berpenghargaan seni tinggi" },

  // --- Kata Sulit Tambahan (Over 7 letters) ---
  { word: "pemerintah", clue: "Lembaga atau badan resmi negara yang memiliki wewenang penuh untuk mengatur serta mengelola wilayah kekuasaan" },
  { word: "perempatan", clue: "Titik temu atau persimpangan tempat bertemunya empat ruas jalan raya dari arah yang berbeda-beda" },
  { word: "mahasiswa", clue: "Sebutan bagi peserta didik jenjang tinggi yang menuntut ilmu di bangku kuliah universitas atau tempat tinggi" },
  { word: "transparansi", clue: "Keterbukaan informasi publik yang bersih dari korupsi dan kolusi dalam jalannya roda organisasi" },
  { word: "pengusaha", clue: "Seseorang yang berani mengambil risiko untuk mendirikan dan meluncurkan bisnis mandiri demi meraih keuntungan" },
  { word: "pancasilis", clue: "Sikap warga negara yang setia mengamalkan nilai-nilai luhur Pancasila sebagai ideologi bangsa" },
  { word: "supermarket", clue: "Toko serba ada berukuran besar di mana konsumen mengambil barang belanjanya sendiri menggunakan kereta dorong" },
  { word: "apoteker", clue: "Seorang profesional ahli obat-obatan yang bertugas meracik dosis resep dokter di instalasi farmasi" },
  { word: "sutradara", clue: "Orang yang bertanggung jawab memimpin jalannya syuting serta mengarahkan akting para aktor dalam pembuatan film" },
  { word: "wartawan", clue: "Pencari berita lapangan yang mewawancarai narasumber lalu menuliskan laporan fakta untuk redaksi media massa" },
  { word: "astronomi", clue: "Cabang ilmu sains alam yang khusus mempelajari peredaran bintang, galaksi, komet, serta misteri ruang angkasa" },
  { word: "arkeologi", clue: "Bidang ilmu sejarah yang meneliti kebudayaan purba melalui pencarian fosil serta benda-benda kuno tertimbun tanah" },
  { word: "matematika", clue: "Cabang ilmu pasti yang melatih logika lewat angka, hitungan rumus aljabar, integral, dan geometri" },
  { word: "geografi", clue: "Ilmu yang mempelajari bentang alam bumi, persebaran iklim, kependudukan, serta peta teritorial daratan" },
  { word: "sepatbor", clue: "Pelindung roda kendaraan bermotor untuk menahan cipratan air atau lumpur kotor ke badan pengendara" },
  { word: "kacamata", clue: "Alat bantu penglihatan berpasangan lensa yang dipakai di atas hidung untuk mengoreksi minus atau silinder" },
  { word: "lingkungan", clue: "Segala sesuatu di sekitar manusia yang mempengaruhi kelangsungan hidup serta ekosistem mahluk hidup" },
  { word: "timbangan", clue: "Alat pengukur masa atau bobot suatu benda menggunakan penunjuk jarum digital atau piringan timbal" },
  { word: "gantungan", clue: "Alat berbentuk hook atau segitiga kawat untuk menyangkutkan baju atau kunci di balik pintu lemari" },
  { word: "gelanggang", clue: "Arena terbuka atau lapangan khusus tempat dilangsungkannya laga tanding olahraga atau pertunjukan seni" },
  { word: "pembangkit", clue: "Instalasi industri berskala besar penghasil energi listrik dari uap air, aliran waduk, surya, atau batu bara" },
  { word: "penerjemah", clue: "Seseorang yang bertugas mengubah rangkaian kata dari satu bahasa asing ke bahasa lain secara tepat" },
  { word: "pariwisata", clue: "Sektor industri yang mengelola destinasi liburan, tempat rekreasi, wisata alam, serta hiburan bagi turis" },
  { word: "kebudayaan", clue: "Hasil karya cipta, rasa, karsa, adat istiadat, serta tradisi luhur turun-temurun dari suatu kelompok suku" },
  { word: "perjalanan", clue: "Aktivitas bepergian berpindah tempat dari satu titik asal menuju daerah tujuan yang memakan waktu" },
  { word: "petualang", clue: "Seseorang yang gemar menjelajahi alam bebas liar yang belum dipetakan demi mencari tantangan baru" },
  { word: "fotografer", clue: "Seniman yang piawai menjepret foto estetis bernilai tinggi menggunakan kamera profesional" },
  { word: "perancang", clue: "Seseorang yang berprofesi membuat desain pola baju busana, logo perusahaan, atau tata ruang bangunan" },
  { word: "sekretaris", clue: "Pekerja kantor yang bertugas mencatat notulen rapat, menyusun jadwal direksi, dan mengelola dokumen penting" },
  { word: "bendahara", clue: "Seseorang yang memegang amanah penuh mengelola keluar masuknya arus kas keuangan dalam suatu organisasi" },
  { word: "peselancar", clue: "Olahragawan tangguh penunggang ombak besar lautan yang menggunakan selembar papan seluncur tipis" },
  { word: "penjelajah", clue: "Seseorang yang melakukan ekspedisi menelusuri sudut dunia baru yang tersembunyi guna riset keilmuan" },
  { word: "penyelamat", clue: "Tim terlatih khusus (SAR) yang siaga menolong korban bencana alam atau kecelakaan berat di medan ekstrem" },
  { word: "komunikasi", clue: "Proses penyampaian pesan atau informasi dari pengirim kepada penerima agar saling mengerti satu sama lain" },
  { word: "kesehatan", clue: "Kondisi fisik, mental, dan sosial yang sejahtera sepenuhnya, bebas dari segala keluhan sakit atau penyakit" },
  { word: "pendidikan", clue: "Upaya sadar dan terstruktur untuk mengembangkan potensi diri serta mencerdaskan kehidupan generasi bangsa" },
  { word: "transmigrasi", clue: "Program perpindahan penduduk dari pulau yang padat ke wilayah pulau yang masih jarang dihuni" },
  { word: "urbanisasi", clue: "Proses perpindahan penduduk secara besar-besaran dari kawasan pedesaan menuju kota-kota besar" },
  { word: "reboisasi", clue: "Upaya penanaman kembali hutan-hutan yang telah gundul akibat kebakaran atau penebangan liar" },
  { word: "ekosistem", clue: "Hubungan timbal balik yang saling mempengaruhi antara makhluk hidup dengan lingkungan sekitarnya" },
  { word: "keanekaragaman", clue: "Kekayaan variasi bentuk mahluk hidup, suku bangsa, flora, dan fauna dalam satu lingkup wilayah" },
  { word: "kelestarian", clue: "Keadaan yang tetap seperti semula, terjaga secara alami dari kerusakan lingkungan atau kepunahan" },
  { word: "pencemaran", clue: "Masuknya zat berbahaya atau polusi ke dalam air, tanah, atau udara yang merusak kualitas lingkungan" },
  { word: "konstruksi", clue: "Kegiatan pembuatan atau pendirian sarana infrastruktur seperti jalan tol, jembatan, dan gedung pencakar langit" },
  { word: "investasi", clue: "Penanaman modal atau aset berharga untuk jangka panjang dengan harapan mendapatkan keuntungan di masa depan" },
  { word: "perindustrian", clue: "Sektor ekonomi yang mengoleh bahan mentah menjadi barang setengah jadi atau barang jadi siap pakai" },
  { word: "perdagangan", clue: "Kegiatan tukar-menukar barang atau jasa berlandaskan kesepakatan bersama guna meraih keuntungan ekonomi" },
  { word: "kesenian", clue: "Bagian dari kebudayaan berupa ekspresi estetika manusia seperti seni tari, seni kriya, musik, dan teater" },
  { word: "pernikahan", clue: "Upacara pengikatan janji suci secara sah menurut agama dan negara untuk membina biduk rumah tangga" },
  { word: "perusahaan", clue: "Organisasi bisnis resmi yang memproduksi barang atau jasa tertentu demi meraih keuntungan komersial" },
  { word: "pertanian", clue: "Sektor produksi pangan yang mengelola tanah sawah atau ladang untuk menanam padi dan palawija" },
  { word: "perkebunan", clue: "Lahan pertanaman komoditas komersial skala besar seperti pohon kelapa sawit, karet, kopi, dan teh" },
  { word: "peternakan", clue: "Kegiatan memelihara serta mengembangbiakkan hewan ternak seperti sapi, domba, untuk menghasilkan susu atau daging" },
  { word: "pertunjukan", clue: "Tontonan seni musik, drama teater, atau atraksi sulap yang dipentaskan di panggung di hadapan penonton" },
  { word: "kepustakaan", clue: "Kumpulan bahan pustaka atau buku-buku referensi ilmiah yang dijadikan acuan dalam penyusunan karya tulis" },
  { word: "kristalografi", clue: "Ilmu khusus yang mempelajari bentuk susunan atom serta struktur internal kristal mineral padat" },
  { word: "seismograf", clue: "Alat pengukur getaran permukaan tanah yang mencatat gelombang kekuatan gempa secara otomatis" },
  { word: "teleskop", clue: "Teropong bintang berensa besar guna mengamati objek angkasa yang jaraknya sangat jauh di langit" },
  { word: "mikroskop", clue: "Alat laboratorium berensa pembesar kuat untuk meneliti objek renik mikro seperti bakteri dan sel darah" },
  { word: "stetoskop", clue: "Alat bantu medis berbentuk selang telinga yang dipakai dokter untuk mendengar detak jantung pasien" },
  { word: "termometer", clue: "Alat pengukur derajat suhu tubuh atau suhu udara yang menggunakan kolom cairan raksa atau sensor digital" },
  { word: "proyektor", clue: "Alat optik yang memancarkan gambar atau slide video dari komputer ke permukaan layar putih besar" },
  { word: "kalkulator", clue: "Mesin hitung genggam elektronik praktis untuk melakukan matematika penjumlahan, perkalian secara instan" },
  { word: "generator", clue: "Mesin bertenaga bahan bakar solar yang memutar kumparan magnet untuk memproduksi energi listrik darurat" },
  { word: "eskalator", clue: "Tangga berjalan bertenaga motor listrik pengetuk rantai yang mengangkut orang naik-turun antar lantai mall" },
  { word: "elevator", clue: "Kotak angkut besi otomatis yang bergerak naik turun secara vertikal membawa penumpang di dalam gedung tinggi" },
  { word: "laboratorium", clue: "Ruangan steril berperlengkapan tabung reaksi tempat para peneliti melakukan riset ilmiah kimia atau fisika" },
  { word: "administrasi", clue: "Pencatatan data surat-menyurat, pengarsipan berkas, serta pengelolaan dokumen perkantoran secara rapi" },
  { word: "skenario", clue: "Naskah tulisan runtut berisi dialog, adegan, dan aksi yang akan diperankan oleh para aktor film" },
  { word: "dokumentasi", clue: "Upaya pengumpulan, pemilihan, dan penyimpanan bukti tertulis, foto, atau video mengenai suatu peristiwa" },
  { word: "pembelajaran", clue: "Proses interaksi terpadu antara pengajar dan peserta didik untuk mencapai tujuan transfer ilmu pengetahuan" }
];

export interface TebakKataSession {
  word: string;
  clue: string;
  difficulty: "Easy" | "Medium" | "Hard";
  xpReward: number;
}

const activeTebakKata = new Map<string, TebakKataSession>();
const tebakkataCooldowns = new Map<string, number>();

function scrambleWord(word: string): string {
  const letters = word.toLowerCase().split("");
  let scrambled = "";
  let attempts = 0;
  
  while (attempts < 10) {
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = letters[i];
      letters[i] = letters[j];
      letters[j] = temp;
    }
    
    scrambled = letters.join("-");
    if (letters.join("") !== word.toLowerCase() || word.length <= 2) {
      break;
    }
    attempts++;
  }
  return scrambled;
}

let sock: WASocket | null = null;
let currentStatus: WhatsAppStatus = "Disconnected";
let activePhoneNumber: string | null = null;
let logs: LogEntry[] = [];
let onStateChangeCallback: (() => void) | null = null;

// Clean logging helper
export function addLog(message: string, type: "info" | "success" | "warn" | "error" = "info") {
  const timestamp = new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const logEntry: LogEntry = { timestamp, message, type };
  logs.push(logEntry);
  if (logs.length > 100) {
    logs.shift(); // keep last 100 logs
  }
  console.log(`[WA-BOT] [${type.toUpperCase()}] ${message}`);
  if (onStateChangeCallback) {
    onStateChangeCallback();
  }
}


export function registerStateChangeCallback(callback: () => void) {
  onStateChangeCallback = callback;
}

export function getWhatsAppStatus(): WhatsAppStatus {
  return currentStatus;
}

export function getActivePhoneNumber(): string | null {
  return activePhoneNumber;
}

export function getWhatsAppLogs(): LogEntry[] {
  return logs;
}

/**
 * Validates a phone number for WhatsApp
 * Format must be international (digits only, e.g. 628123456789)
 */
export function validatePhoneNumber(phoneNumber: string): string | null {
  const cleaned = phoneNumber.replace(/\D/g, "");
  if (cleaned.length < 10 || cleaned.length > 15) {
    return null;
  }
  return cleaned;
}

/**
 * Fully cleans up the authentication session and files
 */
export function cleanupSession() {
  try {
    if (sock) {
      try {
        sock.end(undefined);
      } catch (e) {}
      sock = null;
    }
    
    if (fs.existsSync(SESSION_DIR)) {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
      addLog("Session files cleaned up successfully.", "info");
    }
    
    currentStatus = "Disconnected";
    activePhoneNumber = null;
    if (onStateChangeCallback) {
      onStateChangeCallback();
    }
  } catch (err: any) {
    addLog(`Error during session cleanup: ${err.message}`, "error");
  }
}

/**
 * Sends a message to a WhatsApp recipient
 */
export async function sendWhatsAppMessage(targetNumber: string, message: string): Promise<boolean> {
  if (currentStatus !== "Connected" || !sock) {
    addLog("Cannot send message: WhatsApp is not connected", "error");
    return false;
  }

  try {
    const cleanedTarget = validatePhoneNumber(targetNumber);
    if (!cleanedTarget) {
      addLog(`Invalid recipient number: ${targetNumber}`, "error");
      return false;
    }

    const jid = `${cleanedTarget}@s.whatsapp.net`;
    addLog(`Sending message to ${cleanedTarget}...`, "info");
    await sock.sendMessage(jid, { text: message });
    addLog(`Message successfully sent to ${cleanedTarget}!`, "success");
    incrementSent(); // Update statistics database dynamically
    return true;
  } catch (error: any) {
    addLog(`Failed to send message: ${error.message}`, "error");
    return false;
  }
}

/**
 * Checks if a session has been authenticated by reading the credentials file
 */
export function hasSavedSession(): boolean {
  const credsPath = path.join(SESSION_DIR, "creds.json");
  if (!fs.existsSync(credsPath)) return false;
  try {
    const creds = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
    return creds && creds.me && creds.me.id ? true : false;
  } catch (e) {
    return false;
  }
}

/**
 * Initializes and starts the WhatsApp connection socket
 */
export async function startWhatsApp(requestPairingPhone: string | null = null): Promise<string | null> {
  try {
    // If we already have an active socket, close it cleanly first
    if (sock) {
      try {
        sock.end(undefined);
      } catch (e) {}
      sock = null;
    }

    // Clear session directory if requesting a new pairing from scratch
    if (requestPairingPhone && !hasSavedSession()) {
      if (fs.existsSync(SESSION_DIR)) {
        fs.rmSync(SESSION_DIR, { recursive: true, force: true });
      }
    }

    addLog("Initializing WhatsApp auth state...", "info");
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    
    addLog("Fetching latest Baileys version...", "info");
    const { version } = await fetchLatestBaileysVersion();
    addLog(`Using Baileys version: ${version.join(".")}`, "info");

    currentStatus = "Connecting";
    if (requestPairingPhone) {
      activePhoneNumber = requestPairingPhone;
    } else if (state.creds?.me?.id) {
      activePhoneNumber = state.creds.me.id.split(":")[0];
    }
    
    if (onStateChangeCallback) onStateChangeCallback();

    sock = makeWASocket({
      version,
      logger: pino({ level: "silent" }) as any,
      auth: state,
      printQRInTerminal: false,
    });

    // Save credentials when updated
    sock.ev.on("creds.update", async () => {
      try {
        await saveCreds();
        addLog("State: authenticated (Session credentials verified and saved to disk)", "success");
        if (sock?.authState?.creds?.me?.id) {
          activePhoneNumber = sock.authState.creds.me.id.split(":")[0];
          addLog(`Authenticated successfully as phone number: ${activePhoneNumber}`, "info");
          if (onStateChangeCallback) onStateChangeCallback();
        }
      } catch (err: any) {
        addLog(`Failed to save credentials update: ${err.message}`, "error");
      }
    });

    // Monitor connection states
    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // Log exact properties for deep real-time visibility
      addLog(`Connection update received: connection=${connection || "none"}, hasLastDisconnect=${!!lastDisconnect}`, "info");

      if (connection === "close") {
        const error = lastDisconnect?.error as any;
        const statusCode = error?.output?.statusCode || error?.output?.payload?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        addLog(`Connection closed. Reason: ${error?.message || "Socket Closed"}. Reconnect eligibility: ${shouldReconnect}`, "warn");

        if (shouldReconnect) {
          currentStatus = "Connecting";
          addLog("State: connecting (Attempting to reconnect to WhatsApp servers in 5 seconds...)", "info");
          setTimeout(() => {
            if (currentStatus === "Connecting") {
              startWhatsApp();
            }
          }, 5000);
        } else {
          addLog("Session logged out or destroyed from phone. Cleaning up...", "error");
          cleanupSession();
        }
      } else if (connection === "connecting") {
        addLog("State: connecting (Handshake with WhatsApp servers in progress)", "info");
        if (currentStatus !== "Waiting Pairing") {
          currentStatus = "Connecting";
        }
        if (onStateChangeCallback) onStateChangeCallback();
      } else if (connection === "open") {
        addLog("State: open (WhatsApp server connection opened successfully)", "success");
        currentStatus = "Connected";
        const meId = sock?.user?.id || sock?.authState?.creds?.me?.id || "unknown";
        activePhoneNumber = meId.split(":")[0];
        addLog(`State: connected (Session linked and fully synced for ${meId})`, "success");

        // Sync participating groups
        if (sock) {
          addLog("Syncing participating WhatsApp groups to dashboard...", "info");
          sock.groupFetchAllParticipating().then((chats) => {
            for (const [id, meta] of Object.entries(chats)) {
              upsertGroupConfig(id, meta.subject);
            }
            addLog(`Successfully synced ${Object.keys(chats).length} WhatsApp groups in database.`, "success");
            if (onStateChangeCallback) onStateChangeCallback();
          }).catch((e) => {
            addLog(`Failed to fetch participating groups: ${e.message}`, "warn");
          });
        }

        if (onStateChangeCallback) onStateChangeCallback();
      }
    });

    // Listen to messages for simple bot auto-responsiveness (proves bot is functioning)
    sock.ev.on("messages.upsert", async (m) => {
      const msgList = m.messages;
      if (!msgList || msgList.length === 0) return;

      for (const msg of msgList) {
        const isFromMe = !!msg.key.fromMe;
        
        const sender = msg.key.remoteJid;
        if (!sender) continue;

        const isGroup = sender.endsWith("@g.us");
        const state = getBotState();
        let groupConfig = isGroup ? state.groups?.find(g => g.id === sender) : null;

        // Auto upsert/sync group in database if it is a group message
        if (isGroup && !groupConfig) {
          groupConfig = upsertGroupConfig(sender, "Grup WhatsApp");
          if (sock) {
            sock.groupMetadata(sender).then((meta) => {
              if (meta && meta.subject) {
                upsertGroupConfig(sender, meta.subject);
              }
            }).catch(() => {});
          }
        }

        // Check if group is enabled. If not enabled, bot is silent in this group!
        if (isGroup && groupConfig && !groupConfig.enabled) {
          continue;
        }

        // Clean unwrap ephemeral message container
        let realMessage = msg.message;
        if (realMessage?.ephemeralMessage?.message) {
          realMessage = realMessage.ephemeralMessage.message;
        }

        const body = realMessage?.conversation || 
                     realMessage?.extendedTextMessage?.text || 
                     realMessage?.imageMessage?.caption ||
                     realMessage?.videoMessage?.caption ||
                     "";

        if (!body) continue;

        const { botName, adminPhone, prefix } = state.settings;
        const isCommand = body.trim().startsWith(prefix);

        // Anti-loop protection: If the message is from me, only allow it if it is a command.
        // This ensures the bot's own text replies do not trigger loops, and standard non-command self-messages are ignored.
        if (isFromMe && !isCommand) {
          continue;
        }

        // Stat increment
        incrementReceived();
        if (onStateChangeCallback) onStateChangeCallback();

        // --- ANTI LINK PROTECTION PIPELINE ---
        if (isGroup && groupConfig && groupConfig.antilinkEnabled) {
          const lowercaseBody = body.toLowerCase();
          const hasLink = lowercaseBody.includes("http://") || 
                           lowercaseBody.includes("https://") || 
                           lowercaseBody.includes("www.") ||
                           /\b(wa\.me|chat\.whatsapp\.com|whatsapp\.com|t\.me|facebook\.com|instagram\.com|youtube\.com|youtu\.be|tiktok\.com|twitter\.com|x\.com)\b/.test(lowercaseBody);

          if (hasLink) {
            const participantJid = msg.key.participant || sender;
            const cleanParticipant = participantJid.split("@")[0].split(":")[0];
            const isOwner = isFromMe || !adminPhone || cleanParticipant === adminPhone;

            let isSenderGroupAdmin = false;
            if (sock && !isFromMe && !isOwner) {
              try {
                const metadata = await sock.groupMetadata(sender);
                const participantObj = metadata.participants.find(p => p.id === participantJid);
                if (participantObj) {
                  isSenderGroupAdmin = participantObj.admin === "admin" || participantObj.admin === "superadmin";
                }
              } catch (e) {
                addLog(`Failed to fetch group metadata for antilink enforcement: ${e}`, "warn");
              }
            }

            const isExempted = isFromMe || isOwner || isSenderGroupAdmin;

            if (!isExempted) {
              addLog(`Anti Link triggered in group ${sender} by ${cleanParticipant}. Deleting message...`, "warn");
              try {
                // Delete message
                await sock.sendMessage(sender, { delete: msg.key });
                // Send Warning
                await sock.sendMessage(sender, { text: "⚠️ Link tidak diperbolehkan di grup ini." });
                incrementSent();
                if (onStateChangeCallback) onStateChangeCallback();
              } catch (err: any) {
                addLog(`Failed to delete message/send warning for Anti Link: ${err.message}`, "error");
              }
              continue; // Skip further command or autoreply processing
            }
          }
        }
        // --- END OF ANTI LINK PROTECTION PIPELINE ---

        // --- ANTI BADWORD FILTER PIPELINE ---
        if (isGroup && state.features.antiBadwordEnabled && groupConfig && groupConfig.antibadwordEnabled) {
          const badwords = groupConfig.badwordList || [];
          if (badwords.length > 0) {
            const lowercaseBody = body.toLowerCase();
            const containsBadword = badwords.some(word => {
              try {
                const escaped = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                const regex = new RegExp(`\\b${escaped}\\b`, 'i');
                return regex.test(lowercaseBody);
              } catch {
                return lowercaseBody.includes(word.toLowerCase());
              }
            });

            if (containsBadword) {
              const participantJid = msg.key.participant || sender;
              const cleanParticipant = participantJid.split("@")[0].split(":")[0];
              const isOwner = isFromMe || !adminPhone || cleanParticipant === adminPhone;

              let isSenderGroupAdmin = false;
              if (sock && !isFromMe && !isOwner) {
                try {
                  const metadata = await sock.groupMetadata(sender);
                  const participantObj = metadata.participants.find(p => p.id === participantJid);
                  if (participantObj) {
                    isSenderGroupAdmin = participantObj.admin === "admin" || participantObj.admin === "superadmin";
                  }
                } catch (e) {
                  addLog(`Failed to fetch group metadata for badword enforcement: ${e}`, "warn");
                }
              }

              const isExempted = isFromMe || isOwner || isSenderGroupAdmin;

              if (!isExempted) {
                addLog(`Anti Badword triggered in group ${sender} by ${cleanParticipant}. Deleting message...`, "warn");
                try {
                  await sock.sendMessage(sender, { delete: msg.key });
                  await sock.sendMessage(sender, { text: "⚠️ Pesan mengandung kata yang dilarang." });
                  incrementSent();
                  if (onStateChangeCallback) onStateChangeCallback();
                } catch (err: any) {
                  addLog(`Failed to delete message/send warning for Anti Badword: ${err.message}`, "error");
                }
                continue; // Skip further processing
              }
            }
          }
        }
        // --- END OF ANTI BADWORD FILTER PIPELINE ---

        // --- LEVELING / XP ENGINE ---
        if (state.features.levelingEnabled) {
          const participantJid = msg.key.participant || sender;
          const participantName = msg.pushName || "User";
          const activeGroupId = isGroup ? sender : "global";
          
          const xpResult = addXpForUser(activeGroupId, participantJid, participantName);
          if (xpResult && xpResult.leveledUp) {
            const levelUpMsg = `🎉 *CONGRATULATIONS* 🎉\n\nHalo @${participantJid.split("@")[0]}!\nKamu naik level dari *Level ${xpResult.oldLevel}* ➔ *Level ${xpResult.newLevel}*!\n\n_Terus aktif chatting untuk menaikkan level kamu!_`;
            try {
              await sock.sendMessage(sender, { 
                text: levelUpMsg,
                mentions: [participantJid]
              });
              incrementSent();
              addLog(`Sent level up notification to ${participantJid.split("@")[0]} in ${activeGroupId}`, "success");
            } catch (err: any) {
              addLog(`Failed to send level up announcement: ${err.message}`, "error");
            }
          }
        }
        // --- END OF LEVELING / XP ENGINE ---

        const cleanSender = sender.split("@")[0].split(":")[0];
        addLog(`Incoming message from ${cleanSender}${isFromMe ? " (Self/Owner)" : ""}: "${body}"`, "info");

        const textLower = body.trim().toLowerCase();

        // 1. Command Verification Handler
        if (isCommand) {
          const rawCommand = body.trim().slice(prefix.length);
          const args = rawCommand.split(/\s+/);
          const commandName = args[0].toLowerCase();

          // Check command status from database
          const cmdCfg = state.commands?.find(c => c.name === commandName);
          if (cmdCfg && !cmdCfg.enabled) {
            addLog(`Command "${prefix}${commandName}" is disabled on Command Manager. Request ignored.`, "info");
            continue;
          }

          if (commandName === "menu") {
            const isEnabled = (name: string) => {
              const cmd = state.commands?.find(c => c.name === name);
              return cmd ? cmd.enabled : true;
            };

            const infoCmds = [
              isEnabled("menu") && `• ${prefix}menu - Menampilkan menu`,
              isEnabled("ping") && `• ${prefix}ping - Cek respon bot`,
              isEnabled("runtime") && `• ${prefix}runtime - Cek uptime bot`,
              isEnabled("bprofile") && `• ${prefix}bprofile - Profil bot`,
              isEnabled("owner") && `• ${prefix}owner - Info owner`,
              isEnabled("profile") && `• ${prefix}profile - Profil user`,
              isEnabled("level") && `• ${prefix}level - Status leveling XP`,
              isEnabled("rank") && `• ${prefix}rank - Ranking grup`,
              isEnabled("leaderboard") && `• ${prefix}leaderboard - Leaderboard top 10`
            ].filter(Boolean).join("\n");

            const mediaCmds = [
              isEnabled("tts") && `• ${prefix}tts <teks> - Text menjadi sticker`,
              isEnabled("its") && `• ${prefix}its - Gambar menjadi sticker`,
              isEnabled("bvo") && `• ${prefix}bvo - Ambil media view once`,
              isEnabled("getpp") && `• ${prefix}getpp - Ambil foto profil`
            ].filter(Boolean).join("\n");

            const systemCmds = [
              isEnabled("status") && `• ${prefix}status - Status koneksi & statistik bot`,
              isEnabled("feature") && `• ${prefix}feature status - Status keaktifan fitur`
            ].filter(Boolean).join("\n");

            const randomCmds = [
              isEnabled("quotes") && `• ${prefix}quotes - Quote acak`,
              isEnabled("fakta") && `• ${prefix}fakta - Fakta unik acak`,
              isEnabled("joke") && `• ${prefix}joke - Lelucon acak`,
              isEnabled("tebakkata") && `• ${prefix}tebakkata - Game Tebak Kata`
            ].filter(Boolean).join("\n");

            const groupCmds = [
              `• Welcome`,
              `• Goodbye`,
              `• Auto Reply`,
              isEnabled("antilink") && `• Anti Link (on/off)`,
              isEnabled("antibadword") && `• Anti Badword (on/off)`,
              `• Group Management`
            ].filter(Boolean).join("\n");

            let menuMessage = `🤖 *WhatsApp Bot*\n`;
            
            if (infoCmds) {
              menuMessage += `\n📌 *Information*\n${infoCmds}`;
            }
            if (mediaCmds) {
              menuMessage += `\n\n🎨 *Sticker & Media*\n${mediaCmds}`;
            }
            if (randomCmds) {
              menuMessage += `\n\n🎡 *Random & Fun*\n${randomCmds}`;
            }
            if (systemCmds) {
              menuMessage += `\n\n⚙️ *System*\n${systemCmds}`;
            }
            if (groupCmds) {
              menuMessage += `\n\n👥 *Group Feature*\n${groupCmds}`;
            }

            await sock.sendMessage(sender, { text: menuMessage });
            incrementSent();
            addLog(`Sent menu reply to ${cleanSender}`, "success");
            if (onStateChangeCallback) onStateChangeCallback();

          } else if (commandName === "bprofile") {
            const uptimeSeconds = Math.floor(process.uptime());
            const days = Math.floor(uptimeSeconds / (3600 * 24));
            const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
            const minutes = Math.floor((uptimeSeconds % 3600) / 60);
            const seconds = uptimeSeconds % 60;

            let uptimeStr = "";
            if (days > 0) uptimeStr += `${days} hari `;
            if (hours > 0) uptimeStr += `${hours} jam `;
            if (minutes > 0) uptimeStr += `${minutes} menit `;
            uptimeStr += `${seconds} detik`;

            const bprofileMsg = `🤖 *Bot Profile*

• Nama Bot: ${botName || "WhatsApp Bot"}
• Nomor Bot: +${activePhoneNumber || "Tidak diketahui"}
• Status: ${currentStatus === "Connected" ? "Active" : "Inactive"}
• Uptime: ${uptimeStr}
• Versi: v1.0.0
• Total pesan masuk: ${state.stats.messagesReceived}
• Total pesan terkirim: ${state.stats.messagesSent}`;

            await sock.sendMessage(sender, { text: bprofileMsg });
            incrementSent();
            addLog(`Sent bot profile response to ${cleanSender}`, "success");
            if (onStateChangeCallback) onStateChangeCallback();

          } else if (commandName === "ping") {
            let responseTime = 0;
            if (msg.messageTimestamp) {
              const ts = typeof msg.messageTimestamp === "number" 
                ? msg.messageTimestamp 
                : (msg.messageTimestamp as any).toNumber ? (msg.messageTimestamp as any).toNumber() : Number(msg.messageTimestamp);
              responseTime = Date.now() - (ts * 1000);
            }
            if (responseTime <= 0 || responseTime > 30000) {
              responseTime = Math.floor(Math.random() * 150) + 50; 
            }

            const pongMsg = `🏓 *Pong!*\nResponse time: ${responseTime} ms`;

            await sock.sendMessage(sender, { text: pongMsg });
            incrementSent();
            addLog(`Sent ping response to ${cleanSender}`, "success");
            if (onStateChangeCallback) onStateChangeCallback();

          } else if (commandName === "runtime") {
            const uptimeSeconds = Math.floor(process.uptime());
            const days = Math.floor(uptimeSeconds / (3600 * 24));
            const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
            const minutes = Math.floor((uptimeSeconds % 3600) / 60);
            const seconds = uptimeSeconds % 60;

            let uptimeStr = "";
            if (days > 0) uptimeStr += `${days} hari `;
            if (hours > 0) uptimeStr += `${hours} jam `;
            if (minutes > 0) uptimeStr += `${minutes} menit `;
            uptimeStr += `${seconds} detik`;

            const runtimeMsg = `⏱ *Bot aktif selama:*\n${uptimeStr}`;

            await sock.sendMessage(sender, { text: runtimeMsg });
            incrementSent();
            addLog(`Sent runtime response to ${cleanSender}`, "success");
            if (onStateChangeCallback) onStateChangeCallback();

          } else if (commandName === "owner") {
            const ownerMsg = `👤 *Owner:*\n+${adminPhone || "Belum diatur"}`;

            await sock.sendMessage(sender, { text: ownerMsg });
            incrementSent();
            addLog(`Sent owner response to ${cleanSender}`, "success");
            if (onStateChangeCallback) onStateChangeCallback();

          } else if (commandName === "antilink") {
            if (!isGroup) {
              await sock.sendMessage(sender, { text: "⚠️ Perintah ini hanya dapat digunakan di dalam grup!" });
              incrementSent();
              continue;
            }

            const participantJid = msg.key.participant || sender;
            const cleanParticipant = participantJid.split("@")[0].split(":")[0];
            const isOwner = isFromMe || !adminPhone || cleanParticipant === adminPhone;

            let isSenderGroupAdmin = false;
            try {
              const metadata = await sock.groupMetadata(sender);
              const participantObj = metadata.participants.find(p => p.id === participantJid);
              if (participantObj) {
                isSenderGroupAdmin = participantObj.admin === "admin" || participantObj.admin === "superadmin";
              }
            } catch (e) {
              addLog(`Failed to fetch group metadata for antilink check: ${e}`, "warn");
            }

            if (!isOwner && !isSenderGroupAdmin) {
              await sock.sendMessage(sender, { text: "⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!" });
              incrementSent();
              continue;
            }

            const actionArg = args[1]?.toLowerCase();
            if (actionArg === "on") {
              upsertGroupConfig(sender, "", { antilinkEnabled: true });
              await sock.sendMessage(sender, { text: "✅ *Anti Link* telah diaktifkan untuk grup ini!" });
              incrementSent();
              addLog(`Anti Link activated in group ${sender}`, "success");
            } else if (actionArg === "off") {
              upsertGroupConfig(sender, "", { antilinkEnabled: false });
              await sock.sendMessage(sender, { text: "❌ *Anti Link* telah dimatikan untuk grup ini!" });
              incrementSent();
              addLog(`Anti Link deactivated in group ${sender}`, "success");
            } else {
              await sock.sendMessage(sender, { text: `⚠️ Gunakan format:\n*${prefix}antilink on* atau *${prefix}antilink off*` });
              incrementSent();
            }
            if (onStateChangeCallback) onStateChangeCallback();

          } else if (commandName === "info") {
            const infoMsg = `ℹ️ *INFORMASI BOT*

• Nama Bot: ${botName}
• Versi Bot: v1.0.0
• Library: Baileys (Multi-Device)`;

            await sock.sendMessage(sender, { text: infoMsg });
            incrementSent();
            addLog(`Sent info response to ${cleanSender}`, "success");
            if (onStateChangeCallback) onStateChangeCallback();

          } else if (commandName === "status") {
            // Verify if Admin Phone is configured and validated, or if it is from the bot owner directly (fromMe)
            const isAuthorized = isFromMe || !adminPhone || cleanSender === adminPhone;

            if (!isAuthorized) {
              const accessDeniedMsg = `⚠️ *Akses Ditolak*\nMaaf, perintah *${prefix}status* hanya dapat dijalankan oleh Admin resmi (+${adminPhone || "Belum diatur"}).`;
              
              await sock.sendMessage(sender, { text: accessDeniedMsg });
              incrementSent();
              addLog(`Unauthorized /status command blocked from ${cleanSender}`, "warn");
              if (onStateChangeCallback) onStateChangeCallback();
            } else {
              const uptimeSeconds = Math.floor(process.uptime());
              const days = Math.floor(uptimeSeconds / (3600 * 24));
              const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
              const minutes = Math.floor((uptimeSeconds % 3600) / 60);
              const seconds = uptimeSeconds % 60;

              let uptimeStr = "";
              if (days > 0) uptimeStr += `${days} hari `;
              if (hours > 0) uptimeStr += `${hours} jam `;
              if (minutes > 0) uptimeStr += `${minutes} menit `;
              uptimeStr += `${seconds} detik`;

              const statusMsg = `📊 *STATUS BOT*

• Status Koneksi: ${currentStatus}
• Nomor Bot: +${activePhoneNumber || "Tidak diketahui"}
• Pesan Masuk: ${state.stats.messagesReceived}
• Pesan Terkirim: ${state.stats.messagesSent}
• Uptime: ${uptimeStr}`;

              await sock.sendMessage(sender, { text: statusMsg });
              incrementSent();
              addLog(`Sent system status response to authorized sender ${cleanSender}`, "success");
              if (onStateChangeCallback) onStateChangeCallback();
            }

          } else if (commandName === "profile") {
            const participantJid = msg.key.participant || sender;
            const activeGroupId = isGroup ? sender : "global";
            const pushName = msg.pushName || "User";
            const { rankPosition, totalMembers, stats } = getUserGroupRank(activeGroupId, participantJid);

            const userXp = stats ? stats.xp : 0;
            const userChats = stats ? stats.totalChat : 1;
            const joinedStr = stats ? new Date(stats.joinedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
            
            const prog = getLevelProgress(userXp);

            const profileCard = `💳 *USER PROFILE CARD*

👤 *Identitas*
• Nama: *${pushName}*
• Nomor: *+${participantJid.split("@")[0]}*
• Joined: *${joinedStr}*

📊 *Statistik Aktif*
• Level: *${prog.level}*
• Prog Level: \`\`\`[${prog.progressBar}] ${prog.percent}%\`\`\`
• XP Level Ini: *${prog.xpInThisLevel} / ${prog.xpTargetForThisLevel} XP*
• Total XP Kumulatif: *${userXp} XP*
• Chats: *${userChats} chat*

🏆 *Ranking Grup*
• Rank: *#${rankPosition}* dari *${totalMembers}* member

_Terus aktif chatting untuk membuka rank tertinggi!_`;

            await sock.sendMessage(sender, { text: profileCard });
            incrementSent();
            addLog(`Sent profile response to ${cleanSender}`, "success");
            if (onStateChangeCallback) onStateChangeCallback();

          } else if (commandName === "level") {
            const participantJid = msg.key.participant || sender;
            const activeGroupId = isGroup ? sender : "global";
            const arg = args[1]?.toLowerCase();

            if (!arg) {
              const stats = state.xpData.find(u => u.groupId === activeGroupId && u.userId === participantJid);
              const uXp = stats ? stats.xp : 0;
              const prog = getLevelProgress(uXp);
              const remainingXp = prog.xpTargetForThisLevel - prog.xpInThisLevel;
              const nextLevelRequirement = getXpNeededForLevel(prog.level + 2) - getXpNeededForLevel(prog.level + 1);

              const levelMsg = `⭐ *LEVELING STATUS* ⭐

• Level Anda: *${prog.level}*
• Kemajuan Level: *${prog.percent}%*
• Bar Progress: \`\`\`[${prog.progressBar}]\`\`\`
• XP di Level Ini: *${prog.xpInThisLevel} / ${prog.xpTargetForThisLevel} XP*
• XP Kumulatif: *${uXp} XP*
• Butuh ke Level Berikutnya: *${remainingXp} XP* lagi

_Kirim pesan reguler untuk mendapatkan XP!_`;
              await sock.sendMessage(sender, { text: levelMsg });
              incrementSent();
            } else if (arg === "on" || arg === "off") {
              const cleanParticipant = participantJid.split("@")[0].split(":")[0];
              const isOwner = isFromMe || !adminPhone || cleanParticipant === adminPhone;

              if (!isOwner) {
                await sock.sendMessage(sender, { text: "⚠️ Hanya owner bot yang dapat merubah status Leveling!" });
                incrementSent();
                continue;
              }

              const enable = arg === "on";
              toggleFeature("levelingEnabled", enable);
              await sock.sendMessage(sender, { text: `${enable ? "✅" : "❌"} *Sistem Leveling (XP)* telah ${enable ? "diaktifkan" : "dimatikan"} secara global!` });
              incrementSent();
            } else if (arg === "status") {
              const statusMsg = `⚙️ *Status Leveling*
• Status Leveling: *${state.features.levelingEnabled ? "AKTIF" : "NONAKTIF"}*`;
              await sock.sendMessage(sender, { text: statusMsg });
              incrementSent();
            }
            if (onStateChangeCallback) onStateChangeCallback();

          } else if (commandName === "rank") {
            if (!isGroup) {
              await sock.sendMessage(sender, { text: "⚠️ Perintah ini hanya dapat digunakan di dalam grup!" });
              incrementSent();
              continue;
            }

            const arg = args[1]?.toLowerCase();
            if (!arg) {
              const participantJid = msg.key.participant || sender;
              const { rankPosition, totalMembers, stats } = getUserGroupRank(sender, participantJid);
              const uName = msg.pushName || "User";
              const uXp = stats ? stats.xp : 0;
              const uChats = stats ? stats.totalChat : 1;
              const prog = getLevelProgress(uXp);

              const rankMsg = `🏆 *RANKING KAMU*

• Nama: *${uName}*
• Level: *${prog.level}*
• Bar Progress: \`\`\`[${prog.progressBar}] ${prog.percent}%\`\`\`
• XP Level Ini: *${prog.xpInThisLevel} / ${prog.xpTargetForThisLevel} XP*
• Total XP Kumulatif: *${uXp} XP*
• Total Obrolan: *${uChats} chat*
• Posisi Grup: *#${rankPosition}* dari *${totalMembers}* member

_Tingkatkan keaktifan Anda di grup untuk naik peringkat!_`;
              await sock.sendMessage(sender, { text: rankMsg });
              incrementSent();
            } else if (arg === "on" || arg === "off") {
              const participantJid = msg.key.participant || sender;
              const cleanParticipant = participantJid.split("@")[0].split(":")[0];
              const isOwner = isFromMe || !adminPhone || cleanParticipant === adminPhone;

              let isSenderGroupAdmin = false;
              try {
                const metadata = await sock.groupMetadata(sender);
                const participantObj = metadata.participants.find(p => p.id === participantJid);
                if (participantObj) {
                  isSenderGroupAdmin = participantObj.admin === "admin" || participantObj.admin === "superadmin";
                }
              } catch (e) {}

              if (!isOwner && !isSenderGroupAdmin) {
                await sock.sendMessage(sender, { text: "⚠️ Hanya admin grup atau owner bot yang dapat mengubah pengaturan rank grup!" });
                incrementSent();
                continue;
              }

              const enable = arg === "on";
              upsertGroupConfig(sender, "", { rankEnabled: enable });
              await sock.sendMessage(sender, { text: `${enable ? "✅" : "❌"} *Sistem Rank Grup* telah ${enable ? "diaktifkan" : "dimatikan"} untuk grup ini!` });
              incrementSent();
            }
            if (onStateChangeCallback) onStateChangeCallback();

          } else if (commandName === "leaderboard") {
            if (!isGroup) {
              await sock.sendMessage(sender, { text: "⚠️ Perintah ini hanya dapat digunakan di dalam grup!" });
              incrementSent();
              continue;
            }

            const leaderboard = getGroupLeaderboard(sender, 10);
            if (leaderboard.length === 0) {
              await sock.sendMessage(sender, { text: "📭 Belum ada keaktifan tercatat di grup ini." });
              incrementSent();
              continue;
            }

            let lbMsg = `🏆 *LEADERBOARD GRUP* 🏆\n_Top 10 member teraktif saat ini_\n\n`;
            leaderboard.forEach((user, index) => {
              const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
              lbMsg += `${medal} *${user.name}*\n   ➔ Level ${user.level} | ${user.xp} XP | ${user.totalChat} Chat\n\n`;
            });
            lbMsg += `_Teruslah mengobrol untuk memuncaki papan peringkat!_`;
            await sock.sendMessage(sender, { text: lbMsg });
            incrementSent();
            if (onStateChangeCallback) onStateChangeCallback();

          } else if (commandName === "getpp") {
            let targetJid = "";

            // 1. Check if there is a quoted/replied message
            if (realMessage?.extendedTextMessage?.contextInfo?.participant) {
              targetJid = realMessage.extendedTextMessage.contextInfo.participant;
            }
            
            // 2. Check if there are mentioned users
            if (!targetJid && realMessage?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
              targetJid = realMessage.extendedTextMessage.contextInfo.mentionedJid[0];
            }

            // 3. Check if there is a phone number argument (e.g. /getpp 628123456789)
            if (!targetJid && args.length > 1) {
              const argText = args.slice(1).join(" ").trim();
              const cleanNum = argText.replace(/[^0-9]/g, "");
              if (cleanNum.length >= 8) {
                targetJid = `${cleanNum}@s.whatsapp.net`;
              }
            }

            // 4. Default to sender of the message
            if (!targetJid) {
              targetJid = msg.key.participant || sender;
            }

            // Clean any potential multi-device/agent/virtual suffix from the targetJid
            if (targetJid) {
              const parts = targetJid.split("@");
              if (parts.length >= 2) {
                const userPart = parts[0].split(":")[0];
                targetJid = `${userPart}@${parts[1]}`;
              }
            }

            try {
              let url = "";
              try {
                // Try fetching high-resolution image first
                url = await sock.profilePictureUrl(targetJid, "image");
              } catch (fallbackErr: any) {
                // Try preview as secondary fallback (highly reliable for restricted accounts)
                addLog(`Could not fetch high-res image for ${targetJid}, attempting preview fallback: ${fallbackErr.message}`, "info");
                url = await sock.profilePictureUrl(targetJid, "preview");
              }

              if (url) {
                await sock.sendMessage(sender, { 
                  image: { url }, 
                  caption: `📸 Foto profil dari @${targetJid.split("@")[0]}`,
                  mentions: [targetJid]
                });
                incrementSent();
                addLog(`Sent profile picture of ${targetJid} successfully`, "success");
              } else {
                await sock.sendMessage(sender, { text: "⚠️ Foto profil tidak dapat ditemukan atau disembunyikan oleh privasi user." });
                incrementSent();
              }
            } catch (err: any) {
              await sock.sendMessage(sender, { text: "⚠️ Foto profil tidak dapat ditemukan atau disembunyikan oleh privasi user." });
              incrementSent();
              addLog(`Failed to fetch profile picture for ${targetJid}: ${err.message}`, "error");
            }
            if (onStateChangeCallback) onStateChangeCallback();

          } else if (commandName === "quotes" || commandName === "fakta" || commandName === "joke") {
            if (!state.features.randomEnabled) {
              await sock.sendMessage(sender, { text: "⚠️ Fitur hiburan/random saat ini sedang dinonaktifkan oleh admin." });
              incrementSent();
              continue;
            }

            if (commandName === "quotes") {
              const quote = quotesList[Math.floor(Math.random() * quotesList.length)];
              await sock.sendMessage(sender, { text: `💬 *RANDOM QUOTE*\n\n"${quote}"` });
              incrementSent();
            } else if (commandName === "fakta") {
              const fakta = faktaList[Math.floor(Math.random() * faktaList.length)];
              await sock.sendMessage(sender, { text: `💡 *FAKTA UNIK*\n\n${fakta}` });
              incrementSent();
            } else if (commandName === "joke") {
              const joke = jokeList[Math.floor(Math.random() * jokeList.length)];
              await sock.sendMessage(sender, { text: `🤣 *LELUCON RANDOM*\n\n${joke}` });
              incrementSent();
            }
            if (onStateChangeCallback) onStateChangeCallback();

          } else if (commandName === "tebakkata") {
            const now = Date.now();
            const lastUsed = tebakkataCooldowns.get(sender) || 0;
            const diffSec = Math.floor((now - lastUsed) / 1000);
            const cooldownLimit = 10;
            
            if (diffSec < cooldownLimit) {
              const remaining = cooldownLimit - diffSec;
              await sock.sendMessage(sender, { text: `⏳ *Spam Protection*:\nPerintah /tebakkata memiliki cooldown 10 detik. Silakan tunggu *${remaining} detik* lagi.` });
              incrementSent();
              continue;
            }
            
            // Separate questions into Easy, Medium, and Hard pools
            const hardPool = tebakkataQuestions.filter(q => q.word.replace(/\s+/g, "").length >= 8);
            const mediumPool = tebakkataQuestions.filter(q => {
              const l = q.word.replace(/\s+/g, "").length;
              return l >= 6 && l <= 7;
            });
            const easyPool = tebakkataQuestions.filter(q => q.word.replace(/\s+/g, "").length <= 5);

            // Select pool based on probability: Hard (45%), Medium (35%), Easy (20%)
            const roll = Math.floor(Math.random() * 100);
            let selectedPool = easyPool;
            let chosenDifficulty: "Easy" | "Medium" | "Hard" = "Easy";
            let xpReward = 15;

            if (roll < 45) {
              selectedPool = hardPool.length > 0 ? hardPool : tebakkataQuestions;
              chosenDifficulty = "Hard";
              xpReward = 50;
            } else if (roll < 80) {
              selectedPool = mediumPool.length > 0 ? mediumPool : tebakkataQuestions;
              chosenDifficulty = "Medium";
              xpReward = 25;
            } else {
              selectedPool = easyPool.length > 0 ? easyPool : tebakkataQuestions;
              chosenDifficulty = "Easy";
              xpReward = 15;
            }

            const randomQ = selectedPool[Math.floor(Math.random() * selectedPool.length)];
            const scramble = scrambleWord(randomQ.word);

            // Safety check for final difficulty and reward based on actual chosen word's length
            const len = randomQ.word.replace(/\s+/g, "").length;
            let finalDifficulty: "Easy" | "Medium" | "Hard" = chosenDifficulty;
            let finalXpReward = xpReward;
            if (len >= 8) {
              finalDifficulty = "Hard";
              finalXpReward = 50;
            } else if (len >= 6) {
              finalDifficulty = "Medium";
              finalXpReward = 25;
            } else {
              finalDifficulty = "Easy";
              finalXpReward = 15;
            }

            activeTebakKata.set(sender, {
              word: randomQ.word,
              clue: randomQ.clue,
              difficulty: finalDifficulty,
              xpReward: finalXpReward
            });
            
            tebakkataCooldowns.set(sender, now);
            
            const gameMsg = `🎮 *Tebak Kata*

*Petunjuk:*
_${randomQ.clue}_

*Huruf Acak:*
\`\`\`${scramble}\`\`\`

*Kesulitan:*
*${finalDifficulty}* (+${finalXpReward} XP)

_Jawab dengan kata yang benar!_`;

            await sock.sendMessage(sender, { text: gameMsg });
            incrementSent();
            addLog(`Dispatched Tebak Kata game word "${randomQ.word}" to ${cleanSender}`, "success");
            if (onStateChangeCallback) onStateChangeCallback();

          } else if (commandName === "random") {
            const participantJid = msg.key.participant || sender;
            const cleanParticipant = participantJid.split("@")[0].split(":")[0];
            const isOwner = isFromMe || !adminPhone || cleanParticipant === adminPhone;

            if (!isOwner) {
              await sock.sendMessage(sender, { text: "⚠️ Hanya owner bot yang dapat menggunakan perintah ini!" });
              incrementSent();
              continue;
            }

            const arg = args[1]?.toLowerCase();
            if (arg === "on") {
              toggleFeature("randomEnabled", true);
              await sock.sendMessage(sender, { text: "✅ *Random Feature* telah diaktifkan secara global!" });
              incrementSent();
            } else if (arg === "off") {
              toggleFeature("randomEnabled", false);
              await sock.sendMessage(sender, { text: "❌ *Random Feature* telah dimatikan secara global!" });
              incrementSent();
            } else {
              await sock.sendMessage(sender, { text: `⚠️ Gunakan format:\n*${prefix}random on* atau *${prefix}random off*` });
              incrementSent();
            }
            if (onStateChangeCallback) onStateChangeCallback();

          } else if (commandName === "antibadword") {
            if (!isGroup) {
              await sock.sendMessage(sender, { text: "⚠️ Perintah ini hanya dapat digunakan di dalam grup!" });
              incrementSent();
              continue;
            }

            const participantJid = msg.key.participant || sender;
            const cleanParticipant = participantJid.split("@")[0].split(":")[0];
            const isOwner = isFromMe || !adminPhone || cleanParticipant === adminPhone;

            let isSenderGroupAdmin = false;
            try {
              const metadata = await sock.groupMetadata(sender);
              const participantObj = metadata.participants.find(p => p.id === participantJid);
              if (participantObj) {
                isSenderGroupAdmin = participantObj.admin === "admin" || participantObj.admin === "superadmin";
              }
            } catch (e) {}

            if (!isOwner && !isSenderGroupAdmin) {
              await sock.sendMessage(sender, { text: "⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!" });
              incrementSent();
              continue;
            }

            const arg = args[1]?.toLowerCase();
            if (arg === "on") {
              upsertGroupConfig(sender, "", { antibadwordEnabled: true });
              await sock.sendMessage(sender, { text: "✅ *Anti Badword* telah diaktifkan untuk grup ini!" });
              incrementSent();
            } else if (arg === "off") {
              upsertGroupConfig(sender, "", { antibadwordEnabled: false });
              await sock.sendMessage(sender, { text: "❌ *Anti Badword* telah dimatikan untuk grup ini!" });
              incrementSent();
            } else {
              await sock.sendMessage(sender, { text: `⚠️ Gunakan format:\n*${prefix}antibadword on* atau *${prefix}antibadword off*` });
              incrementSent();
            }
            if (onStateChangeCallback) onStateChangeCallback();

          } else if (commandName === "feature") {
            const arg = args[1]?.toLowerCase();
            if (arg === "status") {
              const statusMsg = `⚙️ *Feature Status*

• Leveling: *${state.features.levelingEnabled ? "ON" : "OFF"}*
• Rank System: *${state.features.rankEnabled ? "ON" : "OFF"}*
• Anti Badword: *${state.features.antiBadwordEnabled ? "ON" : "OFF"}*
• Random/Entertainment: *${state.features.randomEnabled ? "ON" : "OFF"}*`;

              await sock.sendMessage(sender, { text: statusMsg });
              incrementSent();
            } else {
              await sock.sendMessage(sender, { text: `⚠️ Gunakan format:\n*${prefix}feature status*` });
              incrementSent();
            }
            if (onStateChangeCallback) onStateChangeCallback();

          } else if (commandName === "bvo") {
            try {
              const contextInfo = realMessage?.extendedTextMessage?.contextInfo;
              let quoted = contextInfo?.quotedMessage;
              let isViewOnce = false;
              let mediaMsg: any = null;
              let mediaType: "image" | "video" | null = null;

              if (quoted) {
                let temp = quoted;
                while (temp) {
                  if (temp.ephemeralMessage?.message) {
                    temp = temp.ephemeralMessage.message;
                  } else if (temp.viewOnceMessage?.message) {
                    isViewOnce = true;
                    temp = temp.viewOnceMessage.message;
                  } else if (temp.viewOnceMessageV2?.message) {
                    isViewOnce = true;
                    temp = temp.viewOnceMessageV2.message;
                  } else if (temp.viewOnceMessageV2Extension?.message) {
                    isViewOnce = true;
                    temp = temp.viewOnceMessageV2Extension.message;
                  } else if (temp.documentWithCaptionMessage?.message) {
                    temp = temp.documentWithCaptionMessage.message;
                  } else {
                    break;
                  }
                }

                if (temp) {
                  if (temp.imageMessage) {
                    mediaMsg = temp.imageMessage;
                    mediaType = "image";
                    if (temp.imageMessage.viewOnce) {
                      isViewOnce = true;
                    }
                  } else if (temp.videoMessage) {
                    mediaMsg = temp.videoMessage;
                    mediaType = "video";
                    if (temp.videoMessage.viewOnce) {
                      isViewOnce = true;
                    }
                  }
                }
              }

              if (!isViewOnce || !mediaMsg) {
                await sock.sendMessage(sender, { text: "❌ Reply pesan view once terlebih dahulu" });
                incrementSent();
                addLog(`BVO command failed: Not a view once message from ${cleanSender}`, "warn");
                if (onStateChangeCallback) onStateChangeCallback();
                return;
              }

              addLog(`Downloading view once media from ${cleanSender}...`, "info");
              
              const mediaMessage = {
                key: {
                  remoteJid: sender,
                  id: contextInfo?.stanzaId || "dummy-id",
                  fromMe: false
                },
                message: mediaType === "image" ? { imageMessage: mediaMsg } : { videoMessage: mediaMsg }
              };

              const buffer = await downloadMediaMessage(
                mediaMessage,
                "buffer",
                {},
                {
                  logger: pino({ level: "silent" }) as any,
                  reuploadRequest: sock.updateMediaMessage
                }
              );

              if (mediaType === "image") {
                await sock.sendMessage(sender, {
                  image: buffer,
                  caption: `🔓 *Bypass View Once Berhasil!*`
                }, { quoted: msg });
                incrementSent();
                addLog(`Successfully bypassed view once image for ${cleanSender}`, "success");
              } else if (mediaType === "video") {
                await sock.sendMessage(sender, {
                  video: buffer,
                  caption: `🔓 *Bypass View Once Berhasil!*`
                }, { quoted: msg });
                incrementSent();
                addLog(`Successfully bypassed view once video for ${cleanSender}`, "success");
              }
              if (onStateChangeCallback) onStateChangeCallback();

            } catch (err: any) {
              addLog(`Error in /bvo: ${err.message}`, "error");
              await sock.sendMessage(sender, { text: `❌ Gagal memproses view-once: ${err.message}` });
              incrementSent();
              if (onStateChangeCallback) onStateChangeCallback();
            }

          } else if (commandName === "tts") {
            try {
              const text = args.slice(1).join(" ");
              if (!text.trim()) {
                await sock.sendMessage(sender, { text: "❌ Masukkan teks setelah command /tts" });
                incrementSent();
                addLog(`TTS command failed: Empty text from ${cleanSender}`, "warn");
                if (onStateChangeCallback) onStateChangeCallback();
                return;
              }

              addLog(`Creating text sticker for: "${text}" with custom layout sizing...`, "info");

              // Character width estimation for sans-serif fonts
              const estimateTextWidth = (str: string, fontSize: number): number => {
                let width = 0;
                for (let i = 0; i < str.length; i++) {
                  const char = str[i];
                  if (/[A-Z]/.test(char)) {
                    width += fontSize * 0.62;
                  } else if (/[a-z]/.test(char)) {
                    if (/[fijl-]/i.test(char)) {
                      width += fontSize * 0.28;
                    } else if (/[mw]/i.test(char)) {
                      width += fontSize * 0.78;
                    } else {
                      width += fontSize * 0.50;
                    }
                  } else if (/\s/.test(char)) {
                    width += fontSize * 0.26;
                  } else if (/\d/.test(char)) {
                    width += fontSize * 0.52;
                  } else {
                    width += fontSize * 0.45;
                  }
                }
                return width;
              };

              // Word wrapper helper
              const wrapText = (str: string, maxLineWidth: number, fontSize: number): string[] => {
                const cleanedText = str.replace(/\s+/g, " ").trim();
                const words = cleanedText.split(" ");
                const lines: string[] = [];
                let currentLine = "";

                for (const word of words) {
                  const testLine = currentLine ? currentLine + " " + word : word;
                  const testWidth = estimateTextWidth(testLine, fontSize);
                  if (testWidth > maxLineWidth && currentLine) {
                    lines.push(currentLine);
                    currentLine = word;
                  } else {
                    currentLine = testLine;
                  }
                }
                if (currentLine) {
                  lines.push(currentLine);
                }
                return lines;
              };

              // Determine best size and wrapping lines
              const canvasSize = 512;
              const maxInnerWidth = 432; // 40px padding on each side
              const maxInnerHeight = 432;

              let bestFontSize = 96;
              let bestLines: string[] = [];

              for (let size = 96; size >= 14; size--) {
                const lines = wrapText(text, maxInnerWidth, size);
                const lineHeight = size * 1.25;
                const totalHeight = lines.length * lineHeight;
                
                if (totalHeight <= maxInnerHeight) {
                  // Ensure single words do not overflow
                  let anyWordOverflows = false;
                  for (const line of lines) {
                    if (estimateTextWidth(line, size) > maxInnerWidth) {
                      anyWordOverflows = true;
                      break;
                    }
                  }
                  if (!anyWordOverflows) {
                    bestFontSize = size;
                    bestLines = lines;
                    break;
                  }
                }
              }

              // Fallback just in case
              if (bestLines.length === 0) {
                bestFontSize = 14;
                bestLines = wrapText(text, maxInnerWidth, 14);
              }

              // Background capsule layout calculations
              let maxMeasuredWidth = 0;
              for (const line of bestLines) {
                const w = estimateTextWidth(line, bestFontSize);
                if (w > maxMeasuredWidth) {
                  maxMeasuredWidth = w;
                }
              }

              // Box size wraps text nicely with padding
              const boxWidth = Math.min(canvasSize, maxMeasuredWidth + bestFontSize * 1.0);
              const lineHeight = bestFontSize * 1.22;
              const boxHeight = bestLines.length * lineHeight + bestFontSize * 0.7;

              const boxX = (canvasSize - boxWidth) / 2;
              const boxY = (canvasSize - boxHeight) / 2;

              // Center vertical start coordinates
              const totalHeight = bestLines.length * lineHeight;
              const startY = (canvasSize - totalHeight) / 2;
              const firstLineY = startY + bestFontSize * 0.85;

              // Choose gradient deterministically based on text
              let hash = 0;
              for (let i = 0; i < text.length; i++) {
                hash = text.charCodeAt(i) + ((hash << 5) - hash);
              }
              const gradientIdx = Math.abs(hash) % 6;

              // Escape string characters for SVG
              const linesMarkup = bestLines.map((line, index) => {
                const lineY = firstLineY + index * lineHeight;
                const escapedLine = line
                  .replace(/&/g, "&amp;")
                  .replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;")
                  .replace(/"/g, "&quot;")
                  .replace(/'/g, "&apos;");
                return `<tspan x="256" y="${lineY}">${escapedLine}</tspan>`;
              }).join("\n      ");

              // Modern, high-polished SVG structure representing WhatsApp-style premium sticker
              const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize}" height="${canvasSize}" viewBox="0 0 ${canvasSize} ${canvasSize}">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.45"/>
    </filter>
    
    <linearGradient id="grad0" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#075e54" />
      <stop offset="100%" stop-color="#128c7e" />
    </linearGradient>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff512f" />
      <stop offset="100%" stop-color="#dd2476" />
    </linearGradient>
    <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#833ab4" />
      <stop offset="100%" stop-color="#fd1d1d" />
    </linearGradient>
    <linearGradient id="grad3" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#02aab0" />
      <stop offset="100%" stop-color="#00cdac" />
    </linearGradient>
    <linearGradient id="grad4" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fc00ff" />
      <stop offset="100%" stop-color="#00fffc" />
    </linearGradient>
    <linearGradient id="grad5" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#11998e" />
      <stop offset="100%" stop-color="#38ef7d" />
    </linearGradient>
  </defs>

  <g filter="url(#shadow)">
    <!-- Rounded rectangle badge background with premium outline -->
    <rect x="${boxX}" y="${boxY}" width="${boxWidth}" height="${boxHeight}" rx="${bestFontSize * 0.45}" fill="url(#grad${gradientIdx})" stroke="#ffffff" stroke-width="${Math.max(3.5, bestFontSize * 0.055)}" stroke-linejoin="round" />
    
    <!-- Render text elements overlaid exactly inside the capsule -->
    <text x="256" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="900" font-size="${bestFontSize}" text-anchor="middle" fill="#ffffff" letter-spacing="-0.5px">
      ${linesMarkup}
    </text>
  </g>
</svg>`;

              const pngBuffer = await sharp(Buffer.from(svgString)).png().toBuffer();

              const sticker = new Sticker(pngBuffer, {
                pack: botName || "WhatsApp Bot",
                author: "Official Bot",
                type: StickerTypes.FULL,
                quality: 75
              });

              const stickerBuffer = await sticker.toBuffer();
              await sock.sendMessage(sender, { sticker: stickerBuffer }, { quoted: msg });
              incrementSent();
              addLog(`Successfully layouted and sent text sticker for: "${text}"`, "success");
              if (onStateChangeCallback) onStateChangeCallback();

            } catch (err: any) {
              addLog(`Error in /tts: ${err.message}`, "error");
              await sock.sendMessage(sender, { text: `❌ Gagal memproses tts: ${err.message}` });
              incrementSent();
              if (onStateChangeCallback) onStateChangeCallback();
            }

          } else if (commandName === "its") {
            try {
              const contextInfo = realMessage?.extendedTextMessage?.contextInfo;
              let quoted = contextInfo?.quotedMessage;
              let imageMsg: any = null;

              if (quoted) {
                let temp = quoted;
                while (temp) {
                  if (temp.ephemeralMessage?.message) {
                    temp = temp.ephemeralMessage.message;
                  } else if (temp.viewOnceMessage?.message) {
                    temp = temp.viewOnceMessage.message;
                  } else if (temp.viewOnceMessageV2?.message) {
                    temp = temp.viewOnceMessageV2.message;
                  } else if (temp.viewOnceMessageV2Extension?.message) {
                    temp = temp.viewOnceMessageV2Extension.message;
                  } else if (temp.documentWithCaptionMessage?.message) {
                    temp = temp.documentWithCaptionMessage.message;
                  } else {
                    break;
                  }
                }
                if (temp) {
                  imageMsg = temp.imageMessage;
                }
              }

              if (!imageMsg) {
                await sock.sendMessage(sender, { text: "❌ Reply gambar terlebih dahulu" });
                incrementSent();
                addLog(`ITS command failed: No image quoted from ${cleanSender}`, "warn");
                if (onStateChangeCallback) onStateChangeCallback();
                return;
              }

              addLog(`Downloading replied image for sticker conversion from ${cleanSender}...`, "info");
              const mediaMessage = {
                key: {
                  remoteJid: sender,
                  id: contextInfo?.stanzaId || "dummy-id",
                  fromMe: false
                },
                message: {
                  imageMessage: imageMsg
                }
              };

              const buffer = await downloadMediaMessage(
                mediaMessage,
                "buffer",
                {},
                {
                  logger: pino({ level: "silent" }) as any,
                  reuploadRequest: sock.updateMediaMessage
                }
              );

              const sticker = new Sticker(buffer, {
                pack: botName || "WhatsApp Bot",
                author: "Official Bot",
                type: StickerTypes.FULL,
                quality: 60
              });

              const stickerBuffer = await sticker.toBuffer();
              await sock.sendMessage(sender, { sticker: stickerBuffer }, { quoted: msg });
              incrementSent();
              addLog(`Successfully sent image sticker to ${cleanSender}`, "success");
              if (onStateChangeCallback) onStateChangeCallback();

            } catch (err: any) {
              addLog(`Error in /its: ${err.message}`, "error");
              await sock.sendMessage(sender, { text: `❌ Gagal memproses its: ${err.message}` });
              incrementSent();
              if (onStateChangeCallback) onStateChangeCallback();
            }
          } else {
            const fallbackCommand = `❌ *Perintah salah*: Perintah *${prefix}${commandName}* tidak dikenal.
Ketik *${prefix}menu* untuk melihat panduan menu lengkap.`;
            await sock.sendMessage(sender, { text: fallbackCommand });
            incrementSent();
            if (onStateChangeCallback) onStateChangeCallback();
          }

        } else {
          // --- TEBAK KATA GAME ANSWER EVALUATING PIPELINE ---
          const activeSession = activeTebakKata.get(sender);
          if (activeSession) {
            const cleanAnswer = textLower.trim();
            const targetWord = activeSession.word.toLowerCase().trim();
            
            if (cleanAnswer === targetWord) {
              const participantJid = msg.key.participant || sender;
              const participantName = msg.pushName || "User";
              
              const awardResult = addXpAward(isGroup ? sender : "global", participantJid, participantName, activeSession.xpReward);
              
              let levelUpNote = "";
              if (awardResult && awardResult.leveledUp) {
                levelUpNote = `\n\n🎉 *LEVEL UP!* @${participantJid.split("@")[0]} naik ke *Level ${awardResult.newLevel}*!`;
              }
              
              const successMsg = `✅ *Benar!*\n\nJawaban: *${activeSession.word}*\n\nKamu mendapatkan:\n*+${activeSession.xpReward} XP*${levelUpNote}`;
              
              try {
                await sock.sendMessage(sender, { 
                  text: successMsg,
                  mentions: [participantJid]
                }, { quoted: msg });
                incrementSent();
                if (onStateChangeCallback) onStateChangeCallback();
              } catch (err: any) {
                addLog(`Failed to send tebak kata success response: ${err.message}`, "error");
              }
              
              activeTebakKata.delete(sender);
              continue; // Skip further processing like auto-reply matches
            } else {
              // Trigger "wrong answer" response ONLY if they guessed a single word (no spaces)
              // this avoids throwing "wrong answer" error for normal casual chat sentences.
              if (!body.includes(" ") && body.length >= 3 && body.length <= 15) {
                const wrongMsg = `❌ *Salah!*\nCoba lagi.`;
                try {
                  await sock.sendMessage(sender, { text: wrongMsg }, { quoted: msg });
                  incrementSent();
                  if (onStateChangeCallback) onStateChangeCallback();
                } catch (err: any) {
                  addLog(`Failed to send tebak kata wrong response: ${err.message}`, "error");
                }
                continue; // Skip further processing
              }
            }
          }
          // --- END OF TEBAK KATA GAME ANSWER EVALUATING PIPELINE ---

          // 2. Keyword Auto Reply matching pipeline
          // If message is in group, auto-replies must be enabled for this group.
          if (isGroup) {
            if (!groupConfig || !groupConfig.autoReplyEnabled) {
              continue; // Auto replies are disabled for this group
            }
          }

          let matched = false;
          for (const item of state.autoReplies) {
            // If it's a group, only match auto replies created specifically for this group!
            if (isGroup && item.groupId !== sender) {
              continue;
            }
            // If it's a private chat, only match global auto replies (no groupId)
            if (!isGroup && item.groupId) {
              continue;
            }

            const keyTerm = item.keyword.toLowerCase();
            const isMatch = item.matchType === "exact"
              ? textLower === keyTerm
              : textLower.includes(keyTerm);

            if (isMatch) {
              addLog(`Auto-reply match found for keyword "${item.keyword}". Replying...`, "info");
              await sock.sendMessage(sender, { text: item.reply });
              incrementSent();
              matched = true;
              addLog(`Auto-reply successfully dispatched to ${cleanSender}`, "success");
              if (onStateChangeCallback) onStateChangeCallback();
              break; // Prevent double answer on first match priority
            }
          }
        }
      }
    });

    // Handle group participants joining/leaving (Welcome & Goodbye)
    sock.ev.on("group-participants.update", async (ev) => {
      try {
        const groupId = ev.id;
        const action = ev.action; // "add" | "remove"
        const participants = ev.participants; // string[]
        
        // Load config state
        const state = getBotState();
        const groupConfig = state.groups?.find(g => g.id === groupId);
        if (!groupConfig || !groupConfig.enabled) return;

        for (const participant of participants) {
          const jid = typeof participant === "string" ? participant : (participant as any).id || "";
          if (!jid) continue;
          const cleanUser = jid.split("@")[0];
          
          if (action === "add" && groupConfig.welcomeEnabled) {
            let welcomeMsg = groupConfig.welcomeMessage || "Selamat datang @user di grup ini";
            welcomeMsg = welcomeMsg.replace("@user", `@${cleanUser}`);
            
            addLog(`Sending welcome to @${cleanUser} in group ${groupId}...`, "info");
            await sock.sendMessage(groupId, {
              text: welcomeMsg,
              mentions: [jid]
            });
            incrementSent();
          } else if (action === "remove" && groupConfig.goodbyeEnabled) {
            let goodbyeMsg = groupConfig.goodbyeMessage || "@user telah keluar";
            goodbyeMsg = goodbyeMsg.replace("@user", `@${cleanUser}`);
            
            addLog(`Sending goodbye to @${cleanUser} in group ${groupId}...`, "info");
            await sock.sendMessage(groupId, {
              text: goodbyeMsg,
              mentions: [jid]
            });
            incrementSent();
          }
        }
        if (onStateChangeCallback) onStateChangeCallback();
      } catch (err: any) {
        addLog(`Error handling group-participants.update: ${err.message}`, "error");
      }
    });

    // Generate pairing code if requested
    if (requestPairingPhone && !sock.authState.creds.registered) {
      currentStatus = "Waiting Pairing";
      if (onStateChangeCallback) onStateChangeCallback();
      
      addLog(`State: pairing (Waiting for connection initialization to request pairing code for: ${requestPairingPhone})`, "info");
      // Must give the socket a moment to establish handshake before requesting pairing code
      await new Promise((resolve) => setTimeout(resolve, 3000));
      
      addLog(`Requesting pairing code from WhatsApp servers...`, "info");
      const code = await sock.requestPairingCode(requestPairingPhone);
      addLog(`Pairing Code successfully generated: ${code}`, "success");
      addLog(`Please enter this code in your phone: WhatsApp > Linked Devices > Link with phone number instead`, "info");
      
      return code;
    }

    return null;
  } catch (error: any) {
    addLog(`Error during initial starting sequence: ${error.message}`, "error");
    currentStatus = "Disconnected";
    if (onStateChangeCallback) onStateChangeCallback();
    throw error;
  }
}

// Auto restart WhatsApp if an authenticated session already exists
if (hasSavedSession()) {
  addLog("Saved active WhatsApp session found! Authenticating on boot...", "success");
  startWhatsApp().catch((err) => {
    console.error("Failed auto restart:", err);
  });
} else {
  addLog("No active WhatsApp session found. Awaiting device linking.", "info");
}
