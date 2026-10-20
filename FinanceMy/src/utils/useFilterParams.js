import { useCallback } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'

export function useFilterParams() {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const updateParams = useCallback((update, options = { replace: true }) => {
    // BrowserRouter updates the address before its deferred React render.
    // Merge rapid input events against that address, not a stale render.
    const current = new URLSearchParams(window.location.search)
    setParams(typeof update === 'function' ? update(current) : update, { state: location.state, ...options })
  }, [setParams, location.state])
  return [params, updateParams]
}
