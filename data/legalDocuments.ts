export type LegalDocumentId =
  | "terms"
  | "kvkk"
  | "privacy"
  | "marketing-consent";

export type LegalDocument = {
  id: LegalDocumentId;
  title: string;
  version: string;
  updatedAt: string;
  introduction: string[];
  sections: Array<{
    title: string;
    paragraphs?: string[];
    bullets?: string[];
  }>;
};

export const LEGAL_DOCUMENT_VERSION = "2026-06-27";

export const LEGAL_DOCUMENTS: Record<LegalDocumentId, LegalDocument> = {
  terms: {
    id: "terms",
    title: "OtoRehber Kullanım Şartları ve Kullanıcı Sözleşmesi",
    version: LEGAL_DOCUMENT_VERSION,
    updatedAt: "27 Haziran 2026",
    introduction: [
      "Bu metin, OtoRehber hizmetinin kullanımına ilişkin temel kuralları açıklar.",
    ],
    sections: [
      {
        title: "Hizmetin Kapsamı",
        paragraphs: [
          "OtoRehber; araç deneyimlerinin paylaşılması, araçların karşılaştırılması, topluluklarda iletişim kurulması ve kullanıcı garajı/masraf takibinin yapılması için sunulan bir mobil uygulamadır.",
        ],
      },
      {
        title: "Kullanıcı Sorumluluğu",
        paragraphs: [
          "Kullanıcılar paylaştıkları içeriklerden kendileri sorumludur. Yanıltıcı, hakaret içeren, hukuka aykırı, kişisel verileri izinsiz paylaşan veya üçüncü taraf haklarını ihlal eden içerikler paylaşılmamalıdır.",
          "Kullanıcılar; diğer kullanıcıların, otomotiv/servis şirketlerinin veya üçüncü kişilerin ticari itibarını zedeleyecek, 6102 sayılı Türk Ticaret Kanunu kapsamında haksız rekabet teşkil edebilecek asılsız ve karalayıcı beyanlardan kaçınmayı taahhüt eder.",
          "Kullanıcının hukuka aykırı paylaşımları nedeniyle OtoRehber'in üçüncü kişilere ödemek zorunda kalacağı tazminat, idari para cezası, yargılama gideri ve avukatlık vekalet ücreti gibi bedeller ilgili kullanıcıya rücu edilebilir.",
        ],
      },
      {
        title: "Yasaklı İçerik, Sahte İlan ve Dolandırıcılık Yasağı",
        paragraphs: [
          "OtoRehber temel olarak araç deneyimi, bilgi paylaşımı, topluluk iletişimi ve karşılaştırma platformudur. Platform üzerinden doğrudan satış, ödeme, kapora, emanet hesap veya ilan aracılık hizmeti sunulmaz.",
          "Kullanıcılar; sahte ilan niteliği taşıyan, gerçekte mevcut olmayan araç veya hizmetleri varmış gibi gösteren, kilometre, hasar kaydı, ekspertiz sonucu, fiyat, ruhsat/sahiplik bilgisi, servis geçmişi veya araç görselleri hakkında yanıltıcı bilgi içeren paylaşımlar yapamaz.",
          "Dolandırıcılık, hileli yönlendirme, kapora/ön ödeme talebiyle kullanıcıları zarara uğratma, sahte ekspertiz/servis/galeri kimliği kullanma, üçüncü kişi veya kurumları taklit etme, oltalama bağlantısı paylaşma, kullanıcıyı platform dışı güvensiz ödeme veya iletişim kanallarına zorlama kesinlikle yasaktır.",
          "Çalıntı araç veya parça, sahte/kaçak yedek parça, sahte belge, usulsüz plaka/ruhsat işlemleri, mevzuata aykırı modifikasyon hizmetleri, tehlikeli veya yasadışı ürünler ile yürürlükteki mevzuata göre satışı, tanıtımı veya aracılığı yasak olan ürün ve hizmetlerin paylaşılması yasaktır.",
          "Bu yasaklara aykırı içerikler bildirime gerek olmaksızın kaldırılabilir; ilgili kullanıcının hesabı askıya alınabilir veya kapatılabilir. Gerekli görülen hallerde işlem kayıtları ve ilgili bilgiler mevzuata uygun şekilde yetkili mercilerle paylaşılabilir.",
        ],
      },
      {
        title: "5651 Sayılı Kanun ve İçerik Denetimi",
        paragraphs: [
          "OtoRehber, 5651 sayılı Kanun kapsamında yer sağlayıcı sıfatıyla faaliyet gösterebilir. Kullanıcılar tarafından paylaşılan içeriklerin önceden denetlenmesi yükümlülüğü bulunmamaktadır.",
          "Buna rağmen hakaret, haksız rekabet, marka ihlali, kişilik haklarına saldırı veya hukuka aykırılık teşkil ettiği somut delillerle bildirilen içerikler incelenebilir. OtoRehber, ilgili içeriği yayından kaldırma ve ihlalde bulunan kullanıcının hesabını askıya alma hakkını saklı tutar.",
        ],
      },
      {
        title: "İçeriklerin Görünürlüğü",
        paragraphs: [
          "Topluluk gönderileri, yorumlar, araç deneyimleri ve herkese açık profil bilgileri diğer kullanıcılar tarafından görülebilir. Garaj ve kişisel takip verileri yalnızca ilgili kullanıcıya gösterilecek şekilde tasarlanır.",
        ],
      },
      {
        title: "Araç Bilgileri ve Tavsiyeler",
        paragraphs: [
          "OtoRehber’de yer alan yorumlar kullanıcı deneyimlerine dayanır. Bu içerikler profesyonel ekspertiz, servis, hukuk veya finans tavsiyesi yerine geçmez.",
          "OtoRehber bir iletişim ve bilgi paylaşım platformudur. Kullanıcıların kendi aralarında veya üçüncü taraf servislerle yapacakları araç alım-satım, ekspertiz, servis, yedek parça veya benzeri ticari işlemlerin tarafı, kefili ya da garantörü değildir.",
          "Bu işlemlerden doğabilecek ayıplı ifa, dolandırıcılık, ödeme uyuşmazlığı veya benzeri ihtilaflardan platform sorumlu tutulamaz.",
        ],
      },
      {
        title: "Hesap Güvenliği",
        paragraphs: [
          "Kullanıcı, hesap bilgilerinin güvenliğinden sorumludur. Yetkisiz kullanım fark edilirse destek ekibiyle iletişime geçilmelidir.",
          "Kullanıcı; cihaz güvenliğinden, oltalama (phishing) saldırılarından, zayıf şifre kullanımından veya üçüncü kişilerle hesap/şifre bilgisini paylaşmasından münhasıran sorumludur.",
          "OtoRehber endüstri standartlarında güvenlik önlemleri almak için makul çabayı gösterir. Bununla birlikte SIM kopyalama, kullanıcının ağ bağlantısındaki zafiyetler, kullanıcının cihaz güvenliği eksikleri veya sisteme yönelik dış müdahaleler sonucunda doğabilecek veri kayıpları ve zararlardan, kusuru bulunmadığı ölçüde sorumlu tutulamaz.",
        ],
      },
      {
        title: "Veri Yedekleme ve Hizmet Kesintileri",
        paragraphs: [
          "Uygulama içerisindeki garaj, masraf takibi ve benzeri kişisel kayıtların düzenli kontrolü ve gerekli hallerde yedeklenmesi kullanıcının sorumluluğundadır.",
          "Hizmet güncellemeleri, bakım çalışmaları, sunucu arızaları, üçüncü taraf servis kesintileri veya hesabın pasife alınması gibi durumlarda geçici erişim sorunları yaşanabilir. OtoRehber, makul teknik tedbirleri almakla birlikte bu tür kesinti veya veri kayıplarından kusuru bulunmadığı ölçüde sorumlu tutulamaz.",
        ],
      },
      {
        title: "Hizmet Değişiklikleri",
        paragraphs: [
          "OtoRehber, uygulama özelliklerini, içerik politikalarını ve teknik altyapısını güncelleyebilir.",
        ],
      },
      {
        title: "Uyuşmazlık Çözümü",
        paragraphs: [
          "Kullanıcı, platformla ilgili şikayetlerini öncelikle uygulama içi destek kanalları veya iletişim e-posta adresi üzerinden yazılı olarak iletmeyi kabul eder.",
          "Taraflar arasında doğabilecek hukuki uyuşmazlıklarda, dava açılmadan önce yürürlükteki mevzuatın öngördüğü zorunlu arabuluculuk veya alternatif uyuşmazlık çözüm süreçlerinin tüketilmesi esastır.",
        ],
      },
      {
        title: "İletişim",
        paragraphs: ["Kullanım şartları ile ilgili sorular için: otorehberresmi@gmail.com"],
      },
    ],
  },
  kvkk: {
    id: "kvkk",
    title: "OtoRehber KVKK Aydınlatma Metni",
    version: LEGAL_DOCUMENT_VERSION,
    updatedAt: "26 Haziran 2026",
    introduction: [
      "Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında kişisel verilerin işlenmesi hakkında bilgilendirme amacı taşır.",
    ],
    sections: [
      {
        title: "Veri Sorumlusu",
        paragraphs: [
          "OtoRehber hizmetini sunan uygulama işletmecisi, 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında veri sorumlusu olarak hareket eder. KVKK kapsamındaki başvurular sistemde kayıtlı e-posta adresiniz üzerinden otorehberresmi@gmail.com adresine iletilebilir.",
        ],
      },
      {
        title: "İşlenen Kişisel Veriler",
        bullets: [
          "Kimlik ve iletişim bilgileri: ad soyad, e-posta.",
          "Kullanıcı işlem verileri: hesap, giriş, bildirim tercihleri.",
          "İçerik verileri: yorumlar, gönderiler, araç deneyimleri.",
          "Görsel veriler: profil ve araç görselleri.",
          "Araç/garaj verileri: marka, model, yıl, kilometre, masraf kayıtları.",
          "Teknik veriler: cihaz bilgileri, push token, hata ve kullanım kayıtları.",
        ],
      },
      {
        title: "İşleme Amaçları ve Hukuki Sebepler",
        bullets: [
          "Üyelik ve kimlik doğrulama süreçleri: KVKK m.5/2-c kapsamında sözleşmenin kurulması ve ifası için zorunlu olması.",
          "Uygulama özelliklerinin sunulması: araç kaydı, garaj, masraf takibi, topluluk ve karşılaştırma gibi temel özelliklerin çalışması için KVKK m.5/2-c kapsamında sözleşmenin ifası.",
          "Kullanıcı içeriklerinin yayınlanması: yorum, gönderi, araç deneyimi ve görsellerin kullanıcı tarafından alenileştirilmesi halinde KVKK m.5/2-d kapsamında işlenmesi.",
          "Sistemsel ve operasyonel bildirimlerin gönderilmesi: KVKK m.5/2-c kapsamında sözleşmenin ifası.",
          "Pazarlama veya tanıtım bildirimleri: yalnızca KVKK m.5/1 kapsamında açık rıza verilmesi halinde işlenir; bu rıza aydınlatma metninden ayrı ve önceden işaretlenmemiş bir onayla alınmalıdır.",
          "Güvenlik, kötüye kullanım önleme, erişim kayıtları ve hata giderme: KVKK m.5/2-f kapsamında veri sorumlusunun meşru menfaati.",
          "Yasal yükümlülüklerin yerine getirilmesi: KVKK m.5/2-ç kapsamında veri sorumlusunun hukuki yükümlülüğünü yerine getirmesi için zorunlu olması.",
        ],
      },
      {
        title: "Veri Güvenliği ve Doğruluğu",
        paragraphs: [
          "Platforma girilen iletişim bilgilerinin doğruluğu kullanıcının sorumluluğundadır. OtoRehber, hatalı veri girişlerini önlemek ve hesap güvenliğini artırmak için e-posta doğrulama, şifreleme, erişim kayıtlarının tutulması, güvenli oturum yönetimi ve çift faktörlü doğrulama gibi teknik ve idari tedbirler uygulayabilir.",
        ],
      },
      {
        title: "Aktarım",
        paragraphs: [
          "Kişisel veriler, hizmetin sağlanması için bulut bilişim ve sunucu altyapısı sağlayıcıları, kimlik doğrulama ve veritabanı hizmetleri, dosya depolama hizmetleri, bildirim servisleri, hata izleme/analitik hizmetleri, hukuki ve mali danışmanlar ile hukuken yetkili kamu kurum ve kuruluşlarıyla sınırlı olarak paylaşılabilir.",
          "Yurt dışına veri aktarımı gerektiren altyapı veya servis kullanımlarında KVKK’ya uygun aktarım şartları sağlanır; açık rıza gerektiren hallerde kullanıcıdan ayrıca ve açık şekilde onay alınır.",
          "Kullanıcı verileri, açık rıza olmaksızın farklı platformlar arasında çapraz pazarlama veya veri birleştirme amacıyla ticari olarak kullanılmaz ve rakip gruplarla paylaşılmaz.",
        ],
      },
      {
        title: "Saklama Süresi",
        paragraphs: [
          "Kişisel veriler, işleme amacı devam ettiği sürece ve ilgili mevzuatta öngörülen yasal zamanaşımı süreleri boyunca saklanır. 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun, 6102 sayılı Türk Ticaret Kanunu ve 213 sayılı Vergi Usul Kanunu gibi mevzuattan doğan saklama yükümlülükleri ayrıca dikkate alınabilir.",
          "Saklama süresinin bitmesi veya işleme amacının ortadan kalkması halinde kişisel veriler OtoRehber Saklama ve İmha Politikası uyarınca silinir, yok edilir veya anonim hale getirilir.",
        ],
      },
      {
        title: "İlgili Kişinin Hakları",
        paragraphs: [
          "KVKK madde 11 kapsamında kullanıcılar kişisel verileri hakkında bilgi talep etme, düzeltme, silme, işleme itiraz etme ve zararın giderilmesini talep etme haklarına sahip olabilir.",
        ],
      },
      {
        title: "Başvuru",
        paragraphs: [
          "İlgili kişiler, KVKK m.11 kapsamındaki taleplerini Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ uyarınca yazılı olarak, KEP adresi üzerinden veya sistemimizde kayıtlı e-posta adreslerinden otorehberresmi@gmail.com adresine iletebilir.",
          "Talepler niteliğine göre en geç 30 gün içinde ücretsiz olarak sonuçlandırılır. Üçüncü kişilerin haklarını ihlal edebilecek veri erişim taleplerinde maskeleme veya kapsam daraltma yöntemleri uygulanabilir.",
        ],
      },
    ],
  },
  privacy: {
    id: "privacy",
    title: "OtoRehber Gizlilik Politikası",
    version: LEGAL_DOCUMENT_VERSION,
    updatedAt: "26 Haziran 2026",
    introduction: [
      "Bu politika, OtoRehber'in hangi verileri topladığını ve bu verileri nasıl kullandığını açıklar.",
    ],
    sections: [
      {
        title: "Toplanan Veriler",
        bullets: [
          "Hesap bilgileri: ad soyad, e-posta adresi, kullanıcı kimliği.",
          "Profil bilgileri: profil fotoğrafı, görünen ad.",
          "Kullanıcı içerikleri: araç deneyimleri, yorumlar, topluluk gönderileri, yüklenen görseller.",
          "Garaj verileri: araç marka/model/yıl, kilometre, yakıt ve servis kayıtları.",
          "Kaydedilen araçlar ve takip edilen aramalar.",
          "Bildirim tercihleri ve cihaz push token bilgisi.",
          "Uygulama kullanımına ilişkin teknik kayıtlar.",
        ],
      },
      {
        title: "Verilerin Kullanım Amaçları",
        bullets: [
          "Hesap oluşturma ve giriş işlemleri.",
          "Kullanıcı içeriklerinin yayınlanması.",
          "Garaj ve masraf takibi özelliklerinin çalışması.",
          "Kaydedilen araçlar ve takip edilen aramalar için bildirim üretimi.",
          "Güvenlik, hata ayıklama ve kötüye kullanımın önlenmesi.",
          "Uygulama performansını ve kullanıcı deneyimini iyileştirme.",
        ],
      },
      {
        title: "Veri İşlemenin Hukuki Sebepleri",
        bullets: [
          "Sözleşmenin kurulması veya ifası (KVKK m.5/2-c): hesap bilgileri, kullanıcı kimliği, garaj verileri, kaydedilen araçlar ve takip edilen aramalar; uygulamanın temel fonksiyonlarının sunulması için işlenir.",
          "Veri sorumlusunun meşru menfaati (KVKK m.5/2-f): teknik kayıtlar, hata ayıklama, performans iyileştirme, kötüye kullanımın önlenmesi ve fonksiyonel bildirimler için cihaz push token bilgisi bu kapsamda işlenebilir.",
          "İlgili kişinin kendisi tarafından alenileştirilmiş olması (KVKK m.5/2-d): kullanıcıların herkesin görebileceği şekilde paylaştığı yorumlar, topluluk gönderileri, araç deneyimleri ve görseller bu kapsamda değerlendirilir.",
          "Açık rıza (KVKK m.5/1): pazarlama/ticari ileti gönderimi, hesap için zorunlu olmayan profil fotoğrafı kullanımı ve açık rıza gerektiren yurt dışı veri aktarımı yalnızca kullanıcının ayrı onayıyla yapılır.",
          "Veri sorumlusunun hukuki yükümlülüğü (KVKK m.5/2-ç): 5651 sayılı Kanun ve ilgili mevzuat kapsamında erişim kayıtları ve zorunlu loglar tutulabilir.",
        ],
      },
      {
        title: "Veri Doğrulama ve Güvenlik",
        paragraphs: [
          "Kayıt sırasında girilen iletişim bilgileri, veri doğruluğunu ve hesap güvenliğini sağlamak amacıyla e-posta onay bağlantısı, OTP veya benzeri doğrulama yöntemleriyle doğrulanabilir. Doğrulanmayan hesapların bazı özelliklere erişimi kısıtlanabilir veya hesap aktifleştirilmeyebilir.",
          "OtoRehber; şifreleme, güvenli oturum yönetimi, erişim kayıtlarının tutulması, rol bazlı erişim kontrolleri ve iki faktörlü kimlik doğrulama (2FA) gibi KVKK m.12’ye uygun teknik ve idari tedbirleri uygulamak için makul çabayı gösterir.",
        ],
      },
      {
        title: "Görseller",
        paragraphs: [
          "Profil, araç, garaj ve deneyim görselleri kullanıcı tarafından yüklenir. Topluluk veya deneyim içeriklerine eklenen görseller diğer kullanıcılar tarafından görülebilir.",
          "Kullanıcı, yüklediği görsellerde veya topluluk içeriklerinde üçüncü kişilere ait kişisel verileri (plaka, yüz, özel hayat bilgisi vb.) hukuka aykırı şekilde barındırmadığını beyan ve taahhüt eder.",
          "OtoRehber, hukuka aykırı içerikleri tespit ettiğinde önceden bildirimde bulunmaksızın kaldırma, erişimi engelleme ve hesabı askıya alma hakkını saklı tutar. Bu kapsamdaki ihlallerden doğacak hukuki ve cezai sorumluluk münhasıran kullanıcıya aittir.",
        ],
      },
      {
        title: "Üçüncü Taraf Hizmetler",
        paragraphs: [
          "OtoRehber altyapısında Supabase ve Expo gibi hizmet sağlayıcıları veri işleyen sıfatıyla kullanılabilir. Bu servisler kimlik doğrulama, veritabanı, depolama, bildirim, uygulama dağıtımı ve teknik işletim süreçlerinde rol alabilir.",
          "Veriler, yalnızca hizmetin ifası, güvenlik ve teknik işletim amaçlarıyla; gerekli olduğu ölçüde ve uygun güvenlik tedbirleri alınarak bu hizmet sağlayıcılarla paylaşılabilir.",
          "Bu servislerin sunucularının yurt dışında bulunması veya yurt dışına veri aktarımı gerektirmesi halinde, KVKK’ya uygun aktarım şartları sağlanır; açık rıza gerektiren hallerde kayıt veya ayarlar ekranında ayrıca ve açık şekilde onay alınır.",
        ],
      },
      {
        title: "Rekabet ve Çapraz Kullanım Sınırlaması",
        paragraphs: [
          "Toplanan garaj, kullanıcı ve kullanım verileri; kullanıcının açık rızası olmaksızın üçüncü taraflara ticari avantaj sağlamak amacıyla satılmaz, rakip platformlarla paylaşılmaz ve başka hizmetlerle çapraz pazarlama veya veri birleştirme amacıyla kullanılmaz.",
        ],
      },
      {
        title: "Veri Saklama",
        paragraphs: [
          "Kişisel veriler, işlenme amacı devam ettiği sürece ve ilgili mevzuatın gerektirdiği yasal saklama süreleri boyunca saklanır.",
          "İşleme amacı ortadan kalktığında veya kullanıcının hesap silme talebinden itibaren mevzuatın izin verdiği haller saklı kalmak üzere en geç 30 gün içinde, Kişisel Veri Saklama ve İmha Politikası ve KVKK m.7 uyarınca silinir, yok edilir veya anonim hale getirilir.",
        ],
      },
      {
        title: "Kullanıcı Hakları",
        paragraphs: [
          "Kullanıcılar KVKK m.11 kapsamında kişisel verilerine ilişkin bilgi talep etme, düzeltme, silme, yok etme veya anonim hale getirme talebinde bulunma, işlemeye itiraz etme ve zararın giderilmesini talep etme haklarına sahip olabilir.",
          "Kimlik doğrulama yapılmadan kişisel veri paylaşımı yapılmaz. Üçüncü kişilerin haklarını ihlal edebilecek taleplerde maskeleme, kapsam daraltma veya ek doğrulama yöntemleri uygulanabilir.",
        ],
      },
      {
        title: "İletişim",
        paragraphs: [
          "Kullanıcılar, KVKK m.11 kapsamındaki taleplerini Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ'e uygun olarak sistemde kayıtlı e-posta adreslerinden otorehberresmi@gmail.com adresine iletebilir.",
          "Talepler niteliğine göre en kısa sürede ve en geç 30 gün içinde ücretsiz olarak sonuçlandırılır.",
        ],
      },
    ],
  },
  "marketing-consent": {
    id: "marketing-consent",
    title: "Pazarlama ve İletişim İzni (Açık Rıza Beyanı)",
    version: LEGAL_DOCUMENT_VERSION,
    updatedAt: "26 Haziran 2026",
    introduction: [
      "Bu açık rıza isteğe bağlıdır. Bu onayı vermemeniz veya daha sonra geri almanız, OtoRehber uygulamasındaki temel hizmetlerden yararlanmanıza engel olmaz.",
    ],
    sections: [
      {
        title: "Açık Rıza Beyanı",
        paragraphs: [
          "OtoRehber mobil uygulaması üzerinden tarafıma özel kampanya, promosyon, araç bakım hatırlatmaları ve kişiselleştirilmiş tekliflerin sunulması amacıyla iletişim bilgilerimin (e-posta, uygulama içi bildirim vb.) işlenmesine ve bu kanallar üzerinden tarafıma ticari elektronik ileti gönderilmesine özgür irademle onay veriyorum.",
        ],
      },
      {
        title: "Bilgilendirme ve Haklar",
        bullets: [
          "Hizmetin ön şartı değildir: Bu onayı vermemem veya daha sonra geri almam, OtoRehber uygulamasındaki temel hizmetlerden (araç kaydı, masraf takibi vb.) yararlanmama kesinlikle engel teşkil etmeyecektir.",
          "Geri alma hakkı: İşbu açık rızamı dilediğim zaman, hiçbir gerekçe göstermeksizin geri alabileceğimi biliyorum.",
          "Veri birleştirme yasağı: Verilerimin, açık rızam dışında rakip platformlarla ticari amaçla birleştirilmeyeceğini ve çapraz pazarlamaya konu edilmeyeceğini kabul ve beyan ederim.",
        ],
      },
    ],
  },
};

export const isLegalDocumentId = (
  value: string | string[] | undefined,
): value is LegalDocumentId =>
  typeof value === "string" && value in LEGAL_DOCUMENTS;
