import { useMemo, useRef } from 'react'
import { UrlObject, parse as parseUrl } from 'url'
import { createStoreContext } from '../../lib/context'
import { useState, useCallback, useEffect } from 'react'
import { normalizeLocation } from '../../lib/url'
import { createBrowserHistory, LocationDescriptorObject } from 'history'
import { parse as parseQuery } from 'querystring'

const browserHistory = createBrowserHistory<unknown>({
  forceRefresh: false,
})

export type Url = UrlObject | string
const previousPathname = localStorage.getItem('lastOpenedPagePathname')
const initialLocation = normalizeLocation({
  pathname:
    previousPathname != null
      ? previousPathname
      : browserHistory.location.pathname,
  hash: browserHistory.location.hash,
  search: browserHistory.location.search,
})

function useRouterStore() {
  const [locations, setLocations] = useState<LocationDescriptorObject[]>([
    {
      ...initialLocation,
      state: {},
    },
  ])
  const [currentLocationIndex, setCurrentLocationIndex] = useState<number>(0)

  const [location, setLocation] = useState<{
    state?: any
    hash: string
    search: string
    pathname: string
  }>({
    ...initialLocation,
    state: {},
  })

  const query = useMemo(() => {
    return parseQuery(location.search.slice(1))
  }, [location.search])

  const push = useCallback(
    (url: Url, state: any = {}) => {
      const parsedUrl = typeof url === 'string' ? parseUrl(url) : url

      const location = {
        pathname: parsedUrl.pathname,
        search: parsedUrl.search,
        hash: parsedUrl.hash,
        state: state,
      } as LocationDescriptorObject

      setLocations((prev) => [
        ...prev.slice(0, currentLocationIndex + 1),
        location,
      ])
      setCurrentLocationIndex((prev) => prev + 1)
      browserHistory.push(location)
    },
    [currentLocationIndex]
  )

  const replace = useCallback((urlStr: string) => {
    browserHistory.replace(urlStr)
  }, [])

  const go = useCallback((count: number) => {
    browserHistory.go(count)
  }, [])

  const goBack = useCallback(() => {
    go(-1)
    setCurrentLocationIndex((prev) => prev - 1)
  }, [go])
  const goForward = useCallback(() => {
    go(1)
    setCurrentLocationIndex((prev) => prev + 1)
  }, [go])

  useEffect(() => {
    return browserHistory.listen((blocation) => {
      localStorage.setItem('lastOpenedPagePathname', blocation.pathname)
      setLocation({
        pathname: blocation.pathname,
        hash: blocation.hash,
        search: blocation.search,
        state: blocation.state,
      })
    })
  }, [])

  const router = useMemo(() => {
    return {
      ...location,
      query,
      push,
      replace,
      goBack: currentLocationIndex - 1 >= 0 ? goBack : undefined,
      goForward:
        currentLocationIndex + 1 < locations.length ? goForward : undefined,
    }
  }, [
    location,
    query,
    push,
    replace,
    goBack,
    goForward,
    currentLocationIndex,
    locations,
  ])

  return router
}

export const {
  useStore: useRouter,
  StoreProvider: RouterProvider,
} = createStoreContext(useRouterStore)

export function usePathnameChangeEffect(
  callback: (() => () => void) | (() => void)
) {
  const { pathname } = useRouter()
  const previousPathnameRef = useRef(pathname)
  useEffect(() => {
    if (previousPathnameRef.current === pathname) {
      return
    }
    previousPathnameRef.current = pathname
    return callback()
  }, [pathname, callback])
}
