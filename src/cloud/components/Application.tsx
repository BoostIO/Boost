import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { usePreferences } from '../lib/stores/preferences'
import { usePage } from '../lib/stores/pageStore'
import {
  useGlobalKeyDownHandler,
  isSingleKeyEventOutsideOfInput,
  preventKeyboardEventPropagation,
  isSingleKeyEvent,
} from '../lib/keyboard'
import { isActiveElementAnInput, InputableDomElement } from '../lib/dom'
import { useDebounce, useEffectOnce } from 'react-use'
import { SettingsTab, useSettings } from '../lib/stores/settings'
import { shortcuts } from '../lib/shortcuts'
import { useSearch } from '../lib/stores/search'
import AnnouncementAlert from './atoms/AnnouncementAlert'
import {
  modalImportEventEmitter,
  newFolderEventEmitter,
  searchEventEmitter,
  toggleSidebarSearchEventEmitter,
  toggleSidebarTimelineEventEmitter,
  toggleSidebarTreeEventEmitter,
} from '../lib/utils/events'
import { usePathnameChangeEffect, useRouter } from '../lib/router'
import { useNav } from '../lib/stores/nav'
import EventSource from './organisms/EventSource'
import ApplicationLayout from '../../shared/components/molecules/ApplicationLayout'
import Sidebar from '../../shared/components/organisms/Sidebar'
import {
  CollapsableType,
  useSidebarCollapse,
} from '../lib/stores/sidebarCollapse'
import {
  MenuItem,
  MenuTypes,
  useContextMenu,
} from '../../shared/lib/stores/contextMenu'
import { useGlobalData } from '../lib/stores/globalData'
import { getDocLinkHref } from './atoms/Link/DocLink'
import { getFolderHref } from './atoms/Link/FolderLink'
import { getWorkspaceHref } from './atoms/Link/WorkspaceLink'
import { getTagHref } from './atoms/Link/TagLink'
import {
  SidebarSearchHistory,
  SidebarSearchResult,
} from '../../shared/components/organisms/Sidebar/molecules/SidebarSearch'
import {
  SidebarState,
  SidebarTreeSortingOrder,
  SidebarTreeSortingOrders,
} from '../../shared/lib/sidebar'
import useApi from '../../shared/lib/hooks/useApi'
import {
  GetSearchResultsRequestQuery,
  getSearchResultsV2,
  HistoryItem,
  SearchResult,
} from '../api/search'
import { SidebarToolbarRow } from '../../shared/components/organisms/Sidebar/molecules/SidebarToolbar'
import { mapUsers } from '../../shared/lib/mappers/users'
import { SerializedDoc, SerializedDocWithBookmark } from '../interfaces/db/doc'
import { SerializedTeam } from '../interfaces/db/team'
import { compareDateString } from '../../shared/lib/date'
import {
  getDocId,
  getDocTitle,
  getFolderId,
  getTeamURL,
} from '../lib/utils/patterns'
import {
  mdiAccountMultiplePlusOutline,
  mdiApplicationCog,
  mdiArchiveOutline,
  mdiClockOutline,
  mdiCogOutline,
  mdiDotsHorizontal,
  mdiDownload,
  mdiFileDocumentMultipleOutline,
  mdiFileDocumentOutline,
  mdiFilePlusOutline,
  mdiFolderPlusOutline,
  mdiLock,
  mdiLogoutVariant,
  mdiMagnify,
  mdiPaperclip,
  mdiPencil,
  mdiPencilBoxMultipleOutline,
  mdiPlus,
  mdiPlusCircleOutline,
  mdiStar,
  mdiStarOutline,
  mdiTag,
  mdiTextBoxPlusOutline,
  mdiTrashCanOutline,
  mdiWeb,
  mdiPlayCircleOutline,
  mdiPauseCircleOutline,
  mdiCheckCircleOutline,
  mdiFolderCogOutline,
} from '@mdi/js'
import { getColorFromString } from '../../shared/lib/string'
import {
  sortByAttributeAsc,
  sortByAttributeDesc,
} from '../../shared/lib/utils/array'
import { buildIconUrl } from '../api/files'
import {
  SerializedFolder,
  SerializedFolderWithBookmark,
} from '../interfaces/db/folder'
import { SerializedWorkspace } from '../interfaces/db/workspace'
import { SerializedTag } from '../interfaces/db/tag'
import { FoldingProps } from '../../shared/components/atoms/FoldingWrapper'
import { getMapValues } from '../../shared/lib/utils/array'
import {
  SidebarNavCategory,
  SidebarNavControls,
  SidebarTreeChildRow,
} from '../../shared/components/organisms/Sidebar/molecules/SidebarTree'
import RoundedImage from '../../shared/components/atoms/RoundedImage'
import ImportModal from './organisms/Modal/contents/Import/ImportModal'
import { SerializedTeamInvite } from '../interfaces/db/teamInvite'
import { getHexFromUUID } from '../lib/utils/string'
import { stringify } from 'querystring'
import { sendToHost, useElectron, usingElectron } from '../lib/stores/electron'
import { SidebarSpace } from '../../shared/components/organisms/Sidebar/molecules/SidebarSpaces'
import ContentLayout, {
  ContentLayoutProps,
} from '../../shared/components/templates/ContentLayout'
import { getTeamLinkHref } from './atoms/Link/TeamLink'
import CreateWorkspaceModal from './organisms/Modal/contents/Workspace/CreateWorkspaceModal'
import { useCloudUpdater } from '../lib/hooks/useCloudUpdater'
import { CreateFolderRequestBody } from '../api/teams/folders'
import { CreateDocRequestBody } from '../api/teams/docs'
import { useCloudDnd } from '../lib/hooks/useCloudDnd'
import { NavResource } from '../interfaces/resources'
import { SidebarDragState } from '../../shared/lib/dnd'
import cc from 'classcat'
import { useCloudUI } from '../lib/hooks/useCloudUI'
import { mapTopbarTree } from '../lib/mappers/topbarTree'
import FuzzyNavigation from '../../shared/components/organisms/FuzzyNavigation'
import {
  mapFuzzyNavigationItems,
  mapFuzzyNavigationRecentItems,
} from '../lib/mappers/fuzzyNavigation'
import { ModalOpeningOptions, useModal } from '../../shared/lib/stores/modal'
import ButtonGroup from '../../shared/components/atoms/ButtonGroup'
import Button from '../../shared/components/atoms/Button'
import TemplatesModal from './organisms/Modal/contents/TemplatesModal'
import { CreateWorkspaceRequestBody } from '../api/teams/workspaces'
import {
  cloudSidebaCategoryLabels,
  cloudSidebarOrderedCategoriesDelimiter,
} from '../lib/sidebar'
import CreateSmartFolderModal from './organisms/Modal/contents/SmartFolder/CreateSmartFolderModal'
import UpdateSmartFolderModal from './organisms/Modal/contents/SmartFolder/UpdateSmartFolderModal'
import { SerializedSmartFolder } from '../interfaces/db/smartFolder'
import { getSmartFolderHref, getDocStatusHref } from '../lib/href'
import { deleteSmartFolder } from '../api/teams/smart-folder'
import {
  useDialog,
  MessageBoxDialogOptions,
} from '../../shared/lib/stores/dialog'

