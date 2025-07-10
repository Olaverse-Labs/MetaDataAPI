# Meta Data API

This API scrapes, parses, and retrieves META tags and other useful information from any URL.

## Features
- Returns canonical URL, favicon, host info, meta tags, page title, and stats (bytes, fetch duration, number of scripts/stylesheets)
- CORS enabled
- Secure headers with Helmet

## Usage

### 1. Install dependencies
```
npm install
```

### 2. Start the server
```
npm start
```

### 3. Make a request
Send a POST request to `/scrape` with a JSON body:
```json
{
  "url": "https://apilayer.com"
}
```

#### Example response
```json
{
  "canonical": "https://apilayer.com",
  "favicon": "https://cache.apilayer.com/assets/favicon.ico",
  "host": {
    "domain": "apilayer.com",
    "ip_address": "104.26.10.107",
    "scheme": "http"
  },
  "meta_tags": [
    { "charset": "utf-8" },
    { "content": "width=device-width, initial-scale=1, shrink-to-fit=no", "name": "viewport" },
    { "content": "Highly curated API marketplace...", "name": "description" }
    // ...
  ],
  "stats": {
    "bytes": 47323,
    "fetch_duration": 2530.836,
    "number_of_scripts": 31,
    "number_of_stylesheets": 5
  },
  "title": "APILayer - Hassle free API marketplace"
}
```

## Notes
- The API will attempt to resolve the IP address of the host.
- Fetch duration is in milliseconds.
- If a field is missing, it will be `null` or omitted. 