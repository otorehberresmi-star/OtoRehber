# OtoRehber API Edge Function

Mobil uygulamanın kritik Supabase yazma/okuma işlemlerini doğrudan tablo veya
storage üzerinden yapmak yerine bu ara katmana taşıması için oluşturuldu.

## Deploy

```bash
supabase functions deploy otorehber-api
```

Function içinde şu Supabase secrets kullanılır:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Supabase bu iki değeri genellikle function ortamına sağlar. Lokal geliştirmede
eksikse `supabase secrets set` ile eklenmelidir.

## Mobil uygulama ayarı

Varsayılan olarak mobil uygulama şu adrese gider:

```text
EXPO_PUBLIC_SUPABASE_URL/functions/v1/otorehber-api
```

İleride özel domain kullanırsak `.env` içine şu eklenebilir:

```env
EXPO_PUBLIC_API_BASE_URL=https://api.otorehber.com
```

Bu değer mobilde sadece API adresidir; `service_role` veya üçüncü parti API
anahtarları mobil uygulamaya konulmamalıdır.

## Mevcut route'lar

- `POST /push-tokens/register`
- `POST /legal-consents/register`
- `POST /storage/private-signed-url`
- `POST /account/delete`

Tüm route'lar kullanıcının Supabase access token'ı ile çağrılır ve token function
içinde doğrulanır.
