import { useEffect, useMemo, useState } from 'react'
import { Search, SlidersHorizontal, ArrowUpRight, ArrowDownRight, Newspaper, Activity, Landmark, Info, LoaderCircle, Star } from 'lucide-react'


const categoryMeta = {
  sentiment: { label: 'Sentiment', icon: Newspaper, tone: 'cyan' },
  technical: { label: 'Technical', icon: Activity, tone: 'gold' },
  fundamental: { label: 'Fundamental', icon: Landmark, tone: 'green' },
}

const metrics = [
  { key: 'pe', label: 'P/E', fullName: 'Price to Earnings Ratio', lowerBetter: true, formula: 'Share price ÷ earnings per share', meaning: 'How much investors pay for each dollar of company earnings. A lower number can mean better value, but growth expectations matter too.' },
  { key: 'forwardPe', label: 'Forward P/E', fullName: 'Forward Price to Earnings Ratio', lowerBetter: true, formula: 'Share price ÷ expected future earnings per share', meaning: 'The price paid today compared with expected future earnings. It helps show whether growth is already priced into the stock.' },
  { key: 'peg', label: 'PEG', fullName: 'Price Earnings Growth Ratio', lowerBetter: true, formula: 'P/E ratio ÷ expected earnings growth rate', meaning: 'Puts growth into the valuation picture. Roughly 1 means price and growth are balanced; below 1 may be inexpensive relative to expected growth.' },
  { key: 'pb', label: 'P/B', fullName: 'Price to Book Ratio', lowerBetter: true, formula: 'Share price ÷ book value per share', meaning: 'Compares the stock price with the company’s accounting net assets. It is especially useful for asset-heavy businesses and banks.' },
  { key: 'ps', label: 'P/S', fullName: 'Price to Sales Ratio', lowerBetter: true, formula: 'Market value ÷ annual revenue', meaning: 'Shows what investors pay for each dollar of sales. It is useful when a company is not yet profitable.' },
  { key: 'roe', label: 'ROE', fullName: 'Return On Equity', suffix: '%', lowerBetter: false, formula: 'Net income ÷ shareholder equity × 100', meaning: 'Measures how effectively the company turns shareholders’ money into profit. A higher percentage generally means stronger efficiency.' },
  { key: 'margin', label: 'Net margin', fullName: 'Net Profit Margin', suffix: '%', lowerBetter: false, formula: 'Net income ÷ revenue × 100', meaning: 'Shows how many cents of profit remain from each dollar of sales after expenses, interest, and taxes.' },
  { key: 'debt', label: 'Debt / equity', fullName: 'Debt to Equity Ratio', suffix: '%', lowerBetter: true, formula: 'Total debt ÷ shareholder equity × 100', meaning: 'Shows how much debt the company uses compared with shareholders’ funds. A lower figure usually means less financial risk, although industry norms differ.' },
]

function scoreLabel(score) {
  if (score >= 80) return 'Strong'
  if (score >= 65) return 'Positive'
  if (score >= 50) return 'Neutral'
  return 'Weak'
}

function heatTone(value, values, lowerBetter) {
  const usableValues = values.filter((item) => Number.isFinite(item))
  if (!Number.isFinite(value) || usableValues.length === 0) return 'heat-neutral'
  const min = Math.min(...usableValues)
  const max = Math.max(...usableValues)
  const normalized = max === min ? 0.5 : (value - min) / (max - min)
  const favorable = lowerBetter ? 1 - normalized : normalized
  if (favorable >= 0.66) return 'heat-good'
  if (favorable >= 0.33) return 'heat-mid'
  return 'heat-low'
}

const boundedScore = (value) => Math.max(0, Math.min(100, Math.round(value)))
const numberOrNull = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null

const chartRanges = ['1D', '3D', '1W', '1M', '3M', '6M', '12M']

