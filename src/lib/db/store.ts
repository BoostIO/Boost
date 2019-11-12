import {
  NoteStorage,
  NoteStorageData,
  ObjectMap,
  NoteDoc,
  NoteDocEditibleProps,
  PopulatedFolderDoc,
  PopulatedTagDoc
} from './types'
import { useState, useCallback } from 'react'
import { createStoreContext } from '../utils/context'
import ow from 'ow'
import { schema, isValid } from '../utils/predicates'
import NoteDb from './NoteDb'
import {
  getFolderPathname,
  getParentFolderPathname,
  getAllParentFolderPathnames
} from './utils'
import { generateId } from '../string'
import PouchDB from './PouchDB'
import { LiteStorage, localLiteStorage } from 'ltstrg'
import { produce } from 'immer'
import { useRouter } from '../router'
import { values } from '../db/utils'
import { storageDataListKey } from '../localStorageKeys'
import { TAG_ID_PREFIX } from './consts'
import { difference } from 'ramda'

export interface DbStore {
  initialized: boolean
  storageMap: ObjectMap<NoteStorage>
  initialize: () => Promise<void>
  createStorage: (name: string) => Promise<NoteStorage>
  removeStorage: (id: string) => Promise<void>
  renameStorage: (id: string, name: string) => Promise<void>
  createFolder: (storageName: string, pathname: string) => Promise<void>
  removeFolder: (storageName: string, pathname: string) => Promise<void>
  createNote(
    storageId: string,
    noteProps: Partial<NoteDocEditibleProps>
  ): Promise<NoteDoc | undefined>
  updateNote(
    storageId: string,
    noteId: string,
    noteProps: Partial<NoteDocEditibleProps>
  ): Promise<NoteDoc | undefined>
  trashNote(storageId: string, noteId: string): Promise<NoteDoc | undefined>
  purgeNote(storageId: string, noteId: string): Promise<void>
}

