# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Google Pay payment reminders (Android)

Build and install with `npm run android` (Android SDK and JDK required). The local
Expo module in `modules/google-pay` is autolinked into native Android builds;
it cannot run in Expo Go, iOS or web.

In the app's Settings page, enable Google Pay reminders, allow Fin notifications,
and grant notification access to **Fin Google Pay payment reminders**. After a
matching outgoing Google Pay/Wallet notification, Fin posts an **Add payment**
notification action. Tap it, review the prefilled amount/date, choose a category,
and save. Pending payments also appear on the main screen and can be dismissed.
Closing a draft leaves it pending. Disabling reminders deletes pending drafts.

This uses Android notification access, not a Google transaction-history API.
Only Google Pay/Wallet packages are processed. Matching alerts stay on-device;
other apps' notification contents are not stored. Detection currently supports
English/German outgoing-payment wording and EUR/USD/GBP/INR amounts. Payments
without a readable matching notification cannot be detected. Failed payments,
refunds, requests, offers and alerts containing multiple amounts are skipped.
Currencies are preserved and totals are shown separately by currency; older
expenses without a currency retain their separate total.

Verification on an Android device:

1. Create a category, enable reminders and grant both permissions.
2. Make a Google Pay payment that issues a matching Wallet notification.
3. Tap **Add payment** with Fin closed, then repeat with Fin open; check the
   amount/date/currency, category selection and persistence after restarting.
4. Check that dismissing or saving removes the pending reminder, and that a
   repeated notification update does not create another expense.
5. Disable reminders and confirm further payments do not create Fin reminders.

Parser unit tests: after `npx expo prebuild --platform android`, run
`cd android && ./gradlew :fin-google-pay:testDebugUnitTest`.
