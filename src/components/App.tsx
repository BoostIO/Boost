import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Router from './Router'
import { ThemeProvider } from 'styled-components'
import { useDb } from '../lib/db'
import PreferencesModal from './PreferencesModal/PreferencesModal'
import { usePreferences } from '../lib/preferences'
import '../lib/i18n'
import '../lib/analytics'
import CodeMirrorStyle from './CodeMirrorStyle'
import { useEffectOnce } from 'react-use'
import { useRouter } from '../lib/router'
import { values, keys } from '../lib/db/utils'
import {
  addIpcListener,
  removeIpcListener,
  setCookie,
} from '../lib/electronOnly'
import { useGeneralStatus } from '../lib/generalStatus'
import { useBoostNoteProtocol } from '../lib/protocol'
import {
  useBoostHub,
  getBoostHubTeamIconUrl,
  getLegacySessionCookie,
  getDesktopAccessTokenFromSessionKey,
  flushLegacySessionCookie,
  boostHubBaseUrl,
} from '../lib/boosthub'
import {
  boostHubTeamCreateEventEmitter,
  BoostHubTeamCreateEvent,
  BoostHubTeamUpdateEvent,
  boostHubTeamUpdateEventEmitter,
  BoostHubTeamDeleteEvent,
  boostHubTeamDeleteEventEmitter,
  boostHubAccountDeleteEventEmitter,
  boostHubToggleSettingsEventEmitter,
  boostHubLoginRequestEventEmitter,
  boostHubCreateLocalSpaceEventEmitter,
  BoostHubSubscriptionDeleteEvent,
  boostHubSubscriptionDeleteEventEmitter,
  boostHubSubscriptionUpdateEventEmitter,
} from '../lib/events'
import { useRouteParams } from '../lib/routeParams'
import { useStorageRouter } from '../lib/storageRouter'
import ExternalStyle from './ExternalStyle'
import { selectV2Theme } from '../shared/lib/styled/styleFunctions'
import Modal from '../shared/components/organisms/Modal'
import GlobalStyle from '../shared/components/atoms/GlobalStyle'
import { DialogIconTypes, useDialog } from '../shared/lib/stores/dialog'
import Dialog from '../shared/components/organisms/Dialog/Dialog'
import ContextMenu from '../shared/components/molecules/ContextMenu'
import { useCloudIntroModal } from '../lib/cloudIntroModal'
import CloudIntroModal from './organisms/CloudIntroModal'
import AppNavigator from './organisms/AppNavigator'
import Toast from '../shared/components/organisms/Toast'
import styled from '../shared/lib/styled'

const LoadingText = styled.div`
  margin: 30px;
`

const AppContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  display: flex;
`

const App = () => {
  const { initialize, storageMap } = useDb()
  const { push, pathname } = useRouter()
  const [initialized, setInitialized] = useState(false)
  const { setGeneralStatus, generalStatus } = useGeneralStatus()
  const {
    togglePreferencesModal,
    preferences,
    setPreferences,
  } = usePreferences()
  const { fetchDesktopGlobalData } = useBoostHub()
  const routeParams = useRouteParams()
  const { navigate: navigateToStorage } = useStorageRouter()
  const { messageBox } = useDialog()

  useEffectOnce(() => {
    const fetchDesktopGlobalDataOfCloud = async () => {
      const cloudUserInfo = preferences['cloud.user']
      let accessToken: string
      if (cloudUserInfo == null) {
        const legacyCookie = await getLegacySessionCookie()
        if (legacyCookie == null) {
          return
        }

        console.info('Get a new access token from legacy session...')
        const { token } = await getDesktopAccessTokenFromSessionKey(
          legacyCookie.value
        )
        accessToken = token

        await flushLegacySessionCookie()

        await setCookie({
          url: boostHubBaseUrl,
          name: 'desktop_access_token',
          value: token,
          expirationDate: 4766076898395,
        })

        setGeneralStatus({
          boostHubTeams: [],
        })
      } else {
        accessToken = cloudUserInfo.accessToken
      }

      const desktopGlobalData = await fetchDesktopGlobalData(accessToken)
      if (desktopGlobalData.user == null) {
        messageBox({
          title: 'Sign In',
          message: 'Your cloud access token has been expired.',
          buttons: [
            {
              label: 'Sign In Again',
              defaultButton: true,
              onClick: () => {
                push(`/app/boosthub/login`)
                setTimeout(() => {
                  boostHubLoginRequestEventEmitter.dispatch()
                }, 1000)
              },
            },
            {
              label: 'Cancel',
              cancelButton: true,
              onClick: () => {
                setPreferences({
                  'cloud.user': undefined,
                })
                setGeneralStatus({
                  boostHubTeams: [],
                })
              },
            },
          ],
          iconType: DialogIconTypes.Warning,
        })
        return
      }
      const user = desktopGlobalData.user
      setPreferences({
        'cloud.user': {
          id: user.id,
          uniqueName: user.uniqueName,
          displayName: user.displayName,
          accessToken,
        },
      })
      setGeneralStatus({
        boostHubTeams: desktopGlobalData.teams.map((team) => {
          return {
            id: team.id,
            name: team.name,
            domain: team.domain,
            createdAt: team.createdAt,
            subscription: team.subscription,
            personal: team.personal,
            iconUrl:
              team.icon != null
                ? getBoostHubTeamIconUrl(team.icon.location)
                : undefined,
          }
        }),
      })
      return desktopGlobalData
    }

    initialize()
      .then(async (storageMap) => {
        const localSpaces = values(storageMap)

        const globalData = await fetchDesktopGlobalDataOfCloud().catch(
          (error) => {
            console.warn('There was an issue while fetching cloud space data')
            console.warn(error)
          }
        )

        const cloudSpaces = globalData != null ? globalData.teams : []

        if (
          pathname === '' ||
          pathname === '/' ||
          pathname === '/app' ||
          pathname === '/app/storages'
        ) {
          // read location from local storage and set initial page from it if it exists
          const previousPathname = localStorage.getItem(
            'lastOpenedPagePathname'
          )
          if (previousPathname) {
            push(previousPathname)
          } else if (localSpaces.length > 0) {
            push(`/app/storages/${localSpaces[0].id}`)
          } else if (cloudSpaces.length > 0) {
            push(`/app/boosthub/teams/${cloudSpaces[0].domain}`)
          } else {
            if (globalData == null || globalData.user == null) {
              push(`/app/boosthub/login`)
            } else {
              push(`/app/boosthub/teams`)
            }
          }
        }
        setInitialized(true)
      })
      .catch((error) => {
        console.error(error)
      })
  })

  const boostHubTeamsShowPageIsActive =
    routeParams.name === 'boosthub.teams.show'

  useEffect(() => {
    const preferencesIpcEventHandler = () => {
      if (boostHubTeamsShowPageIsActive) {
        boostHubToggleSettingsEventEmitter.dispatch()
      } else {
        togglePreferencesModal()
      }
    }
    addIpcListener('preferences', preferencesIpcEventHandler)

    const createLocalSpaceHandler = () => {
      push('/app/storages')
    }
    addIpcListener('create-local-space', createLocalSpaceHandler)

    const createCloudSpaceHandler = () => {
      push('/app/boosthub/teams')
    }
    addIpcListener('create-cloud-space', createCloudSpaceHandler)

    return () => {
      removeIpcListener('preferences', preferencesIpcEventHandler)
      removeIpcListener('create-local-space', createLocalSpaceHandler)
      removeIpcListener('create-cloud-space', createCloudSpaceHandler)
    }
  }, [togglePreferencesModal, push, boostHubTeamsShowPageIsActive])

  useEffect(() => {
    const boostHubTeamCreateEventHandler = (event: BoostHubTeamCreateEvent) => {
      const createdTeam = event.detail.team
      setGeneralStatus((previousGeneralStatus) => {
        const teamMap =
          previousGeneralStatus.boostHubTeams!.reduce((map, team) => {
            map.set(team.id, team)
            return map
          }, new Map()) || new Map()
        teamMap.set(createdTeam.id, {
          id: createdTeam.id,
          name: createdTeam.name,
          domain: createdTeam.domain,
          iconUrl:
            createdTeam.icon != null
              ? getBoostHubTeamIconUrl(createdTeam.icon.location)
              : undefined,
        })
        return {
          boostHubTeams: [...teamMap.values()],
        }
      })
      push(`/app/boosthub/teams/${createdTeam.domain}`)
    }

    const boostHubTeamUpdateEventHandler = (event: BoostHubTeamUpdateEvent) => {
      const updatedTeam = event.detail.team
      setGeneralStatus((previousGeneralStatus) => {
        const teamMap =
          previousGeneralStatus.boostHubTeams!.reduce((map, team) => {
            map.set(team.id, team)
            return map
          }, new Map()) || new Map()
        teamMap.set(updatedTeam.id, {
          id: updatedTeam.id,
          name: updatedTeam.name,
          domain: updatedTeam.domain,
          iconUrl:
            updatedTeam.icon != null
              ? getBoostHubTeamIconUrl(updatedTeam.icon.location)
              : undefined,
        })
        return {
          boostHubTeams: [...teamMap.values()],
        }
      })
    }

    const boostHubTeamDeleteEventHandler = (event: BoostHubTeamDeleteEvent) => {
      push(`/app`)
      const deletedTeam = event.detail.team
      setGeneralStatus((previousGeneralStatus) => {
        const teamMap =
          previousGeneralStatus.boostHubTeams!.reduce((map, team) => {
            map.set(team.id, team)
            return map
          }, new Map()) || new Map()
        teamMap.delete(deletedTeam.id)
        return {
          boostHubTeams: [...teamMap.values()],
        }
      })
    }

    const boostHubSubscriptioUpdateEventHandler = (
      event: BoostHubSubscriptionDeleteEvent
    ) => {
      const updatedSub = event.detail.subscription
      setGeneralStatus((previousGeneralStatus) => {
        const teamMap =
          previousGeneralStatus.boostHubTeams!.reduce((map, team) => {
            if (updatedSub.teamId === team.id) {
              map.set(team.id, { ...team, subscription: updatedSub })
              return map
            }
            map.set(team.id, team)
            return map
          }, new Map()) || new Map()
        return {
          boostHubTeams: [...teamMap.values()],
        }
      })
    }

    const boostHubSubscriptionDeleteEventHandler = (
      event: BoostHubSubscriptionDeleteEvent
    ) => {
      const deletedSub = event.detail.subscription
      setGeneralStatus((previousGeneralStatus) => {
        const teamMap =
          previousGeneralStatus.boostHubTeams!.reduce((map, team) => {
            if (deletedSub.teamId === team.id) {
              map.set(team.id, { ...team, subscription: undefined })
              return map
            }
            map.set(team.id, team)
            return map
          }, new Map()) || new Map()
        return {
          boostHubTeams: [...teamMap.values()],
        }
      })
    }

    const boostHubAccountDeleteEventHandler = () => {
      push(`/app`)
      setPreferences({
        'cloud.user': null,
      })
      setGeneralStatus({
        boostHubTeams: [],
      })
    }

    const boostHubCreateLocalSpaceEventHandler = () => {
      push(`/app/storages`)
    }

    boostHubSubscriptionDeleteEventEmitter.listen(
      boostHubSubscriptionDeleteEventHandler
    )
    boostHubSubscriptionUpdateEventEmitter.listen(
      boostHubSubscriptioUpdateEventHandler
    )
    boostHubTeamCreateEventEmitter.listen(boostHubTeamCreateEventHandler)
    boostHubTeamUpdateEventEmitter.listen(boostHubTeamUpdateEventHandler)
    boostHubTeamDeleteEventEmitter.listen(boostHubTeamDeleteEventHandler)
    boostHubAccountDeleteEventEmitter.listen(boostHubAccountDeleteEventHandler)
    boostHubCreateLocalSpaceEventEmitter.listen(
      boostHubCreateLocalSpaceEventHandler
    )
    return () => {
      boostHubSubscriptionDeleteEventEmitter.unlisten(
        boostHubSubscriptionDeleteEventHandler
      )
      boostHubSubscriptionUpdateEventEmitter.unlisten(
        boostHubSubscriptioUpdateEventHandler
      )
      boostHubTeamCreateEventEmitter.unlisten(boostHubTeamCreateEventHandler)
      boostHubTeamUpdateEventEmitter.unlisten(boostHubTeamUpdateEventHandler)
      boostHubTeamDeleteEventEmitter.unlisten(boostHubTeamDeleteEventHandler)
      boostHubAccountDeleteEventEmitter.unlisten(
        boostHubAccountDeleteEventHandler
      )
      boostHubCreateLocalSpaceEventEmitter.unlisten(
        boostHubCreateLocalSpaceEventHandler
      )
    }
  }, [push, setPreferences, setGeneralStatus])
  const { boostHubTeams } = generalStatus
  const switchWorkspaceHandler = useCallback(
    (_event: any, index: number) => {
      const storageIds = keys(storageMap)
      const boostHubDomains = boostHubTeams.map((team) => team.domain)

      if (storageIds.length > index) {
        const targetStorageId = storageIds[index]
        navigateToStorage(targetStorageId)
      } else {
        const targetDomain = boostHubDomains[index - storageIds.length]
        if (targetDomain == null) {
          return
        }

        push(`/app/boosthub/teams/${targetDomain}`)
      }
    },
    [storageMap, boostHubTeams, navigateToStorage, push]
  )
  useEffect(() => {
    addIpcListener('switch-workspace', switchWorkspaceHandler)
    return () => {
      removeIpcListener('switch-workspace', switchWorkspaceHandler)
    }
  }, [switchWorkspaceHandler])

  useBoostNoteProtocol()

  const { showingCloudIntroModal } = useCloudIntroModal()

  const activeBoostHubTeamDomain = useMemo<string | null>(() => {
    if (routeParams.name !== 'boosthub.teams.show') {
      return null
    }
    return routeParams.domain
  }, [routeParams])

  const showingAppNavigator =
    activeBoostHubTeamDomain != null
      ? generalStatus.boostHubTeams.find(
          (team) => team.domain === activeBoostHubTeamDomain
        ) != null
      : routeParams.name == 'boosthub.teams.create'

  return (
    <ThemeProvider theme={selectV2Theme(preferences['general.theme'] as any)}>
      <AppContainer
        onDrop={(event: React.DragEvent) => {
          event.preventDefault()
        }}
      >
        {initialized ? (
          <>
            {showingAppNavigator != null ? (
              <AppNavigator />
            ) : (
              showingCloudIntroModal && <CloudIntroModal />
            )}
            <Router />
          </>
        ) : (
          <LoadingText>Loading Data...</LoadingText>
        )}
        <GlobalStyle />
        <CodeMirrorStyle />
        <ExternalStyle />

        <Toast />
        <PreferencesModal />
        <ContextMenu />

        <Dialog />
        <Modal />
      </AppContainer>
    </ThemeProvider>
  )
}

export default App
