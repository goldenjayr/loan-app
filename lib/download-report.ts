interface DownloadAnchor {
  href: string
  download: string
  click(): void
}

interface DownloadDependencies {
  createAnchor: () => DownloadAnchor
  appendAnchor: (anchor: DownloadAnchor) => void
  removeAnchor: (anchor: DownloadAnchor) => void
}

function browserDependencies(): DownloadDependencies {
  return {
    createAnchor: () => document.createElement('a'),
    appendAnchor: (anchor) => document.body.appendChild(anchor as HTMLAnchorElement),
    removeAnchor: (anchor) => (anchor as HTMLAnchorElement).remove(),
  }
}

export function downloadLoanReport(
  loanId: string,
  dependencies: DownloadDependencies = browserDependencies()
): void {
  const anchor = dependencies.createAnchor()
  anchor.href = `/api/loans/${loanId}/report`
  anchor.download = `loan-${loanId}-report.pdf`
  dependencies.appendAnchor(anchor)

  try {
    anchor.click()
  } finally {
    dependencies.removeAnchor(anchor)
  }
}
