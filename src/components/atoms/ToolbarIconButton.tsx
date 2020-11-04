import React from 'react'
import styled from '../../lib/styled'
import Icon from './Icon'
import { flexCenter } from '../../lib/styled/styleFunctions'

const ToolbarButtonContainer = styled.button`
  height: 24px;
  width: 24px;
  box-sizing: border-box;
  font-size: 18px;
  outline: none;

  background-color: transparent;
  ${flexCenter}

  border: none;
  cursor: pointer;

  transition: color 200ms ease-in-out;
  color: ${({ theme }) => theme.navButtonColor};
  &:hover {
    color: ${({ theme }) => theme.navButtonHoverColor};
  }

  &:active,
  &.active {
    color: ${({ theme }) => theme.navButtonActiveColor};
  }
`

interface ToolbarButtonProps {
  iconPath: string
  active?: boolean
  title?: string
  onContextMenu?: React.MouseEventHandler
  onClick: React.MouseEventHandler
}

const ToolbarButton = React.forwardRef(
  (
    {
      iconPath,
      onClick,
      onContextMenu,
      active = false,
      title,
    }: ToolbarButtonProps,
    ref
  ) => (
    <ToolbarButtonContainer
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={active ? 'active' : ''}
      ref={ref}
      title={title}
    >
      <Icon path={iconPath} />
    </ToolbarButtonContainer>
  )
)

export default ToolbarButton
