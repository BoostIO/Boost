import styled from '../../../lib/styled'

export const StyledContentManager = styled.div`
  display: block;
  width: 100%;
  padding: 0 ${({ theme }) => theme.space.large}px
    ${({ theme }) => theme.space.medium}px;
`

export const StyledContentManagerHeaderRow = styled.div`
  padding: 0 8px;
  height: 30px;
  border-bottom: 1px solid ${({ theme }) => theme.subtleBorderColor};
  .checkbox {
    margin-left: 8px;
  }
`

export const StyledContentManagerSelector = styled.button`
  background: none;
  outline: none;
  padding: 0;
  cursor: pointer;
  border-radius: 3px;
  color: ${({ theme }) => theme.subtleTextColor};
  font-size: 13px;
  &:disabled {
    cursor: not-allowed;
  }
  &:hover:not(:disabled) {
    color: ${({ theme }) => theme.emphasizedTextColor};
    background-color: ${({ theme }) => theme.emphasizedBackgroundColor};
  }
`

export const StyledContentManagerSelectorControl = styled.div`
  position: relative;
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  font-size: 13px;
  position: relative;
`

export const StyledContentManagerRow = styled.div`
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  height: 40px;
  flex: 1 1 auto;
  width: 100%;
  border-bottom: 1px solid ${({ theme }) => theme.subtleBorderColor};
  font-size: 13px;
  padding: 0 8px;

  &.expanded {
    height: 60px;
  }

  .actions {
    display: none;
  }

  &:hover {
    background: ${({ theme }) => theme.subtleBackgroundColor};
    .custom-check::before {
      border-color: ${({ theme }) => theme.subtleTextColor};
    }

    .actions {
      display: flex;
    }

    .date {
      display: none;
    }
  }

  .link {
    overflow: hidden;
  }

  .subtle {
    color: ${({ theme }) => theme.secondaryTextColor};
    margin: 0;
    font-size: ${({ theme }) => theme.fontSizes.xxsmall}px;
  }

  a {
    width: 100%;
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    height: 100%;
    color: ${({ theme }) => theme.baseTextColor};
    text-decoration: none;
  }

  .checkbox {
    margin-right: 8px;
  }
  .status-icon {
    margin-right: 4px;
  }

  .date {
    flex: 0 2 auto;
    font-size: 13px;
    color: ${({ theme }) => theme.subtleTextColor};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .label {
    flex: 1 1 auto;
    margin: 0 ${({ theme }) => theme.space.xsmall}px 0 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &.parent {
    font-size: ${({ theme }) => theme.fontSizes.xxlarge}px;
    padding-left: 2px;
  }
`

export const StyledContentManagerList = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: calc(100vh - ${({ theme }) => theme.topHeaderHeight}px);
`

export const StyledRowActionIcon = styled.button`
  padding: 0;
  margin: 0 ${({ theme }) => theme.space.xxsmall}px;
  display: inline-block;
  background: none;
  outline: 0;
  border: 0;
  color: ${({ theme }) => theme.baseTextColor};
  width: 25px;

  .icon {
    color: inherit !important;
  }

  &:hover {
    color: ${({ theme }) => theme.emphasizedTextColor};
  }

  &:disabled {
    color: ${({ theme }) => theme.secondaryTextColor};
    cursor: not-allowed;
  }

  &.valign-super {
    vertical-align: middle;
  }
`