interface ApplicationProps {
  content: ContentLayoutProps
  className?: string
  initialSidebarState?: SidebarState
}

const Application = ({
  content: { topbar, ...content },
  children,
  initialSidebarState,
}: React.PropsWithChildren<ApplicationProps>) => {
  const { preferences, setPreferences } = usePreferences()
  const { messageBox } = useDialog()
  const {
    initialLoadDone,
    docsMap,
    foldersMap,
    workspacesMap,
    tagsMap,
    smartFoldersMap,
    currentParentFolderId,
    currentWorkspaceId,
    currentPath,
    removeFromSmartFoldersMap,
  } = useNav()
  const {
    sideBarOpenedLinksIdsSet,
    sideBarOpenedFolderIdsSet,
    sideBarOpenedWorkspaceIdsSet,
    toggleItem,
    unfoldItem,
    foldItem,
  } = useSidebarCollapse()
  const {
    team,
    permissions = [],
    guestsMap,
    currentUserPermissions,
  } = usePage()
  const { openModal } = useModal()
  const {
    globalData: { teams, invites, currentUser },
  } = useGlobalData()
  const { push, query, pathname, goBack, goForward } = useRouter()
  const { history, searchHistory, addToSearchHistory } = useSearch()
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('')
  const [showSpaces, setShowSpaces] = useState(false)
  const [searchResults, setSearchResults] = useState<SidebarSearchResult[]>([])
  const [sidebarState, setSidebarState] = useState<SidebarState | undefined>(
    initialSidebarState != null
      ? initialSidebarState
      : preferences.lastSidebarState
  )
  const { openSettingsTab, closeSettingsTab } = useSettings()
  const { usingElectron, sendToElectron } = useElectron()
  const {
    openRenameFolderForm,
    openNewFolderForm,
    openRenameDocForm,
    openWorkspaceEditForm,
    openNewDocForm,
  } = useCloudUI()
  const [showFuzzyNavigation, setShowFuzzyNavigation] = useState(false)
  const { popup } = useContextMenu()

  usePathnameChangeEffect(() => {
    setShowFuzzyNavigation(false)
  })

  useEffectOnce(() => {
    if (query.settings === 'upgrade') {
      openSettingsTab('teamUpgrade')
    }

    openSettingsTab('personalInfo')
  })

  useEffect(() => {
    setPreferences({ lastSidebarState: sidebarState })
  }, [sidebarState, setPreferences])

  useEffect(() => {
    const handler = () => {
      setShowFuzzyNavigation((prev) => !prev)
    }
    searchEventEmitter.listen(handler)
    return () => {
      searchEventEmitter.unlisten(handler)
    }
  }, [])

  const openState = useCallback((state: SidebarState) => {
    setSidebarState((prev) => (prev === state ? undefined : state))
  }, [])

  const getFoldEvents = useCallback(
    (type: CollapsableType, key: string, reversed?: boolean) => {
      if (reversed) {
        return {
          fold: () => unfoldItem(type, key),
          unfold: () => foldItem(type, key),
          toggle: () => toggleItem(type, key),
        }
      }

      return {
        fold: () => foldItem(type, key),
        unfold: () => unfoldItem(type, key),
        toggle: () => toggleItem(type, key),
      }
    },
    [toggleItem, unfoldItem, foldItem]
  )

  const sidebarResize = useCallback(
    (width: number) => setPreferences({ sideBarWidth: width }),
    [setPreferences]
  )

  const {
    draggedCategory,
    draggedResource,
    dropInDocOrFolder,
    dropInWorkspace,
  } = useCloudDnd()
  const {
    sendingMap: treeSendingMap,
    createWorkspace,
    createDoc,
    createFolder,
    toggleDocArchive,
    toggleDocBookmark,
    toggleFolderBookmark,
    updateDoc,
    updateFolder,
  } = useCloudUpdater()
  const { deleteWorkspace, deleteFolder } = useCloudUI()

  const tree = useMemo(() => {
    return mapTree(
      initialLoadDone,
      preferences.sidebarTreeSortingOrder,
      pathname,
      docsMap,
      foldersMap,
      workspacesMap,
      tagsMap,
      smartFoldersMap,
      treeSendingMap,
      sideBarOpenedLinksIdsSet,
      sideBarOpenedFolderIdsSet,
      sideBarOpenedWorkspaceIdsSet,
      toggleItem,
      getFoldEvents,
      push,
      openModal,
      toggleDocBookmark,
      toggleFolderBookmark,
      createWorkspace,
      deleteWorkspace,
      toggleDocArchive,
      deleteFolder,
      createFolder,
      createDoc,
      draggedResource,
      dropInDocOrFolder,
      (id: string) => dropInWorkspace(id, updateFolder, updateDoc),
      openRenameFolderForm,
      openRenameDocForm,
      openWorkspaceEditForm,
      messageBox,
      removeFromSmartFoldersMap,
      team
    )
  }, [
    initialLoadDone,
    preferences.sidebarTreeSortingOrder,
    pathname,
    docsMap,
    foldersMap,
    workspacesMap,
    tagsMap,
    smartFoldersMap,
    treeSendingMap,
    sideBarOpenedLinksIdsSet,
    sideBarOpenedFolderIdsSet,
    sideBarOpenedWorkspaceIdsSet,
    toggleItem,
    getFoldEvents,
    push,
    openModal,
    toggleDocBookmark,
    toggleFolderBookmark,
    createWorkspace,
    deleteWorkspace,
    toggleDocArchive,
    deleteFolder,
    createFolder,
    createDoc,
    draggedResource,
    dropInDocOrFolder,
    openRenameFolderForm,
    openRenameDocForm,
    openWorkspaceEditForm,
    messageBox,
    team,
    dropInWorkspace,
    updateFolder,
    updateDoc,
    removeFromSmartFoldersMap,
  ])

  const treeWithOrderedCategories = useMemo(() => {
    if (tree == null) {
      return undefined
    }

    const orderedCategories = Array.from(
      new Set([
        ...preferences.sidebarOrderedCategories.split(
          cloudSidebarOrderedCategoriesDelimiter
        ),
        ...cloudSidebaCategoryLabels,
      ])
    ).filter((item) =>
      cloudSidebaCategoryLabels.find((categoryLabel) => categoryLabel === item)
    )

    const orderedTree = tree.sort((categoryA, categoryB) => {
      if (
        orderedCategories.indexOf(categoryA.label) >
        orderedCategories.indexOf(categoryB.label)
      ) {
        return 1
      } else {
        return -1
      }
    })

    orderedTree.forEach((category) => {
      category.drag = {
        onDragStart: () => {
          draggedCategory.current = category.label
        },
        onDragEnd: () => {
          draggedCategory.current = undefined
        },
        onDrop: () => {
          if (draggedCategory.current == null) {
            return
          }
          const orderedItems = orderedCategories.splice(0)
          const categoryIndex = orderedItems.includes(category.label)
            ? orderedItems.indexOf(category.label)
            : orderedItems.length - 1

          const reArrangedArray = orderedItems.reduce((acc, val, i) => {
            if (i === categoryIndex) {
              acc.push(draggedCategory.current!)
            }

            if (i !== categoryIndex && val === draggedCategory.current) {
              return acc
            }

            acc.push(val)
            return acc
          }, [] as string[])

          setPreferences({
            sidebarOrderedCategories: reArrangedArray.join(
              cloudSidebarOrderedCategoriesDelimiter
            ),
          })

          draggedCategory.current = undefined
        },
      }
    })

    return orderedTree
  }, [
    tree,
    preferences.sidebarOrderedCategories,
    setPreferences,
    draggedCategory,
  ])

  const users = useMemo(() => {
    return mapUsers(permissions, currentUser, [...guestsMap.values()])
  }, [permissions, currentUser, guestsMap])

  const toolbarRows: SidebarToolbarRow[] = useMemo(() => {
    return mapToolbarRows(
      showSpaces,
      setShowSpaces,
      openState,
      openModal,
      openSettingsTab,
      sidebarState,
      team
    )
  }, [sidebarState, openModal, openSettingsTab, team, openState, showSpaces])

  const topbarTree = useMemo(() => {
    if (team == null) {
      return undefined
    }

    return mapTopbarTree(
      team,
      initialLoadDone,
      docsMap,
      foldersMap,
      workspacesMap,
      push
    )
  }, [team, initialLoadDone, docsMap, foldersMap, workspacesMap, push])

  const spaces = useMemo(() => {
    return mapSpaces(push, teams, invites, team)
  }, [teams, team, invites, push])

  const historyItems = useMemo(() => {
    return mapHistory(history || [], push, docsMap, foldersMap, team)
  }, [team, history, push, docsMap, foldersMap])

  const setSearchQuery = useCallback((val: string) => {
    setSidebarSearchQuery(val)
  }, [])

  const { submit: submitSearch, sending: fetchingSearchResults } = useApi({
    api: ({ teamId, query }: { teamId: string; query: any }) =>
      getSearchResultsV2({ teamId, query }),
    cb: ({ results }) =>
      setSearchResults(mapSearchResults(results, push, team)),
  })

  const [isNotDebouncing, cancel] = useDebounce(
    async () => {
      if (team == null || sidebarSearchQuery.trim() === '') {
        return
      }

      if (fetchingSearchResults) {
        cancel()
      }

      const searchParams = sidebarSearchQuery
        .split(' ')
        .reduce<GetSearchResultsRequestQuery>(
          (params, str) => {
            if (str === '--body') {
              params.body = true
              return params
            }
            if (str === '--title') {
              params.title = true
              return params
            }
            params.query = params.query == '' ? str : `${params.query} ${str}`
            return params
          },
          { query: '' }
        )

      addToSearchHistory(searchParams.query)
      await submitSearch({ teamId: team.id, query: searchParams })
    },
    600,
    [sidebarSearchQuery]
  )

  const timelineRows = useMemo(() => {
    return mapTimelineItems([...docsMap.values()], push, team)
  }, [docsMap, push, team])

  const openCreateFolderModal = useCallback(() => {
    openNewFolderForm({
      team,
      workspaceId: currentWorkspaceId,
      parentFolderId: currentParentFolderId,
    })
  }, [openNewFolderForm, currentParentFolderId, team, currentWorkspaceId])

  useEffect(() => {
    if (team == null || currentUserPermissions == null) {
      return
    }
    newFolderEventEmitter.listen(openCreateFolderModal)
    return () => {
      newFolderEventEmitter.unlisten(openCreateFolderModal)
    }
  }, [team, currentUserPermissions, openCreateFolderModal])

  const overrideBrowserCtrlsHandler = useCallback(
    async (event: KeyboardEvent) => {
      if (team == null) {
        return
      }

      if (isSingleKeyEventOutsideOfInput(event, shortcuts.teamMembers)) {
        preventKeyboardEventPropagation(event)
        openSettingsTab('teamMembers')
      }

      if (isSingleKeyEvent(event, 'escape') && isActiveElementAnInput()) {
        if (isCodeMirrorTextAreaEvent(event)) {
          return
        }
        preventKeyboardEventPropagation(event)
        ;(document.activeElement as InputableDomElement).blur()
      }
    },
    [openSettingsTab, team]
  )
  useGlobalKeyDownHandler(overrideBrowserCtrlsHandler)

  const toggleSidebarTree = useCallback(() => {
    closeSettingsTab()
    setSidebarState((prev) => {
      return prev === 'tree' ? undefined : 'tree'
    })
  }, [closeSettingsTab])
  useEffect(() => {
    toggleSidebarTreeEventEmitter.listen(toggleSidebarTree)
    return () => {
      toggleSidebarTreeEventEmitter.unlisten(toggleSidebarTree)
    }
  }, [toggleSidebarTree])

  const toggleSidebarSearch = useCallback(() => {
    closeSettingsTab()
    setSidebarState((prev) => {
      return prev === 'search' ? undefined : 'search'
    })
  }, [closeSettingsTab])
  useEffect(() => {
    toggleSidebarSearchEventEmitter.listen(toggleSidebarSearch)
    return () => {
      toggleSidebarSearchEventEmitter.unlisten(toggleSidebarSearch)
    }
  }, [toggleSidebarSearch])

  const toggleSidebarTimeline = useCallback(() => {
    closeSettingsTab()
    setSidebarState((prev) => {
      return prev === 'timeline' ? undefined : 'timeline'
    })
  }, [closeSettingsTab])
  useEffect(() => {
    toggleSidebarTimelineEventEmitter.listen(toggleSidebarTimeline)
    return () => {
      toggleSidebarTimelineEventEmitter.unlisten(toggleSidebarTimeline)
    }
  }, [toggleSidebarTimeline])

  const openImportModal = useCallback(() => {
    closeSettingsTab()
    openModal(<ImportModal />, { showCloseIcon: true })
  }, [closeSettingsTab, openModal])

  useEffect(() => {
    modalImportEventEmitter.listen(openImportModal)
    return () => {
      modalImportEventEmitter.unlisten(openImportModal)
    }
  }, [openImportModal])

  useEffect(() => {
    if (!usingElectron) {
      return
    }
    sendToElectron('sidebar--state', { state: sidebarState })
  }, [usingElectron, , sendToElectron, sidebarState])

  return (
    <>
      {team != null && <EventSource teamId={team.id} />}
      {showFuzzyNavigation && team != null && (
        <FuzzyNavigation
          close={() => setShowFuzzyNavigation(false)}
          allItems={mapFuzzyNavigationItems(
            team,
            push,
            docsMap,
            foldersMap,
            workspacesMap
          )}
          recentItems={mapFuzzyNavigationRecentItems(
            team,
            history,
            push,
            docsMap,
            foldersMap,
            workspacesMap
          )}
        />
      )}
      <ApplicationLayout
        sidebar={
          <Sidebar
            className={cc(['application__sidebar'])}
            showToolbar={!usingElectron}
            showSpaces={showSpaces}
            onSpacesBlur={() => setShowSpaces(false)}
            toolbarRows={toolbarRows}
            spaces={spaces}
            spaceBottomRows={buildSpacesBottomRows(push)}
            sidebarExpandedWidth={preferences.sideBarWidth}
            sidebarState={sidebarState}
            tree={treeWithOrderedCategories}
            sidebarResize={sidebarResize}
            searchQuery={sidebarSearchQuery}
            setSearchQuery={setSearchQuery}
            searchHistory={searchHistory}
            recentPages={historyItems}
            treeControls={[
              {
                icon:
                  preferences.sidebarTreeSortingOrder === 'a-z'
                    ? SidebarTreeSortingOrders.aZ.icon
                    : preferences.sidebarTreeSortingOrder === 'z-a'
                    ? SidebarTreeSortingOrders.zA.icon
                    : preferences.sidebarTreeSortingOrder === 'last-updated'
                    ? SidebarTreeSortingOrders.lastUpdated.icon
                    : SidebarTreeSortingOrders.dragDrop.icon,
                onClick: (event) => {
                  popup(
                    event,
                    Object.values(SidebarTreeSortingOrders).map((sort) => {
                      return {
                        type: MenuTypes.Normal,
                        onClick: () =>
                          setPreferences({
                            sidebarTreeSortingOrder: sort.value,
                          }),
                        label: sort.label,
                        icon: sort.icon,
                        active:
                          sort.value === preferences.sidebarTreeSortingOrder,
                      }
                    })
                  )
                },
              },
            ]}
            treeTopRows={
              team == null ? null : (
                <>
                  <ButtonGroup>
                    <Button
                      variant='primary'
                      size='sm'
                      iconPath={mdiTextBoxPlusOutline}
                      id='sidebar-newdoc-btn'
                      iconSize={16}
                      onClick={() =>
                        openNewDocForm(
                          {
                            team,
                            parentFolderId: currentParentFolderId,
                            workspaceId: currentWorkspaceId,
                          },
                          {
                            precedingRows: [
                              {
                                description: `${
                                  workspacesMap.get(currentWorkspaceId || '')
                                    ?.name
                                }${currentPath}`,
                              },
                            ],
                          }
                        )
                      }
                    >
                      Create new doc
                    </Button>
                    <Button
                      variant='primary'
                      size='sm'
                      iconPath={mdiDotsHorizontal}
                      onClick={(event) => {
                        event.preventDefault()
                        popup(event, [
                          {
                            icon: mdiPencilBoxMultipleOutline,
                            type: MenuTypes.Normal,
                            label: 'Use a template',
                            onClick: () =>
                              openModal(<TemplatesModal />, { width: 'large' }),
                          },
                        ])
                      }}
                    />
                  </ButtonGroup>
                </>
              )
            }
            searchResults={searchResults}
            users={users}
            timelineRows={timelineRows}
            timelineMore={
              team != null && pathname !== getTeamLinkHref(team, 'timeline')
                ? {
                    variant: 'primary',
                    onClick: () => push(getTeamLinkHref(team, 'timeline')),
                  }
                : undefined
            }
            sidebarSearchState={{
              fetching: fetchingSearchResults,
              isNotDebouncing: isNotDebouncing() === true,
            }}
          />
        }
        pageBody={
          <>
            <ContentLayout
              {...content}
              topbar={{
                ...topbar,
                tree: topbarTree,
                navigation: {
                  goBack,
                  goForward,
                },
              }}
            >
              {children}
            </ContentLayout>
          </>
        }
      />
      <AnnouncementAlert />
    </>
  )
}

