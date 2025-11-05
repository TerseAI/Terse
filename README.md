# Terse - The best Tool For Keeping Notion Up to Date With External Data


## Database Migrations

We use Prisma with migrations.

1. Update the schema file. When you are happy, run the following **in the /backend folder**

```
npx prisma migrate dev --name <some_name>
```

When you are happy with local changes, you can push to prod. 

Production URL can be found on Render.com dashboard. (Or you can ask me)

```
DATABASE_URL="your_production_url" npx prisma migrate deploy
```
