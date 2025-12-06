# Terse - The best Tool For Keeping Notion Up to Date With External Data

## Package Manager

This project uses **pnpm** (not npm or yarn). Install it if you haven't:

```bash
npm install -g pnpm
```

Then install dependencies:

```bash
# In /frontend
pnpm install

# In /backend
pnpm install
```

## Database Migrations

We use Prisma with migrations.

1. Update the schema file. When you are happy, run the following **in the /backend folder**

```bash
pnpm exec prisma migrate dev --name <some_name>
```

When you are happy with local changes, you can push to prod. 

Production URL can be found on Render.com dashboard. (Or you can ask me)

```bash
DATABASE_URL="your_production_url" pnpm exec prisma migrate deploy
```
