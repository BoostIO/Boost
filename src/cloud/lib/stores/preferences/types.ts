import { SidebarState } from '../../../../shared/lib/sidebar'
import { LayoutMode } from '../../../components/layouts/DocEditLayout'

export interface Preferences {
  docContextIsHidden: boolean
  sidebarIsHidden: boolean
  sidebarIsHovered: boolean
  sideBarWidth: number
  lastEditorMode: 'edit' | 'preview'
  lastEditorEditLayout: LayoutMode
  workspaceManagerIsOpen: boolean
  sidebarBookmarksAreUnfolded: boolean
  lastSidebarState: SidebarState | undefined
}
