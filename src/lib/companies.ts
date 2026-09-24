// Large tech employers that have historically sponsored H-1B visas for new
// grads. Policies change year to year — always confirm on the posting.

export interface Company {
  name: string
  domains: string[]
  careers: string
  /** Has an engineering office in Colorado (Boulder / Denver / Fort Collins) */
  colorado?: string
}

export const COMPANIES: Company[] = [
  { name: 'Google', domains: ['google.com'], careers: 'https://www.google.com/about/careers/applications/jobs/results/?q=software%20engineer%20early%20career', colorado: 'Boulder' },
  { name: 'Microsoft', domains: ['microsoft.com'], careers: 'https://jobs.careers.microsoft.com/global/en/search?q=software%20engineer&exp=Students%20and%20graduates' },
  { name: 'Amazon', domains: ['amazon.com', 'amazon.jobs', 'aws.com'], careers: 'https://www.amazon.jobs/en/search?base_query=software+development+engineer+new+grad' },
  { name: 'Meta', domains: ['meta.com', 'fb.com', 'metacareers.com'], careers: 'https://www.metacareers.com/jobs/?q=university%20grad' },
  { name: 'Apple', domains: ['apple.com'], careers: 'https://www.apple.com/careers/us/students.html' },
  { name: 'NVIDIA', domains: ['nvidia.com'], careers: 'https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite?q=new%20grad' },
  { name: 'Salesforce', domains: ['salesforce.com'], careers: 'https://careers.salesforce.com/en/jobs/?search=new+grad' },
  { name: 'Adobe', domains: ['adobe.com'], careers: 'https://careers.adobe.com/us/en/search-results?keywords=university' },
  { name: 'Oracle', domains: ['oracle.com'], careers: 'https://careers.oracle.com/' },
  { name: 'IBM', domains: ['ibm.com'], careers: 'https://www.ibm.com/careers/search?q=software%20engineer%20entry', colorado: 'Boulder' },
  { name: 'Intel', domains: ['intel.com'], careers: 'https://jobs.intel.com/' },
  { name: 'AMD', domains: ['amd.com'], careers: 'https://careers.amd.com/', colorado: 'Fort Collins' },
  { name: 'Qualcomm', domains: ['qualcomm.com'], careers: 'https://careers.qualcomm.com/' },
  { name: 'Cisco', domains: ['cisco.com'], careers: 'https://jobs.cisco.com/' },
  { name: 'Workday', domains: ['workday.com'], careers: 'https://workday.wd5.myworkdayjobs.com/Workday', colorado: 'Boulder' },
  { name: 'Palantir', domains: ['palantir.com'], careers: 'https://www.palantir.com/careers/', colorado: 'Denver' },
  { name: 'Twilio', domains: ['twilio.com', 'sendgrid.com'], careers: 'https://www.twilio.com/en-us/company/jobs', colorado: 'Denver' },
  { name: 'Zoom', domains: ['zoom.us', 'zoom.com'], careers: 'https://careers.zoom.us/', colorado: 'Denver' },
  { name: 'Uber', domains: ['uber.com'], careers: 'https://www.uber.com/us/en/careers/list/?query=new%20grad' },
  { name: 'Stripe', domains: ['stripe.com'], careers: 'https://stripe.com/jobs/search?query=new+grad' },
  { name: 'Databricks', domains: ['databricks.com'], careers: 'https://www.databricks.com/company/careers/open-positions' },
  { name: 'Snowflake', domains: ['snowflake.com'], careers: 'https://careers.snowflake.com/' },
  { name: 'ServiceNow', domains: ['servicenow.com'], careers: 'https://careers.servicenow.com/' },
  { name: 'Intuit', domains: ['intuit.com'], careers: 'https://jobs.intuit.com/' },
  { name: 'PayPal', domains: ['paypal.com', 'pypl.com'], careers: 'https://careers.pypl.com/' },
  { name: 'Visa', domains: ['visa.com'], careers: 'https://corporate.visa.com/en/jobs/' },
  { name: 'Capital One', domains: ['capitalone.com'], careers: 'https://www.capitalonecareers.com/' },
  { name: 'JPMorgan Chase', domains: ['jpmorgan.com', 'jpmchase.com', 'chase.com'], careers: 'https://careers.jpmorgan.com/' },
  { name: 'Bloomberg', domains: ['bloomberg.com', 'bloomberg.net'], careers: 'https://www.bloomberg.com/company/what-we-do/careers/' },
  { name: 'Atlassian', domains: ['atlassian.com'], careers: 'https://www.atlassian.com/company/careers/all-jobs' },
  { name: 'Walmart Global Tech', domains: ['walmart.com'], careers: 'https://careers.walmart.com/technology' },
  { name: 'Micron', domains: ['micron.com'], careers: 'https://careers.micron.com/' },
  { name: 'Airbnb', domains: ['airbnb.com'], careers: 'https://careers.airbnb.com/' },
  { name: 'DoorDash', domains: ['doordash.com'], careers: 'https://careers.doordash.com/' },
  { name: 'Pinterest', domains: ['pinterest.com'], careers: 'https://www.pinterestcareers.com/' },
  { name: 'LinkedIn', domains: [], careers: 'https://careers.linkedin.com/' },
]

