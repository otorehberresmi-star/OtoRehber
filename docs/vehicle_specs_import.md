# Vehicle Specs Import

Bu akış `vehicle_specs` tablosunu gerçek teknik verilerle doldurmak için kullanılır.
Uygulamaya teknik veri gömülmez; CSV doğrulanır, Supabase kataloguyla eşleştirilir ve SQL upsert çıktısı üretilir.

## Dosyalar

- `data/vehicle_specs_import.csv`: Doldurulacak CSV şablonu.
- `data/vehicle_variants_catalog.json`: Kullanıcı tarafından sağlanan çok kademeli marka/model/motor/donanım kataloğu.
- `scripts/vehicle-specs-import.js`: CSV doğrulama ve SQL üretim script'i.
- `scripts/vehicle-variants-catalog.js`: JSON kataloğunu doğrular, tekrarları temizler ve Supabase import SQL'i üretir.
- `supabase/vehicle_specs_import.generated.sql`: Script'in ürettiği SQL çıktısı. Bu dosya git'e kaynak veri gibi düşünülmemeli; her importta yeniden üretilebilir.

## CSV Kolonları

Zorunlu:

- `brand`
- `model`
- `source`

Önerilen:

- `year`
- `trim`
- `engine`
- `fuel_type`
- `transmission`
- `body_type`
- `power_hp`
- `torque_nm`
- `fuel_consumption_l_100km`
- `boot_space_l`
- `length_mm`
- `width_mm`
- `height_mm`
- `source_url`

## Akış

1. Gerçek veriyi `data/vehicle_specs_import.csv` içine gir.
2. Doğrula ve SQL üret:

```bash
npm run specs:generate
```

3. Script şu dosyaları üretir:

- `supabase/vehicle_specs_import.generated.sql`
- `supabase/vehicle_specs_missing_catalog.generated.sql`

4. Eğer eksik marka/model varsa önce `vehicle_specs_missing_catalog.generated.sql` dosyasını Supabase SQL Editor'da çalıştır.
5. Sonra `vehicle_specs_import.generated.sql` dosyasını Supabase SQL Editor'da çalıştır.

## Çok Kademeli Katalog

Kullanıcı tarafından sağlanan katalogdan marka → model → motor/yakıt →
donanım ağacını üretmek için:

```bash
npm run catalog:generate
```

Çıktı:

- `supabase/vehicle_variants_catalog_import.generated.sql`

Bu SQL eksik marka/modelleri ekler ve varyantları `vehicle_specs` tablosuna
`user_provided_catalog` kaynağıyla aktarır. Katalogdaki fiyatlar tarihsel olduğu
için yalnızca metadata olarak saklanır; uygulama arayüzünde güncel fiyat gibi
gösterilmez.

## Eşleştirme Mantığı

Script marka/model adlarını normalize eder:

- büyük/küçük harf farkını yok sayar
- fazla boşlukları temizler
- Türkçe karakterleri normalize eder
- `Mercedes Benz`, `Mercedes-Benz` gibi yaygın alias'ları eşler

Model katalogda yoksa veri import edilmez; eksik katalog SQL'i üretilir.

## Karşılaştırmada Seçim Mantığı

Karşılaştırma detayı aynı model için birden fazla teknik satır varsa en güncel yılı ve en son eklenen satırı seçer. Yani önce güncel model yılı, sonra import zamanı tercih edilir.
