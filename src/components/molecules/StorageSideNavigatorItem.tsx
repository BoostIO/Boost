import React from 'react'
import { getStorageItemId } from '../../lib/nav'
import { useGeneralStatus } from '../../lib/generalStatus'
import { useDialog, DialogIconTypes } from '../../lib/dialog'
import { useDb } from '../../lib/db'
import { useRouter, usePathnameWithoutNoteId } from '../../lib/router'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../lib/toast'
import ControlButton from '../SideNavigator/ControlButton'
import {
  IconAddRound,
  IconArrowAgain,
  IconSetting,
  IconBook,
  IconImage,
  IconTrash,
} from '../icons'
import { useFirstUser } from '../../lib/preferences'
import SideNavigatorItem from './SideNavigatorItem'
import { useContextMenu, MenuTypes } from '../../lib/contextMenu'
import FolderListFragment from '../SideNavigator/FolderListFragment'
import { NoteStorage } from '../../lib/db/types'
import TagListFragment from '../SideNavigator/TagListFragment'

interface StorageSideNavigatorItemProps {
  storage: NoteStorage
}

const StorageSideNavigatorItem = ({
  storage,
}: StorageSideNavigatorItemProps) => {
  const {
    toggleSideNavOpenedItem,
    sideNavOpenedItemSet,
    openSideNavFolderItemRecursively,
  } = useGeneralStatus()
  const { prompt, messageBox } = useDialog()
  const {
    createFolder,
    renameFolder,
    renameStorage,
    removeStorage,
    syncStorage,
  } = useDb()
  const { push } = useRouter()
  const { t } = useTranslation()
  const { pushMessage } = useToast()
  const currentPathname = usePathnameWithoutNoteId()
  const user = useFirstUser()
  const { popup } = useContextMenu()

  const itemId = getStorageItemId(storage.id)
  const storageIsFolded = !sideNavOpenedItemSet.has(itemId)
  const showPromptToCreateFolder = (folderPathname: string) => {
    prompt({
      title: 'Create a Folder',
      message: 'Enter the path where do you want to create a folder',
      iconType: DialogIconTypes.Question,
      defaultValue: folderPathname === '/' ? '/' : `${folderPathname}/`,
      submitButtonLabel: 'Create Folder',
      onClose: async (value: string | null) => {
        if (value == null) {
          return
        }
        if (value.endsWith('/')) {
          value = value.slice(0, value.length - 1)
        }
        await createFolder(storage.id, value)

        push(`/app/storages/${storage.id}/notes${value}`)

        // Open folder item
        openSideNavFolderItemRecursively(storage.id, value)
      },
    })
  }
  const showPromptToRenameFolder = (folderPathname: string) => {
    prompt({
      title: t('folder.rename'),
      message: t('folder.renameMessage'),
      iconType: DialogIconTypes.Question,
      defaultValue: folderPathname.split('/').pop(),
      submitButtonLabel: t('folder.rename'),
      onClose: async (value: string | null) => {
        const folderPathSplit = folderPathname.split('/')
        if (value == null || value === '' || value === folderPathSplit.pop()) {
          return
        }
        const newPathname = folderPathSplit.join('/') + '/' + value
        try {
          await renameFolder(storage.id, folderPathname, newPathname)
          push(`/app/storages/${storage.id}/notes${newPathname}`)
          openSideNavFolderItemRecursively(storage.id, newPathname)
        } catch (error) {
          pushMessage({
            title: t('general.error'),
            description: t('folder.renameErrorMessage'),
          })
        }
      },
    })
  }

  const allNotesPagePathname = `/app/storages/${storage.id}/notes`
  const allNotesPageIsActive = currentPathname === allNotesPagePathname

  const trashcanPagePathname = `/app/storages/${storage.id}/trashcan`
  const trashcanPageIsActive = currentPathname === trashcanPagePathname

  const attachmentsPagePathname = `/app/storages/${storage.id}/attachments`
  const attachmentsPageIsActive = currentPathname === attachmentsPagePathname

  const controlComponents = [
    <ControlButton
      key={`${storage.id}-addFolderButton`}
      onClick={() => showPromptToCreateFolder('/')}
      icon={<IconAddRound />}
    />,
  ]

  if (storage.cloudStorage != null && user != null) {
    const cloudSync = () => {
      if (user == null) {
        pushMessage({
          title: 'No User Error',
          description: 'Please login first to sync the storage.',
        })
      }
      syncStorage(storage.id)
    }

    controlComponents.unshift(
      <ControlButton
        key={`${storage.id}-syncButton`}
        onClick={cloudSync}
        icon={<IconArrowAgain />}
      />
    )
  }

  controlComponents.unshift(
    <ControlButton
      key={`${storage.id}-settingsButton`}
      onClick={() => push(`/app/storages/${storage.id}`)}
      icon={<IconSetting size='1.3em' />}
    />
  )

  return (
    <React.Fragment key={itemId}>
      <SideNavigatorItem
        depth={0}
        label={storage.name}
        folded={storageIsFolded}
        onFoldButtonClick={() => {
          toggleSideNavOpenedItem(itemId)
        }}
        onClick={() => {
          toggleSideNavOpenedItem(itemId)
        }}
        onContextMenu={(event) => {
          event.preventDefault()
          popup(event, [
            {
              type: MenuTypes.Normal,
              label: t('storage.rename'),
              onClick: async () => {
                prompt({
                  title: `Rename "${storage.name}" storage`,
                  message: t('storage.renameMessage'),
                  iconType: DialogIconTypes.Question,
                  defaultValue: storage.name,
                  submitButtonLabel: t('storage.rename'),
                  onClose: async (value: string | null) => {
                    if (value == null) return
                    await renameStorage(storage.id, value)
                  },
                })
              },
            },
            {
              type: MenuTypes.Normal,
              label: t('storage.remove'),
              onClick: async () => {
                messageBox({
                  title: `Remove "${storage.name}" storage`,
                  message: t('storage.removeMessage'),
                  iconType: DialogIconTypes.Warning,
                  buttons: [t('storage.remove'), t('general.cancel')],
                  defaultButtonIndex: 0,
                  cancelButtonIndex: 1,
                  onClose: (value: number | null) => {
                    if (value === 0) {
                      removeStorage(storage.id)
                    }
                  },
                })
              },
            },
          ])
        }}
        controlComponents={controlComponents}
      />
      {!storageIsFolded && (
        <>
          <SideNavigatorItem
            depth={1}
            label='All Notes'
            icon={<IconBook size='1em' />}
            active={allNotesPageIsActive}
            onClick={() => push(allNotesPagePathname)}
          />
          <FolderListFragment
            storage={storage}
            showPromptToCreateFolder={showPromptToCreateFolder}
            showPromptToRenameFolder={showPromptToRenameFolder}
          />
          <TagListFragment storage={storage} />
          <SideNavigatorItem
            depth={1}
            label={t('general.attachments')}
            icon={<IconImage size='1.5em' />}
            active={attachmentsPageIsActive}
            onClick={() => push(attachmentsPagePathname)}
            onContextMenu={(event) => {
              event.preventDefault()
            }}
          />
          <SideNavigatorItem
            depth={1}
            label={t('general.trash')}
            icon={trashcanPageIsActive ? <IconTrash /> : <IconTrash />}
            active={trashcanPageIsActive}
            onClick={() => push(trashcanPagePathname)}
            onContextMenu={(event) => {
              event.preventDefault()
              // TODO: Implement context menu(restore all notes)
            }}
          />
        </>
      )}
    </React.Fragment>
  )
}

export default StorageSideNavigatorItem