const BY_DOMAIN = new Map(COMPANIES.flatMap((c) => c.domains.map((d) => [d, c] as const)))

export function companyByName(name: string): Company | undefined {
  const n = name.trim().toLowerCase()
  return COMPANIES.find((c) => c.name.toLowerCase() === n)
}

export function searchCompanies(query: string, limit = 6): Company[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return COMPANIES.filter((c) => c.name.toLowerCase().includes(q)).slice(0, limit)
}

function titleCase(s: string): string {
  return s
    .split(' ')
    .filter(Boolean)
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ')
}

function fromDomain(host: string): string | null {
  const parts = host.toLowerCase().replace(/^www\./, '').split('.')
  for (let i = 0; i < parts.length - 1; i++) {
    const d = parts.slice(i).join('.')
    const hit = BY_DOMAIN.get(d)
    if (hit) return hit.name
  }
  return null
}

/** Company (and a best-effort title) from a job posting URL. */
export function parseJobUrl(raw: string): { company?: string; title?: string } {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return {}
  }
  const host = url.hostname.toLowerCase()
  const path = url.pathname.split('/').filter(Boolean)
  let company: string | undefined
  if (/greenhouse\.io$/.test(host) || host === 'jobs.lever.co' || host === 'jobs.ashbyhq.com' || host === 'apply.workable.com') {
    company = path[0] ? titleCase(path[0].replace(/[-_]/g, ' ')) : undefined
  } else if (/\.myworkdayjobs\.com$/.test(host)) {
    company = titleCase(host.split('.')[0].replace(/[-_]/g, ' '))
  }
  const known = fromDomain(host) ?? (company ? companyByName(company)?.name : null)
  if (known) company = known
  if (!company && !/linkedin\.com$|indeed\.com$|glassdoor\.com$/.test(host)) {
    const base = host.replace(/^(www|careers|jobs|boards)\./, '').split('.')[0]
    if (base) company = titleCase(base)
  }
  const last = decodeURIComponent(path[path.length - 1] ?? '')
    .replace(/_[A-Z]{1,4}-?\d+.*$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const title = /[a-z]{3,}.*\s.*[a-z]{2,}/i.test(last) && !/^\d+$/.test(last) ? titleCase(last) : undefined
  return { company, title }
}

/** Company from a work email address. */
export function companyFromEmail(email: string): string | undefined {
  const domain = email.split('@')[1]
  if (!domain || /gmail|outlook|hotmail|yahoo|icloud|proton|colorado\.edu/i.test(domain)) return undefined
  return fromDomain(domain) ?? titleCase(domain.split('.')[0])
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}
