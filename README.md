# Piggy Bank

Piggy Bank is a fresh, simpler classroom banking app for younger students. It uses the same broad idea as ClassBank, but the interface is larger, more visual, and centered on Creative Coins, piggy banks, and short money stories.

## Features

- Teacher name and classroom roster
- Big student piggy bank cards
- Earn and spend Creative Coin actions
- Selected-saver quick actions
- Visual Creative Coin jars
- Student money story statements
- Printable class cards
- Downloadable SVG student cards
- Downloadable dog tag SVGs with logo front and name/QR back
- Teacher camera QR scanning on supported browsers over HTTPS or localhost
- Optional cloud sync with Class Code + Teacher PIN through Supabase
- JSON backup and restore
- Creative Coin logo in `assets/creative-coin-logo.png`
- Little Savers pig icon in `assets/little-saver-pig-icon.png`
- Balance panel pig icon in `assets/balance-pig.png`
- Administration login for viewing all cloud classes and downloading central JSON/SVG files
- Offline app shell through `piggy-bank-v23` service worker cache

## Cloud Sync

1. Create a Supabase project.
2. Open the Supabase SQL Editor.
3. Paste and run `supabase-schema.sql`.
4. Copy your Supabase Project URL and anon public key.
5. Put them into `app.js`:

```js
const SUPABASE_URL = "https://your-project.supabase.co";
const SUPABASE_ANON_KEY = "your-anon-public-key";
```

Teachers can then use the same Class Code and PIN from school or home.

## Administration

Run the latest `supabase-schema.sql` in Supabase to add the admin table and `pb_admin_list_classes` function.

The default admin PIN is:

```text
2468
```

Change it by replacing the `admin_hash` value in `piggy_bank_admin_settings`. The hash is SHA-256 of:

```text
PIGGYBANK-ADMIN:your-pin
```

## Render

If these files are uploaded directly at the GitHub repo root, leave Render's Root Directory blank.

If you keep the files inside a folder instead, set Render's Root Directory to that folder name, for example:

```text
piggy-bank-render
```

No build command is needed. Use `.` as the publish directory.

## Webador

Embed the Render URL in an iframe. Do not paste the app code into Webador.
