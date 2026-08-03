# idaa finance — mobil ilova (Expo)

Offline-first Expo (SDK 54) ilovasi. Web ilova bilan bir xil Supabase loyihasiga
ulanadi va `@mubosher/shared` + `@mubosher/api-client` paketlarini baham ko'radi.

## Lokal ishga tushirish

```bash
npm run dev -w @mubosher/mobile        # Expo dev server
npm run dev:lan -w @mubosher/mobile    # telefon bir Wi-Fi'da bo'lsa
npm run dev:tunnel -w @mubosher/mobile # turli tarmoqda bo'lsa
```

## APK yig'ish (EAS)

> **Buni VPS'da bajarmang.** VPS faqat web ilovani (`/opt/mery`, pm2 `mery-web`)
> yuritadi. APK yig'ish Expo'ning bulut xizmatida ketadi va o'z kompyuteringizdan
> ishga tushiriladi.

`eas-cli` repoda dependency emas — u global asbob. Skriptlar `npx` orqali
chaqiradi, shuning uchun alohida o'rnatish shart emas:

```bash
npx --yes eas-cli@latest login        # Expo akkaunti (app.json owner: amirxon.ai4020)
npm run build:apk -w @mubosher/mobile
```

Yig'ilish tugagach EAS yuklab olish havolasini beradi — APK'ni o'sha yerdan
olasiz.

### Bilib qo'yish kerak bo'lgan narsalar

- **EAS git holatidan yig'adi.** Commit qilinmagan o'zgarishlar APK'ga
  tushmaydi — avval `git commit`, keyin build.
- **Web deploy APK'ni yangilamaydi.** `infra/deploy.sh` faqat web ilovani
  yangilaydi; mobil o'zgarish uchun har safar yangi APK kerak.
- `--local` profili Android SDK + Java o'rnatilgan mashinani talab qiladi;
  odatda bulut varianti (`build:apk`) qulayroq.
- `app.json` dagi `android.package` (`uz.mubosher.mobile`) — ilovaning
  o'zgarmas identifikatori. Uni o'zgartirsangiz Android buni **boshqa ilova**
  deb hisoblaydi: eski APK ustiga yangilanish tushmaydi, qayta o'rnatish
  kerak bo'ladi. Ko'rinadigan nom `app.json` dagi `name` bilan boshqariladi.

## Testlar

```bash
npm run test -w @mubosher/mobile
```
