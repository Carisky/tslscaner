# Zebra MC9300 scanner helper

Приложение настроено под работу со встроенным сканером Zebra MC9300/MC930B через сервис DataWedge. Интерфейс состоит из трёх вкладок:

- **Scan** — слушает DataWedge-интенты (`com.tslscaner.SCAN`), показывает статус, последнее чтение и даёт кнопки для Soft Scan Trigger. Для тестов на эмуляторе есть ручной ввод.
- **List** — временное in-memory хранилище чтений (формат отображения `scan_dd_hh`). Записи можно очистить целиком или удалить долгим нажатием.
- **Send** — собирает буфер в JSON, позволяет отправить его HTTP POST на произвольный endpoint или поделиться текстом через системный Share Sheet.

## Настройка DataWedge

1. На устройстве откройте **DataWedge → Profiles → Add new profile** и назовите профиль `TSLScanProfile`.
2. В **Associated apps** добавьте пакет `com.tslscaner.app` (или оставьте `*`, чтобы профиль применялся ко всем Activity приложения).
3. **Input plugin → Barcode input**: убедитесь, что профиль включён. При необходимости отрегулируйте декодеры (приложение активирует QR / EAN / Code128 / Code39 автоматически через API).
4. **Output plugin → Intent**:
   - Enabled: ON
   - Intent action: `com.tslscaner.SCAN`
   - Intent category: `android.intent.category.DEFAULT`
   - Intent delivery: `Broadcast intent`
5. Отключите **Keystroke output**, чтобы сканер не пытался вводить текст в поля.

После этого физический триггер MC9300 начнёт кидать данные в приложение, а модуль [`react-native-datawedge-intents`](https://www.npmjs.com/package/react-native-datawedge-intents) перехватит интенты.

> ℹ️ Библиотека нативная, поэтому запуск через Expo Go невозможен. Собирайте приложение как development build (`npx expo run:android`) или через EAS.

## Разработка

```bash
npm install
npx expo prebuild --platform android   # один раз, чтобы связать native-модуль DataWedge
npx expo run:android                   # запуск на устройстве Zebra / эмуляторе
```

Веб и iOS-версии работают, но DataWedge там недоступен — используйте ручной ввод во вкладке Scan.

## Payload вкладки Send

Кнопка **Отправить JSON** выполняет POST на указанный URL с телом вида:

```json
{
  "device": { "id": "Zebra-9300", "app": "tslscaner" },
  "comment": "смена А",
  "total": 3,
  "scans": [
    {
      "id": "1731829894000_ab12",
      "code": "1234567890123",
      "labelType": "LABEL-TYPE-CODE128",
      "friendlyName": "scan_17_08",
      "timestamp": "2025-11-17T12:31:34.000Z",
      "source": "hardware"
    }
  ]
}
```

Структуру можно поменять в `app/(tabs)/send.tsx` под собственный бэкенд.