export function createDbStoreCreator(
  liteStorage: LiteStorage,
  adapter: 'idb' | 'memory'
) {
  return (): DbStore => {
    const router = useRouter()
    const [initialized, setInitialized] = useState(false)
    const [storageMap, setStorageMap] = useState<ObjectMap<NoteStorage>>({})

    const initialize = useCallback(async () => {
      const storageDataList = getStorageDataListOrFix(liteStorage)
      const storages = await Promise.all(
        storageDataList.map(storageData => prepareStorage(storageData, adapter))
      )

      setInitialized(true)
      setStorageMap(
        storages.reduce(
          (map, storage) => {
            map[storage.id] = storage
            return map
          },
          {} as ObjectMap<NoteStorage>
        )
      )
    }, [])

    const createStorage = useCallback(async (name: string) => {
      const id = generateId()
      const storage = await prepareStorage(
        {
          id,
          name
        },
        adapter
      )

      let newStorageMap: ObjectMap<NoteStorage>
      setStorageMap(prevStorageMap => {
        newStorageMap = produce(prevStorageMap, draft => {
          draft[id] = storage
        })

        return newStorageMap
      })

      saveStorageDataList(liteStorage, newStorageMap!)
      return storage
    }, [])

    const removeStorage = useCallback(
      async (id: string) => {
        const storage = storageMap[id]
        if (storage == null) {
          return
        }
        await storage.db.pouchDb.destroy()
        let newStorageMap: ObjectMap<NoteStorage>
        setStorageMap(prevStorageMap => {
          newStorageMap = produce(prevStorageMap, draft => {
            delete draft[id]
          })

          return newStorageMap
        })

        saveStorageDataList(liteStorage, newStorageMap!)
      },
      // FIXME: The callback regenerates every storageMap change.
      // We should move the method to NoteStorage so the method instantiate only once.
      [storageMap]
    )

    const renameStorage = useCallback(async (id: string, name: string) => {
      let newStorageMap: ObjectMap<NoteStorage>
      setStorageMap(prevStorageMap => {
        newStorageMap = produce(prevStorageMap, draft => {
          if (prevStorageMap[id] != null) {
            draft[id]!.name = name
          }
        })

        return newStorageMap
      })

      saveStorageDataList(liteStorage, newStorageMap!)
    }, [])

    const createFolder = useCallback(
      async (id: string, pathname: string) => {
        const storage = storageMap[id]
        if (storage == null) {
          return
        }
        const folder = await storage.db.upsertFolder(pathname)
        const parentFolders = await storage.db.getFoldersByPathnames(
          getAllParentFolderPathnames(pathname)
        )
        const createdFolders = [folder, ...parentFolders].reverse()

        setStorageMap(
          produce((draft: ObjectMap<NoteStorage>) => {
            createdFolders.forEach(aFolder => {
              const aPathname = getFolderPathname(aFolder._id)
              if (storage.folderMap[aPathname] == null) {
                draft[id]!.folderMap[aPathname] = {
                  ...aFolder,
                  pathname: aPathname,
                  noteIdSet: new Set()
                }
              }
            })
          })
        )
      },
      [storageMap]
    )

    const removeFolder = useCallback(
      async (id: string, pathname: string) => {
        const storage = storageMap[id]
        if (storage == null) {
          return
        }
        await storage.db.removeFolder(pathname)
        if (
          router.pathname.startsWith(`/app/storages/${id}/notes${pathname}`)
        ) {
          router.replace(
            `/app/storages/${id}/notes${getParentFolderPathname(pathname)}`
          )
        }

        const deletedFolderPathnames = [
          pathname,
          ...Object.keys(storage.folderMap).filter(aPathname =>
            aPathname.startsWith(`${pathname}/`)
          )
        ]
        // TODO: Reflect deleted notes
        setStorageMap(
          produce((draft: ObjectMap<NoteStorage>) => {
            deletedFolderPathnames.forEach(aPathname => {
              delete draft[id]!.folderMap[aPathname]
            })
          })
        )
      },
      [storageMap, router]
    )

    const createNote = useCallback(
      async (storageId: string, noteProps: Partial<NoteDocEditibleProps>) => {
        const storage = storageMap[storageId]
        if (storage == null) {
          return
        }
        const noteDoc = await storage.db.createNote(noteProps)

        const parentFolderPathnamesToCheck = [
          ...getAllParentFolderPathnames(noteDoc.folderPathname)
        ].filter(aPathname => storage.folderMap[aPathname] == null)
        const parentFoldersToRefresh =
          parentFolderPathnamesToCheck.length > 0
            ? await storage.db.getFoldersByPathnames(
                parentFolderPathnamesToCheck
              )
            : []

        const folder: PopulatedFolderDoc =
          storage.folderMap[noteDoc.folderPathname] == null
            ? ({
                ...(await storage.db.getFolder(noteDoc.folderPathname)!),
                pathname: noteDoc.folderPathname,
                noteIdSet: new Set([noteDoc._id])
              } as PopulatedFolderDoc)
            : {
                ...storage.folderMap[noteDoc.folderPathname]!,
                noteIdSet: new Set([
                  ...storage.folderMap[noteDoc.folderPathname]!.noteIdSet,
                  noteDoc._id
                ])
              }

        const modifiedTags = ((await Promise.all(
          noteDoc.tags.map(async tag => {
            if (storage.tagMap[tag] == null) {
              return {
                ...(await storage.db.getTag(tag)!),
                noteIdSet: new Set([noteDoc._id])
              } as PopulatedTagDoc
            } else {
              return {
                ...storage.tagMap[tag]!,
                noteIdSet: new Set([
                  ...storage.tagMap[tag]!.noteIdSet.values(),
                  noteDoc._id
                ])
              }
            }
          })
        )) as PopulatedTagDoc[]).reduce((acc, tag) => {
          acc[tag._id.replace(TAG_ID_PREFIX, '')] = tag
          return acc
        }, {})

        setStorageMap(
          produce((draft: ObjectMap<NoteStorage>) => {
            draft[storageId]!.noteMap[noteDoc._id] = noteDoc
            parentFoldersToRefresh.forEach(folder => {
              const aPathname = getFolderPathname(folder._id)
              draft[storageId]!.folderMap[aPathname] = {
                ...folder,
                pathname: aPathname,
                noteIdSet: new Set()
              }
            })
            draft[storageId]!.folderMap[noteDoc.folderPathname] = folder
            draft[storageId]!.tagMap = {
              ...storage.tagMap,
              ...modifiedTags
            }
          })
        )
        return noteDoc
      },
      [storageMap]
    )

    const updateNote = useCallback(
      async (
        storageId: string,
        noteId: string,
        noteProps: Partial<NoteDocEditibleProps>
      ) => {
        const storage = storageMap[storageId]
        if (storage == null) {
          return
        }
        const noteDoc = await storage.db.updateNote(noteId, noteProps)
        if (noteDoc == null) {
          return
        }

        const parentFolderPathnamesToCheck = [
          ...getAllParentFolderPathnames(noteDoc.folderPathname)
        ].filter(aPathname => storage.folderMap[aPathname] == null)
        const parentFoldersToRefresh =
          parentFolderPathnamesToCheck.length > 0
            ? await storage.db.getFoldersByPathnames(
                parentFolderPathnamesToCheck
              )
            : []
        const folder: PopulatedFolderDoc =
          storage.folderMap[noteDoc.folderPathname] == null
            ? ({
                ...(await storage.db.getFolder(noteDoc.folderPathname)!),
                pathname: noteDoc.folderPathname,
                noteIdSet: new Set([noteDoc._id])
              } as PopulatedFolderDoc)
            : {
                ...storage.folderMap[noteDoc.folderPathname]!,
                noteIdSet: new Set([
                  ...storage.folderMap[noteDoc.folderPathname]!.noteIdSet,
                  noteDoc._id
                ])
              }

        const removedTags: ObjectMap<PopulatedTagDoc> = difference(
          storage.noteMap[noteDoc._id]!.tags,
          noteDoc.tags
        ).reduce((acc, tag) => {
          const newNoteIdSet = new Set(storage.tagMap[tag]!.noteIdSet)
          newNoteIdSet.delete(noteDoc._id)
          acc[tag] = {
            ...storage.tagMap[tag]!,
            noteIdSet: newNoteIdSet
          }
          return acc
        }, {})

        const modifiedTags: ObjectMap<PopulatedTagDoc> = ((await Promise.all(
          noteDoc.tags.map(async tag => {
            if (storage.tagMap[tag] == null) {
              return {
                ...(await storage.db.getTag(tag)!),
                noteIdSet: new Set([noteDoc._id])
              } as PopulatedTagDoc
            } else {
              return {
                ...storage.tagMap[tag]!,
                noteIdSet: new Set([
                  ...storage.tagMap[tag]!.noteIdSet.values(),
                  noteDoc._id
                ])
              }
            }
          })
        )) as PopulatedTagDoc[]).reduce((acc, tag) => {
          acc[tag._id.replace(TAG_ID_PREFIX, '')] = tag
          return acc
        }, {})

        setStorageMap(
          produce((draft: ObjectMap<NoteStorage>) => {
            draft[storageId]!.noteMap[noteDoc._id] = noteDoc
            parentFoldersToRefresh.forEach(folder => {
              const aPathname = getFolderPathname(folder._id)
              draft[storageId]!.folderMap[aPathname] = {
                ...folder,
                pathname: aPathname,
                noteIdSet: new Set()
              }
            })
            draft[storageId]!.folderMap[noteDoc.folderPathname] = folder
            draft[storageId]!.tagMap = {
              ...storage.tagMap,
              ...removedTags,
              ...modifiedTags
            }
          })
        )

        return noteDoc
      },
      [storageMap]
    )

    const trashNote = useCallback(
      async (storageId: string, noteId: string) => {
        const storage = storageMap[storageId]
        if (storage == null) {
          return
        }
        const noteDoc = await storage.db.trashNote(noteId)
        if (noteDoc == null) {
          return
        }

        setStorageMap(
          produce((draft: ObjectMap<NoteStorage>) => {
            draft[storageId]!.noteMap[noteDoc._id] = noteDoc
          })
        )

        return noteDoc
      },
      [storageMap]
    )

    const purgeNote = useCallback(
      async (storageId: string, noteId: string) => {
        const storage = storageMap[storageId]
        if (storage == null) {
          return
        }

        await storage.db.purgeNote(noteId)

        const noteDoc = storageMap[storageId]!.noteMap[noteId]!

        const noteMap = { ...storageMap[storageId]!.noteMap }
        delete noteMap[noteId]

        const newFolderNoteIdSet = new Set(
          storage.folderMap[noteDoc.folderPathname]!.noteIdSet
        )
        newFolderNoteIdSet.delete(noteDoc._id)
        const folder: PopulatedFolderDoc = {
          ...storage.folderMap[noteDoc.folderPathname]!,
          noteIdSet: newFolderNoteIdSet
        }

        const modifiedTags: ObjectMap<PopulatedTagDoc> = noteDoc.tags.reduce(
          (acc, tag) => {
            const newNoteIdSet = new Set(storage.tagMap[tag]!.noteIdSet)
            newNoteIdSet.delete(noteDoc._id)
            acc[tag] = {
              ...storage.tagMap[tag]!,
              noteIdSet: newNoteIdSet
            }
            return acc
          },
          {}
        )

        setStorageMap(
          produce((draft: ObjectMap<NoteStorage>) => {
            draft[storageId]!.noteMap = noteMap
            draft[storageId]!.folderMap[noteDoc.folderPathname] = folder
            draft[storageId]!.tagMap = {
              ...storage.tagMap,
              ...modifiedTags
            }
          })
        )

        return
      },
      [storageMap]
    )

    return {
      initialized,
      storageMap,
      initialize,
      createStorage,
      removeStorage,
      renameStorage,
      createFolder,
      removeFolder,
      createNote,
      updateNote,
      trashNote,
      purgeNote
    }
  }
}