export default Application

function mapTimelineItems(
  docs: SerializedDoc[],
  push: (url: string) => void,
  team?: SerializedTeam,
  limit = 10
) {
  if (team == null) {
    return []
  }

  return docs
    .sort((a, b) =>
      compareDateString(
        a.head?.created || a.updatedAt,
        b.head?.created || b.updatedAt,
        'DESC'
      )
    )
    .slice(0, limit)
    .map((doc) => {
      const labelHref = getDocLinkHref(doc, team, 'index')
      return {
        id: doc.id,
        label: getDocTitle(doc, 'Untitled'),
        labelHref,
        labelOnClick: () => push(labelHref),
        emoji: doc.emoji,
        defaultIcon: mdiFileDocumentOutline,
        lastUpdated: doc.head?.created || doc.updatedAt,
        lastUpdatedBy:
          doc.head == null
            ? []
            : (doc.head.creators || []).map((user) => {
                return {
                  color: getColorFromString(user.id),
                  userId: user.id,
                  name: user.displayName,
                  iconUrl:
                    user.icon != null
                      ? buildIconUrl(user.icon.location)
                      : undefined,
                }
              }),
      }
    })
}

function mapSearchResults(
  results: SearchResult[],
  push: (url: string) => void,
  team?: SerializedTeam
) {
  if (team == null) {
    return []
  }

  return results.reduce((acc, item) => {
    if (item.type === 'folder') {
      const href = `${process.env.BOOST_HUB_BASE_URL}${getFolderHref(
        item.result,
        team,
        'index'
      )}`
      acc.push({
        label: item.result.name,
        href,
        emoji: item.result.emoji,
        onClick: () => push(href),
      })
      return acc
    }

    const href = `${process.env.BOOST_HUB_BASE_URL}${getDocLinkHref(
      item.result,
      team,
      'index'
    )}`
    acc.push({
      label: getDocTitle(item.result, 'Untitled'),
      href,
      defaultIcon: mdiFileDocumentOutline,
      emoji: item.result.emoji,
      contexts: item.type === 'docContent' ? [item.context] : undefined,
      onClick: () => push(href),
    })
    return acc
  }, [] as SidebarSearchResult[])
}

