# Deployment Scripts

## Firebase Functions Config & Deploy

### Setup (one-time)

1. Copy the config template and add your values:
   ```bash
   cp functions-config.example.json functions-config.json
   ```
2. Edit `functions-config.json` with your real values (this file is gitignored).

### Adding new config variables

1. Add the new keys to `functions-config.example.json` with placeholder values.
2. Add the same keys to your local `functions-config.json` with real values.
3. The deploy script will set them automatically.

Example – adding a new service:
```json
{
  "inboxroad": { ... },
  "resend": {
    "api_key": "YOUR_API_KEY"
  }
}
```

### Commands

- **Set config only** (syncs `functions-config.json` to Firebase):
  ```bash
  pnpm run set-functions-config
  ```

- **Full deploy** (sets config, then deploys functions):
  ```bash
  pnpm run deploy:functions
  ```