const storageDataPredicate = schema({
  id: ow.string,
  name: ow.string
})

export const {
  StoreProvider: DbProvider,
  useStore: useDb
} = createStoreContext(createDbStoreCreator(localLiteStorage, 'idb'))

export function getStorageDataList(
  liteStorage: LiteStorage
): NoteStorageData[] | null {
  const serializedStorageDataList = liteStorage.getItem(storageDataListKey)

  try {
    const parsedStorageDataList = JSON.parse(serializedStorageDataList || '[]')
    if (!Array.isArray(parsedStorageDataList))
      throw new Error('storage data is corrupted')

    return parsedStorageDataList.reduce<NoteStorageData[]>(
      (validatedList, parsedStorageData) => {
        if (isValid(parsedStorageData, storageDataPredicate)) {
          validatedList.push(parsedStorageData)
        }
        return validatedList
      },
      []
    )
  } catch (error) {
    console.warn(error)
    return null
  }
}

function getStorageDataListOrFix(liteStorage: LiteStorage): NoteStorageData[] {
  let storageDataList = getStorageDataList(liteStorage)
  if (storageDataList == null) {
    storageDataList = []
    liteStorage.setItem(storageDataListKey, '[]')
  }
  return storageDataList
}

function saveStorageDataList(
  liteStorage: LiteStorage,
  storageMap: ObjectMap<NoteStorage>
) {
  liteStorage.setItem(
    storageDataListKey,
    JSON.stringify(values(storageMap).map(({ id, name }) => ({ id, name })))
  )
}

async function prepareStorage(
  { id, name }: NoteStorageData,
  adapter: 'idb' | 'memory'
): Promise<NoteStorage> {
  const pouchdb = new PouchDB(id, { adapter })
  const db = new NoteDb(pouchdb, id, name)
  await db.init()

  const { noteMap, folderMap, tagMap } = await db.getAllDocsMap()
  const storage: NoteStorage = {
    id,
    name,
    noteMap,
    folderMap: Object.entries(folderMap).reduce(
      (map, [pathname, folderDoc]) => {
        map[pathname] = {
          ...folderDoc,
          pathname,
          noteIdSet: new Set()
        }

        return map
      },
      {}
    ),
    tagMap: Object.entries(tagMap).reduce((map, [name, tagDoc]) => {
      map[name] = { ...tagDoc, name, noteIdSet: new Set() }
      return map
    }, {}),
    db
  }

  for (const noteDoc of Object.values(noteMap) as NoteDoc[]) {
    storage.folderMap[noteDoc.folderPathname]!.noteIdSet.add(noteDoc._id)
    noteDoc.tags.forEach(tagName => {
      storage.tagMap[tagName]!.noteIdSet.add(noteDoc._id)
    })
  }

  return storage
}