function mapHistory(
  history: HistoryItem[],
  push: (href: string) => void,
  docsMap: Map<string, SerializedDoc>,
  foldersMap: Map<string, SerializedFolder>,
  team?: SerializedTeam
) {
  if (team == null) {
    return []
  }

  const items = [] as SidebarSearchHistory[]

  history.forEach((historyItem) => {
    if (historyItem.type === 'folder') {
      const item = foldersMap.get(historyItem.item)
      if (item != null) {
        const href = `${process.env.BOOST_HUB_BASE_URL}${getFolderHref(
          item,
          team,
          'index'
        )}`
        items.push({
          emoji: item.emoji,
          label: item.name,
          href,
          onClick: () => push(href),
        })
      }
    } else {
      const item = docsMap.get(historyItem.item)
      if (item != null) {
        const href = `${process.env.BOOST_HUB_BASE_URL}${getDocLinkHref(
          item,
          team,
          'index'
        )}`
        items.push({
          emoji: item.emoji,
          defaultIcon: mdiFileDocumentOutline,
          label: getDocTitle(item, 'Untitled'),
          href,
          onClick: () => push(href),
        })
      }
    }
  })

  return items
}

function mapTree(
  initialLoadDone: boolean,
  sortingOrder: SidebarTreeSortingOrder,
  currentPath: string,
  docsMap: Map<string, SerializedDocWithBookmark>,
  foldersMap: Map<string, SerializedFolderWithBookmark>,
  workspacesMap: Map<string, SerializedWorkspace>,
  tagsMap: Map<string, SerializedTag>,
  smartFoldersMap: Map<string, SerializedSmartFolder>,
  treeSendingMap: Map<string, string>,
  sideBarOpenedLinksIdsSet: Set<string>,
  sideBarOpenedFolderIdsSet: Set<string>,
  sideBarOpenedWorkspaceIdsSet: Set<string>,
  toggleItem: (type: CollapsableType, id: string) => void,
  getFoldEvents: (
    type: CollapsableType,
    key: string,
    reversed?: boolean
  ) => FoldingProps,
  push: (url: string) => void,
  openModal: (cmp: JSX.Element) => void,
  toggleDocBookmark: (
    teamId: string,
    docId: string,
    bookmarked: boolean
  ) => void,
  toggleFolderBookmark: (
    teamId: string,
    id: string,
    bookmarked: boolean
  ) => void,
  createWorkspace: (
    team: SerializedTeam,
    body: CreateWorkspaceRequestBody,
    options: {
      skipRedirect?: boolean
      afterSuccess?: (workspace: SerializedWorkspace) => void
    }
  ) => void,
  deleteWorkspace: (wp: SerializedWorkspace) => void,
  toggleDocArchive: (
    teamId: string,
    docId: string,
    archivedAt?: string
  ) => void,
  deleteFolder: (folder: SerializedFolder) => void,
  createFolder: (
    team: SerializedTeam,
    body: CreateFolderRequestBody
  ) => Promise<void>,
  createDoc: (
    team: SerializedTeam,
    body: CreateDocRequestBody
  ) => Promise<void>,
  draggedResource: React.MutableRefObject<NavResource | undefined>,
  dropInFolderOrDoc: (
    targetedResource: NavResource,
    targetedPosition: SidebarDragState
  ) => void,
  dropInWorkspace: (id: string) => void,
  openRenameFolderForm: (folder: SerializedFolder) => void,
  openRenameDocForm: (doc: SerializedDoc) => void,
  openWorkspaceEditForm: (wp: SerializedWorkspace) => void,
  messageBox: (options: MessageBoxDialogOptions) => void,
  removeFromSmartFoldersMap: (...ids: string[]) => void,
  team?: SerializedTeam
) {
  if (!initialLoadDone || team == null) {
    return undefined
  }

  const currentPathWithDomain = `${process.env.BOOST_HUB_BASE_URL}${currentPath}`
  const items = new Map<string, CloudTreeItem>()

  const [docs, folders, workspaces, smartFolders] = [
    getMapValues(docsMap),
    getMapValues(foldersMap),
    getMapValues(workspacesMap),
    getMapValues(smartFoldersMap),
  ]

  let personalWorkspace: SerializedWorkspace | undefined
  workspaces.forEach((wp) => {
    if (wp.personal) {
      personalWorkspace = wp
      return
    }

    const href = `${process.env.BOOST_HUB_BASE_URL}${getWorkspaceHref(
      wp,
      team,
      'index'
    )}`
    items.set(wp.id, {
      id: wp.id,
      lastUpdated: wp.updatedAt,
      label: wp.name,
      defaultIcon: !wp.public ? mdiLock : undefined,
      children: wp.positions?.orderedIds || [],
      folded: !sideBarOpenedWorkspaceIdsSet.has(wp.id),
      folding: getFoldEvents('workspaces', wp.id),
      href,
      active: href === currentPathWithDomain,
      navigateTo: () => push(href),
      dropIn: true,
      onDrop: () => dropInWorkspace(wp.id),
      controls: [
        {
          icon: mdiFilePlusOutline,
          onClick: undefined,
          placeholder: 'Doc title..',
          create: (title: string) =>
            createDoc(team, {
              workspaceId: wp.id,
              title,
            }),
        },
        {
          icon: mdiFolderPlusOutline,
          onClick: undefined,
          placeholder: 'Folder name..',
          create: (folderName: string) =>
            createFolder(team, {
              workspaceId: wp.id,
              description: '',
              folderName,
            }),
        },
      ],
      contextControls: wp.default
        ? [
            {
              type: MenuTypes.Normal,
              icon: mdiApplicationCog,
              label: 'Edit',
              onClick: () => openWorkspaceEditForm(wp),
            },
          ]
        : [
            {
              type: MenuTypes.Normal,
              icon: mdiApplicationCog,
              label: 'Edit',
              onClick: () => openWorkspaceEditForm(wp),
            },
            {
              type: MenuTypes.Normal,
              icon: mdiTrashCanOutline,
              label: 'Delete',
              onClick: () => deleteWorkspace(wp),
            },
          ],
    })
  })

  folders.forEach((folder) => {
    const folderId = getFolderId(folder)
    const href = `${process.env.BOOST_HUB_BASE_URL}${getFolderHref(
      folder,
      team,
      'index'
    )}`
    items.set(folderId, {
      id: folderId,
      lastUpdated: folder.updatedAt,
      label: folder.name,
      bookmarked: folder.bookmarked,
      emoji: folder.emoji,
      folded: !sideBarOpenedFolderIdsSet.has(folder.id),
      folding: getFoldEvents('folders', folder.id),
      href,
      active: href === currentPathWithDomain,
      navigateTo: () => push(href),
      onDrop: (position: SidebarDragState) =>
        dropInFolderOrDoc({ type: 'folder', result: folder }, position),
      onDragStart: () => {
        draggedResource.current = { type: 'folder', result: folder }
      },
      onDragEnd: () => {
        draggedResource.current = undefined
      },
      dropIn: true,
      dropAround: sortingOrder === 'drag' ? true : false,
      controls: [
        {
          icon: mdiFilePlusOutline,
          onClick: undefined,
          placeholder: 'Doc title..',
          create: (title: string) =>
            createDoc(team, {
              parentFolderId: folder.id,
              workspaceId: folder.workspaceId,
              title,
            }),
        },
        {
          icon: mdiFolderPlusOutline,
          onClick: undefined,
          placeholder: 'Folder name..',
          create: (folderName: string) =>
            createFolder(team, {
              parentFolderId: folder.id,
              workspaceId: folder.workspaceId,
              description: '',
              folderName,
            }),
        },
      ],
      contextControls: [
        {
          type: MenuTypes.Normal,
          icon: folder.bookmarked ? mdiStar : mdiStarOutline,
          label:
            treeSendingMap.get(folder.id) === 'bookmark'
              ? '...'
              : folder.bookmarked
              ? 'Bookmarked'
              : 'Bookmark',
          onClick: () =>
            toggleFolderBookmark(folder.teamId, folder.id, folder.bookmarked),
        },
        {
          type: MenuTypes.Normal,
          icon: mdiPencil,
          label: 'Rename',
          onClick: () => openRenameFolderForm(folder),
        },
        {
          type: MenuTypes.Normal,
          icon: mdiTrashCanOutline,
          label: 'Delete',
          onClick: () => deleteFolder(folder),
        },
      ],
      parentId:
        folder.parentFolderId == null
          ? folder.workspaceId
          : folder.parentFolderId,
      children:
        typeof folder.positions != null && typeof folder.positions !== 'string'
          ? folder.positions.orderedIds
          : [],
    })
  })

  docs.forEach((doc) => {
    const docId = getDocId(doc)
    const href = `${process.env.BOOST_HUB_BASE_URL}${getDocLinkHref(
      doc,
      team,
      'index'
    )}`
    items.set(docId, {
      id: docId,
      lastUpdated: doc.head != null ? doc.head.created : doc.updatedAt,
      label: getDocTitle(doc, 'Untitled'),
      bookmarked: doc.bookmarked,
      emoji: doc.emoji,
      defaultIcon: mdiFileDocumentOutline,
      hidden:
        doc.archivedAt != null ||
        doc.status === 'archived' ||
        doc.status === 'completed',
      children: [],
      href,
      active: href === currentPathWithDomain,
      dropAround: sortingOrder === 'drag' ? true : false,
      navigateTo: () => push(href),
      onDrop: (position: SidebarDragState) =>
        dropInFolderOrDoc({ type: 'doc', result: doc }, position),
      onDragStart: () => {
        draggedResource.current = { type: 'doc', result: doc }
      },
      onDragEnd: () => {
        draggedResource.current = undefined
      },
      contextControls: [
        {
          type: MenuTypes.Normal,
          icon: doc.bookmarked ? mdiStar : mdiStarOutline,
          label:
            treeSendingMap.get(doc.id) === 'bookmark'
              ? '...'
              : doc.bookmarked
              ? 'Bookmarked'
              : 'Bookmark',
          onClick: () => toggleDocBookmark(doc.teamId, doc.id, doc.bookmarked),
        },
        {
          type: MenuTypes.Normal,
          icon: mdiPencil,
          label: 'Rename',
          onClick: () => openRenameDocForm(doc),
        },
        {
          type: MenuTypes.Normal,
          icon: mdiArchiveOutline,
          label: doc.archivedAt == null ? 'Archive' : 'Restore',
          onClick: () => toggleDocArchive(doc.teamId, doc.id, doc.archivedAt),
        },
      ],
      parentId:
        doc.parentFolderId == null ? doc.workspaceId : doc.parentFolderId,
    })
  })

  const arrayItems = getMapValues(items)
  const tree: Partial<SidebarNavCategory>[] = []

  const bookmarked = arrayItems.reduce((acc, val) => {
    if (!val.bookmarked) {
      return acc
    }

    acc.push({
      id: val.id,
      depth: 0,
      label: val.label,
      emoji: val.emoji,
      defaultIcon: val.defaultIcon,
      href: val.href,
      navigateTo: val.navigateTo,
      contextControls: val.contextControls,
    })
    return acc
  }, [] as SidebarTreeChildRow[])

  const navTree = arrayItems
    .filter((item) => item.parentId == null)
    .reduce((acc, val) => {
      acc.push({
        ...val,
        depth: 0,
        rows: buildChildrenNavRows(sortingOrder, val.children, 1, items),
      })
      return acc
    }, [] as SidebarTreeChildRow[])

  const docsPerTagIdMap = [...docsMap.values()].reduce((acc, doc) => {
    const docTags = doc.tags || []
    docTags.forEach((tag) => {
      let docIds = acc.get(tag.id)
      if (docIds == null) {
        docIds = []
        acc.set(tag.id, docIds)
      }
      docIds.push(doc.id)
    })
    return acc
  }, new Map<string, string[]>())

  const labels = getMapValues(tagsMap)
    .filter((tag) => (docsPerTagIdMap.get(tag.id) || []).length > 0)
    .sort((a, b) => {
      if (a.text < b.text) {
        return -1
      } else {
        return 1
      }
    })
    .reduce((acc, val) => {
      const href = `${process.env.BOOST_HUB_BASE_URL}${getTagHref(
        val,
        team,
        'index'
      )}`
      acc.push({
        id: val.id,
        depth: 0,
        label: val.text,
        defaultIcon: mdiTag,
        href,
        active: href === currentPathWithDomain,
        navigateTo: () => push(href),
      })
      return acc
    }, [] as SidebarTreeChildRow[])

  if (bookmarked.length > 0) {
    tree.push({
      label: 'Bookmarks',
      rows: bookmarked,
    })
  }

  tree.push({
    label: 'Smart Folders',
    rows: smartFolders.map((smartFolder) => {
      const href = `${process.env.BOOST_HUB_BASE_URL}${getSmartFolderHref(
        smartFolder,
        team,
        'index'
      )}`
      return {
        id: smartFolder.id,
        label: smartFolder.name,
        defaultIcon: mdiFolderCogOutline,
        depth: 0,
        active: href === currentPathWithDomain,
        navigateTo: () => push(href),
        contextControls: [
          {
            type: MenuTypes.Normal,
            icon: mdiPencil,
            label: 'Edit',
            onClick: () => {
              openModal(<UpdateSmartFolderModal smartFolder={smartFolder} />)
            },
          },
          {
            type: MenuTypes.Normal,
            icon: mdiTrashCanOutline,
            label: 'Delete',
            onClick: () => {
              messageBox({
                title: `Delete ${smartFolder.name}?`,
                message: `Are you sure to delete this smart folder?`,
                buttons: [
                  {
                    variant: 'secondary',
                    label: 'Cancel',
                    cancelButton: true,
                    defaultButton: true,
                  },
                  {
                    variant: 'danger',
                    label: 'Delete',
                    onClick: async () => {
                      await deleteSmartFolder(team, smartFolder)
                      removeFromSmartFoldersMap(smartFolder.id)
                    },
                  },
                ],
              })
            },
          },
        ],
      }
    }),
    controls: [
      {
        icon: mdiPlus,
        onClick: () => {
          openModal(<CreateSmartFolderModal />)
        },
        tooltip: 'Add smart folder',
      },
    ],
  })

  tree.push({
    label: 'Workspaces',
    rows: navTree,
    controls: [
      {
        icon: mdiPlus,
        onClick: () => openModal(<CreateWorkspaceModal />),
      },
    ],
  })

  if (!team.personal) {
    tree.push({
      label: 'Private',
      rows:
        personalWorkspace != null
          ? arrayItems
              .filter((item) => item.parentId === personalWorkspace!.id)
              .reduce((acc, val) => {
                acc.push({
                  ...val,
                  depth: 0,
                  rows: buildChildrenNavRows(
                    sortingOrder,
                    val.children,
                    1,
                    items
                  ),
                })
                return acc
              }, [] as SidebarTreeChildRow[])
          : [],
      controls: [
        {
          icon: mdiFilePlusOutline,
          onClick: undefined,
          placeholder: 'Doc title..',
          create: async (title: string) => {
            if (personalWorkspace == null) {
              return createWorkspace(
                team,
                {
                  personal: true,
                  name: 'Private',
                  permissions: [],
                  public: false,
                },
                {
                  skipRedirect: true,
                  afterSuccess: (wp) =>
                    createDoc(team, {
                      workspaceId: wp.id,
                      title,
                    }),
                }
              )
            }

            return createDoc(team, {
              workspaceId: personalWorkspace!.id,
              title,
            })
          },
        },
        {
          icon: mdiFolderPlusOutline,
          onClick: undefined,
          placeholder: 'Folder name..',
          create: async (folderName: string) => {
            if (personalWorkspace == null) {
              return createWorkspace(
                team,
                {
                  personal: true,
                  name: 'Private',
                  permissions: [],
                  public: false,
                },
                {
                  skipRedirect: true,
                  afterSuccess: (wp) =>
                    createFolder(team, {
                      workspaceId: wp.id,
                      description: '',
                      folderName,
                    }),
                }
              )
            }

            return createFolder(team, {
              workspaceId: personalWorkspace!.id,
              description: '',
              folderName,
            })
          },
        },
      ],
    })
  }

  if (labels.length > 0) {
    tree.push({
      label: 'Labels',
      rows: labels,
    })
  }

  tree.push({
    label: 'More',
    rows: [
      {
        id: 'sidenav-attachment',
        label: 'Attachments',
        defaultIcon: mdiPaperclip,
        href: getTeamLinkHref(team, 'uploads'),
        active: getTeamLinkHref(team, 'uploads') === currentPath,
        navigateTo: () => push(getTeamLinkHref(team, 'uploads')),
        depth: 0,
      },
      {
        id: 'sidenav-shared',
        label: 'Shared',
        defaultIcon: mdiWeb,
        href: getTeamLinkHref(team, 'shared'),
        active: getTeamLinkHref(team, 'shared') === currentPath,
        navigateTo: () => push(getTeamLinkHref(team, 'shared')),
        depth: 0,
      },
    ],
  })

  tree.push({
    label: 'Status',
    rows: [
      {
        id: 'sidenav-status-in-progress',
        label: 'In Progress',
        defaultIcon: mdiPlayCircleOutline,
        href: getDocStatusHref(team, 'in-progress'),
        active: getDocStatusHref(team, 'in-progress') === currentPath,
        navigateTo: () => push(getDocStatusHref(team, 'in-progress')),
        depth: 0,
      },
      {
        id: 'sidenav-status-paused',
        label: 'Paused',
        defaultIcon: mdiPauseCircleOutline,
        href: getDocStatusHref(team, 'paused'),
        active: getDocStatusHref(team, 'paused') === currentPath,
        navigateTo: () => push(getDocStatusHref(team, 'paused')),
        depth: 0,
      },
      {
        id: 'sidenav-status-completed',
        label: 'Completed',
        defaultIcon: mdiCheckCircleOutline,
        href: getDocStatusHref(team, 'completed'),
        active: getDocStatusHref(team, 'completed') === currentPath,
        navigateTo: () => push(getDocStatusHref(team, 'completed')),
        depth: 0,
      },
      {
        id: 'sidenav-status-archived',
        label: 'Archived',
        defaultIcon: mdiArchiveOutline,
        href: getDocStatusHref(team, 'archived'),
        active: getDocStatusHref(team, 'archived') === currentPath,
        navigateTo: () => push(getDocStatusHref(team, 'archived')),
        depth: 0,
      },
    ],
  })

  tree.forEach((category) => {
    const key = (category.label || '').toLocaleLowerCase()
    const foldKey = `fold-${key}`
    const hideKey = `hide-${key}`
    category.folded = sideBarOpenedLinksIdsSet.has(foldKey)
    category.folding = getFoldEvents('links', foldKey, true)
    category.hidden = sideBarOpenedLinksIdsSet.has(hideKey)
    category.toggleHidden = () => toggleItem('links', hideKey)
  })

  return tree as SidebarNavCategory[]
}