function HistoricalChart({ ticker }) {
  const [range, setRange] = useState('1M')
  const [points, setPoints] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadChart() {
      setLoading(true)
      try {
        const days = { '1D': 5, '3D': 7, '1W': 14, '1M': 31, '3M': 93, '6M': 186, '12M': 366 }
        const fromDate = new Date()
        fromDate.setDate(fromDate.getDate() - days[range])
        const from = fromDate.toISOString().slice(0, 10)
        const response = await fetch(`/api/nasdaq/api/quote/${encodeURIComponent(ticker)}/historical?assetclass=stocks&fromdate=${from}&limit=500`, { headers: { Accept: 'application/json' } })
        if (!response.ok) throw new Error('Chart unavailable')
        const payload = await response.json()
        const allPoints = (payload.data?.tradesTable?.rows || []).map((row) => ({
          time: new Date(row.date).getTime(),
          value: Number(String(row.close).replace(/[^0-9.-]/g, '')),
        })).filter((point) => Number.isFinite(point.value) && Number.isFinite(point.time)).sort((a, b) => a.time - b.time)
        const quoteResponse = await fetch(`/api/nasdaq/api/quote/${encodeURIComponent(ticker)}/info?assetclass=stocks`)
        const quotePayload = quoteResponse.ok ? await quoteResponse.json() : null
        const livePrice = Number(String(quotePayload?.data?.primaryData?.lastSalePrice || '').replace(/[^0-9.-]/g, ''))
        if (Number.isFinite(livePrice) && allPoints.length && Math.abs(allPoints.at(-1).value - livePrice) > 0.01) {
          allPoints[allPoints.length - 1] = { ...allPoints.at(-1), value: livePrice }
        }
        if (!cancelled) setPoints(allPoints)
      } catch {
        if (!cancelled) setPoints([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (ticker) loadChart()
    return () => { cancelled = true }
  }, [ticker, range])

  const width = 820
  const height = 600
  const left = 68
  const right = 18
  const top = 18
  const bottom = 42
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const values = points.map((point) => point.value)
  const minimum = values.length ? Math.min(...values) : 0
  const maximum = values.length ? Math.max(...values) : 1
  const span = maximum - minimum || 1
  const paddedMinimum = minimum - span * 0.08
  const paddedMaximum = maximum + span * 0.08
  const paddedSpan = paddedMaximum - paddedMinimum || 1
  const line = points.map((point, index) => {
    const x = left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth)
    const y = top + ((paddedMaximum - point.value) / paddedSpan) * plotHeight
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const positive = points.length > 1 && points[points.length - 1].value >= points[0].value
  const dateLabel = (point) => new Date(point.time).toLocaleDateString([], range === '12M' || range === '6M' ? { month: 'short', year: '2-digit' } : { month: 'short', day: 'numeric' })
  const currentPrice = points.at(-1)?.value

  return (
    <section className="chart-panel panel">
      <div className="chart-heading"><div><p className="section-label">PRICE HISTORY</p><h2>{ticker}</h2>{currentPrice != null && <strong className="chart-price">${currentPrice.toFixed(2)}</strong>}</div><div className="range-tabs">{chartRanges.map((item) => <button key={item} className={range === item ? 'active' : ''} onClick={() => setRange(item)}>{item}</button>)}</div></div>
      <div className="chart-wrap">
        {loading ? <p className="chart-message">Loading price history…</p> : points.length ? (
          <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`${ticker} price chart for ${range}; Y axis is price in dollars and X axis is date`}>
            {[0, 1, 2, 3, 4].map((lineIndex) => {
              const y = top + (lineIndex / 4) * plotHeight
              const price = paddedMaximum - (lineIndex / 4) * paddedSpan
              return <g key={lineIndex}><line x1={left} y1={y} x2={width - right} y2={y} className="chart-grid" /><text x={left - 8} y={y + 4} textAnchor="end" className="chart-axis-label">${price.toFixed(2)}</text></g>
            })}
            {[0, 0.25, 0.5, 0.75, 1].map((position, index) => {
              const pointIndex = Math.round(position * (points.length - 1))
              const point = points[pointIndex]
              const x = left + position * plotWidth
              return <text key={index} x={x} y={height - 10} textAnchor={index === 0 ? 'start' : index === 4 ? 'end' : 'middle'} className="chart-axis-label">{dateLabel(point, index, 5)}</text>
            })}
            <text x={width / 2} y={height} textAnchor="middle" className="chart-axis-title">Date</text>
            <text x="14" y={height / 2} textAnchor="middle" transform={`rotate(-90 14 ${height / 2})`} className="chart-axis-title">Price (USD)</text>
            <polyline points={line} fill="none" stroke={positive ? '#248a3d' : '#d70015'} strokeWidth="3" vectorEffect="non-scaling-stroke" />
          </svg>
        ) : <p className="chart-message">Historical prices are temporarily unavailable.</p>}
      </div>
      {points.length > 1 && <div className="chart-summary"><span>Low ${minimum.toFixed(2)}</span><strong className={positive ? 'positive' : 'negative'}>{positive ? '+' : ''}{(((points.at(-1).value - points[0].value) / points[0].value) * 100).toFixed(2)}%</strong><span>High ${maximum.toFixed(2)}</span></div>}
    </section>
  )
}

function getUsMarketStatus() {
  const now = new Date()
  const eastern = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
  }).formatToParts(now)
  const value = (type) => eastern.find((part) => part.type === type)?.value
  const weekday = value('weekday')
  const minutes = Number(value('hour')) * 60 + Number(value('minute'))
  return weekday !== 'Sat' && weekday !== 'Sun' && minutes >= 570 && minutes < 960 ? 'Open' : 'Closed'
}

