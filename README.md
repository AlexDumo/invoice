# Invoice CLI

Create a PDF invoice from a local profile.

```bash
pnpm install
./bin/invoice onboard
./bin/invoice acme-redesign 12.5
./bin/invoice acme-redesign --manual 1800
```

`pnpm install` compiles the CLI. `config.json`, `state.json`, and `out/` stay untracked.

## Profiles

`config.json` holds one or more profiles. Each profile name is unique.

- `hourlyRate` — USD per hour, used when you pass hours
- `client.name` — required. `client.address` is optional
- `contractor.name` and `contractor.address` — required

`./bin/invoice onboard` asks for those fields and writes `config.json`.

Without `--manual` / `-m`, the second argument is hours worked and the total is `hours * hourlyRate`, rounded to cents. With `--manual`, pass the total instead and omit hours. Passing both, or neither, is an error.

The profile names `onboard` and `help` are reserved.

Invoice numbers start at `INV-0001` and are stored in `state.json`. Each run writes `out/INV-0001-<profile>.pdf`.

## Commands

```bash
invoice onboard
invoice <profile> <hours>
invoice <profile> -m <amount>
invoice <profile> --manual <amount>
```
