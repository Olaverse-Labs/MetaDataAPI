const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const helmet = require('helmet');
const dns = require('dns').promises;
const { URL } = require('url');
const http = require('http');
const https = require('https');

const app = express();
app.use(cors());
app.use(helmet());
app.use(express.json());

function getFavicon($, baseUrl) {
  let favicon = $('link[rel="icon"]').attr('href') || $('link[rel="shortcut icon"]').attr('href');
  if (favicon && !favicon.startsWith('http')) {
    try {
      const url = new URL(favicon, baseUrl);
      favicon = url.href;
    } catch {}
  }
  return favicon || null;
}

function getCanonical($, baseUrl) {
  let canonical = $('link[rel="canonical"]').attr('href');
  if (canonical && !canonical.startsWith('http')) {
    try {
      const url = new URL(canonical, baseUrl);
      canonical = url.href;
    } catch {}
  }
  return canonical || baseUrl;
}

function getMetaTags($) {
  const metaTags = [];
  $('meta').each((_, el) => {
    const attribs = el.attribs;
    const tag = {};
    if (attribs.charset) tag.charset = attribs.charset;
    if (attribs.name) tag.name = attribs.name;
    if (attribs.property) tag.property = attribs.property;
    if (attribs.content) tag.content = attribs.content;
    if (Object.keys(tag).length > 0) metaTags.push(tag);
  });
  return metaTags;
}

function getStats(html, $) {
  return {
    bytes: Buffer.byteLength(html),
    number_of_scripts: $('script').length,
    number_of_stylesheets: $('link[rel="stylesheet"]').length,
  };
}

function getLanguage($) {
  // Try <html lang="...">
  const lang = $('html').attr('lang');
  if (lang) return lang;
  // Try meta tags
  const metaLang = $('meta[http-equiv="content-language"]').attr('content') || $('meta[name="language"]').attr('content');
  return metaLang || null;
}

function getSocialLinks($) {
  const socialDomains = [
    'facebook.com', 'twitter.com', 'linkedin.com', 'instagram.com', 'youtube.com', 't.me', 'pinterest.com', 'github.com'
  ];
  const links = [];
  $('a[href]').each((_, el) => {
    const href = el.attribs.href;
    if (socialDomains.some(domain => href && href.includes(domain))) {
      links.push(href);
    }
  });
  return [...new Set(links)];
}

async function fetchText(url) {
  try {
    const res = await axios.get(url, { timeout: 5000 });
    return res.data;
  } catch {
    return null;
  }
}

function getSelectedHeaders(headers) {
  const keys = ['server', 'set-cookie', 'cache-control', 'content-type'];
  const result = {};
  for (const key of keys) {
    if (headers[key]) result[key] = headers[key];
  }
  return result;
}

async function getTTFB(url) {
  return new Promise((resolve) => {
    try {
      const { protocol } = new URL(url);
      const mod = protocol === 'https:' ? https : http;
      const start = Date.now();
      let ttfb = null;
      const req = mod.get(url, (res) => {
        ttfb = Date.now() - start;
        res.resume();
        res.on('end', () => resolve(ttfb));
      });
      req.on('error', () => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

app.post('/scrape', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing url' });
  let fetchStart = Date.now();
  try {
    // TTFB
    const ttfb = await getTTFB(url);
    // Main fetch
    const response = await axios.get(url, { timeout: 10000 });
    const html = response.data;
    const $ = cheerio.load(html);
    const baseUrl = response.request.res.responseUrl || url;
    const canonical = getCanonical($, baseUrl);
    const favicon = getFavicon($, baseUrl);
    const meta_tags = getMetaTags($);
    const title = $('title').text() || null;
    const stats = getStats(html, $);
    stats.fetch_duration = Date.now() - fetchStart;
    stats.ttfb = ttfb;
    const parsedUrl = new URL(baseUrl);
    let ip_address = null;
    try {
      const addresses = await dns.lookup(parsedUrl.hostname);
      ip_address = addresses.address;
    } catch {}
    const host = {
      domain: parsedUrl.hostname,
      ip_address,
      scheme: parsedUrl.protocol.replace(':', ''),
    };
    // Robots.txt & Sitemap.xml
    const robots_url = `${parsedUrl.protocol}//${parsedUrl.hostname}/robots.txt`;
    const sitemap_url = `${parsedUrl.protocol}//${parsedUrl.hostname}/sitemap.xml`;
    const [robots_txt, sitemap_xml] = await Promise.all([
      fetchText(robots_url),
      fetchText(sitemap_url)
    ]);
    // Social links
    const social_links = getSocialLinks($);
    // HTTP headers
    const selected_headers = getSelectedHeaders(response.headers);
    // Language
    const language = getLanguage($);
    res.json({
      canonical,
      favicon,
      host,
      meta_tags,
      stats,
      title,
      robots_txt,
      sitemap_xml,
      social_links,
      selected_headers,
      language,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch or parse the URL', details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Meta Data API listening on port ${PORT}`);
}); 