const latestAnnual = (facts, conceptNames, taxonomies = ['us-gaap'], annualOnly = true) => {
  for (const taxonomy of taxonomies) {
    for (const concept of conceptNames) {
      const units = facts.facts?.[taxonomy]?.[concept]?.units
      const values = units && (units.USD ?? units.shares ?? units['USD/shares'] ?? units.pure)
      const rows = values?.filter((item) => Number.isFinite(item.val) && (!annualOnly || (item.fp === 'FY' && item.form === '10-K')))
        .sort((a, b) => String(b.end).localeCompare(String(a.end)))
      if (rows?.length) return rows[0].val
    }
  }
  return null
}

async function fetchCalculatedFundamentals(ticker, price) {
  try {
    const knownCiks = {
      AAPL: '0000320193', AMZN: '0001018724', IBM: '0000051143', JPM: '0000019617',
      META: '0001326801', MSFT: '0000789019', NVDA: '0001045810', PFE: '0000078003',
      TMUS: '0001283699', HPE: '0001645590',
    }
    let cik = knownCiks[ticker]
    if (!cik) {
      const [localMapResponse, remoteMapResponse] = await Promise.all([
        fetch(`${import.meta.env}${import.meta.env.BASE_URL}company_tickers || `${import.meta.BASE_URL)`,        fetch('/api/sec-files/files/company_tickers.json').catch(() => null),
      ])
      let company = null
      if (localMapResponse.ok) {
        const companies = Object.values(await localMapResponse.json())
        company = companies.find((item) => item.ticker?.toUpperCase() === ticker)
      }
      if (!company && remoteMapResponse?.ok) {
        const companies = Object.values(await remoteMapResponse.json())
        company = companies.find((item) => item.ticker?.toUpperCase() === ticker)
      }
      cik = company?.cik_str ? String(company.cik_str).padStart(10, '0') : null
    }
    if (!cik) return null
    const factsResponse = await fetch(`/api/sec/api/xbrl/companyfacts/CIK${cik}.json`)
    if (!factsResponse.ok) return null
    const facts = await factsResponse.json()
    const netIncome = latestAnnual(facts, ['NetIncomeLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic', 'ProfitLoss'])
    const revenue = latestAnnual(facts, ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet', 'OperatingRevenue'])
    const equity = latestAnnual(facts, ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest', 'PartnersCapitalAccount'])
    const reportedLiabilities = latestAnnual(facts, ['Liabilities'])
    const assets = latestAnnual(facts, ['LiabilitiesAndStockholdersEquity'])
    const liabilities = reportedLiabilities ?? (assets && equity ? assets - equity : null)
    const shares = latestAnnual(facts, ['EntityCommonStockSharesOutstanding', 'CommonStockSharesOutstanding', 'CommonStockSharesIssued'], ['dei', 'us-gaap'], false)
    const eps = netIncome && shares ? netIncome / shares : null
    const marketCap = price && shares ? price * shares : null
    return {
      pe: eps ? price / eps : null,
      forwardPe: null,
      peg: null,
      pb: marketCap && equity ? marketCap / equity : null,
      ps: marketCap && revenue ? marketCap / revenue : null,
      roe: netIncome && equity ? (netIncome / equity) * 100 : null,
      margin: netIncome && revenue ? (netIncome / revenue) * 100 : null,
      debt: liabilities && equity ? (liabilities / equity) * 100 : null,
    }
  } catch {
    return null
  }
}

async function fetchYahooTicker(ticker) {
  const quoteResponse = await fetch(`/api/nasdaq/api/quote/${encodeURIComponent(ticker)}/info?assetclass=stocks`, {
    headers: { Accept: 'application/json, text/plain, */*' },
  })
  if (!quoteResponse.ok) throw new Error('Ticker data is unavailable right now.')
  const quotePayload = await quoteResponse.json()
  const quote = quotePayload.data
  if (!quote?.symbol) throw new Error(`No market data found for ${ticker.toUpperCase()}.`)

  let fundamentals = {}
  try {
    const fundamentalsResponse = await fetch(`/api/yahoo/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=defaultKeyStatistics,financialData,summaryProfile`)
    if (fundamentalsResponse.ok) fundamentals = (await fundamentalsResponse.json()).quoteSummary?.result?.[0] ?? {}
  } catch {
    fundamentals = {}
  }

  const meta = quote
  const stats = fundamentals.defaultKeyStatistics ?? {}
  const financial = fundamentals.financialData ?? {}
  const profile = fundamentals.summaryProfile ?? {}
  const numericFromString = (value) => Number.parseFloat(String(value ?? '').replace(/[^0-9.-]/g, '')) || null
  const price = numericFromString(meta.primaryData?.lastSalePrice)
  const change = numericFromString(meta.primaryData?.percentageChange)
  const fiftyTwoWeekHigh = null
  const fiftyTwoWeekLow = null
  const technicalPosition = 50
  const calculated = await fetchCalculatedFundamentals(ticker, price)
  const pe = calculated?.pe ?? numberOrNull(stats.trailingPE?.raw)
  const forwardPe = calculated?.forwardPe ?? numberOrNull(stats.forwardPE?.raw)
  const peg = calculated?.peg ?? numberOrNull(stats.pegRatio?.raw)
  const pb = calculated?.pb ?? numberOrNull(stats.priceToBook?.raw)
  const ps = calculated?.ps ?? numberOrNull(stats.priceToSalesTrailing12Months?.raw)
  const roe = calculated?.roe ?? (numberOrNull(financial.returnOnEquity?.raw) * 100)
  const margin = calculated?.margin ?? (numberOrNull(financial.profitMargins?.raw) * 100)
  const debt = calculated?.debt ?? numberOrNull(financial.debtToEquity?.raw)
  const valuationScore = pe ? boundedScore(100 - Math.max(0, Math.min(100, pe * 2))) : 50

  return {
    ticker: meta.symbol || ticker.toUpperCase(),
    name: meta.companyName || meta.symbol || ticker.toUpperCase(),
    sector: profile.sector || 'US listed equity',
    price,
    change,
    sentiment: boundedScore(50 + change * 2.5),
    technical: boundedScore(technicalPosition * 0.7 + change * 1.5 + 15),
    fundamental: boundedScore(valuationScore * 0.6 + (margin ?? 15) * 0.7),
    pe, forwardPe, peg, pb, ps, roe, margin, debt,
    marketStatus: meta.marketStatus || getUsMarketStatus(),
    isLive: true,
  }
}

export default function App() {
  const [query, setQuery] = useState('')
  const [tickerInput, setTickerInput] = useState('')
  const [category, setCategory] = useState('sentiment')
  const [selected, setSelected] = useState(null)
  const [liveStocks, setLiveStocks] = useState([])
  const [activeView, setActiveView] = useState('Overview')
  const [watchlist, setWatchlist] = useState(() => new Set(JSON.parse(localStorage.getItem('correa-watchlist') ?? '[]')))
  const [comparison, setComparison] = useState([])
  const [marketStatus, setMarketStatus] = useState(getUsMarketStatus())
  const [lookupState, setLookupState] = useState({ loading: false, error: '' })
  const [universeLoading, setUniverseLoading] = useState(false)
  const [chartRange, setChartRange] = useState('1M')
  const [chartPoints, setChartPoints] = useState([])
  const marketStocks = useMemo(() => [...liveStocks], [liveStocks])

  useEffect(() => {
    let cancelled = false
    async function loadUniverse() {
      setUniverseLoading(true)
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}sp500.csv`)
        const csv = await response.text()
        const symbols = csv.split('\n').slice(1).map((row) => row.split(',')[0].replace(/"/g, '').trim()).filter(Boolean).slice(0, 20)
        for (const symbol of symbols) {
          if (cancelled) break
          if (liveStocks.some((stock) => stock.ticker === symbol)) continue
          try {
            const stock = await fetchYahooTicker(symbol)
            if (!cancelled) setLiveStocks((current) => [...current.filter((item) => item.ticker !== stock.ticker), stock])
          } catch {
            // A provider failure should not stop the remaining S&P universe.
          }
          await new Promise((resolve) => setTimeout(resolve, 180))
        }
      } finally {
        if (!cancelled) setUniverseLoading(false)
      }
    }
    loadUniverse()
    return () => { cancelled = true }
  }, [])

  function toggleComparison(ticker) {
    setComparison((current) => current.includes(ticker)
      ? current.filter((item) => item !== ticker)
      : current.length < 3 ? [...current, ticker] : current)
  }

  function toggleWatchlist(ticker) {
    setWatchlist((current) => {
      const next = new Set(current)
      next.has(ticker) ? next.delete(ticker) : next.add(ticker)
      localStorage.setItem('correa-watchlist', JSON.stringify([...next]))
      return next
    })
  }

  async function loadTicker(event) {
    event.preventDefault()
    const ticker = tickerInput.trim().toUpperCase()
    if (!ticker) return
    setLookupState({ loading: true, error: '' })
    try {
      const liveStock = await fetchYahooTicker(ticker)
      setLiveStocks((current) => [liveStock, ...current.filter((stock) => stock.ticker !== liveStock.ticker)])
      setSelected(liveStock.ticker)
      setMarketStatus(liveStock.marketStatus)
      setTickerInput('')
    } catch (error) {
      setLookupState({ loading: false, error: error.message })
      return
    }
    setLookupState({ loading: false, error: '' })
  }

  const filteredStocks = useMemo(() => {
    const term = query.trim().toLowerCase()
    return marketStocks.filter((stock) => activeView !== 'Watchlist' || watchlist.has(stock.ticker))
      .filter((stock) => !term || stock.ticker.toLowerCase().includes(term) || stock.name.toLowerCase().includes(term))
      .sort((a, b) => b[category] - a[category])
      .slice(0, 20)
  }, [query, category, marketStocks, activeView, watchlist])

  const current = marketStocks.find((stock) => stock.ticker === selected) ?? marketStocks[0] ?? null

  useEffect(() => {
    const peers = {
      T: ['VZ', 'TMUS'], VZ: ['T', 'TMUS'], TMUS: ['T', 'VZ'], IBM: ['MSFT', 'ORCL'], HPE: ['DELL', 'CSCO'],
      AAPL: ['MSFT', 'GOOG'], MSFT: ['AAPL', 'GOOG'], NVDA: ['AMD', 'INTC'], AMZN: ['WMT', 'TGT'],
      JPM: ['BAC', 'C'], XOM: ['CVX', 'COP'], GE: ['RTX', 'BA'], RTX: ['GE', 'BA'], BA: ['GE', 'RTX'],
    }
    if (!current) return
    let cancelled = false
    ;(async () => {
      for (const ticker of peers[current.ticker] || []) {
        if (cancelled) break
        try {
          const peer = await fetchYahooTicker(ticker)
          if (!cancelled) setLiveStocks((existing) => [...existing.filter((stock) => stock.ticker !== peer.ticker), peer])
        } catch {
          // Keep the selected stock usable if a peer provider request fails.
        }
      }
    })()
    return () => { cancelled = true }
  }, [current?.ticker])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">C</span><span>Correa Stock Analysis</span></div>
        <nav aria-label="Main navigation">
          {['Overview', 'S&P Leaders', 'Watchlist', 'Markets'].map((view) => (
            <button key={view} className={`nav-link ${activeView === view ? 'active' : ''}`} onClick={() => setActiveView(view)}>{view}</button>
          ))}
        </nav>
        <button className="icon-button" aria-label="Search"><Search size={19} /></button>
      </header>

      <main>
        <section className="page-heading">
          <div>
            <p className="eyebrow">MARKET INTELLIGENCE</p>
            <h1>{activeView === 'Overview' ? 'Stock comparison' : activeView === 'S&P Leaders' ? 'S&P 500 leaders' : activeView === 'Watchlist' ? 'My watchlist' : 'Market overview'}</h1>
            <p className="subtitle">{activeView === 'Markets' ? 'Track broad market direction and benchmark performance.' : 'Compare sentiment, technical strength and fundamental value.'}</p>
          </div>
          <div className="market-status"><span className={`status-dot ${marketStatus === 'Open' ? 'open' : 'closed'}`} /> US markets {marketStatus.toLowerCase()} <span>•</span> Live data</div>
        </section>

        <form className="ticker-form" onSubmit={loadTicker} aria-label="Load a live ticker">
          <label>
            <Search size={18} />
            <input value={tickerInput} onChange={(event) => setTickerInput(event.target.value)} placeholder="Load live ticker, e.g. AAPL" />
          </label>
          <button type="submit" disabled={lookupState.loading}>
            {lookupState.loading ? <LoaderCircle className="spin" size={17} /> : <ArrowUpRight size={17} />}
            {lookupState.loading ? 'Loading' : 'Load ticker'}
          </button>
        </form>
        {lookupState.error && <p className="lookup-error" role="alert">{lookupState.error}</p>}

        {activeView !== 'Markets' && activeView !== 'S&P Leaders' && comparison.length > 0 && (
          <section className="comparison-tray" aria-label="Stock comparison selection">
            <div><span>COMPARE</span><strong>{comparison.length}/3 selected</strong></div>
            {comparison.map((ticker) => <button key={ticker} onClick={() => toggleComparison(ticker)}>{ticker}<span>×</span></button>)}
          </section>
        )}

        {activeView === 'Markets' && (
          <section className="market-grid" aria-label="Market indexes">
            {[
              ['S&P 500', '6,644.85', '+0.42%', 'US large cap'],
              ['Nasdaq 100', '24,702.51', '+0.68%', 'US technology'],
              ['Dow Jones', '46,397.89', '-0.16%', 'US blue chip'],
              ['Russell 2000', '2,423.75', '+0.31%', 'US small cap'],
            ].map(([name, value, change, description]) => (
              <article className="market-card panel" key={name}>
                <span>{description}</span><strong>{name}</strong><b>{value}</b><small className={change.startsWith('+') ? 'positive' : 'negative'}>{change}</small>
              </article>
            ))}
          </section>
        )}

        {activeView === 'S&P Leaders' && <section className="leaders-controls" aria-label="Ranking categories">
          {Object.entries(categoryMeta).map(([key, meta]) => (
            <button key={key} className={category === key ? 'category-tab active' : 'category-tab'} onClick={() => setCategory(key)}>{meta.label}</button>
          ))}
        </section>}

        {activeView === 'Overview' && current && (
          <section className="overview-competitors panel">
            <div className="panel-heading"><div><p className="section-label">PEER COMPARISON</p><h2>{current.ticker} vs. competitors</h2></div><div className="peer-legend"><span><i className="strong" />Strongest</span><span><i className="middle" />Middle</span><span><i className="weak" />Weakest</span></div></div>
            <div className="peer-comparison-grid">
              {(() => {
                const peers = {
                  T: ['VZ', 'TMUS'], VZ: ['T', 'TMUS'], TMUS: ['T', 'VZ'], IBM: ['MSFT', 'ORCL'], HPE: ['DELL', 'CSCO'],
                  AAPL: ['MSFT', 'GOOG'], MSFT: ['AAPL', 'GOOG'], NVDA: ['AMD', 'INTC'], AMZN: ['WMT', 'TGT'],
                  JPM: ['BAC', 'C'], XOM: ['CVX', 'COP'], GE: ['RTX', 'BA'], RTX: ['GE', 'BA'], BA: ['GE', 'RTX'],
                }
                const tickers = [current.ticker, ...(peers[current.ticker] || [])].slice(0, 3)
                const peerStocks = tickers.map((ticker) => marketStocks.find((item) => item.ticker === ticker) || {
                  ticker, name: ticker, change: null, sentiment: null, technical: null, fundamental: null,
                  pe: null, forwardPe: null, pb: null, ps: null, roe: null, margin: null, debt: null, loadingPeer: true,
                })
                const peerMetrics = [
                  ...Object.entries(categoryMeta).map(([key, meta]) => ({ key, label: meta.label, lowerBetter: false })),
                  { key: 'priceChange', label: 'Price change', lowerBetter: false },
                  { key: 'pe', label: 'P/E', lowerBetter: true },
                  { key: 'forwardPe', label: 'Forward P/E', lowerBetter: true },
                  { key: 'pb', label: 'P/B', lowerBetter: true },
                  { key: 'ps', label: 'P/S', lowerBetter: true },
                  { key: 'roe', label: 'ROE', lowerBetter: false },
                  { key: 'margin', label: 'Net margin', lowerBetter: false },
                  { key: 'debt', label: 'Debt / equity', lowerBetter: true },
                ]
                const peerValue = (stock, key) => key === 'priceChange' ? stock.change : stock[key]
                const strength = (stock, metric) => {
                  const value = peerValue(stock, metric.key)
                  const values = peerStocks.map((peer) => peerValue(peer, metric.key)).filter((item) => Number.isFinite(item)).sort((a, b) => a - b)
                  if (!Number.isFinite(value) || values.length < 2) return 'neutral'
                  const position = values.indexOf(value)
                  const favorablePosition = metric.lowerBetter ? position : values.length - 1 - position
                  if (favorablePosition === values.length - 1) return 'strong'
                  if (favorablePosition === 0) return 'weak'
                  return 'middle'
                }
                return <div className="peer-table" style={{ '--peer-count': peerStocks.length }}>
                  <div className="peer-header-row"><div className="peer-metric-label">Metric</div>{peerStocks.map((stock) => <div key={stock.ticker} className={`peer-company ${stock.loadingPeer ? 'loading-peer' : ''}`}><strong>{stock.ticker}</strong><small>{stock.loadingPeer ? 'Loading competitor…' : stock.name}</small></div>)}</div>
                  {peerMetrics.map((metric) => <div className="peer-data-row" key={metric.key}><div className="peer-metric-name">{metric.label}</div>{peerStocks.map((stock) => {
                    const value = peerValue(stock, metric.key)
                    const formatted = stock.loadingPeer ? 'Loading' : !Number.isFinite(value) ? '—' : ['pe','forwardPe','pb','ps'].includes(metric.key) ? `${value.toFixed(1)}x` : ['roe','margin','debt','priceChange'].includes(metric.key) ? `${value.toFixed(1)}%` : String(Math.round(value))
                    return <div className="peer-value-cell" key={stock.ticker}><b className={`peer-strength ${stock.loadingPeer ? 'loading' : strength(stock, metric)}`}>{formatted}</b></div>
                  })}</div>)}
                </div>
              })()}
            </div>
          </section>
        )}

        {activeView !== 'Markets' && comparison.length > 1 && (
          <section className="compare-panel panel">
            <div className="panel-heading"><div><p className="section-label">SIDE BY SIDE</p><h2>Stock comparison</h2></div><span className="count">{comparison.length} stocks</span></div>
            <div className="compare-table" style={{ '--compare-count': comparison.length }}>
              <div className="compare-labels"><span>Metric</span>{metrics.map((metric) => <span key={metric.key}>{metric.label}</span>)}</div>
              {comparison.map((ticker) => {
                const stock = marketStocks.find((item) => item.ticker === ticker)
                if (!stock) return null
                return <div className="compare-stock" key={ticker}><strong>{ticker}</strong>{metrics.map((metric) => <span key={metric.key}>{stock[metric.key] == null ? '—' : `${stock[metric.key].toFixed(metric.key === 'peg' ? 2 : 1)}${['roe', 'margin', 'debt'].includes(metric.key) ? '%' : metric.key === 'peg' ? 'x' : 'x'}`}</span>)}</div>
              })}
            </div>
          </section>
        )}

        {activeView !== 'Markets' && marketStocks.length === 0 && (
          <section className="empty-state panel"><Search size={26} /><h2>{universeLoading ? 'Loading S&P 500 leaders' : 'Search a stock to begin'}</h2><p>{universeLoading ? 'Live quotes and fundamentals are being collected.' : 'Enter a ticker above to load its live quote and calculated fundamentals.'}</p></section>
        )}

        {activeView === 'S&P Leaders' && marketStocks.length > 0 && <section className="leaders-grid dashboard-grid">
          <div className="ranking-panel panel">
            <div className="panel-heading">
              <div><p className="section-label">S&P 500 · RANKED LIST</p><h2>{categoryMeta[category].label} leaders</h2></div>
              <span className="count">{universeLoading ? 'Loading S&P 500' : `${filteredStocks.length} stocks`}</span>
            </div>
            <div className="stock-list">
              {filteredStocks.map((stock, index) => {
                const ChangeIcon = stock.change >= 0 ? ArrowUpRight : ArrowDownRight
                return (
                  <button key={stock.ticker} className={`stock-row ${selected === stock.ticker ? 'selected' : ''}`} onClick={() => setSelected(stock.ticker)}>
                    <span className="rank">{String(index + 1).padStart(2, '0')}</span>
                    <span className="ticker-block"><strong>{stock.ticker}</strong><small>{stock.name}</small></span>
                    <span className="price-block"><strong>${stock.price.toFixed(2)}</strong><small className={stock.change >= 0 ? 'positive' : 'negative'}><ChangeIcon size={13} />{Math.abs(stock.change).toFixed(2)}%</small></span>
                    <span className="score-block"><strong>{stock[category]}</strong><small>{scoreLabel(stock[category])}</small></span>
                  </button>
                )
              })}
            </div>
          </div>

          {false && <div className="detail-column">
            <section className="company-panel panel">
              <div className="company-identity">
                <div className="ticker-logo">{current.ticker.slice(0, 1)}</div>
                <div><p>{current.name}</p><span>{current.ticker} · {current.sector}</span></div>
              </div>
              <div className="company-actions">
                <button className={`compare-button ${comparison.includes(current.ticker) ? 'selected' : ''}`} onClick={() => toggleComparison(current.ticker)} disabled={!comparison.includes(current.ticker) && comparison.length >= 3}>Compare</button>
                <button className={`watch-button ${watchlist.has(current.ticker) ? 'saved' : ''}`} onClick={() => toggleWatchlist(current.ticker)} aria-label={watchlist.has(current.ticker) ? 'Remove from watchlist' : 'Add to watchlist'} title={watchlist.has(current.ticker) ? 'Remove from watchlist' : 'Add to watchlist'}><Star size={18} fill={watchlist.has(current.ticker) ? 'currentColor' : 'none'} /></button>
                <div className="company-price"><strong>${current.price.toFixed(2)}</strong><span className={current.change >= 0 ? 'positive' : 'negative'}>{current.change >= 0 ? '+' : ''}{current.change.toFixed(2)}%</span></div>
              </div>
            </section>

            <section className="scores panel">
              {Object.entries(categoryMeta).map(([key, meta]) => {
                const Icon = meta.icon
                return (
                  <div className="score-card" key={key}>
                    <div className="score-title"><span className={`score-icon ${meta.tone}`}><Icon size={17} /></span>{meta.label}</div>
                    <div className="score-value-row"><strong>{current[key]}</strong><span>/100</span></div>
                    <div className="score-track"><span className={meta.tone} style={{ width: `${current[key]}%` }} /></div>
                    <small>{scoreLabel(current[key])} signal</small>
                  </div>
                )
              })}
            </section>

            <section className="metrics-panel panel">
              <div className="panel-heading metrics-heading">
                <div><p className="section-label">VALUATION & QUALITY</p><h2>Fundamental metrics</h2></div>
                <div className="heat-legend"><span>Weak</span><i /><i /><i /><span>Strong</span></div>
              </div>
              <div className="metrics-grid">
                {metrics.map((metric) => {
                  const value = current[metric.key]
                  const values = marketStocks.map((stock) => stock[metric.key]).filter((value) => Number.isFinite(value))
                  return (
                    <div className={`metric-card ${heatTone(value, values, metric.lowerBetter)}`} key={metric.key}>
                      <span>{metric.label}<span className="metric-info" tabIndex="0" aria-label={`${metric.label}: ${metric.meaning}`}><Info size={13} /><span className="metric-tooltip" role="tooltip"><strong>{metric.label}: {metric.fullName}</strong><b>Calculation</b>{metric.formula}<b>What it means</b>{metric.meaning}</span></span></span>
                      <strong>{value == null ? '—' : metric.key === 'pe' || metric.key === 'forwardPe' || metric.key === 'peg' || metric.key === 'pb' || metric.key === 'ps' ? `${value.toFixed(metric.key === 'peg' ? 2 : 1)}x` : `${value.toFixed(1)}${metric.suffix}`}</strong>
                      <small>{value == null ? 'Not available' : metric.lowerBetter ? 'Lower is better' : 'Higher is better'}</small>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>}
        </section>}
        {activeView === 'Overview' && marketStocks.length > 0 && <section className="overview-layout dashboard-grid">
          <div className="detail-column">
            <section className="company-panel panel">
              <div className="company-identity"><div className="ticker-logo">{current.ticker.slice(0, 1)}</div><div><p>{current.name}</p><span>{current.ticker} · {current.sector}</span></div></div>
              <div className="company-price"><strong>${current.price.toFixed(2)}</strong><span className={current.change >= 0 ? 'positive' : 'negative'}>{current.change >= 0 ? '+' : ''}{current.change.toFixed(2)}%</span></div>
            </section>
            <section className="scores panel">
              {Object.entries(categoryMeta).map(([key, meta]) => { const Icon = meta.icon; return <div className="score-card" key={key}><div className="score-title"><span className={`score-icon ${meta.tone}`}><Icon size={17} /></span>{meta.label}</div><div className="score-value-row"><strong>{current[key]}</strong><span>/100</span></div><div className="score-track"><span className={meta.tone} style={{ width: `${current[key]}%` }} /></div><small>{scoreLabel(current[key])} signal</small></div> })}
            </section>
            <section className="metrics-panel panel">
              <div className="panel-heading metrics-heading"><div><p className="section-label">VALUATION & QUALITY</p><h2>Fundamental metrics</h2></div><div className="heat-legend"><span>Weak</span><i /><i /><i /><span>Strong</span></div></div>
              <div className="metrics-grid">
                {metrics.map((metric) => { const value = current[metric.key]; const values = marketStocks.map((stock) => stock[metric.key]).filter((item) => Number.isFinite(item)); return <div className={`metric-card ${heatTone(value, values, metric.lowerBetter)}`} key={metric.key}><span>{metric.label}<span className="metric-info" tabIndex="0" aria-label={`${metric.label}: ${metric.meaning}`}><Info size={13} /><span className="metric-tooltip" role="tooltip"><strong>{metric.label}: {metric.fullName}</strong><b>Calculation</b>{metric.formula}<b>What it means</b>{metric.meaning}</span></span></span><strong>{value == null ? '—' : `${value.toFixed(metric.key === 'peg' ? 2 : 1)}${['roe','margin','debt'].includes(metric.key) ? '%' : 'x'}`}</strong><small>{value == null ? 'Not available' : metric.lowerBetter ? 'Lower is better' : 'Higher is better'}</small></div> })}
              </div>
            </section>
            <HistoricalChart ticker={current.ticker} />
          </div>
        </section>}
      </main>
    </div>
  )
}
