interface DownloadAnchor {
  href: string
  download: string
  click(): void
}

interface DownloadDependencies {
  fetcher: typeof fetch
  createAnchor: () => DownloadAnchor
  createObjectURL: (blob: Blob) => string
  revokeObjectURL: (url: string) => void
}

function browserDependencies(): DownloadDependencies {
  return {
    fetcher: fetch,
    createAnchor: () => document.createElement('a'),
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
  }
}

export async function downloadLoanReport(
  loanId: string,
  dependencies: DownloadDependencies = browserDependencies()
): Promise<void> {
  const response = await dependencies.fetcher(`/api/loans/${loanId}/report`)

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(body?.error || 'Failed to export PDF')
  }

  const disposition = response.headers.get('content-disposition') || ''
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] || `loan-${loanId}-report.pdf`
  const objectUrl = dependencies.createObjectURL(await response.blob())

  try {
    const anchor = dependencies.createAnchor()
    anchor.href = objectUrl
    anchor.download = filename
    anchor.click()
  } finally {
    dependencies.revokeObjectURL(objectUrl)
  }
}