function mapToolbarRows(
  showSpaces: boolean,
  setShowSpaces: React.Dispatch<React.SetStateAction<boolean>>,
  openState: (sidebarState: SidebarState) => void,
  openModal: (cmp: JSX.Element, options?: ModalOpeningOptions) => void,
  openSettingsTab: (tab: SettingsTab) => void,
  sidebarState?: SidebarState,
  team?: SerializedTeam
) {
  const rows: SidebarToolbarRow[] = []
  if (team != null) {
    rows.push({
      tooltip: 'Spaces',
      active: showSpaces,
      icon: (
        <RoundedImage
          size={26}
          alt={team.name}
          url={team.icon != null ? buildIconUrl(team.icon.location) : undefined}
        />
      ),
      onClick: () => setShowSpaces((prev) => !prev),
    })
  }
  rows.push({
    tooltip: 'Tree',
    active: sidebarState === 'tree',
    icon: mdiFileDocumentMultipleOutline,
    onClick: () => openState('tree'),
  })
  rows.push({
    tooltip: 'Search',
    active: sidebarState === 'search',
    icon: mdiMagnify,
    onClick: () => openState('search'),
  })
  rows.push({
    tooltip: 'Timeline',
    active: sidebarState === 'timeline',
    icon: mdiClockOutline,
    onClick: () => openState('timeline'),
  })
  rows.push({
    tooltip: 'Import',
    icon: mdiDownload,
    position: 'bottom',
    onClick: () => openModal(<ImportModal />, { showCloseIcon: true }),
  })
  rows.push({
    tooltip: 'Members',
    active: sidebarState === 'members',
    icon: mdiAccountMultiplePlusOutline,
    position: 'bottom',
    onClick: () => openSettingsTab('teamMembers'),
  })
  rows.push({
    tooltip: 'Settings',
    active: sidebarState === 'settings',
    icon: mdiCogOutline,
    position: 'bottom',
    onClick: () => openSettingsTab('preferences'),
  })

  return rows
}

