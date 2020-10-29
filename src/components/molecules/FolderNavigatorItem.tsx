import React, { useCallback, useMemo, MouseEvent } from 'react'
import { useDb } from '../../lib/db'
import { useDialog, DialogIconTypes } from '../../lib/dialog'
import NavigatorItem from '../atoms/NavigatorItem'
import { useGeneralStatus } from '../../lib/generalStatus'
import { getFolderItemId } from '../../lib/nav'
import { getTransferrableNoteData } from '../../lib/dnd'
import { useTranslation } from 'react-i18next'
import { mdiFolderOpen, mdiFolder, mdiDotsVertical, mdiPlus } from '@mdi/js'
import NavigatorButton from '../atoms/NavigatorButton'
import { useRouter } from '../../lib/router'
import { openContextMenu } from '../../lib/electronOnly'

interface FolderNavigatorItemProps {
  active: boolean
  storageId: string
  folderName: string
  depth: number
  folderPathname: string
  folderSetWithSubFolders: Set<string>
  createNoteInFolderAndRedirect: (folderPathname: string) => void
  showPromptToCreateFolder: (folderPathname: string) => void
  showPromptToRenameFolder: (folderPathname: string) => void
}

const FolderNavigatorItem = ({
  active,
  folderName,
  depth,
  storageId,
  folderPathname,
  folderSetWithSubFolders,
  createNoteInFolderAndRedirect,
  showPromptToCreateFolder,
  showPromptToRenameFolder,
}: FolderNavigatorItemProps) => {
  const { toggleSideNavOpenedItem, sideNavOpenedItemSet } = useGeneralStatus()
  const { push } = useRouter()
  const { messageBox } = useDialog()
  const { t } = useTranslation()
  const {
    createNote,
    updateNote,
    removeFolder,
    moveNoteToOtherStorage,
  } = useDb()

  const itemId = useMemo(() => {
    return getFolderItemId(storageId, folderPathname)
  }, [storageId, folderPathname])

  const folded = useMemo(() => {
    return folderSetWithSubFolders.has(folderPathname)
      ? !sideNavOpenedItemSet.has(itemId)
      : undefined
  }, [folderPathname, itemId, folderSetWithSubFolders, sideNavOpenedItemSet])

  const toggleFolded = useCallback(() => {
    toggleSideNavOpenedItem(itemId)
  }, [itemId, toggleSideNavOpenedItem])

  const openFolder = useCallback(() => {
    push(
      `/app/storages/${storageId}/notes${
        folderPathname === '/' ? '' : folderPathname
      }`
    )
  }, [storageId, folderPathname, push])

  const showFolderRemoveMessageBox = useCallback(() => {
    messageBox({
      title: `Remove "${folderPathname}" folder`,
      message: t('folder.removeMessage'),
      iconType: DialogIconTypes.Warning,
      buttons: [t('folder.remove'), t('general.cancel')],
      defaultButtonIndex: 0,
      cancelButtonIndex: 1,
      onClose: (value: number | null) => {
        if (value === 0) {
          removeFolder(storageId, folderPathname)
        }
      },
    })
  }, [storageId, folderPathname, messageBox, t, removeFolder])

  const showRenamePrompt = useCallback(() => {
    showPromptToRenameFolder(folderPathname)
  }, [folderPathname, showPromptToRenameFolder])

  const openFolderContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      openContextMenu({
        menuItems: [
          {
            type: 'normal',
            label: 'New Note',
            click: async () => {
              createNoteInFolderAndRedirect(folderPathname)
            },
          },
          {
            type: 'normal',
            label: 'New Subfolder',
            click: async () => {
              showPromptToCreateFolder(folderPathname)
            },
          },
          {
            type: 'separator',
          },
          {
            type: 'normal',
            label: t('folder.rename'),
            enabled: folderPathname !== '/',
            click: showRenamePrompt,
          },
          {
            type: 'normal',
            label: t('folder.remove'),
            enabled: folderPathname !== '/',
            click: showFolderRemoveMessageBox,
          },
        ],
      })
    },
    [
      folderPathname,
      t,
      createNoteInFolderAndRedirect,
      showPromptToCreateFolder,
      showRenamePrompt,
      showFolderRemoveMessageBox,
    ]
  )

  const openPlusContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      openContextMenu({
        menuItems: [
          {
            type: 'normal',
            label: 'New Note',
            click: async () => {
              createNoteInFolderAndRedirect(folderPathname)
            },
          },
          {
            type: 'normal',
            label: 'New Subfolder',
            click: async () => {
              showPromptToCreateFolder(folderPathname)
            },
          },
        ],
      })
    },
    [folderPathname, createNoteInFolderAndRedirect, showPromptToCreateFolder]
  )

  const openMoreContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      openContextMenu({
        menuItems: [
          {
            type: 'normal',
            label: t('folder.rename'),
            enabled: folderPathname !== '/',
            click: showRenamePrompt,
          },
          {
            type: 'normal',
            label: t('folder.remove'),
            enabled: folderPathname !== '/',
            click: showFolderRemoveMessageBox,
          },
        ],
      })
    },
    [folderPathname, t, showRenamePrompt, showFolderRemoveMessageBox]
  )

  const handleDrop = async (event: React.DragEvent) => {
    const transferrableNoteData = getTransferrableNoteData(event)
    if (transferrableNoteData == null) {
      return
    }

    const {
      storageId: originalNoteStorageId,
      note: originalNote,
    } = transferrableNoteData

    if (storageId === originalNoteStorageId) {
      await updateNote(storageId, originalNote._id, {
        folderPathname,
      })
    } else {
      messageBox({
        title: t('storage.moveTitle'),
        message: t('storage.moveMessage'),
        iconType: DialogIconTypes.Info,
        buttons: [t('storage.move'), t('storage.copy'), t('general.cancel')],
        defaultButtonIndex: 0,
        cancelButtonIndex: 2,
        onClose: async (value: number | null) => {
          switch (value) {
            case 0:
              await moveNoteToOtherStorage(
                originalNoteStorageId,
                originalNote._id,
                storageId,
                folderPathname
              )
              return
            case 1:
              await createNote(storageId, {
                title: originalNote.title,
                content: originalNote.content,
                folderPathname,
                tags: originalNote.tags,
                data: originalNote.data,
              })
              return
          }
        },
      })
    }
  }

  return (
    <NavigatorItem
      folded={folded}
      depth={depth}
      active={active}
      iconPath={active ? mdiFolderOpen : mdiFolder}
      label={folderName}
      onClick={openFolder}
      onDoubleClick={showRenamePrompt}
      onContextMenu={openFolderContextMenu}
      onFoldButtonClick={toggleFolded}
      control={
        <>
          <NavigatorButton onClick={openPlusContextMenu} iconPath={mdiPlus} />
          <NavigatorButton
            onClick={openMoreContextMenu}
            iconPath={mdiDotsVertical}
          />
        </>
      }
      onDragOver={preventDefault}
      onDrop={handleDrop}
    />
  )
}

function preventDefault(event: MouseEvent) {
  event.preventDefault()
}

export default FolderNavigatorItem
