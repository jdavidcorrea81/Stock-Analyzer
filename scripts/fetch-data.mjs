// scripts/fetch-data.mjs - builds public/data/stocks.json and history.json
import fs from 'node:fs'

const CONTACT = 'jdavidcorrea@gmail.com' // <-- put your real email here (the SEC asks for one)
const MAX = 100 // how many S&P 500 tickers to load
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getJson(url, headers = {}) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers })
      if (r.ok) return await r.json()
    } catch {}
    await sleep(1000 * (i + 1))
  }
  return null
}

const read = (p, fallback) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return fallback } }
const tickers = fs.readFileSync('public/sp500.csv', 'utf8').split('\n').slice(1)
  .map((r) => r.split(',')[0].replace(/"/g, '').trim()).filter(Boolean).slice(0, MAX)
const companies = Object.values(read('public/company_tickers.json', {}))
const old = read('public/data/stocks.json', { stocks: {} })
const oldHistory = read('public/data/history.json', {})

function latest(facts, names, taxonomies = ['us-gaap'], annualOnly = true) {
  for (const tax of taxonomies) for (const name of names) {
    const units = facts.facts?.[tax]?.[name]?.units
    const vals = units && (units.USD ?? units.shares ?? units['USD/shares'] ?? units.pure)
    const rows = vals?.filter((v) => Number.isFinite(v.val) && (!annualOnly || (v.fp === 'FY' && v.form === '10-K')))
      .sort((a, b) => String(b.end).localeCompare(String(a.end)))
    if (rows?.length) return rows[0].val
  }
  return null
}

const stocks = {}
const history = {}
let ok = 0

for (const ticker of tickers) {
  const yahoo = await getJson(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker.replace('.', '-')}?range=1y&interval=1d`, { 'User-Agent': 'Mozilla/5.0' })
  const res = yahoo?.chart?.result?.[0]
  const stamps = res?.timestamp || []
  const closes = res?.indicators?.quote?.[0]?.close || []
  const pts = stamps.map((t, i) => [t, closes[i]]).filter(([, c]) => Number.isFinite(c)).map(([t, c]) => [t, Math.round(c * 100) / 100])
  const price = res?.meta?.regularMarketPrice
  if (!pts.length || !Number.isFinite(price)) {
    if (old.stocks[ticker]) { stocks[ticker] = old.stocks[ticker]; history[ticker] = oldHistory[ticker] || [] }
    console.log('skip', ticker)
    continue
  }
  const vals = pts.map((p) => p[1])
  const prev = vals.length > 1 ? vals[vals.length - 2] : price
  const ma50 = vals.slice(-50).reduce((a, b) => a + b, 0) / Math.min(50, vals.length)
  const entry = {
    ticker, name: companies.find((c) => c.ticker?.toUpperCase() === ticker)?.title || ticker,
    price, change: ((price - prev) / prev) * 100,
    high52: Math.max(...vals), low52: Math.min(...vals), ma50,
    pe: null, pb: null, ps: null, roe: null, margin: null, debt: null,
  }

  const company = companies.find((c) => c.ticker?.toUpperCase() === ticker)
  if (company) {
    const cik = String(company.cik_str).padStart(10, '0')
    const f = await getJson(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, { 'User-Agent': `StockAnalyzer ${CONTACT}` })
    if (f) {
      const ni = latest(f, ['NetIncomeLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic', 'ProfitLoss'])
      const rev = latest(f, ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet', 'OperatingRevenue'])
      const eq = latest(f, ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'])
      const assets = latest(f, ['LiabilitiesAndStockholdersEquity'])
      const liab = latest(f, ['Liabilities']) ?? (assets && eq ? assets - eq : null)
      const shares = latest(f, ['EntityCommonStockSharesOutstanding', 'CommonStockSharesOutstanding'], ['dei', 'us-gaap'], false)
      const eps = ni && shares ? ni / shares : null
      const cap = shares ? price * shares : null
      Object.assign(entry, {
        pe: eps ? price / eps : null, pb: cap && eq ? cap / eq : null, ps: cap && rev ? cap / rev : null,
        roe: ni && eq ? (ni / eq) * 100 : null, margin: ni && rev ? (ni / rev) * 100 : null, debt: liab && eq ? (liab / eq) * 100 : null,
      })
    }
    await sleep(150)
  }
  stocks[ticker] = entry
  history[ticker] = pts
  ok++
  console.log('ok', ticker)
}

console.log(`Updated ${ok} of ${tickers.length} tickers`)
if (ok === 0) { console.log('No fresh data; keeping existing files.'); process.exit(0) }
fs.mkdirSync('public/data', { recursive: true })
fs.writeFileSync('public/data/stocks.json', JSON.stringify({ updated: new Date().toISOString(), stocks }))
fs.writeFileSync('public/data/history.json', JSON.stringify(history))