function mapSpaces(
  push: (url: string) => void,
  teams: SerializedTeam[],
  invites: SerializedTeamInvite[],
  team?: SerializedTeam
) {
  const rows: SidebarSpace[] = []
  teams.forEach((globalTeam) => {
    const href = `${process.env.BOOST_HUB_BASE_URL}${getTeamURL(globalTeam)}`
    rows.push({
      label: globalTeam.name,
      active: team?.id === globalTeam.id,
      icon:
        globalTeam.icon != null
          ? buildIconUrl(globalTeam.icon.location)
          : undefined,
      linkProps: {
        href,
        onClick: (event: React.MouseEvent) => {
          event.preventDefault()
          push(href)
        },
      },
    })
  })

  invites.forEach((invite) => {
    const query = { t: invite.team.id, i: getHexFromUUID(invite.id) }
    const href = `${process.env.BOOST_HUB_BASE_URL}/invite?${stringify(query)}`
    rows.push({
      label: `${invite.team.name} (invited)`,
      icon:
        invite.team.icon != null
          ? buildIconUrl(invite.team.icon.location)
          : undefined,
      linkProps: {
        href,
        onClick: (event: React.MouseEvent) => {
          event.preventDefault()
          push(`/invite?${stringify(query)}`)
        },
      },
    })
  })

  return rows
}

