// vitest global setup — runs once before any test file.
//
// Brings in jest-dom matchers (toBeInTheDocument, toHaveClass, etc.)
// and wires RTL cleanup to vitest's afterEach. RTL's auto-cleanup is
// jest-only — vitest needs the explicit hook or DOM accumulates
// across tests in the same file.

import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

afterEach(() => {
  cleanup()
})
