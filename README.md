# Comic Frontend

React/Vite frontend for the Comic Catalog microservices.

## Local Development

Start the backend services first:

1. discovery-server
2. comic-info-service
3. comic-rating-service
4. comic-catalog-service

Then install and run the frontend:

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

The dev server proxies `/api` to:

```text
http://localhost:8081
```

## Production Build

```bash
npm run build
npm run preview
```