function buildSpacesBottomRows(push: (url: string) => void) {
  return [
    {
      label: 'Create an account',
      icon: mdiPlusCircleOutline,
      linkProps: {
        href: `${process.env.BOOST_HUB_BASE_URL}/cooperate`,
        onClick: (event: React.MouseEvent) => {
          event.preventDefault()
          push(`/cooperate`)
        },
      },
    },
    {
      label: 'Download desktop app',
      icon: mdiDownload,
      linkProps: {
        href: 'https://github.com/BoostIO/BoostNote.next/releases/latest',
        target: '_blank',
        rel: 'noopener noreferrer',
      },
    },
    {
      label: 'Log out',
      icon: mdiLogoutVariant,
      linkProps: {
        href: '/api/oauth/signout',
        onClick: (event: React.MouseEvent) => {
          event.preventDefault()
          if (usingElectron) {
            sendToHost('sign-out')
          } else {
            window.location.href = `${process.env.BOOST_HUB_BASE_URL}/api/oauth/signout`
          }
        },
      },
    },
  ]
}

function buildChildrenNavRows(
  sortingOrder: SidebarTreeSortingOrder,
  childrenIds: string[],
  depth: number,
  map: Map<string, CloudTreeItem>
) {
  const rows = childrenIds.reduce((acc, childId) => {
    const childRow = map.get(childId)
    if (childRow == null) {
      return acc
    }

    if (childRow.hidden) {
      return acc
    }

    acc.push({
      ...childRow,
      depth,
      rows: buildChildrenNavRows(
        sortingOrder,
        childRow.children,
        depth + 1,
        map
      ),
    })

    return acc
  }, [] as (SidebarTreeChildRow & { lastUpdated: string })[])

  switch (sortingOrder) {
    case 'a-z':
      return sortByAttributeAsc('label', rows)
    case 'z-a':
      return sortByAttributeDesc('label', rows)
    case 'last-updated':
      return sortByAttributeDesc('lastUpdated', rows)
    case 'drag':
    default:
      return rows
  }
}

type CloudTreeItem = {
  id: string
  parentId?: string
  label: string
  defaultIcon?: string
  emoji?: string
  bookmarked?: boolean
  hidden?: boolean
  children: string[]
  folding?: FoldingProps
  folded?: boolean
  href?: string
  active?: boolean
  lastUpdated: string
  navigateTo?: () => void
  controls?: SidebarNavControls[]
  contextControls?: MenuItem[]
  dropIn?: boolean
  dropAround?: boolean
  onDragStart?: () => void
  onDrop?: (position?: SidebarDragState) => void
  onDragEnd?: () => void
}

function isCodeMirrorTextAreaEvent(event: KeyboardEvent) {
  const target = event.target as HTMLTextAreaElement
  if (target == null || target.tagName.toLowerCase() !== 'textarea') {
    return false
  }
  const classNameOfParentParentElement =
    target.parentElement?.parentElement?.className
  if (classNameOfParentParentElement == null) {
    return false
  }
  if (!/CodeMirror/.test(classNameOfParentParentElement)) {
    return false
  }

  return true
}
